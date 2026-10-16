// EPITA Smart Classroom : audit visuel d'une salle de cours
// Double moteur : COCO-SSD optimisé (navigateur local) + Vision Avancée Gemini Flash (Google AI Studio - Gratuit)
const $ = (id) => document.getElementById(id);

// Libellés français des classes. La classe "person" est volontairement écartée pour respecter la vie privée.
const LABELS = {
  chair: "Chaises",
  "dining table": "Tables et bureaux",
  laptop: "Ordinateurs portables",
  tv: "Écrans",
  whiteboard: "Tableaux",
  window: "Fenêtres",
  couch: "Canapés / Fauteuils",
  bench: "Bancs / Chaises",
  desk: "Bureaux",
  monitor: "Moniteurs / Écrans",
  keyboard: "Claviers",
  mouse: "Souris",
  "cell phone": "Téléphones",
  book: "Livres",
  clock: "Horloges",
  "potted plant": "Plantes",
  bottle: "Bouteilles",
  cup: "Tasses",
  backpack: "Sacs à dos",
  remote: "Télécommandes",
};
const label = (c) => LABELS[c] || c;

// Couleurs personnalisées par catégorie pour un affichage visuel clair et professionnel
const COLORS = {
  chair: "#2e7d52",        // Vert forêt
  bench: "#2e7d52",
  couch: "#2e7d52",
  "dining table": "#2563eb", // Bleu roi
  desk: "#2563eb",
  laptop: "#7c3aed",       // Violet
  tv: "#d97706",           // Orange
  monitor: "#d97706",
  whiteboard: "#0891b2",   // Cyan / Turquoise
  window: "#ca8a04",       // Ambre
  default: "#f2c94c",      // Jaune
};

// Configuration théorique modifiable.
// isGeminiOnly = true : non supporté nativement par COCO-SSD (affiché "Non vérifiable"), mais audité par Gemini.
const rules = [
  { name: "Tables et bureaux", cls: "dining table", aliases: ["dining table", "desk"], expected: 10 },
  { name: "Chaises", cls: "chair", aliases: ["chair", "bench", "couch"], expected: 20 },
  { name: "Ordinateurs portables", cls: "laptop", aliases: ["laptop"], expected: 5 },
  { name: "Écrans", cls: "tv", aliases: ["tv", "monitor"], expected: 1 },
  { name: "Tableau", cls: "whiteboard", aliases: ["whiteboard", "blackboard"], expected: 1, isGeminiOnly: true },
  { name: "Fenêtres", cls: "window", aliases: ["window"], expected: 2, isGeminiOnly: true },
];

let currentEngine = "coco"; // 'coco' ou 'gemini'
let model = null,
  stream = null,
  snap = null,
  raw = [],
  analysed = false,
  ms = 0;

/* ---------- Gestion du statut et modèle ---------- */
function setModel(text, kind) {
  const b = $("model-status");
  b.textContent = text;
  b.className = "badge " + kind;
}

async function loadModel() {
  $("retry").hidden = true;
  setModel("Chargement de COCO-SSD...", "wait");
  try {
    model = await cocoSsd.load({ base: "mobilenet_v2" });
    if (currentEngine === "coco") {
      setModel("Modèle prêt (COCO-SSD optimisé)", "ok");
    }
  } catch (e) {
    model = null;
    if (currentEngine === "coco") {
      setModel("Le modèle local ne s'est pas chargé. Vérifiez votre connexion.", "err");
      $("retry").hidden = false;
    }
  }
}

/* ---------- Gestion Clé Gemini (LocalStorage) ---------- */
function getGeminiKey() {
  return localStorage.getItem("epita_gemini_key") || $("gemini-key").value.trim();
}

function saveGeminiKey() {
  const key = $("gemini-key").value.trim();
  if (!key) return msg("Veuillez saisir une clé API valide.");
  localStorage.setItem("epita_gemini_key", key);
  msg("Clé API Gemini enregistrée localement avec succès !");
  setTimeout(() => msg(""), 3000);
}

/* ---------- Caméra ---------- */
const msg = (t) => {
  $("msg").textContent = t || "";
};

async function startCam() {
  msg("");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return msg(
      "Caméra indisponible : utilisez HTTPS ou localhost, ou importez une image de test.",
    );
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    $("video").srcObject = stream;
    await $("video").play();
    $("start").disabled = true;
    $("stop").disabled = false;
    $("snap").disabled = false;
  } catch (e) {
    msg(
      e.name === "NotAllowedError"
        ? "Accès à la caméra refusé. Autorisez-la dans le navigateur ou importez une image de test."
        : "Aucune caméra utilisable. Importez une image de test.",
    );
  }
}

function stopCam() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  $("video").srcObject = null;
  $("start").disabled = false;
  $("stop").disabled = true;
  $("snap").disabled = true;
}

/* ---------- Analyse avec API Gemini Flash (Gratuit) ---------- */
let cachedGeminiModel = null;

async function callGeminiGenerate(apiKey, base64Data, prompt) {
  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const candidateModels = [];
  if (cachedGeminiModel) {
    candidateModels.push(cachedGeminiModel);
  } else {
    // Détection automatique des modèles disponibles pour cette clé
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = listData.models || [];
        const flashModels = available
          .filter(
            (m) =>
              m.supportedGenerationMethods?.includes("generateContent") &&
              m.name?.includes("flash")
          )
          .map((m) => m.name.replace(/^models\//, ""));
        candidateModels.push(...flashModels);
      }
    } catch (e) {
      console.warn("Échec listModels, utilisation de la liste de secours :", e);
    }
  }

  // Modèles par défaut en cas d'échec de listModels
  const defaults = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash"
  ];
  for (const d of defaults) {
    if (!candidateModels.includes(d)) candidateModels.push(d);
  }

  let lastErr = null;
  for (const model of candidateModels) {
    for (const ver of ["v1beta", "v1"]) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });
        if (res.ok) {
          cachedGeminiModel = model;
          return await res.json();
        }
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${res.status}`;
        lastErr = new Error(errMsg);
        if (errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("invalid")) {
          throw lastErr;
        }
      } catch (err) {
        if (err.message?.toLowerCase().includes("api key")) throw err;
        lastErr = err;
      }
    }
  }

  throw lastErr || new Error("Aucun modèle Gemini compatible n'a pu être contacté.");
}

async function analyzeGemini(snapCanvas) {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error("Clé API Gemini manquante. Veuillez saisir votre clé gratuite Google AI Studio ci-dessus.");
  }

  const base64Data = snapCanvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  const prompt = `Tu es un système de vision par ordinateur pour l'audit d'une salle de classe.
Détecte TOUS les objets visibles appartenant aux catégories suivantes :
- "chair" : chaises, sièges scolaires, bancs, tabourets
- "dining table" : tables, bureaux, pupitres
- "laptop" : ordinateurs portables
- "tv" : écrans d'ordinateur, moniteurs, télévisions, vidéoprojecteurs
- "whiteboard" : tableaux blancs, tableaux noirs, tableaux interactifs
- "window" : fenêtres visibles

RÈGLE ÉTHIQUE STRICTE : N'inclus JAMAIS les personnes ("person"). Ignore totalement toute personne présente.

Format de réponse obligatoire : réponds STRICTEMENT avec un objet JSON sans aucun formatage Markdown (\`\`\`json exclu) :
{
  "objects": [
    {
      "class": "chair" | "dining table" | "laptop" | "tv" | "whiteboard" | "window",
      "score": 0.95,
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}
Chaque valeur dans box_2d est un entier normalisé entre 0 et 1000 ([ymin, xmin, ymax, xmax]). Sois précis et exhaustif sur le mobilier.`;

  const data = await callGeminiGenerate(apiKey, base64Data, prompt);
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Réponse vide reçue de l'IA.");

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) throw new Error("Format JSON introuvable dans la réponse de l'IA.");
  const cleanJson = rawText.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(cleanJson);
  const objects = parsed.objects || [];

  return objects
    .filter((obj) => obj.class && obj.class !== "person")
    .map((obj) => {
      let bbox = [0, 0, 0, 0];
      if (Array.isArray(obj.box_2d) && obj.box_2d.length === 4) {
        const [ymin, xmin, ymax, xmax] = obj.box_2d;
        const x = Math.round((xmin / 1000) * snapCanvas.width);
        const y = Math.round((ymin / 1000) * snapCanvas.height);
        const w = Math.round(((xmax - xmin) / 1000) * snapCanvas.width);
        const h = Math.round(((ymax - ymin) / 1000) * snapCanvas.height);
        bbox = [x, y, w, h];
      }
      return {
        class: obj.class,
        score: typeof obj.score === "number" ? obj.score : 0.95,
        bbox
      };
    });
}

/* ---------- Pipeline d'Analyse Principal ---------- */
async function analyze(src, w, h) {
  msg("");
  const scale = Math.min(1, 1280 / w);
  snap = document.createElement("canvas");
  snap.width = Math.round(w * scale);
  snap.height = Math.round(h * scale);
  snap.getContext("2d").drawImage(src, 0, 0, snap.width, snap.height);

  // 1. Afficher immédiatement la photo prise dans la boîte de détection
  const cv = $("out"),
    ctx = cv.getContext("2d");
  cv.width = snap.width;
  cv.height = snap.height;
  ctx.drawImage(snap, 0, 0);

  // 2. Afficher le panneau "Analyse en cours" sur la photo
  const overlay = $("analysis-overlay");
  const overlayTitle = overlay ? overlay.querySelector("b") : null;
  if (overlayTitle) {
    overlayTitle.textContent = currentEngine === "gemini" 
      ? "Analyse Gemini Vision en cours..." 
      : "Analyse COCO-SSD en cours...";
  }
  if (overlay) overlay.hidden = false;

  // Laisser le navigateur afficher l'image et l'overlay avant l'inférence
  await new Promise((resolve) => setTimeout(resolve, 30));

  try {
    if (currentEngine === "gemini") {
      setModel("Analyse en cours avec Gemini Flash...", "wait");
      const t = performance.now();
      const preds = await analyzeGemini(snap);
      ms = Math.round(performance.now() - t);
      raw = preds.filter((p) => p.class !== "person");
      analysed = true;
      setModel("Analyse Gemini terminée avec succès", "ok");
      render();
    } else {
      if (!model) {
        throw new Error("Le modèle local n'est pas prêt : veuillez patienter ou recharger.");
      }
      setModel("Analyse locale en cours...", "wait");
      const t = performance.now();
      const preds = await model.detect(snap, 100, 0.05);
      ms = Math.round(performance.now() - t);
      raw = preds.filter((p) => p.class !== "person");
      analysed = true;
      setModel("Modèle prêt (COCO-SSD optimisé)", "ok");
      render();
    }
  } catch (e) {
    setModel("Erreur d'analyse", "err");
    msg("Erreur : " + e.message);
  } finally {
    // 3. Masquer le panneau d'analyse dès que le traitement est terminé
    if (overlay) overlay.hidden = true;
  }
}

const threshold = () => $("th").value / 100;
const current = () => raw.filter((p) => p.score >= threshold());

function counts(dets) {
  const c = {};
  dets.forEach((d) => {
    (c[d.class] = c[d.class] || []).push(d.score);
  });
  return c;
}

function getRuleCount(r, c) {
  let total = 0;
  const aliases = r.aliases || [r.cls];
  aliases.forEach((a) => {
    if (c[a]) total += c[a].length;
  });
  return total;
}

function status(r, n) {
  const isVerifiable = currentEngine === "gemini" ? Boolean(r.cls) : Boolean(!r.isGeminiOnly && r.cls);
  if (!isVerifiable)
    return { gap: "-", t: "Non vérifiable (modèle)", c: "na", ecart: false };
  if (!analysed) return { gap: "-", t: "En attente", c: "na", ecart: false };
  const gap = n - r.expected;
  if (gap === 0) return { gap: 0, t: "Conforme", c: "ok", ecart: false };
  if (n === 0)
    return {
      gap,
      t: "Écart : non détecté, à vérifier",
      c: "warn",
      ecart: true,
    };
  return {
    gap: (gap > 0 ? "+" : "") + gap,
    t: gap < 0 ? "Écart : moins que prévu" : "Écart : plus que prévu",
    c: "warn",
    ecart: true,
  };
}

/* ---------- Rendu Visuel (Canvas et Tableaux) ---------- */
function draw() {
  const cv = $("out"),
    ctx = cv.getContext("2d");
  if (!snap) return;
  cv.width = snap.width;
  cv.height = snap.height;
  ctx.drawImage(snap, 0, 0);

  const lw = Math.max(2, Math.round(cv.width / 320)),
    fs = Math.max(12, Math.round(cv.width / 50));
  ctx.lineWidth = lw;
  ctx.font = `bold ${fs}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "top";

  current().forEach((d) => {
    const [x, y, w, h] = d.bbox,
      color = COLORS[d.class] || COLORS.default,
      t = `${label(d.class)} ${Math.round(d.score * 100)}%`;
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, w, h);
    const tw = ctx.measureText(t).width + 10;
    const labelY = Math.max(0, y - fs - 6);
    ctx.fillStyle = color;
    ctx.fillRect(x, labelY, tw, fs + 6);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(t, x + 5, labelY + 3);
  });
}

function render() {
  draw();
  const dets = current(),
    c = counts(dets);
  $("th-val").textContent = Math.round(threshold() * 100) + " %";

  // Détections par catégorie
  $("found").innerHTML = Object.keys(c).length
    ? Object.entries(c)
        .map(
          ([k, s]) =>
            `<tr>
              <td><b>${label(k)}</b></td>
              <td><span class="detection-count">${s.length}</span></td>
              <td><span class="detection-conf">${Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100)} %</span></td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:1rem;">${analysed ? "Aucune détection à ce seuil." : "Aucune analyse pour le moment."}</td></tr>`;

  // Audit de la configuration
  let ecarts = 0;
  rules.forEach((r, i) => {
    const isVerifiable = currentEngine === "gemini" ? Boolean(r.cls) : Boolean(!r.isGeminiOnly && r.cls);
    const n = isVerifiable ? getRuleCount(r, c) : 0;
    const s = status(r, n);
    r.result = { n: isVerifiable ? n : "-", ...s };
    if (s.ecart) ecarts++;
    $("det" + i).textContent = r.result.n;

    let gapClass = "zero";
    if (typeof s.gap === "number") {
      if (s.gap > 0) gapClass = "positive";
      else if (s.gap < 0) gapClass = "negative";
    } else if (String(s.gap).startsWith("+")) {
      gapClass = "positive";
    } else if (String(s.gap).startsWith("-")) {
      gapClass = "negative";
    }
    $("gap" + i).textContent = s.gap;
    $("gap" + i).className = "gap-badge " + gapClass;

    $("st" + i).textContent = s.t;
    $("st" + i).className = "status-chip " + s.c;
  });

  // Tableau de bord KPI
  const verifiables = rules.filter((r) =>
    currentEngine === "gemini" ? Boolean(r.cls) : Boolean(!r.isGeminiOnly && r.cls)
  ).length;

  let global = ["En attente", "na"];
  if (analysed)
    global =
      ecarts === 0
        ? ["Conforme", "ok"]
        : ["Écarts observés", "warn"];

  const k = (v, l, cls = "") => `
    <div class="kpi-card ${cls}">
      <div class="kpi-val">${v}</div>
      <div class="kpi-label">${l}</div>
    </div>`;

  $("kpis").innerHTML =
    k(dets.length, "Objets Détectés") +
    k(Object.keys(c).length, "Catégories") +
    k(verifiables, "Règles Actives") +
    k(ecarts, "Écarts", ecarts ? "warn" : "ok") +
    k(global[0], "Statut Global", global[1]) +
    k(analysed ? ms + " ms" : "-", "Temps d'inférence");

  window.__audit = { dets, c, ecarts, verifiables, global: global[0] };
}

/* ---------- Génération du Rapport d'Audit ---------- */
function buildReport() {
  if (!analysed)
    return "Aucune analyse disponible. Capturez ou importez une image d'abord.";

  const { dets, c, ecarts, verifiables, global } = window.__audit;
  const engineDesc = currentEngine === "gemini"
    ? "Vision IA Avancée Gemini 1.5 Flash (Google AI Studio - Gratuit)"
    : "COCO-SSD optimisé (TensorFlow.js / MobileNet v2)";

  const L = [
    "# Rapport d'audit : EPITA Smart Classroom",
    "",
    `Date : ${new Date().toLocaleString("fr-FR")}`,
    `Moteur d'IA : ${engineDesc}`,
    `Seuil de confiance : ${Math.round(threshold() * 100)} %`,
    "",
    "## Contexte",
    `Audit visuel d'une salle de cours. Aucune image n'est enregistrée et les personnes ne sont pas analysées (respect strict de la vie privée).`,
    "",
    "## Objets détectés",
    `Total : ${dets.length} objet(s) dans ${Object.keys(c).length} catégorie(s).`,
  ];
  Object.entries(c).forEach(([k, s]) =>
    L.push(
      `- ${label(k)} : ${s.length} (confiance moyenne ${Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100)} %)`,
    ),
  );
  if (!dets.length) L.push("- Aucun objet détecté à ce seuil.");

  L.push(
    "",
    "## Quantités attendues et observées",
    "| Catégorie | Attendu | Détecté | Écart | Statut |",
    "|---|---|---|---|---|",
  );
  rules.forEach((r) =>
    L.push(
      `| ${r.name} | ${r.expected} | ${r.result.n} | ${r.result.gap} | ${r.result.t} |`,
    ),
  );

  L.push(
    "",
    "## Écarts identifiés",
    `${ecarts} écart(s) sur ${verifiables} règle(s) vérifiable(s). Statut global : ${global}.`,
  );
  rules
    .filter((r) => r.result.ecart)
    .forEach((r) =>
      L.push(`- ${r.name} : attendu ${r.expected}, détecté ${r.result.n}.`),
    );

  const nonSup = rules
    .filter((r) => currentEngine === "coco" ? (r.isGeminiOnly || !r.cls) : !r.cls)
    .map((r) => r.name);

  L.push(
    "",
    "## Catégories non prises en charge",
    nonSup.length
      ? `${nonSup.join(", ")} : le modèle COCO-SSD ne reconnaît pas nativement ces catégories. Aucune détection n'est inventée, un contrôle manuel est nécessaire.`
      : "Toutes les catégories de l'audit sont prises en charge par le modèle actif.",
  );

  L.push(
    "",
    "## Limites de l'analyse",
    "- Un objet non détecté n'est pas forcément absent (masqué, mal cadré, trop petit ou mal éclairé).",
    currentEngine === "coco"
      ? "- COCO-SSD est un modèle léger qui peut agréger les chaises proches ou ignorer les objets lointains."
      : "- L'analyse dépend de la visibilité sur l'image et de l'absence de reflets sur les fenêtres/écrans.",
    "- Une seule image est analysée : elle ne couvre pas l'intégralité de la pièce.",
  );

  L.push("", "## Recommandations pour un contrôle complémentaire");
  if (
    rules.some(
      (r) =>
        r.result.ecart &&
        r.result.gap !== "-" &&
        (r.result.n === 0 || String(r.result.gap).startsWith("-")),
    )
  )
    L.push(
      "- Réaliser une prise de vue complémentaire sous un autre angle ou avec un meilleur éclairage.",
    );
  if (rules.some((r) => r.result.ecart && String(r.result.gap).startsWith("+")))
    L.push(
      "- Ajuster le seuil de confiance si des faux positifs ou doublons apparaissent.",
    );
  if (nonSup.length) L.push(`- Contrôler visuellement : ${nonSup.join(", ")}.`);
  L.push("- Confirmer les écarts par un comptage physique avant toute commande ou intervention.");

  return L.join("\n");
}

/* ---------- Initialisation ---------- */
function init() {
  $("rules").innerHTML = rules
    .map(
      (r, i) => `<tr>
        <td><b>${r.name}</b></td>
        <td><input type="number" min="0" value="${r.expected}" data-i="${i}" aria-label="Quantité attendue : ${r.name}"></td>
        <td id="det${i}">-</td>
        <td id="gap${i}" class="gap-badge zero">-</td>
        <td><span id="st${i}" class="status-chip na">-</span></td>
      </tr>`,
    )
    .join("");

  $("rules").addEventListener("input", (e) => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    rules[i].expected = Math.max(0, parseInt(e.target.value, 10) || 0);
    render();
  });

  // Gestion du choix de moteur IA
  document.querySelectorAll('input[name="engine"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      currentEngine = e.target.value;
      const isGemini = currentEngine === "gemini";
      $("gemini-config").hidden = !isGemini;
      if (isGemini) {
        setModel("Mode Vision Gemini Flash actif (Prêt)", "ok");
      } else {
        setModel(model ? "Modèle prêt (COCO-SSD optimisé)" : "Chargement de COCO-SSD...", model ? "ok" : "wait");
      }
      render();
    });
  });

  // Sauvegarde clé API Gemini
  const savedKey = localStorage.getItem("epita_gemini_key");
  if (savedKey) $("gemini-key").value = savedKey;
  $("save-key").onclick = saveGeminiKey;

  // Événements caméra & fichiers
  $("start").onclick = startCam;
  $("stop").onclick = stopCam;
  $("snap").onclick = () => {
    const v = $("video");
    analyze(v, v.videoWidth, v.videoHeight);
  };
  $("th").oninput = render;
  $("retry").onclick = loadModel;

  $("file").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image(),
      url = URL.createObjectURL(f);
    img.onload = () => {
      analyze(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => msg("Fichier image illisible.");
    img.src = url;
    e.target.value = "";
  };

  $("gen").onclick = () => {
    $("report").textContent = buildReport();
    $("dl").disabled = !analysed;
  };

  $("dl").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([$("report").textContent], { type: "text/markdown" }),
    );
    a.download = "rapport-audit.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  render();
  loadModel();
}

window.addEventListener("DOMContentLoaded", init);
