const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("Aucun compte : verifie PRIVATE_KEY dans .env");

  console.log("Owner (deployeur) :", deployer.address);
  const solde = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Solde :", hre.ethers.formatEther(solde), "ETH");

  const contract = await hre.ethers.deployContract("Diplomes");
  await contract.waitForDeployment();
  console.log("Adresse du contrat :", await contract.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});