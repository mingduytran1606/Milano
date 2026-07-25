# Stone Order Calendar tests

Headless checks for `stone-calendar/index.html`. The widget is a single self-contained file, so
each suite loads it into jsdom with the Grist plugin script stripped out — that leaves `grist`
undefined, the widget falls back to its built-in sample data, and everything runs offline.

```bash
npm install     # once, pulls jsdom
npm test
```

## Why these exist

The table rewrite shipped three bugs that looked fine in the source and only showed up on screen:

- rows and the header drifted out of alignment because a `.ag-day.tbl` CSS rule got lost while
  rewriting a patch, so the day bands silently kept the old flex layout
- the day-scoped supplier button was given `class="sup day"`, which collided with the `.day` grid
  rule meant for day bands
- `flashNewRow()` kept looking for `.ev[data-rid]` after the chips it belonged to were deleted, so
  the confirmation pulse after creating an order quietly stopped working

None of those throw. They need something that asserts structure, which is what these do.

## The suites

| file | covers |
|---|---|
| `test-widget.js` | table renders, slab counts, supplier box adds up, Quote rows hidden, inline edit |
| `test-align.js` | header, rows and totals resolve to the *same* grid tracks; date-column banding and rule contrast |
| `test-colpanel.js` | inline Columns panel, address column, drag reorder via `moveCol()` |
| `test-panelsize.js` | panel cannot be squeezed by the flex column; date-column width and font size settings |
| `test-cols-persist.js` | column layout saved and restored; corrupt or stale options cannot break the grid |
| `test-bulk.js` | bulk mode against table rows, per-day select-all, `applyBulk()` output |
| `test-create.js` | the create panel: existing job, new job plus new client, client reuse by name |

## Notes

- jsdom does no layout, so these assert **computed styles and DOM structure**, not pixels. That is
  enough to catch a dropped rule or a mismatched grid template, which is where the real bugs were.
- Two things genuinely cannot be tested here and need a real browser: the **drag gesture** (jsdom
  has no HTML5 drag events — only the `moveCol()` reorder logic is covered) and anything involving
  an actual **Grist read or write**.
- When a suite fails, check whether the widget changed or the assertion went stale. Both have
  happened; fixing the test to match new behaviour is right for the Cards-to-Columns move, and
  wrong if it is papering over a regression.
