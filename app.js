// EPITA Smart Classroom : audit visuel d'une salle avec COCO-SSD (TensorFlow.js)
const $ = (id) => document.getElementById(id);

// Libellés français des classes COCO-SSD. La classe "person" est volontairement absente :
// les personnes sont écartées dès la détection et ne sont ni affichées ni comptées.
const LABELS = {
  chair: "Chaises",
  "dining table": "Tables et bureaux",
  laptop: "Ordinateurs portables",
  tv: "Écrans",
  couch: "Canapés",
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

// Configuration théorique modifiable. cls = classe COCO-SSD, null = non prise en charge par le modèle.
const rules = [
  { name: "Tables et bureaux", cls: "dining table", expected: 10 },
  { name: "Chaises", cls: "chair", expected: 20 },
  { name: "Ordinateurs portables", cls: "laptop", expected: 5 },
  { name: "Écrans", cls: "tv", expected: 1 },
  { name: "Tableau", cls: null, expected: 1 },
  { name: "Fenêtres", cls: null, expected: 2 },
];

let model = null,
  stream = null,
  snap = null,
  raw = [],
  analysed = false,
  ms = 0;

/* ---------- Modèle ---------- */
function setModel(text, kind) {
  const b = $("model-status");
  b.textContent = text;
  b.className = "badge " + kind;
}

async function loadModel() {
  $("retry").hidden = true;
  setModel("Chargement du modèle...", "wait");
  try {
    //model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    model = await cocoSsd.load({ base: "mobilenet_v2" });
    setModel("Modèle prêt (COCO-SSD)", "ok");
  } catch (e) {
    model = null;
    setModel("Le modèle ne s'est pas chargé. Vérifiez votre connexion.", "err");
    $("retry").hidden = false;
  }
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

/* ---------- Analyse ---------- */
async function analyze(src, w, h) {
  if (!model) return msg("Le modèle n'est pas chargé : analyse impossible.");
  msg("");
  const scale = Math.min(1, 1280 / w);
  snap = document.createElement("canvas"); // copie en mémoire uniquement, jamais enregistrée
  snap.width = Math.round(w * scale);
  snap.height = Math.round(h * scale);
  snap.getContext("2d").drawImage(src, 0, 0, snap.width, snap.height);
  try {
    const t = performance.now();
    const preds = await model.detect(snap, 100, 0.05);
    ms = Math.round(performance.now() - t);
    raw = preds.filter((p) => p.class !== "person"); // aucune analyse des personnes
    analysed = true;
    render();
  } catch (e) {
    msg("Erreur pendant l'analyse : " + e.message);
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

function status(r, n) {
  if (!r.cls)
    return { gap: "-", t: "Non vérifiable (modèle)", c: "na", ecart: false };
  if (!analysed) return { gap: "-", t: "En attente", c: "na", ecart: false };
  const gap = n - r.expected;
  if (gap === 0) return { gap, t: "Conforme", c: "ok", ecart: false };
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

/* ---------- Rendu ---------- */
function draw() {
  const cv = $("out"),
    ctx = cv.getContext("2d");
  if (!snap) return;
  cv.width = snap.width;
  cv.height = snap.height;
  ctx.drawImage(snap, 0, 0);
  const lw = Math.max(2, cv.width / 300),
    fs = Math.max(12, cv.width / 50);
  ctx.lineWidth = lw;
  ctx.font = `bold ${fs}px system-ui`;
  ctx.textBaseline = "top";
  current().forEach((d) => {
    const [x, y, w, h] = d.bbox,
      t = `${label(d.class)} ${Math.round(d.score * 100)}%`;
    ctx.strokeStyle = "#f2c94c";
    ctx.strokeRect(x, y, w, h);
    const tw = ctx.measureText(t).width + 8;
    ctx.fillStyle = "#f2c94c";
    ctx.fillRect(x, y, tw, fs + 6);
    ctx.fillStyle = "#17231f";
    ctx.fillText(t, x + 4, y + 3);
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
            `<tr><td>${label(k)}</td><td>${s.length}</td><td>${Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100)} %</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3">${analysed ? "Aucune détection à ce seuil." : "Aucune analyse pour le moment."}</td></tr>`;

  // Audit
  let ecarts = 0;
  rules.forEach((r, i) => {
    const n = r.cls && c[r.cls] ? c[r.cls].length : 0,
      s = status(r, n);
    r.result = { n: r.cls ? n : "-", ...s };
    if (s.ecart) ecarts++;
    $("det" + i).textContent = r.result.n;
    $("gap" + i).textContent = s.gap;
    $("st" + i).textContent = s.t;
    $("st" + i).className = "st " + s.c;
  });

  // Tableau de bord, calculé à partir des résultats réels
  const verifiables = rules.filter((r) => r.cls).length;
  let global = ["En attente d'analyse", "na"];
  if (analysed)
    global =
      ecarts === 0
        ? ["Conforme sur les catégories vérifiables", "ok"]
        : ["Écarts à contrôler", "warn"];
  const k = (v, l, cls = "") => `<div class="kpi ${cls}"><b>${v}</b>${l}</div>`;
  $("kpis").innerHTML =
    k(dets.length, "objets détectés") +
    k(Object.keys(c).length, "catégories reconnues") +
    k(verifiables, "règles vérifiables") +
    k(ecarts, "écarts observés", ecarts ? "warn" : "") +
    k(global[0], "statut global", global[1]) +
    k(analysed ? ms + " ms" : "-", "durée de l'analyse");
  window.__audit = { dets, c, ecarts, verifiables, global: global[0] };
}

/* ---------- Rapport (généré par règles, sans IA générative) ---------- */
function buildReport() {
  if (!analysed)
    return "Aucune analyse disponible. Capturez ou importez une image d'abord.";
  const { dets, c, ecarts, verifiables, global } = window.__audit;
  const L = [
    "# Rapport d'audit : EPITA Smart Classroom",
    "",
    `Date : ${new Date().toLocaleString("fr-FR")}`,
    "",
    "## Contexte",
    `Audit visuel d'une salle de cours avec le modèle COCO-SSD (TensorFlow.js), exécuté dans le navigateur. Seuil de confiance : ${Math.round(threshold() * 100)} %. Aucune image n'est enregistrée et les personnes ne sont pas analysées.`,
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
  const nonSup = rules.filter((r) => !r.cls).map((r) => r.name);
  L.push(
    "",
    "## Catégories non prises en charge",
    nonSup.length
      ? `${nonSup.join(", ")} : le modèle ne reconnaît pas ces catégories. Aucune détection n'est inventée, un contrôle manuel est nécessaire.`
      : "Aucune.",
  );
  L.push(
    "",
    "## Limites de l'analyse",
    "- Un objet non détecté n'est pas forcément absent (masqué, mal cadré, trop petit, mal éclairé).",
    "- COCO-SSD ne distingue pas une table à manger d'un bureau.",
    "- Une seule image est analysée : elle ne couvre pas toute la salle.",
    "- Un score de confiance élevé n'est pas une garantie d'exactitude.",
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
      "- Refaire l'analyse avec plusieurs cadrages de la salle et une meilleure luminosité.",
    );
  if (rules.some((r) => r.result.ecart && String(r.result.gap).startsWith("+")))
    L.push(
      "- Vérifier les possibles doublons de détection ou ajuster le seuil de confiance.",
    );
  if (nonSup.length) L.push(`- Contrôler visuellement : ${nonSup.join(", ")}.`);
  L.push("- Confirmer les écarts par un comptage manuel avant toute décision.");
  return L.join("\n");
}

/* ---------- Initialisation ---------- */
function init() {
  $("rules").innerHTML = rules
    .map(
      (r, i) => `<tr><td>${r.name}</td>
    <td><input type="number" min="0" value="${r.expected}" data-i="${i}" aria-label="Quantité attendue : ${r.name}"></td>
    <td id="det${i}">-</td><td id="gap${i}">-</td><td id="st${i}" class="st na">-</td></tr>`,
    )
    .join("");
  $("rules").addEventListener("input", (e) => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    rules[i].expected = Math.max(0, parseInt(e.target.value, 10) || 0);
    render();
  });
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
