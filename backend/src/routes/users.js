import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { ROLES } from '../utils/permissions.js';
import { passwordSchema } from '../utils/password.js';

const router = Router();
router.use(requireAuth);

const STAFF_ROLES = ROLES.filter((r) => r !== 'CLIENT');

const avatarUrl = (u) => (u.avatar_filename ? `/uploads/avatars/${u.avatar_filename}` : null);

// Profil public d'un utilisateur : visible par tout utilisateur authentifié.
// Ne renvoie aucune donnée sensible (pas d'e-mail, pas de permissions).
router.get('/:id/profile', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'invalid_id', 'Identifiant invalide.');
    const { rows } = await query(
      `SELECT u.id, u.first_name, u.last_name, u.avatar_filename, r.name AS role,
        (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS post_count
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
    const u = rows[0];
    res.json({
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      avatarUrl: avatarUrl(u),
      postCount: Number(u.post_count ?? 0),
    });
  } catch (err) { next(err); }
});

const AVATARS_DIR = join(resolve(process.env.UPLOAD_DIR ?? './uploads'), 'avatars');
export { AVATARS_DIR };

const AVATAR_ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2 Mo

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { mkdirSync(AVATARS_DIR, { recursive: true }); cb(null, AVATARS_DIR); },
    filename: (req, file, cb) => cb(null, `avatar-${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: AVATAR_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!AVATAR_ALLOWED_EXT.has(ext)) {
      return cb(new HttpError(400, 'invalid_file_type', 'Type de fichier non autorisé. Formats acceptés : PNG, JPG, GIF, WebP.'));
    }
    cb(null, true);
  },
});

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  firstName: u.first_name,
  lastName: u.last_name,
  role: u.role,
  clientId: u.client_id ?? null,
  avatarUrl: avatarUrl(u),
  isActive: u.is_active,
  createdAt: u.created_at,
});

/* ---- Photo de profil ---- */

function deleteAvatarFile(filename) {
  if (!filename) return;
  const p = join(AVATARS_DIR, filename);
  if (existsSync(p)) unlinkSync(p);
}

async function setAvatar(userId, filename) {
  const { rows } = await query('SELECT avatar_filename FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
  deleteAvatarFile(rows[0].avatar_filename);
  const { rows: updated } = await query('UPDATE users SET avatar_filename = $1, updated_at = now() WHERE id = $2 RETURNING avatar_filename', [filename, userId]);
  return avatarUrl({ avatar_filename: updated[0].avatar_filename });
}

const handleAvatar = (req, res, next) => avatarUpload.single('avatar')(req, res, (err) => {
  if (err instanceof multer.MulterError) {
    return next(new HttpError(400, 'upload_error', err.code === 'LIMIT_FILE_SIZE' ? 'Image trop volumineuse (2 Mo max).' : err.message));
  }
  next(err);
});

// L'utilisateur modifie sa propre photo (aucune permission spéciale requise).
router.post('/me/avatar', handleAvatar, async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'missing_file', 'Aucune image reçue.');
    const url = await setAvatar(req.user.id, req.file.filename);
    await logAudit({ userId: req.user.id, action: 'AVATAR_UPDATED', resourceType: 'user', resourceId: req.user.id, ip: req.ip });
    res.json({ avatarUrl: url });
  } catch (err) { next(err); }
});

router.delete('/me/avatar', async (req, res, next) => {
  try {
    const url = await setAvatar(req.user.id, null);
    await logAudit({ userId: req.user.id, action: 'AVATAR_REMOVED', resourceType: 'user', resourceId: req.user.id, ip: req.ip });
    res.json({ avatarUrl: url });
  } catch (err) { next(err); }
});

// L'admin peut définir la photo d'un autre utilisateur.
router.post('/:id/avatar', requirePermission('users.update'), handleAvatar, async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'missing_file', 'Aucune image reçue.');
    const url = await setAvatar(Number(req.params.id), req.file.filename);
    await logAudit({ userId: req.user.id, action: 'AVATAR_UPDATED', resourceType: 'user', resourceId: Number(req.params.id), ip: req.ip });
    res.json({ avatarUrl: url });
  } catch (err) { next(err); }
});

router.delete('/:id/avatar', requirePermission('users.update'), async (req, res, next) => {
  try {
    const url = await setAvatar(Number(req.params.id), null);
    await logAudit({ userId: req.user.id, action: 'AVATAR_REMOVED', resourceType: 'user', resourceId: Number(req.params.id), ip: req.ip });
    res.json({ avatarUrl: url });
  } catch (err) { next(err); }
});

router.get('/', requirePermission('users.read'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name != 'CLIENT' ORDER BY u.created_at DESC`,
    );
    res.json(rows.map(publicUser));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(ROLES),
  clientId: z.coerce.number().int().positive().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'CLIENT' && !data.clientId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clientId'], message: 'Un dossier client lié (clientId) est requis pour un compte client.' });
  }
  if (data.role !== 'CLIENT' && data.clientId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clientId'], message: 'clientId est réservé aux comptes clients.' });
  }
});

router.post('/', requirePermission('users.create'), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const { rows: roleRows } = await query('SELECT id FROM roles WHERE name = $1', [body.role]);
    if (!roleRows[0]) throw new HttpError(400, 'invalid_role', 'Rôle invalide.');
    // Un compte CLIENT donne accès au site : il doit être rattaché à un dossier client existant.
    let clientId = null;
    if (body.role === 'CLIENT') {
      const { rows: c } = await query('SELECT id FROM clients WHERE id = $1', [body.clientId]);
      if (!c[0]) throw new HttpError(404, 'client_not_found', 'Dossier client introuvable.');
      clientId = c[0].id;
    }
    const hash = await bcrypt.hash(body.password, 12);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, client_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.email.toLowerCase(), hash, body.firstName, body.lastName, roleRows[0].id, clientId],
    );
    const user = { ...rows[0], role: body.role };
    await logAudit({ userId: req.user.id, action: 'USER_CREATED', resourceType: 'user', resourceId: user.id, newValues: publicUser(user), ip: req.ip });
    res.status(201).json(publicUser(user));
  } catch (err) {
    if (err instanceof z.ZodError) return next(new HttpError(400, 'invalid_body', err.issues[0].message));
    if (err.code === '23505') return next(new HttpError(409, 'email_taken', 'Cet email est déjà utilisé.'));
    if (err.code === '23503') return next(new HttpError(404, 'client_not_found', 'Dossier client introuvable.'));
    next(err);
  }
});

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(STAFF_ROLES).optional(),
  isActive: z.boolean().optional(),
});

router.patch('/:id', requirePermission('users.update'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = updateSchema.parse(req.body);
    const { rows: before } = await query(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [id],
    );
    if (!before[0]) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');

    let roleId;
    if (body.role) {
      const { rows } = await query('SELECT id FROM roles WHERE name = $1', [body.role]);
      roleId = rows[0].id;
    }
    const { rows } = await query(
      `UPDATE users SET
         first_name = COALESCE($1, first_name),
         last_name  = COALESCE($2, last_name),
         role_id    = COALESCE($3, role_id),
         is_active  = COALESCE($4, is_active),
         updated_at = now()
       WHERE id = $5 RETURNING *`,
      [body.firstName, body.lastName, roleId, body.isActive, id],
    );
    const after = { ...rows[0], role: body.role ?? before[0].role };
    await logAudit({
      userId: req.user.id, action: 'USER_UPDATED', resourceType: 'user', resourceId: id,
      oldValues: publicUser(before[0]), newValues: publicUser(after), ip: req.ip,
    });
    res.json(publicUser(after));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

/**
 * Désactivation d'un utilisateur (suppression logique : l'historique et l'audit
 * sont préservés, le compte ne peut plus se connecter). Réactivation possible
 * via PATCH /users/:id { isActive: true }.
 */
router.delete('/:id', requirePermission('users.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'invalid_id', 'Identifiant invalide.');
    if (id === req.user.id) throw new HttpError(400, 'cannot_deactivate_self', 'Vous ne pouvez pas désactiver votre propre compte.');
    const { rows } = await query(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [id],
    );
    const target = rows[0];
    if (!target) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
    if (!target.is_active) throw new HttpError(400, 'already_inactive', 'Ce compte est déjà désactivé.');
    if (target.role === 'SUPER_ADMIN') {
      const { rows: c } = await query(
        `SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'SUPER_ADMIN' AND u.is_active = 1`,
      );
      if (Number(c[0].n) <= 1) throw new HttpError(400, 'last_super_admin', 'Impossible de désactiver le dernier super-administrateur.');
    }
    const { rows: cases } = await query('SELECT COUNT(*) AS n FROM cases WHERE lawyer_id = $1', [id]);
    if (Number(cases[0].n) > 0) {
      throw new HttpError(409, 'has_assigned_cases', `Cet utilisateur a encore ${cases[0].n} dossier(s) assigné(s). Réassignez-les avant de le désactiver.`);
    }
    await query('UPDATE users SET is_active = 0, updated_at = now() WHERE id = $1', [id]);
    // Les sessions existantes sont révoquées immédiatement.
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
    await logAudit({
      userId: req.user.id, action: 'USER_DEACTIVATED', resourceType: 'user', resourceId: id,
      oldValues: publicUser(target), ip: req.ip,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
