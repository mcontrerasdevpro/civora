// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.30;

import {IRootVerifier, IVerifierHelper} from "./zkpassport/IRootVerifier.sol";
import {ProofVerificationParams} from "./zkpassport/Types.sol";

/// @title VotacionAnonima
/// @notice Registra votos identificados solo por un "nullifier", de forma
///         que el mismo documento no puede votar dos veces sin que el
///         contrato conozca la identidad real del votante.
/// @dev Dos vias de voto:
///      - votarConPruebaZk: la prueba de elegibilidad (DNIe/pasaporte via
///        ZKPassport) se verifica aqui mismo, contra el verificador oficial
///        de ZKPassport (`verificadorZk`). Ni el operador de este sistema ni
///        nadie mas puede aceptar un voto por esta via sin una prueba
///        criptografica valida.
///      - votarManual: voto de la via de certificado digital. La firma se
///        verifica fuera de cadena, en el servidor, y solo el relayer puede
///        llamar a esta funcion (ver docs/decisiones/0004 y 0006). Se
///        elimina en la Fase 1.
///      Cada propuesta admite una sola de las dos vias, fijada al crearla
///      (ADR 0021): los nullifiers de una via y de la otra no se pueden
///      relacionar, asi que con las dos abiertas una persona votaria dos veces.
///      Empadronamiento y 5 anios de residencia siguen sin verificacion real
///      (el chip del documento no los contiene, ver README/modelo-amenazas).
contract VotacionAnonima {
    enum Opcion {
        AFavor,
        EnContra,
        Abstencion
    }

    /// @notice Via de identidad que admite una propuesta. Inmutable.
    enum Via {
        Certificado,
        Zk
    }

    struct Propuesta {
        string contenidoHash; // hash del JSON de la propuesta (integridad verificable)
        uint256 apertura; // timestamp desde el que se puede votar
        uint256 cierre; // timestamp de cierre
        uint256 aFavor;
        uint256 enContra;
        uint256 abstenciones;
        bool existe;
        Via via; // unica via con la que se puede votar en esta propuesta
    }

    /// @dev Requisitos de elegibilidad fijos para toda la instancia (iguales a los
    ///      que ya usa el formulario de creacion de propuestas). Personalizar
    ///      la edad/nacionalidad por propuesta queda pendiente.
    uint8 public constant EDAD_MINIMA = 18;
    /// @dev Antiguedad maxima aceptada de una prueba, para que no se pueda
    ///      reutilizar una prueba generada hace mucho tiempo.
    uint256 public constant FRESCURA_PRUEBA = 1 days;

    /// @notice Verificador oficial de pruebas ZKPassport (mismo address en
    ///         Ethereum, Sepolia y Base). En redes locales de test se usa un
    ///         MockRootVerifier (ver contracts/zkpassport/MockRootVerifier.sol).
    IRootVerifier public immutable verificadorZk;
    /// @notice Cuenta autorizada para crear propuestas y retransmitir votos de certificado.
    address public immutable relayer;
    /// @notice Debe coincidir con NEXT_PUBLIC_ZKPASSPORT_DOMAIN en la web.
    string public dominioZk;
    /// @notice Si es false, este contrato rechaza pruebas generadas en modo
    ///         desarrollo (documentos simulados / mock).
    bool public immutable devModeZk;

    mapping(bytes32 => Propuesta) public propuestas;
    mapping(bytes32 => mapping(bytes32 => bool)) public nullifierUsado; // propuestaId => nullifier => usado
    mapping(bytes32 => mapping(bytes32 => Opcion)) public votoDeNullifier; // propuestaId => nullifier => opcion

    event PropuestaCreada(bytes32 indexed propuestaId, string contenidoHash, uint256 apertura, uint256 cierre, Via via);
    event VotoEmitido(bytes32 indexed propuestaId, bytes32 indexed nullifier, Opcion opcion);

    error PruebaInvalida();
    error AmbitoIncorrecto();
    error PruebaCaducada();
    error ModoDesarrolloNoPermitido();
    error NoCumpleEdadMinima();
    error NacionalidadNoValida();
    error OpcionNoVinculada();
    error ViaNoPermitida();

    error SoloRelayer();
    error DireccionCero();

    constructor(address _verificadorZk, string memory _dominioZk, bool _devModeZk, address _relayer) {
        if (_verificadorZk == address(0) || _relayer == address(0)) revert DireccionCero();
        verificadorZk = IRootVerifier(_verificadorZk);
        relayer = _relayer;
        dominioZk = _dominioZk;
        devModeZk = _devModeZk;
    }

    function crearPropuesta(
        bytes32 propuestaId,
        string calldata contenidoHash,
        uint256 apertura,
        uint256 cierre,
        Via via
    ) external {
        if (msg.sender != relayer) revert SoloRelayer();
        require(!propuestas[propuestaId].existe, "La propuesta ya existe");
        require(cierre > apertura, "El cierre debe ser posterior a la apertura");
        propuestas[propuestaId] = Propuesta({
            contenidoHash: contenidoHash,
            apertura: apertura,
            cierre: cierre,
            aFavor: 0,
            enContra: 0,
            abstenciones: 0,
            existe: true,
            via: via
        });
        emit PropuestaCreada(propuestaId, contenidoHash, apertura, cierre, via);
    }

    /// @notice Registra un voto de la via de certificado digital. El servidor
    ///         verifica la firma CAdES y la cadena FNMT/DGP fuera de cadena y
    ///         retransmite el voto como relayer; nadie mas puede llamarla.
    /// @param nullifier HMAC-SHA256 calculado en el servidor con un secreto
    ///        (NULLIFIER_CERTIFICADO_SECRET) sobre la propuesta y el DNI; no
    ///        es enumerable sin ese secreto (ver docs/decisiones/0005).
    /// @param nota Rastro informativo de la via ("certificado"); no se verifica
    ///        y nunca contiene datos del votante.
    function votarManual(bytes32 propuestaId, bytes32 nullifier, Opcion opcion, bytes calldata nota) external {
        if (msg.sender != relayer) revert SoloRelayer();
        nota;
        _exigirVia(propuestaId, Via.Certificado);
        _registrarVoto(propuestaId, nullifier, opcion);
    }

    /// @notice Vota presentando una prueba ZKPassport, verificada aqui mismo contra
    ///         el verificador oficial antes de aceptar el voto.
    /// @param propuestaIdTexto El uuid de la propuesta tal cual (no su hash): hace
    ///        falta el texto para reconstruir el mismo ambito ("scope") con el que
    ///        se genero la prueba y comprobar que coincide.
    /// @param params Parametros de verificacion que entrega el SDK de ZKPassport
    ///        (`getSolidityVerifierParameters`), generados en modo `compressed-evm`.
    /// @dev La opcion va dentro de la prueba como dato vinculado (`custom_data`,
    ///      ver datosVinculados): quien vea la transaccion no puede reenviar la
    ///      prueba con otra opcion (R-01).
    function votarConPruebaZk(
        string calldata propuestaIdTexto,
        Opcion opcion,
        ProofVerificationParams calldata params
    ) external {
        // Antes que la prueba: en una propuesta de certificado no se acepta
        // ninguna prueba ZK, ni siquiera llamando al contrato directamente.
        _exigirVia(keccak256(bytes(propuestaIdTexto)), Via.Zk);
        if (params.serviceConfig.devMode && !devModeZk) revert ModoDesarrolloNoPermitido();

        (bool valida, bytes32 identificadorUnico, IVerifierHelper helper) = verificadorZk.verify(params);
        if (!valida) revert PruebaInvalida();

        string memory ambito = string.concat("civora-voto-", propuestaIdTexto);
        if (!helper.verifyScopes(params.proofVerificationData.publicInputs, dominioZk, ambito)) {
            revert AmbitoIncorrecto();
        }

        if (helper.getProofTimestamp(params.proofVerificationData.publicInputs) + FRESCURA_PRUEBA < block.timestamp) {
            revert PruebaCaducada();
        }

        if (!helper.isAgeAboveOrEqual(EDAD_MINIMA, params.committedInputs)) {
            revert NoCumpleEdadMinima();
        }

        // Los pasaportes simulados de ZKPassport (solo en el registro de
        // Sepolia) no son españoles: el contrato de demostración (devModeZk,
        // inmutable y solo en Sepolia, ADR 0010) no exige la nacionalidad.
        if (!devModeZk) {
            string[] memory nacionalidadesValidas = new string[](1);
            nacionalidadesValidas[0] = "ESP";
            if (!helper.isNationalityIn(nacionalidadesValidas, params.committedInputs)) {
                revert NacionalidadNoValida();
            }
        }

        string memory vinculados = helper.getBoundData(params.committedInputs).customData;
        if (keccak256(bytes(vinculados)) != keccak256(bytes(datosVinculados(propuestaIdTexto, opcion)))) {
            revert OpcionNoVinculada();
        }

        _registrarVoto(keccak256(bytes(propuestaIdTexto)), identificadorUnico, opcion);
    }

    /// @notice Dato que la prueba ZK debe llevar vinculado (`custom_data`) para
    ///         votar `opcion` en la propuesta: `civora-voto:<uuid>:<opcion>`.
    ///         Debe coincidir con datosVinculadosDeVoto de packages/zk-identity.
    function datosVinculados(string calldata propuestaIdTexto, Opcion opcion) public pure returns (string memory) {
        string memory nombre = opcion == Opcion.AFavor
            ? "a_favor"
            : opcion == Opcion.EnContra
                ? "en_contra"
                : "abstencion";
        return string.concat("civora-voto:", propuestaIdTexto, ":", nombre);
    }

    function _exigirVia(bytes32 propuestaId, Via via) internal view {
        Propuesta storage p = propuestas[propuestaId];
        require(p.existe, "Propuesta inexistente");
        if (p.via != via) revert ViaNoPermitida();
    }

    function _registrarVoto(bytes32 propuestaId, bytes32 nullifier, Opcion opcion) internal {
        Propuesta storage p = propuestas[propuestaId];
        require(p.existe, "Propuesta inexistente");
        require(block.timestamp >= p.apertura, "La votacion todavia no ha comenzado");
        require(block.timestamp < p.cierre, "Votacion cerrada");
        require(!nullifierUsado[propuestaId][nullifier], "Este documento ya ha votado en esta propuesta");

        nullifierUsado[propuestaId][nullifier] = true;
        votoDeNullifier[propuestaId][nullifier] = opcion;

        if (opcion == Opcion.AFavor) {
            p.aFavor += 1;
        } else if (opcion == Opcion.EnContra) {
            p.enContra += 1;
        } else {
            p.abstenciones += 1;
        }

        emit VotoEmitido(propuestaId, nullifier, opcion);
    }

    function resultados(bytes32 propuestaId)
        external
        view
        returns (uint256 aFavor, uint256 enContra, uint256 abstenciones)
    {
        Propuesta storage p = propuestas[propuestaId];
        require(p.existe, "Propuesta inexistente");
        return (p.aFavor, p.enContra, p.abstenciones);
    }

    /// @notice Recibo publico: permite a un votante comprobar, con su nullifier,
    ///         que su voto quedo contado y como. No revela su identidad real.
    function votoDe(bytes32 propuestaId, bytes32 nullifier)
        external
        view
        returns (bool registrado, Opcion opcion)
    {
        registrado = nullifierUsado[propuestaId][nullifier];
        opcion = votoDeNullifier[propuestaId][nullifier];
    }
}
