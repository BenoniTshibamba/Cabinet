import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import QRCode from 'qrcode';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/pool.js';
import { requireAuth, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { isMailConfigured, sendMail } from '../services/mailer.js';
import { ROLE_PERMISSIONS } from '../utils/permissions.js';
import { passwordSchema } from '../utils/password.js';

const router = Router();

const REFRESH_MS = () => Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30) * 24 * 60 * 60 * 1000;

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
  });
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_MS());
  await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
    userId,
    hashToken(token),
    expiresAt,
  ]);
  return token;
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

/** Émet une session complète (jetons + profil public), comme après un login réussi. */
async function issueSession(user, ip) {
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  await logAudit({ userId: user.id, action: 'LOGIN', resourceType: 'auth', resourceId: user.id, ip });
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      clientId: user.client_id,
      avatarUrl: user.avatar_filename ? `/uploads/avatars/${user.avatar_filename}` : null,
      permissions: ROLE_PERMISSIONS[user.role] ?? [],
    },
  };
}

/** Jeton temporaire courte durée pour les étapes intermédiaires (2FA, OAuth). */
function signTempToken(userId, purpose) {
  return jwt.sign({ sub: userId, purpose }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
}

function verifyTempToken(token, purpose) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    throw new HttpError(401, 'invalid_temp_token', 'Session temporaire invalide ou expirée.');
  }
  if (!payload?.sub || payload.purpose !== purpose) {
    throw new HttpError(401, 'invalid_temp_token', 'Session temporaire invalide ou expirée.');
  }
  return payload.sub;
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { rows } = await query(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = $1`,
      [email.toLowerCase()],
    );
    const user = rows[0];
    // Message volontairement identique pour un email inconnu, un compte désactivé ou un mot de passe erroné.
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, 'invalid_credentials', 'Identifiants invalides.');
    }

    // 2FA activé : le mot de passe seul ne suffit plus, on exige le code TOTP.
    if (user.totp_enabled) {
      return res.json({ twoFactorRequired: true, tempToken: signTempToken(user.id, '2fa') });
    }

    res.json(await issueSession(user, req.ip));
  } catch (err) {
    if (!(err instanceof z.ZodError) && !(err instanceof HttpError)) console.error('AUTH LOGIN ERROR:', err);
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', 'Email ou mot de passe manquant.') : err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) throw new HttpError(400, 'missing_token', 'refreshToken requis.');

    const hash = hashToken(refreshToken);
    const { rows } = await query(
      `SELECT rt.*, u.role_id, r.name AS role FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id JOIN roles r ON r.id = u.role_id
       WHERE rt.token_hash = $1`,
      [hash],
    );
    const stored = rows[0];
    if (!stored || stored.revoked_at || new Date(stored.expires_at) < new Date()) {
      throw new HttpError(401, 'invalid_refresh', 'Session expirée, veuillez vous reconnecter.');
    }

    // Rotation : le jeton utilisé est révoqué, un nouveau est émis.
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [stored.id]);
    const accessToken = signAccessToken({ id: stored.user_id, role: stored.role });
    const newRefreshToken = await issueRefreshToken(stored.user_id);
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (refreshToken) {
      await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [hashToken(refreshToken)]);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  const { permissions, scoped, ...user } = req.user;
  res.json({ ...user, permissions: [...permissions] });
});

const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      throw new HttpError(401, 'invalid_credentials', 'Mot de passe actuel incorrect.');
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, req.user.id]);
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [req.user.id]);
    await logAudit({ userId: req.user.id, action: 'PASSWORD_CHANGED', resourceType: 'auth', resourceId: req.user.id, ip: req.ip });
    res.status(204).end();
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0]?.message ?? 'Mot de passe invalide.') : err);
  }
});

/* ------------------------------------------------------------------ */
/* Mot de passe oublié                                                     */
/* ------------------------------------------------------------------ */

// Limiteur simple en mémoire : 5 demandes / 15 min par IP.
const forgotAttempts = new Map();
function checkForgotRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const arr = (forgotAttempts.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= 5) return false;
  arr.push(now);
  forgotAttempts.set(ip, arr);
  return true;
}

const forgotSchema = z.object({ email: z.string().email() });

router.post('/forgot-password', async (req, res, next) => {
  try {
    if (!checkForgotRateLimit(req.ip)) {
      throw new HttpError(429, 'rate_limited', 'Trop de demandes. Réessayez dans quelques minutes.');
    }
    const { email } = forgotSchema.parse(req.body);
    // Réponse toujours identique : on ne révèle pas si l'email existe.
    const done = () => res.json({ message: 'Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.' });
    const { rows } = await query(
      `SELECT u.id, u.email, u.first_name, u.is_active FROM users u WHERE u.email = $1`,
      [email.toLowerCase()],
    );
    const user = rows[0];
    if (!user || !user.is_active) return done();
    // Sans SMTP configuré, aucun courriel ne peut partir : on ne crée pas de jeton inutile.
    if (!isMailConfigured()) return done();

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL', [user.id]);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(token), expiresAt],
    );
    const base = (process.env.APP_URL ?? '').replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
    const link = `${base}/#/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe — Cabinet Élite Juridique',
      text: `Bonjour ${user.first_name},\n\nCliquez sur le lien ci-dessous pour réinitialiser votre mot de passe (valable 1 heure, usage unique) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce courriel.\n\n— Cabinet Élite Juridique`,
    });
    await logAudit({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', resourceType: 'auth', resourceId: user.id, ip: req.ip });
    return done();
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', 'Adresse email invalide.') : err);
  }
});

const resetSchema = z.object({ token: z.string().min(1), newPassword: passwordSchema });

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = resetSchema.parse(req.body);
    const { rows } = await query(
      `SELECT prt.*, u.is_active FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1 AND prt.used_at IS NULL`,
      [hashToken(token)],
    );
    const rec = rows[0];
    if (!rec || !rec.is_active || new Date(rec.expires_at) < new Date()) {
      throw new HttpError(400, 'invalid_token', 'Lien invalide ou expiré. Refaites une demande de réinitialisation.');
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, rec.user_id]);
    await query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [rec.id]);
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [rec.user_id]);
    await logAudit({ userId: rec.user_id, action: 'PASSWORD_RESET_DONE', resourceType: 'auth', resourceId: rec.user_id, ip: req.ip });
    res.json({ message: 'Mot de passe réinitialisé. Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0]?.message ?? 'Données invalides.') : err);
  }
});

/* ------------------------------------------------------------------ */
/* Authentification à deux facteurs (TOTP, optionnel par utilisateur)      */
/* ------------------------------------------------------------------ */

router.get('/2fa/status', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT totp_enabled FROM users WHERE id = $1', [req.user.id]);
    res.json({ enabled: !!rows[0]?.totp_enabled });
  } catch (err) {
    next(err);
  }
});

// Étape 1 : génère un secret et le QR code à scanner. Le 2FA n'est actif qu'après vérification.
router.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT totp_enabled FROM users WHERE id = $1', [req.user.id]);
    if (rows[0]?.totp_enabled) throw new HttpError(400, 'already_enabled', 'L’authentification à deux facteurs est déjà activée.');
    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer: 'Cabinet Élite Juridique', label: req.user.email, secret });
    await query('UPDATE users SET totp_secret = $1, totp_enabled = 0, updated_at = now() WHERE id = $2', [secret, req.user.id]);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    res.json({ secret, otpauthUrl, qrDataUrl });
  } catch (err) {
    next(err);
  }
});

// Étape 2 : vérifie le code saisi et active définitivement le 2FA.
router.post('/2fa/verify', requireAuth, async (req, res, next) => {
  try {
    const { code } = z.object({ code: z.string().min(1).max(10) }).parse(req.body);
    const { rows } = await query('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]?.totp_secret) throw new HttpError(400, 'no_pending_setup', 'Commencez par générer un secret (étape 1).');
    const { valid } = await verifyTotp({ token: code.replace(/\s/g, ''), secret: rows[0].totp_secret });
    if (!valid) throw new HttpError(401, 'invalid_code', 'Code incorrect. Vérifiez l’heure de votre appareil et réessayez.');
    await query('UPDATE users SET totp_enabled = 1, updated_at = now() WHERE id = $1', [req.user.id]);
    await logAudit({ userId: req.user.id, action: 'TOTP_ENABLED', resourceType: 'auth', resourceId: req.user.id, ip: req.ip });
    res.json({ enabled: true });
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', 'Code requis.') : err);
  }
});

// Désactivation : exige le mot de passe actuel (plus sûr qu'un simple code).
router.post('/2fa/disable', requireAuth, async (req, res, next) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const { rows } = await query('SELECT password_hash, totp_enabled FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(password, rows[0].password_hash))) {
      throw new HttpError(401, 'invalid_credentials', 'Mot de passe incorrect.');
    }
    if (!rows[0]?.totp_enabled) throw new HttpError(400, 'not_enabled', 'L’authentification à deux facteurs n’est pas activée.');
    await query('UPDATE users SET totp_secret = NULL, totp_enabled = 0, updated_at = now() WHERE id = $1', [req.user.id]);
    await logAudit({ userId: req.user.id, action: 'TOTP_DISABLED', resourceType: 'auth', resourceId: req.user.id, ip: req.ip });
    res.json({ enabled: false });
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', 'Mot de passe requis.') : err);
  }
});

// Seconde étape du login quand le 2FA est actif.
router.post('/2fa/login', async (req, res, next) => {
  try {
    const { tempToken, code } = z.object({ tempToken: z.string().min(1), code: z.string().min(1).max(10) }).parse(req.body);
    const userId = verifyTempToken(tempToken, '2fa');
    const { rows } = await query(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userId],
    );
    const user = rows[0];
    if (!user || !user.is_active) throw new HttpError(401, 'invalid_credentials', 'Identifiants invalides.');
    if (!user.totp_enabled || !user.totp_secret) throw new HttpError(400, 'not_enabled', 'L’authentification à deux facteurs n’est pas activée.');
    const { valid } = await verifyTotp({ token: code.replace(/\s/g, ''), secret: user.totp_secret });
    if (!valid) throw new HttpError(401, 'invalid_code', 'Code incorrect.');
    res.json(await issueSession(user, req.ip));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', 'Données invalides.') : err);
  }
});

/* ------------------------------------------------------------------ */
/* Connexion avec Google (OAuth 2.0) — réservée aux comptes existants     */
/* ------------------------------------------------------------------ */

const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? 'https://cabinet-elite-juridique.onrender.com/api/auth/oauth/google/callback';

function googleClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

// Le frontend interroge ce endpoint public pour afficher ou masquer le bouton Google.
router.get('/oauth/google/status', (req, res) => {
  res.json({ enabled: !!googleClient() });
});

router.get('/oauth/google', (req, res, next) => {
  try {
    const client = googleClient();
    if (!client) throw new HttpError(404, 'oauth_not_configured', 'La connexion avec Google n’est pas configurée.');
    const url = client.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: ['openid', 'email', 'profile'],
    });
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

function oauthErrorPage(message) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connexion Google — Cabinet Élite Juridique</title></head><body style="font-family:Georgia,serif;max-width:560px;margin:8vh auto;padding:0 1.5rem;color:#1a1a1a"><h1>⚖ Cabinet Élite Juridique</h1><p>${message}</p><p><a href="/#/login">Retour à la page de connexion</a></p></body></html>`;
}

router.get('/oauth/google/callback', async (req, res, next) => {
  try {
    const client = googleClient();
    if (!client) throw new HttpError(404, 'oauth_not_configured', 'La connexion avec Google n’est pas configurée.');
    const { code } = req.query;
    if (!code || typeof code !== 'string') throw new HttpError(400, 'missing_code', 'Code d’autorisation manquant.');
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new HttpError(401, 'invalid_token', 'Jeton Google invalide.');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      return res.status(403).send(oauthErrorPage('Votre adresse Google n’a pas pu être vérifiée.'));
    }
    const { rows } = await query(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = $1`,
      [payload.email.toLowerCase()],
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(403).send(oauthErrorPage('Aucun compte actif ne correspond à cette adresse Google. Demandez l’accès à l’administrateur du cabinet.'));
    }
    // 2FA actif : on passe par l’étape du code, comme après un mot de passe.
    if (user.totp_enabled) {
      return res.redirect(`/#/login?twofa=${encodeURIComponent(signTempToken(user.id, '2fa'))}`);
    }
    // Jeton à usage quasi-unique (5 min) que le frontend échange contre une session.
    const exchange = jwt.sign({ sub: user.id, purpose: 'oauth', jti: crypto.randomUUID() }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
    await logAudit({ userId: user.id, action: 'LOGIN_GOOGLE', resourceType: 'auth', resourceId: user.id, ip: req.ip });
    res.redirect(`/#/oauth/callback?code=${encodeURIComponent(exchange)}`);
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    console.error('GOOGLE OAUTH ERROR:', err.message);
    next(new HttpError(401, 'oauth_failed', 'La connexion avec Google a échoué. Réessayez.'));
  }
});

router.post('/oauth/google/complete', async (req, res, next) => {
  try {
    const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
    const userId = verifyTempToken(code, 'oauth');
    const { rows } = await query(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userId],
    );
    const user = rows[0];
    if (!user || !user.is_active) throw new HttpError(401, 'invalid_credentials', 'Identifiants invalides.');
    res.json(await issueSession(user, req.ip));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', 'Données invalides.') : err);
  }
});

export default router;
