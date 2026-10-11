/**
 * Corbeille 24h — suppression douce des clients et dossiers.
 *
 * - DELETE /clients/:id et DELETE /cases/:id mettent en corbeille (deleted_at),
 *   sauf ?permanent=1 qui supprime définitivement tout de suite.
 * - Les éléments en corbeille sont restaurables 24h via POST /:id/restore.
 * - purgeTrash() supprime DÉFINITIVEMENT les éléments en corbeille depuis plus
 *   de 24h. Lancée au démarrage (décalée) puis toutes les heures.
 *
 * Sécurité : un client avec des factures n'est JAMAIS purgé automatiquement
 * (données financières conservées) ; il reste en corbeille jusqu'à action manuelle.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { query } from '../db/pool.js';
import { logAudit } from './audit.js';

const RETENTION_SQL = `deleted_at IS NOT NULL AND deleted_at < datetime('now', '-24 hours')`;

function unlinkQuiet(path) {
  try {
    if (path && existsSync(path)) unlinkSync(path);
  } catch {
    /* noop */
  }
}

/** Suppression définitive d'un dossier : factures dissociées, fichiers effacés. */
export async function hardDeleteCase(id, { userId = null, ip = null, auditAction = 'CASE_PURGED' } = {}) {
  // Les factures restent (données financières) mais sont dissociées du dossier.
  await query('UPDATE invoices SET case_id = NULL WHERE case_id = $1', [id]);
  const { rows: docs } = await query('SELECT storage_path FROM documents WHERE case_id = $1', [id]);
  const { rows } = await query('DELETE FROM cases WHERE id = $1 RETURNING *', [id]);
  for (const d of docs) unlinkQuiet(d.storage_path);
  if (rows[0] && userId) {
    await logAudit({ userId, action: auditAction, resourceType: 'case', resourceId: id, oldValues: { id, title: rows[0].title }, ip }).catch(() => {});
  }
  return rows[0] ?? null;
}

/** Suppression définitive d'un client. Retourne null si impossible (dossiers/factures liés). */
export async function hardDeleteClient(id, { userId = null, ip = null, auditAction = 'CLIENT_PURGED' } = {}) {
  const { rows } = await query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);
  if (rows[0] && userId) {
    await logAudit({ userId, action: auditAction, resourceType: 'client', resourceId: id, oldValues: { id }, ip }).catch(() => {});
  }
  return rows[0] ?? null;
}

/**
 * Purge automatique : supprime définitivement les clients/dossiers en corbeille
 * depuis plus de 24h. Les clients avec des factures sont conservés (jamais de
 * destruction automatique de données financières).
 */
export async function purgeTrash() {
  const purged = { cases: 0, clients: 0, skippedClients: 0 };
  const { rows: oldCases } = await query(`SELECT id FROM cases WHERE ${RETENTION_SQL}`);
  for (const c of oldCases) {
    try {
      await hardDeleteCase(c.id);
      purged.cases += 1;
    } catch (err) {
      console.error(`[corbeille] purge dossier ${c.id} impossible :`, err.message);
    }
  }
  const { rows: oldClients } = await query(`SELECT id FROM clients WHERE ${RETENTION_SQL}`);
  for (const c of oldClients) {
    try {
      // Données financières : on ne purge jamais un client qui a des factures.
      const { rows: inv } = await query('SELECT COUNT(*) AS n FROM invoices WHERE client_id = $1', [c.id]);
      if (Number(inv[0]?.n ?? 0) > 0) {
        purged.skippedClients += 1;
        continue;
      }
      await hardDeleteClient(c.id);
      purged.clients += 1;
    } catch (err) {
      // Contrainte FK (ex. dossiers en corbeille pas encore purgés) : on réessaiera.
      console.error(`[corbeille] purge client ${c.id} impossible :`, err.message);
    }
  }
  if (purged.cases || purged.clients) {
    console.log(`[corbeille] purge 24h : ${purged.cases} dossier(s), ${purged.clients} client(s) supprimés définitivement.`);
  }
  return purged;
}

/** Démarre la purge périodique (appelée une fois au démarrage du serveur). */
export function startTrashPurge() {
  const HOUR_MS = 3600 * 1000;
  setTimeout(() => purgeTrash().catch((err) => console.error('[corbeille]', err.message)), 5 * 60 * 1000);
  setInterval(() => purgeTrash().catch((err) => console.error('[corbeille]', err.message)), HOUR_MS);
}
