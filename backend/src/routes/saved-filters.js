import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requirePermission('cases.read'));

const toFilter = (f) => ({
  id: f.id,
  name: f.name,
  filters: JSON.parse(f.filters),
  createdAt: f.created_at,
});

const filterSchema = z.object({
  name: z.string().min(1).max(80),
  filters: z.object({
    q: z.string().optional(),
    status: z.string().optional(),
    lawyerId: z.number().int().nullable().optional(),
    priority: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
});

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM saved_filters WHERE user_id = $1 ORDER BY name ASC', [req.user.id]);
    res.json(rows.map(toFilter));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const b = filterSchema.parse(req.body);
    const { rows } = await query(
      'INSERT INTO saved_filters (user_id, name, filters) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, b.name.trim(), JSON.stringify(b.filters)],
    );
    res.status(201).json(toFilter(rows[0]));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM saved_filters WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Filtre introuvable.');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
