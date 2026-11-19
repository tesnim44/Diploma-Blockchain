
const hre = require("hardhat");

async function main() {

    const [admin] = await hre.ethers.getSigners();

    console.log("\n==================================");
    console.log(" TRUSTED! - DIPLOMA STORAGE VIEW");
    console.log("==================================");

    // Déployer le contrat sur Hardhat local
    const contract = await hre.ethers.deployContract("Diplomes");
    await contract.waitForDeployment();

    console.log("\nContract:", await contract.getAddress());

    // Créer un hash de démonstration
    const hash = hre.ethers.sha256(
        hre.ethers.toUtf8Bytes("DEMO_DIPLOMA_001")
    );

    console.log("\nPDF HASH:", hash);

    // Enregistrer le diplôme sur la blockchain
    const tx = await contract.emettreDiplome(
        hash,
        "Ahmed Ben Ali"
    );

    const receipt = await tx.wait();

    console.log("\nTransaction confirmed!");
    console.log("Transaction hash:", tx.hash);
    console.log("Block number:", receipt.blockNumber);

    // Lire les données du mapping avec verifierDiplome()
    const diploma = await contract.verifierDiplome(hash);

    console.log("\n==================================");
    console.log(" DIPLOMA STRUCTURE - BLOCKCHAIN");
    console.log("==================================");

    console.log("Diplome {");
    console.log("    hash:   ", diploma[0]);
    console.log("    nom:    ", diploma[2]);
    console.log("    date:   ", diploma[3].toString());
    console.log("    valide: ", diploma[1]);
    console.log("    existe: ", diploma[0] !== hre.ethers.ZeroHash);
    console.log("}");

    console.log("\n==================================");
    console.log(" VERIFICATION RESULT");
    console.log("==================================");

    console.log("    valide: ", diploma.valide);
    console.log("    existe: ", diploma.existe);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
