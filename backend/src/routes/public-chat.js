import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/auth.js';
import { chat, llmStatus } from '../services/llm.js';
import {
  createConversation, getOwnedConversation, getMessages,
  getContextMessages, addMessage, titleFromQuestion,
} from '../services/ai-conversations.js';

const router = Router();

/* Anti-abus : 10 questions max par minute et par IP (aucune authentification). */
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map(); // ip -> [timestamps]

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

/* La relecture de l'historique a son propre compteur (plus généreux) : elle
 * ne doit pas manger le budget de questions du visiteur. */
const historyHits = new Map();
function rateLimitedHistory(ip) {
  const now = Date.now();
  const list = (historyHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= 30) return true;
  list.push(now);
  historyHits.set(ip, list);
  return false;
}

const chatSchema = z.object({
  question: z.string().trim().min(2).max(1000),
  lang: z.enum(['fr', 'en']).optional().default('fr'),
  // Fil persistant du visiteur (v6.5) : jeton anonyme généré par son navigateur
  // + identifiant de SA conversation. Sans visitorId, le chat reste sans état.
  visitorId: z.string().trim().min(8).max(80).optional(),
  conversationId: z.coerce.number().int().positive().optional(),
});

/* Cache questions/réponses : les questions identiques (ex. visiteurs qui posent
 * les mêmes questions d'accueil) reçoivent une réponse immédiate au lieu d'un
 * nouvel aller-retour vers le LLM. TTL 1 h, 100 entrées max (FIFO). */
const ANSWER_TTL_MS = 60 * 60 * 1000;
const ANSWER_CACHE_MAX = 100;
const answerCache = new Map(); // clé -> { answer, ts }
const cacheKey = (lang, q) => `${lang}:${q.toLowerCase().replace(/\s+/g, ' ').trim()}`;
function cacheGet(lang, q) {
  const e = answerCache.get(cacheKey(lang, q));
  if (!e) return null;
  if (Date.now() - e.ts > ANSWER_TTL_MS) { answerCache.delete(cacheKey(lang, q)); return null; }
  return e.answer;
}
function cacheSet(lang, q, answer) {
  if (answerCache.size >= ANSWER_CACHE_MAX) {
    const first = answerCache.keys().next().value;
    if (first !== undefined) answerCache.delete(first);
  }
  answerCache.set(cacheKey(lang, q), { answer, ts: Date.now() });
}

const UNAVAILABLE = {
  fr: 'Bonjour ! Notre assistant est momentanément indisponible. N’hésitez pas à nous écrire via la page Contact et nous vous répondrons avec plaisir.',
  en: 'Hello! Our assistant is temporarily unavailable. Feel free to write to us via the Contact page and we’ll be happy to get back to you.',
};

const ERROR_MSG = {
  fr: 'Oups, une petite erreur est survenue. Pouvez-vous reformuler votre question ?',
  en: 'Oops, a small error occurred. Could you please rephrase your question?',
};

function systemPrompt(lang) {
  return lang === 'en'
    ? `You are the warm and friendly virtual assistant of Cabinet Élite Juridique, a law firm based in Kinshasa, Democratic Republic of Congo.

Tone: welcoming, friendly, helpful, professional. Greet visitors warmly. Answer in English.

You may talk about:
- the firm in general (a modern law firm helping individuals and businesses),
- its practice areas: business law, tax law, mining law, commercial law, corporate law, labour law, debt recovery, real-estate law,
- how to request access to the client portal or book a consultation (via the Contact page or by requesting access; an administrator reviews each request),
- general legal information (never specific advice).

Strict rules:
- NEVER invent facts, names, dates, amounts or articles of law.
- NEVER give a definitive legal conclusion or personalized legal advice: always invite the visitor to contact the firm for their specific situation.
- You have NO access to any internal data: no cases, no clients, no documents, no invoices. If asked about any of that, politely explain you cannot access internal files and redirect to the Contact page.
- NEVER cite documents, files, PDFs or "sources": you have access to none, so any citation would be invented.
- Keep answers concise (a few sentences), friendly, and in English.`
    : `Tu es l’assistant virtuel chaleureux et accueillant du Cabinet Élite Juridique, un cabinet d’avocats basé à Kinshasa, en République démocratique du Congo.

Ton : accueillant, amical, serviable, professionnel. Accueille les visiteurs avec chaleur. Réponds en français.

Tu peux parler :
- du cabinet en général (un cabinet moderne qui accompagne particuliers et entreprises),
- de ses domaines d’intervention : droit des affaires, droit fiscal, droit minier, droit commercial, droit des sociétés, droit du travail, recouvrement de créances, droit immobilier,
- de la façon de demander l’accès au portail client ou de réserver une consultation (via la page Contact ou en faisant une demande d’accès ; un administrateur examine chaque demande),
- d’informations juridiques générales (jamais de conseil personnalisé).

Règles strictes :
- N’invente AUCUN fait, nom, date, montant ou article de loi.
- Ne donne JAMAIS de conclusion juridique définitive ni de conseil juridique personnalisé : invite toujours le visiteur à contacter le cabinet pour sa situation particulière.
- Tu n’as AUCUN accès aux données internes : ni dossiers, ni clients, ni documents, ni factures. Si on t’interroge là-dessus, explique poliment que tu ne peux pas accéder aux dossiers internes et redirige vers la page Contact.
- Ne cite JAMAIS de documents, fichiers, PDF ou « sources » : tu n’y as pas accès, toute citation serait inventée.
- Réponses concises (quelques phrases), amicales, en français.`;
}

/**
 * POST /api/public/chat — assistant public, sans authentification.
 * Ne lit JAMAIS les données internes du cabinet (dossiers, clients, documents).
 * Seule écriture : le fil de conversation du visiteur lui-même (ai_conversations
 * / ai_messages, kind 'public'), pour que SON historique survive aux visites.
 */
router.post('/', async (req, res, next) => {
  try {
    if (rateLimited(req.ip)) {
      throw new HttpError(429, 'too_many_requests', 'Trop de questions envoyées. Veuillez réessayer dans une minute.');
    }
    const b = chatSchema.parse(req.body);
    if (!llmStatus().available) {
      return res.json({ answer: UNAVAILABLE[b.lang] });
    }

    // Fil du visiteur : reprise (propriété vérifiée par visitorId) ou création.
    let conv = null;
    if (b.visitorId) {
      if (b.conversationId) {
        conv = await getOwnedConversation(b.conversationId, { visitorId: b.visitorId });
      }
      if (!conv) conv = await createConversation({ visitorId: b.visitorId, kind: 'public' });
    }
    const history = conv ? await getContextMessages(conv.id) : [];

    const savePair = async (answer) => {
      if (!conv) return;
      await addMessage(conv.id, 'user', b.question);
      await titleFromQuestion(conv.id, b.question);
      await addMessage(conv.id, 'assistant', answer);
    };
    const withConv = (payload) => (conv ? { ...payload, conversationId: conv.id } : payload);

    const cached = cacheGet(b.lang, b.question);
    if (cached) {
      await savePair(cached);
      return res.json(withConv({ answer: cached }));
    }
    let answer;
    try {
      answer = await chat(
        [
          { role: 'system', content: systemPrompt(b.lang) },
          ...history,
          { role: 'user', content: b.question },
        ],
        { maxTokens: 400, temperature: 0.7 },
      );
      cacheSet(b.lang, b.question, answer);
    } catch {
      return res.json(withConv({ answer: ERROR_MSG[b.lang] }));
    }
    await savePair(answer);
    res.json(withConv({ answer }));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

/**
 * GET /api/public/chat/history?visitorId=…&conversationId=…
 * Le visiteur relit SON fil (vérifié par visitorId) — jamais celui d'un autre.
 */
router.get('/history', async (req, res, next) => {
  try {
    if (rateLimitedHistory(req.ip)) {
      throw new HttpError(429, 'too_many_requests', 'Trop de demandes. Veuillez réessayer dans une minute.');
    }
    const q = z.object({
      visitorId: z.string().trim().min(8).max(80),
      conversationId: z.coerce.number().int().positive(),
    }).parse(req.query);
    const conv = await getOwnedConversation(q.conversationId, { visitorId: q.visitorId });
    if (!conv) throw new HttpError(404, 'not_found', 'Conversation introuvable.');
    res.json({ conversationId: conv.id, messages: await getMessages(conv.id) });
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

export default router;
