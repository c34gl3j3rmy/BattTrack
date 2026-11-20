BattTrack V2 - Mise a jour de la branche main

1. IMPORTANT : faire d'abord un export JSON depuis BattTrack actuel.
2. Extraire completement ce ZIP.
3. Remplacer les fichiers du depot GitHub main, en conservant les chemins et sous-dossiers.
4. Supprimer les anciens scripts qui ne sont plus utilises :
   - js/measurement-flags.js
   - js/cache-refresh.js
   - css/measurement-flags.css
5. Ne PAS envoyer le fichier ZIP seul dans le depot : GitHub ne le decompresse pas.
6. Attendre la fin du deploiement GitHub Pages. Tester sur un nouvel onglet avant de remplacer votre PWA installee.
7. Actualiser l'application PWA puis verifier le contenu des batteries et les anciennes mesures.
8. Configurer Dropbox en suivant README.md (une application Dropbox "App folder" et une cle publique sont requises).

IMPORTANT : cette version est une candidate de validation technique. Les tests unitaire locaux ne remplacent pas les essais reels sur smartphone et Dropbox.

Commit conseille : "Modernise BattTrack V2 et fiabilise les donnees"
