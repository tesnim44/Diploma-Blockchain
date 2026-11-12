const fs = require("fs");

const abi = require("../artifacts/contracts/Diplomes.sol/Diplomes.json").abi;

const deployment = {
  network: "sepolia",
  chainId: 11155111,
  address: "0xc4569418D59C829EB90F79012AdB715cE9137Ed1",
  owner: "0x2e5e81ED75FD1F9D02038cA5504a9bbf14Cbab64",
  abi,
};

fs.writeFileSync("contracts/deployment.json", JSON.stringify(deployment, null, 2));
console.log("contracts/deployment.json cree");