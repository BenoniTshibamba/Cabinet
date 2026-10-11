import { HttpError } from '../middleware/auth.js';

// Couche LLM multi-fournisseurs — remplace l'ancien backend Ollama local.
// Toute la configuration passe par variables d'environnement (lues à chaque appel) :
//   LLM_PROVIDER    gemini (défaut) | openai
//   LLM_API_KEY     clé du fournisseur choisi (une seule clé suffit pour tout : chat + embeddings).
//                   Pour gemini, l'ancien nom GEMINI_API_KEY reste accepté en repli.
//   LLM_CHAT_MODEL  optionnel — surcharge du modèle de réponse
//   LLM_EMBED_MODEL optionnel — surcharge du modèle d'embeddings
//
// Obtenir une clé :
//   gemini : https://aistudio.google.com  (gratuit)
//   openai : https://platform.openai.com/api-keys

const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    chatModel: 'gemini-2.5-flash',
    embedModel: 'text-embedding-004',
  },
  openai: {
    label: 'OpenAI',
    chatModel: 'gpt-4o-mini',
    embedModel: 'text-embedding-3-small',
  },
};

function providerName() {
  const p = String(process.env.LLM_PROVIDER || 'gemini').toLowerCase().trim();
  return PROVIDERS[p] ? p : 'gemini';
}

function config() {
  const name = providerName();
  const def = PROVIDERS[name];
  const key = process.env.LLM_API_KEY
    || (name === 'gemini' ? process.env.GEMINI_API_KEY : '')
    || '';
  return {
    provider: name,
    label: def.label,
    key,
    chatModel: process.env.LLM_CHAT_MODEL || def.chatModel,
    embedModel: process.env.LLM_EMBED_MODEL || def.embedModel,
  };
}

export const llmConfig = {
  get provider() { return config().provider; },
  get chatModel() { return config().chatModel; },
  get embeddingModel() { return config().embedModel; },
};

function requireKey(cfg) {
  if (!cfg.key) {
    throw new HttpError(
      503,
      'llm_unavailable',
      `Clé API manquante pour ${cfg.label}. Définissez la variable LLM_API_KEY pour activer l’assistant.`,
    );
  }
  return cfg.key;
}

async function postJSON(url, headers, body, cfg, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || data?.error || `${cfg.label} a répondu avec HTTP ${response.status}.`;
      throw new HttpError(502, 'llm_error', String(message));
    }
    return data;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err?.name === 'AbortError') {
      throw new HttpError(504, 'llm_timeout', `${cfg.label} met trop de temps à répondre. Réessayez dans un instant.`);
    }
    throw new HttpError(503, 'llm_unavailable', `Le service ${cfg.label} est inaccessible. Vérifiez votre connexion puis réessayez.`);
  } finally {
    clearTimeout(timer);
  }
}

// Statut de l'assistant — n'appelle JAMAIS l'API (aucun quota consommé).
export function llmStatus() {
  const cfg = config();
  const available = Boolean(cfg.key);
  return {
    provider: cfg.provider,
    available,
    configured: available,
    chatModel: cfg.chatModel,
    embeddingModel: cfg.embedModel,
  };
}

function emptyResponse(cfg) {
  throw new HttpError(502, 'llm_empty_response', `${cfg.label} n’a pas généré de réponse.`);
}

async function chatGemini(cfg, key, messages, options) {
  const systemParts = [];
  const contents = [];
  for (const m of messages || []) {
    if (m.role === 'system') {
      systemParts.push({ text: String(m.content ?? '') });
    } else {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content ?? '') }],
      });
    }
  }
  const body = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 1800,
    },
  };
  if (systemParts.length) body.systemInstruction = { parts: systemParts };
  const data = await postJSON(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.chatModel)}:generateContent?key=${encodeURIComponent(key)}`,
    {},
    body,
    cfg,
  );
  const parts = data?.candidates?.[0]?.content?.parts;
  const content = Array.isArray(parts) ? parts.map((p) => p.text || '').join('').trim() : '';
  if (!content) emptyResponse(cfg);
  return content;
}

async function chatOpenAI(cfg, key, messages, options) {
  const body = {
    model: cfg.chatModel,
    messages: (messages || []).map((m) => ({ role: m.role, content: String(m.content ?? '') })),
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1800,
  };
  const data = await postJSON('https://api.openai.com/v1/chat/completions', { Authorization: `Bearer ${key}` }, body, cfg);
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) emptyResponse(cfg);
  return content;
}

export async function chat(messages, options = {}) {
  const cfg = config();
  const key = requireKey(cfg);
  if (cfg.provider === 'openai') return chatOpenAI(cfg, key, messages, options);
  return chatGemini(cfg, key, messages, options);
}

async function embedGemini(cfg, key, text) {
  const data = await postJSON(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.embedModel)}:embedContent?key=${encodeURIComponent(key)}`,
    {},
    { content: { parts: [{ text: String(text ?? '') }] } },
    cfg,
  );
  const vector = data?.embedding?.values;
  if (!Array.isArray(vector) || !vector.length) {
    throw new HttpError(502, 'llm_embedding_error', `Le modèle d’embeddings « ${cfg.embedModel} » n’a pas retourné de vecteur.`);
  }
  return vector;
}

async function embedOpenAI(cfg, key, text) {
  const data = await postJSON(
    'https://api.openai.com/v1/embeddings',
    { Authorization: `Bearer ${key}` },
    { model: cfg.embedModel, input: String(text ?? '') },
    cfg,
  );
  const vector = data?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || !vector.length) {
    throw new HttpError(502, 'llm_embedding_error', `Le modèle d’embeddings « ${cfg.embedModel} » n’a pas retourné de vecteur.`);
  }
  return vector;
}

export async function embed(text) {
  const cfg = config();
  const key = requireKey(cfg);
  if (cfg.provider === 'openai') return embedOpenAI(cfg, key, text);
  return embedGemini(cfg, key, text);
}
