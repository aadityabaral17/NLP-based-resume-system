# Deployment

Every step below uses a free tier. Nothing here needs a payment card.

## Why the pieces are split

| Tier | Host | Reason |
|---|---|---|
| React frontend | Vercel | Static build on a CDN; what Vercel is for. |
| Express API | Render (Docker) | Long-running process, writes uploads to disk. |
| FastAPI NLP | Hugging Face Spaces (Docker) | Needs ~1.5–2 GB RAM. Free Spaces give 16 GB. |
| PostgreSQL | Supabase | Managed Postgres; the schema runs unchanged. |
| Qwen3 4B | your Mac + Cloudflare tunnel | The model stays on hardware you control. |

The NLP tier **cannot** run on Vercel. Its dependencies plus the model weights
come to about 1.7 GB against a 250 MB serverless limit, and the models take
roughly 12 seconds to load, which a serverless cold start cannot absorb.

Render's free tier is 512 MB RAM, which is fine for Express but will be killed
when BERT loads. That is why the NLP service goes to Spaces instead.

---

## 1. Database — Supabase

1. Create a project. Note the database password.
2. Project Settings → Database → Connection string → **URI**.
3. Load the schema from your machine:

   ```bash
   cd backend
   DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" node init-db.js
   ```

`config/database.js` turns SSL on automatically for any non-localhost host, so
no other change is needed.

Free projects pause after about a week of inactivity. Inside a short demo
window that will not happen, but do not create the project weeks early and
leave it idle.

---

## 2. NLP service — Hugging Face Spaces

Create a Space with **SDK: Docker**, then push `nlp-service/` to it.

`bert_resume_model/` is about 418 MB, so it must go through Git LFS:

```bash
git lfs install
git lfs track "bert_resume_model/**"
git add .gitattributes
```

A Space is configured by YAML frontmatter at the top of its `README.md`.
Creating the Space through the web UI writes that file for you:

```yaml
---
title: ARIS NLP Service
sdk: docker
app_port: 7860
---
```

**This repository already has `nlp-service/README.md`, without that
frontmatter.** Pushing the folder as-is overwrites the Space's own README, the
`app_port` line disappears, and the Space builds but serves nothing — the logs
look healthy while every request times out. Either add the four frontmatter
lines to the top of `nlp-service/README.md` before pushing, or keep the
Space's README and exclude ours from that push.

Set one variable in the Space (Settings → Variables and secrets):

```
LLM_BASE_URL = https://YOUR-TUNNEL.trycloudflare.com/v1
```

The build takes a while: it installs the CPU build of torch, transformers,
sentence-transformers and spaCy. Hugging Face builds the image on their
infrastructure, so you are pushing source and model weights, not a 3 GB image.

Check it with `curl https://YOUR-SPACE.hf.space/health`.

---

## 3. Express API — Render

New → Web Service → point at this repository, root directory `backend`,
runtime **Docker**.

Environment variables:

```
DATABASE_URL       postgresql://...supabase.co:5432/postgres
JWT_SECRET         (node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
JWT_EXPIRES_IN     24h
PYTHON_SERVICE_URL https://YOUR-SPACE.hf.space
SMTP_USER          your project gmail address
SMTP_PASS          the 16 character app password
SMTP_FROM_NAME     ResumeMatch AI
CORS_ORIGINS       https://YOUR-PROJECT.vercel.app
TRUST_PROXY        1
```

`TRUST_PROXY` is not optional here. Without it express-rate-limit sees
Render's proxy address for every visitor and buckets them all together, so one
user's traffic locks out everyone else.

Free instances spin down after about 15 minutes idle and take 30–60 seconds to
wake. Open the URL a few minutes before a demo.

---

## 4. Frontend — Vercel

Import the repository, set **Root Directory** to `frontend`. `vercel.json`
already pins the framework, build command and the SPA rewrite that stops
`/login` returning 404 on refresh.

One environment variable:

```
VITE_API_URL = https://YOUR-BACKEND.onrender.com/api
```

Vite inlines this at build time, so change it and you must redeploy.

---

## 5. Local LLM — Cloudflare tunnel

With LM Studio serving on port 1234:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:1234
```

Copy the printed `https://....trycloudflare.com` URL into the Space's
`LLM_BASE_URL`, with `/v1` on the end.

Keep the Mac awake for as long as the site is up:

```bash
caffeinate -dims
```

Quick tunnels get a new URL every restart, so leave it running rather than
restarting it.

**If the tunnel drops, the site keeps working.** `llm_client` returns `None`,
career tips fall back to the backend generator, skills still come from BERT
plus the curated list, and match explanations still show data-derived
strengths and gaps. Only the LLM-written prose disappears.

---

## Verifying

```bash
curl https://YOUR-SPACE.hf.space/health      # llm.available should be true
curl https://YOUR-BACKEND.onrender.com/health
```

Then in the browser: register, upload a CV, check a category and skills come
back, apply for a job, and confirm the employer sees a ranked candidate.

## Order

Supabase → `init-db.js` → Space → Render → Vercel → tunnel last, because the
tunnel URL is the only value you cannot know in advance.

## Teardown

Everything above is a free tier with no card attached, so deleting the four
projects is all that is needed.
