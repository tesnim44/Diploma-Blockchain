
const API_URL = "http://localhost:3000/api/diplomas";

const diplomaForm = document.getElementById("diplomaForm");
const statusMessage = document.getElementById("status");
const issueButton = document.getElementById("issueButton");

// Calculate the SHA-256 hash of the selected PDF
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

// Handle form submission
diplomaForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        issueButton.disabled = true;
        statusMessage.textContent = "Preparing diploma...";

        // Get form values
        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const field = document.getElementById("field").value.trim();
        const year = Number(document.getElementById("year").value);
        const file = document.getElementById("diplomaFile").files[0];

        // Validate PDF
        if (!file || file.type !== "application/pdf") {
            throw new Error("Please select a valid PDF file.");
        }

        // Calculate real PDF hash
        statusMessage.textContent = "Calculating PDF hash...";

        const pdfHash = await calculateSHA256(file);

        // Generate a unique diploma ID
        const diplomaId = "DIP-" + crypto.randomUUID();

        // Prepare data for MongoDB
        const diplomaData = {
            diplomaId,
            firstName,
            lastName,
            field,
            year,
            pdfHash
        };

        // Send data to backend
        statusMessage.textContent = "Saving diploma information...";

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(diplomaData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to save diploma.");
        }

        statusMessage.textContent =
            "Diploma saved successfully! ID: " + diplomaId;

        console.log("Saved diploma:", result.diploma);
        console.log("PDF SHA-256:", pdfHash);

        diplomaForm.reset();

    } catch (error) {
        console.error(error);

        statusMessage.textContent = "Error: " + error.message;

    } finally {
        issueButton.disabled = false;
    }
});

// Load all diplomas from the backend
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

        diplomas.forEach((diploma) => {
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
                cell.textContent = value;
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });

        dashboardStatus.textContent =
            `${diplomas.length} diploma(s) registered.`;

    } catch (error) {
        dashboardStatus.textContent = error.message;
        console.error(error);
    }
}

// Refresh button
document.getElementById("refreshDiplomas")
    .addEventListener("click", loadDiplomas);

// Load diplomas when the page opens
loadDiplomas();


// ==================================
// SMART CONTRACT CONFIGURATION
// ==================================

let contractAddress = null;
let contractABI = null;
let diplomaContract = null;

async function loadContractConfiguration() {
    try {
        const response = await fetch("../../contracts/deployment.json");

        if (!response.ok) {
            throw new Error("Cannot load deployment.json");
        }

        const deployment = await response.json();

        if (deployment.chainId !== 11155111) {
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


// ==================================
// METAMASK CONNECTION
// ==================================

let walletProvider = null;
let walletSigner = null;
let walletAddress = null;

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

        // 1. Load contract configuration
        const deployment = await loadContractConfiguration();

        // 2. Connect to MetaMask
        walletProvider = new ethers.BrowserProvider(window.ethereum);

        const accounts = await walletProvider.send(
            "eth_requestAccounts",
            []
        );

        if (!accounts.length) {
            throw new Error("No wallet account selected.");
        }

        walletSigner = await walletProvider.getSigner();

        walletAddress = await walletSigner.getAddress();

        // Switch automatically to Sepolia
try {
    await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }]
    });
} catch (error) {

    // Sepolia is not added to MetaMask
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
                rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"]
            }]
        });
    } else {
        throw error;
    }
}

// Refresh provider after switching network
walletProvider = new ethers.BrowserProvider(window.ethereum);

const network = await walletProvider.getNetwork();

if (Number(network.chainId) !== 11155111) {
    throw new Error("MetaMask is not connected to Sepolia.");
}

// Get signer after switching
walletSigner = await walletProvider.getSigner();
walletAddress = await walletSigner.getAddress();

        // 4. Connect to the deployed Smart Contract
        diplomaContract = new ethers.Contract(
            deployment.address,
            deployment.abi,
            walletSigner
        );

        // 5. Verify university owner
        const ownerAddress = await diplomaContract.owner();

        walletLabel.textContent =
            walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);

        networkLabel.textContent = "Network: Sepolia";

        if (walletAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
            diplomaContract = null;

            throw new Error(
                "Access denied: this wallet is not the contract owner."
            );
        }

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


// Connect button event
document.getElementById("connectWallet")
    .addEventListener("click", connectMetaMask);


// Detect account changes
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


// Transaction status helper
function showTransactionStatus(message, type) {

    statusMessage.textContent = message;
    statusMessage.className = "status " + type;

}
