// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.24;

/// @title VotacionAnonima
/// @notice Esqueleto de PoC. Registra votos identificados solo por un
///         "nullifier" derivado de una prueba ZK (ver packages/zk-identity),
///         de forma que el mismo documento no puede votar dos veces sin que
///         el contrato conozca la identidad real del votante.
/// @dev Inspirado en el patron IDCardVoting/BioPassportVoting visto en
///      council-dao, simplificado y con logica de elegibilidad propia
///      (empadronamiento + 5 anios de residencia) pendiente de anadir en el
///      verificador de pruebas.
contract VotacionAnonima {
    enum Opcion {
        AFavor,
        EnContra,
        Abstencion
    }

    struct Propuesta {
        string contenidoHash; // hash del JSON de la propuesta (integridad verificable)
        uint256 cierre; // timestamp de cierre
        uint256 aFavor;
        uint256 enContra;
        uint256 abstenciones;
        bool existe;
    }

    /// @dev Verificador externo de pruebas ZK (pendiente de implementar).
    address public verificadorZk;

    mapping(bytes32 => Propuesta) public propuestas;
    mapping(bytes32 => mapping(bytes32 => bool)) public nullifierUsado; // propuestaId => nullifier => usado
    mapping(bytes32 => mapping(bytes32 => Opcion)) public votoDeNullifier; // propuestaId => nullifier => opcion

    event PropuestaCreada(bytes32 indexed propuestaId, string contenidoHash, uint256 cierre);
    event VotoEmitido(bytes32 indexed propuestaId, bytes32 indexed nullifier, Opcion opcion);

    constructor(address _verificadorZk) {
        verificadorZk = _verificadorZk;
    }

    function crearPropuesta(bytes32 propuestaId, string calldata contenidoHash, uint256 duracionSegundos) external {
        require(!propuestas[propuestaId].existe, "La propuesta ya existe");
        propuestas[propuestaId] = Propuesta({
            contenidoHash: contenidoHash,
            cierre: block.timestamp + duracionSegundos,
            aFavor: 0,
            enContra: 0,
            abstenciones: 0,
            existe: true
        });
        emit PropuestaCreada(propuestaId, contenidoHash, block.timestamp + duracionSegundos);
    }

    /// @param nullifier Identificador único derivado de la prueba ZK del votante.
    /// @param pruebaZk Prueba de que el votante cumple los requisitos de elegibilidad
    ///        (DNI español, empadronamiento, 5 años de residencia, edad >= 18)
    ///        sin revelar su identidad. La verificacion real queda pendiente.
    function votar(bytes32 propuestaId, bytes32 nullifier, Opcion opcion, bytes calldata pruebaZk) external {
        Propuesta storage p = propuestas[propuestaId];
        require(p.existe, "Propuesta inexistente");
        require(block.timestamp < p.cierre, "Votacion cerrada");
        require(!nullifierUsado[propuestaId][nullifier], "Este documento ya ha votado en esta propuesta");

        // TODO: llamar a verificadorZk para validar `pruebaZk` antes de aceptar el voto.
        pruebaZk;

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
