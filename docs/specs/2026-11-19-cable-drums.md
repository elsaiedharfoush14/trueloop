# TrueLoop Optimise - web tool PLAN (app-builder step 1, 2026-11-19)

Code: `tools/cable-drums/` (this repo). Design + boards: claude-kit `skills/design-optimizer/web/`. Engine reference:
claude-kit `skills/design-optimizer/tools/cable_drums.py`. Registry: claude-kit `skills/hub/REGISTRY.md`.

## Outcome
A public page on the TrueLoop site where an engineer gets a real result in 2 minutes, with the manual vs optimised table,
so TrueLoop gets leads (email) and proof. Answers from him (2026-11-19): both products in v1, engine in the browser,
free with an email, Arabic + English.

## Users
- Visitor (contractor / consultant / plant engineer): tries a sample, uploads own file, downloads the result.
- TrueLoop (him): sees the leads list (email, company, which tool, size of job, saving shown).

## Screens (phone first, also desktop)
1. Landing: two cards - «Cable drums & cut plan» / «Pump energy plan»; language toggle AR / EN; "try with sample data".
2. Cable drums: upload Excel / CSV (tag, size, length) or paste; drum lengths + prices table (editable, sample prices
   marked BUDGET); store remnants (optional) -> Run -> table manual vs optimised per size, order list, cut plan.
3. Pump plan: tank (area, band), pumps (flow + kW for 1/2/3 running), 24 h inflow + tariff (sample curves) -> Run ->
   24 h chart (level, pumps on, price), cost / kWh / starts manual vs optimised.
4. Email gate: the result summary is free; the full download (Excel + PDF report with TrueLoop logo) asks for name,
   company, email (+ consent tick).
5. "Want this on your plant / next project?" - contact form -> WhatsApp / email to TrueLoop.

## Engine
- Same models as `tools/cable_drums.py` and `pump-optimizer/tools/pumpopt.py`, ported to JS and solved with HiGHS
  WebAssembly (`highs@1.8.0`, 2.6 MB, tested in this session: solves in Node). Runs in a Web Worker; data never leaves
  the browser. Time limit 20 s; above that show the best plan found + "contact us for the full study".
- Test: the JS result must equal the Python tool on the 3 example files (same cost, same order) - the automatic check.
- Limits: big jobs (> ~300 runs per size) -> heuristic first, solver second; message, not a freeze.

## Data
- Inputs stay in the browser (localStorage for a draft only).
- Leads need a place to land: [TBC] his choice - Google Sheet (Apps Script web hook), the TrueLoop portal backend, or
  an email service. Nothing else is stored.

## Out of scope v1
Login / accounts, payments, the live SCADA connection (that is the paid product A on the remote-monitoring gateway),
MCC / phase balance (in the engineering service, maybe v2).

## Phases
0. Design done: `web/DESIGN.md`, `web/BOARDS.md`, boards in `web/design/` (2026-11-19).
1. DONE 2026-11-19: cable drums page + JS engine + check against Python (AR / EN) - `web/app/`, tests ALL OK. 2. Pump plan page + chart. 3. Email gate + Excel / PDF
download + leads. 4. Landing + LinkedIn launch post (skill `linkedin` + `humanizer`).

## Open points [TBC]
- Where leads go (above). - Domain / hosting of the TrueLoop site (same as the portal?). - Logo + brand files path.
- Real drum prices from a supplier for the sample (else they stay marked BUDGET).
