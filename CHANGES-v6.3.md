# v6.3 — Nom de site Google + description (correctif SEO)

Problème : dans les résultats Google, le site apparaissait avec le nom
« Render » (l'hébergeur) au-dessus de l'URL, et la page d'accueil affichait
comme description le texte de chargement (« Chargement de l'application…
JavaScript est désactivé »), faute de signaux explicites.

## Changements

### frontend/index.html (page d'accueil)
- Ajout d'une vraie `<meta name="description">` (droit minier, OHADA,
  fiscal, foncier — RDC).
- Ajout des balises Open Graph : `og:type`, `og:site_name`
  (« Cabinet Élite Juridique »), `og:title`, `og:description`, `og:url`,
  `og:locale`.
- Ajout des balises Twitter Card (title + description).
- Ajout des données structurées JSON-LD `WebSite` avec
  `name: "Cabinet Élite Juridique"` — c'est le signal que Google utilise
  en priorité pour le nom de site dans les résultats.

### backend/src/blog-ssr.js (pages /blog et articles)
- `pageShell()` émet maintenant `og:site_name` (nom du cabinet depuis les
  réglages) sur toutes les pages du blog.

## Effet attendu
Après déploiement et recrawl par Google (quelques jours), le résultat
affichera « Cabinet Élite Juridique » au lieu de « Render », avec la
nouvelle description sous le lien. On peut accélérer en redemandant
l'indexation de la page d'accueil dans la Search Console après déploiement.

## Tests
- `node --check` OK sur blog-ssr.js.
- Suite complète : 230/230 tests réussis.
