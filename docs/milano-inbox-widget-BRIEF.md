# Milano — Consolidated Inbox Widget · Design Brief

Paste this whole file into a fresh Claude chat when you want to iterate on the design.
It gives Claude everything needed to produce a **deployable** Grist custom widget, not just a pretty mockup.

---

## 1. Goal

The Inbox page currently shows a selected job across **three separate linked sections**:
Job detail (Jobs_Detail) · Stone order lines (Stone_Order) · Installation dates (Inst_).

**Consolidate all three into ONE custom widget.** Pick/select a job → the widget shows, in one panel:
its details, its stone-order lines, and its installation visits — and stays **editable** where it matters.

Pattern to follow = the existing Milano calendar widget (`milano-calendar-widget.html`): a standalone HTML
file that loads `grist-plugin-api.js`, reads live data, and is deployed to Netlify.

---

## 2. How it wires into Grist

- **Widget type:** single-record. Map it to **Jobs_Detail**, and on the Inbox page set **"SELECT BY" → the Jobs list**
  so clicking a job in the list drives the widget (`grist.onRecord`).
- `grist.ready({ requiredAccess: 'full', ... })` — `full` is needed because the widget also reads the two
  related tables and writes edits back.
- The selected job comes from `grist.onRecord(cb)`. Its related rows are fetched from the other two tables and
  filtered client-side by the `Job` reference:
  - `grist.docApi.fetchTable('Stone_Order')` → keep rows where `Job === selectedJobRowId`
  - `grist.docApi.fetchTable('Inst_')` → keep rows where `Job === selectedJobRowId`
- **Edits** write back via:
  `grist.docApi.applyUserActions([['UpdateRecord', tableId, rowId, {ColId: value}]])`
  (or `AddRecord` / `RemoveRecord`). Table ids: `Jobs_Detail`, `Stone_Order`, `Inst_`.

### Live doc coordinates (team site)
- Host: `https://milano.getgrist.com`
- Doc id: `ezZUgCeS6Rq1`
- `grist-plugin-api.js` served from that host: `https://milano.getgrist.com/grist-plugin-api.js`
- (Dev copy for testing: doc `8hNMQ5FHycDpSGcpZcd6VW`, same host.)

---

## 3. Data model (exact column ids — case-sensitive)

### Jobs_Detail  (tableRef 2) — the selected job
| colId | label | type | notes |
|---|---|---|---|
| `Job_ID` | Job ID | Text (formula `"J%04d" % $id`) | read-only |
| `Client_Name` | Client Name | Ref:Client | value = Client row id |
| `Client_Label` | Client | Text (formula) | **use this for display** (the client name) |
| `Job_Address` | Job Address | Text | editable |
| `Address_Formatted` | Address (verified) | Text | geocoded; may be blank |
| `Stage` | Stage | Choice | editable — colours below |
| `Assigned_To` | Assigned To | ChoiceList | multi; render as neutral initials avatars |
| `Payment_Status` | Payment Status | Choice | editable — colours below |
| `Cash` | Cash | Text (choices Invoice/Cash) | |
| `Meas_Date` | Meas. Date | Date | editable |
| `Inst_Dates` | Inst. Date(s) | Text (formula rollup) | read-only; one visit per line |
| `Input_Date` | Input Date | Date | when the job was entered |
| `Note` | Note | Text | editable |
| `Scope_Qty` | Scope Qty | Numeric (rollup) | read-only |
| `Ordered_Qty` | Ordered Qty | Numeric (rollup) | read-only |
| `In_WH_Qty` | In WH Qty | Numeric (rollup) | read-only |
| `Stones` | Stones | Text (rollup) | read-only summary of lines |
| `State`/`Postcode`/`Suburb` | | Text (formula) | derived from address |
| `Year`/`Quarter`/`Month` | | derived | |

### Stone_Order  (tableRef 3) — the job's stone lines
| colId | label | type | notes |
|---|---|---|---|
| `Job` | Job | Ref:Jobs_Detail | **filter key** = selected job row id |
| `Product` | Product | Ref:Catalogue | display shows "Supplier \| Code \| Name" |
| `Stone` | Stone | Text | free-text stone name (history) |
| `Scope_Qty` | Scope Qty | Numeric | editable |
| `Ordered_Qty` | Ordered Qty | Numeric | editable |
| `Delivery_Qty` | Delivery Qty | Numeric | |
| `WH_Avail` | WH Avail | Numeric | |
| `Return_Qty` | Return Qty | Numeric | |
| `Order_Status` | Order Status | Choice | editable — colours below |
| `Order_Date` | Order Date | Date | |
| `Delivery_Date` | Delivery Date | Date | |
| `INV` | INV # | Text | |
| `Note` | Note | Text | editable |
| `Product_Code` | Product_Code | Text (formula) | read-only, from Product |
| `Product_Supplier` | Product_Supplier | Text (formula) | read-only, from Product |
| `Product_Price_slab` | Product_Price / slab | Numeric (formula) | read-only |

### Inst_  (tableRef 37) — the job's installation visits
| colId | label | type | notes |
|---|---|---|---|
| `Job` | Job | Ref:Jobs_Detail | **filter key** = selected job row id |
| `Installation_date` | Installation_date | Date | editable |
| `Installation_Detail` | Installation Detail | Text | per-visit note, editable |
| `Cal_Pos` | Cal Pos | Numeric | manual ordering (from calendar) |
| `Client`/`Job_Address`/`Stage`/`Assigned`/`Job_Scope_Qty` | | formula lookups | read-only |

---

## 4. Choice colours (from the live doc — use these exact hex)

Render Choice/ChoiceList values as **rounded pills** in their own colour; text colour defaults to `#000` if blank.
Assigned_To has **no colours** — render as neutral grey initials avatars (per prior design decision).

**Jobs_Detail.Stage**
```
Quote      #FEF47A   Live       #98FD90   WIP        #CCFEFE
Completed  #FECC81   Cancelled  #FFFFFF   Others     #DCDCDC
Closed !   #f0d1ed   On hold    #FECBCC   Fix Job    (none)
```
**Jobs_Detail.Payment_Status**
```
Not Invoiced (none)   Deposit Paid #FFFACD   Outstanding Bal #FECBCC
Fully Paid  #E1FEDE   Other (none)           Not Paid Yet   #FEE7C3
TBC By a Minh #E8D0FE
```
**Stone_Order.Order_Status**
```
2.  Placed Order   #FEF47A   3. Awaiting Order  #FED6FB   6. Delivered      #98FD90
4. Awaiting Pickup #75B5FC   7. Not Delivered Yet #CCFEFE  5. On hold        #FEE7C3
1. No Stock        #FD8182   Cancelled          #DCDCDC   Delivered by WF/Aboda/Client #E1FEDE
Return #CCFEFE     N/A (none)
```

---

## 5. Grist gotchas (these have bitten this project before — bake them in)

1. **Dates:** `fetchTable` / REST records return Date cols as **epoch SECONDS** → multiply by 1000 for JS `Date`.
   BUT `grist.onRecord` / `onRecords` can deliver Date cols as **JS Date objects** — handle BOTH
   (`typeof v==='number' ? v*1000 : +new Date(v)`). Writing a date = epoch **seconds** integer (UTC midnight).
2. **Ref cells:** `fetchTable`/REST give a Ref as a plain **row-id number** (e.g. `Job: 3`, `Client_Name: 53`).
   `onRecord` may instead give the Ref's **display value** (a string) or an encoded `['R', tableId, rowId]` /
   `{rowId}` object. Normalize with a `refId(v)` helper (number → v; `['R',...]` → v[2]; obj → v.rowId; string → keep).
   For matching stone/inst lines to the job, compare the numeric `Job` id from `fetchTable` to the selected row id.
3. **ChoiceList** values arrive as `["L", "Julie", "Phoebe"]` — strip the leading `"L"`. Write the same way: `['L', ...vals]`.
4. **Choice colours** live in each column's `widgetOptions.choiceOptions[value].fillColor/textColor`. Hardcoding the
   maps in section 4 is fine and simplest; to read live, fetch `_grist_Tables_column` and parse `widgetOptions`.
5. **Rollup / formula cols are read-only** (`Job_ID`, `Client_Label`, `Inst_Dates`, `Scope_Qty`, `Stones`,
   `Product_*`). Don't render editors for them.
6. **RPC never resolves outside Grist** — render sample data FIRST, then let Grist callbacks re-render, so the
   widget isn't blank in a plain browser / artifact preview.
7. **`requiredAccess: 'full'`** is required (reads 2 extra tables + writes). Set widget Access = **Full** in Grist.

---

## 6. Deploy

- All Milano widgets live in `C:\Users\minht\Downloads\`; deploy folders are per-widget (Netlify drag-drop
  REPLACES the whole site, so keep each widget in its own folder).
- Put this widget in its own folder, e.g. `C:\Users\minht\Downloads\milano-inbox-widget-deploy\`, and deploy to a
  **new** Netlify site. The file is served at the site ROOT as `index.html` (the calendar site does the same —
  the `/<filename>.html` path 404s; use the root URL).
- In Grist: Inbox page → add a **Custom** widget → paste the Netlify root URL → map table = **Jobs_Detail**,
  Access = **Full**, **SELECT BY** = the Jobs list section. Hard-refresh after each redeploy.

---

## 7. Local / artifact testing hooks (the starter exposes these)

- `window._test(job, stoneRows, instRows)` — inject sample data and render without Grist.
- `window._inbox` — debug handle to internal state.
- Runs standalone (opens in a browser / claude.ai artifact) using built-in sample data when Grist isn't present.

---

## 8. Design direction (starting point — iterate freely)

- **Header band:** big Client name + Job ID chip; address underneath; Stage pill + Assigned avatars on the right;
  Payment pill. Quick KPIs: Scope / Ordered / In-WH qty.
- **Three stacked cards** (or tabs) below: **Details** (editable Stage, Payment, Meas date, Note, address),
  **Stone Order** (one row per line: product, qty, order-status pill, price; editable status/qty), **Installations**
  (list of visits: date — note; add/remove a visit).
- Clean, calm, lots of whitespace; pills carry the colour, everything else neutral. Works light + dark.
- Editable-in-place is the whole point — clicking a pill/field should let you change it and write straight back to Grist.
