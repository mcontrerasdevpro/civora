// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.30;

import {IRootVerifier, IVerifierHelper} from "./IRootVerifier.sol";
import {BoundData, FaceMatchMode, OS, ProofVerificationParams} from "./Types.sol";

/// @notice Verificador ZK de prueba, solo para tests locales de Hardhat: nunca
///         se despliega en Sepolia/mainnet, donde VotacionAnonima usa el
///         RootVerifier real de ZKPassport (mismo address en Ethereum, Sepolia
///         y Base). Permite fijar de antemano el resultado que debe devolver,
///         para poder probar votarConPruebaZk sin un documento fisico real.
contract MockRootVerifier is IRootVerifier, IVerifierHelper {
    bool public siguienteValida = true;
    bytes32 public siguienteIdentificador;
    uint256 public siguienteTimestamp;
    bool public siguienteAmbitoOk = true;
    uint8 public edadSimulada = 18;
    string public nacionalidadSimulada = "ESP";
    string public datosVinculadosSimulados;

    function fijarResultado(
        bool valida,
        bytes32 identificador,
        uint256 marcaTiempo,
        bool ambitoOk,
        uint8 edad,
        string calldata nacionalidad
    ) external {
        siguienteValida = valida;
        siguienteIdentificador = identificador;
        siguienteTimestamp = marcaTiempo;
        siguienteAmbitoOk = ambitoOk;
        edadSimulada = edad;
        nacionalidadSimulada = nacionalidad;
    }

    /// @notice Fija el `custom_data` que devuelve getBoundData, como si la
    ///         prueba lo llevara vinculado.
    function fijarDatosVinculados(string calldata datos) external {
        datosVinculadosSimulados = datos;
    }

    function verify(ProofVerificationParams calldata)
        external
        view
        override
        returns (bool valid, bytes32 uniqueIdentifier, IVerifierHelper helper)
    {
        return (siguienteValida, siguienteIdentificador, IVerifierHelper(address(this)));
    }

    function getBoundData(bytes calldata) external view override returns (BoundData memory) {
        return BoundData({senderAddress: address(0), chainId: 0, customData: datosVinculadosSimulados});
    }

    function isAgeAboveOrEqual(uint8 minAge, bytes calldata) external view override returns (bool) {
        return edadSimulada >= minAge;
    }

    function isNationalityIn(string[] memory countryList, bytes calldata) external view override returns (bool) {
        for (uint256 i = 0; i < countryList.length; i++) {
            if (keccak256(bytes(countryList[i])) == keccak256(bytes(nacionalidadSimulada))) {
                return true;
            }
        }
        return false;
    }

    function isNationalityOut(string[] memory countryList, bytes calldata) external view override returns (bool) {
        for (uint256 i = 0; i < countryList.length; i++) {
            if (keccak256(bytes(countryList[i])) == keccak256(bytes(nacionalidadSimulada))) {
                return false;
            }
        }
        return true;
    }

    function isFaceMatchVerified(FaceMatchMode, OS, bytes calldata) external pure override returns (bool) {
        return true;
    }

    function enforceSanctionsRoot(uint256, bool, bytes calldata) external pure override {}

    function verifyScopes(bytes32[] calldata, string calldata, string calldata)
        external
        view
        override
        returns (bool)
    {
        return siguienteAmbitoOk;
    }

    function getProofTimestamp(bytes32[] calldata) external view override returns (uint256) {
        return siguienteTimestamp;
    }
}
