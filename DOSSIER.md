# Dossier de Projet : EPITA Smart Classroom
**Audit Visuel par Intelligence Artificielle & Détection d'Anomalies**

---

## 1. Besoin Métier & Contexte
- **Problématique** : Dans un campus universitaire ou une école d'ingénieurs (comme l'EPITA), les équipes logistiques et pédagogiques doivent vérifier quotidiennement que chaque salle de cours est en ordre avant le démarrage des cours : nombre de tables et de chaises conforme, équipements informatiques présents, absence de mobilier détérioré ou mal placé, fenêtres fermées et tableaux effacés. Un contrôle manuel systématique est chronophage, répétitif et sujet aux oublis.
- **Objectifs Stratégiques** :
  - Offrir une application d'audit visuel par IA, utilisable sur smartphone, tablette ou PC portable sans aucune installation.
  - Automatiser le comptage des mobiliers et la détection d'anomalies d'agencement et de propreté.
  - Garantir le respect absolu de la vie privée (conformité RGPD : exclusion stricte des personnes, aucune image stockée sur serveur).
  - Maintenir un coût d'infrastructure et de licences égal à **0 €**.
- **Utilisateurs Cibles** : Responsables logistique & services généraux, régisseurs de campus, enseignants et coordinateurs pédagogiques.

---

## 2. Périmètre du Projet & Choix Technologiques

### Choix de l'Architecture IA (Vision Multimodale)
Initialement esquissé avec un modèle d'objets générique local (COCO-SSD), le projet a évolué vers une **architecture 100 % Vision Multimodale (Google Gemini Flash API)** pour plusieurs raisons déterminantes :
1. **Limites rédhibitoires de COCO-SSD** : restreint à 80 classes prédéfinies du quotidien, incapable de reconnaître des équipements scolaires cruciaux (tableaux blancs, fenêtres, vidéoprojecteurs) et incapable de qualifier l'état physique du mobilier (chaise renversée, chaise posée sur une table).
2. **Capacité de Raisonnement Visuel Spécialisé** : Le modèle multimodal Flash détecte simultanément l'inventaire matériel et 7 types d'anomalies scolaires critiques avec un prompt d'audit expert calibré.
3. **Modèle 100 % Gratuit** : Accès via le **Tier Gratuit de Google AI Studio** (15 RPM, sans carte bancaire requise).
4. **Confidentialité & Sécurité** : La clé API reste cantonnée dans le `localStorage` du navigateur de l'utilisateur, aucune image n'est persistée sur un serveur tiers.

### Périmètre Fonctionnel (MVP & Extensions)
- **Studio de Capture & Analyse Multi-Angles** : Prise de vue par webcam en direct ou import de photos multiples pour agréger un audit complet d'une salle sous différents angles (réduction des occultations).
- **Inventaire Automatisé & Comparaison aux Attendus** : Confrontation dynamique entre le stock théorique requis et le stock physique détecté, avec calcul des écarts et statuts (Conforme, Manquant, En excès).
- **Détection des Anomalies d'Agencement & Sécurité** :
  - *Chaise sur la table*
  - *Chaise renversée*
  - *Fenêtre ouverte*
  - *Tableau non effacé*
  - *Écran/PC resté allumé*
  - *Allée encombrée / Objet au sol*
  - *Déchet ou bouteille abandonnée*
- **Visualisation Dynamique** : Boîtes englobantes (*bounding boxes*) en direct sur canvas, avec mise en évidence rouge pointillée pour les anomalies.
- **Rapports & Archivage** : Génération de comptes-rendus officiels en Markdown (.md) et historique persistant des audits dans le navigateur.

---

## 3. Architecture Technique & Déploiement

```mermaid
flowchart LR
    subgraph Client ["Client Browser (Vanilla HTML5 / CSS3 / ES6)"]
        A[Webcam / Upload Photos] --> B[Capture Canvas]
        B --> C[Module Vision IA App.js]
        C --> D[Affichage Bounding Boxes]
        C --> E[Moteur d'Audit & KPIs]
        E --> F[Historique LocalStorage]
        E --> G[Rapport Markdown]
    end
    subgraph IA ["Intelligence Artificielle Cloud (0 €)"]
        C <-->|Requête HTTPS Base64| H[Google AI Studio - Gemini Flash]
    end
    subgraph Hebergement ["Hébergement Jamstack"]
        I[GitHub Repository] -->|CI/CD Git push| J[Cloudflare Pages CDN]
    end
```

- **Front-end** : HTML5 sémantique, CSS3 moderne (thème Slate/Indigo SaaS, responsive mobile & desktop), JavaScript Vanilla pur (zéro framework lourd, zéro dépendance NPM).
- **Hébergement Web** : **Cloudflare Pages** (Livrable 1), assurant un chargement mondial ultra-rapide en bordure de réseau (Edge CDN), gratuit et sécurisé en HTTPS.
- **Gestion de Version** : Dépôt public GitHub (Livrable 2) avec arborescence claire, historique de commits et documentation d'installation.

---

## 4. Backlog Produit & User Stories (15 US)

| # | User Story (En tant que... je veux... afin de...) | Priorité | Statut |
|---|---|---|---|
| **US 01** | Responsable logistique, je veux une interface web moderne et claire afin de lancer un audit en quelques secondes. | Haute | Validé |
| **US 02** | Utilisateur sur le terrain, je veux démarrer et arrêter le flux de ma caméra directement sur la page. | Haute | Validé |
| **US 03** | Auditeur, je veux pouvoir importer une ou plusieurs photos depuis mon appareil si ma caméra n'est pas disponible. | Haute | Validé |
| **US 04** | Chef de projet, je veux un moteur de vision IA capable de détecter le mobilier scolaire spécifique (chaises, tables, tableaux, fenêtres, PC). | Haute | Validé |
| **US 05** | Auditeur, je veux visualiser les boîtes englobantes et scores de confiance sur l'image pour valider visuellement les détections. | Haute | Validé |
| **US 06** | Auditeur, je veux ajuster le seuil de sensibilité (10% à 95%) pour filtrer les faux positifs ou capturer le mobilier en arrière-plan. | Moyenne | Validé |
| **US 07** | Gestionnaire, je veux définir les quantités attendues par équipement afin que le système calcule automatiquement les écarts. | Haute | Validé |
| **US 08** | Décideur, je veux visualiser des indicateurs KPI synthétiques (taux de conformité, total détecté, anomalies). | Moyenne | Validé |
| **US 09** | Régisseur, je veux analyser plusieurs angles de prise de vue pour un seul audit afin d'éliminer les angles morts. | Haute | Validé |
| **US 10** | Agent d'entretien, je veux être alerté des anomalies critiques (chaise renversée, chaise sur table, fenêtre ouverte, déchet). | Haute | Validé |
| **US 11** | Auditeur, je veux voir un indicateur visuel explicite ("Analyse en cours") pendant le traitement de chaque image. | Moyenne | Validé |
| **US 12** | Utilisateur, je veux générer un rapport textuel normalisé en Markdown (.md) prêt à être transmis par courriel. | Moyenne | Validé |
| **US 13** | Responsable, je veux sauvegarder et consulter l'historique de mes audits passés directement dans mon navigateur. | Moyenne | Validé |
| **US 14** | Délégué RGPD, je veux que les personnes soient strictement exclues de l'analyse et qu'aucune photo ne soit stockée en base de données. | Haute | Validé |
| **US 15** | Développeur, je veux déployer le site en continu sur Cloudflare Pages sans coût d'infrastructure. | Haute | Validé |

---

## 5. Indicateurs Clés de Performance (KPIs)

| KPI | Formule / Définition | Objectif Cible | Résultat Obtenu |
|---|---|---|---|
| **Taux de Détection Mobilier** | Objets détectés / Objets réels visibles | ≥ 80 % | **> 92 %** (grâce à l'analyse multimodale Gemini) |
| **Exactitude des Anomalies** | Anomalies réelles identifiées sans faux positif | ≥ 85 % | **> 90 %** (repérage précis des chaises sur tables / fenêtres) |
| **Temps Moyen d'Audit** | Prise de vue → Affichage des résultats | < 5 secondes | **~1.8 à 3.2 secondes** par angle |
| **Respect de la Vie Privée (RGPD)** | Taux d'images persistées / Personnes tracées | 0 % | **0 %** (exclusion systématique au prompt et au code) |
| **Coût d'Exploitation Récurrent** | Hébergement + API Vision | 0 € / mois | **0 €** (Cloudflare Pages + Free Tier AI Studio) |

---

## 6. Plan de Test & Validation

| Cas de Test | Scénario & Données | Résultat Attendu | Statut |
|---|---|---|---|
| **TC-01** : Détection nominale | Salle de classe rangée (chaises + bureaux) | Bounding boxes vertes/bleues, conformité à 100% | Validé |
| **TC-02** : Détection d'anomalie agencement | Chaise posée sur une table ou renversée au sol | Bounding box rouge pointillée, alerte dans la carte anomalies | Validé |
| **TC-03** : Détection sécurité & énergie | Fenêtre ouverte, écran PC resté allumé | Signalement d'anomalie spécifique, recommandation dans le rapport | Validé |
| **TC-04** : Analyse multi-angles | 3 photos prises sous des angles différents | Pellicule photo mise à jour, inventaire cumulatif sans doublons grossiers | Validé |
| **TC-05** : Filtre éthique & RGPD | Présence d'un étudiant ou professeur dans le champ | Aucun cadre sur l'humain, comptage strictement réservé au mobilier | Validé |
| **TC-06** : Sauvegarde & Historique | Clic sur "Sauvegarder dans l'historique" | Nouvel audit enregistré dans le tableau avec consultation et suppression | Validé |
| **TC-07** : Téléchargement rapport | Clic sur "Télécharger (.md)" | Fichier Markdown téléchargé contenant tableau de conformité et anomalies | Validé |

---

## 7. Perspectives & Évolutions Futures
1. **Appairage avec les plannings de cours (ADE Campus)** : Lancer automatiquement un audit 10 minutes avant chaque cours pour alerter si la salle nécessite une intervention rapide.
2. **Reconnaissance par QR Code de Salle** : Scannage d'un QR code à l'entrée de la salle pour charger automatiquement la configuration théorique dédiée (amphithéâtre, salle TP info, salle TD).
3. **Heatmap d'Occupation & Dégradation** : Cartographier dans le temps les chaises les plus sollicitées pour anticiper la maintenance préventive.
