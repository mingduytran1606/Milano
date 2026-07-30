# Milano Grist Widgets

Custom widgets for the Milano Marble job tracker (Grist doc `ezZUgCeS6Rq1` on
`milano.getgrist.com`). All widgets are served from a single
**Cloud Run** service (`milano-widgets`). Push to `main` triggers
Cloud Build → deploy.

| Folder | Widget | Cloud Run path |
|---|---|---|
| `inbox/` | Consolidated Inbox (jobs master–detail) | `/inbox/` |
| `stone-calendar/` | Stone Order Calendar (Agenda / Month / Week; each line on its order date until delivered, then its delivery date) with a top **stone search** bar that live-filters events. Merges the old Catalogue Search in. | `/stone-calendar/` |
| `calendar/` | Installations calendar + jobs sidebar | `/calendar/` |
| `address/` | Address autocomplete / new-job creator | `/address/milano-address-widget.html` |
| `stage-summary/` | Stage summary counts | `/stage-summary/milano-stage-summary-widget.html` |
| `docs/` | Design briefs (v1 + v2) | — |

## Deployment (Cloud Run)

All widgets are packaged into a single nginx container and deployed to
Cloud Run in `australia-southeast1`.

### Prerequisites

1. A GCP project with Cloud Run, Cloud Build, and Artifact Registry enabled.
2. An Artifact Registry Docker repo named `milano` in `australia-southeast1`.
3. A Cloud Build trigger on this repo's `main` branch (see `cloudbuild.yaml`).

### One-time setup

```bash
# Create the Artifact Registry repo (once)
gcloud artifacts repositories create milano \
  --repository-format=docker \
  --location=australia-southeast1

# Set up the Cloud Build trigger
gcloud builds triggers create github \
  --repo-name=Milano \
  --repo-owner=mingduytran1606 \
  --branch-pattern='^main$' \
  --build-config=cloudbuild.yaml
```

### Manual deploy (without Cloud Build trigger)

```bash
# Build and push
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA=$(git rev-parse --short HEAD)

# Or deploy directly with gcloud run
gcloud run deploy milano-widgets \
  --source=. \
  --region=australia-southeast1 \
  --allow-unauthenticated \
  --port=8080
```

### Updating widget URLs in Grist

After the first deploy, update each Grist custom widget URL to point to the
Cloud Run service URL. The service URL looks like:

    https://milano-widgets-XXXXXXXX-ts.a.run.app

Widget URLs in Grist become:

| Widget | Grist custom widget URL |
|---|---|
| Inbox | `https://<service-url>/inbox/` |
| Stone Calendar | `https://<service-url>/stone-calendar/` |
| Calendar | `https://<service-url>/calendar/` |
| Address | `https://<service-url>/address/milano-address-widget.html` |
| Stage Summary | `https://<service-url>/stage-summary/milano-stage-summary-widget.html` |

## Workflow

- **Edit → commit → push** → Cloud Build auto-deploys → hard-refresh the Grist page.
- Design iterations in claude.ai: give it the widget file; it should only touch the
  `<style>` block and HTML markup — never the `<script>` (Grist wiring, lookups,
  rules). Bring the result back as a commit so it's diffable.
- The Grist gotchas + test workflow live in the `milano-grist-widget` skill and
  `docs/milano-inbox-widget-BRIEF-v2.md` §7.

## Widgets expect in Grist

- Inbox: Custom widget on the Inbox page, **Table = Jobs_Detail**, **Access = Full**,
  **SELECT BY** = the Jobs list section.
- Stone Order Calendar: Custom widget, **Table = Stone_Order**, **Access = Full**,
  **SELECT BY** = unset (plots every line by order/delivery date; the top search bar
  filters events by stone name / supplier / code). Replaces the old Catalogue Search widget.
- Calendar: mapped to `Inst_`; Access = Full.
- Address/new-job: mapped to Jobs_Detail; needs `?key=GOOGLE_KEY` query param.
- Stage summary: Access = Read table.
