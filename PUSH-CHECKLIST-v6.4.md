# Cabinet v6.4 — push checklist (prepared 2026-10-13)

Status as of this prep: v6.3 (SEO: Google site name + meta description) and v6.4 (auto-logout after 2 h inactivity) were both built and delivered as ZIPs on 2026-10-13 (~10:39 and ~10:47 EDT), tests 230/230. **v6.4 is cumulative — it includes all of v6.3. Push v6.4 only; do not push v6.3 separately.**
No confirmation of the push has been recorded yet — deployment status is unverified.

ZIP: `~/workspace/your_files/Cabinet-Elite-Juridique-v6.4.zip`
Changes summary: `~/workspace/cabinet-juridique/CHANGES-v6.4.md`

## Steps (Benoni's — code pushes stay his)

1. Extract the v6.4 ZIP **over the correct local folder**: « Cabinet Élite Juridique v2 » on the Desktop (the folder used for the correct v6.2 re-push on 2026-10-11).
2. In that folder, run `git status` **before** committing.
   - ✅ Expected: a short list of **modifications** — `frontend/index.html`, `backend/src/blog-ssr.js` (v6.3), `frontend/js/app.js`, `frontend/js/i18n.js` (v6.4).
   - 🛑 **STOP if you see massive deletions** (hundreds/thousands of lines, OAuth/Google/2FA files disappearing): that is the wrong-folder signature from the 2026-10-11 v6.2 incident, which briefly took the Google login button off the live site. Do not commit; re-check the folder.
3. Commit + push as usual. `.env` is never in the ZIP and must not be added.
4. Wait for the Render deploy to finish, then verify live at https://cabinet-elite-juridique.onrender.com :
   - Site loads, Google login button present (real multicolor « G »).
   - Log in, leave the dashboard idle — the warning modal should appear at 1 h 59 (or trust the local smoke test already passed and just confirm login works).
5. After the deploy is live: **re-request indexing of the homepage in Google Search Console** (the v6.3 step) — the site is now indexed (confirmed by Benoni's screenshot 2026-10-13 ~10:35), so this is about getting the corrected site name/description picked up, not first indexing.

## If anything looks wrong after the push

- Roll back on Render to the previous deploy (v6.2) and tell Muse what `git status` showed — do not push a second time from a different folder.
