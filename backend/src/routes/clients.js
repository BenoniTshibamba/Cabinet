import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { hardDeleteClient } from '../services/trash.js';

const router = Router();
router.use(requireAuth);

const toClient = (c) => ({
  id: c.id,
  firstName: c.first_name,
  lastName: c.last_name,
  email: c.email,
  phone: c.phone,
  company: c.company,
  address: c.address,
  notes: c.notes,
  createdAt: c.created_at,
  updatedAt: c.updated_at,
});

/* Corbeille : liste les clients supprimés (restaurables 24h). Définie avant /:id. */
router.get('/trash', requirePermission('clients.delete'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM clients WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200',
    );
    res.json(rows.map((c) => ({ ...toClient(c), deletedAt: c.deleted_at })));
  } catch (err) {
    next(err);
  }
});

router.get('/', requirePermission('clients.read'), async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const params = [];
    const conds = ['deleted_at IS NULL'];
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`);
    }
    // Un avocat ne voit que ses propres clients : ceux ayant au moins un dossier
    // qui lui est assigné ou partagé avec lui.
    if (req.user.role === 'LAWYER') {
      params.push(req.user.id);
      conds.push(`EXISTS (SELECT 1 FROM cases cs WHERE cs.client_id = clients.id AND cs.deleted_at IS NULL AND (cs.lawyer_id = $${params.length} OR EXISTS (SELECT 1 FROM case_shares sh WHERE sh.case_id = cs.id AND sh.lawyer_id = $${params.length})))`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await query(`SELECT * FROM clients ${where} ORDER BY created_at DESC LIMIT 200`, params);
    res.json(rows.map(toClient));
  } catch (err) {
    next(err);
  }
});

/** Un avocat ne peut voir/modifier que ses propres clients (dossier assigné ou partagé). */
async function assertClientVisible(user, clientId) {
  if (user.role !== 'LAWYER') return;
  const { rows } = await query(
    `SELECT 1 FROM cases cs WHERE cs.client_id = $1 AND cs.deleted_at IS NULL
     AND (cs.lawyer_id = $2 OR EXISTS (SELECT 1 FROM case_shares sh WHERE sh.case_id = cs.id AND sh.lawyer_id = $2)) LIMIT 1`,
    [clientId, user.id],
  );
  if (!rows[0]) throw new HttpError(403, 'forbidden', 'Accès refusé à ce client.');
}

router.get('/:id', requirePermission('clients.read'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM clients WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Client introuvable.');
    await assertClientVisible(req.user, req.params.id);
    res.json(toClient(rows[0]));
  } catch (err) {
    next(err);
  }
});

const clientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/', requirePermission('clients.create'), async (req, res, next) => {
  try {
    const b = clientSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO clients (first_name, last_name, email, phone, company, address, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.firstName, b.lastName, b.email || null, b.phone ?? null, b.company ?? null, b.address ?? null, b.notes ?? null, req.user.id],
    );
    await logAudit({ userId: req.user.id, action: 'CLIENT_CREATED', resourceType: 'client', resourceId: rows[0].id, newValues: toClient(rows[0]), ip: req.ip });
    res.status(201).json(toClient(rows[0]));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

router.patch('/:id', requirePermission('clients.update'), async (req, res, next) => {
  try {
    const b = clientSchema.partial().parse(req.body);
    const { rows: before } = await query('SELECT * FROM clients WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!before[0]) throw new HttpError(404, 'not_found', 'Client introuvable.');
    await assertClientVisible(req.user, req.params.id);

    const { rows } = await query(
      `UPDATE clients SET
         first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
         email = COALESCE($3, email), phone = COALESCE($4, phone), company = COALESCE($5, company),
         address = COALESCE($6, address), notes = COALESCE($7, notes), updated_at = now()
       WHERE id = $8 RETURNING *`,
      [b.firstName, b.lastName, b.email, b.phone, b.company, b.address, b.notes, req.params.id],
    );
    await logAudit({ userId: req.user.id, action: 'CLIENT_UPDATED', resourceType: 'client', resourceId: req.params.id, oldValues: toClient(before[0]), newValues: toClient(rows[0]), ip: req.ip });
    res.json(toClient(rows[0]));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

/* Restauration d'un client depuis la corbeille (24h). */
router.post('/:id/restore', requirePermission('clients.delete'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE clients SET deleted_at = NULL, updated_at = now() WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
      [req.params.id],
    );
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Client introuvable dans la corbeille.');
    await logAudit({ userId: req.user.id, action: 'CLIENT_RESTORED', resourceType: 'client', resourceId: req.params.id, newValues: toClient(rows[0]), ip: req.ip });
    res.json(toClient(rows[0]));
  } catch (err) {
    next(err);
  }
});

/* Suppression : par défaut mise en corbeille (restaurable 24h) ;
   ?permanent=1 pour une suppression définitive immédiate. */
router.delete('/:id', requirePermission('clients.delete'), async (req, res, next) => {
  try {
    await assertClientVisible(req.user, req.params.id);
    const permanent = String(req.query.permanent ?? '') === '1';
    if (!permanent) {
      // Seuls les dossiers actifs bloquent la mise en corbeille.
      const { rows: deps } = await query(
        'SELECT COUNT(*) AS n FROM cases WHERE client_id = $1 AND deleted_at IS NULL', [req.params.id],
      );
      if (Number(deps[0]?.n ?? 0) > 0) {
        throw new HttpError(409, 'has_dependencies', 'Ce client a des dossiers associés : mettez d\u2019abord ses dossiers en corbeille.');
      }
      const { rows } = await query(
        'UPDATE clients SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING *',
        [req.params.id],
      );
      if (!rows[0]) throw new HttpError(404, 'not_found', 'Client introuvable.');
      await logAudit({ userId: req.user.id, action: 'CLIENT_TRASHED', resourceType: 'client', resourceId: req.params.id, oldValues: toClient(rows[0]), ip: req.ip });
      res.json({ ...toClient(rows[0]), deletedAt: rows[0].deleted_at });
      return;
    }
    const gone = await hardDeleteClient(req.params.id, { userId: req.user.id, ip: req.ip, auditAction: 'CLIENT_DELETED' });
    if (!gone) throw new HttpError(404, 'not_found', 'Client introuvable.');
    res.status(204).end();
  } catch (err) {
    // Un client lié à des dossiers ne peut pas être supprimé (contrainte de clé étrangère).
    if (err.code === '23503') return next(new HttpError(409, 'has_dependencies', 'Ce client a des dossiers associés et ne peut pas être supprimé.'));
    next(err);
  }
});

export default router;
