# Aeroseeds

Local three-service prototype: upload a maize leaf photo, get a disease diagnosis.

```
frontend (Next.js, :3000)  --->  backend (Node/Express, :4000)  --->  inference-service (FastAPI, :8000)
```

- **frontend** — upload UI, calls the backend only.
- **backend** — the only service the frontend talks to. Forwards images to the inference service. This is where future business logic (history, auth, storage, etc.) should live.
- **inference-service** — loads the PyTorch model once at startup and serves predictions. Does nothing else.

## 1. Prerequisites

- Python 3.10+
- Node.js 18+
- `maize_classifier.pth` — place it at `inference-service/model/maize_classifier.pth`
- `class_names.json` — place it at `inference-service/class_names.json` (a placeholder is already there; replace it with your real one)
- `disease_lookup.json` — a placeholder with stub cause/treatment/prevention text is already at `inference-service/disease_lookup.json`. Replace its contents once real content is sourced. Keys must match the class names in `class_names.json`.

## 2. Install dependencies

**Inference service (Python):**

```bash
cd inference-service
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

**Backend (Node):**

```bash
cd backend
npm install
```

**Frontend (Next.js):**

```bash
cd frontend
npm install
```

## 3. Run locally

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

By default it forwards requests to `http://localhost:8000`. To override, copy `.env.example` to `.env` and set `INFERENCE_SERVICE_URL`.

Before forwarding an image to the inference service, the backend runs a vision pre-check via [OpenRouter](https://openrouter.ai/) to reject blurry or non-maize photos. Copy `.env.example` to `.env` (if you haven't already) and set:

- `OPENROUTER_API_KEY` — your OpenRouter API key ([get one here](https://openrouter.ai/keys)).
- `OPENROUTER_VISION_MODELS` — optional, comma-separated list of vision-capable OpenRouter models to try in order. Each model is only tried if the previous one errors, times out (10s), or is rate-limited. Defaults to a built-in chain (see `backend/src/config.ts`) covering Gemini, GPT-4o, Claude, Qwen-VL, Mistral, Llama-4, and Grok. Which model actually answered a given request is logged by the backend.
- `CONFIDENCE_THRESHOLD` — optional, defaults to `0.65`. Diagnoses below this model confidence are reported to the user as "low confidence" instead of showing a result. The confidence value itself is never sent to the frontend or logged anywhere the frontend could read it.

If every model in the fallback chain fails, the backend logs the failure and falls back to sending the image straight to the inference service (skipping the quality gate) rather than blocking the user.

**3) Frontend — port 3000**

```bash
cd frontend
npm run dev
```

By default it calls `http://localhost:4000`. To override (e.g. for phone testing), copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_BACKEND_URL`.

Then open `http://localhost:3000` in a browser.

## 4. Testing from a phone on the same WiFi network

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

**CORS:** the backend has CORS enabled for all origins during local development, so requests from the frontend (whether accessed via `localhost` or your LAN IP) will work without extra configuration. The inference service is only ever called from the backend (server-to-server), so it doesn't need CORS at all.

**Firewall note:** if the phone can't reach the site, your computer's firewall may be blocking inbound connections on ports 3000/4000 — allow Node.js/the dev server through your OS firewall for private networks.

## Notes

- No database, auth, or Docker/deployment config is included — this is a local-only prototype by design.
- `disease_lookup.json` currently contains placeholder text (marked `PLACEHOLDER`) for cause/treatment/prevention. Swap in real content when it's ready; no code changes are needed as long as the JSON keys stay the same.
