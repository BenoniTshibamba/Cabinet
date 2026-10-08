import { z } from 'zod';

/**
 * Politique de mot de passe : minimum 10 caractères, dont au moins
 * une lettre (accents inclus) et un chiffre. Utilisée à la création
 * d'utilisateur (admin) et au changement de mot de passe.
 */
export const PASSWORD_RULE_FR =
  'Le mot de passe doit contenir au moins 10 caractères, dont une lettre et un chiffre.';

export const passwordSchema = z
  .string()
  .min(10, PASSWORD_RULE_FR)
  .regex(/^(?=.*\p{L})(?=.*\d).+$/u, PASSWORD_RULE_FR);
