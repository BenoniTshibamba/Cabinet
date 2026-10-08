import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { loadCaseOr404, assertVisible } from './cases.js';

const router = Router();
router.use(requireAuth);

const toEntry = (e) => ({
  id: e.id,
  userId: e.user_id,
  userName: e.first_name ? `${e.first_name} ${e.last_name}` : undefined,
  caseId: e.case_id,
  caseTitle: e.case_title,
  caseNumber: e.case_number,
  clientId: e.client_id,
  clientName: e.client_first_name ? `${e.client_first_name} ${e.client_last_name}` : undefined,
  date: e.date,
  hours: Number(e.hours),
  description: e.description,
  rate: Number(e.rate),
  amountCents: Math.round(Number(e.hours) * Number(e.rate) * 100),
  invoiceId: e.invoice_id,
  createdAt: e.created_at,
});

const SELECT = `SELECT te.*, u.first_name, u.last_name, cs.title AS case_title, cs.case_number,
  cl.id AS client_id, cl.first_name AS client_first_name, cl.last_name AS client_last_name
  FROM time_entries te
  JOIN users u ON u.id = te.user_id
  JOIN cases cs ON cs.id = te.case_id
  JOIN clients cl ON cl.id = cs.client_id`;

/** Un avocat ne voit que ses propres saisies ; les autres rôles autorisés voient tout. */
function scopeClause(user, paramIndex) {
  if (user.role === 'LAWYER') return { sql: `AND te.user_id = $${paramIndex}`, param: user.id };
  return { sql: '', param: null };
}

router.get('/', requirePermission('time.read'), async (req, res, next) => {
  try {
    const params = [];
    const filters = [];
    if (req.query.caseId) {
      params.push(Number(req.query.caseId));
      filters.push(`te.case_id = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      filters.push(`te.date >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      filters.push(`te.date <= $${params.length}`);
    }
    if (req.query.unbilled === '1') filters.push('te.invoice_id IS NULL');
    const scope = scopeClause(req.user, params.length + 1);
    if (scope.param !== null) params.push(scope.param);
    const { rows } = await query(
      `${SELECT} WHERE 1=1 ${filters.map((f) => `AND ${f}`).join(' ')} ${scope.sql} ORDER BY te.date DESC, te.id DESC LIMIT 500`,
      params,
    );
    res.json(rows.map(toEntry));
  } catch (err) {
    next(err);
  }
});

/** Totaux pour un dossier : heures et montants, ventilés facturé / non facturé. */
router.get('/case/:caseId/totals', requirePermission('time.read'), async (req, res, next) => {
  try {
    const c = await loadCaseOr404(req.params.caseId);
    await assertVisible(req.user, c);
    const scope = req.user.role === 'LAWYER' ? 'AND te.user_id = $2' : '';
    const params = scope ? [req.params.caseId, req.user.id] : [req.params.caseId];
    const { rows } = await query(
      `SELECT COALESCE(SUM(te.hours), 0) AS hours,
              COALESCE(SUM(te.hours * te.rate), 0) AS amount,
              COALESCE(SUM(CASE WHEN te.invoice_id IS NULL THEN te.hours ELSE 0 END), 0) AS unbilled_hours,
              COALESCE(SUM(CASE WHEN te.invoice_id IS NULL THEN te.hours * te.rate ELSE 0 END), 0) AS unbilled_amount
       FROM time_entries te WHERE te.case_id = $1 ${scope}`,
      params,
    );
    const r = rows[0];
    res.json({
      caseId: Number(req.params.caseId),
      totalHours: Number(r.hours),
      totalCents: Math.round(Number(r.amount) * 100),
      unbilledHours: Number(r.unbilled_hours),
      unbilledCents: Math.round(Number(r.unbilled_amount) * 100),
    });
  } catch (err) {
    next(err);
  }
});

const entrySchema = z.object({
  caseId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).'),
  hours: z.number().positive().max(24),
  description: z.string().max(500).optional(),
  rate: z.number().nonnegative().optional(),
});

router.post('/', requirePermission('time.create'), async (req, res, next) => {
  try {
    const b = entrySchema.parse(req.body);
    const c = await loadCaseOr404(b.caseId);
    await assertVisible(req.user, c);
    const { rows } = await query(
      `INSERT INTO time_entries (user_id, case_id, date, hours, description, rate)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.user.id, b.caseId, b.date, b.hours, b.description?.trim() || null, b.rate ?? 0],
    );
    const { rows: full } = await query(`${SELECT} WHERE te.id = $1`, [rows[0].id]);
    await logAudit({ userId: req.user.id, action: 'TIME_ENTRY_CREATED', resourceType: 'time_entry', resourceId: full[0].id, newValues: toEntry(full[0]), ip: req.ip });
    res.status(201).json(toEntry(full[0]));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

async function loadEntryOr404(id) {
  const { rows } = await query(`${SELECT} WHERE te.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Saisie de temps introuvable.');
  return rows[0];
}

function assertOwnEntry(user, row) {
  if ((user.role === 'LAWYER' || user.role === 'ASSISTANT') && row.user_id !== user.id) {
    throw new HttpError(403, 'forbidden', 'Vous ne pouvez modifier que vos propres saisies.');
  }
}

const patchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).').optional(),
  hours: z.number().positive().max(24).optional(),
  description: z.string().max(500).nullable().optional(),
  rate: z.number().nonnegative().optional(),
  invoiceId: z.number().int().nullable().optional(),
});

router.patch('/:id', requirePermission('time.update'), async (req, res, next) => {
  try {
    const before = await loadEntryOr404(req.params.id);
    assertOwnEntry(req.user, before);
    const b = patchSchema.parse(req.body);
    const { rows } = await query(
      `UPDATE time_entries SET
         date = COALESCE($1, date), hours = COALESCE($2, hours),
         description = COALESCE($3, description), rate = COALESCE($4, rate),
         invoice_id = COALESCE($5, invoice_id), updated_at = now()
       WHERE id = $6 RETURNING id`,
      [b.date ?? null, b.hours ?? null, b.description ?? null, b.rate ?? null, b.invoiceId ?? null, req.params.id],
    );
    const after = await loadEntryOr404(rows[0].id);
    await logAudit({ userId: req.user.id, action: 'TIME_ENTRY_UPDATED', resourceType: 'time_entry', resourceId: after.id, oldValues: toEntry(before), newValues: toEntry(after), ip: req.ip });
    res.json(toEntry(after));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

router.delete('/:id', requirePermission('time.delete'), async (req, res, next) => {
  try {
    const before = await loadEntryOr404(req.params.id);
    assertOwnEntry(req.user, before);
    await query('DELETE FROM time_entries WHERE id = $1', [req.params.id]);
    await logAudit({ userId: req.user.id, action: 'TIME_ENTRY_DELETED', resourceType: 'time_entry', resourceId: req.params.id, oldValues: toEntry(before), ip: req.ip });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
