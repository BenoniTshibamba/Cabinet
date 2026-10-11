# Changements v6.1 — 2026-10-11

Correctifs demandés par Benoni après le déploiement de la v6.

- **Logo Google** : le bouton « Se connecter avec Google » affichait une simple
  lettre « G » en texte. Remplacé par le vrai logo « G » multicolore officiel
  (SVG inline via `googleIconSvg()`, `frontend/js/app.js` + classe
  `.google-icon` dans `frontend/css/styles.css`).
- **Pastilles de domaines en trop (accueil)** : la section « À propos » affichait
  « Nos domaines d'intervention » avec 6 pastilles qui faisaient doublon avec la
  section « Nos domaines de pratique » (cartes numérotées) juste en dessous.
  Pastilles et leur libellé retirés ; les boutons « Prendre rendez-vous » et
  « Découvrir nos domaines » sont conservés (`frontend/js/app.js`).

Aucun changement backend. Aucune migration. Fichiers modifiés :
- `frontend/js/app.js`
- `frontend/css/styles.css`

Fichier ajouté : `CHANGES-v6.1.md`.
