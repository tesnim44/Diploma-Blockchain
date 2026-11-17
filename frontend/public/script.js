// ---------- D2 : hash local (IDENTIQUE à la fonction de C : mêmes octets, SHA-256, sortie "0x" + 64 hex) ----------
async function calculateHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hashHex;
}

// ---------- D3 : vérification réelle sur Ethereum Sepolia ----------
const DEMO = typeof CONTRACT_ADDRESS === "undefined" || !CONTRACT_ADDRESS;

async function verifierSurBlockchain(hash) {
  if (DEMO) throw new Error("Le mode démonstration est encore activé.");
  if (typeof ethers === "undefined") {
    throw new Error("La bibliothèque de vérification n'est pas disponible.");
  }
  if (!ethers.isAddress(CONTRACT_ADDRESS) || !SEPOLIA_RPC_URL) {
    throw new Error("La configuration du contrat est invalide.");
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error("Le service n'est pas connecté au réseau Sepolia.");
  }

  const code = await provider.getCode(CONTRACT_ADDRESS);
  if (code === "0x") {
    throw new Error("Le contrat de vérification est introuvable sur Sepolia.");
  }

  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  const r = await contract.verifierDiplome(hash);
  return {
    existe: r.existe ?? r[0],
    valide: r.valide ?? r[1],
    nom: r.nom ?? r[2],
    date: r.date ?? r[3]
  };
}

// ---------- D4 : affichage des 3 cas ----------
const $ = id => document.getElementById(id);
const resultEl = $("result");

function afficher(r) {
  let cls, icone, titre, texte;
  if (!r.existe) {
    cls = "unk"; icone = "?"; titre = "Diplôme introuvable";
    texte = "Cette empreinte n'est pas dans le registre de l'université. L'authenticité ne peut pas être confirmée.";
  } else if (r.valide) {
    cls = "ok"; icone = "✓"; titre = "Diplôme authentique";
    texte = "Ce diplôme est enregistré et n'a pas été révoqué.";
  } else {
    cls = "bad"; icone = "✕"; titre = "Diplôme révoqué";
    texte = "Ce diplôme est enregistré, mais l'université l'a annulé.";
  }
  resultEl.className = cls;
  resultEl.replaceChildren();
  const ic = document.createElement("div"); ic.className = "icon"; ic.textContent = icone; ic.setAttribute("aria-hidden", "true");
  const h = document.createElement("h3"); h.textContent = titre;
  const p = document.createElement("p"); p.textContent = texte;
  resultEl.append(ic, h, p);
  if (r.existe) {
    const details = document.createElement("dl");
    if (r.nom) {
      const nameLabel = document.createElement("dt"); nameLabel.textContent = "Titulaire";
      const nameValue = document.createElement("dd"); nameValue.textContent = r.nom;
      details.append(nameLabel, nameValue);
    }
    if (r.date != null) {
      const dateLabel = document.createElement("dt"); dateLabel.textContent = "Enregistré le";
      const dateValue = document.createElement("dd");
      dateValue.textContent = new Date(Number(r.date) * 1000).toLocaleDateString("fr-FR", { dateStyle: "long" });
      details.append(dateLabel, dateValue);
    }
    if (details.childElementCount) resultEl.append(details);
  }
  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function afficherErreur(msg) {
  resultEl.className = "error";
  resultEl.replaceChildren();
  const ic = document.createElement("div"); ic.className = "icon"; ic.textContent = "!"; ic.setAttribute("aria-hidden", "true");
  const h = document.createElement("h3"); h.textContent = "Vérification impossible";
  const p = document.createElement("p"); p.textContent = msg;
  resultEl.append(ic, h, p);
  resultEl.hidden = false;
}

// ---------- D1 : interactions de la page ----------
const input = $("pdf"), zone = $("dropzone"), btn = $("verify");
const progress = $("progress"), resetBtn = $("reset");
let fichier = null;

if (DEMO) $("demoBanner").hidden = false;

function tailleLisible(o) { return o < 1048576 ? Math.max(1, Math.round(o / 1024)) + " Ko" : (o / 1048576).toFixed(1) + " Mo"; }

function setEtape(n) {
  progress.hidden = false;
  progress.querySelectorAll("li").forEach(li => {
    const k = Number(li.dataset.step);
    li.className = k < n ? "done" : k === n ? "active" : "";
  });
}

function effacerVerification() {
  resultEl.replaceChildren();
  resultEl.className = "";
  resultEl.hidden = true;
  progress.querySelectorAll("li").forEach(li => li.classList.remove("done", "active"));
  progress.hidden = true;
  resetBtn.hidden = true;
}

function choisir(f) {
  effacerVerification();
  const isPdf = f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
  if (!isPdf || f.size === 0) {
    fichier = null;
    input.value = "";
    $("dropText").textContent = "Glissez le PDF ici";
    $("dropSub").textContent = "ou cliquez pour le choisir (PDF uniquement)";
    $("fileInfo").hidden = true;
    zone.classList.remove("filled");
    btn.disabled = true;
    afficherErreur("Sélectionnez un fichier PDF valide et non vide.");
    return;
  }
  fichier = f;
  $("dropText").textContent = "Fichier prêt";
  $("dropSub").textContent = "Cliquez pour en choisir un autre";
  $("fileName").textContent = f.name;
  $("fileSize").textContent = tailleLisible(f.size);
  $("fileInfo").hidden = false;
  zone.classList.add("filled");
  btn.disabled = false;
}

input.addEventListener("change", () => choisir(input.files[0]));
zone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("over"); }));
zone.addEventListener("drop", e => choisir(e.dataTransfer.files[0]));

resetBtn.addEventListener("click", () => {
  fichier = null; input.value = "";
  $("dropText").textContent = "Glissez le PDF ici";
  $("dropSub").textContent = "ou cliquez pour le choisir (PDF uniquement)";
  zone.classList.remove("filled");
  $("fileInfo").hidden = true;
  effacerVerification();
  btn.disabled = true;
  $("verifier").scrollIntoView({ behavior: "smooth" });
});

btn.addEventListener("click", async () => {
  if (!fichier) return;
  effacerVerification();
  btn.disabled = true;
  btn.textContent = "Vérification en cours...";
  try {
    if (!window.isSecureContext || !globalThis.crypto?.subtle) {
      throw new Error("Le calcul SHA-256 nécessite une page HTTPS ou localhost et un navigateur compatible.");
    }
    setEtape(1);
    const header = new Uint8Array(await fichier.slice(0, 1024).arrayBuffer());
    const headerText = new TextDecoder("latin1").decode(header);
    if (!headerText.includes("%PDF-")) {
      throw new Error("Le fichier sélectionné ne semble pas être un PDF valide.");
    }
    setEtape(2);
    const hash = await calculateHash(fichier);
    setEtape(3);
    const r = await verifierSurBlockchain(hash);
    setEtape(4);
    afficher(r);
    resetBtn.hidden = false;
  } catch (err) {
    console.error("Erreur de vérification :", err);

    const message = err.message || "Erreur inconnue";
    afficherErreur(message.includes("fetch") || message.includes("timeout")
      ? "Impossible de contacter le réseau Sepolia. Vérifiez votre connexion puis réessayez."
      : message);

    progress.hidden = true;
  } finally {
    btn.disabled = false;
    btn.textContent = "Vérifier le diplôme";
  }
});
