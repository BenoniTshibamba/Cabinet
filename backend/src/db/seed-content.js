/**
 * Contenu de démarrage RÉEL pour la production (Afrique / RDC).
 *
 * `npm run seed:content` — idempotent : chaque élément est ignoré s'il existe
 * déjà (par slug ou par titre). Tout le contenu est ORIGINAL, rédigé pour ce
 * projet ; les analyses publiques de Me Edmond Cibamba Diata sont citées en
 * source avec lien (jamais copiées).
 *
 * Utilisation :
 *   npm run seed:content
 */
import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './pool.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(HERE, '..', '..', 'seed-assets');
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads');

const SOURCE_TEAM = 'https://cabelitelaw.com/fr/qui-sommes-nous/lequipe/edmond-cibamba-diata/';
const SOURCE_CODE_MINIER = 'https://doseco.cd/2026/09/30/industrialisation-de-la-rdc-me-edmond-cibamba-appelle-a-une-application-coherente-du-code-minier/';

/* ------------------------------------------------------------------ */
/* 5. Images de démarrage (photo "À propos" + couvertures de blog)      */
/*    Idempotent : ne touche que les éléments sans image existante.     */
/* ------------------------------------------------------------------ */

const ARTICLE_COVERS = {
  'code-minier-rdc-application-coherente': 'blog-code-minier.jpg',
  'droit-ohada-investisseurs-rdc': 'blog-ohada.jpg',
  'fiscalite-miniere-rdc-anticiper': 'blog-fiscalite.jpg',
};

/** Diaporama d'accueil par défaut (5 images, modifiables dans Personnalisation). */
const HERO_DEFAULTS = [
  'hero-kinshasa.jpg',
  'hero-office.jpg',
  'hero-mine.jpg',
  'hero-justice.jpg',
  'hero-meeting.jpg',
];

function installAsset(fileName, destRel) {
  const src = path.join(ASSETS_DIR, fileName);
  if (!fs.existsSync(src)) {
    console.log(`! asset manquant : ${fileName} (ignoré).`);
    return null;
  }
  const dest = path.join(UPLOAD_DIR, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
  return destRel;
}

async function seedImages() {
  // Photo "À propos" par défaut (modifiable dans Personnalisation).
  const { rows: s } = await query('SELECT about_photo_path FROM site_settings WHERE id = 1');
  if (!s[0]?.about_photo_path) {
    const rel = installAsset('about-kinshasa-law.jpg', 'branding/about-default.jpg');
    if (rel) {
      await query('UPDATE site_settings SET about_photo_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [rel]);
      console.log('✓ photo « À propos » par défaut installée.');
    }
  } else {
    console.log('✓ photo « À propos » : déjà définie, rien à faire.');
  }

  // Couvertures des articles de blog de démarrage.
  let covers = 0;
  for (const [slug, file] of Object.entries(ARTICLE_COVERS)) {
    const { rows } = await query('SELECT id, cover_filename FROM blog_posts WHERE slug = $1', [slug]);
    if (!rows[0] || rows[0].cover_filename) continue;
    const destName = `seed-${slug}.jpg`;
    const rel = installAsset(file, `blog-covers/${destName}`);
    if (rel) {
      await query('UPDATE blog_posts SET cover_filename = $1, cover_mime = $2 WHERE id = $3', [destName, 'image/jpeg', rows[0].id]);
      covers++;
    }
  }
  console.log(`✓ couvertures de blog : ${covers} installée(s).`);

  // Diaporama d'accueil par défaut : remplit seulement les emplacements vides
  // (ne touche jamais aux images téléversées par l'admin).
  let heroJson = '[]';
  try {
    const { rows: sh } = await query('SELECT hero_images FROM site_settings WHERE id = 1');
    heroJson = sh[0]?.hero_images ?? '[]';
  } catch { /* colonne absente sur très vieille base : la migration la créera au prochain boot */ }
  let hero = [];
  try { hero = JSON.parse(heroJson); } catch { hero = []; }
  if (!Array.isArray(hero)) hero = [];
  hero = [0, 1, 2, 3, 4].map((i) => (typeof hero[i] === 'string' && hero[i].trim() ? hero[i].trim() : null));
  let heroAdded = 0;
  for (let i = 0; i < 5; i++) {
    if (hero[i]) continue;
    const rel = installAsset(HERO_DEFAULTS[i], `branding/hero-default-${i + 1}.jpg`);
    if (rel) { hero[i] = rel; heroAdded++; }
  }
  if (heroAdded) {
    await query('UPDATE site_settings SET hero_images = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [JSON.stringify(hero)]);
  }
  console.log(`✓ diaporama d'accueil : ${heroAdded} image(s) par défaut installée(s).`);
}

/* ------------------------------------------------------------------ */
/* 1. Paramètres du site : valeurs réelles (Kinshasa, RDC)              */
/* ------------------------------------------------------------------ */

async function seedSiteSettings() {
  // Ne remplit que les champs encore vides ou restés aux anciens défauts
  // canadiens : on n'écrase jamais une personnalisation de l'admin.
  const { rows } = await query('SELECT * FROM site_settings WHERE id = 1');
  if (!rows[0]) {
    await query('INSERT INTO site_settings (id) VALUES (1)');
  }
  const s = (await query('SELECT * FROM site_settings WHERE id = 1')).rows[0];
  const updates = [];
  const params = [];
  const set = (col, val) => {
    updates.push(`${col} = $${params.length + 1}`);
    params.push(val);
  };

  if (!String(s.about_text || '').trim()) {
    set('about_text', `Basé à Kinshasa, notre cabinet accompagne les entreprises et les particuliers dans leurs enjeux juridiques les plus exigeants. Forts d'une expertise reconnue en droit minier et en droit des affaires (OHADA), nous conseillons investisseurs, opérateurs et institutions sur l'ensemble du territoire de la République démocratique du Congo — de la structuration des projets à la gestion des contentieux.`);
  }
  if (!String(s.address_street || '').trim()) set('address_street', `Avenue Lukusa n°50, Immeuble L'Horizon, Suite 203`);
  if (['Montréal', ''].includes(String(s.address_city || '').trim())) set('address_city', 'Kinshasa');
  if (['Québec', ''].includes(String(s.address_province || '').trim())) set('address_province', 'Kinshasa');
  if (['Canada', ''].includes(String(s.address_country || '').trim())) set('address_country', 'République démocratique du Congo');
  if (String(s.contact_email || '').trim() === 'contact@cabinet-elite.example') set('contact_email', 'tshibambabenoni@gmail.com');

  if (updates.length) {
    await query(`UPDATE site_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`, params);
    console.log(`✓ site_settings : ${updates.length} champ(s) initialisé(s).`);
  } else {
    console.log('✓ site_settings : déjà personnalisé, rien à faire.');
  }
}

/* ------------------------------------------------------------------ */
/* 2. Domaines de pratique                                              */
/* ------------------------------------------------------------------ */

const PRACTICE_AREAS = [
  {
    title: 'Droit minier et carrières',
    description: `Accompagnement des opérateurs miniers à chaque étape : obtention et gestion des droits miniers auprès du Cadastre minier, conformité aux obligations du Code minier, conventions et partenariats avec l'État.`,
  },
  {
    title: 'Droit des affaires (OHADA)',
    description: `Structuration juridique des activités commerciales dans l'espace OHADA : actes uniformes, garanties, recouvrement et sécurisation des transactions.`,
  },
  {
    title: 'Droit commercial',
    description: `Contrats commerciaux, distribution, concurrence et protection des intérêts des entreprises dans leurs opérations quotidiennes.`,
  },
  {
    title: 'Fiscalité minière',
    description: `Optimisation et sécurisation fiscale des projets miniers : analyse des régimes fiscaux et douaniers, gestion des contentieux avec les administrations.`,
  },
  {
    title: 'Droit des sociétés',
    description: `Création, gouvernance et restructuration des sociétés : statuts, pactes d'associés, fusions, acquisitions et joint-ventures.`,
  },
  {
    title: 'Contentieux et arbitrage',
    description: `Défense de vos intérêts devant les cours et tribunaux congolais ainsi qu'en arbitrage, notamment devant la Cour Commune de Justice et d'Arbitrage (CCJA).`,
  },
];

async function seedPracticeAreas() {
  let added = 0;
  for (let i = 0; i < PRACTICE_AREAS.length; i++) {
    const a = PRACTICE_AREAS[i];
    const { rows } = await query('SELECT id FROM practice_areas WHERE title = $1', [a.title]);
    if (rows[0]) continue;
    await query('INSERT INTO practice_areas (title, description, position) VALUES ($1, $2, $3)', [a.title, a.description, i]);
    added++;
  }
  console.log(`✓ domaines de pratique : ${added} ajouté(s).`);
}

/* ------------------------------------------------------------------ */
/* 3. Publications (fil d'accueil) — contenu ORIGINAL                   */
/* ------------------------------------------------------------------ */

const POSTS = [
  {
    title: 'Le Code minier congolais : l\'application avant tout',
    content: `Le Code minier de 2018 a modernisé le cadre juridique du secteur minier congolais. Mais une loi, aussi ambitieuse soit-elle, ne produit ses effets que si elle est appliquée de façon cohérente par l'ensemble des acteurs : administrations, opérateurs et conseils.

C'est le sens des analyses développées par Me Edmond Cibamba Diata, qui appelle à une application rigoureuse et prévisible du Code minier comme condition de l'industrialisation de la RDC.

Notre cabinet accompagne les opérateurs dans la lecture concrète de ces textes : droits miniers, obligations, fiscalité et gestion des contentieux.

Lire la source : ${SOURCE_CODE_MINIER}`,
    type: 'POST',
  },
  {
    title: 'OHADA : un cadre unique pour vos affaires en Afrique',
    content: `Le droit OHADA offre aux entreprises un cadre juridique harmonisé dans 17 États africains, dont la RDC. Actes uniformes sur le droit commercial général, les sociétés commerciales, les sûretés : autant d'outils pour sécuriser vos investissements.

Encore faut-il les manier avec précision. Notre équipe vous aide à structurer vos opérations — contrats, garanties, gouvernance — en conformité avec les Actes uniformes.

En savoir plus sur notre expertise : ${SOURCE_TEAM}`,
    type: 'POST',
  },
  {
    title: 'Fiscalité minière : anticiper plutôt que subir',
    content: `La fiscalité minière congolaise combine redevances, impôts et obligations parafiscales. Une mauvaise anticipation peut fragiliser tout un projet.

Notre approche : auditer votre situation en amont, comparer les régimes applicables et vous défendre en cas de contentieux avec les administrations fiscales.

Parlons de votre projet : prenez contact avec le cabinet via le formulaire ci-dessous.`,
    type: 'POST',
  },
  {
    title: 'Arbitrage CCJA : régler les litiges d\'affaires efficacement',
    content: `La Cour Commune de Justice et d'Arbitrage (CCJA) offre aux entreprises de l'espace OHADA une voie d'arbitrage adaptée aux litiges commerciaux.

Me Edmond Cibamba Diata figure sur la liste des arbitres de la CCJA et intervient régulièrement dans la résolution des contentieux d'affaires, tant devant les juridictions que par voie arbitrale.

Un litige ? Évaluez vos options avec nous.

Découvrir le parcours : ${SOURCE_TEAM}`,
    type: 'POST',
  },
];

async function seedPosts(authorId) {
  let added = 0;
  for (const p of POSTS) {
    const { rows } = await query('SELECT id FROM posts WHERE title = $1', [p.title]);
    if (rows[0]) continue;
    await query('INSERT INTO posts (author_id, title, content, type) VALUES ($1, $2, $3, $4)', [authorId, p.title, p.content, p.type]);
    added++;
  }
  console.log(`✓ publications : ${added} ajoutée(s).`);
}

/* ------------------------------------------------------------------ */
/* 3b. Analyses juridiques de l'avocat (Me Edmond Tshibamba) — contenu   */
/*     ORIGINAL, fondé sur l'actualité juridique congolaise. Idempotent :  */
/*     les anciens posts génériques sont retirés, les nouveaux ignorés     */
/*     s'ils existent déjà (même titre).                                   */
/* ------------------------------------------------------------------ */

const EDMOND_POSTS = [
  {
    title: "Loi sur le référendum : l'analyse après la décision de la Cour constitutionnelle",
    content: `Par son arrêt R.Const. 2695 du 28 juillet 2026, la Cour constitutionnelle a déclaré la loi sur le référendum conforme à la Constitution — mais sous treize réserves, portant sur les articles 3, 4, 5, 7, 8, 9, 10, 12, 14, 19, 21, 23 et 43.

Deux apports méritent l'attention des praticiens. D'abord, toute initiative en faveur d'une nouvelle Constitution devra être précédée d'une pétition nationale d'au moins 250 000 signatures. Ensuite, la Cour encadre le recours présidentiel au référendum en cas de dysfonctionnement des institutions : une commission nationale multidisciplinaire devra évaluer la situation et formuler les questions dans un délai de trente jours.

Le 10 août 2026, le Président de la République a renvoyé le texte au Parlement pour une nouvelle délibération (article 137 de la Constitution), inscrite à la session de septembre 2026. Au-delà de la technique, l'enjeu est connu : l'article 220, qui verrouille toute révision touchant aux mandats présidentiels.

Pour les entreprises, la leçon est simple : la stabilité institutionnelle conditionne la sécurité des investissements. Nous suivons ce dossier de près.

— Me Edmond Tshibamba, avocat`,
    type: 'POST',
  },
  {
    title: "Loi n°26/018 sur le contenu local : ce que les entreprises doivent anticiper",
    content: `Promulguée le 30 juin 2026, la loi n°26/018 relative au contenu local change les règles du jeu bien au-delà des mines et des hydrocarbures : marchés publics, banques, assurances, distribution, télécoms et services sont désormais concernés.

Les obligations portent sur l'emploi et les compétences nationales, les achats locaux, le transfert de technologie — et, disposition la plus sensible, l'ouverture du capital à des personnes physiques congolaises.

Le 13 août 2026, le ministre de l'Entrepreneuriat a réuni l'ARSP et l'ARMP pour traduire le texte en mesures concrètes : les modalités d'application sont en cours d'élaboration. C'est précisément dans cette phase transitoire que les entreprises avisées agissent : audit de conformité de la chaîne de sous-traitance, cartographie des achats locaux, structuration du capital.

Attendre les décrets d'application pour se mettre en conformité, c'est déjà être en retard. Anticiper, c'est notre métier.

— Me Edmond Tshibamba, avocat`,
    type: 'POST',
  },
  {
    title: "Tribunal pénal économique et financier : ce qui change pour les dirigeants",
    content: `L'ordonnance-loi promulguée le 14 mars 2026 crée une juridiction spécialisée basée à Kinshasa : le Tribunal pénal économique et financier, organisé en deux chambres (première instance et appel), compétent à titre exclusif pour les infractions économiques et financières.

Sont visées la corruption et les pratiques assimilées, les détournements de fonds publics et la concussion commis par des personnes investies d'un mandat public ou chargées d'un service public, ainsi que la contrefaçon et la falsification des signes monétaires.

Cette réforme, aboutissement du chantier engagé par l'ancien ministre de la Justice, resserre l'étau autour de la délinquance économique. Pour les dirigeants d'entreprises et les gestionnaires publics, le message est clair : la conformité interne n'est plus une option. Procédures de contrôle, traçabilité des flux, formation des équipes — les entreprises qui s'y préparent aujourd'hui éviteront les contentieux de demain.

Notre cabinet accompagne les opérateurs dans cette mise en conformité.

— Me Edmond Tshibamba, avocat`,
    type: 'POST',
  },
];

const OLD_META_POST_TITLES = [
  'Bienvenue sur le nouveau site du cabinet',
  'Droit minier et droit des affaires : notre double expertise',
  'Suivez nos publications : analyses et actualités du cabinet',
];

async function seedEdmondPosts() {
  // Retire les anciens posts génériques (et leurs images) s'ils existent.
  for (const title of OLD_META_POST_TITLES) {
    const { rows } = await query('SELECT id FROM posts WHERE title = $1', [title]);
    if (rows[0]) {
      await query('DELETE FROM post_images WHERE post_id = $1', [rows[0].id]);
      await query('DELETE FROM post_likes WHERE post_id = $1', [rows[0].id]);
      await query('DELETE FROM post_comments WHERE post_id = $1', [rows[0].id]);
      await query('DELETE FROM posts WHERE id = $1', [rows[0].id]);
    }
  }
  // Auteur : Me Edmond Tshibamba si présent, sinon le premier admin.
  let edmondId = null;
  const { rows: ed } = await query(`SELECT id FROM users WHERE email = 'e.tshibamba@cabinet-elite.example' LIMIT 1`);
  if (ed[0]) edmondId = ed[0].id;
  if (!edmondId) {
    const { rows: admins } = await query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('SUPER_ADMIN','ADMIN') ORDER BY u.id LIMIT 1`,
    );
    edmondId = admins[0]?.id ?? null;
  }
  if (!edmondId) { console.log('! Aucun auteur trouvé pour les analyses juridiques.'); return; }
  let added = 0;
  for (const p of EDMOND_POSTS) {
    const { rows } = await query('SELECT id FROM posts WHERE title = $1', [p.title]);
    if (rows[0]) continue;
    await query('INSERT INTO posts (author_id, title, content, type) VALUES ($1, $2, $3, $4)', [edmondId, p.title, p.content, p.type]);
    added++;
  }
  console.log(`✓ analyses juridiques de l'avocat : ${added} ajoutée(s).`);
}

/* Photos jointes aux analyses juridiques (via le circuit normal
 * post-images, pour qu'elles s'affichent dans le fil). Idempotent. */
const EDMOND_POST_IMAGES = {
  "Loi sur le référendum : l'analyse après la décision de la Cour constitutionnelle": ['hero-justice.jpg', 'hero-kinshasa.jpg'],
  'Loi n°26/018 sur le contenu local : ce que les entreprises doivent anticiper': ['hero-mine.jpg', 'hero-office.jpg'],
  'Tribunal pénal économique et financier : ce qui change pour les dirigeants': ['hero-meeting.jpg', 'about-kinshasa-law.jpg'],
};

async function seedEdmondPostImages() {
  let added = 0;
  let n = 0;
  for (const [title, files] of Object.entries(EDMOND_POST_IMAGES)) {
    const { rows } = await query('SELECT id FROM posts WHERE title = $1', [title]);
    if (!rows[0]) continue;
    const postId = rows[0].id;
    const { rows: existing } = await query('SELECT id FROM post_images WHERE post_id = $1 LIMIT 1', [postId]);
    if (existing[0]) continue;
    for (const [i, file] of files.entries()) {
      n++;
      const destName = `seed-edmond-post-${n}.jpg`;
      const rel = installAsset(file, `post-images/${destName}`);
      if (!rel) continue;
      await query('INSERT INTO post_images (post_id, filename, mime, position) VALUES ($1, $2, $3, $4)',
        [postId, destName, 'image/jpeg', i]);
      added++;
    }
  }
  console.log(`✓ photos des analyses juridiques : ${added} ajoutée(s).`);
}

/* ------------------------------------------------------------------ */
/* 4. Articles de blog (WYSIWYG HTML) — contenu ORIGINAL                 */
/* ------------------------------------------------------------------ */

const ARTICLES = [
  {
    slug: 'code-minier-rdc-application-coherente',
    title: `Code minier congolais : pourquoi l'application cohérente change tout`,
    excerpt: `Le Code minier de 2018 a modernisé le secteur. Reste l'essentiel : une application cohérente et prévisible, condition de l'industrialisation de la RDC.`,
    contentHtml: `<p>La République démocratique du Congo dispose depuis 2018 d'un Code minier modernisé, fruit d'une révision ambitieuse du texte de 2002. Ce nouveau cadre visait à mieux répartir la rente minière, à renforcer les obligations des opérateurs et à donner à l'État les moyens de ses ambitions industrielles.</p><h2>Une loi ne suffit pas</h2><p>Mais une loi, aussi bien conçue soit-elle, ne produit ses effets que si elle est appliquée de façon cohérente. Les opérateurs — congolais comme étrangers — ont besoin de prévisibilité : des règles stables, des administrations qui les appliquent uniformément, et des mécanismes de règlement des différends qui fonctionnent.</p><p>C'est précisément le sens des analyses développées par <strong>Me Edmond Cibamba Diata</strong>, avocat à la Cour d'appel de Kinshasa/Matete et mandataire en mines et carrières, qui appelle à une application rigoureuse du Code minier comme levier d'industrialisation du pays.</p><h2>Ce que cela implique pour les opérateurs</h2><ul><li><strong>Sécuriser ses droits miniers</strong> : obtention, renouvellement et gestion des titres auprès du Cadastre minier ;</li><li><strong>Anticiper la fiscalité</strong> : redevances, impôts et obligations parafiscales doivent être intégrés dès la structuration du projet ;</li><li><strong>Préparer le contentieux</strong> : en cas de différend avec l'administration ou un partenaire, une stratégie juridictionnelle ou arbitrale claire fait toute la différence.</li></ul><h2>Notre accompagnement</h2><p>Notre cabinet, fort de près de trois décennies de pratique du droit minier congolais, accompagne les opérateurs dans la lecture concrète de ces textes — de l'obtention des droits à la gestion des contentieux, en passant par les études comparatives de régimes fiscaux.</p><h2>Sources / Pour aller plus loin</h2><p>D'après les analyses de Me Edmond Cibamba Diata :</p><ul><li><a href="${SOURCE_CODE_MINIER}">Industrialisation de la RDC : appel à une application cohérente du Code minier</a> (Doseco.cd)</li><li><a href="${SOURCE_TEAM}">Parcours de Me Edmond Cibamba Diata — Elite Law Firm</a></li></ul>`,
  },
  {
    slug: 'droit-ohada-investisseurs-rdc',
    title: `Droit OHADA : le socle juridique des investissements en RDC`,
    excerpt: `Le droit harmonisé de l'OHADA sécurise les affaires dans 17 États africains. Voici ce que les investisseurs en RDC doivent en retenir.`,
    contentHtml: `<p>L'Organisation pour l'Harmonisation en Afrique du Droit des Affaires (OHADA) offre aux entreprises un droit unifié dans 17 États africains, dont la République démocratique du Congo. Pour un investisseur, c'est un atout considérable : les mêmes règles du jeu, d'Abidjan à Kinshasa.</p><h2>Les Actes uniformes essentiels</h2><ul><li><strong>Droit commercial général</strong> : statut du commerçant, registre du commerce, contrats commerciaux ;</li><li><strong>Droit des sociétés commerciales</strong> : création et gouvernance des SARL, SA et autres formes sociales ;</li><li><strong>Sûretés</strong> : hypothèques, nantissements et garanties pour sécuriser le crédit ;</li><li><strong>Recouvrement et voies d'exécution</strong> : procédures simplifiées de recouvrement des créances.</li></ul><h2>La CCJA, un atout décisif</h2><p>La Cour Commune de Justice et d'Arbitrage (CCJA) complète le dispositif : elle tranche les litiges d'interprétation du droit OHADA et propose une voie d'arbitrage adaptée aux contentieux commerciaux. Me Edmond Cibamba Diata figure sur la liste des arbitres de la CCJA et y intervient régulièrement.</p><h2>Structurer son investissement</h2><p>Un investissement réussi en RDC combine le droit OHADA (sociétés, contrats, sûretés) et le droit national congolais (fiscalité, change, secteur d'activité — notamment minier). Notre cabinet articule ces deux niveaux pour sécuriser vos projets de bout en bout.</p><h2>Sources / Pour aller plus loin</h2><p>D'après les analyses de Me Edmond Cibamba Diata :</p><ul><li><a href="${SOURCE_TEAM}">Parcours de Me Edmond Cibamba Diata — Elite Law Firm</a></li><li><a href="${SOURCE_CODE_MINIER}">Application cohérente du Code minier et industrialisation</a> (Doseco.cd)</li></ul>`,
  },
  {
    slug: 'fiscalite-miniere-rdc-anticiper',
    title: `Fiscalité minière en RDC : anticiper plutôt que subir`,
    excerpt: `Redevances, impôts, obligations parafiscales : la fiscalité minière congolaise exige une anticipation rigoureuse. Tour d'horizon.`,
    contentHtml: `<p>La fiscalité applicable aux projets miniers en République démocratique du Congo combine plusieurs couches : redevance minière, impôt sur les bénéfices, droits de douane sur les équipements, et diverses obligations parafiscales. Une mauvaise anticipation peut fragiliser l'équilibre économique de tout un projet.</p><h2>Comparer les régimes</h2><p>Les compagnies opérant sous d'anciennes conventions minières et celles relevant du Code minier de 2018 ne sont pas soumises aux mêmes avantages fiscaux et douaniers. Des études comparatives rigoureuses — telles que celles menées par Me Edmond Cibamba Diata au profit d'opérateurs miniers — permettent d'identifier le régime le plus favorable et de sécuriser les choix d'investissement.</p><h2>Gérer le contentieux fiscal</h2><p>Les différends avec les administrations (DGI, DGRAD et autres) sont fréquents dans le secteur. Une documentation solide, une lecture précise des textes et une stratégie de négociation ou de recours bien préparée font souvent la différence entre un redressement subi et un différend résolu.</p><h2>Notre méthode</h2><ul><li>Audit fiscal et douanier du projet en amont ;</li><li>Structuration optimisée dans le respect des textes ;</li><li>Assistance et représentation en cas de contrôle ou de contentieux.</li></ul><h2>Sources / Pour aller plus loin</h2><p>D'après les analyses de Me Edmond Cibamba Diata :</p><ul><li><a href="${SOURCE_TEAM}">Parcours de Me Edmond Cibamba Diata — Elite Law Firm</a></li><li><a href="${SOURCE_CODE_MINIER}">Application cohérente du Code minier</a> (Doseco.cd)</li></ul>`,
  },
];

async function seedArticles(authorId) {
  let added = 0;
  for (const a of ARTICLES) {
    const { rows } = await query('SELECT id FROM blog_posts WHERE slug = $1', [a.slug]);
    if (rows[0]) continue;
    await query(
      `INSERT INTO blog_posts (slug, title, excerpt, content_html, author_id, status, published_at)
       VALUES ($1, $2, $3, $4, $5, 'published', CURRENT_TIMESTAMP)`,
      [a.slug, a.title, a.excerpt, a.contentHtml, authorId],
    );
    added++;
  }
  console.log(`✓ articles de blog : ${added} publié(s).`);
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log('→ Contenu de démarrage réel (RDC) — idempotent\n');

  // Auteur : le premier administrateur disponible.
  const { rows: admins } = await query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('SUPER_ADMIN','ADMIN') ORDER BY u.id LIMIT 1`,
  );
  const authorId = admins[0]?.id ?? null;
  if (!authorId) {
    console.log('! Aucun administrateur trouvé : créez d\'abord un compte admin (ou lancez le serveur une fois), puis relancez.');
  }

  await seedSiteSettings();
  await seedPracticeAreas();
  if (authorId) {
    await seedPosts(authorId);
    await seedEdmondPosts();
    await seedEdmondPostImages();
    await seedArticles(authorId);
  } else {
    console.log('! Publications et articles ignorés (aucun auteur admin).');
  }
  await seedImages();
  console.log('\nTerminé.');
}

main()
  .catch((e) => { console.error('ERREUR :', e.message); process.exitCode = 1; })
  .finally(() => pool.end());
