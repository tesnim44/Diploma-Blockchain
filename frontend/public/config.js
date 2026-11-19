// Adresse du smart contract déployé sur Sepolia
const CONTRACT_ADDRESS = "0x718F930453442896A0514d0c099C90BC95962e0A";

// Adresse RPC du réseau Sepolia
const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// ABI : fonction nécessaire pour vérifier un diplôme
const ABI = [
    "function verifierDiplome(bytes32 _hash) view returns (bool existe, bool valide, string nom, uint256 date)"
];