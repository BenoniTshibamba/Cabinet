# Changements v6 — 2026-10-11

## Correctifs validés le 2026-10-11 (audit de la liste approuvée par Benoni)

- **A1 persistance du chat (vérifié)** : audit complet du code — la persistance
  `localStorage` (`cej:chat:<mode>:<langue>`, 60 messages max, sauvegarde à
  l'envoi, restauration à l'ouverture, bouton ↺) est correcte pour les deux
  modes (public + staff), la navigation SPA (le widget vit sur `document.body`,
  hors du conteneur `#root` réinitialisé) et le rechargement complet. Le symptôme
  observé en production venait de la v5 déployée, qui ne contient pas ce code.
- **A3 message d'accueil public** : `chatPublicWelcome` (FR) vaut désormais
  exactement « Bonjour ! Une question juridique ? Écrivez-la ici, je vous réponds. »
  (`frontend/js/i18n.js`). Message du dashboard inchangé.
- **A4 RAG / sources fantômes** : le chat public n'a AUCUN accès documentaire
  par construction (aucune requête DB, aucun RAG — confirmé dans le code v5/v6) ;
  la citation « git-github-beginner.pdf » vue en production venait d'un code
  pré-v5 (persona « assistant documentaire » différent). Durcissement du prompt
  système : interdiction explicite de citer des documents/sources + correction
  du lieu (« Montréal, Québec, Canada » → « Kinshasa, en République démocratique
  du Congo »), FR et EN (`backend/src/routes/public-chat.js`).
- **B6 copie SaaS de l'accueil** : le hero (`landHeroTitle`, `landHeroText`) et le
  bandeau CTA (`landCtaTitle`, `landCtaText`) de la page d'accueil du cabinet
  parlent désormais du cabinet d'avocats (FR + EN) ; le bouton d'en-tête
  « Demander une démo » devient « Demander un accès » (cohérent avec la modale
  de demande d'accès qu'il ouvre). La page vitrine « L'application » (#/web-app),
  volontairement dédiée au logiciel, garde sa copie via de nouvelles clés
  dédiées `webAppCtaTitle`/`webAppCtaText` (`frontend/js/app.js`, `i18n.js`).
- **B8 /blog en français (vérifié)** : `reqLang` dans `backend/src/blog-ssr.js`
  ignore `Accept-Language` et retourne le français par défaut, avec synchro
  client via `localStorage 'cej_lang'`.
- **B9 pied de page public** : le bouton « Se déconnecter » est supprimé ;
  le pied de page affiche « Mon espace » (connecté) ou « Se connecter »
  (visiteur), comme l'en-tête.
- **B10 formulaire de contact** : reproduction locale OK (201 valide, 400
  invalide). Deux durcissements : (1) la notification in-app des admins est
  désormais best-effort — un échec ne transforme plus un message enregistré
  en erreur 500 pour le visiteur ; (2) `app.set('trust proxy', 1)` pour que
  `req.ip` reflète la vraie IP du visiteur derrière le proxy Render (sinon les
  limiteurs par IP — contact, chat public — frappent tous les visiteurs à la fois).
- **C11 ordre de navigation** : « Blog » placé immédiatement après « À propos »
  dans la nav desktop, le tiroir mobile, le pied de page (`frontend/js/app.js`)
  et l'en-tête SSR du blog (`backend/src/blog-ssr.js`, desktop + tiroir).
- **C12 section « À propos »** : refonte visuelle — photo encadrée d'un cadre
  décalé aux couleurs du cabinet, étiquettes des domaines d'intervention
  (données réelles, 6 max, lien vers #domaines), boutons d'action
  « Prendre rendez-vous » / « Découvrir nos domaines », bandeau de stats
  conservé. Nouvelles clés i18n FR/EN (`aboutAreasLabel`, `aboutCtaContact`,
  `aboutCtaAreas`) + CSS (`.about-media`, `.about-chip`, `.about-cta-row`).
- **E portraits** : non touchés (exclusion explicite de Benoni).
- Tests backend : **223/223** (52 suites, 0 échec).

## Auteurs d'articles (byline avec photo)
- **NOUVEAU** table `authors` (id, name, photo_filename, created_at) + migration dans `bootstrap.js`.
- `blog_posts.author_id` pointe désormais vers `authors(id)` (nullable, `ON DELETE SET NULL`) ;
  le propriétaire (permissions d'édition) est `blog_posts.owner_id` → `users(id)`.
  La table est reconstruite une seule fois lors de la migration (gardé par `owner_id`),
  les articles existants conservent leur propriétaire et sont assignés à « Benoni Tshibamba ».
- **API** : `GET/POST /api/blog/authors`, `PUT/DELETE /api/blog/authors/:id` (photo via
  `/uploads/author-photos/`, même permission que le blog) ; `POST/PUT /api/blog` accepte
  `author_id` (validé, 400 si inexistant).
- **Dashboard** : bouton « Auteurs » dans la section blog (liste, création nom + photo,
  édition, suppression) ; sélecteur d'auteur dans l'éditeur d'article.
- **Public** : byline avec photo ronde (~34 px) à côté du nom sur `/blog`, `/blog/:slug`
  et les cartes d'aperçu ; cercle d'initiales si pas de photo ; « Admin » si aucun auteur.
- Seed : l'auteur « Benoni Tshibamba » est créé et assigné aux deux articles publiés.
- Tests : 6 nouveaux (CRUD auteurs, byline public, SET NULL, 400) — **223/223**.

## Correctif critique : images du blog en 404 après déploiement
- **Cause réelle trouvée** : ce n'était PAS le disque persistant qui effaçait les fichiers.
  Le répertoire `blog-images/` (où l'éditeur téléverse les images insérées dans les
  articles) n'était tout simplement **jamais monté en lecture publique** dans
  `backend/src/app.js`. L'API retournait des URL `/uploads/blog-images/...` que
  le serveur ne servait pas → 404 systématique.
- **Correctif** : `app.use('/uploads/blog-images', express.static(BLOG_IMAGES_DIR))`.
- Les fichiers déjà téléversés sur le disque persistant (`/app/backend/data/uploads/blog-images`)
  réapparaissent automatiquement après ce déploiement — **aucun re-téléversement nécessaire**
  (sauf si le disque n'était pas attaché, auquel cas re-téléverser les images via l'éditeur).
- Test de régression ajouté : upload → GET de l'URL retournée = 200 + `image/*`, fichier inexistant = 404.

## Chatbox public : conversation persistante + réponses plus rapides
- **Persistance** : la conversation est sauvegardée dans `localStorage`
  (`cej:chat:<mode>:<langue>`, 60 messages max) et restaurée à l'ouverture du panneau.
  Elle ne disparaît plus quand on change de page.
- **Bouton ↺** dans l'en-tête du chat pour effacer la conversation.
- **Rapidité** : cache serveur des questions/réponses (1 h, 100 entrées) — les questions
  identiques reçoivent une réponse immédiate au lieu d'un nouvel appel LLM ; budget
  de tokens réduit de 600 à 400 (les réponses restent « quelques phrases » comme
  l'exige le prompt système).

## Éditeur du blog : refonte demandée par Benoni
- **Menu vertical à gauche** avec toutes les options de mise en forme, en 4 sections :
  Texte, Paragraphe, Insertion, Outils (remplace la barre horizontale encombrée).
- **Zone d'édition agrandie** : 300 px → 480 px de hauteur minimale.
- **Plus d'options** : indice (x₂), exposant (x²), augmenter/réduire le retrait,
  ligne horizontale, retirer un lien.
- **Bug du curseur corrigé** : le curseur ne saute plus au début du paragraphe quand
  on met en gras ou change un titre — la position est marquée avant la mutation du
  DOM (`normalizeRte`) et restaurée juste après.
- Nouvelles icônes : `indentInc`, `indentDec`, `unlinkIcon`, `hrIcon`.
- Nouvelles clés i18n FR/EN (`rteSub`, `rteSup`, `rteIndent`, `rteOutdent`, `rteHr`,
  `rteUnlink`, `rteSecText`, `rteSecParagraph`, `rteSecInsert`, `rteSecTools`, `chatClear`).
- Sur mobile (< 640 px), le menu vertical passe au-dessus de la zone d'édition.

## Déploiement
Extraire par-dessus le dossier du projet (ne rien supprimer), `git status`,
commit, `git push` → Render redéploie automatiquement (~5 min).
Note : la base SQLite locale (`backend/data/cabinet-elite.db`) n'est PAS incluse
dans le ZIP — l'application la crée et la migre automatiquement au démarrage.

## Correctifs vérifiés avant envoi (2026-10-11, après relecture)
- **Adresse "Kinshasa Kinshasa"** : `addressLines()` déduplique ville/province
  quand elles sont identiques (`frontend/js/app.js`).
- **Bouton "Se connecter" invisible** : le `.btn-ghost` générique (texte clair
  pour fonds sombres) était illisible sur l'en-tête clair et dans les sections
  publiques — surcharges `.public-header-actions .btn-ghost` et
  `.public-section .btn-ghost` avec `var(--ink)` adaptatif au thème
  (`frontend/css/styles.css`).
- **Demandes d'accès refusées** : un courriel de refus poli est maintenant envoyé
  au demandeur (best effort, jamais bloquant), comme pour les approbations
  (`backend/src/routes/registration.js`).
