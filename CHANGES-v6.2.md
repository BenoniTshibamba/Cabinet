# Changements v6.2 — 2026-10-11

## Corbeille 24h (demandée par Benoni)

Supprimer un client ou un dossier par erreur n'est plus définitif : l'élément
part en corbeille, reste restaurable 24 h, puis est purgé définitivement
automatiquement.

### Backend
- Migration automatique au démarrage : colonne `deleted_at` sur `clients` et
  `cases` (+ index). `schema.sql` mis à jour pour les installations neuves.
- `DELETE /clients/:id` et `DELETE /cases/:id` → mise en corbeille par défaut
  (`deleted_at`) ; `?permanent=1` pour une suppression définitive immédiate.
  Permissions existantes (`clients.delete`, `cases.delete`) inchangées.
- Nouvelles routes : `GET /clients/trash`, `GET /cases/trash`,
  `POST /clients/:id/restore`, `POST /cases/:id/restore`.
- Toutes les listes, recherches, compteurs, échéances et vérifications de
  visibilité excluent désormais les éléments en corbeille (`deleted_at IS NULL`) :
  clients, dossiers, documents, recherche globale, tableau de bord, calendrier,
  saisies de temps, assistant IA, vérification des échéances.
- Les factures restent toujours visibles (données financières) ; on ne peut pas
  facturer un client ou un dossier en corbeille.
- Purge automatique (`backend/src/services/trash.js`, démarrée dans `server.js`) :
  5 min après le démarrage puis toutes les heures, supprime définitivement les
  éléments en corbeille depuis plus de 24 h. Les fichiers des documents sont
  effacés du disque, les factures sont dissociées (jamais supprimées).
- Sécurité : un client avec des factures n'est JAMAIS purgé automatiquement ;
  un client avec des dossiers actifs ne peut pas aller en corbeille.
- Journal d'audit : `CLIENT_TRASHED`, `CLIENT_RESTORED`, `CASE_TRASHED`,
  `CASE_RESTORED`, `CLIENT_PURGED`, `CASE_PURGED` (+ `CLIENT_DELETED` /
  `CASE_DELETED` pour les suppressions définitives manuelles).
- 7 nouveaux tests backend (230/230 passés).

### Frontend
- Bouton « Supprimer » (rouge, avec confirmation) sur la fiche client et la
  fiche dossier → mise en corbeille.
- Nouvelle page « Corbeille » dans la navigation (visible si permission
  `clients.delete` ou `cases.delete`) : liste les clients et dossiers supprimés
  avec date de suppression, compte à rebours (« Suppression définitive dans X h »),
  boutons « Restaurer » et « Supprimer définitivement » (confirmation).
- i18n FR + EN pour toute la corbeille ; classe `.btn-danger`.

### Fichiers modifiés
- `backend/src/db/bootstrap.js`, `backend/src/db/schema.sql`
- `backend/src/routes/clients.js`, `backend/src/routes/cases.js`
- `backend/src/routes/ai.js`, `calendar.js`, `dashboard.js`, `documents.js`,
  `invoices.js`, `search.js`, `social.js`, `time-entries.js`, `users.js`
- `backend/src/services/deadlines.js`
- `backend/src/server.js`
- `backend/test/api.test.js`
- `frontend/js/app.js`, `frontend/js/i18n.js`, `frontend/css/styles.css`
  (boutons Supprimer + page Corbeille + classe `.btn-danger`)

### Fichiers ajoutés
- `backend/src/services/trash.js`
- `CHANGES-v6.2.md`
