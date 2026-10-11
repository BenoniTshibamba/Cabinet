# Cabinet Élite Juridique — CHANGES v5 (2026-10-11)

Lot de fonctionnalités : chat public convivial, facturation au temps, rédacteur IA pour le blog.
Tests : **214/214** (197 v4 + 17 nouveaux).

## Fonctionnalité 1 — Chat public convivial (bulle en bas à droite)

- **NOUVEAU** `backend/src/routes/public-chat.js` : `POST /api/public/chat` (sans authentification).
  - Limite anti-abus : 10 requêtes/minute/IP (même pattern que le formulaire de contact).
  - Question limitée à 1000 caractères (zod).
  - Ne touche JAMAIS aux données internes : aucune requête base de données, aucun RAG sur les documents.
  - Ton chaleureux et accueillant, FR/EN (prompt système dédié) : présente le cabinet, les domaines d’intervention, la demande d’accès / prise de rendez-vous ; refuse les conclusions juridiques définitives et redirige vers la page Contact.
  - Sans clé LLM : réponse amicale d’indisponibilité (200, jamais 500).
- `backend/src/app.js` : montage de la route sur `/api/public/chat`.
- `frontend/js/app.js` : `syncChatWidget()` affiche désormais la bulle aux visiteurs **non connectés** (mode `public`) en plus du personnel avec `ai.ask` (mode `staff`, inchangé).
  - Nouvelle méthode `api.publicChat(question, lang)` ; le mode public ignore la vérification `aiStatus` (réservée au personnel).
  - Message de bienvenue et placeholder dédiés au public.
- `frontend/js/i18n.js` : `chatPublicWelcome`, `chatPublicPlaceholder` (FR+EN).

## Fonctionnalité 2 — Facturation au temps

- `backend/src/routes/invoices.js` :
  - `POST /api/invoices` : si `case_id` est fourni, les saisies de temps **non facturées** du dossier sont reprises automatiquement — `amount_cents = Σ(heures × taux)` arrondi au cent — et leur `invoice_id` est posé **dans une transaction** (`withTransaction`). Sans saisies non facturées, comportement manuel inchangé. Le `client_id` est dérivé du dossier pour garantir la cohérence. Réponse enrichie de `timeEntriesBilled`.
  - **NOUVEAU** `GET /api/invoices/preview?case_id=` (`billing.create`) : lignes non facturées + total, pour l’aperçu avant création.
  - **NOUVEAU** `GET /api/invoices/billable?case_id=` (`billing.read`) : temps facturable calculé **en direct** depuis `time_entries` (aucun cache) — heures totales, montant couru, ventilation facturé / non facturé + lignes détaillées. Les clients ne voient que leurs propres dossiers (`assertVisible`).
- `frontend/js/app.js` :
  - Formulaire de facture : quand un dossier est sélectionné, aperçu en direct des lignes non facturées + total, montant pré-rempli et verrouillé (le backend reste l’autorité du calcul).
  - Portail client : nouvel onglet **« Temps facturable »** dans le détail du dossier (rôle CLIENT) — cartes total/facturé/non facturé + tableau des lignes, rechargé à chaque ouverture.
  - Nouvelles méthodes `api.invoicePreview(caseId)`, `api.caseBillable(caseId)`.
- `frontend/js/i18n.js` : `invTimePreview`, `invTimeTotal`, `tabBillable`, `bill*` (FR+EN).
- `frontend/css/styles.css` : styles `.invoice-preview`.

## Fonctionnalité 3 — Rédacteur IA pour le blog

- `backend/src/routes/blog.js` : **NOUVEAU** `POST /api/blog/ai-generate` (`requireAuth` + `posts.create`).
  - Corps `{ topic, lang, tone?, length? }` validé par zod ; 503 gracieux sans clé LLM.
  - Utilise le service `chat()` existant ; l’IA répond en JSON `{title, html}` (balises limitées, pas de `<h1>`), parsé de façon robuste.
  - **Jamais de publication automatique** : la sauvegarde passe toujours par `sanitizeHtml` existant. Audit `BLOG_AI_GENERATED`.
- `frontend/js/app.js` : bouton **« Générer avec l’IA »** dans l’éditeur d’articles → mini-modale (sujet, ton optionnel, longueur) → `api.generateBlogPost()` remplit le titre et le contenu pour **relecture/modification** avant publication. `buildRichEditor` expose désormais `setHtml()`.
- `frontend/js/i18n.js` : `blogAi*` (13 clés FR+EN).

## Fichiers

**Ajoutés (2)** : `backend/src/routes/public-chat.js`, `CHANGES-v5.md`.
**Modifiés (8)** : `backend/src/app.js`, `backend/src/routes/invoices.js`, `backend/src/routes/blog.js`, `backend/test/api.test.js`, `frontend/js/app.js`, `frontend/js/api.js`, `frontend/js/i18n.js`, `frontend/css/styles.css`.
**Supprimés** : aucun.

---
BUILT WITH LOVE AND CAFFEINE BY BB24
