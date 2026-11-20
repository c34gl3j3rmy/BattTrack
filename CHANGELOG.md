# Changelog

## 2.0.0 - 2026-11-20 (candidate)

### Ajouté
- Chimie et recommandation de fréquence de contrôle.
- Rappels à l'ouverture, report de rappel, journal d'utilisation.
- Fiabilité détaillée, tendance, prochain contrôle et tableau de bord.
- Export CSV global et par batterie.
- Dropbox OAuth PKCE, synchronisation bidirectionnelle avec conflits et sauvegardes datées.
- Restauration transactionnelle et fusion supervisée.

### Corrigé
- Calcul sur intervalles admissibles et périodes d'utilisation exclues.
- Affichage du dernier niveau mesuré quand aucune estimation n'est possible.
- Un seul historique Android / navigateur et un seul système de rafraîchissement PWA.
- IndexedDB v2 avec migration sans suppression des données V1.



## 1.4.0 - 2026-06-25

### Ajouté
- Mesures avec date et heure.
- Historique trié par date + heure.
- Graphique avec repères en pourcentage.
- Graphique coloré selon les seuils.


## 1.3.1 - 2026-06-24

### Ajouté
- Fichier `version.json` pour détecter les mises à jour.
- Affichage des nouveautés avant mise à jour.
- Rappel de sauvegarde avec suivi du dernier export JSON.
- Recherche dans le nom et les notes des batteries.
- Mini graphique SVG dans la fiche batterie.

### Corrigé
- Remplissage des icônes batterie mieux aligné.
- Barre visible même à faible niveau.
- Blocage du scroll arrière-plan quand une modale est ouverte.

## 1.3.0 - 2026-06-23

### Ajouté
- Filtres depuis le tableau de bord.
- Notifications locales simples.
- Bouton de vérification de mise à jour.
