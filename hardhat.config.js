require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
  sepolia: {
    url: process.env.SEPOLIA_RPC_URL || "",
    accounts: /^(0x)?[0-9a-fA-F]{64}$/.test(process.env.PRIVATE_KEY || "")
  ? [process.env.PRIVATE_KEY]
  : [],
  },
},
};