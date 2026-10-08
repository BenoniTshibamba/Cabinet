import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const shape = (r) => ({ id: r.id, title: r.title, description: r.description, position: r.position });

/** Lecture publique : la page d'accueil affiche les domaines de pratique. */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM practice_areas ORDER BY position, id');
    res.json(rows.map(shape));
  } catch (e) { next(e); }
});

const areaSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(''),
  position: z.coerce.number().int().min(0).default(0),
});

router.post('/', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const b = areaSchema.parse(req.body);
    const { rows } = await query(
      'INSERT INTO practice_areas (title, description, position) VALUES ($1,$2,$3) RETURNING *',
      [b.title, b.description, b.position],
    );
    await logAudit({ userId: req.user.id, action: 'practice_area.create', resourceType: 'practice_area', resourceId: rows[0].id, ip: req.ip });
    res.status(201).json(shape(rows[0]));
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.put('/:id', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const b = areaSchema.partial().parse(req.body);
    const { rows } = await query(
      `UPDATE practice_areas SET title=COALESCE($1,title), description=COALESCE($2,description), position=COALESCE($3,position)
       WHERE id=$4 RETURNING *`,
      [b.title, b.description, b.position, req.params.id],
    );
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Domaine introuvable.');
    await logAudit({ userId: req.user.id, action: 'practice_area.update', resourceType: 'practice_area', resourceId: rows[0].id, ip: req.ip });
    res.json(shape(rows[0]));
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

router.delete('/:id', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM practice_areas WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Domaine introuvable.');
    await logAudit({ userId: req.user.id, action: 'practice_area.delete', resourceType: 'practice_area', resourceId: req.params.id, ip: req.ip });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
