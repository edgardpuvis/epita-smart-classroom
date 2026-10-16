# Dossier projet : EPITA Smart Classroom

## 1. Besoin métier
- **Problématique** : Vérifier rapidement et efficacement que la configuration d'une salle de cours (tables, chaises, ordinateurs, écrans, tableaux) correspond au standard attendu, sans inventaire ni comptage manuel fastidieux.
- **Objectifs** :
  - Fournir un audit visuel assisté par intelligence artificielle, simple d'utilisation et lisible par un responsable non technique.
  - Garantir le respect absolu de la vie privée (aucune capture de visage, aucune image enregistrée ni persistée).
  - Éviter tout coût d'infrastructure récurrent.
- **Utilisateurs cibles** : Responsables logistique & services généraux, régisseurs de campus, équipes pédagogiques.

---

## 2. Périmètre du projet & Choix technologiques

### MVP (Conforme aux exigences d'examen)
- **Modèle de vision local** : TensorFlow.js avec COCO-SSD (MobileNet v2), 100% exécuté côté navigateur client.
- **Interface & Capture** : Prise de vue via webcam (flux direct) ou téléversement d'image de test.
- **Paramétrage** : Seuil de confiance ajustable (calibré par défaut à 30 % pour compenser les chaises en arrière-plan).
- **Moteur d'audit** : Comparaison interactif configuration théorique vs observée, distinction attendu/détecté/écart/statut.
- **Tableau de bord** : Synthèse instantanée avec KPI calculés en temps réel.
- **Rapport d'audit** : Synthèse d'audit téléchargeable au format Markdown (.md).

### Extension avancée (Vision Multimodale Gratuite)
- Pour pallier les limites intrinsèques de COCO-SSD (incapacité à détecter tableaux et fenêtres), intégration d'un connecteur vers l'API **Google Gemini 1.5 Flash**.
- **Coût : 0 €** via le Tier gratuit de Google AI Studio (jusqu'à 15 requêtes/minute sans carte bancaire requise).
- Clé stockée exclusivement dans le `localStorage` de l'utilisateur.

### Fonctionnalités formellement exclues
- Analyse, biométrie ou reconnaissance faciale des personnes.
- Stockage d'images sur un serveur ou une base de données.
- Entraînement d'un modèle lourd depuis zéro (hors périmètre d'un MVP en 4h).

---

## 3. Architecture technique
- **Front-end statique** : HTML5 sémantique, CSS3 moderne (variables, flexbox/grid), JavaScript Vanilla ES6.
- **Inférence IA** :
  - *Option Locale* : Inférence client-side via WebGL/WASM (TensorFlow.js + COCO-SSD).
  - *Option Étendue* : Appel REST HTTPS vers l'API Gemini 1.5 Flash avec payload JSON et réponse structurée.
- **Hébergement & Déploiement** : Dépôt GitHub versionné, connecté en déploiement continu à **Cloudflare Pages** (branche `main`, déploiement statique instantané sans build).

---

## 4. Backlog produit
| # | User Story / Tâche | Priorité | Statut |
|---|---|---|---|
| 1 | Initialisation du dépôt GitHub et du README | Haute | Fait |
| 2 | Interface utilisateur responsive et charte graphique | Haute | Fait |
| 3 | Intégration du flux webcam (démarrer/arrêter/capturer) | Haute | Fait |
| 4 | Intégration du modèle COCO-SSD dans le navigateur | Haute | Fait |
| 5 | Affichage dynamique des cadres (bounding boxes), catégories et scores | Haute | Fait |
| 6 | Seuil de confiance paramétrable avec réactivité en temps réel | Moyenne | Fait |
| 7 | Gestion des configurations théoriques modifiables et calcul des écarts | Haute | Fait |
| 8 | Tableau de bord synthétique avec KPI opérationnels | Moyenne | Fait |
| 9 | Génération et téléchargement du rapport d'audit | Moyenne | Fait |
| 10 | Optimisation du modèle local (seuil à 30%, alias bancs/bureaux/écrans) | Haute | Fait |
| 11 | Connecteur Vision Avancée Gemini Flash (Tier gratuit) | Moyenne | Fait |
| 12 | Déploiement continu sur Cloudflare Pages et tests de validation | Haute | À finaliser |

---

## 5. KPI du projet
| KPI | Définition | Cible | Résultat observé |
|---|---|---|---|
| **Taux de détection** | Objets correctement reconnus / Objets réels visibles | ≥ 70 % | ~75% avec COCO-SSD optimisé à 30% / >95% avec Gemini Flash |
| **Temps moyen d'audit** | Durée entre la prise de vue et l'affichage du rapport | < 3 min | Moins de 10 secondes |
| **Suivi des écarts** | Nombre d'anomalies détectées par rapport à la consigne | Métrique continue | Calculé dynamiquement dans le tableau de bord |
| **Respect de la vie privée** | Taux d'images persistées ou personnes analysées | 0 % | 0 % (exclusion systématique côté client) |

---

## 6. Cahier de tests & Validation
| Situation testée | Comportement attendu | Résultat obtenu |
|---|---|---|
| Salle standard bien éclairée | Détection des chaises, tables et ordinateurs | Conforme : détections stables avec seuil à 30 % |
| Salle avec chaises en rangées serrées | Risque de détection partielle (occlusion) | Conforme : seuil abaissé permettant d'attraper les chaises au second plan |
| Salle avec tableau blanc et fenêtres | Indication "Non vérifiable" en local / Détecté en mode Gemini | Conforme : transparence totale du modèle |
| Présence d'une personne dans le champ | Aucun cadre, aucune identification, comptage exclu | Conforme : filtre strict `class !== 'person'` |
| Refus de permission caméra | Message d'explication et bascule vers l'import d'image | Conforme : ergonomie préservée |
| Perte de connexion réseau | Modèle local reste opérationnel si mis en cache | Conforme (modèle dans le navigateur) |

---

## 7. Analyse des risques & Mitigations
| Risque identifié | Niveau d'impact | Solution & Mitigation mise en œuvre |
|---|---|---|
| **Limites des classes COCO** (pas de tableau/fenêtre) | Élevé | Affichage explicite "Non vérifiable", contrôle manuel recommandé, option connecteur Gemini gratuit pour lever le verrou. |
| **Faux négatifs dus aux occultations** (chaises sous les tables) | Moyen | Seuil par défaut ramené de 50% à 30% ; statut prudent "Écart : à vérifier" plutôt qu'affirmation d'absence. |
| **Confusion entre table et bureau** | Faible | Agrégation dans une catégorie commune "Tables et bureaux" et prise en compte des alias (`dining table`, `desk`). |
| **Atteinte à la vie privée** | Critique | Aucune image envoyée ni enregistrée sur serveur ; filtrage strict de la classe humaine. |
| **Indisponibilité du CDN externe** | Moyen | Versions de bibliothèques figées (`@4.22.0`, `@2.2.3`) et bouton de tentative de rechargement. |
