import dotenv from 'dotenv';
import { ensureEnvFile } from './utils/ensure-env.js';

// Zéro config manuelle : si backend/.env n'existe pas, on le crée depuis
// .env.example avec des secrets JWT aléatoires, avant même de charger dotenv.
if (ensureEnvFile() === 'created') {
  console.log('✓ Fichier .env créé automatiquement (secrets JWT générés).');
}
dotenv.config();

// Échec rapide au démarrage : sans secrets JWT valides, /api/auth/login répondrait
// 500 « Erreur interne du serveur » à chaque tentative de connexion — incompréhensible
// pour l'utilisateur. On refuse de démarrer avec un message clair à la place.
function requireEnvSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 16) {
    console.error(`\nERREUR DE CONFIGURATION — la variable ${name} est manquante ou trop courte (< 16 caractères).`);
    console.error('Sans secrets JWT valides, la connexion échoue avec « Erreur interne du serveur ».');
    console.error('Pour corriger :');
    console.error('  1. Copiez backend/.env.example vers backend/.env');
    console.error(`  2. Renseignez ${name} avec une chaîne aléatoire d'au moins 16 caractères.`);
    console.error('  3. Relancez avec : npm start\n');
    process.exit(1);
  }
}
requireEnvSecret('JWT_ACCESS_SECRET');
requireEnvSecret('JWT_REFRESH_SECRET');

import { createApp } from './app.js';
import { ensureDatabase, ensureFirstAdmin } from './db/bootstrap.js';
import { runDeadlineCheck } from './services/deadlines.js';

const port = Number(process.env.PORT) || 4000;

try {
  await ensureDatabase();
  await ensureFirstAdmin();
} catch (err) {
  console.error('ERREUR INITIALISATION BASE SQLITE:', err);
  process.exit(1);
}

const app = createApp();
const server = app.listen(port, () => {
  console.log(`Cabinet Élite Juridique — API sur http://localhost:${port}`);
  console.log(`API: http://localhost:${port}/api`);
});

// Vérification quotidienne des échéances (dossiers + factures) : courriel
// si SMTP configuré (voir README), notification in-app dans tous les cas.
// Une première vérification a lieu peu après le démarrage.
const DAY_MS = 24 * 3600 * 1000;
setTimeout(() => runDeadlineCheck().catch((err) => console.error('[deadlines]', err.message)), 60 * 1000);
setInterval(() => runDeadlineCheck().catch((err) => console.error('[deadlines]', err.message)), DAY_MS);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
