# Deployment

Every step below uses a free tier. Nothing here needs a payment card.

## How the pieces are split

| Tier | Host | Reason |
|---|---|---|
| React frontend | Vercel | Static build on a CDN; what Vercel is for. |
| Express API | Render (Docker) | Long-running process, 512 MB is plenty for Node. |
| FastAPI + BERT + Qwen3 | **your own machine**, exposed with ngrok | Nothing free will host it. |
| PostgreSQL | Supabase | Managed Postgres; the schema runs unchanged. |

### Why the NLP tier runs on your machine

It cannot go on Vercel: the dependencies plus the 418 MB model come to roughly
1.7 GB against a 250 MB serverless limit, and the models take about twelve
seconds to load, which a serverless cold start cannot absorb.

It cannot go on Render's free tier either: BERT, MiniLM and spaCy need around
1.5–2 GB of RAM and the free instance has 512 MB, so the process is killed as
the model loads.

Hugging Face Spaces was the obvious answer — 16 GB of RAM free — but **Docker
Spaces now require a paid plan**; only Static Spaces are free, and those serve
HTML, not a Python service.

So the machine that already runs LM Studio runs FastAPI too, and one ngrok
tunnel exposes it. FastAPI reaches the model over `localhost:1234`, so only one
public endpoint is needed and `LLM_BASE_URL` keeps its default.

**Consequence to accept:** when that machine sleeps, CV upload and matching
stop. Registration, login, job browsing and the applications list keep working,
because those only need Render and Supabase.

---

## 1. Database — Supabase

1. Create a project and note the database password.
2. **Connect** → Connection method **Session pooler** → Type **URI**.
3. Load the schema from your machine:

   ```bash
   cd backend
   DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres" node init-db.js
   ```

Use the **session** pooler, not the transaction pooler: transaction mode is
built for serverless functions that connect briefly, while the Express API is a
long-running container holding a `pg` pool. The direct connection is IPv6-only
on the free plan and will simply hang on an IPv4 network.

`config/database.js` turns SSL on automatically for any non-localhost host.

Expect 9 tables, 3 `TEXT[]` columns and 3 unique indexes. Confirm with:

```sql
select
  (select count(*) from information_schema.tables where table_schema='public'),
  (select count(*) from information_schema.columns
     where table_schema='public' and data_type='ARRAY');
```

Free projects pause after about a week of inactivity.

---

## 2. NLP service — your machine, via ngrok

Start the service and LM Studio locally, then publish port 8000:

```bash
# terminal 1 — LM Studio serving on 1234, then:
cd nlp-service && ./venv/bin/uvicorn main:app --port 8000

# terminal 2
ngrok http 8000 --url=YOUR-DOMAIN.ngrok-free.dev

# terminal 3 — stop the machine sleeping while the site is up
caffeinate -dims
```

Claim the free static domain first (ngrok dashboard → **Domains**; every
account gets one "dev domain"). A random URL changes on every restart, which
silently breaks CV upload days into testing with no visible error.

Check it from outside:

```bash
curl -H 'User-Agent: python-requests/2.32.0' https://YOUR-DOMAIN.ngrok-free.dev/health
```

Send that `User-Agent`. ngrok's free tier shows an HTML interstitial to
browser-like agents, so opening the URL in a browser shows a warning page —
that is normal and does not mean the tunnel is broken. Python `requests`, which
is what the backend uses, passes straight through.

---

## 3. Express API — Render

New → Web Service → this repository, root directory `backend`, runtime
**Docker**, region closest to your users and database.

```
DATABASE_URL       postgresql://...pooler.supabase.com:5432/postgres
JWT_SECRET         node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_EXPIRES_IN     24h
PYTHON_SERVICE_URL https://YOUR-DOMAIN.ngrok-free.dev
SMTP_USER          your project gmail address
SMTP_FROM_NAME     ResumeMatch AI
BREVO_API_KEY      xkeysib-...
CORS_ORIGINS       https://YOUR-PROJECT.vercel.app,https://YOUR-PROJECT-git-dev-TEAM.vercel.app
TRUST_PROXY        1
```

**`BREVO_API_KEY` is required, not optional.** Render blocks outbound SMTP, so
with only Gmail credentials set, password resets and verification codes hang
for two minutes and then fail with a 502 — the connection never completes, so
it is not an authentication error and the logs show a timeout rather than a
rejection. Sign up at brevo.com, verify your sending address under **Senders**,
and paste the key. The free tier sends 300 emails a day and accepts a plain
Gmail address as sender, so you do not need to own a domain.

`GET /health` reports `"email": "brevo" | "resend" | "smtp" | "none"`, so you
can confirm the transport without sending anything.

**`TRUST_PROXY=1` is required too.** Without it express-rate-limit sees
Render's proxy address for every visitor and buckets them together, so one
person's traffic locks out everyone.

**`CORS_ORIGINS`** should list both Vercel URLs, comma-separated, no trailing
slashes. Leave it unset locally, where allow-all is what development wants.

Free instances spin down after ~15 minutes idle and take 30–60 seconds to wake.
Open the URL a few minutes before a demo.

---

## 4. Frontend — Vercel

Import the repository, **Root Directory** `frontend`. `vercel.json` pins the
framework, build command and the SPA rewrite that stops `/login` returning 404
on refresh.

```
VITE_API_URL = https://YOUR-BACKEND.onrender.com/api
```

Keep the `/api` suffix; axios appends paths to it. Vite inlines this at build
time, so changing it needs a redeploy.

Delete any variables Vercel offers to import from `.env.example` — those are
backend values and do not belong in a frontend project.

---

## Verifying

```bash
curl -H 'User-Agent: python-requests/2.32.0' https://YOUR-DOMAIN.ngrok-free.dev/health
curl https://YOUR-BACKEND.onrender.com/health
```

The first should report `llm.available: true`; the second `"email"` set to
something other than `none`.

Then in the browser: register, upload a CV, confirm a category and skills come
back, apply for a job, and check the employer sees a ranked candidate.

## Order

Supabase → `init-db.js` → ngrok tunnel → Render → Vercel → set `CORS_ORIGINS`
last, because it is the only value that depends on the Vercel URL.

## Teardown

Everything is a free tier with no card attached, so deleting the three projects
and stopping the tunnel is all that is needed.
