/**
 * Service d'envoi de courriels (notifications d'échéances).
 *
 * Configuration via variables d'environnement :
 *   SMTP_HOST, SMTP_PORT (défaut 587), SMTP_USER, SMTP_PASS, MAIL_FROM
 *
 * Si nodemailer n'est pas installé ou si SMTP_HOST n'est pas configuré,
 * le service est silencieusement désactivé : l'application fonctionne
 * normalement, seuls les courriels ne partent pas.
 */

let nodemailer = null;
try {
  nodemailer = (await import('nodemailer')).default;
} catch {
  nodemailer = null;
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!nodemailer || !process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
  });
  return transporter;
}

/** Vrai quand l'envoi de courriels est configuré et disponible. */
export function isMailConfigured() {
  return getTransporter() !== null;
}

/**
 * Envoie un courriel. Ne rejette jamais : en cas de panne (non configuré,
 * SMTP injoignable), loggue et renvoie false.
 */
export async function sendMail({ to, subject, text }) {
  const tx = getTransporter();
  if (!tx || !to) return false;
  try {
    await tx.sendMail({ from: process.env.MAIL_FROM ?? 'Cabinet Élite Juridique <no-reply@cabinet-elite.example>', to, subject, text });
    return true;
  } catch (err) {
    console.error('Échec d’envoi du courriel:', err.message);
    return false;
  }
}
