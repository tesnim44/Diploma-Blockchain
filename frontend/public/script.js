// ---------- D2 : hash local (IDENTIQUE à la fonction de C : mêmes octets, SHA-256, sortie "0x" + 64 hex) ----------
async function calculateHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hashHex;
}

// ---------- D3 : lecture du contrat (aucune transaction, aucun MetaMask) ----------
const DEMO = !CONTRACT_ADDRESS;

async function verifierSurBlockchain(hash) {
  if (DEMO) {
    // Faux résultats pour développer avant le jour 3 : dépend du 1er chiffre du hash.
    const c = parseInt(hash[2], 16);
    if (c < 6)  return { existe: true,  valide: true,  nom: "Ahmed Ben Ali", date: BigInt(Math.floor(Date.now() / 1000)) };
    if (c < 11) return { existe: true,  valide: false, nom: "Ahmed Ben Ali", date: BigInt(Math.floor(Date.now() / 1000)) };
    return { existe: false, valide: false, nom: "", date: 0n };
  }
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  const r = await contract.verifierDiplome(hash);
  return { existe: r[0], valide: r[1], nom: r[2], date: r[3] };
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
  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function afficherErreur(msg) {
  resultEl.className = "bad";
  resultEl.replaceChildren();
  const ic = document.createElement("div"); ic.className = "icon"; ic.textContent = "!"; ic.setAttribute("aria-hidden", "true");
  const h = document.createElement("h3"); h.textContent = "Erreur";
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

function choisir(f) {
  if (!f || (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf"))) {
    afficherErreur("Le fichier doit être un PDF.");
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
  resultEl.hidden = true; progress.hidden = true; resetBtn.hidden = true;
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
  $("fileInfo").hidden = true; resultEl.hidden = true; progress.hidden = true; resetBtn.hidden = true;
  btn.disabled = true;
  $("verifier").scrollIntoView({ behavior: "smooth" });
});

btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "Vérification en cours...";
  resultEl.hidden = true;
  try {
    setEtape(1);
    await fichier.arrayBuffer();
    setEtape(2);
    const hash = await calculateHash(fichier);
    setEtape(3);
    const r = await verifierSurBlockchain(hash);
    setEtape(4);
    afficher(r);
    resetBtn.hidden = false;
  } catch (err) {
    console.error(err);
    afficherErreur("Impossible de lire la blockchain. Vérifiez votre connexion et réessayez.");
    progress.hidden = true;
  } finally {
    btn.disabled = false;
    btn.textContent = "Vérifier le diplôme";
  }
});
