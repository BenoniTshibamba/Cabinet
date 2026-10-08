import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();

export const TESTIMONIALS_DIR = join(resolve(process.env.UPLOAD_DIR ?? './uploads'), 'testimonials');
mkdirSync(TESTIMONIALS_DIR, { recursive: true });

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_SIZE = 8 * 1024 * 1024;
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TESTIMONIALS_DIR),
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new HttpError(400, 'invalid_file_type', `Type d'image non autorisé : ${ext || 'inconnu'}.`));
    cb(null, true);
  },
});
const handlePhoto = (req, res, next) => photoUpload.single('photo')(req, res, (err) => {
  if (err instanceof multer.MulterError) return next(new HttpError(400, 'upload_error', err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop volumineuse (8 Mo max).' : err.message));
  if (err) return next(err);
  next();
});

const shape = (r) => ({
  id: r.id, name: r.name, roleText: r.role_text, content: r.content,
  photoUrl: r.photo_path ? `/uploads/testimonials/${r.photo_path}` : null,
  position: r.position,
});

function deletePhoto(photoPath) {
  if (!photoPath) return;
  const abs = join(TESTIMONIALS_DIR, String(photoPath).split('/').pop());
  if (!abs.startsWith(TESTIMONIALS_DIR) || !existsSync(abs)) return;
  try { unlinkSync(abs); } catch { /* déjà supprimé */ }
}

/** Lecture publique : la page d'accueil affiche les témoignages. */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM testimonials ORDER BY position, id');
    res.json(rows.map(shape));
  } catch (e) { next(e); }
});

const testiSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role_text: z.string().trim().max(160).default(''),
  content: z.string().trim().min(1).max(2000),
  position: z.coerce.number().int().min(0).default(0),
});

router.post('/', requireAuth, requirePermission('users.update'), handlePhoto, async (req, res, next) => {
  try {
    const b = testiSchema.parse(req.body);
    const { rows } = await query(
      'INSERT INTO testimonials (name, role_text, content, photo_path, position) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [b.name, b.role_text, b.content, req.file?.filename ?? null, b.position],
    );
    await logAudit({ userId: req.user.id, action: 'testimonial.create', resourceType: 'testimonial', resourceId: rows[0].id, ip: req.ip });
    res.status(201).json(shape(rows[0]));
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.put('/:id', requireAuth, requirePermission('users.update'), handlePhoto, async (req, res, next) => {
  try {
    const b = testiSchema.partial().parse(req.body);
    const { rows: before } = await query('SELECT * FROM testimonials WHERE id=$1', [req.params.id]);
    if (!before[0]) throw new HttpError(404, 'not_found', 'Témoignage introuvable.');
    const removePhoto = req.body.removePhoto === 'true';
    if ((req.file || removePhoto) && before[0].photo_path) deletePhoto(before[0].photo_path);
    const newPhoto = req.file ? req.file.filename : (removePhoto ? null : before[0].photo_path);
    const { rows } = await query(
      `UPDATE testimonials SET name=COALESCE($1,name), role_text=COALESCE($2,role_text), content=COALESCE($3,content),
        photo_path=$4, position=COALESCE($5,position) WHERE id=$6 RETURNING *`,
      [b.name, b.role_text, b.content, newPhoto, b.position, req.params.id],
    );
    await logAudit({ userId: req.user.id, action: 'testimonial.update', resourceType: 'testimonial', resourceId: rows[0].id, ip: req.ip });
    res.json(shape(rows[0]));
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.delete('/:id', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM testimonials WHERE id=$1 RETURNING *', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Témoignage introuvable.');
    deletePhoto(rows[0].photo_path);
    await logAudit({ userId: req.user.id, action: 'testimonial.delete', resourceType: 'testimonial', resourceId: req.params.id, ip: req.ip });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
