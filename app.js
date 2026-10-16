// EPITA Smart Classroom : audit visuel d'une salle de cours
// Double moteur : COCO-SSD optimisé (navigateur local) + Vision Avancée Gemini Flash (Google AI Studio - Gratuit)
// Support multi-vues (plusieurs angles pour un même audit) + Historique persistant des audits
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
  stream = null;

// État de l'audit en cours (Support Multi-Angles)
let auditViews = [];      // Liste des angles : { id, name, snap, thumbnail, raw, ms, engine, timestamp }
let activeViewIndex = -1; // Angle actif affiché sur le grand canvas
let cachedGeminiModel = null;
const HISTORY_KEY = "epita_smart_classroom_history";

/* ---------- Gestion du statut et modèle ---------- */
function setModel(text, kind) {
  const b = $("model-status");
  if (!b) return;
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

/* ---------- Appel API Gemini Flash avec Fallback ---------- */
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

/* ---------- Pipeline d'Analyse (Support Multi-Angles) ---------- */
async function analyze(src, w, h, customName) {
  msg("");
  const scale = Math.min(1, 1280 / w);
  const snapCanvas = document.createElement("canvas");
  snapCanvas.width = Math.round(w * scale);
  snapCanvas.height = Math.round(h * scale);
  snapCanvas.getContext("2d").drawImage(src, 0, 0, snapCanvas.width, snapCanvas.height);

  // 1. Afficher immédiatement la photo prise dans la boîte de détection
  const cv = $("out"),
    ctx = cv.getContext("2d");
  cv.width = snapCanvas.width;
  cv.height = snapCanvas.height;
  ctx.drawImage(snapCanvas, 0, 0);

  // 2. Afficher le panneau "Analyse en cours" sur la photo
  const overlay = $("analysis-overlay");
  const overlayTitle = overlay ? overlay.querySelector("b") : null;
  if (overlayTitle) {
    overlayTitle.textContent = currentEngine === "gemini" 
      ? "Analyse Gemini Vision en cours..." 
      : "Analyse COCO-SSD en cours...";
  }
  if (overlay) overlay.hidden = false;

  await new Promise((resolve) => setTimeout(resolve, 30));

  let preds = [], ms = 0;
  try {
    if (currentEngine === "gemini") {
      setModel("Analyse en cours avec Gemini Flash...", "wait");
      const t = performance.now();
      preds = await analyzeGemini(snapCanvas);
      ms = Math.round(performance.now() - t);
      setModel("Analyse Gemini terminée avec succès", "ok");
    } else {
      if (!model) {
        throw new Error("Le modèle local n'est pas prêt : veuillez patienter ou recharger.");
      }
      setModel("Analyse locale en cours...", "wait");
      const t = performance.now();
      preds = await model.detect(snapCanvas, 100, 0.05);
      ms = Math.round(performance.now() - t);
      setModel("Modèle prêt (COCO-SSD optimisé)", "ok");
    }

    // 3. Ajouter cet angle à l'audit en cours
    const angleNumber = auditViews.length + 1;
    const view = {
      id: "view_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: customName || `Angle ${angleNumber}`,
      snap: snapCanvas,
      thumbnail: snapCanvas.toDataURL("image/jpeg", 0.6),
      raw: preds.filter((p) => p.class !== "person"),
      ms: ms,
      engine: currentEngine,
      timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    };

    auditViews.push(view);
    activeViewIndex = auditViews.length - 1;
    render();
  } catch (e) {
    setModel("Erreur d'analyse", "err");
    msg("Erreur : " + e.message);
  } finally {
    if (overlay) overlay.hidden = true;
  }
}

const threshold = () => $("th").value / 100;

/* ---------- Agrégation Multi-Vues pour l'Audit ---------- */
function getCumulativeAudit() {
  const counts = {};
  let totalDets = 0;
  auditViews.forEach((v) => {
    const dets = v.raw.filter((p) => p.score >= threshold());
    totalDets += dets.length;
    dets.forEach((d) => {
      (counts[d.class] = counts[d.class] || []).push(d.score);
    });
  });
  return { counts, totalDets };
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
  if (!auditViews.length) return { gap: "-", t: "En attente", c: "na", ecart: false };
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

/* ---------- Rendu Visuel du Canvas ---------- */
function draw() {
  const cv = $("out"),
    ctx = cv.getContext("2d");

  if (activeViewIndex < 0 || !auditViews[activeViewIndex]) {
    cv.width = 640;
    cv.height = 360;
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#64748b";
    ctx.font = "14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Aucune vue analysée", cv.width / 2, cv.height / 2);
    if ($("scale-info")) $("scale-info").textContent = "En attente";
    return;
  }

  const activeView = auditViews[activeViewIndex];
  const snap = activeView.snap;
  cv.width = snap.width;
  cv.height = snap.height;
  ctx.drawImage(snap, 0, 0);

  const lw = Math.max(2, Math.round(cv.width / 320)),
    fs = Math.max(12, Math.round(cv.width / 50));
  ctx.lineWidth = lw;
  ctx.font = `bold ${fs}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const dets = activeView.raw.filter((d) => d.score >= threshold());
  dets.forEach((d) => {
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

  if ($("scale-info")) {
    $("scale-info").textContent = `${activeView.name} • ${dets.length} objet(s) visible(s)`;
  }
}

/* ---------- Rendu de la Pellicule Multi-Angles ---------- */
function renderViewsStrip() {
  const strip = $("views-strip");
  const countBadge = $("views-count");
  if (!strip) return;

  if (countBadge) {
    const n = auditViews.length;
    countBadge.textContent = `${n} angle${n > 1 ? "s" : ""}`;
  }

  strip.innerHTML = auditViews
    .map((v, idx) => {
      const detsCount = v.raw.filter((p) => p.score >= threshold()).length;
      const isActive = idx === activeViewIndex ? "active" : "";
      return `
        <div class="view-thumb ${isActive}" data-idx="${idx}" title="${v.name} (${detsCount} objets)">
          <button type="button" class="view-thumb-del" data-del="${idx}" title="Supprimer cet angle">×</button>
          <img src="${v.thumbnail}" alt="${v.name}" />
          <span class="view-thumb-badge">${v.name}</span>
          <span class="view-thumb-count">${detsCount}</span>
        </div>
      `;
    })
    .join("");

  strip.querySelectorAll(".view-thumb").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".view-thumb-del")) return;
      const idx = parseInt(el.dataset.idx, 10);
      selectView(idx);
    });
  });

  strip.querySelectorAll(".view-thumb-del").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.del, 10);
      removeView(idx);
    });
  });
}

function selectView(idx) {
  if (idx >= 0 && idx < auditViews.length) {
    activeViewIndex = idx;
    render();
  }
}

function removeView(idx) {
  if (idx >= 0 && idx < auditViews.length) {
    auditViews.splice(idx, 1);
    if (activeViewIndex >= auditViews.length) {
      activeViewIndex = auditViews.length - 1;
    }
    render();
  }
}

function resetAudit() {
  if (auditViews.length && !confirm("Voulez-vous réinitialiser cet audit et effacer les angles capturés ?")) {
    return;
  }
  auditViews = [];
  activeViewIndex = -1;
  render();
  msg("Audit réinitialisé. Prêt pour une nouvelle analyse.");
}

/* ---------- Rendu Global ---------- */
function render() {
  draw();
  renderViewsStrip();

  const { counts: c, totalDets } = getCumulativeAudit();
  $("th-val").textContent = Math.round(threshold() * 100) + " %";

  // 1. Détections cumulées par catégorie
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
    : `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:1rem;">${auditViews.length ? "Aucune détection à ce seuil." : "Aucune analyse pour le moment."}</td></tr>`;

  // 2. Audit de la configuration (global salle)
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

  // 3. Tableau de bord KPI
  const verifiables = rules.filter((r) =>
    currentEngine === "gemini" ? Boolean(r.cls) : Boolean(!r.isGeminiOnly && r.cls)
  ).length;

  let global = ["En attente", "na"];
  if (auditViews.length) {
    global =
      ecarts === 0
        ? ["Conforme", "ok"]
        : ["Écarts observés", "warn"];
  }

  const k = (v, l, cls = "") => `
    <div class="kpi-card ${cls}">
      <div class="kpi-val">${v}</div>
      <div class="kpi-label">${l}</div>
    </div>`;

  const avgMs = auditViews.length
    ? Math.round(auditViews.reduce((acc, v) => acc + (v.ms || 0), 0) / auditViews.length)
    : 0;

  $("kpis").innerHTML =
    k(totalDets, "Objets Cumulés") +
    k(Object.keys(c).length, "Catégories") +
    k(auditViews.length, "Angles Analysés") +
    k(ecarts, "Écarts", ecarts ? "warn" : "ok") +
    k(global[0], "Statut Global", global[1]) +
    k(auditViews.length ? avgMs + " ms" : "-", "Temps moyen / vue");

  window.__audit = { detsCount: totalDets, c, ecarts, verifiables, global: global[0] };

  // Activation des boutons d'actions
  const hasViews = auditViews.length > 0;
  $("gen").disabled = !hasViews;
  $("dl").disabled = !hasViews;
  $("save-audit").disabled = !hasViews;
}

/* ---------- Génération du Rapport d'Audit Multi-Angles ---------- */
function buildReport() {
  if (!auditViews.length)
    return "Aucune analyse disponible. Capturez un ou plusieurs angles d'abord.";

  const { counts: c, totalDets } = getCumulativeAudit();
  const { ecarts, verifiables, global } = window.__audit;
  const engineDesc = currentEngine === "gemini"
    ? "Vision IA Avancée Gemini Flash (Google AI Studio - Gratuit)"
    : "COCO-SSD optimisé (TensorFlow.js / MobileNet v2)";

  const L = [
    "# Rapport d'audit : EPITA Smart Classroom",
    "",
    `Date : ${new Date().toLocaleString("fr-FR")}`,
    `Moteur d'IA : ${engineDesc}`,
    `Seuil de confiance appliqué : ${Math.round(threshold() * 100)} %`,
    `Nombre d'angles / prises de vue analysés : ${auditViews.length}`,
    "",
    "## Contexte de l'audit",
    `Audit visuel multi-angles d'une salle de cours. ${auditViews.length} angle(s) analysé(s) pour couvrir l'ensemble du mobilier. Aucune image n'est persistée sur serveur et les personnes ne sont pas analysées (respect strict de la vie privée).`,
    "",
    "## Détail des prises de vue",
  ];

  auditViews.forEach((v, idx) => {
    const vDets = v.raw.filter((p) => p.score >= threshold());
    L.push(`- **${v.name}** (${v.timestamp}) : ${vDets.length} équipement(s) détecté(s) [Inférence : ${v.ms} ms].`);
  });

  L.push(
    "",
    "## Objets détectés au total (Inventaire global)",
    `Total cumulé : ${totalDets} équipement(s) dans ${Object.keys(c).length} catégorie(s).`,
  );
  Object.entries(c).forEach(([k, s]) =>
    L.push(
      `- ${label(k)} : ${s.length} (confiance moyenne ${Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100)} %)`,
    ),
  );
  if (!totalDets) L.push("- Aucun objet détecté à ce seuil.");

  L.push(
    "",
    "## Quantités attendues et observées (Audit de conformité)",
    "| Catégorie | Attendu | Détecté (Total) | Écart | Statut |",
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
      L.push(`- ${r.name} : attendu ${r.expected}, détecté ${r.result.n} (écart : ${r.result.gap}).`),
    );

  const nonSup = rules
    .filter((r) => currentEngine === "coco" ? (r.isGeminiOnly || !r.cls) : !r.cls)
    .map((r) => r.name);

  L.push(
    "",
    "## Catégories non prises en charge",
    nonSup.length
      ? `${nonSup.join(", ")} : le modèle COCO-SSD ne reconnaît pas nativement ces catégories. Aucune détection n'est inventée, un contrôle manuel est nécessaire.`
      : "Toutes les catégories de l'audit sont prises en charge par le moteur d'analyse actuel.",
  );

  L.push(
    "",
    "## Limites de l'analyse & Recommandations",
    "- L'analyse multi-angles réduit les occultations mais un comptage physique de confirmation reste conseillé.",
    "- Les objets masqués par des sacs ou sous les tables peuvent nécessiter un angle spécifique.",
    "- Confirmer les écarts avant toute commande ou décision logistique.",
  );

  return L.join("\n");
}

/* ---------- Historique des Audits (LocalStorage) ---------- */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistoryItem(item) {
  const history = getHistory();
  history.unshift(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  renderHistory();
}

function deleteHistoryItem(id) {
  if (!confirm("Voulez-vous supprimer cet audit de l'historique ?")) return;
  const history = getHistory().filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function clearAllHistory() {
  if (!confirm("Êtes-vous sûr de vouloir vider TOUT l'historique des audits ?")) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  msg("Historique des audits vidé.");
}

function renderHistory() {
  const container = $("history-rows");
  if (!container) return;
  const history = getHistory();
  if (!history.length) {
    container.innerHTML = `<tr><td colspan="7" class="empty-history"><span>📂</span>Aucun audit enregistré dans l'historique pour le moment.</td></tr>`;
    return;
  }

  container.innerHTML = history
    .map(
      (h) => `
    <tr>
      <td><b>${h.date}</b></td>
      <td><strong>${h.roomName}</strong></td>
      <td><span class="badge" style="background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe;">${h.viewsCount} angle${h.viewsCount > 1 ? "s" : ""}</span></td>
      <td>${h.engine}</td>
      <td><b>${h.totalDets}</b> équipement${h.totalDets > 1 ? "s" : ""}</td>
      <td><span class="status-chip ${h.statusClass}">${h.globalStatus}</span></td>
      <td>
        <div class="views-strip-actions">
          <button type="button" class="btn-sm secondary" onclick="viewAuditReport('${h.id}')" title="Afficher le rapport">📄 Rapport</button>
          <button type="button" class="btn-sm secondary" onclick="downloadAuditReport('${h.id}')" title="Télécharger (.md)">📥</button>
          <button type="button" class="btn-sm btn-danger" onclick="deleteHistoryItem('${h.id}')" title="Supprimer">🗑</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function saveCurrentAudit() {
  if (!auditViews.length) return msg("Aucun angle analysé à enregistrer.");
  const defaultName = `Salle de cours #${getHistory().length + 1}`;
  const roomName = prompt("Nom ou numéro de la salle pour cet audit :", defaultName);
  if (!roomName) return;

  const { totalDets } = getCumulativeAudit();
  const reportText = buildReport();
  const { ecarts, global } = window.__audit;

  const item = {
    id: "audit_" + Date.now(),
    date: new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
    roomName: roomName.trim(),
    viewsCount: auditViews.length,
    engine: currentEngine === "gemini" ? "Gemini Flash" : "COCO-SSD",
    totalDets: totalDets,
    ecartsCount: ecarts,
    globalStatus: global,
    statusClass: ecarts === 0 ? "ok" : "warn",
    report: reportText,
  };

  saveHistoryItem(item);
  msg(`Audit « ${roomName} » sauvegardé avec succès dans l'historique !`);
}

window.viewAuditReport = function (id) {
  const item = getHistory().find((h) => h.id === id);
  if (!item) return;
  $("report").textContent = item.report;
  $("dl").disabled = false;
  $("report").scrollIntoView({ behavior: "smooth" });
  msg(`Rapport de l'audit « ${item.roomName} » affiché ci-dessous.`);
};

window.downloadAuditReport = function (id) {
  const item = getHistory().find((h) => h.id === id);
  if (!item) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([item.report], { type: "text/markdown" }));
  a.download = `rapport-audit-${item.roomName.replace(/\s+/g, "_")}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
};

window.deleteHistoryItem = deleteHistoryItem;

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
  $("reset-audit").onclick = resetAudit;

  // Import fichier(s) avec support multi-images simultané
  $("file").onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise((resolve) => {
        img.onload = async () => {
          await analyze(img, img.naturalWidth, img.naturalHeight, `Angle ${auditViews.length + 1}`);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          msg("Fichier image illisible : " + file.name);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });
    }
    e.target.value = "";
  };

  // Actions du rapport et historique
  $("gen").onclick = () => {
    $("report").textContent = buildReport();
    $("dl").disabled = !auditViews.length;
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

  $("save-audit").onclick = saveCurrentAudit;
  $("clear-history").onclick = clearAllHistory;

  render();
  renderHistory();
  loadModel();
}

window.addEventListener("DOMContentLoaded", init);
