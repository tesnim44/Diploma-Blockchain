
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
   8. DIPLOMA CARDS + ON-CHAIN STATUS + REVOCATION
===================================================== */

let diplomaRecords = [];
let readOnlyContract = null;

async function getReadOnlyContract() {
    if (readOnlyContract) return readOnlyContract;
    const response = await fetch("../../contracts/deployment.json");
    if (!response.ok) throw new Error("Configuration du contrat indisponible.");
    const deployment = await response.json();
    if (Number(deployment.chainId) !== 11155111) {
        throw new Error("Le contrat configuré n'est pas sur Sepolia.");
    }
    const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
    readOnlyContract = new ethers.Contract(deployment.address, deployment.abi, provider);
    return readOnlyContract;
}

async function getDiplomaStatus(pdfHash) {
    try {
        const contract = await getReadOnlyContract();
        const result = await contract.verifierDiplome("0x" + pdfHash.replace(/^0x/, ""));
        if (!result.existe) return { key: "unknown", label: "Introuvable" };
        if (!result.valide) return { key: "revoked", label: "Révoqué" };
        return { key: "valid", label: "Authentique" };
    } catch (error) {
        console.warn("On-chain status unavailable:", error);
        return { key: "unknown", label: "Non vérifié" };
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function updateStats(records) {
    document.getElementById("totalCount").textContent = records.length;
    document.getElementById("validCount").textContent = records.filter(d => d.chainStatus?.key === "valid").length;
    document.getElementById("revokedCount").textContent = records.filter(d => d.chainStatus?.key === "revoked").length;
}

function renderDiplomas() {
    const grid = document.getElementById("diplomaGrid");
    const query = document.getElementById("searchDiplomas").value.trim().toLowerCase();
    const filter = document.getElementById("statusFilter").value;
    const sort = document.getElementById("sortDiplomas").value;

    let items = diplomaRecords.filter(d => {
        const haystack = [d.diplomaId, d.firstName, d.lastName, d.field, d.year].join(" ").toLowerCase();
        return haystack.includes(query) && (filter === "all" || d.chainStatus?.key === filter);
    });

    items.sort((a, b) => {
        if (sort === "name") return (a.lastName || "").localeCompare(b.lastName || "");
        const da = new Date(a.createdAt || 0).getTime();
        const db = new Date(b.createdAt || 0).getTime();
        return sort === "oldest" ? da - db : db - da;
    });

    grid.replaceChildren();
    if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = diplomaRecords.length ? "Aucun diplôme ne correspond à votre recherche." : "Aucun diplôme enregistré pour le moment.";
        grid.appendChild(empty);
        return;
    }

    items.forEach(diploma => {
        const card = document.createElement("article");
        card.className = "diploma-card";
        const fullName = [diploma.firstName, diploma.lastName].filter(Boolean).join(" ");
        const status = diploma.chainStatus || { key: "unknown", label: "Non vérifié" };
        const date = diploma.createdAt ? new Date(diploma.createdAt).toLocaleDateString("fr-FR") : "Date non disponible";
        const canRevoke = status.key === "valid" && Boolean(walletAddress && diplomaContract);
        card.innerHTML = `
          <div class="diploma-card-top">
            <span class="status-pill ${status.key}">${escapeHTML(status.label)}</span>
            <h3>${escapeHTML(diploma.field || "Diplôme")} ${escapeHTML(diploma.year || "")}</h3>
            <p class="diploma-subtitle">${escapeHTML(fullName)} · ${escapeHTML(diploma.diplomaId)}</p>
          </div>
          <div class="diploma-meta"><span>▦ ${escapeHTML(date)}</span><span>${escapeHTML(diploma.field || "Formation")}</span></div>
          <div class="diploma-actions">
            <span class="hash-short" title="${escapeHTML(diploma.pdfHash)}">SHA-256 · ${escapeHTML((diploma.pdfHash || "").slice(0, 14))}…</span>
            <button class="revoke-button" type="button" data-revoke="${escapeHTML(diploma.pdfHash)}" ${canRevoke ? "" : "disabled"}>${status.key === "revoked" ? "Déjà révoqué" : "Révoquer"}</button>
          </div>`;
        grid.appendChild(card);
    });

    grid.querySelectorAll("[data-revoke]").forEach(button => {
        button.addEventListener("click", () => revokeDiploma(button.dataset.revoke, button));
    });
}

async function loadDiplomas() {
    const dashboardStatus = document.getElementById("dashboardStatus");
    dashboardStatus.textContent = "Chargement des diplômes et vérification des statuts blockchain…";
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Impossible de récupérer les diplômes depuis le backend.");
        const records = await response.json();
        diplomaRecords = await Promise.all(records.map(async diploma => ({
            ...diploma,
            chainStatus: await getDiplomaStatus(diploma.pdfHash)
        })));
        updateStats(diplomaRecords);
        renderDiplomas();
        dashboardStatus.textContent = `${diplomaRecords.length} diplôme(s) chargé(s). Les statuts sont lus sur Sepolia.`;
        renderHistory(diplomaRecords);
    } catch (error) {
        dashboardStatus.textContent = error.message;
        console.error("Dashboard error:", error);
    }
}

function renderHistory(records) {
    const history = document.getElementById("historyList");
    history.replaceChildren();
    records.slice().sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0,4).forEach(d => {
        const item = document.createElement("div");
        item.className = "history-item";
        const who = document.createElement("span");
        who.textContent = `${d.firstName || ""} ${d.lastName || ""} · ${d.field || ""}`;
        const when = document.createElement("span");
        when.textContent = d.createdAt ? new Date(d.createdAt).toLocaleDateString("fr-FR") : "Date inconnue";
        item.append(who, when);
        history.appendChild(item);
    });
    if (!records.length) history.innerHTML = '<p class="muted">Aucun enregistrement pour le moment.</p>';
}

async function revokeDiploma(pdfHash, button) {
    if (!diplomaContract || !walletAddress) {
        showTransactionStatus("Connectez le portefeuille propriétaire du contrat avant de révoquer.", "error");
        document.getElementById("issueModal").hidden = false;
        return;
    }
    const record = diplomaRecords.find(d => d.pdfHash === pdfHash);
    const name = record ? `${record.firstName} ${record.lastName}` : "ce diplôme";
    if (!window.confirm(`Confirmer la révocation du diplôme de ${name} ? Cette opération est irréversible.`)) return;

    button.disabled = true;
    try {
        const onChain = await diplomaContract.verifierDiplome("0x" + pdfHash.replace(/^0x/, ""));
        if (!onChain.existe) throw new Error("Ce hash n'existe pas dans le contrat.");
        if (!onChain.valide) throw new Error("Ce diplôme est déjà révoqué.");
        showTransactionStatus("Confirmez la révocation dans MetaMask…", "pending");
        const tx = await diplomaContract.revoquerDiplome("0x" + pdfHash.replace(/^0x/, ""));
        showTransactionStatus("Transaction envoyée. Attente de confirmation…", "pending");
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) throw new Error("La transaction de révocation a échoué.");
        showTransactionStatus("Diplôme révoqué avec succès sur Sepolia.", "success");
        await loadDiplomas();
    } catch (error) {
        console.error("Revoke error:", error);
        showTransactionStatus("Révocation impossible : " + (error.shortMessage || error.message), "error");
        button.disabled = false;
    }
}

/* =====================================================
   9. DASHBOARD CONTROLS
===================================================== */

document.getElementById("refreshDiplomas").addEventListener("click", loadDiplomas);
document.getElementById("searchDiplomas").addEventListener("input", renderDiplomas);
document.getElementById("statusFilter").addEventListener("change", renderDiplomas);
document.getElementById("sortDiplomas").addEventListener("change", renderDiplomas);

const issueModal = document.getElementById("issueModal");
function openIssueModal() { issueModal.hidden = false; }
function closeIssueModal() { issueModal.hidden = true; }
document.getElementById("openIssue").addEventListener("click", openIssueModal);
document.getElementById("closeIssue").addEventListener("click", closeIssueModal);
document.getElementById("cancelIssue").addEventListener("click", closeIssueModal);
issueModal.addEventListener("click", event => { if (event.target === issueModal) closeIssueModal(); });

/* =====================================================
   10. INITIALIZE ADMIN DASHBOARD
===================================================== */

loadDiplomas();
