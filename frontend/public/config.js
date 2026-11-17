// Adresse du smart contract déployé sur Sepolia
const CONTRACT_ADDRESS = "0xc4569418D59C829EB90F79012AdB715cE9137Ed1";

// Adresse RPC du réseau Sepolia
const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// ABI : fonction nécessaire pour vérifier un diplôme
const ABI = [
    "function verifierDiplome(bytes32 _hash) view returns (bool existe, bool valide, string nom, uint256 date)"
];