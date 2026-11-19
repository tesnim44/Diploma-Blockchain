
/* =====================================================
   1. BACKEND CONFIGURATION
===================================================== */

const API_URL = "http://localhost:3000/api/diplomas";

const diplomaForm = document.getElementById("diplomaForm");
const statusMessage = document.getElementById("status");
const issueButton = document.getElementById("issueButton");


/* =====================================================
   2. SHA-256 PDF HASH
===================================================== */

async function calculateSHA256(file) {
    const buffer = await file.arrayBuffer();

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        buffer
    );

    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}


/* =====================================================
   3. SMART CONTRACT CONFIGURATION
===================================================== */

let contractAddress = null;
let contractABI = null;
let diplomaContract = null;

let walletProvider = null;
let walletSigner = null;
let walletAddress = null;


async function loadContractConfiguration() {
    try {
        const response = await fetch("../../contracts/deployment.json");

        if (!response.ok) {
            throw new Error("Cannot load deployment.json");
        }

        const deployment = await response.json();

        if (Number(deployment.chainId) !== 11155111) {
            throw new Error("Unexpected blockchain network.");
        }

        contractAddress = deployment.address;
        contractABI = deployment.abi;

        console.log("Contract address:", contractAddress);
        console.log("Contract network:", deployment.network);

        return deployment;

    } catch (error) {
        console.error("Contract configuration error:", error);
        throw error;
    }
}


/* =====================================================
   4. METAMASK CONNECTION
===================================================== */

async function connectMetaMask() {

    const walletButton = document.getElementById("connectWallet");
    const walletLabel = document.getElementById("walletAddress");
    const networkLabel = document.getElementById("networkName");

    try {

        if (!window.ethereum) {
            throw new Error("MetaMask is not installed.");
        }

        walletButton.disabled = true;
        walletButton.textContent = "Connecting...";

        // Load deployment configuration
        const deployment = await loadContractConfiguration();

        // Request access to MetaMask account
        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        if (!accounts || accounts.length === 0) {
            throw new Error("No wallet account selected.");
        }

        // Switch to Sepolia
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0xaa36a7" }]
            });

        } catch (error) {

            // Add Sepolia if it is not configured in MetaMask
            if (error.code === 4902) {

                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: "0xaa36a7",
                        chainName: "Sepolia",
                        nativeCurrency: {
                            name: "Sepolia Ether",
                            symbol: "ETH",
                            decimals: 18
                        },
                        rpcUrls: [
                            "https://ethereum-sepolia-rpc.publicnode.com"
                        ],
                        blockExplorerUrls: [
                            "https://sepolia.etherscan.io"
                        ]
                    }]
                });

            } else {
                throw error;
            }
        }

        // Create provider after network switch
        walletProvider = new ethers.BrowserProvider(window.ethereum);

        const network = await walletProvider.getNetwork();

        if (Number(network.chainId) !== 11155111) {
            throw new Error("MetaMask is not connected to Sepolia.");
        }

        // Get selected account and signer
        walletSigner = await walletProvider.getSigner();
        walletAddress = await walletSigner.getAddress();

        // Connect to deployed contract
        diplomaContract = new ethers.Contract(
            deployment.address,
            deployment.abi,
            walletSigner
        );

        // Check contract owner
        const ownerAddress = await diplomaContract.owner();

        if (walletAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
            throw new Error(
                "Access denied: this wallet is not the contract owner."
            );
        }

        // Update interface
        walletLabel.textContent =
            walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);

        networkLabel.textContent = "Network: Sepolia";

        walletButton.textContent = "University Wallet Connected";

        showTransactionStatus(
            "MetaMask connected successfully!",
            "success"
        );

        console.log("Wallet:", walletAddress);
        console.log("Contract:", deployment.address);
        console.log("Owner:", ownerAddress);
        console.log("Network:", network.chainId.toString());

    } catch (error) {

        console.error("MetaMask error:", error);

        showTransactionStatus(error.message, "error");

        walletButton.textContent = "Connect MetaMask";

        walletLabel.textContent = "Wallet not connected";
        networkLabel.textContent = "Network: Not connected";

        walletProvider = null;
        walletSigner = null;
        walletAddress = null;
        diplomaContract = null;

    } finally {
        walletButton.disabled = false;
    }
}


/* =====================================================
   5. CONNECT BUTTON AND WALLET EVENTS
===================================================== */

document.getElementById("connectWallet")
    .addEventListener("click", connectMetaMask);


if (window.ethereum) {

    window.ethereum.on("accountsChanged", () => {

        walletProvider = null;
        walletSigner = null;
        walletAddress = null;
        diplomaContract = null;

        document.getElementById("walletAddress").textContent =
            "Wallet not connected";

        document.getElementById("networkName").textContent =
            "Network: Not connected";

        document.getElementById("connectWallet").textContent =
            "Connect MetaMask";

        showTransactionStatus(
            "Wallet changed. Please reconnect.",
            "pending"
        );
    });

    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}


/* =====================================================
   6. TRANSACTION STATUS
===================================================== */

function showTransactionStatus(message, type) {

    statusMessage.textContent = message;
    statusMessage.className = "status " + type;
}


/* =====================================================
   7. ISSUE A DIPLOMA
===================================================== */

diplomaForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    issueButton.disabled = true;

    let blockchainConfirmed = false;
    let transactionHash = null;

    try {

        // Check wallet connection
        if (!diplomaContract || !walletAddress) {
            throw new Error(
                "Please connect your MetaMask wallet first."
            );
        }

        // STEP 1: Read form information
        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const field = document.getElementById("field").value.trim();
        const year = Number(document.getElementById("year").value);

        const file = document.getElementById("diplomaFile").files[0];

        if (!firstName || !lastName || !field || !year) {
            throw new Error("Please fill in all diploma information.");
        }

        if (!file || file.type !== "application/pdf") {
            throw new Error("Please select a valid PDF file.");
        }

        const fullName = `${firstName} ${lastName}`;

        // STEP 2: Calculate SHA-256
        showTransactionStatus(
            "Calculating PDF SHA-256 hash...",
            "pending"
        );

        const pdfHash = await calculateSHA256(file);

        // Solidity bytes32 needs a 0x prefix
        const hashBytes32 = "0x" + pdfHash;

        console.log("PDF SHA-256:", pdfHash);

        // STEP 3: Check if diploma already exists on blockchain
        showTransactionStatus(
            "Checking diploma on blockchain...",
            "pending"
        );

        const existing = await diplomaContract.verifierDiplome(
            hashBytes32
        );

        if (existing.existe) {
            throw new Error(
                "This diploma is already registered on the blockchain."
            );
        }

        // STEP 4: Ask MetaMask to sign the transaction
        showTransactionStatus(
            "Please confirm the transaction in MetaMask...",
            "pending"
        );

        const tx = await diplomaContract.emettreDiplome(
            hashBytes32,
            fullName
        );

        transactionHash = tx.hash;

        console.log("Transaction submitted:", transactionHash);

        // STEP 5: Wait for blockchain confirmation
        showTransactionStatus(
            "Transaction submitted. Waiting for confirmation...",
            "pending"
        );

        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
            throw new Error("Blockchain transaction failed.");
        }

        blockchainConfirmed = true;

        console.log("Transaction confirmed:", transactionHash);

        showTransactionStatus(
            "Diploma confirmed on blockchain! Saving to MongoDB...",
            "pending"
        );

        // STEP 6: Save metadata in MongoDB
        const diplomaId = "DIP-" + crypto.randomUUID();

        const diplomaData = {
            diplomaId: diplomaId,
            firstName: firstName,
            lastName: lastName,
            field: field,
            year: year,
            pdfHash: pdfHash,
            transactionHash: transactionHash
        };

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(diplomaData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "MongoDB registration failed."
            );
        }

        // SUCCESS
        showTransactionStatus(
            "Diploma issued successfully! ID: " + diplomaId,
            "success"
        );

        console.log("MongoDB diploma:", result.diploma);
        console.log("PDF hash:", pdfHash);
        console.log("Transaction hash:", transactionHash);

        diplomaForm.reset();

        // Refresh dashboard
        await loadDiplomas();

    } catch (error) {

        console.error("Diploma issuance error:", error);

        if (blockchainConfirmed) {

            showTransactionStatus(
                "Blockchain transaction confirmed, but MongoDB saving failed. Transaction: " +
                transactionHash,
                "error"
            );

            console.error(
                "Do not issue the same diploma again. Check MongoDB first."
            );

        } else {

            showTransactionStatus(
                "Error: " + error.message,
                "error"
            );
        }

    } finally {
        issueButton.disabled = false;
    }
});


/* =====================================================
   8. LOAD DIPLOMAS FROM MONGODB
===================================================== */

async function loadDiplomas() {

    const tableBody = document.getElementById("diplomasTableBody");
    const dashboardStatus = document.getElementById("dashboardStatus");

    dashboardStatus.textContent = "Loading diplomas...";

    tableBody.replaceChildren();

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Unable to retrieve diplomas.");
        }

        const diplomas = await response.json();

        if (diplomas.length === 0) {
            dashboardStatus.textContent = "No diplomas registered yet.";
            return;
        }

        for (const diploma of diplomas) {

            const row = document.createElement("tr");

            const values = [
                diploma.diplomaId,
                `${diploma.firstName} ${diploma.lastName}`,
                diploma.field,
                diploma.year,
                diploma.pdfHash
            ];

            values.forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "";
                row.appendChild(cell);
            });

            // Read the diploma status directly from the smart contract.
            const statusCell = document.createElement("td");
            const actionCell = document.createElement("td");

            if (diplomaContract) {
                try {
                    const hashBytes32 = "0x" + diploma.pdfHash.replace(/^0x/, "");
                    const result = await diplomaContract.verifierDiplome(hashBytes32);

                    if (!result.existe) {
                        statusCell.textContent = "Introuvable";
                    } else if (!result.valide) {
                        statusCell.textContent = "Révoqué";
                    } else {
                        statusCell.textContent = "Authentique";

                        const revokeButton = document.createElement("button");
                        revokeButton.type = "button";
                        revokeButton.textContent = "Révoquer";
                        revokeButton.className = "revoke-button";
                        revokeButton.addEventListener("click", async () => {
                            const confirmed = window.confirm(
                                `Voulez-vous vraiment révoquer le diplôme de ${diploma.firstName} ${diploma.lastName} ? Cette action est irréversible.`
                            );

                            if (!confirmed) return;

                            try {
                                if (!diplomaContract || !walletAddress) {
                                    throw new Error("Connectez le portefeuille propriétaire du contrat.");
                                }

                                revokeButton.disabled = true;
                                revokeButton.textContent = "En attente…";

                                showTransactionStatus(
                                    "Confirmez la révocation dans MetaMask…",
                                    "pending"
                                );

                                // Recheck status before sending the transaction.
                                const current = await diplomaContract.verifierDiplome(hashBytes32);

                                if (!current.existe || !current.valide) {
                                    throw new Error("Ce diplôme est introuvable ou déjà révoqué.");
                                }

                                const tx = await diplomaContract.revoquerDiplome(hashBytes32);

                                showTransactionStatus(
                                    "Transaction envoyée. Attente de confirmation…",
                                    "pending"
                                );

                                const receipt = await tx.wait();

                                if (!receipt || receipt.status !== 1) {
                                    throw new Error("La transaction de révocation a échoué.");
                                }

                                showTransactionStatus(
                                    "Diplôme révoqué avec succès sur Sepolia.",
                                    "success"
                                );

                                await loadDiplomas();

                            } catch (error) {
                                console.error("Revocation error:", error);
                                showTransactionStatus(
                                    "Révocation impossible : " + error.message,
                                    "error"
                                );
                                revokeButton.disabled = false;
                                revokeButton.textContent = "Révoquer";
                            }
                        });

                        actionCell.appendChild(revokeButton);
                    }
                } catch (error) {
                    statusCell.textContent = "Statut indisponible";
                    console.error("Diploma status error:", error);
                }
            } else {
                statusCell.textContent = "Connectez MetaMask";
            }

            row.appendChild(statusCell);
            row.appendChild(actionCell);
            tableBody.appendChild(row);
        }

        dashboardStatus.textContent =
            `${diplomas.length} diploma(s) registered.`;

    } catch (error) {

        dashboardStatus.textContent = error.message;

        console.error("Dashboard error:", error);
    }
}


/* =====================================================
   9. REFRESH DASHBOARD
===================================================== */

document.getElementById("refreshDiplomas")
    .addEventListener("click", loadDiplomas);


/* =====================================================
   10. INITIALIZE ADMIN DASHBOARD
===================================================== */

loadDiplomas();
