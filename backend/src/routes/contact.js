import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { sendMail, isMailConfigured } from '../services/mailer.js';
import { notifyMany } from '../services/notify.js';

const router = Router();

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().min(1).max(5000),
});

/* Anti-abus simple : 5 messages max par tranche de 10 minutes et par IP. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // ip -> [timestamps]

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

const toMessage = (m) => ({
  id: m.id,
  name: m.name,
  email: m.email,
  phone: m.phone ?? null,
  message: m.message,
  isRead: Boolean(m.is_read),
  createdAt: m.created_at,
});

/**
 * Formulaire de contact public.
 * Le message est TOUJOURS conservé en base + notifié aux administrateurs
 * (rien n'est perdu sans SMTP) ; un courriel est en plus envoyé à
 * l'adresse de contact du cabinet (modifiable dans Personnalisation)
 * quand la messagerie est configurée.
 */
router.post('/', async (req, res, next) => {
  try {
    if (rateLimited(req.ip)) {
      throw new HttpError(429, 'too_many_requests', 'Trop de messages envoyés. Veuillez réessayer dans quelques minutes.');
    }
    const b = contactSchema.parse(req.body);

    const { rows } = await query(
      'INSERT INTO contact_messages (name, email, phone, message) VALUES ($1,$2,$3,$4) RETURNING *',
      [b.name, b.email, b.phone || null, b.message],
    );
    const saved = rows[0];

    // Notification in-app pour tous les administrateurs actifs.
    const { rows: admins } = await query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('SUPER_ADMIN','ADMIN') AND u.is_active = 1`,
    );
    if (admins.length) {
      await notifyMany(admins.map((a) => a.id), {
        type: 'CONTACT_MESSAGE',
        title: `Nouveau message de contact : ${b.name}`,
        body: b.message.slice(0, 200),
      });
    }

    // Courriel au cabinet si la messagerie est configurée (best effort).
    let emailed = false;
    if (isMailConfigured()) {
      const { rows: settings } = await query('SELECT contact_email, firm_name FROM site_settings WHERE id = 1');
      const to = settings[0]?.contact_email;
      if (to) {
        emailed = await sendMail({
          to,
          subject: `Contact site web — ${b.name} (${settings[0]?.firm_name || 'cabinet'})`,
          text: `Nom : ${b.name}\nCourriel : ${b.email}\nTéléphone : ${b.phone || '—'}\n\nMessage :\n${b.message}`,
        });
      }
    }

    res.status(201).json({ received: true, id: saved.id, emailed });
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

/** Liste des messages reçus (admin). */
router.get('/', requireAuth, requirePermission('contact.read'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200');
    res.json(rows.map(toMessage));
  } catch (e) { next(e); }
});

/** Marquer un message comme lu / non lu (admin). */
router.patch('/:id', requireAuth, requirePermission('contact.read'), async (req, res, next) => {
  try {
    const { isRead } = z.object({ isRead: z.boolean() }).parse(req.body);
    const { rows } = await query(
      'UPDATE contact_messages SET is_read = $1 WHERE id = $2 RETURNING *',
      [isRead ? 1 : 0, req.params.id],
    );
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Message introuvable.');
    res.json(toMessage(rows[0]));
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});

export default router;
