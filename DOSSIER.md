# Dossier projet : EPITA Smart Classroom

## 1. Besoin métier
**Problématique** : vérifier rapidement que la configuration d'une salle de cours (tables, chaises, ordinateurs, écrans) correspond à ce qui est prévu, sans comptage manuel.
**Objectifs** : fournir un audit visuel assisté par IA, lisible par un responsable non technique, sans stocker d'images.
**Utilisateurs cibles** : responsables logistique et services généraux, équipes pédagogiques.

## 2. Périmètre
**MVP** : détection dans le navigateur (COCO-SSD), caméra ou image de test, seuil réglable, audit attendu/détecté/écart/statut, tableau de bord, rapport par règles, déploiement Cloudflare Pages.
**Exclus** : détection des tableaux et fenêtres (modèle non adapté), entraînement d'un modèle, analyse des personnes, stockage d'images, comptes utilisateurs, IA générative.

## 3. Architecture
Application statique (index.html, style.css, app.js). Le navigateur charge TensorFlow.js et COCO-SSD, capture l'image (caméra ou fichier), exécute la détection localement, puis calcule l'audit et le rapport. Aucun backend. Code sur GitHub, déploiement automatique par Cloudflare Pages (branche `main`, pas de commande de build).

## 4. Backlog
| # | User story | Priorité | Statut |
|---|---|---|---|
| 1 | Créer le dépôt GitHub et le README | Haute | À faire |
| 2 | Page d'accueil et interface | Haute | Fait |
| 3 | Démarrer et arrêter la caméra | Haute | Fait |
| 4 | Détecter les objets avec COCO-SSD | Haute | Fait |
| 5 | Afficher cadres, catégories et scores | Haute | Fait |
| 6 | Seuil de confiance paramétrable | Moyenne | Fait |
| 7 | Configuration attendue modifiable et audit | Haute | Fait |
| 8 | Tableau de bord | Moyenne | Fait |
| 9 | Rapport d'audit téléchargeable | Moyenne | Fait |
| 10 | Déploiement Cloudflare Pages | Haute | À faire |
| 11 | Tests et documentation des limites | Moyenne | À faire |

## 5. KPI
| KPI | Définition | Cible |
|---|---|---|
| Taux de détection | Objets détectés correctement / objets présents sur un jeu de test annoté | 70 % ou plus |
| Temps d'audit | Temps moyen entre l'ouverture de l'application et la génération du rapport | Moins de 3 min |
| Écarts identifiés | Nombre d'écarts par rapport à la configuration théorique | Suivi par audit |

## 6. Tests
| Situation | Résultat attendu | Résultat observé |
|---|---|---|
| Image de salle bien éclairée, mobilier visible | Chaises, tables, portables détectés | À compléter |
| Image sombre ou mobilier partiellement masqué | Détections partielles, écarts signalés "à vérifier" | À compléter |
| Image sans mobilier (paysage) | Aucune détection, aucun objet inventé | À compléter |
| Image avec une personne | La personne n'apparaît ni dans les cadres ni dans les comptes | À compléter |
| Refus d'accès à la caméra | Message clair, import d'image possible | À compléter |
| Modèle non chargé (hors ligne) | Message d'erreur et bouton "Réessayer" | À compléter |

## 7. Risques et limites
| Risque | Impact | Mitigation |
|---|---|---|
| Classes non reconnues (tableau, fenêtres) | Audit incomplet | Affichées "non vérifiables", contrôle manuel |
| Faux négatifs (objets masqués ou petits) | Faux écarts | Statut "à vérifier", plusieurs cadrages |
| Confusion table et bureau | Comptage imprécis | Catégorie unique "Tables et bureaux" |
| Personne dans le champ | Atteinte à la vie privée | Personnes écartées dès la détection, aucune image enregistrée |
| Échec de la caméra ou du modèle | Application inutilisable | Messages d'erreur, import d'image, bouton "Réessayer" |
| CDN indisponible | Modèle non chargé | Versions figées, possibilité d'héberger les scripts |
