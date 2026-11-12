const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Diplomes", function () {
  async function deployFixture() {
    const [owner, autre] = await ethers.getSigners();
    const contract = await ethers.deployContract("Diplomes");
    const hash = ethers.sha256(ethers.toUtf8Bytes("diplome-ahmed.pdf"));
    const hashInconnu = ethers.sha256(ethers.toUtf8Bytes("faux-diplome.pdf"));
    return { contract, owner, autre, hash, hashInconnu };
  }

  it("1. l'owner emet un nouveau diplome", async function () {
    const { contract, hash } = await loadFixture(deployFixture);
    await contract.emettreDiplome(hash, "Ahmed Ben Ali");
    const r = await contract.verifierDiplome(hash);
    expect(r.existe).to.equal(true);
    expect(r.valide).to.equal(true);
    expect(r.nom).to.equal("Ahmed Ben Ali");
  });

  it("2. un autre compte ne peut pas emettre", async function () {
    const { contract, autre, hash } = await loadFixture(deployFixture);
    await expect(
      contract.connect(autre).emettreDiplome(hash, "Mallory")
    ).to.be.revertedWith("Acces refuse");
  });

  it("3. le meme hash ne peut pas etre emis deux fois", async function () {
    const { contract, hash } = await loadFixture(deployFixture);
    await contract.emettreDiplome(hash, "Ahmed Ben Ali");
    await expect(
      contract.emettreDiplome(hash, "Ahmed Ben Ali")
    ).to.be.revertedWith("Diplome deja enregistre");
  });

  it("4. un hash existant est existe=true, valide=true", async function () {
    const { contract, hash } = await loadFixture(deployFixture);
    await contract.emettreDiplome(hash, "Ahmed Ben Ali");
    const r = await contract.verifierDiplome(hash);
    expect(r.existe).to.equal(true);
    expect(r.valide).to.equal(true);
  });

  it("5. un hash inconnu donne existe=false", async function () {
    const { contract, hashInconnu } = await loadFixture(deployFixture);
    const r = await contract.verifierDiplome(hashInconnu);
    expect(r.existe).to.equal(false);
  });

  it("6. la revocation donne existe=true, valide=false", async function () {
    const { contract, hash } = await loadFixture(deployFixture);
    await contract.emettreDiplome(hash, "Ahmed Ben Ali");
    await contract.revoquerDiplome(hash);
    const r = await contract.verifierDiplome(hash);
    expect(r.existe).to.equal(true);
    expect(r.valide).to.equal(false);
  });

  it("7. un autre compte ne peut pas revoquer", async function () {
    const { contract, autre, hash } = await loadFixture(deployFixture);
    await contract.emettreDiplome(hash, "Ahmed Ben Ali");
    await expect(
      contract.connect(autre).revoquerDiplome(hash)
    ).to.be.revertedWith("Acces refuse");
  });

  it("8. on ne peut pas revoquer deux fois", async function () {
    const { contract, hash } = await loadFixture(deployFixture);
    await contract.emettreDiplome(hash, "Ahmed Ben Ali");
    await contract.revoquerDiplome(hash);
    await expect(contract.revoquerDiplome(hash)).to.be.revertedWith("Diplome deja revoque");
  });

  it("9. l'owner est le deployeur", async function () {
    const { contract, owner } = await loadFixture(deployFixture);
    expect(await contract.owner()).to.equal(owner.address);
  });
});