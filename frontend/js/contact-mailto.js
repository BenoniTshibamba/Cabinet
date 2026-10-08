/* --- contact-mailto.js ---
 * Construit un lien `mailto:` pré-rempli pour le formulaire de contact.
 * Script classique (fonction globale), chargé avant app.js.
 * Pur (aucune dépendance DOM) — testable unitairement via `new Function`.
 */
function buildContactMailto(contactEmail, fields, lang) {
  const en = lang === 'en';
  const name = (fields.name || '').trim();
  const email = (fields.email || '').trim();
  const phone = (fields.phone || '').trim();
  const message = (fields.message || '').trim();

  const subject = encodeURIComponent(
    en ? `Website message — ${name}` : `Message depuis le site — ${name}`
  );
  const lines = [
    en ? `Name: ${name}` : `Nom : ${name}`,
    en ? `Email: ${email}` : `Courriel : ${email}`,
  ];
  if (phone) lines.push(en ? `Phone: ${phone}` : `Téléphone : ${phone}`);
  lines.push('', message);
  const body = encodeURIComponent(lines.join('\n'));

  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}
