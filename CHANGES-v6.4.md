# v6.4 — Déconnexion automatique après 2 h d'inactivité

(Inclut aussi tout le contenu de la v6.3 — nom de site Google + description.)

## Problème signalé
La session ne se fermait jamais d'elle-même : le jeton d'accès (15 min) est
renouvelé automatiquement et le refresh token (30 jours) repart à zéro à
chaque renouvellement. N'importe quel appel d'arrière-plan suffisait à
prolonger la session indéfiniment — messagerie interne (poll toutes les
5 s) ou page « Temps » ouverte avec un minuteur de facturation en cours.

## Correctif (frontend/js/app.js)
- Nouvelle minuterie d'inactivité de **2 heures**, basée uniquement sur les
  gestes réels de l'utilisateur : `pointerdown`, `keydown`, `touchstart`,
  `mousemove` (plafonné à 1 marquage / 5 s).
- Les appels d'arrière-plan (poll messagerie, minuteurs, diaporama) ne
  comptent plus comme activité et ne prolongent plus la session.
- Horodatage de dernière activité en `localStorage` (`cej:lastActivity`) :
  partagé entre les onglets du même navigateur, conservé après rechargement.
- À 1 minute de l'échéance : modale d'avertissement avec compte à rebours
  et bouton « Rester connecté » ; tout geste réel la referme et relance le
  délai de 2 h.
- À l'échéance : révocation du refresh token côté serveur
  (`POST /auth/logout`, best effort), fermeture de la session locale et
  message « Session fermée après 2 h d'inactivité. »
- L'horloge repart à zéro à chaque connexion réussie (mot de passe, 2FA,
  Google OAuth).
- Les minuteurs de facturation ne sont pas perdus : ils sont stockés
  localement, continuent de compter et sont restaurés à la reconnexion.

## Textes (frontend/js/i18n.js)
- Nouvelles clés FR + EN : `idleWarnTitle`, `idleWarnBody`, `idleStay`,
  `idleLoggedOut`.

## Tests
- `node --check` OK (app.js, i18n.js).
- Suite backend complète : 230/230 tests réussis.
- Serveur local : page servie avec `og:site_name` (v6.3) et le code
  d'inactivité présent dans le app.js servi ; santé API 200.
