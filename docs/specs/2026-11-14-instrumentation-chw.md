# Prompt / spec — Instrumentation Commissioning + CHW & Cooling Tower Treatment (TrueLoop Field)

Requested 2026-11-14 by Eng. Elsayed. Build inside TrueLoop Field with the shared kit (`assets/tl.css`, `assets/tl-core.js`), Arabic (Egyptian, for technicians) + English toggle, offline, auto-update, summary copy, PDF, share QR.

## 1. Instrumentation Commissioning — `tools/instruments/`
Goal: any technician commissions a field instrument end to end and leaves an as-left record.
- Types: pressure (Siemens SITRANS P or any HART PT), temperature (Siemens SITRANS T / Pt100 RTD), electromagnetic flow (Siemens SITRANS F M MAG 5000/6000 or any), turbidity, free chlorine, dissolved oxygen, pH. Clamp-on ultrasonic links to `tools/flowmeter/`.
- Inputs: tag, service, range LRV/URV + unit, signal (2-wire / 4-wire), PLC (S7 raw 0–27648, or engineering), alarm limits, tolerance %.
- Outputs: (a) about the instrument (what it measures, how, what can go wrong); (b) quick commissioning steps in order — install, wire, power, configure (HART names: LRV, URV, unit, damping, zero), calibrate (type-specific: zero trim / ice-point / water-full pipe / formazin / DPD / air saturation / buffers), output, loop check, as-left; (c) loop-check table 0-25-50-75-100 % with expected value, mA, PLC raw, as-found entry, error % and pass/fail; (d) PLC scaling (S7 NORM_X / SCALE_X); (e) faults table; (f) O&M schedule.
- Do not invent brand menu paths. Use parameter names common to HART / the type; model-exact keys are added only from a manual he provides.
- "New instrument" card: part number + nameplate photo. Today: sends a request to TrueLoop (WhatsApp). Later: AI assistant (below).

## 2. CHW & Cooling Tower Treatment — `tools/chw/`
Base: `claude-kit/skills/chw-treatment-calc` (EMEC MTOWER PLUS, closed loop, validated on the first project). Keep its rules unchanged for closed loop + sensors.
Modes: system = closed loop (chilled water) | open loop (cooling tower); control = with sensors (conductivity / pH on the controller) | without sensors (timers + test kit).
- Closed + sensors: Bleed inverted (SP, Dead Band −, Time Limit), Inhibitor Feed & Bleed, initial charge, Biocide 2 + NUMBER WEEK, alarms, BMS, checks — exactly as the kit tool.
- Closed, no sensors: initial charge, top-up kg from a nitrite test, biocide timer, weekly test routine.
- Tower + sensors: evaporation E = Q·ΔT·0.00153, blowdown B = E/(COC−1), makeup = E + B (+ drift); bleed normal (ON above SP = makeup µS × COC); inhibitor ppm on makeup; biocide with pre-bleed and lockout; alarms. Flag starting values for the chemical supplier to confirm.
- Tower, no sensors: blowdown on a timer from B and valve flow, inhibitor timer from daily product, biocide timer.
- Explanation (what treatment does and why), O&M, faults.

## 3. AI assistant (proposal phase, needs his approval + API key)
Part number or nameplate photo → identify model → fetch datasheet/manual → generate quick-commissioning steps (AR/EN) in the same card format, cached per model so the second user gets it instantly. Needs a server function holding the Anthropic API key (Firebase Functions on Blaze or a Cloudflare Worker); never in the browser.

## Acceptance
Both tools: no console errors, no horizontal overflow at 400 px, AR/EN complete, closed-loop worked example reproduces SP 2000 / DB −200 / TL 12h00 / HIC 2800 / 34.4 kg / biocide 22.4 L = 02 48 @ 02:00.
