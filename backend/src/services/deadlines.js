import { query } from '../db/pool.js';
import { notifyMany, notify } from './notify.js';
import { sendMail, isMailConfigured } from './mailer.js';

/**
 * Vérification quotidienne des échéances :
 * - dossiers dus dans ≤ 3 jours ou en retard → avocat responsable (ou admins si non assigné),
 * - factures en retard → tous les comptables.
 * Envoie un courriel (si SMTP configuré) ET une notification in-app.
 */
export async function runDeadlineCheck() {
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  // --- Dossiers ---
  const { rows: cases } = await query(
    `SELECT cs.id, cs.case_number, cs.title, cs.due_date, cs.lawyer_id,
            u.email AS lawyer_email, u.first_name, u.last_name
     FROM cases cs LEFT JOIN users u ON u.id = cs.lawyer_id
     WHERE cs.due_date IS NOT NULL AND cs.due_date <= $1
       AND cs.status NOT IN ('TERMINE','ARCHIVE')`,
    [soon],
  );

  const byLawyer = new Map();
  const unassigned = [];
  for (const c of cases) {
    if (c.lawyer_id) {
      if (!byLawyer.has(c.lawyer_id)) byLawyer.set(c.lawyer_id, { email: c.lawyer_email, name: `${c.first_name} ${c.last_name}`, cases: [] });
      byLawyer.get(c.lawyer_id).cases.push(c);
    } else {
      unassigned.push(c);
    }
  }

  const fmtCase = (c) => {
    const overdue = c.due_date < today ? ' (EN RETARD)' : '';
    return `• ${c.case_number} — ${c.title} : échéance le ${c.due_date}${overdue}`;
  };

  for (const [lawyerId, info] of byLawyer) {
    const title = `Échéances à surveiller : ${info.cases.length} dossier(s)`;
    const body = `Bonjour ${info.name},\n\nLes dossiers suivants arrivent à échéance sous 3 jours ou sont en retard :\n\n${info.cases.map(fmtCase).join('\n')}\n\n— Cabinet Élite Juridique`;
    await notify(lawyerId, { type: 'DEADLINE_REMINDER', title, body });
    if (info.email && isMailConfigured()) {
      await sendMail({ to: info.email, subject: `[Cabinet Élite Juridique] ${title}`, text: body });
    }
  }

  if (unassigned.length) {
    const { rows: admins } = await query(
      `SELECT u.id, u.email FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('SUPER_ADMIN','ADMIN') AND u.is_active = 1`,
    );
    const title = `${unassigned.length} dossier(s) sans avocat arrivent à échéance`;
    const body = `Les dossiers suivants (non assignés) arrivent à échéance sous 3 jours ou sont en retard :\n\n${unassigned.map(fmtCase).join('\n')}\n\n— Cabinet Élite Juridique`;
    await notifyMany(admins.map((a) => a.id), { type: 'DEADLINE_REMINDER', title, body });
    for (const a of admins) {
      if (a.email && isMailConfigured()) await sendMail({ to: a.email, subject: `[Cabinet Élite Juridique] ${title}`, text: body });
    }
  }

  // --- Factures en retard ---
  const { rows: invoices } = await query(
    `SELECT inv.invoice_number, inv.due_at, inv.amount_cents + inv.tax_cents AS total,
            cl.first_name, cl.last_name
     FROM invoices inv JOIN clients cl ON cl.id = inv.client_id
     WHERE inv.due_at < $1 AND inv.status IN ('ENVOYEE','EN_RETARD')`,
    [today],
  );
  if (invoices.length) {
    const { rows: accountants } = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'ACCOUNTANT' AND u.is_active = 1`,
    );
    const lines = invoices.map((i) => `• Facture ${i.invoice_number} — ${i.first_name} ${i.last_name} : ${(Number(i.total) / 100).toFixed(2)} $, échéance le ${i.due_at}`);
    for (const acc of accountants) {
      const title = `Factures en retard : ${invoices.length}`;
      const body = `Bonjour ${acc.first_name},\n\nLes factures suivantes sont en retard de paiement :\n\n${lines.join('\n')}\n\n— Cabinet Élite Juridique`;
      await notify(acc.id, { type: 'DEADLINE_REMINDER', title, body });
      if (acc.email && isMailConfigured()) await sendMail({ to: acc.email, subject: `[Cabinet Élite Juridique] ${title}`, text: body });
    }
  }

  console.log(`[deadlines] vérification terminée : ${cases.length} dossier(s), ${invoices.length} facture(s) en retard.`);
}
