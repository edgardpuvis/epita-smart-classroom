# EPITA Smart Classroom

Application web d'audit visuel d'une salle de cours : détection du mobilier et des équipements, comparaison avec une configuration attendue, tableau de bord en temps réel et rapport d'audit téléchargeable.

**URL publique :** `https://epita-smart-classroom-87u.pages.dev/`

---

## Technologies
- **Frontend** : HTML5, CSS3 responsive, JavaScript ES6 (sans framework, sans étape de build).
- **Hébergement & CI/CD** : Dépôt GitHub + déploiement continu sur **Cloudflare Pages**.
- **Moteurs d'IA** :
  1. **COCO-SSD optimisé (Navigateur)** : TensorFlow.js avec MobileNet v2, 100% exécuté localement dans le navigateur client (0 serveur, 0 coût, respect total de la confidentialité).
  2. **Vision Avancée Gemini Flash (Optionnel & Gratuit)** : Connecteur API vers Google Gemini 1.5 Flash (Tier gratuit Google AI Studio, 15 req/min, sans carte bancaire requise) permettant de lever les limites du modèle embarqué pour détecter les tableaux et fenêtres.

---

## Lancement en local
La caméra exige un contexte sécurisé (`localhost` ou `HTTPS`).
```bash
# Avec Python
python -m http.server 8000

# Ou avec Node.js (npx serve)
npx serve .
```
Puis ouvrir `http://localhost:8000`.

---

## Fonctionnalités
- **Capture** : Caméra en direct (démarrer/arrêter) ou import d'image de test.
- **Double Moteur IA** :
  - *COCO-SSD optimisé* : détection locale, seuil de confiance abaissé à 30% pour capturer le mobilier lointain ou en rangées, mapping intelligent des classes (`chair` + `bench`, `dining table` + `desk`).
  - *Vision Avancée Gemini Flash* : analyse multimodale exhaustive avec boîtes englobantes, incluant les tableaux et fenêtres.
- **Affichage visuel** : Cadres de détection avec code couleur distinct par catégorie et libellés français.
- **Audit de configuration** : Comparaison interactif entre configuration attendue et objets détectés (calcul des écarts, statuts de conformité).
- **Tableau de bord KPI** : Objets détectés, catégories reconnues, règles vérifiables, écarts observés, durée d'analyse et statut global.
- **Rapport d'audit** : Génération instantanée et export téléchargeable en format Markdown (`.md`).
- **Respect strict de la vie privée** : Exclusion stricte de toute analyse, reconnaissance ou comptage de personnes.

---

## Limites connues & Gestion des risques
- En mode local COCO-SSD, les tableaux et fenêtres sont indiqués comme "non vérifiables" par le modèle et nécessitent un contrôle visuel manuel.
- Le mode Vision Avancée permet de vérifier l'ensemble de la salle gratuitement via une clé API Google AI Studio stockée uniquement dans le navigateur.
- Une seule prise de vue ne couvre pas 100% d'une salle : un statut "Écart : à vérifier" est systématiquement appliqué plutôt que de déclarer un objet manquant.
