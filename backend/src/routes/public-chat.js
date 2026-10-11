import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/auth.js';
import { chat, llmStatus } from '../services/llm.js';

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

const chatSchema = z.object({
  question: z.string().trim().min(2).max(1000),
  lang: z.enum(['fr', 'en']).optional().default('fr'),
});

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
    ? `You are the warm and friendly virtual assistant of Cabinet Élite Juridique, a law firm based in Montréal, Québec, Canada.

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
- Keep answers concise (a few sentences), friendly, and in English.`
    : `Tu es l’assistant virtuel chaleureux et accueillant du Cabinet Élite Juridique, un cabinet d’avocats basé à Montréal, Québec, Canada.

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
- Réponses concises (quelques phrases), amicales, en français.`;
}

/**
 * POST /api/public/chat — assistant public, sans authentification.
 * Ne touche JAMAIS aux données internes : aucune requête base de données ici.
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
    let answer;
    try {
      answer = await chat(
        [
          { role: 'system', content: systemPrompt(b.lang) },
          { role: 'user', content: b.question },
        ],
        { maxTokens: 600, temperature: 0.7 },
      );
    } catch {
      return res.json({ answer: ERROR_MSG[b.lang] });
    }
    res.json({ answer });
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

export default router;
