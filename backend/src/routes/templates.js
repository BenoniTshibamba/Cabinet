import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

const toTemplate = (tpl) => ({
  id: tpl.id,
  name: tpl.name,
  category: tpl.category,
  content: tpl.content,
  createdBy: tpl.created_by,
  authorName: tpl.first_name ? `${tpl.first_name} ${tpl.last_name}` : undefined,
  createdAt: tpl.created_at,
  updatedAt: tpl.updated_at,
});

const SELECT = `SELECT dt.*, u.first_name, u.last_name
  FROM document_templates dt LEFT JOIN users u ON u.id = dt.created_by`;

router.get('/', requirePermission('templates.read'), async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} ORDER BY dt.name ASC`);
    res.json(rows.map(toTemplate));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requirePermission('templates.read'), async (req, res, next) => {
  try {
    const { rows } = await query(`${SELECT} WHERE dt.id = $1`, [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Modèle introuvable.');
    res.json(toTemplate(rows[0]));
  } catch (err) {
    next(err);
  }
});

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().max(80).optional(),
  content: z.string().min(1).max(50000),
});

router.post('/', requirePermission('templates.create'), async (req, res, next) => {
  try {
    const b = templateSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO document_templates (name, category, content, created_by)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [b.name.trim(), b.category?.trim() || null, b.content, req.user.id],
    );
    const { rows: full } = await query(`${SELECT} WHERE dt.id = $1`, [rows[0].id]);
    await logAudit({ userId: req.user.id, action: 'TEMPLATE_CREATED', resourceType: 'document_template', resourceId: full[0].id, newValues: toTemplate(full[0]), ip: req.ip });
    res.status(201).json(toTemplate(full[0]));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

router.patch('/:id', requirePermission('templates.update'), async (req, res, next) => {
  try {
    const b = templateSchema.partial().parse(req.body);
    const { rows } = await query(
      `UPDATE document_templates SET
         name = COALESCE($1, name), category = COALESCE($2, category),
         content = COALESCE($3, content), updated_at = now()
       WHERE id = $4 RETURNING id`,
      [b.name?.trim() ?? null, b.category?.trim() ?? null, b.content ?? null, req.params.id],
    );
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Modèle introuvable.');
    const { rows: full } = await query(`${SELECT} WHERE dt.id = $1`, [rows[0].id]);
    await logAudit({ userId: req.user.id, action: 'TEMPLATE_UPDATED', resourceType: 'document_template', resourceId: full[0].id, newValues: toTemplate(full[0]), ip: req.ip });
    res.json(toTemplate(full[0]));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

router.delete('/:id', requirePermission('templates.delete'), async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM document_templates WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Modèle introuvable.');
    await logAudit({ userId: req.user.id, action: 'TEMPLATE_DELETED', resourceType: 'document_template', resourceId: req.params.id, ip: req.ip });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** Remplace les variables {{nom}} du modèle par les valeurs fournies. */
export function renderTemplateContent(content, variables = {}) {
  return String(content).replace(/\{\{\s*([\p{L}\p{N}_]+)\s*\}\}/gu, (match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? match : String(value);
  });
}

const renderSchema = z.object({
  variables: z.record(z.string(), z.string()).optional(),
});

router.post('/:id/render', requirePermission('templates.read'), async (req, res, next) => {
  try {
    const { variables } = renderSchema.parse(req.body);
    const { rows } = await query('SELECT * FROM document_templates WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw new HttpError(404, 'not_found', 'Modèle introuvable.');
    res.json({
      id: rows[0].id,
      name: rows[0].name,
      rendered: renderTemplateContent(rows[0].content, variables ?? {}),
    });
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

export default router;
