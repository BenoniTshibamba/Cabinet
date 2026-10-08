import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

/**
 * Crée backend/.env automatiquement s'il n'existe pas, à partir de
 * .env.example, en générant des secrets JWT aléatoires.
 * L'utilisateur n'a plus rien à configurer à la main pour démarrer :
 * `npm install && npm start` suffit (le seed reste nécessaire pour les comptes démo).
 * Ne touche JAMAIS à un .env existant.
 *
 * @param {string} [dir=process.cwd()] répertoire contenant .env / .env.example
 * @returns {'created'|'exists'|'no-example'} ce qui s'est passé
 */
export function ensureEnvFile(dir = process.cwd()) {
  const envPath = join(dir, '.env');
  if (existsSync(envPath)) return 'exists';

  const examplePath = join(dir, '.env.example');
  if (!existsSync(examplePath)) return 'no-example';

  const secret = () => randomBytes(32).toString('hex');
  const content = readFileSync(examplePath, 'utf8')
    .split('\n')
    .map((line) => {
      if (/^JWT_ACCESS_SECRET=/.test(line)) return `JWT_ACCESS_SECRET=${secret()}`;
      if (/^JWT_REFRESH_SECRET=/.test(line)) return `JWT_REFRESH_SECRET=${secret()}`;
      return line;
    })
    .join('\n');

  mkdirSync(dir, { recursive: true });
  writeFileSync(envPath, content, { mode: 0o600 });
  return 'created';
}
