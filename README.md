# Cabinet Élite Juridique

Plateforme web de gestion pour cabinet d'avocats : clients, dossiers juridiques, documents,
facturation, notifications et journal d'audit — avec authentification, rôles et permissions.

> **Note sur le périmètre.** Ce projet part d'un cahier des charges qui envisageait une
> architecture microservices complète avec assistant IA (RAG). Le résultat livré ici est un
> monolithe modulaire complet et testé, sans RAG. Les raisons de chaque écart, assumées et
> expliquées en détail, sont dans [docs/architecture.md](docs/architecture.md) — à lire avant
> de juger le choix d'architecture.

## Fonctionnalités

- **Authentification** JWT (access + refresh token avec rotation) et 6 rôles : Super
  administrateur, Administrateur, Avocat, Assistant, Comptable, Client.
- **RBAC** vérifié côté serveur : chaque route exige une permission précise ; un avocat ne
  voit que ses dossiers assignés, un client ne voit que les siens.
- **Clients** : fiches, recherche, historique des dossiers et factures.
- **Dossiers juridiques** : statuts, priorités, notes, avocat responsable, numérotation
  automatique.
- **Documents** : téléversement, téléchargement, suppression, versionnement simple,
  restrictions de type et de taille de fichier.
- **Facturation** : création, changement de statut, génération de PDF.
- **Notifications** in-app et **journal d'audit** complet (qui a fait quoi, quand, depuis
  quelle IP).
- **Tableau de bord** et **recherche globale** (clients, dossiers, documents).
- **Calendrier des échéances** : vue mensuelle des échéances de dossiers et factures,
  avec widget « 7 prochains jours » et rappels automatiques (courriel + notification).
- **Suivi du temps** : saisie des heures au taux horaire, totaux par dossier,
  création de facture brouillon en un clic depuis les heures non facturées.
- **Modèles de documents** : variables `{{client_nom}}`, `{{dossier_numero}}`, `{{date}}`,
  `{{avocat_nom}}` ; génération et téléchargement en `.txt`/`.md`.
- **Portail client** : onglets Mes dossiers / Mes documents / Mes factures, déclaration
  de paiement (notifie les comptables, sans traitement bancaire réel).
- **Kanban des dossiers** : glisser-déposer entre colonnes de statut.
- **Graphiques** : revenus facturés par mois, dossiers par statut, dossiers actifs par avocat.
- **Recherche avancée** : filtres par statut, avocat, priorité et période, avec filtres
  enregistrés par utilisateur.
- **Page d'accueil publique** repensée : présentation premium, fonctionnalités, méthode,
  témoignages, appel à l'action « Demander une démo ».
- **Personnalisation white-label** : chaque cabinet adapte le site à son identité
  (nom, slogan, logo, couleurs, textes d'accueil, coordonnées) depuis la vue
  « Personnalisation » (réservée aux administrateurs), avec aperçu en direct.
  Un déploiement = un cabinet : les réglages sont stockés par instance.
- Interface **bilingue FR/EN** (sélecteur dans l'en-tête, préférence persistée),
  **responsive**, **thème clair/sombre**, sans framework frontend ni étape de build.

## Démarrage rapide (sans Docker)

Prérequis : [Node.js](https://nodejs.org) ≥ 22.5. La base de données est SQLite et ne nécessite aucun serveur PostgreSQL.

```bash
# 1. Installer le backend
cd backend
npm install

# 2. Charger les données de démonstration
npm run seed

# 3. Démarrer
npm start
```

> **Zéro configuration requise.** Au premier démarrage, l'application crée
> automatiquement `backend/.env` (depuis `.env.example`) avec des secrets JWT
> générés aléatoirement, ainsi que la base SQLite (migrations automatiques).
> Il n'y a rien à configurer à la main pour lancer le projet en local.

L'application est servie sur <http://localhost:4000> (frontend et API sur le même port).

### Frontend servi séparément

Le frontend utilise désormais directement `http://localhost:4000/api` par défaut. Vous pouvez
donc aussi ouvrir `frontend/index.html` avec un serveur statique (par exemple Live Server sur
`:5500`) : les requêtes `/api/...` sont envoyées au backend `:4000`. Les origines de
développement autorisées sont configurables avec `CORS_ORIGINS` dans `backend/.env`.

### Version officielle (production) — sans données démo

`npm run seed` est **optionnel** : il ne sert qu'à la démo locale. Pour une vraie mise
en production, ne le lancez pas :

```bash
cd backend
npm install
npm start   # .env + base créés automatiquement
```

Au premier démarrage, si aucun utilisateur n'existe, le **premier administrateur**
est créé automatiquement :
- définissez `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` pour choisir ses identifiants ;
- sinon un mot de passe aléatoire est généré et **affiché une fois** dans la console —
  connectez-vous avec, puis changez-le immédiatement.

Ensuite, créez les vrais comptes depuis **Utilisateurs** (avocats, assistants,
comptable, clients) et personnalisez le site depuis **Personnalisation**. Sur Render,
renseignez `ADMIN_EMAIL` / `ADMIN_PASSWORD` dans le tableau de bord (déjà prévus dans
`render.yaml`) et récupérez le mot de passe dans les logs du premier déploiement.

### Comptes de démonstration

Créés par `npm run seed`, mot de passe identique pour tous : **`Demo1234!`**

| Rôle | Courriel |
|---|---|
| Administrateur | admin@cabinet-elite.example |
| Avocat | e.tshibamba@cabinet-elite.example |
| Avocat | t.tshibamba@cabinet-elite.example |
| Assistant | josh.tshibamba@cabinet-elite.example |
| Comptable | j.tshibamba@cabinet-elite.example |
| Client (portail) | marc.lavoie@example.com |

### Donner l'accès au site à un client

Un client se connecte avec un **compte utilisateur de rôle CLIENT**, rattaché à son
dossier client. L'administrateur le crée depuis **Utilisateurs → Nouvel utilisateur** :
choisir le rôle *Client*, puis sélectionner le dossier client dans la liste déroulante
(le `clientId` est obligatoire). Le client ne voit alors que ses propres dossiers,
documents et factures — plus la bulle de discussion avec l'assistant IA en bas à droite.

## Avec Docker

```bash
docker compose up --build
```

Le conteneur utilise également SQLite. Les données SQLite et les fichiers téléversés sont
persistés dans des volumes Docker.

## Tests

```bash
cd backend
npm test
```

Les tests (`node:test`) utilisent la base SQLite locale : authentification, rotation des
jetons, RBAC (permissions refusées, visibilité par rôle), CRUD clients/dossiers, upload et
restriction de type de fichier, facturation et génération de PDF, journal d'audit, tableau
de bord, recherche.

## Structure du projet

```
backend/
  src/
    app.js            Application Express (routes + fichiers statiques)
    server.js          Point d'entrée
    db/
      schema.sql        Schéma SQLite
      migrate.js         Applique le schéma, synchronise rôles/permissions
      seed.js            Données de démonstration
      pool.js            Accès SQLite
    middleware/
      auth.js            JWT + vérification des permissions (RBAC)
    routes/              Une route Express par domaine métier
    services/
      audit.js           Journal d'audit
      notify.js          Notifications in-app
    utils/
      permissions.js     Source unique de vérité des rôles/permissions
  test/
    api.test.js          Suite de tests (node:test)
  uploads/               Fichiers téléversés (créé au runtime)
frontend/
  index.html
  css/styles.css         Système de design (thème clair/sombre inclus)
  js/                    Application (routage par hash, aucun framework)
docs/
  architecture.md        Décisions techniques, limites, feuille de route
docker-compose.yml       Déploiement Docker avec SQLite
Dockerfile
```

## API

Toutes les routes sont préfixées par `/api` et répondent en JSON.
Voir le code des routes (`backend/src/routes/`) pour le détail des paramètres ; aperçu :

| Domaine | Routes principales |
|---|---|
| Auth | `POST /api/auth/login`, `/refresh`, `/logout`, `GET /me`, `POST /change-password` |
| Utilisateurs | `GET/POST /api/users`, `PATCH /api/users/:id` |
| Clients | `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/:id` |
| Dossiers | `GET/POST /api/cases`, `GET/PATCH/DELETE /api/cases/:id`, `/:id/notes` |
| Documents | `GET/POST /api/cases/:caseId/documents`, `GET /api/documents/:id/download` |
| Facturation | `GET/POST /api/invoices`, `PATCH /api/invoices/:id/status`, `GET /:id/pdf` |
| Notifications | `GET /api/notifications`, `/unread-count`, `POST /:id/read` |
| Audit | `GET /api/audit-logs` (réservé aux permissions `audit.read`) |
| Tableau de bord | `GET /api/dashboard` |
| Recherche | `GET /api/search?q=...` |

## Sécurité

- Mots de passe hachés avec bcrypt (jamais stockés en clair).
- Politique de mot de passe : minimum 10 caractères, dont au moins une lettre et
  un chiffre — appliquée à la création d'utilisateur (admin) et au changement de
  mot de passe (chaque utilisateur peut changer le sien depuis l'icône cadenas
  dans la barre latérale).
- JWT à courte durée de vie (15 min) + refresh token avec rotation et révocation.
- RBAC vérifié côté serveur uniquement (jamais confiance au frontend seul).
- Upload : extensions autorisées en liste blanche, taille limitée (25 Mo), noms de fichiers
  générés aléatoirement sur le disque (jamais le nom fourni par le client).
- En-têtes `X-Content-Type-Options`, `Referrer-Policy`.
- Secrets dans `.env` (jamais commités — voir `.gitignore`).

Voir [docs/architecture.md](docs/architecture.md) pour les limites connues et ce qui reste
à durcir avant un déploiement en production réelle.

## Licence

MIT pour le code. Aucune donnée réelle de client ou de cabinet n'est utilisée : toutes les
données de démonstration sont fictives.

## SQLite / démarrage simplifié

Cette version ne nécessite pas PostgreSQL. Le serveur initialise automatiquement la base SQLite au démarrage et crée le compte de démonstration si nécessaire.

```powershell
cd backend
npm install
npm start
```

Puis ouvrir `http://localhost:4000`.

Compte démo : `admin@cabinet-elite.example` / `Demo1234!`.

La base est dans `backend/data/cabinet-elite.db`. Pour repartir d'une installation de démonstration propre, arrêter le serveur, supprimer ce fichier, puis relancer `npm start`.

## Nouvelles fonctionnalités — AI, RAG, publications et messagerie

Cette version ajoute :
- Assistant AI accessible depuis « Assistant AI ».
- Recherche dans les documents autorisés d’un dossier avant génération de la réponse.
- Indexation des PDF/DOCX/TXT avec embeddings OpenAI et stockage local des vecteurs dans SQLite.
- Publications et articles avec likes, commentaires et partage par message.
- Règle serveur : seul l’auteur peut modifier ou supprimer sa publication.
- Messagerie directe entre utilisateurs actifs.
- Demande d’accès depuis l’écran de connexion (approbation administrative à prévoir).

### Configuration AI

Dans `backend/.env`, ajouter `OPENAI_API_KEY`. Puis, depuis `backend/` :

```bash
npm install
npm start
```

Les dépendances `pdf-parse` et `mammoth` sont nécessaires pour l’indexation PDF/DOCX. Les documents doivent être indexés depuis le dossier avant d’être interrogés par l’assistant.


## Accueil public

À l'ouverture de `http://localhost:4000`, l'application affiche maintenant un **accueil public** sans demander de mot de passe.

Les visiteurs peuvent :
- voir les publications et articles publics du cabinet;
- voir les auteurs, dates, likes et commentaires;
- se connecter via **Se connecter**;
- envoyer une **demande d'accès** via **Demander un accès**.

Les actions privées (liker, commenter, messagerie, dossiers, documents et assistant AI) restent protégées par authentification.

Après connexion, l'utilisateur retrouve l'application complète. Une déconnexion renvoie également vers l'accueil public.

### Carte et formulaire de contact

La section Contact affiche l'adresse du cabinet (rue, ville, province, code postal, pays — modifiables dans **Personnalisation**) avec une **carte Google Maps plein hauteur** visible par tous et un bouton **Itinéraire** qui ouvre Google Maps avec la direction.

Le **formulaire de contact** (`POST /api/contact`, anti-abus : 5 messages / 10 min / IP) :
- le message est **toujours conservé** en base (`contact_messages`) et **notifié aux administrateurs** dans l'application ;
- un **courriel** est en plus envoyé à l'adresse de contact du cabinet (modifiable dans Personnalisation) quand le SMTP est configuré ;
- après l'envoi, **l'application email du visiteur s'ouvre** avec un message pré-rempli (nom, courriel, téléphone, message) adressé au courriel du cabinet — le message arrive ainsi directement dans la boîte du cabinet **sans SMTP**.

Les administrateurs lisent les messages reçus dans **Messages de contact** (sidebar) et peuvent les marquer comme lus.

### Diaporama d'accueil

La bannière d'accueil affiche un **diaporama de 5 images** en fond, avec fondu enchaîné et **rotation automatique toutes les 60 secondes** (en pause quand l'onglet est caché), plus des pastilles pour naviguer manuellement. Les 5 emplacements sont modifiables dans **Personnalisation** (téléversement, aperçu, retrait) ; `npm run seed:content` installe 5 images professionnelles par défaut sans jamais écraser celles de l'admin.

### Publications sur l'accueil

Les utilisateurs connectés ayant la permission `posts.read` voient une section **Publications du cabinet** directement sur la page d'accueil (après les domaines de pratique, avant le blog), avec les mêmes cartes que partout ailleurs. Le bouton **+ Ajouter une publication** (permission `posts.create`) ouvre le composer ; après publication, modification ou suppression, la page courante se ré-affiche et le nouveau post est immédiatement visible.

### Recevoir les messages par email (SMTP)

Sans SMTP configuré, **aucun email ne peut partir** (techniquement impossible) : les messages du formulaire sont quand même conservés en base et notifiés aux administrateurs dans l'application — rien n'est perdu. Pour recevoir aussi les messages dans votre boîte mail, configurez le SMTP (exemple avec Gmail) :

1. Créez un **mot de passe d'application** Google : compte Google → Sécurité → Validation en 2 étapes → Mots de passe d'application → générez-en un pour « Courrier ».
2. Dans le `.env` du backend (ou les variables d'environnement Render) :
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=votre.adresse@gmail.com
   SMTP_PASS=le-mot-de-passe-d-application
   MAIL_FROM=votre.adresse@gmail.com
   ```
3. Redémarrez le serveur. Les messages du formulaire seront alors envoyés à l'**adresse de contact du cabinet** (modifiable dans **Personnalisation**), en plus de la conservation en base et de la notification in-app.

### Contenu de démarrage réel (RDC)

`npm run seed:content` insère un contenu de démarrage réel et idempotent (Kinshasa, RDC) : paramètres du site (adresse, courriel de contact), 6 domaines de pratique (droit minier, OHADA…), 4 publications, **3 publications signées par l'administrateur (avec photos)** et 3 articles de blog publiés (avec couvertures) — tout le contenu est original, avec liens vers les sources publiques. Un déploiement neuf (sans seed) affiche déjà une page d'accueil réelle grâce aux valeurs par défaut.

### Isolation des données par avocat

Chaque avocat ne voit que **ses propres clients et leurs factures** (ainsi que ses dossiers assignés). Un avocat (ou un admin) peut **partager un dossier** avec un autre avocat via le bouton **Partager** sur la fiche dossier : le destinataire voit alors le dossier, son client et ses factures. Admin, comptable et assistant gardent leur visibilité actuelle.

### Photos de profil

Chaque utilisateur peut définir sa **photo de profil** (PNG/JPG/GIF/WebP, 2 Mo max) en cliquant sur son avatar dans la barre latérale ; l'admin peut aussi la définir pour un autre utilisateur. La photo apparaît dans la barre latérale, les publications, les commentaires et la messagerie (avec repli sur les initiales).

## Personnalisation white-label

Un déploiement = un cabinet. L'identité du cabinet (nom, slogan, logo, couleurs,
titres de la page d'accueil, coordonnées, texte de pied de page) est stockée dans la
table `site_settings` (une seule ligne, `id = 1`) et s'applique à la page publique,
à la barre latérale et à l'onglet du navigateur.

Les administrateurs modifient tout depuis la vue **Personnalisation** (menu latéral) :
- nom du cabinet, slogan, logo (PNG/JPG/SVG, 2 Mo max ; sans logo, un monogramme
  est généré automatiquement),
- couleur principale (défaut `#0f1e33`, bleu nuit) et couleur d'accent
  (défaut `#b08d3e`, bronze),
- titre et sous-titre du hero, courriel, téléphone, adresse structurée (rue, ville,
  province, code postal, pays — affichée avec une carte Google Maps publique et un
  bouton « Itinéraire » dans la section Contact), texte de pied de page,
- aperçu en direct avant enregistrement ; les changements s'appliquent
  immédiatement, sans rechargement.

API : `GET /api/site-settings` (public), `PUT /api/site-settings` (admin),
`POST /api/site-settings/logo` et `DELETE /api/site-settings/logo` (admin).
Les logos sont servis publiquement via `/uploads/branding/`.

**Tout le contenu de la page d'accueil est éditable par l'admin** depuis
Personnalisation, sans toucher au code :

- **Domaines de pratique** : ajout / modification / suppression / réordre
  (titre + description) — affichés en grille sur la page d'accueil et dans le
  menu déroulant « Domaines de pratique ». API : `GET /api/practice-areas`
  (public), `POST` / `PUT /:id` / `DELETE /:id` (admin).
- **Témoignages** : ajout / modification / suppression / réordre
  (nom, fonction, texte, photo optionnelle). API : `GET /api/testimonials`
  (public), `POST` / `PUT /:id` / `DELETE /:id` (admin).
- **Statistiques** (ex. « 25+ années d'expérience ») : liste éditable
  (valeur + libellé). API : `GET /api/site-stats` (public), CRUD (admin).
- **Section « À propos »** : titre, texte, photo optionnelle
  (`POST /api/site-settings/about-photo`, admin).
- **Bandeau d'appel à l'action** : titre, texte, libellé du bouton ;
  **titres des sections** « Domaines de pratique » et « Témoignages » ;
  **bascule d'affichage** par section (hero, à propos, domaines, témoignages,
  contact).

## Blog SEO (articles des avocats, référencés par Google)

La SPA étant invisible pour les moteurs de recherche, le blog est **rendu côté
serveur** en HTML sémantique : les articles publiés sont lisibles par Google
sans JavaScript. Les pages `/blog` et `/blog/:slug` affichent le **menu public
complet** (logo, navigation, FR/EN, tiroir mobile, « Mon espace »), identique à
la page d'accueil.

**Côté avocat** (vue **Blog** dans l'application, permission `posts.create`) :
- liste des articles (publiés / brouillons / tous), **éditeur visuel WYSIWYG**
  (gras, italique, souligné, barré ; titres H1–H3 ; polices serif / sans /
  monospace ; tailles ; couleurs de texte et surlignage ; alignements ;
  listes ; citations ; liens ; images par téléversement ou URL — cliquer une
  image affiche ses réglages : taille petit / moyen / grand / pleine largeur,
  alignement, suppression), couverture optionnelle, boutons **Publier** /
  **Brouillon** ;
- modification par l'auteur ou un administrateur ; suppression ;
- lien « Voir le blog public » vers `/blog`.

**Pages publiques SSR** (aucun JS requis) :
- `GET /blog` — liste des articles publiés (titre, extrait, couverture, date, auteur) ;
- `GET /blog/:slug` — article complet : `<article>` sémantique, balise `<h1>`,
  meta description, **Open Graph** (titre / description / image), URL canonique,
  auteur + date ; slug inconnu → page 404 ;
- `GET /sitemap.xml` — `/`, `/blog` et chaque article publié
  (base d'URL via la variable d'environnement `SITE_URL`, sinon l'hôte de la requête) ;
- `GET /robots.txt` — autorise tout et référence le sitemap.

Le HTML de l'éditeur est **nettoyé côté serveur** (liste blanche : `p`, `h1`–`h3`,
`strong`, `em`, `u`, `s`, `ul`/`ol`/`li`, `blockquote`, `a[href]`,
`img[src,alt,class]`, `figure`, `span`/`div` avec styles et classes limités —
scripts, gestionnaires `on*` et URLs `javascript:` supprimés). Les images
insérées dans le corps passent par `POST /api/blog/images` (mêmes règles de
validation que les couvertures : types PNG/JPG/GIF/WebP, 8 Mo max). Le slug est
généré automatiquement depuis le titre (suffixe `-2`, `-3`… en cas de conflit).

**Publications multi-photos** : une publication accepte désormais jusqu'à
**10 images** (champ `images` en multipart, mêmes règles de validation que
l'image unique). L'API renvoie `images: [{ id, url }]` et conserve `imageUrl`
(première image) pour compatibilité. Dans l'application, les publications
s'affichent comme des **cartes style Instagram** : avatar de l'auteur avec anneau
doré, carrousel avec pastilles et compteur, barre d'actions (j'aime, commenter,
partager, sauvegarder en local), « X mentions j'aime », légende tronquée avec
« voir plus », et menu ••• pour les actions du propriétaire.

## Assistant IA (Gemini ou OpenAI)

L'assistant documentaire (recherche RAG sur vos documents + réponses avec sources citées)
fonctionne avec une API cloud — aucune installation locale requise, il marche aussi bien
en local que sur le site déployé. **Une seule clé suffit** : elle sert à la fois pour
les réponses et pour l'indexation RAG.

| Fournisseur | `LLM_PROVIDER` | Clé gratuite / obtention | Modèles par défaut |
|---|---|---|---|
| Google Gemini (défaut) | `gemini` | https://aistudio.google.com → Get API Key | `gemini-2.5-flash` / `text-embedding-004` |
| OpenAI | `openai` | https://platform.openai.com/api-keys | `gpt-4o-mini` / `text-embedding-3-small` |

1. Choisissez votre fournisseur et copiez votre clé.
2. Définissez les variables d'environnement :

```bash
LLM_PROVIDER=gemini        # ou openai
LLM_API_KEY=votre-cle-ici
```

Variables optionnelles (surcharges) :

| Variable | Rôle |
|---|---|
| `LLM_CHAT_MODEL` | Modèle de réponse (défaut selon le fournisseur) |
| `LLM_EMBED_MODEL` | Modèle d'embeddings pour la recherche RAG (défaut selon le fournisseur) |

Compatibilité : l'ancien nom `GEMINI_API_KEY` reste accepté comme repli quand
`LLM_PROVIDER=gemini`.

3. Redémarrez le backend. C'est tout : l'indexation des documents, les questions et les
sources citées fonctionnent immédiatement.

Tant que la clé n'est pas définie, `GET /api/ai/status` renvoie `"configured": false`
et l'écran **Assistant IA** affiche un rappel de configuration au lieu du formulaire.
Aucun appel réseau n'est fait sans clé : aucun quota n'est consommé.

> Sur Render : renseignez `LLM_PROVIDER` et collez votre clé dans `LLM_API_KEY`
> (variables déjà déclarées dans `render.yaml`, valeur à saisir dans le tableau de bord).

**Confidentialité.** Les rôles restreints ne voient que leurs propres données : un avocat
n'interroge que ses dossiers, et un **client** n'interroge que ses propres dossiers —
jamais l'ensemble du cabinet. De plus, l'assistant d'un client ne répond qu'aux
questions juridiques concernant ses dossiers et refuse poliment tout autre sujet.

### Documents et RAG

Dans un dossier : **Dossiers → choisir le dossier → Documents → Ajouter un document**.

L'analyse RAG démarre automatiquement après l'envoi pour les PDF, DOCX et TXT. Si la clé
`LLM_API_KEY` n'est pas configurée, le document reste enregistré et le bouton
**Analyser maintenant** permet de relancer l'analyse après avoir ajouté la clé.

### Publications

Les **Administrateurs** et **Avocats** disposent du bouton **Publier** dans **Accueil**. Ils peuvent créer des publications ou articles. Seul l'auteur peut modifier ou supprimer sa propre publication. Les autres utilisateurs autorisés peuvent aimer, commenter et envoyer une publication par message.

### Dépannage rapide

- `Clé API manquante` : définissez `LLM_API_KEY` (voir section Assistant IA).
- Une publication n'apparaît pas : ouvrir **Accueil** puis utiliser **Réessayer**. L'API affiche maintenant l'erreur au lieu de laisser une page vide.

## Messagerie v2 — groupes, temps réel, pièces jointes

- **1-à-1 et groupes** : bouton « Nouveau groupe » (nom + membres + dossier lié en option).
  Seuls les membres peuvent lire/écrire ; pour les conversations liées à un dossier,
  seuls les utilisateurs pouvant voir ce dossier peuvent être ajoutés.
- **Temps réel léger** : la conversation ouverte se recharge toutes les 5 s
  (sans WebSocket) + indicateur « en train d’écrire… ».
- **Badges non-lus** : compteur sur l’onglet Messages et par conversation.
- **Accusés de lecture** : « Vu » / « Vu par N » sous vos messages.
- **Pièces jointes** : joindre un document existant (lisible par vous) ou téléverser
  un fichier depuis le composeur (mêmes types/tailles que les documents : 25 Mo max).
- **Recherche** : loupe en haut de la vue Messages, limitée à vos conversations.
- **Discussions du dossier** : la fiche d’un dossier liste les conversations de groupe
  qui lui sont liées.

## Si une ancienne session reste bloquée
Après une mise à jour majeure, si le navigateur conserve un ancien jeton, cliquez sur **Se déconnecter** ou, sur l'écran de connexion, ouvrez les outils du navigateur et supprimez la clé `cej:session` du stockage local. Une nouvelle connexion créera automatiquement une nouvelle session.

## Déploiement sur Render (Blueprint)

Le dépôt est prêt à déployer tel quel via `render.yaml` (service web Docker + disque
persistant). La base SQLite est créée et migrée **automatiquement au démarrage du
serveur** (`ensureDatabase()` dans `src/server.js`) : aucune migration manuelle n'est
requise en production.

1. Sur Render : **New → Blueprint**, sélectionnez ce dépôt.
2. Render crée le service web `cabinet-elite-juridique` (plan Starter) avec :
   - un **disque persistant** `cej-data` monté sur `/app/backend/data` (la base SQLite et
     les documents téléversés y survivent aux redéploiements) ;
   - `DATABASE_PATH=/app/backend/data/cabinet-elite.db` et
     `UPLOAD_DIR=/app/backend/data/uploads` déjà configurés ;
   - `JWT_ACCESS_SECRET` généré aléatoirement.
3. Après le déploiement, vérifiez que `CORS_ORIGINS` correspond à l'URL publique réelle
   du service (`https://<nom-du-service>.onrender.com`) : le frontend et l'API étant
   servis par le même processus, le navigateur envoie cette origine.
4. Santé : `GET /api/health` → `{"status":"ok"}` (utilisé comme health check Render).

> **Note cold start (offre gratuite) :** au premier accès après une mise en veille,
> Render peut prendre ~30 s à réveiller le service.

## Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `JWT_ACCESS_SECRET` | oui | Signature des jetons d'accès JWT (généré par Render via `generateValue`). |
| `DATABASE_PATH` | non | Chemin du fichier SQLite (défaut : `./data/cabinet-elite.db`, relatif à `backend/`). Ancien nom `SQLITE_DB_PATH` toujours accepté. |
| `UPLOAD_DIR` | non | Dossier des documents téléversés (défaut : `./uploads`). |
| `PORT` | non | Port d'écoute (Render l'impose automatiquement). |
| `CORS_ORIGINS` | non | Origines autorisées, séparées par des virgules (défaut : origines localhost). |
| `SMTP_HOST` | non | Hôte SMTP pour les courriels d'échéances (sans lui, les courriels sont désactivés silencieusement). |
| `SMTP_PORT` | non | Port SMTP (défaut `587` ; `465` = TLS implicite). |
| `SMTP_USER` / `SMTP_PASS` | non | Identifiants SMTP. |
| `MAIL_FROM` | non | Expéditeur des courriels (défaut : `Cabinet Élite Juridique <no-reply@cabinet-elite.example>`). |

## Rappels d'échéances par courriel

Un contrôle quotidien tourne dans le serveur (`setInterval` 24 h + une exécution ~1 min
après le démarrage, voir `src/services/deadlines.js`) :
- dossiers dus sous 3 jours ou en retard → courriel + notification in-app à l'avocat
  responsable (ou aux admins si non assigné) ;
- factures en retard → courriel + notification aux comptables.

Sans `SMTP_HOST` configuré, seuls les rappels in-app sont émis : l'application
fonctionne normalement.
