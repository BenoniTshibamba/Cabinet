import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { logAudit } from '../services/audit.js';
import { loadCaseOr404, assertVisible } from './cases.js';
import { CHAT_ALLOWED_EXT, CHAT_MAX_SIZE } from './documents.js';

const router = Router();

// Images des publications : stockées à part des documents de dossier (accès public en lecture,
// puisque le fil d'accueil est visible sans authentification).
export const POST_IMAGES_DIR = join(resolve(process.env.UPLOAD_DIR ?? './uploads'), 'post-images');
mkdirSync(POST_IMAGES_DIR, { recursive: true });
const ALLOWED_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 Mo
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, POST_IMAGES_DIR),
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXT.has(ext)) return cb(new HttpError(400, 'invalid_file_type', `Type d’image non autorisé : ${ext || 'inconnu'}.`));
    cb(null, true);
  },
});
const handleImagesUpload = (req, res, next) => imageUpload.array('images', 10)(req, res, (err) => {
  if (err instanceof multer.MulterError) return next(new HttpError(400, 'upload_error', err.code === 'LIMIT_FILE_SIZE' ? 'Image trop volumineuse (8 Mo max).' : err.message));
  if (err) return next(err);
  next();
});
const imageUrl = (p) => (p.image_filename ? `/uploads/post-images/${p.image_filename}` : null);
const avatarUrlOf = (u) => (u.avatar_filename ? `/uploads/avatars/${u.avatar_filename}` : (u.avatarUrl ?? null));

/** Charge les images de plusieurs publications en une seule requête : { postId: [{id, url}] } */
async function loadPostImages(postIds) {
  const ids = [...new Set(postIds.map(Number).filter(Boolean))];
  if (!ids.length) return {};
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await query(
    `SELECT id, post_id, filename FROM post_images WHERE post_id IN (${placeholders}) ORDER BY post_id, position, id`,
    ids,
  );
  const map = {};
  for (const r of rows) {
    (map[r.post_id] ??= []).push({ id: r.id, url: `/uploads/post-images/${r.filename}` });
  }
  return map;
}
const withImages = (p, imagesMap) => ({
  ...p,
  images: imagesMap[p.id] ?? [],
  // Compatibilité : imageUrl = première image (ancien comportement mono-image).
  imageUrl: (imagesMap[p.id] ?? [])[0]?.url ?? imageUrl(p),
});

// Public read-only feed: visitors can see the cabinet's published content
// without creating an account or entering a password. Interactions remain protected.
router.get('/public/posts', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
    const { rows } = await query(`
      SELECT p.*, u.first_name, u.last_name, u.avatar_filename, r.name AS role,
        (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
        (SELECT COUNT(*) FROM post_comments c WHERE c.post_id=p.id) AS comments
      FROM posts p
      JOIN users u ON u.id=p.author_id
      JOIN roles r ON r.id=u.role_id
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit}`);
    const imagesMap = await loadPostImages(rows.map((p) => p.id));
    res.json(rows.map((p) => {
      const base = {
        id: p.id, title: p.title, content: p.content, type: p.type,
        author: { id: p.author_id, firstName: p.first_name, lastName: p.last_name, role: p.role, avatarUrl: avatarUrlOf(p) },
        createdAt: p.created_at, updatedAt: p.updated_at,
        likes: Number(p.likes ?? 0), comments: Number(p.comments ?? 0),
        likedByMe: false, canEdit: false, canDelete: false,
      };
      return { ...base, images: (imagesMap[p.id] ?? []), imageUrl: (imagesMap[p.id] ?? [])[0]?.url ?? null };
    }));
  } catch (e) { next(e); }
});

router.use(requireAuth);

const postShape = async (p, currentUserId, imagesMap = null) => {
  const map = imagesMap ?? await loadPostImages([p.id]);
  const images = map[p.id] ?? [];
  return {
    id: p.id, title: p.title, content: p.content, type: p.type,
    images, imageUrl: images[0]?.url ?? imageUrl(p),
    author: { id: p.author_id, firstName: p.first_name, lastName: p.last_name, role: p.role, avatarUrl: avatarUrlOf(p) },
    createdAt: p.created_at, updatedAt: p.updated_at,
    likes: Number(p.likes ?? 0), comments: Number(p.comments ?? 0), likedByMe: Boolean(p.liked_by_me),
    canEdit: Number(p.author_id) === Number(currentUserId),
    canDelete: Number(p.author_id) === Number(currentUserId),
  };
};

router.get('/posts', requirePermission('posts.read'), async (req, res, next) => {
  try {
    // Filtres optionnels : ?author_id=<id> (publications d'un auteur) et ?limit=<n> (1–100, défaut 100).
    const authorId = Number(req.query.author_id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
    const where = Number.isInteger(authorId) && authorId > 0 ? 'WHERE p.author_id=$2' : '';
    const params = [req.user.id];
    if (where) params.push(authorId);
    const { rows } = await query(`
      SELECT p.*, u.first_name, u.last_name, u.avatar_filename, r.name AS role,
        (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
        (SELECT COUNT(*) FROM post_comments c WHERE c.post_id=p.id) AS comments,
        EXISTS(SELECT 1 FROM post_likes lm WHERE lm.post_id=p.id AND lm.user_id=$1) AS liked_by_me
      FROM posts p JOIN users u ON u.id=p.author_id JOIN roles r ON r.id=u.role_id
      ${where}
      ORDER BY p.created_at DESC, p.id DESC LIMIT ${limit}`, params);
    const imagesMap = await loadPostImages(rows.map((p) => p.id));
    res.json(await Promise.all(rows.map((p) => postShape(p, req.user.id, imagesMap))));
  } catch (e) { next(e); }
});

const postSchema = z.object({ title: z.string().trim().min(1).max(180), content: z.string().trim().min(1).max(20000), type: z.enum(['POST','ARTICLE']).default('POST') });

async function insertPostImages(postId, files) {
  const rows = [];
  for (let i = 0; i < files.length; i++) {
    const { rows: r } = await query(
      'INSERT INTO post_images (post_id, filename, mime, position) VALUES ($1,$2,$3,$4) RETURNING id',
      [postId, files[i].filename, files[i].mimetype, i],
    );
    rows.push({ id: r[0].id, url: `/uploads/post-images/${files[i].filename}` });
  }
  return rows;
}

async function deletePostImageFiles(postId, ids = null) {
  const idList = ids ? [...new Set(ids.map(Number).filter(Number.isInteger))] : null;
  let rows;
  if (idList && idList.length) {
    const ph = idList.map((_, i) => `$${i + 2}`).join(',');
    ({ rows } = await query(`SELECT id, filename FROM post_images WHERE post_id=$1 AND id IN (${ph})`, [postId, ...idList]));
    await query(`DELETE FROM post_images WHERE post_id=$1 AND id IN (${ph})`, [postId, ...idList]);
  } else if (idList) {
    return;
  } else {
    ({ rows } = await query('SELECT id, filename FROM post_images WHERE post_id=$1', [postId]));
    await query('DELETE FROM post_images WHERE post_id=$1', [postId]);
  }
  for (const r of rows) {
    const p = join(POST_IMAGES_DIR, r.filename);
    if (existsSync(p)) unlinkSync(p);
  }
}

router.post('/posts', requirePermission('posts.create'), handleImagesUpload, async (req, res, next) => {
  try {
    const b = postSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO posts (author_id,title,content,type) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, b.title, b.content, b.type],
    );
    const images = await insertPostImages(rows[0].id, req.files ?? []);
    await logAudit({ userId:req.user.id, action:'POST_CREATED', resourceType:'post', resourceId:rows[0].id, ip:req.ip });
    res.status(201).json(await postShape({...rows[0], first_name:req.user.firstName,last_name:req.user.lastName,role:req.user.role,avatarUrl:req.user.avatarUrl,likes:0,comments:0,liked_by_me:false}, req.user.id, { [rows[0].id]: images }));
  } catch(e){ next(e instanceof z.ZodError ? new HttpError(400,'invalid_body',e.issues[0].message):e); }
});

router.patch('/posts/:id', requirePermission('posts.update_own'), handleImagesUpload, async (req, res, next) => {
  try {
    const b=postSchema.partial().parse(req.body);
    const {rows:before}=await query('SELECT * FROM posts WHERE id=$1',[req.params.id]);
    if(!before[0]) throw new HttpError(404,'not_found','Publication introuvable.');
    if(Number(before[0].author_id)!==Number(req.user.id)) throw new HttpError(403,'forbidden','Seul l’auteur peut modifier cette publication.');
    // Retrait ciblé d'images existantes (ids JSON) et/ou ajout de nouvelles (ajoutées à la fin).
    let removeIds = [];
    if (req.body.removeImageIds) {
      try { removeIds = JSON.parse(req.body.removeImageIds); } catch { throw new HttpError(400,'invalid_body','removeImageIds invalide.'); }
      if (!Array.isArray(removeIds) || !removeIds.every((n) => Number.isInteger(Number(n)))) throw new HttpError(400,'invalid_body','removeImageIds invalide.');
    }
    const removeAll = req.body.removeImage === 'true';
    if (removeAll) await deletePostImageFiles(before[0].id);
    else if (removeIds.length) await deletePostImageFiles(before[0].id, removeIds.map(Number));
    // Ancienne colonne mono-image : si elle subsiste (DB non migrée), on la nettoie aussi.
    if (before[0].image_filename) {
      const oldPath = join(POST_IMAGES_DIR, before[0].image_filename);
      if (existsSync(oldPath)) unlinkSync(oldPath);
    }
    if (req.files?.length) {
      const { rows: maxR } = await query('SELECT COALESCE(MAX(position),-1) AS m FROM post_images WHERE post_id=$1', [before[0].id]);
      const start = Number(maxR[0].m) + 1;
      for (let i = 0; i < req.files.length; i++) {
        await query('INSERT INTO post_images (post_id, filename, mime, position) VALUES ($1,$2,$3,$4)',
          [before[0].id, req.files[i].filename, req.files[i].mimetype, start + i]);
      }
    }
    const {rows}=await query(
      `UPDATE posts SET title=COALESCE($1,title), content=COALESCE($2,content), type=COALESCE($3,type), image_filename=NULL, image_mime=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING *`,
      [b.title,b.content,b.type,req.params.id],
    );
    res.json(await postShape({...rows[0], first_name:before[0].first_name ?? req.user.firstName,last_name:before[0].last_name ?? req.user.lastName,role:req.user.role,avatar_filename:before[0].avatar_filename,avatarUrl:req.user.avatarUrl,likes:0,comments:0,liked_by_me:false}, req.user.id));
  }catch(e){next(e instanceof z.ZodError?new HttpError(400,'invalid_body',e.issues[0].message):e)}
});

router.delete('/posts/:id', requirePermission('posts.delete_own'), async(req,res,next)=>{
  try{
    const {rows}=await query('SELECT * FROM posts WHERE id=$1',[req.params.id]);
    if(!rows[0]) throw new HttpError(404,'not_found','Publication introuvable.');
    if(Number(rows[0].author_id)!==Number(req.user.id)) throw new HttpError(403,'forbidden','Seul l’auteur peut supprimer cette publication.');
    await deletePostImageFiles(rows[0].id);
    if (rows[0].image_filename) {
      const p = join(POST_IMAGES_DIR, rows[0].image_filename);
      if (existsSync(p)) unlinkSync(p);
    }
    await query('DELETE FROM posts WHERE id=$1',[req.params.id]);
    res.status(204).end();
  }catch(e){next(e)}
});

router.post('/posts/:id/like', requirePermission('posts.interact'), async(req,res,next)=>{
  try{
    const {rows:p}=await query('SELECT author_id FROM posts WHERE id=$1',[req.params.id]);
    if(!p[0]) throw new HttpError(404,'not_found','Publication introuvable.');
    const {rows:existing}=await query('SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
    if(existing[0]) await query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
    else { await query('INSERT INTO post_likes(post_id,user_id) VALUES($1,$2)',[req.params.id,req.user.id]); if(Number(p[0].author_id)!==Number(req.user.id)) await notify(p[0].author_id,{type:'POST_LIKE',title:'Votre publication a reçu un J’aime',body:`${req.user.firstName} ${req.user.lastName} a aimé votre publication.`}); }
    const {rows:c}=await query('SELECT COUNT(*) AS n FROM post_likes WHERE post_id=$1',[req.params.id]);
    res.json({liked:!existing[0],likes:Number(c[0].n)});
  }catch(e){next(e)}
});

router.get('/posts/:id/comments', requirePermission('posts.interact'), async(req,res,next)=>{try{const {rows}=await query(`SELECT c.id,c.content,c.created_at,u.id AS user_id,u.first_name,u.last_name,u.avatar_filename,r.name AS role FROM post_comments c JOIN users u ON u.id=c.user_id JOIN roles r ON r.id=u.role_id WHERE c.post_id=$1 ORDER BY c.created_at ASC`,[req.params.id]);res.json(rows.map(c=>({id:c.id,content:c.content,createdAt:c.created_at,user:{id:c.user_id,firstName:c.first_name,lastName:c.last_name,role:c.role,avatarUrl:avatarUrlOf(c)}})));}catch(e){next(e)}});
router.post('/posts/:id/comments', requirePermission('posts.interact'), async(req,res,next)=>{try{const content=z.string().trim().min(1).max(5000).parse(req.body.content);const {rows:p}=await query('SELECT author_id FROM posts WHERE id=$1',[req.params.id]);if(!p[0])throw new HttpError(404,'not_found','Publication introuvable.');const {rows}=await query('INSERT INTO post_comments(post_id,user_id,content) VALUES($1,$2,$3) RETURNING *',[req.params.id,req.user.id,content]);if(Number(p[0].author_id)!==Number(req.user.id))await notify(p[0].author_id,{type:'POST_COMMENT',title:'Nouveau commentaire',body:`${req.user.firstName} ${req.user.lastName} a commenté votre publication.`});res.status(201).json(rows[0]);}catch(e){next(e instanceof z.ZodError?new HttpError(400,'invalid_body','Commentaire invalide.'):e)}});

/* ------------------------------------------------------------------ */
/* Messagerie : conversations 1-à-1 et groupes                         */
/* ------------------------------------------------------------------ */

// Indicateurs « en train d’écrire » : mémoire seule, TTL 6 s (jamais en base).
const TYPING_TTL_MS = 6000;
const typingStore = new Map(); // scope -> Map(userId -> timestamp)
const dmScope = (a, b) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`;
const convScope = (id) => `conv:${id}`;
function setTyping(scope, userId) {
  let m = typingStore.get(scope);
  if (!m) { m = new Map(); typingStore.set(scope, m); }
  m.set(Number(userId), Date.now());
}
function typingUserIds(scope, excludeId) {
  const m = typingStore.get(scope);
  if (!m) return [];
  const now = Date.now();
  const out = [];
  for (const [uid, ts] of m) {
    if (now - ts > TYPING_TTL_MS) { m.delete(uid); continue; }
    if (Number(uid) !== Number(excludeId)) out.push(Number(uid));
  }
  return out;
}
async function typingUsers(scope, excludeId) {
  const ids = typingUserIds(scope, excludeId);
  if (!ids.length) return [];
  const ph = ids.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await query(`SELECT id, first_name, last_name, avatar_filename FROM users WHERE id IN (${ph})`, ids);
  return rows.map((u) => ({ id: u.id, firstName: u.first_name, lastName: u.last_name, avatarUrl: avatarUrlOf(u) }));
}

// Pièces jointes du composeur : mêmes restrictions que les documents de dossier.
const CHAT_UPLOAD_DIR = join(resolve(process.env.UPLOAD_DIR ?? './uploads'), 'chat');
const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = join(CHAT_UPLOAD_DIR, String(req.user.id));
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: CHAT_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!CHAT_ALLOWED_EXT.has(ext)) return cb(new HttpError(400, 'invalid_file_type', `Type de fichier non autorisé : ${ext || 'inconnu'}.`));
    cb(null, true);
  },
});
const handleChatUpload = (req, res, next) => chatUpload.single('file')(req, res, (err) => {
  if (err instanceof multer.MulterError) return next(new HttpError(400, 'upload_error', err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (25 Mo max).' : err.message));
  if (err) return next(err);
  next();
});

const MSG_COLS = `m.id, m.sender_id, m.recipient_id, m.conversation_id, m.content, m.is_read, m.read_at,
  m.attachment_document_id, m.created_at,
  su.first_name AS sender_first_name, su.last_name AS sender_last_name, su.avatar_filename AS sender_avatar,
  ma.id AS att_id, ma.original_name AS att_name, ma.mime_type AS att_mime, ma.size_bytes AS att_size,
  d.id AS doc_id, d.original_name AS doc_name, d.mime_type AS doc_mime`;
const MSG_JOINS = `FROM messages m JOIN users su ON su.id=m.sender_id
  LEFT JOIN message_attachments ma ON ma.message_id=m.id
  LEFT JOIN documents d ON d.id=m.attachment_document_id`;

function toMessage(m, meId, readCounts) {
  const mine = Number(m.sender_id) === Number(meId);
  let attachment = null;
  if (m.attachment_document_id) {
    attachment = { kind: 'document', id: m.doc_id, name: m.doc_name, mime: m.doc_mime };
  } else if (m.att_id) {
    attachment = { kind: 'upload', id: m.att_id, name: m.att_name, mime: m.att_mime, size: Number(m.att_size) };
  }
  return {
    id: m.id,
    content: m.content,
    createdAt: m.created_at,
    mine,
    isRead: Boolean(m.is_read),
    readAt: m.read_at ?? null,
    readCount: readCounts ? (readCounts[m.id] ?? 0) : 0,
    sender: { id: m.sender_id, firstName: m.sender_first_name, lastName: m.sender_last_name, avatarUrl: m.sender_avatar ? `/uploads/avatars/${m.sender_avatar}` : null },
    attachment,
  };
}

async function groupReadCounts(ids) {
  if (!ids.length) return {};
  const ph = ids.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await query(`SELECT message_id, COUNT(*) AS n FROM message_reads WHERE message_id IN (${ph}) GROUP BY message_id`, ids);
  return Object.fromEntries(rows.map((r) => [r.message_id, Number(r.n)]));
}

async function loadConvOr404(id) {
  const { rows } = await query('SELECT * FROM conversations WHERE id=$1', [id]);
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Conversation introuvable.');
  return rows[0];
}

async function requireConvMember(convId, userId) {
  const { rows } = await query('SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2', [convId, userId]);
  if (!rows[0]) throw new HttpError(403, 'forbidden', 'Vous n’êtes pas membre de cette conversation.');
}

async function convMembers(convId) {
  const { rows } = await query(
    `SELECT u.id, u.first_name, u.last_name, u.avatar_filename FROM conversation_members cm
     JOIN users u ON u.id=cm.user_id WHERE cm.conversation_id=$1 ORDER BY u.first_name, u.last_name`, [convId]);
  return rows.map((u) => ({ id: u.id, firstName: u.first_name, lastName: u.last_name, avatarUrl: avatarUrlOf(u) }));
}

async function userCaseIdentity(userId) {
  const { rows } = await query(
    `SELECT u.id, u.client_id, r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1`, [userId]);
  return rows[0] ? { id: rows[0].id, role: rows[0].role, clientId: rows[0].client_id } : null;
}

// Vérifie qu'un document existant est lisible par l'utilisateur (visibilité du dossier).
async function assertDocReadable(docId, user) {
  const { rows } = await query(
    `SELECT d.id, c.lawyer_id, c.client_id FROM documents d JOIN cases c ON c.id=d.case_id WHERE d.id=$1`, [docId]);
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Document introuvable.');
  await assertVisible(user, rows[0]);
  return rows[0];
}

async function markConvRead(convId, userId) {
  const { rows } = await query('SELECT id, sender_id FROM messages WHERE conversation_id=$1', [convId]);
  for (const m of rows) {
    if (Number(m.sender_id) === Number(userId)) continue;
    await query('INSERT INTO message_reads (message_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [m.id, userId]);
  }
}

router.get('/messages/users', requirePermission('messages.read'), async(req,res,next)=>{try{const {rows}=await query(`SELECT u.id,u.first_name,u.last_name,u.email,u.avatar_filename,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id<>$1 AND u.is_active=1 ORDER BY u.first_name,u.last_name`,[req.user.id]);res.json(rows.map((u)=>({...u,avatarUrl:avatarUrlOf(u)})));}catch(e){next(e)}});

router.get('/messages/unread-count', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const me = req.user.id;
    const byUser = {};
    let total = 0;
    const { rows: dm } = await query(
      `SELECT sender_id, COUNT(*) AS n FROM messages WHERE recipient_id=$1 AND conversation_id IS NULL AND is_read=0 GROUP BY sender_id`, [me]);
    for (const r of dm) { byUser[r.sender_id] = Number(r.n); total += Number(r.n); }
    const { rows: convs } = await query('SELECT conversation_id FROM conversation_members WHERE user_id=$1', [me]);
    if (convs.length) {
      const ids = convs.map((r) => r.conversation_id);
      const ph = ids.map((_, i) => `$${i + 2}`).join(',');
      const { rows: g } = await query(
        `SELECT m.conversation_id AS cid, COUNT(*) AS n FROM messages m
         LEFT JOIN message_reads mr ON mr.message_id=m.id AND mr.user_id=$1
         WHERE m.conversation_id IN (${ph}) AND m.sender_id<>$1 AND mr.message_id IS NULL
         GROUP BY m.conversation_id`, [me, ...ids]);
      for (const r of g) { byUser[`conv:${r.cid}`] = Number(r.n); total += Number(r.n); }
    }
    res.json({ total, byUser });
  } catch (e) { next(e); }
});

router.get('/messages/search', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) throw new HttpError(400, 'missing_query', 'Paramètre "q" requis.');
    const like = `%${q}%`;
    const me = req.user.id;
    const { rows: convs } = await query('SELECT conversation_id FROM conversation_members WHERE user_id=$1', [me]);
    const ids = convs.map((r) => r.conversation_id);
    const params = [like, me];
    const ors = ['(m.conversation_id IS NULL AND (m.sender_id=$2 OR m.recipient_id=$2))'];
    if (ids.length) {
      const ph = ids.map((_, i) => `$${params.length + 1 + i}`).join(',');
      ors.push(`(m.conversation_id IN (${ph}))`);
      params.push(...ids);
    }
    const { rows } = await query(
      `SELECT m.id, m.content, m.created_at, m.conversation_id, m.sender_id, m.recipient_id, c.name AS conv_name
       FROM messages m LEFT JOIN conversations c ON c.id=m.conversation_id
       WHERE m.content LIKE $1 AND (${ors.join(' OR ')}) ORDER BY m.created_at DESC LIMIT 50`, params);
    const peerIds = [...new Set(rows.filter((r) => !r.conversation_id).map((r) => (Number(r.sender_id) === Number(me) ? r.recipient_id : r.sender_id)))];
    let peers = {};
    if (peerIds.length) {
      const ph = peerIds.map((_, i) => `$${i + 1}`).join(',');
      const { rows: pr } = await query(`SELECT id, first_name, last_name FROM users WHERE id IN (${ph})`, peerIds);
      peers = Object.fromEntries(pr.map((u) => [u.id, `${u.first_name} ${u.last_name}`]));
    }
    res.json(rows.map((r) => ({
      id: r.id,
      snippet: String(r.content).slice(0, 120),
      createdAt: r.created_at,
      kind: r.conversation_id ? 'group' : 'direct',
      peer: r.conversation_id
        ? { conversationId: r.conversation_id, name: r.conv_name }
        : { userId: Number(r.sender_id) === Number(me) ? r.recipient_id : r.sender_id, name: peers[Number(r.sender_id) === Number(me) ? r.recipient_id : r.sender_id] ?? '' },
    })));
  } catch (e) { next(e); }
});

router.post('/messages/typing/:userId', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const other = Number(req.params.userId);
    if (!other || other === req.user.id) throw new HttpError(400, 'invalid_user', 'Utilisateur invalide.');
    setTyping(dmScope(req.user.id, other), req.user.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/messages/typing/:userId', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const other = Number(req.params.userId);
    res.json({ typing: typingUserIds(dmScope(req.user.id, other), req.user.id).length > 0 });
  } catch (e) { next(e); }
});

router.get('/messages/:userId', requirePermission('messages.read'), async(req,res,next)=>{
  try{
    const other=Number(req.params.userId);
    if(!other) throw new HttpError(400,'invalid_user','Utilisateur invalide.');
    const {rows}=await query(`SELECT ${MSG_COLS} ${MSG_JOINS} WHERE m.conversation_id IS NULL AND ((m.sender_id=$1 AND m.recipient_id=$2) OR (m.sender_id=$2 AND m.recipient_id=$1)) ORDER BY m.created_at ASC LIMIT 200`,[req.user.id,other]);
    await query('UPDATE messages SET is_read=1, read_at=CURRENT_TIMESTAMP WHERE sender_id=$1 AND recipient_id=$2 AND conversation_id IS NULL AND is_read=0',[other,req.user.id]);
    res.json(rows.map((m)=>toMessage(m,req.user.id)));
  }catch(e){next(e)}
});

router.post('/messages', requirePermission('messages.send'), async(req,res,next)=>{
  try{
    const b=z.object({
      recipientId:z.coerce.number().int().positive(),
      content:z.string().trim().min(1).max(10000),
      attachmentDocumentId:z.coerce.number().int().positive().optional(),
    }).parse(req.body);
    if(b.recipientId===req.user.id)throw new HttpError(400,'invalid_recipient','Destinataire invalide.');
    const {rows:u}=await query('SELECT id,is_active FROM users WHERE id=$1',[b.recipientId]);
    if(!u[0]||!u[0].is_active)throw new HttpError(404,'not_found','Destinataire introuvable.');
    let attDoc=null;
    if(b.attachmentDocumentId) attDoc=await assertDocReadable(b.attachmentDocumentId,req.user);
    const {rows}=await query('INSERT INTO messages(sender_id,recipient_id,content,attachment_document_id) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,b.recipientId,b.content,attDoc?attDoc.id:null]);
    await notify(b.recipientId,{type:'DIRECT_MESSAGE',title:'Nouveau message',body:`${req.user.firstName} ${req.user.lastName} vous a envoyé un message.`});
    res.status(201).json(rows[0]);
  }catch(e){next(e instanceof z.ZodError?new HttpError(400,'invalid_body',e.issues[0].message):e)}
});

// Pièce jointe téléversée depuis le composeur (mêmes restrictions que les documents).
router.post('/messages/:messageId/attachment', requirePermission('messages.send'), (req, res, next) => {
  handleChatUpload(req, res, async (err) => {
    try {
      if (err) return next(err);
      if (!req.file) throw new HttpError(400, 'missing_file', 'Aucun fichier reçu.');
      const { rows } = await query('SELECT * FROM messages WHERE id=$1', [req.params.messageId]);
      const m = rows[0];
      if (!m) throw new HttpError(404, 'not_found', 'Message introuvable.');
      if (Number(m.sender_id) !== Number(req.user.id)) throw new HttpError(403, 'forbidden', 'Seul l’auteur du message peut y joindre un fichier.');
      if (m.attachment_document_id) throw new HttpError(400, 'already_attached', 'Ce message a déjà une pièce jointe.');
      const { rows: ex } = await query('SELECT id FROM message_attachments WHERE message_id=$1', [m.id]);
      if (ex[0]) throw new HttpError(400, 'already_attached', 'Ce message a déjà une pièce jointe.');
      if (m.conversation_id) await requireConvMember(m.conversation_id, req.user.id);
      const { rows: ins } = await query(
        `INSERT INTO message_attachments(message_id,storage_path,original_name,mime_type,size_bytes,uploaded_by)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [m.id, req.file.path, req.file.originalname, req.file.mimetype, req.file.size, req.user.id]);
      res.status(201).json({ id: ins[0].id, name: ins[0].original_name, mime: ins[0].mime_type, size: Number(ins[0].size_bytes) });
    } catch (e) { next(e); }
  });
});

router.get('/messages/attachments/:id', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ma.*, m.sender_id, m.recipient_id, m.conversation_id FROM message_attachments ma
       JOIN messages m ON m.id=ma.message_id WHERE ma.id=$1`, [req.params.id]);
    const a = rows[0];
    if (!a) throw new HttpError(404, 'not_found', 'Pièce jointe introuvable.');
    const me = req.user.id;
    const isDmPair = !a.conversation_id && (Number(a.sender_id) === Number(me) || Number(a.recipient_id) === Number(me));
    if (!isDmPair) {
      if (!a.conversation_id) throw new HttpError(403, 'forbidden', 'Accès refusé.');
      await requireConvMember(a.conversation_id, me);
    }
    res.download(a.storage_path, a.original_name);
  } catch (e) { next(e); }
});

/* ---------------- Conversations de groupe ---------------- */

router.get('/conversations', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const params = [req.user.id];
    let caseFilter = '';
    if (req.query.caseId) { params.push(Number(req.query.caseId)); caseFilter = `AND c.case_id=$${params.length}`; }
    const { rows } = await query(
      `SELECT c.*, cs.case_number FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id=c.id
       LEFT JOIN cases cs ON cs.id=c.case_id
       WHERE cm.user_id=$1 ${caseFilter} ORDER BY c.created_at DESC`, params);
    const out = [];
    for (const c of rows) out.push({ ...toConv(c), members: await convMembers(c.id) });
    res.json(out);
  } catch (e) { next(e); }
});

function toConv(c) {
  return {
    id: c.id, name: c.name, createdBy: c.created_by, caseId: c.case_id ?? null,
    caseNumber: c.case_number ?? null, createdAt: c.created_at,
  };
}

router.post('/conversations', requirePermission('messages.send'), async (req, res, next) => {
  try {
    const b = z.object({
      name: z.string().trim().min(1).max(120),
      memberIds: z.array(z.coerce.number().int().positive()).min(1).max(50),
      caseId: z.coerce.number().int().positive().optional(),
    }).parse(req.body);
    const memberIds = [...new Set(b.memberIds.filter((id) => id !== req.user.id))];
    if (!memberIds.length) throw new HttpError(400, 'invalid_members', 'Ajoutez au moins un autre membre.');
    const ph = memberIds.map((_, i) => `$${i + 1}`).join(',');
    const { rows: mus } = await query(
      `SELECT u.id, u.is_active, u.client_id, r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id IN (${ph})`, memberIds);
    if (mus.length !== memberIds.length || mus.some((m) => !m.is_active)) {
      throw new HttpError(404, 'not_found', 'Un membre est introuvable ou inactif.');
    }
    let caseRow = null;
    if (b.caseId) {
      caseRow = await loadCaseOr404(b.caseId);
      await assertVisible(req.user, caseRow);
      for (const m of mus) await assertVisible({ role: m.role, id: m.id, clientId: m.client_id }, caseRow);
    }
    const { rows: conv } = await query(
      'INSERT INTO conversations(name,created_by,case_id) VALUES($1,$2,$3) RETURNING *',
      [b.name, req.user.id, caseRow ? caseRow.id : null]);
    const allIds = [req.user.id, ...memberIds];
    for (const uid of allIds) {
      await query('INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [conv[0].id, uid]);
    }
    for (const uid of memberIds) {
      await notify(uid, { type: 'GROUP_INVITE', title: 'Nouvelle conversation de groupe', body: `${req.user.firstName} ${req.user.lastName} vous a ajouté à « ${b.name} ».` });
    }
    res.status(201).json({ ...toConv(conv[0]), members: await convMembers(conv[0].id) });
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.get('/conversations/:id', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const c = await loadConvOr404(req.params.id);
    await requireConvMember(c.id, req.user.id);
    const { rows } = await query('SELECT cs.case_number FROM cases cs WHERE cs.id=$1', [c.case_id]);
    res.json({ ...toConv(c), caseNumber: rows[0]?.case_number ?? null, members: await convMembers(c.id) });
  } catch (e) { next(e); }
});

router.patch('/conversations/:id', requirePermission('messages.send'), async (req, res, next) => {
  try {
    const c = await loadConvOr404(req.params.id);
    await requireConvMember(c.id, req.user.id);
    const b = z.object({
      name: z.string().trim().min(1).max(120).optional(),
      caseId: z.coerce.number().int().positive().nullable().optional(),
    }).parse(req.body);
    let caseId = c.case_id;
    if (b.caseId !== undefined) {
      if (b.caseId) {
        if (!req.user.permissions.has('cases.update')) throw new HttpError(403, 'forbidden', 'Permission requise : cases.update.');
        const caseRow = await loadCaseOr404(b.caseId);
        await assertVisible(req.user, caseRow);
        const members = await convMembers(c.id);
        for (const m of members) {
          const ident = await userCaseIdentity(m.id);
          await assertVisible(ident, caseRow);
        }
        caseId = caseRow.id;
      } else {
        caseId = null;
      }
    }
    const { rows } = await query(
      'UPDATE conversations SET name=COALESCE($1,name), case_id=$2 WHERE id=$3 RETURNING *',
      [b.name ?? null, caseId, c.id]);
    res.json({ ...toConv(rows[0]), members: await convMembers(c.id) });
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.delete('/conversations/:id', requirePermission('messages.send'), async (req, res, next) => {
  try {
    const c = await loadConvOr404(req.params.id);
    if (Number(c.created_by) !== Number(req.user.id)) throw new HttpError(403, 'forbidden', 'Seul le créateur peut supprimer la conversation.');
    await query('DELETE FROM conversations WHERE id=$1', [c.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/conversations/:id/members', requirePermission('messages.send'), async (req, res, next) => {
  try {
    const c = await loadConvOr404(req.params.id);
    await requireConvMember(c.id, req.user.id);
    const b = z.object({ userId: z.coerce.number().int().positive() }).parse(req.body);
    if (b.userId === req.user.id) throw new HttpError(400, 'invalid_member', 'Membre invalide.');
    const ident = await userCaseIdentity(b.userId);
    if (!ident) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
    if (c.case_id) {
      const caseRow = await loadCaseOr404(c.case_id);
      await assertVisible(ident, caseRow);
    }
    await query('INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [c.id, b.userId]);
    await notify(b.userId, { type: 'GROUP_INVITE', title: 'Ajout à une conversation', body: `${req.user.firstName} ${req.user.lastName} vous a ajouté à « ${c.name} ».` });
    res.status(201).json({ members: await convMembers(c.id) });
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.delete('/conversations/:id/members/:userId', requirePermission('messages.send'), async (req, res, next) => {
  try {
    const c = await loadConvOr404(req.params.id);
    await requireConvMember(c.id, req.user.id);
    await query('DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2', [c.id, Number(req.params.userId)]);
    const { rows } = await query('SELECT COUNT(*) AS n FROM conversation_members WHERE conversation_id=$1', [c.id]);
    if (Number(rows[0].n) === 0) await query('DELETE FROM conversations WHERE id=$1', [c.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/conversations/:id/messages', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const c = await loadConvOr404(req.params.id);
    await requireConvMember(c.id, req.user.id);
    const { rows } = await query(
      `SELECT ${MSG_COLS} ${MSG_JOINS} WHERE m.conversation_id=$1 ORDER BY m.created_at ASC LIMIT 200`, [c.id]);
    await markConvRead(c.id, req.user.id);
    const readCounts = await groupReadCounts(rows.map((r) => r.id));
    res.json(rows.map((m) => toMessage(m, req.user.id, readCounts)));
  } catch (e) { next(e); }
});

router.post('/conversations/:id/messages', requirePermission('messages.send'), async (req, res, next) => {
  try {
    const c = await loadConvOr404(req.params.id);
    await requireConvMember(c.id, req.user.id);
    const b = z.object({
      content: z.string().trim().min(1).max(10000),
      attachmentDocumentId: z.coerce.number().int().positive().optional(),
    }).parse(req.body);
    let attDoc = null;
    if (b.attachmentDocumentId) attDoc = await assertDocReadable(b.attachmentDocumentId, req.user);
    const { rows } = await query(
      'INSERT INTO messages(sender_id,conversation_id,content,attachment_document_id) VALUES($1,$2,$3,$4) RETURNING *',
      [req.user.id, c.id, b.content, attDoc ? attDoc.id : null]);
    const members = await convMembers(c.id);
    for (const m of members) {
      if (m.id === req.user.id) continue;
      await notify(m.id, { type: 'GROUP_MESSAGE', title: `« ${c.name} »`, body: `${req.user.firstName} ${req.user.lastName} : ${b.content.slice(0, 120)}` });
    }
    res.status(201).json(rows[0]);
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.post('/conversations/:id/typing', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const c = await loadConvOr404(req.params.id);
    await requireConvMember(c.id, req.user.id);
    setTyping(convScope(c.id), req.user.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/conversations/:id/typing', requirePermission('messages.read'), async (req, res, next) => {
  try {
    const c = await loadConvOr404(req.params.id);
    await requireConvMember(c.id, req.user.id);
    res.json({ typing: await typingUsers(convScope(c.id), req.user.id) });
  } catch (e) { next(e); }
});

export default router;
