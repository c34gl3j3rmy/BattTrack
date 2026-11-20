# BattTrack V2 — Cahier des charges et conception finale

**Date :** 20 novembre 2026  
**Statut :** conception prête pour validation avant GO  
**Base examinée :** archive `BattTrack-main.zip`, commit `5791558c`  
**Dépôt :** `c34gl3j3rmy/BattTrack` — branche **main uniquement**  
**Règle :** aucune génération, modification ou publication de code sans GO explicite.

## 1. Objectif et périmètre

Moderniser BattTrack sans repartir de zéro : préserver la saisie de batteries et mesures, les modes pourcentage/LED, les recharges à 100 %, l'archivage, les courbes, les calculs d'autodécharge, les alertes, le mode hors ligne et l'import/export JSON. Corriger les incohérences de navigation, calculs et sauvegardes avant d'ajouter les fonctions.

Dix fonctionnalités supplémentaires retenues : rappels personnalisés, tendance d'autodécharge, journal d'utilisation, prochain contrôle, fiabilité expliquée, tableau de bord synthétique, Dropbox, état de synchronisation, restauration/fusion sécurisée et export CSV.

**Hors périmètre :** Supabase, Firebase, serveur personnel obligatoire, notifications garanties lorsque l'application est fermée, mesure directe de l'état de santé (SoH), connexion automatique aux appareils de mesure, partage entre comptes Dropbox différents.

## 2. Décisions validées (D01 à D11)

| Réf. | Décision définitive |
|---|---|
| D01 | Rappels dans BattTrack lors de son ouverture, sans serveur. |
| D02 | Fréquence globale de contrôle personnalisable par batterie. |
| D03 | Événement « Utilisation » distinct dans l'historique et case d'exclusion existante conservée. |
| D04 | Date de prochain contrôle = échéance la plus proche entre fréquence et franchissement prévisionnel suffisamment fiable. |
| D05 | Synchronisation bidirectionnelle Dropbox avec détection/résolution des conflits. |
| D06 | Restauration par remplacement ou fusion après prévisualisation. |
| D07 | Synchronisation automatique temporisée après modification et commande manuelle. |
| D08 | Tendance de l'autodécharge expliquée, sans pourcentage artificiel de santé. |
| D09 | Chimies Li-ion, LiPo, NiMH, plomb, autre/inconnue. |
| D10 | Recommandation de fréquence qui évolue selon l'historique propre à chaque batterie. |
| D11 | BattTrack propose ; l'utilisateur accepte ou personnalise ; jamais de changement silencieux. |

Décisions complémentaires confirmées : **GitHub `main` uniquement**, **Dropbox uniquement**, IndexedDB comme stockage local principal.

## 3. Recommandations intelligentes de contrôle

### 3.1 Informations à ajouter à la fiche batterie

- **Obligatoire à la création ou à la première modification V2 :** chimie (Li-ion, LiPo, NiMH, plomb, autre/inconnue), avec possibilité « Je ne sais pas ».
- **Facultatif :** marque/modèle, appareil associé, conditions de stockage (normal/chaud), batterie avec électronique ou auto-décharge contrôlée, indication fabricant sur entretien, niveau de stockage cible et seuil de prudence *si connus*.
- Préférences : fréquence globale, fréquence choisie pour la batterie, mode « recommandée acceptée » ou « personnalisée », date de dernier contrôle effectivement réalisé.
- Les anciennes batteries restent utilisables avec chimie « inconnue » ; aucune migration ne doit forcer une saisie immédiate.

### 3.2 Proposition de départ, lorsque le modèle exact n'est pas renseigné

Ce sont des **valeurs de départ conservatrices et modifiables**, et non des normes universelles :

| Chimie | Intervalle initial proposé | Particularité à expliciter |
|---|---:|---|
| LiPo | 30 jours | Tenir compte des fonctions d'auto-décharge de certaines batteries de drone ; ne pas recommander systématiquement une recharge à 100 % pour stockage. |
| Li-ion | 60 jours | Raccourcir en cas d'électronique consommant de l'énergie ou de stockage défavorable. |
| NiMH | 60 jours | Une NiMH à faible autodécharge peut justifier des contrôles moins fréquents, après confirmation ou mesures. |
| Plomb | 30 jours | Contrôle plus rapproché en environnement chaud ; le type et l'état de la batterie peuvent changer la recommandation. |
| Autre/inconnue | 30 jours | Valeur provisoire clairement indiquée ; pas de conseil de recharge spécifique sans identification. |

La documentation du fabricant, quand elle est connue, a priorité sur ces valeurs. Les seuils en pourcentage ne sont **pas** automatiquement comparables entre chimies ou dispositifs ; les voyants LED sont souvent approximatifs. Aucune consigne dangereuse de charge ou décharge ne doit être déduite d'une simple catégorie.

### 3.3 Adaptation à partir des mesures

1. Construire les **intervalles admissibles** entre deux mesures successives : exclure ceux comprenant une utilisation, une recharge ou un marquage `excludeFromPrevious` ; conserver les mesures sources.
2. Calculer les durées à partir des horodatages réels ; écarter les durées nulles, variations manifestement incohérentes et remontées de niveau inexpliquées ; afficher les anomalies plutôt que les transformer en 0 %/jour.
3. Estimer le taux d'autodécharge à partir des **variations des intervalles admissibles**, sans mélanger artificiellement des portions de cycles différents dans une seule régression.
4. Qualifier le résultat selon le nombre d'intervalles, leur durée, leur cohérence et la précision de la méthode (pourcentage/LED). Une estimation provenant d'un unique intervalle reste de faible confiance.
5. Recommander de raccourcir le contrôle si le risque augmente. Recommander de l'espacer **seulement après plusieurs périodes cohérentes**, dans des limites de prudence et de notice fabricant. Ne pas augmenter la fréquence d'une batterie « autre/inconnue » sur un simple historique court.
6. Afficher la recommandation, la différence avec la fréquence retenue et **une justification lisible** : « 30 jours recommandés, car la perte constatée est supérieure à celle des mois précédents ».
7. Proposer **Accepter la recommandation** ou **Conserver ma fréquence** ; une fréquence personnalisée n'est jamais remplacée sans choix explicite.

**Exemple de non-régression :** mesures de 87 % puis 85 % espacées d'environ quatre jours, suivies de 76 % avec exclusion de l'intervalle précédent. La baisse 87 → 85 reste exploitable, la chute 85 → 76 est exclue et la mesure à 76 % reste la référence de la projection. Si la base statistique est insuffisante, afficher le dernier niveau mesuré, pas « ≈ ? » ou une perte fictive de 0,000 %/jour.

### 3.4 Prochain contrôle, alertes et tendances

- **Échéance périodique :** dernière mesure de contrôle + fréquence effectivement choisie.
- **Échéance prédictive :** date avant un seuil de prudence *pertinent et renseigné*, avec marge de sécurité ; utilisée uniquement si la confiance est suffisante.
- **Prochain contrôle :** la première échéance des deux ; si la date est dépassée, statut « À contrôler maintenant ».
- Un événement d'utilisation seul ne prouve pas qu'une nouvelle mesure a été faite et ne réinitialise pas automatiquement la date du dernier contrôle.
- Les rappels sont présentés à l'ouverture et à la reprise de la PWA. Pas de garantie de notification si elle reste fermée.
- La **tendance de l'autodécharge** compare des périodes pertinentes ; elle peut être « stable », « en hausse », « en baisse » ou « insuffisamment documentée ». Ne jamais afficher de pseudo-SoH en %.

## 4. Parcours et écrans à conserver ou créer

### Tableau de bord

Conserver les cartes minimalistes (icône de batterie existante), le tri, les filtres et le bouton d'action. Ajouter un résumé compact : à contrôler, en retard, à recharger, prochain contrôle et synchronisation. Ne pas encombrer les cartes d'icônes supplémentaires.

### Fiche batterie

En-tête, dernière mesure, estimation si disponible, niveau de fiabilité et motif, prochain contrôle et motif, fréquence retenue, recommandation facultative, tendance d'autodécharge, graphique 28 jours et historique unifié. Les intervalles exclus sont visibles sur le graphique. Actions : mesurer, recharger, signaler une utilisation, modifier, archiver.

### Ajouter / modifier une batterie

Reprendre les champs existants, ajouter chimie, réglages de contrôle et caractéristiques de stockage facultatives. Expliquer les recommandations sans rendre le formulaire complexe.

### Historique unifié

Une seule chronologie avec « Mesure », « Recharge 100 % » et « Utilisation ». La case « Batterie utilisée depuis la dernière mesure » reste sur le formulaire de mesure. Si un événement d'utilisation se situe entre deux mesures, l'intervalle correspondant est exclu. Modifier/supprimer un événement déclenche un recalcul reproductible.

### Paramètres / Données et Dropbox

Préférences générales, thème, seuils, fréquence par défaut, connexion/déconnexion Dropbox, état de synchronisation, dernière synchronisation réussie, changements en attente, bouton « Synchroniser maintenant », export JSON, export CSV, sauvegardes de récupération et restauration/fusion.

### Conflits et restauration

Écran comparant les valeurs locales/distantes avec actions explicites « Garder ma version », « Garder Dropbox », et « Dupliquer » lorsque la donnée le permet. Prévisualisation d'une restauration : nombre de batteries, mesures, événements, date, compatibilité et éléments qui seront modifiés.

### Navigation

Un seul routeur ; prise en charge du retour Android et des boutons Précédent/Suivant. Les modales se ferment avant retour à l'écran précédent. Les paramètres ne doivent pas créer des états d'historique cachés ou concurrents.

## 5. Modèle de données cible

Le modèle conserve les identifiants existants. Ajouter des versions de schéma et métadonnées de synchronisation sans casser l'import d'anciens JSON.

| Entité | Champs utiles et règles |
|---|---|
| `batteries` | `id`, nom, mode LED/pourcentage, chimie, réglages de contrôle, seuils facultatifs, archivé, `createdAt`, `updatedAt`, métadonnées de version. |
| `measurements` | `id`, `batteryId`, `measuredAt`, `levelPercent`, source, `excludeFromPrevious`, observation, dates, version. |
| `usageEvents` | `id`, `batteryId`, date/heure, note, dates de création/modification, version. |
| `settings` | Seuils et fréquence globale partagés ; thème, préférences de notification et identifiants d'appareil locaux. |
| `syncMetadata` | `deviceId`, révision Dropbox connue, empreinte/instantané de base synchronisée, état, date du dernier succès, opérations en attente. |
| `tombstones` | Identifiants supprimés, type, date et version de suppression ; nécessaires pour éviter la résurrection sur un appareil hors ligne. |
| `backupMetadata` | Version du format, date, source, contenu, contrôle d'intégrité. |

Les estimations et échéances restent **des calculs dérivés** ; leurs données sources sont les mesures et événements. Les fichiers JSON de données n'incluent jamais les jetons OAuth.

## 6. Dropbox — architecture exclusivement sans serveur applicatif

### 6.1 Authentification

- Application Dropbox avec accès limité à son dossier ; OAuth 2.0 / PKCE.
- Identifiant public d'application autorisé ; **aucun secret client** dans le dépôt.
- Jetons d'accès de durée limitée ; si maintien de session demandé, possibilité de jeton de renouvellement avec stockage local et précautions contre les scripts malveillants. Déconnexion et révocation prévues.
- Échecs de connexion, droits refusés et changements de compte affichés clairement.

### 6.2 Format et synchronisation

Pour le volume actuel de BattTrack, privilégier **un instantané JSON de données synchronisées**, versionné, distinct des **instantanés de récupération datés**. Ne jamais considérer un simple écrasement du fichier Dropbox comme une synchronisation bidirectionnelle.

**Cycle de synchronisation proposé :**

1. Enregistrer chaque modification dans IndexedDB et la marquer « à synchroniser ».
2. Après une courte temporisation, si connecté : récupérer la révision distante et les données nécessaires.
3. Comparer trois états : **base précédemment synchronisée**, **état local actuel** et **état Dropbox actuel**.
4. Fusionner automatiquement les ajouts indépendants et changements non concurrents, y compris les suppressions non conflictuelles.
5. En cas d'édition concurrente du même objet ou de suppression contre modification, **mettre en attente la résolution humaine**, sans écraser les données.
6. Écrire dans Dropbox **uniquement si sa révision n'a pas changé** (mise à jour conditionnelle avec `rev`). Si elle a changé, relire et recommencer la fusion ; plafonner les tentatives.
7. Après écriture réussie, appliquer l'état fusionné dans une transaction IndexedDB, conserver la nouvelle base synchronisée et mettre à jour l'état visible.
8. En cas d'échec, conserver les modifications locales et réessayer à l'ouverture, à la reprise, au retour du réseau ou sur action manuelle.

Ne pas synchroniser les jetons, la préférence du thème spécifique à un appareil, les notifications locales ou les métadonnées propres à un navigateur. Utiliser des **suppressions mémorisées** plutôt qu'un effacement définitif immédiat ; prévoir une procédure de réinitialisation des appareils anciens avant de purger ces marques.

**Première connexion d'un second appareil :** prévisualiser le jeu de données distant, proposer de récupérer/fusionner ; si le téléphone possède déjà des batteries, ne pas les effacer. Une divergence de deux enregistrements ayant le même identifiant impose une résolution explicite.

### 6.3 Sauvegardes et restauration

- Les sauvegardes de récupération sont séparées du fichier de synchronisation. Prévoir un historique tournant avec possibilité d'exporter une copie hors Dropbox.
- Restauration par **remplacement** ou **fusion** : validation du schéma, aperçu des différences, copie de sécurité et opération IndexedDB transactionnelle.
- **Remplacement local** ne signifie pas automatiquement écrasement de la copie distante. Une réinitialisation du jeu de données synchronisé nécessite une confirmation distincte et une stratégie évitant que d'anciens appareils réintroduisent des données.
- La fusion se fait par identifiant ; jamais uniquement par nom. Détection et revue des conflits.
- Erreur, annulation, coupure ou reprise de connexion : aucune perte ni état « à jour » trompeur.
- Afficher : local uniquement, hors ligne, attente, en cours, à jour, conflit, erreur, connexion expirée.

## 7. Architecture cible

La refonte reste en JavaScript moderne, sans imposer un framework ou un serveur. Respecter autant que possible le style et les fichiers existants, mais extraire les responsabilités devenues trop volumineuses.

```text
index.html
manifest.json
service-worker.js
js/
  app.js                 point d'entrée léger
  app/                   état et orchestration
  navigation/            écrans, retour Android, historique
  features/
    batteries/           fiche, contrôles et profils
    measurements/        mesures et recharges
    usage/               événements d'utilisation
    calculations/        intervalles, estimations, tendances
    reminders/           périodicités et échéances
  data/                  IndexedDB, versions, migrations, import/export
  sync/                  Dropbox OAuth, fusion 3 voies, résolution de conflits
  ui/                    vues et composants existants redistribués
  pwa/                   actualisation et cycle de vie
css/                     thèmes et composants
assets/                  ressources existantes conservées
tests/                   calculs, migrations, synchronisation, navigation
```

Ceci est une **répartition cible des responsabilités**, pas une obligation de créer chaque dossier ou fichier. Les petits modules sont privilégiés ; éviter toute duplication et retirer les anciens scripts de post-traitement seulement après transfert et validation de leurs fonctions.

## 8. Anomalies confirmées sur l'archive actuelle

- Deux gestionnaires `popstate` et deux modèles d'historique coexistent dans `js/app.js` et `js/measurement-flags.js`.
- `js/app.js` et `js/ui.js` concentrent plusieurs responsabilités ; `measurement-flags.js` modifie le DOM après rendu.
- `DB_VERSION = 1` et quatre magasins principaux (`batteries`, `measurements`, `settings`, `metadata`) : le nouveau schéma nécessite une migration.
- `replaceAllData()` efface successivement les magasins avant de réimporter, sans transaction commune : risque de restauration partielle.
- Les données existantes ne contiennent pas la chimie, les événements d'utilisation distincts et les métadonnées de synchronisation.
- `APP_VERSION = 1.4.0` tandis que le cache indique `batttrack-v1-4-6` : versionnement à unifier.
- Vérifier l'algorithme d'autodécharge lorsque plusieurs segments/cycles sont normalisés séparément et que la précision dépend des heures et modes LED.

## 9. Tests de recette obligatoires

| Domaine | Test minimal |
|---|---|
| Migration | Importer une base V1, garder exactement batteries, mesures et identifiants. |
| Calcul | 87 % → 85 % valable ; 85 % → 76 % exclu ; calcul seulement sur intervalle valide, prévision depuis 76 %. |
| Chimie inconnue | Une ancienne fiche s'ouvre ; la recommandation est clairement provisoire. |
| Adaptation | Plusieurs intervalles cohérents entraînent une nouvelle **proposition**, jamais un changement automatique de préférence. |
| Utilisation | Un événement entre mesures exclut l'intervalle ; sa suppression réactive le calcul pertinent. |
| Rappels | Affichés à l'ouverture même hors ligne ; jamais présentés comme push garanti. |
| Conflit Dropbox | Deux appareils modifient la même batterie hors ligne ; aucune écriture silencieuse ne perd l'autre version. |
| Suppression | Une batterie supprimée sur A ne réapparaît pas lorsque B revient en ligne. |
| Dropbox `rev` | Une mise à jour distante durant l'envoi entraîne relecture/fusion, pas écrasement. |
| Fusion/restauration | JSON corrompu, échec, annulation et doublons : base intacte en cas de problème. |
| CSV | Français, dates/heures lisibles, séparation par point-virgule, UTF-8 avec BOM si requis, protection anti-formules. |
| Navigation | Retour Android, précédent/suivant, paramètres et modales sans double gestion. |
| PWA | Installation Android, cache, mise à jour, lancement hors ligne et retour en ligne. |

## 10. Plan de réalisation (après GO)

**Uniquement `main`** : pas de branche temporaire. Compte tenu du risque de publication directe, travailler dans une copie locale, tester et comparer le diff **avant** chaque commit/push. Petits commits français et possibilité de revenir au dernier commit stable si nécessaire.

1. **Sécuriser** : tests de non-régression, export de secours, audit des calculs, navigation unique et versionnement.
2. **Modulariser sans régression** : extraire progressivement les responsabilités de `app.js`, `ui.js` et des scripts auxiliaires.
3. **Étendre les données** : migration IndexedDB versionnée, chimies, paramètres de contrôle, événements d'utilisation et échéances.
4. **Implémenter recommandations et tableaux** : intervalles valides, tendances, fiabilité expliquée, rappels à l'ouverture, CSV et nouveaux écrans.
5. **Intégrer Dropbox** : PKCE, instantané versionné, fusion 3 voies, révisions conditionnelles, conflits, restauration, sauvegardes.
6. **Valider l'ensemble** : tests croisés sur deux appareils, hors ligne, Android, export/restauration et publication `main`.

## 11. Critères pour donner le GO

- Les **11 décisions** ci-dessus sont intégrées.
- Pas de service cloud autre que Dropbox.
- Le travail GitHub se fait exclusivement dans `main`, avec vérification locale préalable.
- L'historique existant est préservé et les données peuvent être restaurées.
- Le contrôle recommandé n'est jamais imposé silencieusement.
- Les hypothèses de fréquence initiale sont affichées comme telles et restent révisables ; la documentation fabricant prévaut.
- La synchronisation et la sauvegarde sont différenciées dans l'interface.
- Aucun code ne sera écrit ou publié avant le GO explicite.

## 12. Références utiles pour les recommandations et la synchronisation

- DJI, entretien des batteries intelligentes (conseils propres à ses modèles) : https://repair.dji.com/help/content?customId=01700006549&lang=en&spaceId=17
- Yuasa, contrôles de batterie au plomb selon stockage et température : https://www.yuasa.com/en-fr/info-hub/how-to-care-for-stock-batteries
- Panasonic, NiMH eneloop : https://www.panasonic.com/global/energy/products/eneloop/en/faq.html
- Dropbox, OAuth PKCE : https://docs.dropboxapi.com/dropbox-api/docs/oauth
- Dropbox, upload et révisions : https://docs.dropboxapi.com/dropbox-api/api-reference/user-endpoints/files/upload
- Dropbox, détection des changements : https://docs.dropboxapi.com/dropbox-api/docs/detecting-changes

*Les fréquences de départ présentées dans ce document sont des choix prudents de conception proposés pour BattTrack, pas des intervalles de contrôle universellement prescrits par ces fabricants.*
