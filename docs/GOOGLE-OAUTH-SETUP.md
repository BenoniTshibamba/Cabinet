# Connexion avec Google — mise en place (compte perso)

Guide pour activer « Continuer avec Google » sur cabinet-elite-juridique.onrender.com.
À faire dans ton compte Google **personnel** (tu as choisi ça pour l'instant — migration vers un compte cabinet possible plus tard, voir §7).

## 1. Créer le projet Google Cloud

1. Va sur https://console.cloud.google.com/ — connecte-toi avec ton compte perso.
2. Menu déroulant du projet (en haut à gauche) → **Nouveau projet** → nomme-le « Cabinet Élite Juridique » → **Créer**. Sélectionne-le après création.

## 2. Configurer l'écran de consentement OAuth

1. **API et services → Écran de consentement OAuth**.
2. Type d'utilisateur : **Externe** (ton compte perso ne permet pas « Interne »).
3. Renseigne : nom de l'app « Cabinet Élite Juridique », e-mail d'assistance = ton Gmail, e-mail de contact développeur = ton Gmail.
4. Scopes : ne rien ajouter. Le code demande `openid`, `email`, `profile` — ce sont des scopes **non sensibles**, donc **aucune vérification Google n'est requise**.

⚠️ **Piège à éviter (statut de publication) :** un écran de consentement tout neuf démarre en mode **« Test »**. En mode Test, seuls les comptes ajoutés comme *utilisateurs test* peuvent se connecter — les autres voient **« Accès bloqué »**. Deux options :
- **Option A (simple) :** laisse le mode Test et ajoute l'adresse Gmail de chaque avocat dans **Utilisateurs test**.
- **Option B :** clique **Publier l'application** (possible sans examen Google car les scopes sont non sensibles) — n'importe quel compte Google peut alors se connecter.

## 3. Créer l'identifiant client OAuth

1. **API et services → Identifiants → Créer des identifiants → ID client OAuth**.
2. Type d'application : **Application Web**. Nomme-le « Cabinet Élite Juridique — Production ».
3. Dans **URI de redirection autorisés → Ajouter un URI**, colle **exactement** (sans slash final, en https) :
   ```
   https://cabinet-elite-juridique.onrender.com/api/auth/oauth/google/callback
   ```
   Google exige une correspondance caractère par caractère — un slash en trop ou `http` au lieu de `https` donne `redirect_uri_mismatch`.
4. « Origines JavaScript autorisées » : pas requis pour ce flux — tu peux le laisser vide.
5. **Créer** → copie le **Client ID** et le **Client secret**.

## 4. Ajouter les variables sur Render

Dans le dashboard Render → service **cabinet-elite-juridique** → **Environment**, ajoute :
- `GOOGLE_CLIENT_ID` = ton Client ID
- `GOOGLE_CLIENT_SECRET` = ton Client secret

Sauvegarde → Render redéploie automatiquement.

## 5. Vérifier

1. Ouvre le site : le bouton « Continuer avec Google » apparaît sur la page de connexion (le frontend l'affiche seulement si le backend est configuré).
2. Teste avec ton compte admin : ton e-mail Gmail doit correspondre au compte admin existant.

## 6. Comportement (bon à savoir)

- La connexion Google ne fonctionne **que pour un compte déjà créé par l'admin** dont l'adresse e-mail est vérifiée par Google. Un compte Google inconnu voit : « Aucun compte actif ne correspond à cette adresse Google. Demandez l'accès à l'administrateur du cabinet. » — il n'y a **pas** d'auto-inscription.
- Si l'utilisateur a la 2FA (TOTP) activée, Google login demande quand même le code 2FA.
- Sans les deux variables d'environnement, le bouton disparaît automatiquement — le site continue de marcher en mot de passe classique.

## 7. Migration future vers un compte cabinet

Quand le cabinet aura son propre compte Google : recrée un client OAuth (§2–3) dans le compte du cabinet, puis remplace `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` sur Render. Les comptes utilisateurs ne changent pas — seul le client change.

---
BUILT WITH LOVE AND CAFFEINE BY BB24
