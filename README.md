# Battery Reminder

Application web statique pour suivre l'autodécharge de batteries stockées.

## Version

v0.1

## Fonctionnalités incluses

- Structure HTML/CSS/JS
- IndexedDB v1
- Stores `batteries`, `measurements`, `settings`, `metadata`
- Création d'une batterie
- Ajout d'une mesure
- Bouton "Rechargé à 100 %"
- Mesure par pourcentage
- Mesure par LEDs avec slider
- Aperçu LED simple ou avancé avec clignotement
- Calcul de statut basique
- Export JSON manuel

## Fonctionnalités encore à faire

- Import JSON
- Modification / suppression des mesures
- Archivage / suppression des batteries
- Paramètres complets
- Tri configurable
- Page Archives
- Détection et confirmation des mesures aberrantes

## Lancer en local

Avec VS Code, utiliser par exemple l'extension Live Server.

Sinon, ouvrir `index.html` peut fonctionner, mais IndexedDB et les modules JavaScript sont plus fiables avec un petit serveur local.
