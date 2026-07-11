# Aeroseeds

Upload a maize leaf photo (or a whole folder of them), get a disease diagnosis with treatment advice, and track results by farm over time.

```
frontend (Next.js, :3000)  --->  backend (Node/Express, :4000)  --->  inference-service (FastAPI, :8000)
                                        |
                                        v
                                  Postgres (Supabase, via Prisma)
```

- **frontend** — the only UI. Talks to the backend only. Pages: single scan, batch scan, farms (list/detail), unassigned scans, dashboard.
- **backend** — the only service the frontend talks to. Runs the diagnosis pipeline (vision gate → inference → cross-exam → treatment advice), persists farms/scans/results to Postgres via Prisma, and renders PDF reports.
- **inference-service** — loads a ConvNeXt-Tiny (`timm`) checkpoint once at startup and serves predictions. Does nothing else; never touches the database.

## How a diagnosis works

For a single image (`POST /diagnose`) or a batch (`POST /diagnose-batch`, processed concurrently), the backend's diagnosis pipeline runs each image through:

1. **Vision gate** — an OpenRouter vision model checks the photo is a usable, in-focus maize leaf shot before spending inference on it. Rejects blurry or non-maize photos.
2. **Inference** — the image is forwarded to `inference-service`, which returns a predicted class and confidence.
3. **Confidence check** — below `CONFIDENCE_THRESHOLD` (default `0.65`), the result is reported as "uncertain" rather than shown as a diagnosis.
4. **Cross-exam** — for confident predictions, a second OpenRouter model is asked to confirm or contradict the CNN's finding without being told the CNN's answer, as a sanity check. It never originates a diagnosis, only confirms/contradicts.
5. **Treatment advice** — for confirmed diagnoses, an OpenRouter model with live web search fetches current, Nigeria-specific treatment product recommendations. Cached per disease for 7 days, so this fires at most once per disease per week.

Each OpenRouter step uses a configurable fallback chain of models (`OPENROUTER_VISION_MODELS`, `OPENROUTER_ADVISOR_MODELS`) — if a model errors, times out, or is rate-limited, the next one in the chain is tried. If every vision-gate model fails, the backend skips the gate rather than blocking the user.

Scans can optionally be attached to a farm at upload time, or assigned afterwards from the "unassigned scans" list. Farm and scan detail pages, plus branded PDF reports (`GET /reports/scan/:id`, `GET /reports/farm/:id`, rendered with Puppeteer), are generated from this stored data.

## 1. Prerequisites

- Python 3.10+
- Node.js 18+
- A Postgres database (the project is built against [Supabase](https://supabase.com/))
- `convnext_tiny_best.pt` — place it at `inference-service/model/convnext_tiny_best.pt`
- `class_names.json` — place it at `inference-service/class_names.json` (a placeholder is already there; replace it with your real one)
- `disease_lookup.json` — a placeholder with stub cause/treatment/prevention text is already at `inference-service/disease_lookup.json`. Replace its contents once real content is sourced. Keys must match the class names in `class_names.json`.

## 2. Install dependencies

**Inference service (Python):**

```bash
cd inference-service
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
```

**Backend (Node):**

```bash
cd backend
npm install
```

`npm install` also runs `prisma generate` (via `postinstall`).

**Frontend (Next.js):**

```bash
cd frontend
npm install
```

## 3. Configure the backend

Copy `backend/.env.example` to `backend/.env` and set:

- `DATABASE_URL` / `DIRECT_URL` — Postgres connection strings. From Supabase's "Connect" button, use the **session pooler** (port 5432) for both — the transaction pooler (port 6543) measured ~4x slower per request with Prisma. Leave unset locally if you don't have credentials yet; routes touching the database (farms, scans, dashboard, reports) will fail until they're set.
- `OPENROUTER_API_KEY` — your [OpenRouter](https://openrouter.ai/keys) API key. Powers the vision gate, cross-exam, and treatment advisor steps described above.
- `OPENROUTER_VISION_MODELS` / `OPENROUTER_ADVISOR_MODELS` — optional, comma-separated fallback chains. Defaults live in `backend/src/config.ts`.
- `CONFIDENCE_THRESHOLD` — optional, defaults to `0.65`.
- `BATCH_CONCURRENCY` — optional, defaults to `6`. How many images from a batch request are processed at once.
- `INFERENCE_SERVICE_URL` — optional, defaults to `http://localhost:8000`.
- `REPORT_COMPANY_*` / `LETTERHEAD_IMAGE_PATH` — optional, branding for PDF reports. Defaults to Aeroseeds' own details.

See `backend/.env.example` for the full list with details.

Once `DATABASE_URL` is set, apply the schema:

```bash
cd backend
npx prisma migrate deploy
```

## 4. Run locally

Start in this order, each in its own terminal:

**1) Inference service — port 8000**

```bash
cd inference-service
uvicorn main:app --host 0.0.0.0 --port 8000
```

**2) Backend — port 4000**

```bash
cd backend
npm run dev
```

**3) Frontend — port 3000**

```bash
cd frontend
npm run dev
```

By default it calls `http://localhost:4000`. To override (e.g. for phone testing), copy `frontend/.env.local.example` to `frontend/.env.local` and set `NEXT_PUBLIC_BACKEND_URL`.

Then open `http://localhost:3000` in a browser.

## 5. Testing from a phone on the same WiFi network

All three dev servers above are already bound to `0.0.0.0`, so they accept connections from other devices on your network, not just `localhost`.

**Find your computer's local IP address:**

- Windows: open a terminal and run `ipconfig`, look for "IPv4 Address" under your active adapter (usually something like `192.168.1.23`)
- macOS: `ipconfig getifaddr en0`
- Linux: `hostname -I`

**Point the frontend at your backend's LAN address:**

In `frontend/.env.local` (copy from `frontend/.env.local.example`):

```
NEXT_PUBLIC_BACKEND_URL=http://<your-computer-ip>:4000
```

Restart `npm run dev` in `frontend/` after changing this file (Next.js only reads `.env.local` at startup).

**On your phone:**

1. Connect to the same WiFi network as your computer.
2. Open `http://<your-computer-ip>:3000` in the phone's browser.

**CORS:** the backend has CORS enabled for all origins, so requests from the frontend (whether accessed via `localhost` or your LAN IP) work without extra configuration. The inference service is only ever called from the backend (server-to-server), so it doesn't need CORS at all.

**Firewall note:** if the phone can't reach the site, your computer's firewall may be blocking inbound connections on ports 3000/4000 — allow Node.js/the dev server through your OS firewall for private networks.

## Backend API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/diagnose` | Diagnose a single image (`image` form field), optionally with a `farmId`. |
| `POST` | `/diagnose-batch` | Diagnose a batch of images (`images` form field, up to `MAX_BATCH_IMAGES`, default 1000); starts an async job. |
| `GET` | `/diagnose-batch/:jobId` | Poll batch job status/progress. |
| `GET` | `/farms` | List farms. |
| `POST` | `/farms` | Create a farm. |
| `GET` | `/farms/:id` | Get a farm. |
| `PATCH` | `/farms/:id` | Update a farm. |
| `DELETE` | `/farms/:id` | Delete a farm. |
| `GET` | `/farms/:id/scans` | List a farm's scans. |
| `GET` | `/scans/unassigned` | List scans not yet attached to a farm. |
| `GET` | `/scans/:id` | Get a scan and its results. |
| `PATCH` | `/scans/:id/assign` | Attach a scan to a farm. |
| `GET` | `/dashboard/summary` | Aggregate stats across farms/scans/findings. |
| `GET` | `/reports/scan/:scanId` | Download a branded PDF report for a scan. |
| `GET` | `/reports/farm/:farmId` | Download a branded PDF report for a farm. |
| `GET` | `/health` | Health check. |

## Deployment

`render.yaml` deploys the backend (Node, runs `prisma migrate deploy` on build) and the inference service (Docker) as two Render web services. The frontend isn't included there; deploy it separately (e.g. Vercel) and point `NEXT_PUBLIC_BACKEND_URL` at the deployed backend.

## Notes

- `disease_lookup.json` currently contains placeholder text (marked `PLACEHOLDER`) for cause/treatment/prevention. Swap in real content when it's ready; no code changes are needed as long as the JSON keys stay the same.
- No auth is included yet.
