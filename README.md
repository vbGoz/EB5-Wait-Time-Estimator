# Rural EB-5 Investment Search — Living Research Hub

A single-file static tracker that **continues the ChatGPT conversation** at:

https://chatgpt.com/share/6aaace7d-e408-83e9-9658-e2599e42d2ac — *Rural EB5 Investment Search*

Carries over the 5 projects, deployment-timing tracker, searchable comparison table, and diligence questions — rebuilt as a polished, hostable HTML file you can keep updating as you do more research.

**Open locally:** double-click `index.html` — it works offline, no server or build step.

## What's inside

- **5 projects tracked:** Independent Living Cottages / CTP (NC), Texas Infrastructure Holdings (TX), Cormont at Deer Valley (UT), Simply Shenandoah (VA), Hard Rock Pointe Vista (OK) — all $800K, all Rural TEA, all I-956F approved, with per-project lien, escrow, jobs, and exit details.
- **Sticky comparison table** with search, "differences only", and unknown-tint highlighting — the cells marked *Needs verification* are your next document requests.
- **Deployment timeline matrix** — intentionally all “?” today. Fill it from each escrow agreement (release trigger, days-to-wire, pooled vs. direct, lien status at funding).
- **Diligence checklist** (10 questions) with per-project checkboxes stored in `localStorage` + research log you can append to.
- **Live JSON editor** — paste updated data, Apply → re-render, then Export/Download.

## Host it (60 seconds)

**GitHub Pages (recommended for a living doc):**
1. Create a new repo `eb5research` on GitHub.
2. Upload `index.html`, `README.md`, and `data/projects.json` (drag-and-drop).
3. Repo → Settings → Pages → Source: Deploy from branch → `main` / `/ (root)` → Save.
4. Your URL: `https://<you>.github.io/eb5research/`

Every future edit is a git commit — history is your diligence trail. Alternatively drag `index.html` onto **Netlify** or **Cloudflare Pages** (no build command), or host on S3 — any static host works.

## Keep updating it as you research

Three equivalent ways — pick whichever is easiest for that edit:

1. **Edit in place:** Open `index.html`, find `const PROJECTS = [` near the top of the script, edit fields, save, re-upload. Best for one-off fixes.
2. **Use the on-page editor:** Scroll to *Update guide → Live JSON editor*, paste/adjust JSON, click **Apply → re-render**, then **Download updated HTML**. No code editor needed.
3. **Keep `data/projects.json` as the source:** Edit that file in GitHub (web UI) and redeploy. The page will offer to load it on next visit if it differs from the embedded data.

**After each sponsor or counsel call:**
- Update the relevant Comparison row and the Deployment timeline row.
- Add a *Research log* entry (date + source).
- Tick the diligence checklist items you confirmed in the docs.
- Export JSON/HTML as a backup before switching devices (`localStorage` is per-browser).

## Add a 6th project

Add an object to `PROJECTS` (or `data/projects.json`) with the same keys (`id`, `name`, `short`, `location`, `state`, `rural`, `investment`, `i956f`, `structure`, `security`, `offering`, `term`, `escrow`, `filings`, `construction`, `jobs`, `refund`, `completion`, `fundingDelay`, `redeployment`, `exit`, `partial`, `deployment`, `question`, `source`, `sourceUrl`, `notes`). Tables and cards expand automatically — the header row adds a column.

## Files

- `index.html` — the entire app, self-contained (CSS + JS inline), hostable anywhere and works via `file://`.
- `data/projects.json` — same data as embedded in `index.html`, for easier diffing in git.
- `README.md` — this file.

## Disclaimer

Tracker is for diligence and comparison, not investment, legal, or tax advice. "Needs verification" means the current source (marketing page, brochure, or AI summary) does not establish the answer — confirm every *Yes / Approved / First lien* against the PPM, subscription agreement, escrow agreement, loan/guarantee, and intercreditor documents with your own counsel.

## Continue the conversation here

We picked up where ChatGPT left off — the next step flagged there was adding a **Funding Speed / Escrow** section tracking the exact contractual trigger for each project to release money, expected days to deployment, and whether any money sits in escrow after I-526E filing. That matrix is now the *Deployment timeline* section. Bring new findings here and this page stays the canonical record.
