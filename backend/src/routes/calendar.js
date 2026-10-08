import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/calendar?from=AAAA-MM-JJ&to=AAAA-MM-JJ
 * Renvoie les échéances (dossiers + factures) visibles par l'utilisateur
 * dans l'intervalle demandé : [{ type: 'case'|'invoice', id, title, dueDate, overdue }].
 */
router.get('/', requirePermission('cases.read'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) throw new HttpError(400, 'missing_range', 'Paramètres « from » et « to » (AAAA-MM-JJ) requis.');
    const events = [];
    const today = new Date().toISOString().slice(0, 10);
    const { user } = req;

    if (user.permissions.has('cases.read')) {
      const scope = user.role === 'LAWYER' ? 'AND cs.lawyer_id = $3'
        : user.role === 'CLIENT' ? 'AND cs.client_id = $3' : '';
      const params = scope ? [from, to, user.role === 'CLIENT' ? user.clientId ?? -1 : user.id] : [from, to];
      const { rows } = await query(
        `SELECT cs.id, cs.case_number, cs.title, cs.due_date, cs.status
         FROM cases cs
         WHERE cs.due_date IS NOT NULL AND cs.due_date >= $1 AND cs.due_date <= $2 ${scope}
         ORDER BY cs.due_date ASC`,
        params,
      );
      for (const r of rows) {
        events.push({
          type: 'case', id: r.id,
          title: `${r.case_number} — ${r.title}`,
          dueDate: r.due_date,
          overdue: r.due_date < today && !['TERMINE', 'ARCHIVE'].includes(r.status),
        });
      }
    }

    if (user.permissions.has('billing.read')) {
      const scope = user.role === 'CLIENT' ? 'AND inv.client_id = $3' : '';
      const params = scope ? [from, to, user.clientId ?? -1] : [from, to];
      const { rows } = await query(
        `SELECT inv.id, inv.invoice_number, inv.due_at, inv.status
         FROM invoices inv
         WHERE inv.due_at IS NOT NULL AND inv.due_at >= $1 AND inv.due_at <= $2 ${scope}
         ORDER BY inv.due_at ASC`,
        params,
      );
      for (const r of rows) {
        events.push({
          type: 'invoice', id: r.id,
          title: `Facture ${r.invoice_number}`,
          dueDate: r.due_at,
          overdue: r.due_at < today && !['PAYEE', 'ANNULEE'].includes(r.status),
        });
      }
    }

    events.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
    res.json(events);
  } catch (err) {
    next(err);
  }
});

export default router;
