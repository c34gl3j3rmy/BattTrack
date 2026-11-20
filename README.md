# BattTrack

![Bannière BattTrack](assets/images/banner.png)

BattTrack est une PWA légère pour suivre les batteries rarement utilisées, estimer leur autodécharge et éviter les décharges profondes.

Elle est pensée pour les batteries que l'on oublie facilement : drone, perceuse, caméra, gonfleur, casque, lampe, accessoires saisonniers, etc.

## Aperçu

![Tableau de bord BattTrack](assets/images/screenshot-dashboard.png)

![Détail d'une batterie](assets/images/screenshot-battery-detail.png)

![Modale de mise à jour](assets/images/screenshot-update-modal.png)

## Fonctionnalités (V2)

- Batteries suivies par pourcentage ou indicateurs LED, recharges à 100 %, archives et graphique 28 jours.
- Chimies Li-ion, LiPo, NiMH, plomb et autre/inconnue.
- Contrôles périodiques, fréquence recommandée selon la chimie et les mesures, personnalisable et jamais imposée.
- Rappels à l'ouverture de l'application (pas de notification garantie quand la PWA est fermée) et report de rappel.
- Journal d'utilisation, avec exclusions des intervalles pour calculer l'autodécharge naturelle.
- Estimation du niveau et de la recharge, fiabilité expliquée, tendance d'autodécharge et tableau de bord.
- Synchronisation bidirectionnelle **Dropbox uniquement**, optionnelle : mode hors ligne, fusion à trois voies et conflits visibles.
- Sauvegardes JSON locales ou Dropbox, restauration transactionnelle, remplacement ou fusion.
- Export CSV global ou par batterie pour Excel.
- Navigation Android, thème clair/sombre/système et PWA utilisable sans compte.

**Attention :** les recommandations de fréquence sont des points de départ indicatifs. Respecter la notice du fabricant, notamment pour les batteries LiPo à entretien automatisé et les consignes de niveau de stockage. Une tendance d'autodécharge ne mesure pas la capacité réelle de la batterie.

## Connexion Dropbox

BattTrack fonctionne **sans Dropbox** avec un stockage IndexedDB local. Pour activer la synchronisation :

1. Créer votre application dans [Dropbox App Console](https://www.dropbox.com/developers/apps), avec accès **App folder**.
2. Dans les permissions, activer `files.content.read`, `files.content.write` et `files.metadata.read`.
3. Autoriser les clients publics OAuth (PKCE) et enregistrer l'URL de redirection **exacte** de la page BattTrack (sans paramètre ou fragment), par exemple `https://<utilisateur>.github.io/BattTrack/` si c'est son URL réelle.
4. Dans BattTrack, ouvrir **Paramètres > Dropbox**, coller la **clé publique de l'application** (App key) et choisir **Connecter Dropbox**.
5. Autoriser l'accès à Dropbox et lancer **Synchroniser maintenant**. Utiliser le même compte sur vos autres appareils.

Aucun secret Dropbox n'est nécessaire dans le dépôt. La clé publique est saisie dans les paramètres du navigateur. L'autorisation utilise OAuth 2.0 avec PKCE et jeton de renouvellement. **La connexion Dropbox exige Internet et l'installation HTTPS ; les données restent locales sans connexion.**

Le stockage du jeton dans le navigateur est exposé aux risques classiques d'une application Web (dont les scripts malveillants). Déconnecter Dropbox sur les appareils partagés et ne pas installer de scripts tiers non maîtrisés. Une politique CSP limite les sources de scripts et les transferts réseau.

**Conflits :** si deux appareils modifient le même élément indépendamment, BattTrack demande quelle version conserver. Les suppressions sont mémorisées pour ne pas réapparaître à la prochaine synchronisation. Les sauvegardes de récupération sont distinctes du fichier de synchronisation Dropbox.

Le premier test de connexion à une véritable application Dropbox nécessite une App key et deux appareils ou sessions distinctes ; les tests unitaires ne remplacent pas cette validation.

## Tester en local

Depuis le dossier du dépôt, avec Node.js 20+ :

```bash
npm test
```

Pour tester la PWA avec IndexedDB et un service worker, utiliser un serveur local HTTPS ou `http://localhost` (pas une ouverture directe `file://`). Contrôler la navigation Android, la migration d'une ancienne base et la synchronisation Dropbox avant mise en production.

La [conception validée](docs/CONCEPTION_V2.md) décrit les décisions et les cas de recette.

## Assets du dépôt

Les visuels du README sont dans `assets/images/`.

| Fichier | Usage |
|---|---|
| `assets/images/banner.png` | Bannière du README |
| `assets/images/screenshot-dashboard.png` | Capture du tableau de bord |
| `assets/images/screenshot-battery-detail.png` | Capture d'une fiche batterie |
| `assets/images/screenshot-update-modal.png` | Capture de la modale de mise à jour |

Les icônes PWA sont dans `assets/`.

| Fichier | Usage |
|---|---|
| `assets/icon-192.png` | Icône PWA 192 px |
| `assets/icon-512.png` | Icône PWA 512 px |
| `assets/icon-192-maskable.png` | Icône Android maskable 192 px |
| `assets/icon-512-maskable.png` | Icône Android maskable 512 px |
| `assets/apple-touch-icon.png` | Icône iOS |
| `assets/favicon.png` | Favicon |
| `assets/logo.png` | Logo de l'application |

## Mises à jour

BattTrack vérifie la dernière version publiée dans les GitHub Releases.

Lorsqu'une version plus récente existe, l'application affiche :

`Mises à jour disponibles : v2.0.0`

Le bouton d'action ouvre la page de Release GitHub correspondante pour consulter le détail complet des nouveautés.

## Publier une nouvelle version

1. Mettre à jour la version locale dans `js/constants.js`.
2. Publier une nouvelle GitHub Release avec un tag du type `v1.5.0`.
3. L'application détecte automatiquement cette Release comme dernière version disponible.

## Version actuelle

v2.0.0 (version candidate à tester avant publication)

## Changements récents

- Mesures avec date et heure.
- Historique trié par date et heure.
- Modification possible de l'heure d'une mesure.
- Graphique avec repères 100 %, 50 % et 0 %.
- Graphique coloré selon les seuils.
- Correction du mode LED.
- Correction du démarrage de l'application après refactorisation des modules.
- Vérification des mises à jour via les GitHub Releases.

## Structure du projet

- `assets/` : icônes PWA, logo et visuels.
- `assets/images/` : bannière et captures d'écran du README.
- `assets/icons/` : icônes internes de l'application.
- `css/` : styles et variables graphiques.
- `js/` : logique de l'application.
- `index.html` : point d'entrée.
- `manifest.json` : configuration PWA.
- `service-worker.js` : cache et installation PWA.

## Données

Les données sont stockées localement via IndexedDB. Dropbox est entièrement facultatif ; aucun serveur applicatif n'est requis.

Les sauvegardes et importations doivent être vérifiées avec les anciennes données avant mise à jour.

## GitHub

- Projet : https://github.com/c34gl3j3rmy/BattTrack
- Releases : https://github.com/c34gl3j3rmy/BattTrack/releases
- Signaler un bug : https://github.com/c34gl3j3rmy/BattTrack/issues/new?labels=bug
- Proposer une amélioration : https://github.com/c34gl3j3rmy/BattTrack/issues/new?labels=enhancement

## Licence

Code source disponible sur GitHub.
