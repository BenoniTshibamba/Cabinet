import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { HttpError, requireAuth, requirePermission } from '../middleware/auth.js';
import { notifyMany } from '../services/notify.js';
import { logAudit } from '../services/audit.js';
import { sendMail, isMailConfigured } from '../services/mailer.js';
import { ROLES } from '../utils/permissions.js';

const router=Router();
const STAFF_ROLES = ROLES.filter((r) => r !== 'CLIENT');
const requestSchema=z.object({email:z.string().email(),firstName:z.string().min(1).max(100),lastName:z.string().min(1).max(100),message:z.string().max(2000).optional()});
router.post('/',async(req,res,next)=>{try{const b=requestSchema.parse(req.body);const {rows:existing}=await query('SELECT id FROM users WHERE email=$1 UNION ALL SELECT id FROM registration_requests WHERE email=$1 AND status=\'PENDING\' LIMIT 1',[b.email.toLowerCase()]);if(existing[0])throw new HttpError(409,'registration_exists','Une demande ou un compte existe déjà pour cette adresse.');const {rows}=await query('INSERT INTO registration_requests(email,first_name,last_name,message) VALUES($1,$2,$3,$4) RETURNING id,created_at',[b.email.toLowerCase(),b.firstName,b.lastName,b.message||null]);
// Notification in-app pour tous les administrateurs actifs (sinon la demande passe inaperçue).
const { rows: admins } = await query(
  `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
   WHERE r.name IN ('SUPER_ADMIN','ADMIN') AND u.is_active = 1`,
);
if (admins.length) {
  await notifyMany(admins.map((a) => a.id), {
    type: 'REGISTRATION_REQUEST',
    title: `Nouvelle demande d'accès : ${b.firstName} ${b.lastName}`,
    body: b.email,
  });
}
res.status(201).json({id:rows[0].id,message:'Votre demande a été envoyée. Un administrateur doit l’approuver avant l’accès.'});}catch(e){next(e instanceof z.ZodError?new HttpError(400,'invalid_body',e.issues[0].message):e)}});
router.get('/',requireAuth,requirePermission('users.read'),async(req,res,next)=>{try{const {rows}=await query('SELECT * FROM registration_requests ORDER BY created_at DESC');res.json(rows);}catch(e){next(e)}});

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  role: z.enum(STAFF_ROLES).optional(),
});

/** Mot de passe temporaire lisible, conforme à la politique (10+ caractères, lettre + chiffre). */
function tempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 12; i++) pwd += alphabet[crypto.randomInt(alphabet.length)];
  if (!/\d/.test(pwd)) pwd = pwd.slice(0, 11) + crypto.randomInt(10);
  return pwd;
}

/* Examen d'une demande d'accès par un administrateur : approbation (crée le compte)
   ou rejet. Seules les demandes PENDING peuvent être traitées. */
router.patch('/:id', requireAuth, requirePermission('users.read'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'invalid_id', 'Identifiant invalide.');
    const body = reviewSchema.parse(req.body);
    const { rows } = await query('SELECT * FROM registration_requests WHERE id = $1', [id]);
    const r = rows[0];
    if (!r) throw new HttpError(404, 'not_found', 'Demande introuvable.');
    if (r.status !== 'PENDING') throw new HttpError(409, 'already_reviewed', 'Cette demande a déjà été traitée.');

    if (body.status === 'REJECTED') {
      await query(`UPDATE registration_requests SET status = 'REJECTED' WHERE id = $1`, [id]);
      await logAudit({ userId: req.user.id, action: 'REGISTRATION_REJECTED', resourceType: 'registration_request', resourceId: id, ip: req.ip });
      // Courriel de refus poli (best effort, jamais bloquant).
      let emailed = false;
      if (isMailConfigured()) {
        emailed = await sendMail({
          to: r.email,
          subject: 'Votre demande d\u2019accès — Cabinet Élite Juridique',
          text: `Bonjour ${r.first_name},\n\nNous avons bien examiné votre demande d'accès au Cabinet Élite Juridique. Malheureusement, nous ne pouvons pas y donner suite pour le moment.\n\nSi vous pensez qu'il s'agit d'une erreur, n'hésitez pas à nous contacter.\n\n— Cabinet Élite Juridique`,
        });
      }
      return res.json({ id, status: 'REJECTED', emailed });
    }

    // APPROVED — créer le compte utilisateur avec un mot de passe temporaire.
    const role = body.role ?? 'LAWYER';
    const { rows: roleRows } = await query('SELECT id FROM roles WHERE name = $1', [role]);
    if (!roleRows[0]) throw new HttpError(400, 'invalid_role', 'Rôle invalide.');
    const { rows: taken } = await query('SELECT id FROM users WHERE email = $1', [r.email]);
    if (taken[0]) throw new HttpError(409, 'email_taken', 'Un compte existe déjà pour cette adresse.');
    const password = tempPassword();
    const hash = await bcrypt.hash(password, 12);
    const { rows: created } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, created_at`,
      [r.email, hash, r.first_name, r.last_name, roleRows[0].id],
    );
    await query(`UPDATE registration_requests SET status = 'APPROVED' WHERE id = $1`, [id]);
    await logAudit({ userId: req.user.id, action: 'REGISTRATION_APPROVED', resourceType: 'registration_request', resourceId: id, newValues: { userId: created[0].id, role }, ip: req.ip });
    // Courriel de bienvenue avec le mot de passe temporaire (best effort, jamais bloquant).
    let emailed = false;
    if (isMailConfigured()) {
      emailed = await sendMail({
        to: r.email,
        subject: 'Votre accès — Cabinet Élite Juridique',
        text: `Bonjour ${r.first_name},\n\nVotre demande d'accès a été approuvée. Voici vos identifiants :\n\nCourriel : ${r.email}\nMot de passe temporaire : ${password}\n\nConnectez-vous puis changez votre mot de passe dès que possible.\n\n— Cabinet Élite Juridique`,
      });
    }
    res.status(201).json({
      id,
      status: 'APPROVED',
      emailed,
      // Mot de passe temporaire transmis à l'admin pour le cas où le courriel
      // n'a pas pu partir (affiché une seule fois dans l'interface).
      tempPassword: password,
      user: { id: created[0].id, email: created[0].email, firstName: created[0].first_name, lastName: created[0].last_name, role },
    });
  } catch (e) { next(e instanceof z.ZodError ? new HttpError(400, 'invalid_body', e.issues[0].message) : e); }
});
export default router;
