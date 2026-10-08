import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const shape = (r) => ({ id: r.id, label: r.label, value: r.value, position: r.position });

/** Lecture publique : la bande de statistiques de la page d'accueil. */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM site_stats ORDER BY position, id');
    res.json(rows.map(shape));
  } catch (e) { next(e); }
});

const statSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(40),
  position: z.coerce.number().int().min(0).default(0),
});

router.post('/', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const b = statSchema.parse(req.body);
    const { rows } = await query(
      'INSERT INTO site_stats (label, value, position) VALUES ($1,$2,$3) RETURNING *',
      [b.label, b.value, b.position],
    );
    await logAudit({ userId: req.user.id, action: 'site_stat.create', resourceType: 'site_stat', resourceId: rows[0].id, ip: req.ip });
    res.status(201).json(shape(rows[0]));
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.put('/:id', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const b = statSchema.partial().parse(req.body);
    const { rows } = await query(
      `UPDATE site_stats SET label=COALESCE($1,label), value=COALESCE($2,value), position=COALESCE($3,position)
       WHERE id=$4 RETURNING *`,
      [b.label, b.value, b.position, req.params.id],
    );
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Statistique introuvable.');
    await logAudit({ userId: req.user.id, action: 'site_stat.update', resourceType: 'site_stat', resourceId: rows[0].id, ip: req.ip });
    res.json(shape(rows[0]));
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.delete('/:id', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM site_stats WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Statistique introuvable.');
    await logAudit({ userId: req.user.id, action: 'site_stat.delete', resourceType: 'site_stat', resourceId: req.params.id, ip: req.ip });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
