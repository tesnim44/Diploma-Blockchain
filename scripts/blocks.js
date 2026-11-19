
const { ethers } = require("hardhat");

async function main() {
    const provider = new ethers.JsonRpcProvider(
        "http://127.0.0.1:8545"
    );

    console.log("\n==================================");
    console.log("   TRUSTED! - BLOCKCHAIN MONITOR");
    console.log("==================================\n");

    let lastBlock = -1;

    provider.on("block", async (blockNumber) => {
        if (blockNumber === lastBlock) return;
        lastBlock = blockNumber;

        try {
            const block = await provider.getBlock(blockNumber);

            if (!block) return;

            console.log("\n----------------------------------");
            console.log(`BLOCK ${block.number}`);
            console.log("----------------------------------");

            console.log("Block {");
            console.log(`    index: ${block.number},`);
            console.log(`    timestamp: ${block.timestamp},`);
            console.log(`    transactions: ${JSON.stringify(block.transactions, null, 2)},`);
            console.log(`    previous_hash: "${block.parentHash}",`);
            console.log(`    nonce: "${block.nonce}",`);
            console.log(`    hash: "${block.hash}"`);
            console.log("}");

            console.log("----------------------------------\n");

        } catch (error) {
            console.error("Block reading error:", error.message);
        }
    });

    console.log("Waiting for new blocks...");
}

main().catch(console.error);
