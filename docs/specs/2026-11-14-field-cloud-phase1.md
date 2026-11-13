# TrueLoop Field cloud, phase 1 (2026-11-14) — BETA

Plan: `E:\Work\TrueLoop_Brand\field_app\PLAN_TrueLoop_Field_doc.md` (his approved Claude Doc). Firebase project `trueloop-field` (config in `assets/tl-cloud.js`, details in `field_app\FIREBASE_SETUP.md`).

- `assets/tl-cloud.js` (ES module, Firebase JS SDK 11.10.0 from gstatic): Google sign-in (popup, redirect fallback), Firestore with persistent offline cache.
- Loaded ONLY while `localStorage.tl_beta=1`: open any page with `?beta=1` (`?beta=0` = off), or tap the version in the app home footer 5 times (works in the installed app).
  Loader: `TL.beta()` / `TL.cloud()` in `tl-core.js`; inline snippet in the tools without tl-core (cuag, ipc, loop-check, ro, calibration).
- Tool pages: button «احفظ في موقع» → project + site + tag + note + up to 3 photos (JPEG ≤1280 px stored in Firestore, no Cloud Storage = no Blaze).
  A run = the tool's own localStorage keys (map `TOOLS` in tl-cloud.js) + `#summary` text + tool version. `?run=pid/sid/rid` opens a saved run.
- App home `#cloud`: projects → sites → runs (pending-sync badge), open, compare with the previous run of the same tool, photos, rename/delete,
  one-tap move of this phone's pre-sign-in data, account (name, company, language, JSON export, sign out = clears local cache, delete account).
- Data: `users/{uid}/projects/{pid}/sites/{sid}/runs/{rid}/photos/{1..3}`; runs are write-once. Rules: `docs/firestore.rules` (owner-only, field whitelist, sizes).
- SW: root `sw.js`, `tools/cuag/sw.js`, `tools/ipc-calculator/sw.js` cache only Google Fonts + `www.gstatic.com/firebasejs/` cross-origin; Firestore / auth traffic never cached.
- New tool → add its id, page and localStorage key(s) to `TOOLS` in tl-cloud.js.
- Go-live later: drop the beta gate (call `TL.cloud()` always + load in the 5 standalone tools).
