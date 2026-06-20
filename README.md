# Battery Reminder

Application web statique pour suivre l'autodécharge de batteries stockées.

## Version

v0.5

## Objectif

Aider à éviter les décharges profondes des batteries rarement utilisées en estimant leur autodécharge et en affichant un statut visuel.


## Changements v0.5

- Ajout du mode PWA installable
- Ajout des icones PWA `icon-192.png` et `icon-512.png`
- Ajout de `apple-touch-icon.png` et `favicon.png`
- Ajout de `service-worker.js`
- Enregistrement automatique du service worker dans `js/app.js`
- Cache hors ligne de l'application de base

## PWA

Pour que Chrome propose l'installation de l'application, le projet contient :

- `manifest.json` avec `name`, `short_name`, `start_url`, `scope`, `display`, `theme_color` et les icones
- `assets/icon-192.png`
- `assets/icon-512.png`
- `service-worker.js`
- l'enregistrement du service worker dans `js/app.js`

L'installation PWA fonctionne correctement une fois l'application servie en HTTPS, par exemple avec GitHub Pages.

Après une mise à jour du service worker, Chrome peut garder l'ancienne version en cache. En cas de doute, ouvrir DevTools > Application > Service Workers puis faire `Update` ou vider les données du site.

## Fonctionnalités incluses

- IndexedDB pour le stockage local
- Création, modification, archivage, restauration et suppression définitive de batteries
- Ajout, modification et suppression de mesures
- Mesures en pourcentage
- Mesures par LEDs fixes
- Mesures par LEDs fixes + clignotantes
- Slider LED bidirectionnel : le slider modifie le pourcentage, et le pourcentage modifie les LEDs
- Bouton `+` contextuel selon la page
- Page `🔋 Batteries`
- Page `📦 Archives`
- Menu `⚙️ Paramètres`
- Export JSON
- Import JSON avec remplacement des données
- Tableau de bord avec batteries actives et archivées
- Tri depuis le tableau de bord et la page Batteries
- Historique avec perte en `%/j` par rapport à la mesure précédente
- Affichage relatif des dates, par exemple `il y a 34 j`

## Logique du bouton `+`

| Page | Action |
|---|---|
| 🏠 Tableau de bord | Ajouter une mesure en choisissant la batterie |
| 🔋 Batteries | Créer une batterie |
| 🔋 Fiche batterie active | Ajouter mesure, rechargé à 100 %, modifier, archiver |
| 📦 Archives | Supprimer définitivement une batterie archivée |
| 📦 Fiche batterie archivée | Restaurer ou supprimer définitivement |
| ⚙️ Paramètres | Bouton masqué |

## Paramètres

- 🟠 Seuil d'alerte (%)
- 🔴 Seuil critique (%)
- 📅 Préalerte en jours avant l'échéance estimée

## Fonctionnalités futures validées ou envisagées

- Notifications PWA
- Paramètres d'affichage avancés
- Graphique d'autodécharge
- Détection plus robuste des mesures aberrantes
- Confirmation spécifique pour les mesures atypiques
- Sauvegarde cloud optionnelle
- Synchronisation multi-appareils
- QR Code ou NFC par batterie
- Mode installation téléphone plus poussé

## Notes techniques

- Application statique compatible GitHub Pages
- Pas de serveur requis
- Données stockées dans IndexedDB, donc propres à chaque navigateur/appareil
- Ouvrir via GitHub Pages ou un serveur local. Ne pas ouvrir `index.html` directement en `file://`, car les modules JavaScript ES6 peuvent être bloqués.
