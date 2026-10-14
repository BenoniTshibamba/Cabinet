import { query } from '../db/pool.js';

// Conversations persistantes de l'assistant IA (v6.5).
// - kind 'staff'  : la conversation appartient à un utilisateur connecté (user_id).
// - kind 'public' : la conversation appartient à un visiteur anonyme (visitor_id,
//                   jeton aléatoire conservé par son navigateur).
// Chaque accès vérifie la propriété : impossible de lire le fil d'un autre.

const ownerClause = ({ userId, visitorId }) =>
  userId != null ? { sql: 'user_id=$1', params: [userId] } : { sql: 'visitor_id=$1', params: [visitorId] };

export async function createConversation({ userId = null, visitorId = null, kind, title = null }) {
  const { rows } = await query(
    'INSERT INTO ai_conversations (user_id, visitor_id, kind, title) VALUES ($1,$2,$3,$4) RETURNING *',
    [userId, visitorId, kind, title],
  );
  return rows[0];
}

export async function getOwnedConversation(id, owner) {
  const { sql, params } = ownerClause(owner);
  const { rows } = await query(
    `SELECT * FROM ai_conversations WHERE id=$${params.length + 1} AND ${sql}`,
    [...params, id],
  );
  return rows[0] ?? null;
}

export async function listConversations(owner, kind, limit = 30) {
  const { sql, params } = ownerClause(owner);
  const { rows } = await query(
    `SELECT c.id, c.kind, c.title, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id=c.id) AS message_count
     FROM ai_conversations c
     WHERE ${sql} AND c.kind=$${params.length + 1}
     ORDER BY c.updated_at DESC, c.id DESC
     LIMIT ${Number(limit) || 30}`,
    [...params, kind],
  );
  return rows;
}

export async function getMessages(conversationId, limit = 200) {
  const { rows } = await query(
    'SELECT id, role, text, created_at FROM ai_messages WHERE conversation_id=$1 ORDER BY id ASC LIMIT $2',
    [conversationId, limit],
  );
  return rows;
}

// Derniers échanges au format LLM ([{role, content}]) pour donner du contexte
// au modèle : le fil reste fluide, les suivis (« et pour l'autre dossier ? »)
// sont compris. On exclut les messages d'erreur transitoires (jamais stockés).
export async function getContextMessages(conversationId, maxMessages = 12) {
  const { rows } = await query(
    'SELECT role, text FROM ai_messages WHERE conversation_id=$1 ORDER BY id DESC LIMIT $2',
    [conversationId, maxMessages],
  );
  return rows.reverse().map((m) => ({ role: m.role, content: m.text }));
}

export async function addMessage(conversationId, role, text) {
  const { rows } = await query(
    'INSERT INTO ai_messages (conversation_id, role, text) VALUES ($1,$2,$3) RETURNING *',
    [conversationId, role, text],
  );
  await query('UPDATE ai_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=$1', [conversationId]);
  return rows[0];
}

// Titre automatique = début de la première question posée.
export async function titleFromQuestion(conversationId, question) {
  const title = String(question ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (title) await query('UPDATE ai_conversations SET title=$1 WHERE id=$2 AND title IS NULL', [title, conversationId]);
  return title;
}

export async function deleteConversation(id, owner) {
  const { sql, params } = ownerClause(owner);
  const conv = await getOwnedConversation(id, owner);
  if (!conv) return false;
  await query(`DELETE FROM ai_conversations WHERE id=$${params.length + 1} AND ${sql}`, [...params, id]);
  return true;
}
