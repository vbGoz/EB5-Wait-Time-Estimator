# EB-5 Wait-Time Estimator — EAD + Conditional Green Card

Live estimator for **how long EAD (work permit) and the conditional 2-yr green card take if you file today**, using pipeline vs per-country caps from [blog.lucidtext.com](https://blog.lucidtext.com) (Suzanne Lazicki, Lucid Professional Writing).

Live at: `https://vbgoz.github.io/EB5-Wait-Time-Estimator/` (after enabling Pages)

**Open locally:** double-click `index.html` — works offline via embedded fallback, no build step.

## What's inside (estimator-only)

* **Astryx estimator:** Birth country (ROW / India / China) × Category (Rural $800K / HUA / Infrastructure / Unreserved $1.05M) × Filing date × Path (AOS I-485 vs Consular) → **EAD** (Current → 6–12mo concurrent I-485+I-765, else queue+8mo) and **Conditional GC** (`max(I-526E 13.6mo, visa queue) + AOS/consular`) with low/base/high bands. Toggle **Unreserved overflow** to see both Lazicki futures (set-aside only vs with Unreserved). Family multiplier slider 1.6–2.8× (2.0× = Lazicki).
* **Live model:** per-country 7.1% caps + 10k/yr total (Rural 3200 FY26 4000, HUA 1800, Infra 400→200, Unreserved 6800). Pipeline 19,780 petitions Apr22–Jun26 (China 46% India 27% ROW 27% → ~51k visas @2.0×). I-526E 13.6mo median, 11,192 pending, 24% denial Q3.
* **Timeline breakdown:** I-526E bar (teal) + visa queue bar (amber, dominates if >1yr) + AOS/consular bar (slate) + scenario table (Set-aside only vs With Unreserved: queue / cap / your slice).
* **Provenance:** fetched/synced dates, pipeline/supply/processing, caveats, links to EB-5 Timing, Mar 5 Backlog, Infra Rev, Q3 Data. Daily sync via `data/lucid-snapshot.json`.

No projects/comparison/deployment sections — estimator-only.

## Host it (60 seconds)

**GitHub Pages (recommended — keeps daily sync):**
1. Repo is `https://github.com/vbGoz/EB5-Wait-Time-Estimator` — already pushed (`main`).
2. GitHub → repo → **Settings → Pages** → Source: **Deploy from branch** `main` `/ (root)` → Save. Wait 1–2 min.
3. URL: `https://vbgoz.github.io/EB5-Wait-Time-Estimator/`
4. Daily Lucid sync: `.github/workflows/lucid-sync.yml` runs `node scripts/fetch-lucid.js` at 14:00 UTC and commits `data/lucid-snapshot.json` if changed. Requires `workflow` scope (`gh auth refresh -s workflow` if push was rejected). Fallback embedded data keeps `file://` working offline.

**Alternatives:** Drag `index.html` + `css/` + `js/` + `data/` onto **Netlify Drop**, **Cloudflare Pages**, **Vercel**, or S3 — no build command. Or `python3 -m http.server 8000` → `http://localhost:8000`.

## Keep it updated

The model is pipeline vs caps — no manual project edits needed. To refresh data:

* **Automatic:** GitHub Action syncs `data/lucid-snapshot.json` daily. Or run locally: `node scripts/fetch-lucid.js` and commit.
* **Manual tweak:** Edit `data/lucid-snapshot.json` (pipeline/supply/processing) or the inlined `ASTRYX_FALLBACK` in `index.html` (search `ASTRYX_FALLBACK`), then reload. The inline fallback mirrors the JSON so `file://` stays accurate when offline.

Check `https://blog.lucidtext.com/eb-5-timing/` and Visa Bulletin monthly — when Lazicki updates her Excel or DOS publishes new FADs, re-run the fetch.

## Files

* `index.html` — entire app, self-contained (CSS + Astryx inline JS), hostable anywhere via `file://`.
* `css/astryx.css` — Astryx panel/KPI/bar/table tokens.
* `js/astryx-estimator.js` — ES module version of estimator (inline classic in `index.html` for `file://`).
* `data/lucid-snapshot.json` — live snapshot (auto-synced). `data/projects.json` — legacy (kept for reference, not used by estimator).
* `scripts/fetch-lucid.js` — fetches RSS/Timing/Excel/USCIS, updates snapshot.
* `tests/astryx-estimator.test.mjs` — 11 tests (`node tests/astryx-estimator.test.mjs`).
* `.github/workflows/lucid-sync.yml` — daily sync workflow.

## Disclaimer

Not investment, legal, or tax advice. Model is Lazicki backlog logic (pipeline vs annual per-country caps). Assumptions swing result (`2.0×` vs `2.8×` family, `400/200` Infra inferred, FY26 limits unpublished, ROW Unreserved 0/30/100% swings 4–38yr, "Current" = few qualified ~687/Q3 + slow DOS not no backlog, not FIFO). Confirm with counsel and official DOS/USCIS sources. Attribution: Suzanne Lazicki, Lucid Professional Writing, blog.lucidtext.com.
