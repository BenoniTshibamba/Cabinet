import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { loadCaseOr404, assertVisible } from './cases.js';
import { chat, embed, llmConfig, llmStatus } from '../services/llm.js';
import { indexDocument, cosine } from '../services/rag.js';

const router = Router();
router.use(requireAuth);

router.get('/status', requirePermission('ai.ask'), async (req, res) => {
  const status = llmStatus();
  res.json({ ...status, configured: status.available });
});

router.post('/index-document/:id', requirePermission('ai.manage'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM documents WHERE id=$1', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Document introuvable.');
    const c = await loadCaseOr404(rows[0].case_id);
    await assertVisible(req.user, c);
    const result = await indexDocument(rows[0]);
    res.json({ indexed: true, ...result });
  } catch (err) { next(err); }
});

router.post('/ask', requirePermission('ai.ask'), async (req, res, next) => {
  try {
    const b = z.object({
      question: z.string().trim().min(2).max(5000),
      caseId: z.coerce.number().int().positive().optional(),
      lang: z.enum(['fr', 'en']).optional().default('fr'),
    }).parse(req.body);

    const isClient = req.user.role === 'CLIENT';
    const lang = isClient ? b.lang : 'fr';

    let docs = [];
    if (b.caseId) {
      const c = await loadCaseOr404(b.caseId);
      await assertVisible(req.user, c);
      const { rows } = await query('SELECT d.* FROM documents d WHERE d.case_id=$1', [b.caseId]);
      docs = rows;
    } else if (isClient) {
      // Un client ne voit QUE les documents de ses propres dossiers (jamais tout le cabinet).
      const { rows } = await query(
        'SELECT d.* FROM documents d JOIN cases c ON c.id=d.case_id WHERE c.client_id=$1',
        [req.user.clientId],
      );
      docs = rows;
    } else {
      const { rows } = await query(
        `SELECT d.* FROM documents d JOIN cases c ON c.id=d.case_id
         WHERE ${req.user.role === 'LAWYER' ? 'c.lawyer_id=$1' : '1=1'}`,
        req.user.role === 'LAWYER' ? [req.user.id] : [],
      );
      docs = rows;
    }

    const msg = (fr, en) => (lang === 'en' ? en : fr);
    if (!docs.length) {
      return res.json({
        answer: msg(
          'Je n’ai trouvé aucun document accessible pour cette recherche.',
          'I found no accessible documents for this search.',
        ),
        sources: [],
      });
    }

    const ids = docs.map((d) => d.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const { rows: chunkRows } = await query(
      `SELECT dc.*, d.original_name, d.case_id, c.case_number, c.title
       FROM document_chunks dc
       JOIN documents d ON d.id=dc.document_id
       JOIN cases c ON c.id=d.case_id
       WHERE dc.document_id IN (${placeholders})`,
      ids,
    );

    if (!chunkRows.length) {
      return res.json({
        answer: msg(
          'Les documents sont bien enregistrés, mais aucun n’est encore préparé pour la recherche. Ajoutez un document ou attendez la fin de son analyse automatique.',
          'The documents are saved, but none is ready for search yet. Add a document or wait for its automatic analysis to finish.',
        ),
        sources: [],
      });
    }

    const questionVector = await embed(b.question);
    const ranked = chunkRows
      .map((x) => ({ ...x, score: cosine(questionVector, JSON.parse(x.embedding_json)) }))
      .sort((a, b2) => b2.score - a.score)
      .slice(0, 8);

    const context = ranked.map((x, i) =>
      `SOURCE ${i + 1}\nDocument: ${x.original_name}\nDossier: ${x.case_number} — ${x.title}\nExtrait:\n${x.content}`,
    ).join('\n\n');

    const system = isClient
      ? (lang === 'en'
        ? `You are the assistant of Cabinet Élite Juridique. You answer ONLY legal questions related to the client's own cases, using ONLY the information from the CONTEXT provided below.\nIf the question is not a legal question about the client's cases, or if the information is not in the context, reply with exactly: "I can only answer legal questions about your cases."\nDo not invent any fact, name, date, amount or article of law.\nDo not give a definitive legal conclusion: the lawyer remains responsible for the analysis.\nCite the documents used with [Source 1], [Source 2], etc.\n\nCONTEXT:\n${context}`
        : `Tu es l’assistant du Cabinet Élite Juridique. Tu réponds UNIQUEMENT aux questions juridiques concernant les dossiers du client, en te basant UNIQUEMENT sur les informations du CONTEXTE fourni ci-dessous.\nSi la question n’est pas une question juridique liée à ses dossiers, ou si l’information ne se trouve pas dans le contexte, réponds exactement : « Je ne peux répondre qu’aux questions juridiques concernant vos dossiers. »\nNe fabrique aucun fait, nom, date, montant ou article de loi.\nNe donne pas de conclusion juridique définitive : l’avocat reste responsable de l’analyse.\nCite les documents utilisés avec [Source 1], [Source 2], etc.\n\nCONTEXTE :\n${context}`)
      : `Tu es l’assistant documentaire du Cabinet Élite Juridique.
Réponds en français, clairement et prudemment.
Utilise UNIQUEMENT les informations du CONTEXTE fourni.
Si l’information n’est pas dans le contexte, dis explicitement que tu ne l’as pas trouvée.
Ne fabrique aucun fait, nom, date, montant ou article de loi.
Ne donne pas de conclusion juridique définitive : l’avocat reste responsable de l’analyse.
Cite les documents utilisés avec [Source 1], [Source 2], etc.

CONTEXTE :\n${context}`;

    const answer = await chat([
      { role: 'system', content: system },
      { role: 'user', content: b.question },
    ]);

    res.json({
      answer,
      sources: ranked.map((x, i) => ({
        number: i + 1,
        documentId: x.document_id,
        name: x.original_name,
        caseId: x.case_id,
        caseNumber: x.case_number,
        score: Number(x.score.toFixed(3)),
      })),
    });
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

export { indexDocument, llmConfig };
export default router;
