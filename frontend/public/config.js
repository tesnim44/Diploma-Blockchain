// À remplir par A après le déploiement (jour 3).
// Tant que CONTRACT_ADDRESS est vide, la page tourne en MODE DÉMO (fausses données).
const CONTRACT_ADDRESS = "";
const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const ABI = [
  // Colle ici l'ABI fournie par A. Minimum nécessaire pour D :
  "function verifierDiplome(bytes32 _hash) view returns (bool existe, bool valide, string nom, uint256 date)"
];
