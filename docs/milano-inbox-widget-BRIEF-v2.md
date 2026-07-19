# Milano — Consolidated Inbox Widget · Design Brief (v2)

Paste this whole file into a fresh Claude chat to iterate on the design. It describes a
**deployable Grist custom widget** (single self-contained HTML file), not just a mockup.
The current working build is `milano-inbox-widget.html` — start from that file; it runs
standalone on built-in sample data (see §11), so you can redesign the look without Grist.

---

## 1. What it is

A **master–detail Inbox** for Milano Marble's job tracker. Left = a searchable/filterable
**job list**; right = the selected job's **details + stone-order lines + installation visits**,
all **editable in place** and written straight back to Grist. It replaces three separate linked
Grist sections (Jobs_Detail · Stone_Order · Inst_) with one panel.

Audience: Julie's team (non-technical). Design goal: calm, uncluttered, fast; colour lives in
status pills, everything else neutral; works light + dark; responsive.

---

## 2. Live doc coordinates (team site)

- Host: `https://milano.getgrist.com` · API script `.../grist-plugin-api.js`
- **Prod doc** `ezZUgCeS6Rq1` · **Dev doc** `8hNMQ5FHycDpSGcpZcd6VW`
- Widget type: **single-record**, mapped to **Jobs_Detail**, page **SELECT BY = the Jobs list**
  (so clicking a job drives it via `grist.onRecord`). `grist.ready({requiredAccess:'full'})`.
- Deployed as `index.html` at the **root** of its own Netlify site; embedded as a Custom widget.

---

## 3. Data model (exact colIds — case-sensitive)

**Jobs_Detail** (the mapped table)
| colId | type | notes |
|---|---|---|
| `Job_ID` | Text formula `"J%04d" % $id` | read-only |
| `Client_Name` | **Ref:Client** | the editable client link (row id) |
| `Client_Label` | Text formula | display name (read-only; follows Client_Name) |
| `Job_Address` | Text | editable |
| `Address_Formatted` | Text | geocoded, may be blank |
| `Stage` | Choice | editable — colours §4 |
| `Payment_Status` | Choice | editable — colours §4 |
| `Assigned_To` | ChoiceList | editable multi; neutral initials avatars |
| `Meas_Date` | Date | editable |
| `Input_Date` | Date | default TODAY() |
| `Note` | Text | editable |
| `Scope_Qty` `Ordered_Qty` `In_WH_Qty` | Numeric rollups | read-only |
| `Stones` | Text rollup | used for search |
| `Inst_Dates` | Text rollup | one visit per line |

**Stone_Order** (the job's stone lines)
| colId | type | notes |
|---|---|---|
| `Job` | **Ref:Jobs_Detail** | filter key = selected job row id |
| `Product` | **Ref:Catalogue** | display uses Catalogue's `Product_Full` (visibleCol) |
| `Product_Code` `Product_Supplier` `Product_Price_slab` | formulas from Product | (price shown editable per-order in UI) |
| `Scope_Qty` `Ordered_Qty` `Delivery_Qty` | Numeric | editable (3 separate qtys) |
| `WH_Avail` `Return_Qty` | Numeric | |
| `Order_Status` | Choice | editable — colours §4 |
| `Order_Date` `Delivery_Date` | Date | editable |
| `INV` `Note` | Text | |
| (legacy `Stone` text col was dropped) | | |

**Inst_** (installation visits)
| colId | type | notes |
|---|---|---|
| `Job` | **Ref:Jobs_Detail** | filter key |
| `Installation_date` | Date | editable |
| `Installation_Detail` | Text | per-visit note |
| `Cal_Pos` | Numeric | manual ordering (from calendar widget) |

**Client**: name lives in the column that `Jobs_Detail.Client_Name` points to (its *visibleCol*).
**Catalogue**: `Supplier` (Choice), `Code`, `Finish`, `Size`, `Range`, `Price_Slab`, `Price_m2`,
and `Product_Full` (Text, label "Product") = the display value the Product ref shows,
e.g. `"WF | Marble | Biancatto 3420x2010x20mm"`. **Supplier choices** (28): Lavistone, YDL,
AC Stone, Caesarstone, Stone Ambassador, WK, Cosentino, Fibonacci, Attila, Enviro surfaces, RHF,
CDK, RMS, Zenith, Vasari, Custom Order, WF, Hone, Signorino, Laminam, FUM, Stone Mart, Artedomus,
Smart Stone, Aboda, Marella, Gladstones, Warner.

### Schema is read at runtime — do NOT hardcode ref-table columns
On go-live the widget fetches `_grist_Tables` + `_grist_Tables_column` and resolves the Ref
columns automatically: target table (from the `Ref:<Table>` type), the label/visible column, and
the editable columns (for the create/edit forms). This is why the Product label uses `Product_Full`
and why the client/product lookups adapt if the schema changes.

---

## 4. Choice colours (exact hex; render as rounded pills, text `#000` default)

**Stage**: Quote `#FEF47A` · Live `#98FD90` · WIP `#CCFEFE` · Completed `#FECC81` ·
Cancelled `#FFFFFF` · Others `#DCDCDC` · Closed ! `#f0d1ed` · On hold `#FECBCC` · Fix Job (none)

**Payment_Status**: Not Invoiced (none) · Deposit Paid `#FFFACD` · Outstanding Bal `#FECBCC` ·
Fully Paid `#E1FEDE` · Not Paid Yet `#FEE7C3` · TBC By a Minh `#E8D0FE` · Other (none)

**Order_Status**: `2.  Placed Order` `#FEF47A` · `3. Awaiting Order` `#FED6FB` · `6. Delivered` `#98FD90` ·
`4. Awaiting Pickup` `#75B5FC` · `7. Not Delivered Yet` `#CCFEFE` · `5. On hold` `#FEE7C3` ·
`1. No Stock` `#FD8182` · Cancelled `#DCDCDC` · Delivered by WF/Aboda/Client `#E1FEDE` · Return `#CCFEFE` · N/A (none)

Assigned_To has **no colours** — neutral grey initials avatars.

---

## 5. Layout & features (current build)

### Left — list pane
- **Header:** "JOBS" + count · **+ New job**.
- **Toolbar rows:**
  - Search box — matches address, client, **stone name/code/supplier** (via `Stones` rollup +
    lines), stage, staff.
  - **Views** ("All jobs") + **Group** dropdowns side by side.
  - **Filter** · **Sort** · **Customize** (⇥ icon) buttons.
- **Views dropdown:** saved views (a named snapshot of filters + sort + fields + card design +
  grouping). Save current as… / Update / Clear.
- **Group dropdown (next to Views):** quick switch between **saved groupings** · No grouping ·
  Save current as… · Edit grouping…
- **Filter dropdown:** drill-in by Stage / Assigned / Payment (toggle chips, counts, clear).
- **Sort dropdown:** Input date / Client / Stage / Scope qty / Meas date (click active to
  reverse). When sorting by **Stage**, a **drag-to-reorder stage-order list** appears (custom
  workflow order); other keys sort natural A–Z / Z–A.
- **Job cards:** rendered from a **markdown-ish template** (see Customize). Default template:
  `**{client}** {stage}` / `{address}` / `{assigned}`. A **kebab (…)** per card → Customize card ·
  Duplicate · Change history · Delete.
- **Grouping:** when active, the list breaks into **collapsible sections** (name + count).

### Splitter
A draggable divider between list and detail panes (resizes the list width; remembered).

### Right — detail pane
**A single combined, responsive header/details card:**
- Big **Client** name (click to edit → search-or-create Client lookup) + Job ID chip; top-right
  shows **Input date** and, under it, **Meas. date** (same format, pencil / double-click to edit).
- **Address** = inline-editable subtitle.
- A responsive field grid: **Stage** · **Payment** (coloured-pill dropdowns) · **Assigned**
  (avatars, click to edit multi-select).
- A second row of KPIs: **Scope · Ordered · Delivered · In WH**.
- **Note** (full-width, resizable).

**Stone Order card** — columns: **Product · Status · Scope · Order · Deliv · Price · Note**
- Product: label from the catalogue (via the `Product` ref → `Product_Full`). A **pencil** next to
  the name = **edit the stone profile** (the Catalogue record: name/code/supplier/price…);
  **double-click** the product = **pick a different product** (searchable picker with "＋ New
  product"). New/edit product form: Supplier is a **combobox** (existing suppliers + type-to-add)
  that **auto-deduces from the product name** ("WF | Marble | …" → WF).
- Status: coloured-pill **custom dropdown** (each option shown in its own colour) + two editable
  date lines **"Ordered on …"** and **"Delivered on …"**.
- Three qty inputs (Scope / Order / Deliv). Price prefilled from product, editable. Note =
  drag-resize box (resizing one row resizes all).
- **Auto status rule (widget-side, preserves manual choices):** Order date + Order qty →
  `2. Placed Order`; Delivery date + Delivered qty → `6. Delivered`. Never overrides
  Delivered-by-WF/Aboda/Client, On hold, Cancelled, N/A, Return.

**Installations card** — list of visits (date + note), n/N sequence badges, add / remove.

### Customize panel (opened from the kebab "Customize card" or the ⇥ button) — **two tabs**
- **Card layout:** a template text box (tokens `{client} {jobid} {address} {stage} {payment}
  {assigned} {scope} {ordered} {inwh} {meas} {input}`, markdown `**bold**`/`*italic*`, one row per
  line, literal text/separators) + click-to-insert field chips + **live preview** + a
  **Card text-size slider** + an **"Apply to everyone"** checkbox.
- **Grouping:** **Group the list by** one column (Client / Stage / Payment / Assigned / Address /
  Job ID) + optional **custom bucket rules** on that column (`if [contains/is/starts/empty]
  [value] → group name`, first match wins) + **Everything else:** each value as its own group / one
  "Others" group.

---

## 6. Persistence & sharing

- All prefs (saved views, saved groupings, active view/grouping, card template, card font size,
  stage order, grouping collapse state, list width, note height) live in **localStorage**
  (key `milano_inbox_prefs_v2`) — **per browser, per person**. Change history is
  `milano_inbox_history_v1`.
- The **card template, grouping, stage order, and font size** can be pushed to the whole team via
  the **"Apply to everyone"** checkbox → stored in the widget's Grist **doc options**
  (`grist.setOption` / `onOptions`) so every viewer adopts them live.

---

## 7. Grist gotchas (bake these in)

1. **Never blank / never hang:** `grist-plugin-api.js` loads even outside Grist, so `typeof grist`
   isn't proof of embedding. Render **sample data first**, then flip to live only once Grist
   actually answers (load schema + tables, THEN `state.grist=true`) so no edit in the connecting
   window writes a sample row-id.
2. **Dates:** `fetchTable`/REST = epoch **seconds** (×1000 for JS). `onRecord` may give JS Dates —
   handle both. Write dates as epoch-seconds ints (UTC midnight).
3. **Refs:** `fetchTable` gives a Ref as a plain row-id number; `onRecord` may give a display
   string or `['R',t,r]`/`{rowId}` — normalize with a `refId()` helper. Write a Ref as the rowId.
4. **ChoiceList** arrives `["L", …]` — strip the leading "L"; write `['L', …vals]`.
5. **Formula/rollup cols are read-only** — writing them silently no-ops (the original bug: editing
   `Client_Label` instead of the `Client_Name` ref). Detect formula cols via introspection.
6. **Trigger formulas can't read their own column** (circular ref) — that's why the auto
   status-rule lives in the widget, not a Grist formula, so it can preserve manual variants.
7. `requiredAccess:'full'` (reads Client/Catalogue/metadata + writes). Set widget Access = Full.

---

## 8. Deploy

Own folder → own Netlify site (drag-drop replaces the whole site). Use the **root** URL. In Grist:
Inbox page → Custom widget → root URL → Table = **Jobs_Detail**, Access = **Full**,
**SELECT BY** = the Jobs list. Hard-refresh after each redeploy.

---

## 9. Standalone / test hooks

- Opens in a plain browser / artifact on **built-in sample data** (jobs, stone lines,
  installations, clients, catalogue) — no Grist needed.
- `window._test(jobs, stone, inst, clients, catalogue)` injects data and renders.
- `window._inbox` = live state handle for debugging.
- A single `Unknown interface` console message appears only when embedded in a non-Grist iframe
  (preview/artifact) — harmless.

---

## 10. Performance

Measured at ~4× the live doc (1,000 jobs / 2,000 stone lines): full list re-render ~40 ms,
grouped ~30 ms, filter/sort <1 ms, detail render ~1 ms. Edits use optimistic rendering; the only
real latency is the Grist write round-trip. Fine well beyond current data sizes.

---

## 11. Notes for redesigning in Claude.ai

- Start from `milano-inbox-widget.html` — it's self-contained and renders sample data immediately,
  so you can restyle freely and see it live.
- Keep the **sample-data-first boot**, the **write-back helpers**, and the **schema introspection**
  intact if you want it to stay deployable — restyle the DOM/CSS around them.
- Safe to redesign freely: spacing, typography, colours (keep the status-pill hex), card layout,
  the toolbar, the Customize panel, the stone-line layout, section headers. The pill colours and
  the choice values must stay exact for Grist round-tripping.
