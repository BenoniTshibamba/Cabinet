import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requirePermission('dashboard.read'));

router.get('/', async (req, res, next) => {
  try {
    const { user } = req;
    const caseScope = user.role === 'LAWYER' ? 'WHERE lawyer_id = $1' : user.role === 'CLIENT' ? 'WHERE client_id = $1' : '';
    const caseParams = caseScope ? [user.role === 'CLIENT' ? user.clientId ?? -1 : user.id] : [];

    const [cases, clientsCount, unpaidInvoices, documentsCount, recentCases, revenueByMonth, openByLawyer, upcomingDeadlines, overdueInvoices] = await Promise.all([
      query(`SELECT status, count(*)::int AS n FROM cases ${caseScope} GROUP BY status`, caseParams),
      user.role === 'CLIENT' ? Promise.resolve({ rows: [{ n: 0 }] }) : query('SELECT count(*)::int AS n FROM clients'),
      query(
        `SELECT count(*)::int AS n, COALESCE(sum(amount_cents + tax_cents), 0)::bigint AS total
         FROM invoices WHERE status NOT IN ('PAYEE','ANNULEE') ${user.role === 'CLIENT' ? 'AND client_id = $1' : ''}`,
        user.role === 'CLIENT' ? [user.clientId ?? -1] : [],
      ),
      query(
        `SELECT count(*)::int AS n FROM documents d JOIN cases cs ON cs.id = d.case_id ${caseScope.replace('WHERE', 'WHERE cs.')}`,
        caseParams,
      ),
      query(
        `SELECT cs.id, cs.title, cs.status, cs.updated_at, cl.first_name, cl.last_name
         FROM cases cs JOIN clients cl ON cl.id = cs.client_id
         ${caseScope} ORDER BY cs.updated_at DESC LIMIT 6`,
        caseParams,
      ),
      // Revenus facturés par mois (6 derniers mois, factures non annulées).
      query(
        `SELECT strftime('%Y-%m', issued_at) AS month, COALESCE(sum(amount_cents + tax_cents), 0)::bigint AS total
         FROM invoices
         WHERE status != 'ANNULEE' AND issued_at >= date('now', '-6 months')
         ${user.role === 'CLIENT' ? 'AND client_id = $1' : ''}
         GROUP BY month ORDER BY month ASC`,
        user.role === 'CLIENT' ? [user.clientId ?? -1] : [],
      ),
      // Dossiers actifs par avocat (rôles internes uniquement).
      user.role === 'CLIENT'
        ? Promise.resolve({ rows: [] })
        : query(
            `SELECT COALESCE(lw.first_name || ' ' || lw.last_name, 'Non assigné') AS lawyer_name, count(*)::int AS n
             FROM cases cs LEFT JOIN users lw ON lw.id = cs.lawyer_id
             WHERE cs.status IN ('NOUVEAU','EN_COURS','EN_ATTENTE')
             ${user.role === 'LAWYER' ? 'AND cs.lawyer_id = $1' : ''}
             GROUP BY lawyer_name ORDER BY n DESC LIMIT 10`,
            user.role === 'LAWYER' ? [user.id] : [],
          ),
      // Échéances : en retard + 7 prochains jours.
      query(
        `SELECT cs.id, cs.case_number, cs.title, cs.due_date,
                CASE WHEN cs.due_date < date('now') THEN 1 ELSE 0 END AS overdue
         FROM cases cs ${caseScope}
         ${caseScope ? 'AND' : 'WHERE'} cs.due_date IS NOT NULL
           AND cs.due_date <= date('now', '+7 days')
           AND cs.status NOT IN ('TERMINE','ARCHIVE')
         ORDER BY cs.due_date ASC LIMIT 20`,
        caseParams,
      ),
      // Factures en retard.
      query(
        `SELECT inv.id, inv.invoice_number, inv.due_at, (inv.amount_cents + inv.tax_cents)::bigint AS total
         FROM invoices inv
         WHERE inv.due_at < date('now') AND inv.status NOT IN ('PAYEE','ANNULEE')
         ${user.role === 'CLIENT' ? 'AND inv.client_id = $1' : ''}
         ORDER BY inv.due_at ASC LIMIT 20`,
        user.role === 'CLIENT' ? [user.clientId ?? -1] : [],
      ),
    ]);

    const statusCounts = Object.fromEntries(cases.rows.map((r) => [r.status, r.n]));
    const activeStatuses = ['NOUVEAU', 'EN_COURS', 'EN_ATTENTE'];

    // Complète les 6 derniers mois même sans factures (pour un graphique régulier).
    const monthLabels = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const revenueMap = Object.fromEntries(revenueByMonth.rows.map((r) => [r.month, Number(r.total)]));

    res.json({
      cases: {
        total: cases.rows.reduce((s, r) => s + r.n, 0),
        active: activeStatuses.reduce((s, k) => s + (statusCounts[k] ?? 0), 0),
        completed: statusCounts.TERMINE ?? 0,
        byStatus: statusCounts,
      },
      clients: { total: clientsCount.rows[0].n },
      billing: { unpaidCount: unpaidInvoices.rows[0].n, unpaidCents: Number(unpaidInvoices.rows[0].total) },
      documents: { total: documentsCount.rows[0].n },
      recentCases: recentCases.rows.map((c) => ({
        id: c.id, title: c.title, status: c.status, clientName: `${c.first_name} ${c.last_name}`, updatedAt: c.updated_at,
      })),
      revenueByMonth: monthLabels.map((m) => ({ month: m, totalCents: revenueMap[m] ?? 0 })),
      openCasesByLawyer: openByLawyer.rows.map((r) => ({ lawyerName: r.lawyer_name, count: r.n })),
      upcomingDeadlines: upcomingDeadlines.rows.map((d) => ({
        id: d.id, caseNumber: d.case_number, title: d.title, dueDate: d.due_date, overdue: d.overdue === 1,
      })),
      overdueInvoices: overdueInvoices.rows.map((i) => ({
        id: i.id, invoiceNumber: i.invoice_number, dueAt: i.due_at, totalCents: Number(i.total),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
