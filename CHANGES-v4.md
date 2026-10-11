# Changements v4 — 2026-10-11

Correctifs issus de l'audit (voir `AUDIT-2026-10-11.md`) + flux d'approbation des demandes d'accès.

## Fichiers modifiés (6)

### `frontend/js/app.js`
- **C1** : 18 méthodes ajoutées à l'objet `api` du bundle (étaient appelées mais jamais définies → `TypeError` en production) : `forgotPassword`, `resetPassword`, `twofaStatus`, `twofaSetup`, `twofaVerify`, `twofaDisable`, `twofaLogin`, `oauthGoogleStatus`, `oauthGoogleComplete`, `caseShares`, `shareCase`, `unshareCase`, `deleteUser`, `lawyers`, `uploadAvatar`, `removeAvatar`, `contactMessages`, `markContactRead`. Copiées depuis `frontend/js/api.js`, sans toucher aux méthodes existantes.
- **Badge notifications** : la clé `unreadCount` était définie deux fois (notifications puis messages — la seconde écrasait la première, le badge 🔔 ne s'affichait jamais). La version messages est renommée `msgUnreadCount` (+ 2 appels mis à jour).
- **M1** : méthodes `registrationRequests()` et `reviewRegistrationRequest(id, body)` ajoutées.
- **M1** : entrée `access-requests` dans `NAV` (icône `lock`, permission `users.read`) + route dans `views`.
- **M1** : nouvelle page `viewAccessRequests()` — liste les demandes en attente avec sélecteur de rôle, boutons Approuver / Refuser (confirmations incluses).
- **Notifications** : nouvelle fonction `notifHref(n)` — `REGISTRATION_REQUEST` → `#/access-requests`, `CONTACT_MESSAGE` → `#/contact-messages`, dossiers → `#/cases/{id}` (inchangé), sinon `#/dashboard`.

### `frontend/js/api.js`
- **M1** : `registrationRequests()` et `reviewRegistrationRequest(id, body)` ajoutées (le module n'est pas chargé en production mais reste la référence).

### `frontend/js/i18n.js`
- **M1** : 14 nouvelles clés FR + 14 clés EN (`navAccessRequests`, `accessReqTitle`, `accessReqSubtitle`, `accessReqEmpty`, `accessReqMessage`, `accessReqRole`, `accessReqApprove`, `accessReqReject`, `accessReqConfirmApprove`, `accessReqConfirmReject`, `accessReqApproved`, `accessReqEmailed`, `accessReqTempPassword`, `accessReqRejected`). Compteurs : 734 FR / 734 EN, synchronisés.

### `backend/src/routes/registration.js`
- **M1** : nouveau `PATCH /registration-requests/:id` (`{ status: 'APPROVED'|'REJECTED', role? }`), protégé par `requireAuth` + permission `users.read`.
  - Seules les demandes `PENDING` peuvent être traitées (sinon 409 `already_reviewed`).
  - `APPROVED` : crée le compte (email/prénom/nom de la demande, rôle du body ou `LAWYER` par défaut, mot de passe temporaire aléatoire conforme à la politique, hash bcrypt 12), marque la demande `APPROVED`, journalise l'audit, envoie un courriel de bienvenue avec les identifiants si SMTP configuré (best effort). Répond `201` avec l'utilisateur créé, `emailed`, et `tempPassword` (affiché une seule fois à l'admin pour le cas où le courriel n'a pas pu partir).
  - `REJECTED` : marque la demande `REJECTED`, journalise l'audit, aucun compte créé.
  - Garde-fous : 404 si demande inexistante, 409 si l'email est déjà utilisé, 400 si rôle/statut invalide.
- Imports ajoutés : `bcryptjs`, `node:crypto`, `logAudit`, `sendMail`/`isMailConfigured`, `ROLES`.

### `backend/src/services/rag.js`
- **Vitesse** : `indexDocument()` traite désormais les chunks par lots parallèles de 8 (`Promise.all`) au lieu d'un appel `embed()` séquentiel par chunk. Comportement identique (même `DELETE` préalable, mêmes insertions).

### `backend/test/api.test.js`
- Nouveau test statique : extrait tous les appels `api.X(` de `frontend/js/app.js` et vérifie que chaque `X` est défini dans l'objet `api` du bundle (attrape C1 avant la production).
- Nouveau bloc `demandes d'accès — approbation / rejet` : 6 tests (401/403, 400/404, approbation → compte créé + connexion au mot de passe temporaire + statut `APPROVED`, double traitement → 409, rejet → `REJECTED` sans compte).

## Fichiers ajoutés (1)
- `CHANGES-v4.md` (ce fichier).

## Fichiers supprimés (0)
- Aucun.

## Tests
- `npm test` : **197/197 passent** (190 existants + 7 nouveaux), 0 échec.

## Déploiement
1. Extraire `Cabinet-Elite-Juridique-v4.zip` sur le dossier local (sans rien supprimer, `.git` et `.env` intacts).
2. `git status` → vérifier les 6 fichiers modifiés listés ci-dessus.
3. Commit + push → Render redéploie automatiquement.
