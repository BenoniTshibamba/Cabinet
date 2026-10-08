import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requirePermission, HttpError } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();

const UPLOAD_ROOT = resolve(process.env.UPLOAD_DIR ?? './uploads');
export const BRANDING_DIR = join(UPLOAD_ROOT, 'branding');

// Réutilisé par app.js pour servir les logos en lecture publique.
const LOGO_ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.svg']);
const LOGO_MAX_SIZE = 2 * 1024 * 1024; // 2 Mo

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    mkdirSync(BRANDING_DIR, { recursive: true });
    cb(null, BRANDING_DIR);
  },
  // Nom de fichier généré aléatoirement : jamais le nom fourni par le client.
  filename: (req, file, cb) => cb(null, `logo-${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: LOGO_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!LOGO_ALLOWED_EXT.has(ext)) {
      return cb(new HttpError(400, 'invalid_file_type', `Type de fichier non autorisé : ${ext || 'inconnu'}. Formats acceptés : PNG, JPG, SVG.`));
    }
    cb(null, true);
  },
});

/** 5 emplacements d'images du diaporama d'accueil (chemins relatifs à uploads/, null = vide). */
function parseHeroImages(raw) {
  try {
    const arr = JSON.parse(raw ?? '[]');
    if (!Array.isArray(arr)) return [null, null, null, null, null];
    return [0, 1, 2, 3, 4].map((i) => (typeof arr[i] === 'string' && arr[i].trim() ? arr[i].trim() : null));
  } catch {
    return [null, null, null, null, null];
  }
}

const toSettings = (r) => ({
  firmName: r.firm_name,
  tagline: r.tagline,
  logoPath: r.logo_path ?? null,
  primaryColor: r.primary_color,
  accentColor: r.accent_color,
  heroTitle: r.hero_title,
  heroSubtitle: r.hero_subtitle,
  contactEmail: r.contact_email,
  contactPhone: r.contact_phone,
  address: r.address,
  addressStreet: r.address_street ?? '',
  addressCity: r.address_city ?? 'Kinshasa',
  addressProvince: r.address_province ?? 'Kinshasa',
  addressPostal: r.address_postal ?? '',
  addressCountry: r.address_country ?? 'République démocratique du Congo',
  footerText: r.footer_text,
  aboutText: r.about_text ?? '',
  aboutTitle: r.about_title ?? '',
  aboutPhotoPath: r.about_photo_path ?? null,
  heroImages: parseHeroImages(r.hero_images),
  ctaTitle: r.cta_title ?? '',
  ctaText: r.cta_text ?? '',
  ctaButton: r.cta_button ?? '',
  practiceTitle: r.practice_title ?? '',
  testiTitle: r.testi_title ?? '',
  showHero: r.show_hero == null ? true : Boolean(r.show_hero),
  showPosts: r.show_posts == null ? true : Boolean(r.show_posts),
  showFeatures: r.show_features == null ? true : Boolean(r.show_features),
  showTestimonials: r.show_testimonials == null ? true : Boolean(r.show_testimonials),
  showContact: r.show_contact == null ? true : Boolean(r.show_contact),
  showAbout: r.show_about == null ? true : Boolean(r.show_about),
  showPracticeAreas: r.show_practice_areas == null ? true : Boolean(r.show_practice_areas),
  updatedAt: r.updated_at,
});

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tous les champs sont optionnels : PUT accepte une mise à jour partielle.
const settingsSchema = z.object({
  firm_name: z.string().trim().min(1).max(120).optional(),
  tagline: z.string().trim().max(200).optional(),
  primary_color: z.string().regex(HEX_COLOR, 'Couleur primaire invalide (format #RRGGBB attendu).').optional(),
  accent_color: z.string().regex(HEX_COLOR, 'Couleur d’accent invalide (format #RRGGBB attendu).').optional(),
  hero_title: z.string().trim().min(1).max(160).optional(),
  hero_subtitle: z.string().trim().max(500).optional(),
  contact_email: z.string().trim().max(160).refine((v) => v === '' || EMAIL_RE.test(v), 'Courriel invalide.').optional(),
  contact_phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(200).optional(),
  address_street: z.string().trim().max(160).optional(),
  address_city: z.string().trim().max(80).optional(),
  address_province: z.string().trim().max(80).optional(),
  address_postal: z.string().trim().max(20).optional(),
  address_country: z.string().trim().max(80).optional(),
  footer_text: z.string().trim().max(300).optional(),
  about_text: z.string().trim().max(2000).optional(),
  about_title: z.string().trim().max(160).optional(),
  cta_title: z.string().trim().max(160).optional(),
  cta_text: z.string().trim().max(500).optional(),
  cta_button: z.string().trim().max(60).optional(),
  practice_title: z.string().trim().max(160).optional(),
  testi_title: z.string().trim().max(160).optional(),
  show_hero: z.boolean().optional(),
  show_posts: z.boolean().optional(),
  show_features: z.boolean().optional(),
  show_testimonials: z.boolean().optional(),
  show_contact: z.boolean().optional(),
  show_about: z.boolean().optional(),
  show_practice_areas: z.boolean().optional(),
}).strict();

async function getSettings() {
  const { rows } = await query('SELECT * FROM site_settings WHERE id = 1');
  if (!rows[0]) throw new HttpError(500, 'settings_missing', 'Paramètres du site introuvables.');
  return rows[0];
}

// Lecture publique : la page d'accueil en a besoin avant toute connexion.
router.get('/', async (req, res, next) => {
  try {
    res.json(toSettings(await getSettings()));
  } catch (err) {
    next(err);
  }
});

router.put('/', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const b = settingsSchema.parse(req.body);
    const keys = Object.keys(b);
    if (!keys.length) throw new HttpError(400, 'empty_body', 'Aucun champ à mettre à jour.');
    const old = await getSettings();
    const setClauses = keys.map((k, i) => `${k} = @p${i + 1}`).join(', ');
    const { rows } = await query(
      `UPDATE site_settings SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING *`,
      keys.map((k) => b[k]),
    );
    await logAudit({
      userId: req.user.id, action: 'settings.update', resourceType: 'site_settings', resourceId: '1',
      oldValues: toSettings(old), newValues: toSettings(rows[0]), ip: req.ip,
    });
    res.json(toSettings(rows[0]));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_body', err.issues[0].message) : err);
  }
});

function deleteLogoFile(logoPath) {
  if (!logoPath) return;
  const abs = join(BRANDING_DIR, logoPath.split('/').pop());
  // Garde-fou : ne jamais supprimer en dehors du dossier branding.
  if (!abs.startsWith(BRANDING_DIR) || !existsSync(abs)) return;
  try { unlinkSync(abs); } catch { /* déjà supprimé */ }
}

router.post('/logo', requireAuth, requirePermission('users.update'), (req, res, next) => {
  upload.single('logo')(req, res, async (err) => {
    try {
      if (err) {
        if (err instanceof multer.MulterError) {
          throw new HttpError(400, 'upload_error', err.code === 'LIMIT_FILE_SIZE' ? 'Logo trop volumineux (2 Mo max).' : err.message);
        }
        throw err;
      }
      if (!req.file) throw new HttpError(400, 'missing_file', 'Aucun fichier reçu (champ « logo »).');
      const old = await getSettings();
      const logoPath = `branding/${req.file.filename}`;
      const { rows } = await query(
        'UPDATE site_settings SET logo_path = @p1, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING *',
        [logoPath],
      );
      deleteLogoFile(old.logo_path);
      await logAudit({
        userId: req.user.id, action: 'settings.logo_upload', resourceType: 'site_settings', resourceId: '1',
        newValues: { logoPath }, ip: req.ip,
      });
      res.json(toSettings(rows[0]));
    } catch (e) {
      next(e);
    }
  });
});

router.delete('/logo', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const old = await getSettings();
    const { rows } = await query(
      "UPDATE site_settings SET logo_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING *",
    );
    deleteLogoFile(old.logo_path);
    await logAudit({ userId: req.user.id, action: 'settings.logo_delete', resourceType: 'site_settings', resourceId: '1', ip: req.ip });
    res.json(toSettings(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Photo de la section "À propos" (même stockage que le logo).
router.post('/about-photo', requireAuth, requirePermission('users.update'), (req, res, next) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      if (err) {
        if (err instanceof multer.MulterError) {
          throw new HttpError(400, 'upload_error', err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop volumineuse (2 Mo max).' : err.message);
        }
        throw err;
      }
      if (!req.file) throw new HttpError(400, 'missing_file', 'Aucun fichier reçu (champ « photo »).');
      const old = await getSettings();
      const photoPath = `branding/${req.file.filename}`;
      const { rows } = await query(
        'UPDATE site_settings SET about_photo_path = @p1, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING *',
        [photoPath],
      );
      deleteLogoFile(old.about_photo_path);
      await logAudit({
        userId: req.user.id, action: 'settings.about_photo_upload', resourceType: 'site_settings', resourceId: '1',
        newValues: { photoPath }, ip: req.ip,
      });
      res.json(toSettings(rows[0]));
    } catch (e) {
      next(e);
    }
  });
});

router.delete('/about-photo', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const old = await getSettings();
    const { rows } = await query(
      "UPDATE site_settings SET about_photo_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING *",
    );
    deleteLogoFile(old.about_photo_path);
    await logAudit({ userId: req.user.id, action: 'settings.about_photo_delete', resourceType: 'site_settings', resourceId: '1', ip: req.ip });
    res.json(toSettings(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Diaporama d'accueil : 5 emplacements (slot 1..5), même stockage que le logo.
const heroSlot = z.coerce.number().int().min(1).max(5);

router.post('/hero-images/:slot', requireAuth, requirePermission('users.update'), (req, res, next) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      const slot = heroSlot.parse(req.params.slot);
      if (err) {
        if (err instanceof multer.MulterError) {
          throw new HttpError(400, 'upload_error', err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop volumineuse (2 Mo max).' : err.message);
        }
        throw err;
      }
      if (!req.file) throw new HttpError(400, 'missing_file', 'Aucun fichier reçu (champ « photo »).');
      const old = await getSettings();
      const images = parseHeroImages(old.hero_images);
      const newPath = `branding/${req.file.filename}`;
      if (images[slot - 1]) deleteLogoFile(images[slot - 1]);
      images[slot - 1] = newPath;
      const { rows } = await query(
        'UPDATE site_settings SET hero_images = @p1, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING *',
        [JSON.stringify(images)],
      );
      await logAudit({
        userId: req.user.id, action: 'settings.hero_image_upload', resourceType: 'site_settings', resourceId: '1',
        newValues: { slot, newPath }, ip: req.ip,
      });
      res.json(toSettings(rows[0]));
    } catch (e) {
      next(e instanceof z.ZodError ? new HttpError(400, 'invalid_slot', 'Emplacement invalide (1 à 5).') : e);
    }
  });
});

router.delete('/hero-images/:slot', requireAuth, requirePermission('users.update'), async (req, res, next) => {
  try {
    const slot = heroSlot.parse(req.params.slot);
    const old = await getSettings();
    const images = parseHeroImages(old.hero_images);
    if (images[slot - 1]) deleteLogoFile(images[slot - 1]);
    images[slot - 1] = null;
    const { rows } = await query(
      'UPDATE site_settings SET hero_images = @p1, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING *',
      [JSON.stringify(images)],
    );
    await logAudit({ userId: req.user.id, action: 'settings.hero_image_delete', resourceType: 'site_settings', resourceId: '1', ip: req.ip });
    res.json(toSettings(rows[0]));
  } catch (err) {
    next(err instanceof z.ZodError ? new HttpError(400, 'invalid_slot', 'Emplacement invalide (1 à 5).') : err);
  }
});

export default router;
