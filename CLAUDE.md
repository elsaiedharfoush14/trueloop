# TrueLoop — site + TrueLoop Field app (handover for Claude Code)

Company site of Eng. Elsayed Harfoush (water / wastewater commissioning, Riyadh). Reply to him in **Egyptian Arabic**; every English term in `backticks`.
Live: https://elsaiedharfoush14.github.io/trueloop/ — GitHub Pages from `main` /. Static only (no backend).

## Layout
- `index.html` — company site (formal Arabic + English via `.ar`/`.en` spans). Tools grid `#tools`, footer links, `sitemap.xml`.
- `app/` — **TrueLoop Field** PWA home (search, categories, recent, install, QR). `app/manifest.webmanifest` scope `../`, `app/version.json`.
- `sw.js` (root, scope `/trueloop/`) — precaches app + tools, network-first with revalidation. `CACHE='tl-app-<ver>'`.
- `assets/tl.css`, `assets/tl-core.js` — shared design system + runtime (`TL.init`, i18n `data-t`/`data-html`, `TL.rows`, `TL.msg`, `TL.store`, `TL.pipe` sizing, auto-update from `app/version.json`, `?app=1` back-to-app).
- `tools/booster/` chooser → `tools/booster/ls-h100/` (LS H100 MMC, parametric drawings) and `tools/ipc-calculator/` (ABB ACH480 IPC, made in another session),
- `tools/instruments/` (pressure, temperature/Pt100, mag flow, turbidity, chlorine, DO, pH: steps, loop check pass/fail, S7 scaling, new-instrument request), `tools/chw/` (closed loop = rules of `claude-kit/skills/chw-treatment-calc`, plus tower and no-sensor modes), `tools/flowmeter/` (TUF menus), `tools/parts/` (part numbers with manual source), `tools/cuag/` (Cu/Ag, self-contained with its own `sw.js` + `version.json`), older single-file tools `tools/*.html`.
- `assets/tl-cloud.js` — TrueLoop Field cloud phase 1 (BETA, `?beta=1`): Google sign-in, projects → sites → runs, offline sync on Firebase `trueloop-field`. Spec `docs/specs/2026-11-14-field-cloud-phase1.md`, rules `docs/firestore.rules`.
- Tool UI language: Egyptian Arabic (field staff) + English toggle; site cards: formal Arabic.

## Release (all, then push `main`)
1. `VER` in each changed tool + `app/index.html`; 2. `app/version.json` (open apps reload into it); 3. `CACHE` in root `sw.js`.
`tools/cuag/` has its own `VER` + `version.json` + `sw.js` cache name.
Commit email `332831565+elsaiedharfoush14@users.noreply.github.com`. Check once: `gh run list --repo elsaiedharfoush14/trueloop --limit 1`.

## Facts the tools rely on (from his manuals — don't guess)
- Cu/Ag controller reads pulse **length**, so flowmeter must use `M78 = 24 Flow Rate Pulse` (M67/M68/M69), not POS Int Pulse. 1 pulse = 1 L = 1 TFR. Copper target 0.2 ppm, HI-702 + `HI702-0` reagent; lower `TFR at Max Flow` = more copper.
- TUF: M90 >60 works (>80 excellent), Q >60, M91 97–103 %, `M33` item 3 = x1, `M54` OCT pulse width, "relay" 30/31 is a transistor (DC only), TS-2 DN25–100, TM-1 DN50–700, TL-1 DN300–6000.
- EMEC MAX5 (JDH4 Jeddah analysers: chlorine ECL/SCL, DO EOLUM, turbidity ETORBH) in `tools/instruments/` (controller = EMEC MAX5): terminals/menus from manual R36-01-18 (manualshive.com copy). mA outputs 13 common, 14–18, 0–20 mA two-point mapping; turbidity manual has no standard-solution calibration.
- H100 MMC: AP1-40 1 Single Ctrl, OUT 21 MMC, IN 29–33 Interlock 1–5, 20 Ready, 23 Trip, 14 Run, 5 BX; lead pump is not rotated without RS-485 Multi Master.

## Specs
`docs/specs/` holds the prompt/spec for each feature request (start there before changing a tool).
