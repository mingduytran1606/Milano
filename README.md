# Milano Grist Widgets

Custom widgets for the Milano Marble job tracker (Grist doc `ezZUgCeS6Rq1` on
`milano.getgrist.com`). Each folder is the **publish directory of its own Netlify
site** — its contents mirror the live URL shape exactly. Once the sites are linked
to this repo, **push to `main` = deploy**.

| Folder | Widget | Netlify site | Live URL shape |
|---|---|---|---|
| `inbox/` | Consolidated Inbox (jobs master–detail) | *(inbox site)* | serves at **root** (`index.html`) |
| `calendar/` | Installations calendar + jobs sidebar | `silly-paletas-da1298` | serves at **root** (`index.html`) |
| `address/` | Address autocomplete / new-job creator | `milanoaddresswidget` | **`/milano-address-widget.html`** (root 404s — keep the filename!) |
| `stage-summary/` | Stage summary counts | *(stage-summary site)* | `/milano-stage-summary-widget.html` |
| `docs/` | Design briefs (v1 + v2) | — | — |

## Linking a Netlify site to this repo (one-time, per site)

Netlify dashboard → the site → **Site configuration → Build & deploy →
Continuous deployment → Link repository** → GitHub → `milano-widgets`, then:

- **Branch:** `main`
- **Base directory:** *(leave empty)*
- **Build command:** *(leave empty — static files, no build)*
- **Publish directory:** the widget's folder, e.g. `inbox`

The site keeps its existing URL, so nothing embedded in Grist changes.
After linking, drag-drop deploys are no longer needed (and would be overwritten
by the next push).

## Workflow

- **Edit → commit → push** → Netlify auto-deploys → hard-refresh the Grist page.
- Design iterations in claude.ai: give it the widget file; it should only touch the
  `<style>` block and HTML markup — never the `<script>` (Grist wiring, lookups,
  rules). Bring the result back as a commit so it's diffable.
- The Grist gotchas + test workflow live in the `milano-grist-widget` skill and
  `docs/milano-inbox-widget-BRIEF-v2.md` §7.

## Widgets expect in Grist

- Inbox: Custom widget on the Inbox page, **Table = Jobs_Detail**, **Access = Full**,
  **SELECT BY** = the Jobs list section.
- Calendar: mapped to `Inst_`; Access = Full.
- Address/new-job: mapped to Jobs_Detail; needs `?key=GOOGLE_KEY` query param.
- Stage summary: Access = Read table.
