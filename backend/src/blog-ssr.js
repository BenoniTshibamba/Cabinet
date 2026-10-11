import { query } from './db/pool.js';
import { sanitizeHtml } from './routes/blog.js';

/* ==========================================================================
   Pages blog rendues côté serveur (SSR) — lisibles par Google sans JavaScript.
   Montées AVANT express.static dans app.js.
   ========================================================================== */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function baseUrl(req) {
  const env = (process.env.SITE_URL || '').replace(/\/$/, '');
  if (env) return env;
  return `${req.protocol}://${req.get('host')}`;
}

async function firmInfo() {
  try {
    const { rows } = await query('SELECT firm_name, tagline, logo_path FROM site_settings WHERE id=1');
    return {
      name: rows[0]?.firm_name || 'Cabinet Élite Juridique',
      tagline: rows[0]?.tagline || '',
      logo: rows[0]?.logo_path ? `/uploads/branding/${rows[0].logo_path}` : null,
    };
  } catch {
    return { name: 'Cabinet Élite Juridique', tagline: '', logo: null };
  }
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
}

const BLOG_CSS = `
.blog-wrap{max-width:860px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
.blog-hero{border-bottom:2px solid #b08d3e;padding-bottom:1.25rem;margin-bottom:2rem}
.blog-hero h1{font-family:'Frank Ruhl Libre',Georgia,serif;font-size:2.2rem;color:#0f1e33;margin:0 0 .5rem}
.blog-hero p{color:#5a6472;margin:0}
.blog-card{display:flex;gap:1.25rem;padding:1.5rem 0;border-bottom:1px solid #e5e0d4}
.blog-card img{width:220px;height:150px;object-fit:cover;border-radius:10px;flex:none}
.blog-card h2{font-family:'Frank Ruhl Libre',Georgia,serif;font-size:1.45rem;margin:.1rem 0 .5rem;color:#0f1e33}
.blog-card h2 a{color:inherit;text-decoration:none}
.blog-card h2 a:hover{color:#b08d3e}
.blog-meta{font-size:.85rem;color:#8a8f98;margin-bottom:.5rem}
.blog-excerpt{color:#3c4450;line-height:1.65;margin:0}
.blog-read{color:#b08d3e;font-weight:600;text-decoration:none}
.blog-article h1{font-family:'Frank Ruhl Libre',Georgia,serif;font-size:2.4rem;color:#0f1e33;line-height:1.2;margin:0 0 .75rem}
.blog-cover{width:100%;max-height:420px;object-fit:cover;border-radius:12px;margin:1.5rem 0}
.blog-body{font-size:1.08rem;line-height:1.8;color:#2c3440;max-width:68ch}
.blog-body::after{content:"";display:block;clear:both}
.blog-body h2,.blog-body h3{font-family:'Frank Ruhl Libre',Georgia,serif;color:#0f1e33;margin:1.8em 0 .6em}
.blog-body p{margin:0 0 1.1em}
.blog-body ul,.blog-body ol{margin:0 0 1.1em;padding-left:1.5em}
.blog-body blockquote{border-left:3px solid #b08d3e;padding:.2em 0 .2em 1em;color:#5a6472;margin:0 0 1.1em}
.blog-body a{color:#0f1e33;text-decoration-color:#b08d3e}
.blog-body img{max-width:100%;height:auto;border-radius:10px}
.blog-body img.img-sm{width:25%}
.blog-body img.img-md{width:50%}
.blog-body img.img-lg{width:75%}
.blog-body img.img-full{width:100%}
.blog-body img.align-left{float:left;margin:0 1.2em 1em 0}
.blog-body img.align-right{float:right;margin:0 0 1em 1.2em}
.blog-body img.align-center{display:block;margin:1.2em auto}
.blog-body figure{margin:1.2em 0}
.blog-body figure.align-center{text-align:center}
.blog-body figcaption{font-size:.85rem;color:#8a8f98;text-align:center;margin-top:.4em}
.blog-body .align-left{text-align:left}
.blog-body .align-center{text-align:center}
.blog-body .align-right{text-align:right}
.blog-body .align-justify{text-align:justify}
.blog-404{text-align:center;padding:4rem 1rem}
@media(max-width:640px){.blog-card{flex-direction:column}.blog-card img{width:100%;height:200px}}
`;

/** Langue du visiteur pour les libellés de navigation (FR/EN) : ?lang=en ou Accept-Language. */
function reqLang(req) {
  if (String(req.query.lang || '').toLowerCase().startsWith('en')) return 'en';
  const al = String(req.headers['accept-language'] || '').split(',')[0] || '';
  return /^en\b/i.test(al.trim()) ? 'en' : 'fr';
}
/** Libellés du menu complet (identique à la page d'accueil), FR/EN. */
function navLabels(lang) {
  return lang === 'en'
    ? { home: 'Home', about: 'About', practice: 'Practice Areas', services: 'Services', blog: 'Blog', contact: 'Contact',
        mySpace: 'My Space', consultation: 'Consultation', clientSpace: 'Client Space', webApp: 'The Web App', menu: 'Menu', close: 'Close', theme: 'Toggle theme', lang: 'FR' }
    : { home: 'Accueil', about: 'À propos', practice: 'Domaines de pratique', services: 'Services', blog: 'Blog', contact: 'Contact',
        mySpace: 'Mon espace', consultation: 'Consultation', clientSpace: 'Espace client', webApp: "L'application", menu: 'Menu', close: 'Fermer', theme: 'Changer de thème', lang: 'EN' };
}

/** En-tête public complet (même menu que la page d'accueil) pour les pages blog SSR. */
function blogHeader(firm, lang) {
  const L = navLabels(lang);
  const other = lang === 'en' ? 'fr' : 'en';
  const logo = firm.logo ? `<img src="${esc(firm.logo)}" alt="">` : '';
  return `
  <header class="public-header">
    <div class="public-brand"><a href="/" style="display:flex;align-items:center;gap:.6rem;color:inherit;text-decoration:none">${logo}<span>${esc(firm.name)}</span></a></div>
    <nav class="public-nav">
      <a class="public-nav-link" href="/">${L.home}</a>
      <a class="public-nav-link" href="/">${L.about}</a>
      <a class="public-nav-link" href="/">${L.practice}</a>
      <div class="nav-drop">
        <button class="public-nav-link" type="button" id="blog-nav-svc" aria-haspopup="true" aria-expanded="false">${L.services} ▾</button>
        <div class="nav-drop-menu" id="blog-nav-svc-menu" hidden>
          <a class="nav-drop-item" href="/">${L.consultation}</a>
          <a class="nav-drop-item" href="/#/login">${L.clientSpace}</a>
          <a class="nav-drop-item" href="/#/web-app">${L.webApp}</a>
        </div>
      </div>
      <a class="public-nav-link" href="/blog">${L.blog}</a>
      <a class="public-nav-link" href="/">${L.contact}</a>
    </nav>
    <div class="public-header-actions">
      <button class="icon-btn" type="button" id="blog-theme-btn" aria-label="${L.theme}" title="${L.theme}">◐</button>
      <a class="btn btn-secondary lang-toggle" href="?lang=${other}" aria-label="Langue / Language">${L.lang}</a>
      <a class="btn btn-primary" href="/#/login">${L.mySpace}</a>
      <button class="icon-btn burger" type="button" id="blog-burger" aria-label="${L.menu}">☰</button>
    </div>
  </header>
  <button class="drawer-scrim" id="blog-scrim" hidden aria-hidden="true" tabindex="-1"></button>
  <div class="mobile-drawer" id="blog-drawer" role="dialog" aria-label="${L.menu}">
    <button class="drawer-close" type="button" id="blog-drawer-close" aria-label="${L.close}">×</button>
    <nav class="drawer-nav">
      <a href="/">${L.home}</a>
      <a href="/">${L.about}</a>
      <a href="/">${L.practice}</a>
      <a href="/">${L.services}</a>
      <a href="/blog">${L.blog}</a>
      <a href="/">${L.contact}</a>
      <a href="/#/web-app">${L.webApp}</a>
      <a href="/#/login">${L.clientSpace}</a>
    </nav>
    <div class="drawer-foot">
      <a class="btn btn-secondary" href="?lang=fr">FR</a>
      <a class="btn btn-secondary" href="?lang=en">EN</a>
    </div>
  </div>
  <script>
  (function(){
    var svc=document.getElementById('blog-nav-svc'),menu=document.getElementById('blog-nav-svc-menu');
    if(svc&&menu){svc.addEventListener('click',function(e){e.stopPropagation();var open=menu.hidden;menu.hidden=!open;svc.setAttribute('aria-expanded',String(open));if(open){document.addEventListener('click',function(){menu.hidden=true;svc.setAttribute('aria-expanded','false');},{once:true});}});}
    var burger=document.getElementById('blog-burger'),drawer=document.getElementById('blog-drawer'),scrim=document.getElementById('blog-scrim'),closeBtn=document.getElementById('blog-drawer-close');
    function openDrawer(){if(drawer){drawer.classList.add('open');}if(scrim){scrim.hidden=false;}document.body.style.overflow='hidden';}
    function closeDrawer(){if(drawer){drawer.classList.remove('open');}if(scrim){scrim.hidden=true;}document.body.style.overflow='';}
    if(burger){burger.addEventListener('click',openDrawer);}
    if(closeBtn){closeBtn.addEventListener('click',closeDrawer);}
    if(scrim){scrim.addEventListener('click',closeDrawer);}
    var themeBtn=document.getElementById('blog-theme-btn');
    try{var saved=localStorage.getItem('cej-theme');if(saved){document.documentElement.dataset.theme=saved;}}catch(e){}
    if(themeBtn){themeBtn.addEventListener('click',function(){var cur=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=cur;try{localStorage.setItem('cej-theme',cur);}catch(e){}});}
  })();
  </script>`;
}

function pageShell({ title, description, canonical, og = {}, body, firm, lang = 'fr' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:type" content="${og.type || 'website'}">
<meta property="og:title" content="${esc(og.title || title)}">
${og.description || description ? `<meta property="og:description" content="${esc(og.description || description)}">` : ''}
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
${og.image ? `<meta property="og:image" content="${esc(og.image)}">` : ''}
<link rel="stylesheet" href="/css/styles.css">
<style>${BLOG_CSS}</style>
</head>
<body>
${blogHeader(firm, lang)}
<main class="blog-wrap">
  ${body}
</main>
</body>
</html>`;
}

async function publishedPosts() {
  const { rows } = await query(`
    SELECT b.*, u.first_name, u.last_name
    FROM blog_posts b JOIN users u ON u.id = b.author_id
    WHERE b.status='published'
    ORDER BY b.published_at DESC LIMIT 100`);
  return rows;
}

export function mountBlogPages(app) {
  app.get('/blog', async (req, res, next) => {
    try {
      const firm = await firmInfo();
      const posts = await publishedPosts();
      const base = baseUrl(req);
      const cards = posts.map((p) => `
        <article class="blog-card">
          ${p.cover_filename ? `<a href="/blog/${esc(p.slug)}"><img src="/uploads/blog-covers/${esc(p.cover_filename)}" alt="" loading="lazy"></a>` : ''}
          <div>
            <h2><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></h2>
            <div class="blog-meta">${esc(fmtDate(p.published_at))} · ${esc(p.first_name)} ${esc(p.last_name)}</div>
            ${p.excerpt ? `<p class="blog-excerpt">${esc(p.excerpt)}</p>` : ''}
            <p><a class="blog-read" href="/blog/${esc(p.slug)}">Lire l'article →</a></p>
          </div>
        </article>`).join('');
      const body = `
        <div class="blog-hero"><h1>Blog</h1><p>${esc(firm.tagline || `Analyses et actualités juridiques — ${firm.name}`)}</p></div>
        ${cards || '<p class="blog-excerpt">Aucun article publié pour le moment.</p>'}`;
      res.send(pageShell({
        title: `Blog — ${firm.name}`,
        description: firm.tagline || `Articles et analyses juridiques publiés par ${firm.name}.`,
        canonical: `${base}/blog`,
        og: { title: `Blog — ${firm.name}` },
        body, firm, lang: reqLang(req),
      }));
    } catch (e) { next(e); }
  });

  app.get('/blog/:slug', async (req, res, next) => {
    try {
      const firm = await firmInfo();
      const { rows } = await query(`
        SELECT b.*, u.first_name, u.last_name
        FROM blog_posts b JOIN users u ON u.id = b.author_id
        WHERE b.slug=$1 AND b.status='published'`, [req.params.slug]);
      const p = rows[0];
      const base = baseUrl(req);
      if (!p) {
        const lang = reqLang(req);
        res.status(404).send(pageShell({
          title: `Article introuvable — ${firm.name}`,
          canonical: `${base}/blog`,
          body: `<div class="blog-404"><h1>Article introuvable</h1><p class="blog-excerpt">Cet article n'existe pas ou n'est plus publié.</p></div>`,
          firm, lang,
        }));
        return;
      }
      const canonical = `${base}/blog/${p.slug}`;
      const html = sanitizeHtml(p.content_html);
      const lang = reqLang(req);
      const body = `
        <article class="blog-article">
          <h1>${esc(p.title)}</h1>
          <div class="blog-meta">${esc(fmtDate(p.published_at))} · Par ${esc(p.first_name)} ${esc(p.last_name)} · ${esc(firm.name)}</div>
          ${p.cover_filename ? `<img class="blog-cover" src="/uploads/blog-covers/${esc(p.cover_filename)}" alt="${esc(p.title)}">` : ''}
          <div class="blog-body">${html}</div>
        </article>`;
      res.send(pageShell({
        title: `${p.title} — ${firm.name}`,
        description: p.excerpt || p.title,
        canonical,
        og: {
          type: 'article',
          title: p.title,
          description: p.excerpt || p.title,
          image: p.cover_filename ? `${base}/uploads/blog-covers/${p.cover_filename}` : undefined,
        },
        body, firm, lang,
      }));
    } catch (e) { next(e); }
  });

  app.get('/sitemap.xml', async (req, res, next) => {
    try {
      const base = baseUrl(req);
      const posts = await publishedPosts();
      const urls = [
        { loc: `${base}/`, changefreq: 'weekly', priority: '1.0' },
        { loc: `${base}/blog`, changefreq: 'daily', priority: '0.8' },
        ...posts.map((p) => ({
          loc: `${base}/blog/${p.slug}`,
          lastmod: (p.updated_at || '').slice(0, 10),
          changefreq: 'monthly',
          priority: '0.7',
        })),
      ];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
        urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')
      }\n</urlset>`;
      res.type('application/xml').send(xml);
    } catch (e) { next(e); }
  });

  app.get('/robots.txt', (req, res) => {
    const base = baseUrl(req);
    res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  });
}
