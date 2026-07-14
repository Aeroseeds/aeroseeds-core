# Aeroseeds — Project Guide & VPS Deployment

Welcome! This guide explains what this project is, how the pieces fit together, and exactly how to put it live on our server at **thanos.aeroseeds.io**. No prior knowledge of the project needed — just follow it top to bottom.

---

## Part 1: What is this project?

Aeroseeds helps farmers detect maize (corn) leaf diseases. A farmer uploads a photo of a maize leaf — or a whole folder of photos — and the app tells them:

- what disease the plant has (or that it's healthy),
- what causes it,
- how to treat it, including real products they can buy in Nigeria,
- and how to prevent it next season.

Farmers can also group their scans by farm and download professional PDF reports.

## Part 2: The three pieces

The project is made of three small apps that talk to each other:

```
 The website          The brain              The eye
┌────────────┐      ┌────────────┐      ┌───────────────┐
│  frontend  │ ───> │  backend   │ ───> │   inference   │
│ (what the  │      │ (organizes │      │ (the AI model │
│ user sees) │      │ everything)│      │ that looks at │
└────────────┘      └─────┬──────┘      │  the photo)   │
                          │             └───────────────┘
                          v
                    ┌────────────┐
                    │  database  │
                    │ (Supabase, │
                    │ in the     │
                    │ cloud)     │
                    └────────────┘
```

1. **frontend** — the website itself. Upload pages, farm pages, dashboard. This is the only thing users ever see.
2. **backend** — the middleman. It receives photos from the website, checks they're actually usable maize photos (using AI vision models via a service called OpenRouter), sends them to the inference service, double-checks the answer, saves everything to the database, and generates the PDF reports.
3. **inference-service** — the AI model. It looks at a photo and says "this looks like Maize Leaf Blight, 92% sure." That's all it does.

The **database** is not on our server — it lives at Supabase (a cloud service). The backend connects to it over the internet using a password kept in a settings file. Nothing to install for this.

Each of the three pieces runs in its own **container** (think: a sealed box that has everything the app needs inside it, so it runs the same on any machine). A tool called **Docker** runs these boxes. One file in the project, `docker-compose.yml`, describes all three boxes and how they connect — so you can start the whole thing with one command.

## Part 3: The two web addresses

When deployed, the app lives at two addresses:

- **https://thanos.aeroseeds.io** — the website (frontend)
- **https://api.thanos.aeroseeds.io** — the backend (the website talks to this behind the scenes)

A program called **Nginx** (probably already on the server, since it hosts other projects) receives all visitors and routes them: visitors to `thanos.aeroseeds.io` go to the frontend box, requests to `api.thanos.aeroseeds.io` go to the backend box. Nginx also handles the padlock (HTTPS).

---

## Part 4: Deploying — step by step

### Step 0: Point the domain at the server (one-time, whoever manages DNS)

In the DNS settings for `aeroseeds.io`, add two records, both pointing to the server's public IP address:

| Type | Name | Value |
|------|------|-------|
| A | `thanos` | the server's IP |
| A | `api.thanos` | the server's IP |

Wait a few minutes for this to take effect before doing Step 4 (the padlock step needs it).

### Step 1: Check what's already on the server

Log in to the server and run:

```bash
docker --version
docker compose version
nginx -v
certbot --version
git lfs version
```

Anything that prints a version number is already installed — skip it below. Install what's missing:

```bash
# Docker — runs the containers
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER    # then log out and back in

# Nginx + certbot — routes visitors and sets up the HTTPS padlock
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

# git-lfs — IMPORTANT. The AI model file (~110MB) is stored with
# "Git Large File Storage". Without this, downloading the code gets you
# a tiny placeholder instead of the real model, and the AI won't start.
sudo apt-get install -y git-lfs
git lfs install
```

### Step 2: Download the code and add the secrets

```bash
git clone <repo-url> aeroseeds
cd aeroseeds
git lfs pull    # only needed if git-lfs was installed AFTER cloning
```

Quick sanity check that the model downloaded properly:

```bash
ls -lh inference-service/model/convnext_tiny_best.pt
```

It should be about **110MB**. If it shows a few hundred *bytes*, git-lfs isn't working — run `git lfs install && git lfs pull`.

Now create the backend's settings file:

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Two values **must** be filled in (get them from Victor):

- `DATABASE_URL` and `DIRECT_URL` — the database passwords (two lines, usually the same value)
- `OPENROUTER_API_KEY` — the key for the AI vision services

Everything else in that file can be left as is.

### Step 3: Build and start everything

```bash
docker compose build     # builds the three boxes (takes ~10-20 min the first time)
docker compose up -d     # starts them in the background
docker compose ps        # all three should say "running"
```

To watch what they're doing (Ctrl-C to stop watching, doesn't stop the apps):

```bash
docker compose logs -f
```

The backend automatically sets up the database tables on startup, so there's nothing to do there.

### Step 4: Connect Nginx and turn on HTTPS

```bash
sudo cp deploy/nginx-thanos.conf /etc/nginx/sites-available/aeroseeds
sudo ln -s /etc/nginx/sites-available/aeroseeds /etc/nginx/sites-enabled/
sudo nginx -t                    # says "syntax is ok" if all good
sudo systemctl reload nginx

sudo certbot --nginx -d thanos.aeroseeds.io -d api.thanos.aeroseeds.io
```

Certbot asks a couple of questions (an email address; choose **yes** when it offers to redirect HTTP to HTTPS). It sets up the padlock and renews it automatically forever.

### Step 5: Check it works

```bash
curl https://api.thanos.aeroseeds.io/health
```

Should print: `{"status":"ok"}`

Then open **https://thanos.aeroseeds.io** in a browser, upload a maize leaf photo, and confirm you get a diagnosis. Done! 🎉

---

## Part 5: Everyday tasks

### Updating the site after code changes

```bash
cd aeroseeds
git pull
docker compose build
docker compose up -d
```

That's it. There's a brief moment (a few seconds) of downtime while it swaps over.

### If something looks broken

```bash
docker compose ps                    # are all three running?
docker compose logs backend         # what is the backend saying?
docker compose logs inference       # what is the AI saying?
docker compose logs frontend        # what is the website saying?
docker compose restart              # turn it off and on again
```

### After a server reboot

Nothing to do — the containers are set to restart automatically, as long as Docker itself starts on boot. Make sure of that once:

```bash
sudo systemctl enable docker
```

### Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| The AI container keeps restarting | Model file is a placeholder, not the real thing | `git lfs install && git lfs pull`, then `docker compose build inference && docker compose up -d` |
| Backend says it can't reach the database | Wrong `DATABASE_URL` in `backend/.env` | Fix the value, then `docker compose up -d backend` |
| Diagnosis fails with an AI/vision error | Wrong or expired `OPENROUTER_API_KEY` | Fix the key in `backend/.env`, then `docker compose up -d backend` |
| Website loads but scans fail | Backend or inference container is down | `docker compose ps`, then check that container's logs |
| Browser says "site can't be reached" | DNS records not set, or Nginx not configured | Re-check Step 0 and Step 4 |

---

## Part 6: Where things live (for when you start coding)

| Folder / file | What it is |
|---|---|
| `frontend/` | The website (Next.js/React) |
| `backend/` | The API server (Node/Express + Prisma for the database) |
| `inference-service/` | The AI model server (Python/FastAPI + PyTorch) |
| `docker-compose.yml` | Describes the three containers and how they connect |
| `deploy/nginx-thanos.conf` | The Nginx routing config used in Step 4 |
| `backend/.env` | Secrets — never commit this file to git |
| `README.md` | Technical docs: how the diagnosis pipeline works, the full API list, and how to run everything locally for development (without Docker) |
