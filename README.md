# Diploma-Blockchain

A blockchain-based diploma verification system that ensures the authenticity and integrity of academic certificates. Universities can issue and revoke diplomas through an administrative interface, while recruiters can upload PDF certificates and verify their authenticity through a public interface.

## How it works

- **Issue (University / Admin):** pick the PDF, compute its SHA-256 hash in the browser, sign a transaction with MetaMask that calls `emettreDiplome(hash, nom)`.
- **Verify (Recruiter / Public):** pick the PDF, compute the same hash, call `verifierDiplome(hash)` (read-only, no wallet needed).
- Only the **hash and the name** are stored on-chain. The PDF never leaves the browser.
- The contract stores neither the field of study nor the year. They stay in MongoDB (backend).

## Project structure

```
contracts/      Smart contract (Diplomes.sol) + deployment.json (address + ABI)
scripts/        deploy.js, export-abi.js
test/           Hardhat tests
backend/        Express + MongoDB
frontend/admin  University page (issue / revoke)
frontend/public Recruiter page (verify)
```

## Roles at a glance

| Role | Needs Hardhat? | Needs `.env`? | Needs |
|---|---|---|---|
| A (contract) | Yes | Yes (private key + RPC URL) | Everything below |
| B (tests, docs) | Yes, to run tests | No | `npm install`, `npx hardhat test` |
| C (Admin) | **No** | **No** | `address` + `abi` from `contracts/deployment.json`, MetaMask on Sepolia with the owner account |
| D (Public) | **No** | **No** | `address` + `abi` from `contracts/deployment.json`, a Sepolia RPC URL |

The contract is already deployed on Sepolia. Nobody needs to compile or redeploy it unless A announces a new version.

## Setup (everyone)

```bash
git clone https://github.com/tesnim44/Diploma-Blockchain.git
cd Diploma-Blockchain
git checkout <your-branch>
```

## A and B: compile and test

```bash
npm install
npx hardhat compile
npx hardhat test
```

This project uses **Hardhat 2**. Do not run `npx hardhat --init` and do not upgrade to Hardhat 3. Only A has a `.env`, based on `.env.example`, and it is never committed.

**B (tests and docs):** `npx hardhat test` runs all tests. `test/Diplomes.A.js` contains the 6 required cases plus 3 extra. Report failures to A with the test name and the error message.

## C: Admin page

1. Copy `address` and `abi` from `contracts/deployment.json` into the Admin config.
2. Connect MetaMask on **Sepolia** with the **owner account** (ask A privately). Any other account is rejected with "Acces refuse".
3. Call `emettreDiplome(hash, nom)` with two arguments only, and show success only after `tx.wait()`.

```js
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
const tx = await contract.emettreDiplome(hash, nomComplet);
await tx.wait();
```

## D: Public page

1. Copy `address` and `abi` into `frontend/public/config.js`.
2. Read with a `JsonRpcProvider` (no wallet, no signature, no gas).
3. Show three results (valid, revoked, not found). A network error shows "Verification impossible", never "invalid diploma".

```js
const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
const r = await contract.verifierDiplome(hash);
```

## Deployed contract

| | |
|---|---|
| Network | Sepolia (chain ID 11155111) |
| Contract address | `0xc4569418D59C829EB90F79012AdB715cE9137Ed1` |
| Owner address | `0x2e5e81ED75FD1F9D02038cA5504a9bbf14Cbab64` |
| Explorer | https://sepolia.etherscan.io/address/0xc4569418D59C829EB90F79012AdB715cE9137Ed1 |
| Address + ABI | `contracts/deployment.json` |

## Contract interface

```
emettreDiplome(bytes32 _hash, string _nom)      owner only, 2 arguments only
verifierDiplome(bytes32 _hash)                  public read -> (bool existe, bool valide, string nom, uint256 date)
revoquerDiplome(bytes32 _hash)                  owner only
```

| existe | valide | Meaning |
|---|---|---|
| false | false | Not found |
| true | true | Valid |
| true | false | Revoked |

Use the field names `existe`, `valide`, `nom`, `date`. The date is a Unix timestamp in seconds.

## Hash rule (Admin and Public must be identical)

SHA-256 of the raw bytes of the PDF, formatted as `0x` + 64 hex characters. Use the **same function** on both pages and test the same PDF on both: the strings must match character for character.

## Security

- Never commit `.env`, a private key or a seed phrase.
- Use test wallets only. Sepolia ETH has no real value.
- Anything written on-chain is public and permanent. Use fictional data for demos.

## Known limits

- Single owner address: if the key is lost or leaked, nobody can issue or revoke.
- A re-saved or modified PDF has a different hash and shows "not found".
- Student names are public on the blockchain.