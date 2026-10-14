# Cabinet Élite Juridique — v6.5

Conversations IA fluides et persistantes (demande de Benoni, 2026-10-14).

## Le problème
- La page « Assistant IA » EFFAÇAIT la réponse précédente à chaque nouvelle
  question (une seule zone de réponse, remplacée à chaque envoi).
- L'assistant n'avait AUCUNE mémoire : chaque question était traitée seule,
  sans le contexte des échanges précédents — un suivi repartait de zéro.
- L'historique ne vivait que dans le navigateur (localStorage, séparé entre
  mode public et mode connecté) : déconnexion, autre appareil ou navigateur
  intégré (WhatsApp) = fil perdu. Rien n'était sauvegardé côté serveur.

## La solution — vraies conversations, côté serveur
- Nouvelles tables `ai_conversations` + `ai_messages` (créées au démarrage).
- Chaque échange est enregistré sur le serveur, rattaché au compte
  (personnel et clients) ou au jeton visiteur anonyme (chat public).
- À chaque nouvelle question, les derniers échanges sont repassés au modèle :
  le fil est fluide, les suivis gardent leur contexte.
- Propriété vérifiée partout : impossible de lire/utiliser le fil d'un autre
  utilisateur ou d'un autre visiteur (404).

## Backend
- `backend/src/services/ai-conversations.js` (nouveau) : création, liste,
  lecture, suppression, messages, contexte LLM (12 derniers échanges),
  titre automatique = début de la première question.
- `routes/ai.js` :
  - `GET/POST /ai/conversations`, `GET/DELETE /ai/conversations/:id`.
  - `POST /ai/ask` accepte `conversationId` : reprend le fil ou en crée un,
    passe l'historique au modèle, enregistre question + réponse (y compris
    les réponses « aucun document »), renvoie `conversationId`.
  - Les erreurs du fournisseur (surcharge, etc.) ne sont PAS enregistrées :
    le fil ne garde que les échanges réels.
- `routes/public-chat.js` :
  - `POST /api/public/chat` accepte `visitorId` + `conversationId` : fil
    persistant du visiteur, contexte repassé au modèle, échange enregistré.
    Sans visitorId, comportement sans état inchangé.
  - `GET /api/public/chat/history?visitorId=…&conversationId=…` : relecture
    du fil (propriété vérifiée, compteur de débit séparé, 30/min).
  - Aucune donnée interne du cabinet n'est lue : seule écriture = le fil du
    visiteur lui-même.

## Frontend
- Page « Assistant IA » réécrite en fil continu : les bulles s'accumulent,
  barre de conversations (liste déroulante + Nouvelle + Supprimer),
  le fil se recharge depuis le serveur à l'ouverture de la page.
- Widget flottant branché sur le serveur :
  - Personnel : retrouve sa dernière conversation à l'ouverture ; bouton 🕘
    = liste des conversations passées (ouvrir / supprimer), bouton ＋ =
    nouvelle conversation.
  - Public : fil retrouvé grâce au jeton visiteur du navigateur.
  - Le localStorage devient un simple cache d'affichage (peinture immédiate,
    puis le serveur fait foi).
- i18n FR/EN : aiConversations, aiNewConversation, aiDeleteConversation,
  aiConversationDefault, aiThreadEmpty, chatNewConversation.
- CSS : liste des conversations du widget + barre/fil de la page Assistant IA.

## Tests
- 236/236 (6 nouveaux) : persistance staff sur un même fil, compteurs et
  titre automatique, propriété (lecture/usage/suppression par un tiers → 404),
  création/suppression de fil vide, auth requise, fil public par visiteur,
  contexte effectivement repassé au modèle (rôles user/model/user),
  historique public protégé (mauvais visitorId → 404), mode sans état
  inchangé sans visitorId.
- Smoke test sur base vierge : connexion → 2 questions → reconnexion →
  conversation complète retrouvée (4 messages).

## Fichiers modifiés
- backend/src/db/schema.sql
- backend/src/services/ai-conversations.js (nouveau)
- backend/src/routes/ai.js
- backend/src/routes/public-chat.js
- frontend/js/app.js
- frontend/js/i18n.js
- frontend/css/styles.css
- backend/test/api.test.js
- CHANGES-v6.5.md (nouveau)

## Rappel exploitation (hors code)
- Pour que l'assistant réponde au lieu de « surchargé » : variable Render
  `LLM_CHAT_MODEL=gemini-2.5-flash-lite` (palier gratuit de gemini-2.5-flash
  saturé chez Google). La v6.5 règle la mémoire et la persistance ; ce réglage
  règle les refus de Google.
- Les sources citées ([Source 1]…) s'affichent en direct après chaque réponse ;
  elles ne sont pas ré-affichées lors d'une relecture ultérieure du fil
  (seuls les textes sont conservés).

BUILT WITH LOVE AND CAFFEINE BY BB24
