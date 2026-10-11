import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { chat, llmStatus } from '../services/llm.js';

const router = Router();

export const BLOG_COVERS_DIR = join(resolve(process.env.UPLOAD_DIR ?? './uploads'), 'blog-covers');
export const BLOG_IMAGES_DIR = join(resolve(process.env.UPLOAD_DIR ?? './uploads'), 'blog-images');
mkdirSync(BLOG_COVERS_DIR, { recursive: true });
mkdirSync(BLOG_IMAGES_DIR, { recursive: true });

const ALLOWED_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 Mo
const imageUpload = (dest) => multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXT.has(ext)) return cb(new HttpError(400, 'invalid_file_type', `Type d'image non autorisé : ${ext || 'inconnu'}.`));
    cb(null, true);
  },
});
const coverUpload = imageUpload(BLOG_COVERS_DIR);
const bodyImageUpload = imageUpload(BLOG_IMAGES_DIR);
const handleUpload = (up, field) => (req, res, next) => up.single(field)(req, res, (err) => {
  if (err instanceof multer.MulterError) return next(new HttpError(400, 'upload_error', err.code === 'LIMIT_FILE_SIZE' ? 'Image trop volumineuse (8 Mo max).' : err.message));
  if (err) return next(err);
  next();
});

const coverUrl = (b) => (b.cover_filename ? `/uploads/blog-covers/${b.cover_filename}` : null);

/* ------------------------------------------------------------------ */
/* Nettoyage HTML (éditeur WYSIWYG) — liste blanche stricte.           */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4',
  'strong', 'em', 'u', 's', 'b', 'i',
  'ul', 'ol', 'li', 'blockquote',
  'a', 'img', 'figure', 'figcaption', 'br', 'hr',
  'span', 'div',
]);
const VOID_TAGS = new Set(['img', 'br', 'hr']);
// Classes autorisées : tailles/alignements d'images posés par l'éditeur.
const IMG_CLASSES = new Set(['img-sm', 'img-md', 'img-lg', 'img-full', 'align-left', 'align-center', 'align-right']);
const DIV_CLASSES = new Set(['align-left', 'align-center', 'align-right', 'align-justify']);
const FIGURE_CLASSES = new Set(['align-left', 'align-center', 'align-right']);

function safeUrl(u) {
  const v = String(u ?? '').trim().toLowerCase();
  return v !== '' && !v.startsWith('javascript:') && !v.startsWith('vbscript:') && !v.startsWith('data:text/html');
}

function cleanStyle(style) {
  const allowedProps = new Set(['color', 'background-color', 'font-family', 'font-size', 'text-align']);
  const out = [];
  for (const decl of String(style ?? '').split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!allowedProps.has(prop) || !val) continue;
    if (/[<>]/.test(val) || /url\s*\(/i.test(val) || /expression\s*\(/i.test(val)) continue;
    if (prop === 'font-size' && !/^[\d.]+(px|pt|em|rem|%)$/.test(val)) continue;
    if (prop === 'text-align' && !/^(left|center|right|justify)$/.test(val)) continue;
    if ((prop === 'color' || prop === 'background-color')
      && !/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)$/i.test(val)) continue;
    if (prop === 'font-family' && !/^[a-zA-Z0-9\s,'"\-]+$/.test(val)) continue;
    out.push(`${prop}:${val}`);
  }
  return out.join(';');
}

function parseAttrs(attrStr) {
  const attrs = {};
  const re = /([a-zA-Z][a-zA-Z0-9-:]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    const name = m[1].toLowerCase();
    if (name.startsWith('on')) continue; // gestionnaires d'événements : jamais
    attrs[name] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function filterClasses(value, allowed) {
  return String(value ?? '').split(/\s+/).filter((c) => allowed.has(c)).join(' ');
}

/** HTML de l'éditeur → HTML sûr : balises/attributs en liste blanche, scripts et javascript: supprimés. */
export function sanitizeHtml(html) {
  let s = String(html ?? '');
  // Supprime entièrement les blocs <script> et <style>, puis les commentaires.
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  return s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>/g, (match, tagName, attrStr) => {
    const tag = tagName.toLowerCase();
    const closing = match.startsWith('</');
    if (!ALLOWED_TAGS.has(tag)) return ''; // balise inconnue : on garde le texte, pas la balise
    if (closing) return VOID_TAGS.has(tag) ? '' : `</${tag}>`;
    const attrs = parseAttrs(attrStr);
    const out = [];
    if (tag === 'a') {
      if (attrs.href && safeUrl(attrs.href)) out.push(`href="${attrs.href.replace(/"/g, '&quot;')}"`);
      if (attrs.title) out.push(`title="${attrs.title.replace(/"/g, '&quot;')}"`);
      out.push('rel="noopener"');
    } else if (tag === 'img') {
      if (attrs.src && safeUrl(attrs.src)) {
        // data: autorisé uniquement pour les images (collage depuis le presse-papiers).
        const low = String(attrs.src).trim().toLowerCase();
        if (!low.startsWith('data:') || low.startsWith('data:image/')) {
          out.push(`src="${attrs.src.replace(/"/g, '&quot;')}"`);
        }
      }
      if (attrs.alt) out.push(`alt="${attrs.alt.replace(/"/g, '&quot;')}"`);
      const cls = filterClasses(attrs.class, IMG_CLASSES);
      if (cls) out.push(`class="${cls}"`);
      if (attrs.width && /^\d+%?$/.test(String(attrs.width).trim())) out.push(`width="${attrs.width.trim()}"`);
      if (!out.some((a) => a.startsWith('src='))) return ''; // img sans src valide : on la jette
    } else if (tag === 'span') {
      const style = cleanStyle(attrs.style);
      if (style) out.push(`style="${style.replace(/"/g, '&quot;')}"`);
    } else if (tag === 'div') {
      const cls = filterClasses(attrs.class, DIV_CLASSES);
      if (cls) out.push(`class="${cls}"`);
    } else if (tag === 'figure') {
      const cls = filterClasses(attrs.class, FIGURE_CLASSES);
      if (cls) out.push(`class="${cls}"`);
    }
    // h1-h4, p, strong, em, u, s, b, i, ul, ol, li, blockquote, figcaption, br, hr : aucun attribut.
    return `<${tag}${out.length ? ` ${out.join(' ')}` : ''}>`;
  });
}

/** Génère un slug URL à partir du titre, unique dans blog_posts. */
export async function uniqueSlug(title) {
  const base = String(title)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article';
  let slug = base;
  for (let i = 2; ; i++) {
    const { rows } = await query('SELECT 1 FROM blog_posts WHERE slug=$1', [slug]);
    if (!rows.length) return slug;
    slug = `${base}-${i}`;
  }
}

const blogShape = (b) => ({
  id: b.id,
  slug: b.slug,
  title: b.title,
  excerpt: b.excerpt,
  content_html: b.content_html ?? null,
  coverUrl: coverUrl(b),
  status: b.status,
  publishedAt: b.published_at,
  createdAt: b.created_at,
  updatedAt: b.updated_at,
  author: { id: b.author_id, firstName: b.first_name, lastName: b.last_name, role: b.role },
});

const BLOG_BODY = `
  SELECT b.*, u.first_name, u.last_name, r.name AS role
  FROM blog_posts b
  JOIN users u ON u.id = b.author_id
  JOIN roles r ON r.id = u.role_id`;

const blogSchema = z.object({
  title: z.string().trim().min(1).max(180),
  excerpt: z.string().trim().max(500).optional().nullable(),
  content_html: z.string().max(500000).optional().default(''),
  status: z.enum(['draft', 'published']).default('draft'),
});

function canWriteBlog(user, post) {
  return user.role === 'ADMIN' || Number(post.author_id) === Number(user.id);
}

// ---- API publique (référencement : aucune authentification requise)

/** Articles publiés, pour le site public et Google. */
router.get('/public', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const { rows } = await query(`${BLOG_BODY} WHERE b.status='published' ORDER BY b.published_at DESC LIMIT ${limit}`);
    res.json(rows.map((b) => ({
      slug: b.slug, title: b.title, excerpt: b.excerpt,
      coverUrl: coverUrl(b),
      publishedAt: b.published_at,
      author: { firstName: b.first_name, lastName: b.last_name },
    })));
  } catch (e) { next(e); }
});

// ---- API (réservée au personnel pouvant publier : même permission que les publications)

/** Liste des articles (brouillons inclus) pour l'éditeur. */
router.get('/', requireAuth, requirePermission('posts.create'), async (req, res, next) => {
  try {
    const { status, mine } = req.query;
    const conds = [];
    const params = [];
    if (status === 'draft' || status === 'published') { params.push(status); conds.push(`b.status=$${params.length}`); }
    if (mine === '1' && req.user.role !== 'ADMIN') { params.push(req.user.id); conds.push(`b.author_id=$${params.length}`); }
    const { rows } = await query(`${BLOG_BODY}${conds.length ? ` WHERE ${conds.join(' AND ')}` : ''} ORDER BY b.updated_at DESC LIMIT 200`, params);
    res.json(rows.map(blogShape));
  } catch (e) { next(e); }
});

router.post('/', requireAuth, requirePermission('posts.create'), handleUpload(coverUpload, 'cover'), async (req, res, next) => {
  try {
    const b = blogSchema.parse(req.body);
    const slug = await uniqueSlug(b.title);
    const publishedAt = b.status === 'published' ? new Date().toISOString() : null;
    const { rows } = await query(
      `INSERT INTO blog_posts (slug, title, excerpt, content_html, cover_filename, cover_mime, author_id, status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [slug, b.title, b.excerpt?.trim() || null, sanitizeHtml(b.content_html), req.file?.filename ?? null, req.file?.mimetype ?? null, req.user.id, b.status, publishedAt],
    );
    await logAudit({ userId: req.user.id, action: 'BLOG_CREATED', resourceType: 'blog_post', resourceId: rows[0].id, ip: req.ip });
    const full = await query(`${BLOG_BODY} WHERE b.id=$1`, [rows[0].id]);
    res.status(201).json(blogShape(full.rows[0]));
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

/** Téléversement d'une image insérée dans le corps de l'article (éditeur WYSIWYG). */
router.post('/images', requireAuth, requirePermission('posts.create'), handleUpload(bodyImageUpload, 'image'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'missing_file', 'Aucune image reçue.');
    res.status(201).json({ url: `/uploads/blog-images/${req.file.filename}` });
  } catch (e) { next(e); }
});

const aiGenerateSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  lang: z.enum(['fr', 'en']).optional().default('fr'),
  tone: z.string().trim().max(120).optional().nullable(),
  length: z.enum(['court', 'moyen', 'long']).optional().default('moyen'),
});

function aiBlogPrompt(topic, lang, tone, length) {
  const langName = lang === 'en' ? 'anglais' : 'français';
  const sizeHint = { court: 'environ 250 mots', moyen: 'environ 500 mots', long: 'environ 900 mots' }[length];
  const toneHint = tone ? ` Ton souhaité : ${tone}.` : '';
  return lang === 'en'
    ? `You are a legal blog writer for "Cabinet Élite Juridique", a law firm in Montréal, Canada. Write a blog article in English about: "${topic}".${toneHint} Target length: ${sizeHint === 'environ 250 mots' ? 'about 250 words' : sizeHint === 'environ 500 mots' ? 'about 500 words' : 'about 900 words'}.`
      + `\nStructure the body with <h2>/<h3> headings, <p> paragraphs, and <ul>/<li> lists where useful. Allowed tags only: p, h2, h3, h4, strong, em, ul, ol, li, blockquote, a, br. No <h1> (the title is separate), no images, no scripts.`
      + `\nBe accurate and prudent: no invented facts, names, dates or articles of law; no definitive legal conclusion — the reader should consult a lawyer for their situation.`
      + `\nReply with ONLY a JSON object, no markdown fences, no commentary: {"title": "article title (max 150 chars)", "html": "article body HTML"}.`
    : `Tu es un rédacteur d’articles de blog pour le « Cabinet Élite Juridique », un cabinet d’avocats à Montréal, Canada. Rédige un article de blog en ${langName} sur le sujet : « ${topic} ».${toneHint} Longueur visée : ${sizeHint}.`
      + `\nStructure le corps avec des titres <h2>/<h3>, des paragraphes <p> et des listes <ul>/<li> quand c’est utile. Balises autorisées uniquement : p, h2, h3, h4, strong, em, ul, ol, li, blockquote, a, br. Pas de <h1> (le titre est séparé), pas d’images, pas de scripts.`
      + `\nSois précis et prudent : n’invente aucun fait, nom, date ou article de loi ; aucune conclusion juridique définitive — le lecteur doit consulter un avocat pour sa situation.`
      + `\nRéponds UNIQUEMENT avec un objet JSON, sans bloc markdown, sans commentaire : {"title": "titre de l’article (150 caractères max)", "html": "corps de l’article en HTML"}.`;
}

/**
 * POST /api/blog/ai-generate — génère un titre + un corps d'article avec l'IA.
 * L'article n'est JAMAIS publié automatiquement : l'éditeur remplit les champs
 * pour relecture/modification, et la sauvegarde applique sanitizeHtml.
 */
router.post('/ai-generate', requireAuth, requirePermission('posts.create'), async (req, res, next) => {
  try {
    const b = aiGenerateSchema.parse(req.body);
    if (!llmStatus().available) {
      throw new HttpError(503, 'llm_unavailable', 'L’assistant IA n’est pas configuré (LLM_API_KEY manquante).');
    }
    const raw = await chat(
      [{ role: 'system', content: aiBlogPrompt(b.topic, b.lang, b.tone ?? null, b.length) }],
      { maxTokens: 3000, temperature: 0.7 },
    );
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new HttpError(502, 'llm_bad_response', 'L’IA n’a pas retourné un article exploitable. Réessayez.');
    }
    const title = String(parsed?.title ?? '').trim().slice(0, 180);
    const html = String(parsed?.html ?? '').trim();
    if (!title || !html) throw new HttpError(502, 'llm_bad_response', 'L’IA n’a pas retourné un article exploitable. Réessayez.');
    await logAudit({ userId: req.user.id, action: 'BLOG_AI_GENERATED', resourceType: 'blog_post', resourceId: null, newValues: { topic: b.topic, lang: b.lang }, ip: req.ip });
    res.json({ title, contentHtml: html });
  } catch (e) {
    next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e);
  }
});

router.put('/:id', requireAuth, requirePermission('posts.create'), handleUpload(coverUpload, 'cover'), async (req, res, next) => {
  try {
    // Schéma de mise à jour SANS valeurs par défaut : un champ absent ne doit
    // jamais écraser le contenu existant.
    const b = z.object({
      title: z.string().trim().min(1).max(180).optional(),
      excerpt: z.string().trim().max(500).optional().nullable(),
      content_html: z.string().max(500000).optional(),
      status: z.enum(['draft', 'published']).optional(),
    }).parse(req.body);
    const { rows: before } = await query('SELECT * FROM blog_posts WHERE id=$1', [req.params.id]);
    if (!before[0]) throw new HttpError(404, 'not_found', 'Article introuvable.');
    if (!canWriteBlog(req.user, before[0])) throw new HttpError(403, 'forbidden', 'Seul l’auteur ou un administrateur peut modifier cet article.');
    const removeCover = req.body.removeCover === 'true';
    if ((req.file || removeCover) && before[0].cover_filename) {
      const p = join(BLOG_COVERS_DIR, before[0].cover_filename);
      if (existsSync(p)) unlinkSync(p);
    }
    const newCover = req.file ? req.file.filename : (removeCover ? null : before[0].cover_filename);
    const newCoverMime = req.file ? req.file.mimetype : (removeCover ? null : before[0].cover_mime);
    const newStatus = b.status ?? before[0].status;
    const publishedAt = newStatus === 'published' && !before[0].published_at ? new Date().toISOString() : before[0].published_at;
    const { rows } = await query(
      `UPDATE blog_posts SET title=COALESCE($1,title), excerpt=$2, content_html=COALESCE($3,content_html),
        cover_filename=$4, cover_mime=$5, status=$6, published_at=$7, updated_at=CURRENT_TIMESTAMP
       WHERE id=$8 RETURNING *`,
      [b.title, b.excerpt !== undefined ? (b.excerpt?.trim() || null) : before[0].excerpt, b.content_html !== undefined ? sanitizeHtml(b.content_html) : undefined, newCover, newCoverMime, newStatus, publishedAt, req.params.id],
    );
    await logAudit({ userId: req.user.id, action: 'BLOG_UPDATED', resourceType: 'blog_post', resourceId: rows[0].id, ip: req.ip });
    const full = await query(`${BLOG_BODY} WHERE b.id=$1`, [rows[0].id]);
    res.json(blogShape(full.rows[0]));
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.delete('/:id', requireAuth, requirePermission('posts.create'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM blog_posts WHERE id=$1', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Article introuvable.');
    if (!canWriteBlog(req.user, rows[0])) throw new HttpError(403, 'forbidden', 'Seul l’auteur ou un administrateur peut supprimer cet article.');
    if (rows[0].cover_filename) {
      const p = join(BLOG_COVERS_DIR, rows[0].cover_filename);
      if (existsSync(p)) unlinkSync(p);
    }
    await query('DELETE FROM blog_posts WHERE id=$1', [req.params.id]);
    await logAudit({ userId: req.user.id, action: 'BLOG_DELETED', resourceType: 'blog_post', resourceId: req.params.id, ip: req.ip });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
