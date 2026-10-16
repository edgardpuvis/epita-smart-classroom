# EPITA Smart Classroom

Application web d'audit visuel d'une salle de cours : détection du mobilier et des équipements, audit multi-angles, comparaison avec une configuration attendue, tableau de bord en temps réel, rapport d'audit téléchargeable et historique persistant.

**URL publique :** `https://epita-smart-classroom-87u.pages.dev/`

---

## Technologies

- **Frontend** : HTML5 sémantique, CSS3 moderne (design cockpit SaaS responsive), JavaScript ES6 Vanilla.
- **Hébergement & CI/CD** : Dépôt GitHub + déploiement continu sur **Cloudflare Pages** (statique, zéro build).
- **Moteurs d'IA** :
  1. **COCO-SSD optimisé (Navigateur)** : TensorFlow.js avec MobileNet v2, 100% exécuté localement dans le navigateur (0 serveur, 0 coût, respect total de la confidentialité).
  2. **Vision Avancée Gemini Flash (Optionnel & Gratuit)** : Connecteur API vers Google Gemini Flash (Tier gratuit Google AI Studio, sans carte bancaire requise) pour lever les verrous technologiques (tableaux et fenêtres).

---

## Fonctionnalités Clés

- **Capture & Studio de Vision** : Caméra temps réel ou importation de photos (support du multi-fichiers simultané).
- **Audit Multi-Angles (Multi-Images)** : Possibilité de photographier la salle sous plusieurs angles (avant, fond, fenêtres) pour un seul et même audit. Les détections sont cumulées et comparées à la cible globale.
- **Pellicule interactive** : Galerie de vignettes permettant de naviguer entre les différentes prises de vue et de visualiser les boîtes englobantes de chaque angle.
- **Audit de configuration** : Distingue les quantités attendues, détectées au total, les écarts observés et les statuts de conformité.
- **Tableau de bord KPI** : Indicateurs en temps réel (total objets cumulés, catégories reconnues, angles analysés, écarts observés, statut global).
- **Compte-rendu d'audit** : Générateur de rapport complet avec détail par angle de prise de vue, téléchargeable en Markdown (`.md`).
- **Historique des audits** : Sauvegarde locale persistante (`localStorage`) des audits réalisés avec consultation rapide, export et gestion des archives.
- **Éthique & RGPD** : Exclusion formelle de toute analyse ou reconnaissance humaine.

---


## Lancement en local

La caméra exige un contexte sécurisé (`localhost` ou `HTTPS`).

```bash
# Avec Python
python -m http.server 8000

# Ou avec Node.js
npx serve .
```

Puis ouvrir `http://localhost:8000`.
