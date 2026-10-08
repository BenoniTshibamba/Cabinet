import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, query } from './pool.js';
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS } from '../utils/permissions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function ensureDatabase() {
  const schema = fs.readFileSync(path.join(HERE, 'schema.sql'), 'utf8');
  pool.exec(schema);
  try { pool.exec('ALTER TABLE documents ADD COLUMN indexed_at TEXT'); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  try { pool.exec('ALTER TABLE posts ADD COLUMN image_filename TEXT'); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  try { pool.exec('ALTER TABLE posts ADD COLUMN image_mime TEXT'); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  // Publications multi-photos : bascule les anciennes images uniques vers post_images.
  try {
    pool.exec(`INSERT INTO post_images (post_id, filename, mime, position)
      SELECT id, image_filename, image_mime, 0 FROM posts
      WHERE image_filename IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM post_images pi WHERE pi.post_id = posts.id)`);
  } catch (err) { if (!String(err?.message).includes('no such table')) throw err; }
  // Blog WYSIWYG : le markdown (content_md) est remplacé par du HTML nettoyé (content_html).
  // Le blog est tout nouveau (aucun article en production) : simple renommage de colonne.
  try { pool.exec('ALTER TABLE blog_posts RENAME COLUMN content_md TO content_html'); } catch (err) { if (!String(err?.message).includes('no such column')) throw err; }
  // Visibilité des sections de la page d'accueil (personnalisation white-label).
  for (const col of ['show_hero', 'show_posts', 'show_features', 'show_testimonials', 'show_contact', 'show_about', 'show_practice_areas']) {
    try { pool.exec(`ALTER TABLE site_settings ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 1`); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  }
  try { pool.exec(`ALTER TABLE site_settings ADD COLUMN about_text TEXT NOT NULL DEFAULT ''`); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  for (const col of ['about_title', 'cta_title', 'cta_text', 'cta_button', 'practice_title', 'testi_title']) {
    try { pool.exec(`ALTER TABLE site_settings ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  }
  try { pool.exec(`ALTER TABLE site_settings ADD COLUMN about_photo_path TEXT`); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  try { pool.exec(`ALTER TABLE site_settings ADD COLUMN hero_images TEXT NOT NULL DEFAULT '[]'`); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  // Photo de profil des utilisateurs.
  try { pool.exec('ALTER TABLE users ADD COLUMN avatar_filename TEXT'); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  // Adresse structurée du cabinet (carte publique sur la page d'accueil).
  // Remplace le champ unique `address` (conservé pour compatibilité).
  // Valeurs par défaut africaines (Kinshasa, RDC) — modifiables dans Personnalisation.
  for (const [col, def] of [
    ['address_street', `''`],
    ['address_city', `'Kinshasa'`],
    ['address_province', `'Kinshasa'`],
    ['address_postal', `''`],
    ['address_country', `'République démocratique du Congo'`],
  ]) {
    try { pool.exec(`ALTER TABLE site_settings ADD COLUMN ${col} TEXT NOT NULL DEFAULT ${def}`); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
  }
  // Bascule les anciennes valeurs canadiennes par défaut vers Kinshasa/RDC
  // (uniquement si l'admin ne les a jamais personnalisées).
  try {
    pool.exec(`UPDATE site_settings SET address_city = 'Kinshasa' WHERE address_city = 'Montréal'`);
    pool.exec(`UPDATE site_settings SET address_province = 'Kinshasa' WHERE address_province = 'Québec'`);
    pool.exec(`UPDATE site_settings SET address_country = 'République démocratique du Congo' WHERE address_country = 'Canada'`);
    pool.exec(`UPDATE site_settings SET contact_email = 'tshibambabenoni@gmail.com' WHERE contact_email = 'contact@cabinet-elite.example'`);
  } catch (err) { /* bases sans ces colonnes — ignoré */ }
  // Reprend l'ancienne adresse personnalisée comme rue (si elle diffère du défaut historique).
  try {
    pool.exec(`UPDATE site_settings SET address_street = address
               WHERE address_street = '' AND TRIM(COALESCE(address, '')) != ''
               AND address != '123, rue du Cabinet, Montréal, Québec'`);
  } catch (err) { /* très vieilles bases sans la colonne address — ignoré */ }
  // Migration messagerie v2 : la table messages gagne conversation_id (NULL pour le 1-à-1),
  // read_at (accusé de lecture 1-à-1), attachment_document_id, et recipient_id devient NULL
  // pour les messages de groupe. SQLite ne permet pas d'altérer une contrainte NOT NULL :
  // on reconstruit la table une seule fois (gardé par la présence de conversation_id).
  {
    const cols = pool.prepare('PRAGMA table_info(messages)').all().map((c) => c.name);
    if (!cols.includes('conversation_id')) {
      pool.exec(`
        CREATE TABLE messages_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          read_at TEXT,
          attachment_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO messages_new (id, sender_id, recipient_id, content, is_read, created_at)
          SELECT id, sender_id, recipient_id, content, is_read, created_at FROM messages;
        DROP TABLE messages;
        ALTER TABLE messages_new RENAME TO messages;
        CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id,recipient_id,created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id,created_at);
      `);
    } else {
      for (const ddl of [
        'ALTER TABLE messages ADD COLUMN conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE',
        'ALTER TABLE messages ADD COLUMN read_at TEXT',
        'ALTER TABLE messages ADD COLUMN attachment_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL',
      ]) {
        try { pool.exec(ddl); } catch (err) { if (!String(err?.message).includes('duplicate column name')) throw err; }
      }
    }
  }
  for (const name of ROLES) await query('INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  for (const code of PERMISSIONS) await query('INSERT INTO permissions (code) VALUES ($1) ON CONFLICT (code) DO NOTHING', [code]);
  const { rows: roleRows } = await query('SELECT id, name FROM roles');
  const { rows: permRows } = await query('SELECT id, code FROM permissions');
  const roleId = Object.fromEntries(roleRows.map(r => [r.name, r.id]));
  const permId = Object.fromEntries(permRows.map(r => [r.code, r.id]));
  await query('DELETE FROM role_permissions');
  for (const [role, codes] of Object.entries(ROLE_PERMISSIONS)) {
    for (const code of codes) await query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roleId[role], permId[code]]);
  }
  // Personnalisation white-label : une seule ligne (id = 1), jamais écrasée si elle existe.
  await query('INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
}

/**
 * Version officielle : garantit qu'il existe toujours un moyen de se connecter.
 * - Si des utilisateurs existent déjà → ne touche à rien (jamais de compte démo imposé).
 * - Sinon (premier démarrage, sans `npm run seed`) → crée le premier administrateur :
 *   identifiants pris de ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD s'ils sont définis,
 *   sinon mot de passe aléatoire affiché UNE FOIS dans la console.
 * En démo locale, `npm run seed` crée déjà les comptes (Demo1234!) avant le premier boot,
 * donc cette fonction ne fait rien dans ce cas.
 */
export async function ensureFirstAdmin() {
  const { rows: existing } = await query('SELECT id FROM users LIMIT 1');
  if (existing[0]) return;

  const { randomBytes } = await import('node:crypto');
  const email = (process.env.ADMIN_EMAIL || 'admin@cabinet-elite.example').toLowerCase();
  const name = (process.env.ADMIN_NAME || 'Admin').trim() || 'Admin';
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(' ') || '';
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = randomBytes(15).toString('hex');
    generated = true;
  }
  const { rows: roleRows } = await query('SELECT id FROM roles WHERE name = $1', ['ADMIN']);
  const hash = await bcrypt.hash(password, 12);
  await query(
    `INSERT INTO users (email,password_hash,first_name,last_name,role_id) VALUES ($1,$2,$3,$4,$5)`,
    [email, hash, firstName, lastName, roleRows[0].id],
  );
  if (generated) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  PREMIER ADMINISTRATEUR CRÉÉ — notez ces identifiants :      ║');
    console.log(`║  Email : ${email.padEnd(52)}║`);
    console.log(`║  Mot de passe : ${password.padEnd(45)}║`);
    console.log('║  Changez ce mot de passe après votre première connexion.     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
  } else {
    console.log(`✓ Premier administrateur créé : ${email} (mot de passe fourni via ADMIN_PASSWORD).`);
  }
}
