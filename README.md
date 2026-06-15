# NLP Based Resume Screening and Job Recommendation System

Pokhara University — Bachelor of Computer Engineering — May 2026

## Team
| Name | Role | Branch |
|------|------|--------|
| Ayush Khanal | Frontend + Database | feat/ayush |
| Nischal Bhandari | Backend (Node.js/Express) | feat/nischal-nlp |
| Aaditya Baral | NLP/ML (Python) | feat/aaditya |
| Samyog Sapkota | DevOps + Testing | feat/samyog |

---

## System Architecture
Frontend (React, port 5173)

↓

Backend (Node.js/Express, port 3000)

↓

NLP Service (Python/FastAPI, port 8000)

↓

Database (Supabase PostgreSQL)

Three servers run simultaneously on your machine, all connecting to one shared Supabase database.

---

## Current Progress
- [x] User registration (job seeker + organisation)
- [x] Login with JWT authentication
- [x] Protected routes based on user role
- [x] CV upload with NLP parsing (PDF/DOCX)
- [x] Section extraction (skills, projects, experience, summary)
- [x] SVM resume classifier (73% accuracy, 24 categories)
- [x] Sentence Transformer semantic matching
- [x] Skill gap analysis
- [x] Job posting with auto-matching
- [x] Email notifications (match score ≥ 65%)
- [x] Job seeker dashboard with match scores
- [x] Organisation dashboard with ranked candidates
- [x] Career recommendations panel
- [ ] CSV export for shortlist
- [ ] UI/UX polish

---

## Prerequisites

Install these before starting:

| Tool | Download Link | Check Version |
|------|---------------|----------------|
| Node.js 20+ | https://nodejs.org | `node --version` |
| Python 3.11+ | https://python.org | `python --version` |
| Git | https://git-scm.com | `git --version` |
| GitHub CLI | https://cli.github.com | `gh --version` |

---

## Step 1 — Clone the Repository

```bash
gh auth login
cd Desktop
git clone https://github.com/khanalayush619/NLP-based-resume-system.git
cd NLP-based-resume-system
git checkout dev
git pull origin dev
```

Create your own branch:
```bash
git checkout -b feat/yourname
git push origin feat/yourname
```

---

## Step 2 — Database Setup (Shared Supabase)

This project uses a **shared Supabase database** — no local PostgreSQL needed.

Ask Ayush for the `DATABASE_URL` connection string (sent privately via WhatsApp, never committed to GitHub) or you can use your own.

---

## Step 3 — Backend Setup

```bash
cd backend
npm install
```

Create a file `backend/.env`:

```dotenv
PORT=3000
DATABASE_URL=postgresql://postgres.xxxxx:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
JWT_SECRET=nlp_resume_system_secret_key_2026
JWT_EXPIRES_IN=24h
PYTHON_SERVICE_URL=http://localhost:8000
SMTP_USER=yourprojectemail@gmail.com
SMTP_PASS=your_gmail_app_password
```

Ask Ayush for the actual `DATABASE_URL`, `SMTP_USER`, and `SMTP_PASS` values or use your own email for individual testing.

Run:
```bash
npm run dev
```

Should show:
Server running on port 3000

---

## Step 4 — NLP Service Setup

```bash
cd nlp-service
pip install -r requirements.txt --break-system-packages
python -m spacy download en_core_web_sm
```

Make sure these files exist (already in repo):
nlp-service/model.pkl

nlp-service/vectorizer.pkl

nlp-service/label_encoder.pkl

Run:
```bash
python -m uvicorn main:app --reload --port 8000
```

Should show:
Uvicorn running on http://127.0.0.1:8000

Verify at: http://localhost:8000/health
```json
{"status": "ok", "model": "sentence-transformers + SVM"}
```

---

## Step 5 — Frontend Setup

```bash
cd frontend
npm install
```

Create a file `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Run:
```bash
npm run dev
```

Should show:
Local: http://localhost:5173/

---

## Step 6 — Run the Full System

Open **3 separate terminals** in VS Code:

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend  
cd frontend
npm run dev

# Terminal 3 — NLP Service
cd nlp-service
python -m uvicorn main:app --reload --port 8000
```

Open browser: http://localhost:5173

---

## Test Accounts
If you are using your own database then u have to manually add test accounts else u can use the list below.

| Email | Password | Role |
|-------|----------|------|
| ram@test.com | test123456 | Job Seeker |
| sita@test.com | test123456 | Job Seeker |
| hari@test.com | test123456 | Job Seeker |
| technepal@test.com | test123456 | Organisation |
| himalayan@test.com | test123456 | Organisation |

---

## Testing the Full Flow

**As Job Seeker:**
1. Login with `ram@test.com`
2. Click **Upload CV** → upload a PDF or DOCX resume
3. Dashboard shows extracted skills and CV category

**As Organisation:**
1. Login with `technepal@test.com`
2. Click **Post a Job** → fill form with a detailed job description
3. System automatically matches against all uploaded CVs
4. Eligible candidates (score ≥ 65%) appear in ranked list
5. Eligible job seekers receive an email notification

**Check match scores:**
- Job seeker dashboard shows match percentage and missing skills
- Organisation dashboard shows ranked candidates list

---

## Branch Strategy
main     ← stable, demo-ready code only

dev      ← shared integration branch

feat/*   ← individual feature branches

Rules:
- Always branch off `dev`, never `main`
- Open a Pull Request into `dev` when a feature is done
- Only Ayush merges `dev` into `main` at milestones
- Never push `node_modules`, `.env`, or uploaded files to GitHub

---

## Troubleshooting

**Backend won't start:**
- Check `backend/.env` exists with correct `DATABASE_URL`
- Run `npm install` again

**NLP service crashes:**
- Make sure `model.pkl`, `vectorizer.pkl`, `label_encoder.pkl` exist in `nlp-service/`
- Run `python -m spacy download en_core_web_sm`

**Frontend shows network error:**
- Check backend is running on port 3000
- Check `frontend/.env` has correct `VITE_API_URL`

**CV upload fails:**
- Make sure NLP service is running on port 8000
- Check `backend/.env` has `PYTHON_SERVICE_URL=http://localhost:8000`

**No email received:**
- Check Gmail App Password is correct in `backend/.env`
- Check spam folder
- Match score must be ≥ 65% to trigger email

---

## Project Structure
NLP-based-resume-system/

frontend/        ← React application (Vite + Tailwind)

backend/         ← Node.js/Express REST API

nlp-service/     ← Python FastAPI NLP microservice

database/        ← SQL schema and helper functions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Axios |
| Backend | Node.js, Express.js, JWT, bcrypt, Nodemailer |
| NLP Service | Python, FastAPI, spaCy, scikit-learn, sentence-transformers |
| Database | PostgreSQL (Supabase, shared) |

---
