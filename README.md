# ResumeMatch — NLP-Based Resume Screening and Job Matching

A hiring platform that reads CVs, understands what a job advert is asking for, and
ranks candidates against it. Job seekers upload a CV once and see the roles they
actually fit; organisations post a vacancy and get applicants ordered by measured
relevance, each with a written explanation of why.

Built as a final year Computer Engineering project at Pokhara University.

---

## What makes it more than a keyword search

Three models are used, each for the job it is measurably best at.

| Task | Model | Why this one |
|------|-------|--------------|
| Classify a CV into one of 43 job categories | Fine-tuned **BERT** | Closed set of answers. 86.5% accurate at 15 ms. |
| Score CV text against a job description | **all-MiniLM-L6-v2** | Runs on every comparison, so it has to be fast. |
| Extract skills from CVs and job adverts | **Qwen3 4B** (local LLM) | Open set — no fixed list can cover every skill. |
| Write career advice and explain a match | **Qwen3 4B** | Nothing else in the stack can generate language. |

The rule behind that table: **use a trained classifier where the set of possible
answers is closed, and a language model where it is open.** Both halves are backed
by measurements in [`nlp-service/MODEL_COMPARISON_REPORT.md`](nlp-service/MODEL_COMPARISON_REPORT.md).

---

## Measured results

All figures come from the held-out test split of
[ResumeAtlas](https://huggingface.co/datasets/ahmedheakl/resume-atlas)
(13,389 resumes, 43 categories, `test_size=0.2, random_state=42`) and are
reproducible with the evaluation scripts in `nlp-service/`.

### Classification — where the LLM loses

| Model | Accuracy | Macro F1 | ms / resume |
|---|---|---|---|
| TF-IDF + LinearSVC | 83.26% | 0.8290 | 0.5 |
| **Fine-tuned BERT** | **86.51%** | **0.8608** | 15.2 |
| Zero-shot Qwen3 4B | 65.12% | 0.6496 | 1097.8 |

The LLM is 21 points worse and 72× slower. On 10.7% of resumes it answered with a
job title that was not one of the 43 allowed categories — inventing `Retail` and
`Graphic Designer` despite every valid option being listed in the prompt. A trained
classifier cannot make that mistake; its output layer only has 43 classes.

**So BERT stays.**

### Skill extraction — where the LLM wins

| | Fixed 80-word list | Qwen3 4B |
|---|---|---|
| Skills found per CV | 2.7 | **33.2** |
| Valid JSON responses | — | 30/30 |

A 12× increase, and 31.4 of those skills per CV are ones a fixed list could never
contain — `stored procedures`, `financial reporting`, `disaster recovery`,
`team leadership`. This matters because skill overlap is **60% of the final match
score**, so it is the single largest input to the system.

**So the LLM does the extraction.**

---

## Architecture

```
React + Vite  ──►  Express API  ──►  FastAPI (NLP service)  ──►  LM Studio
  port 5173         port 3000            port 8000                port 1234
                        │                    │
                        ▼                    ├── fine-tuned BERT (43 categories)
                   PostgreSQL                ├── all-MiniLM-L6-v2 (similarity)
                   port 5432                 └── spaCy (entities, lemmatisation)
```

Express owns authentication, persistence and business rules. The NLP service is
stateless — text in, JSON out — and can be run and tested on its own.

### How a match is scored

```
final = text_similarity × 0.40  +  skill_overlap × 0.60
```

`text_similarity` is section-weighted: technical CVs weight Projects highest,
experience-led professions weight Experience highest. The weighting preset is chosen
by BERT's predicted category.

---

## Safety and fairness

This system ranks people for jobs, so a confident wrong answer is the most damaging
thing it can produce. Three rules are enforced in code rather than requested in a
prompt:

- **Grounding.** A skill is discarded unless it literally appears in the CV text.
  The model cannot invent qualifications.
- **PII redaction.** Names, emails and phone numbers are stripped before any text
  reaches the model, so it judges skills rather than people.
- **Facts from data, prose from the model.** Match explanations have their strengths
  and gaps filled from the stored match result; the model only writes the summary
  sentence. Asked to produce those lists itself, it once reported `docker` as a gap
  for a candidate whose CV listed Docker.

The LLM is also **optional**. Every feature falls back to the classical path when
LM Studio is not running — no endpoint depends on it.

---

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.12
- Docker (for PostgreSQL) — or any PostgreSQL 14+
- [LM Studio](https://lmstudio.ai) with `qwen/qwen3-4b-2507` — optional, but the
  LLM features are disabled without it

### 1. Database

```bash
docker run -d --name aris-db -e POSTGRES_PASSWORD=aris -e POSTGRES_DB=aris \
  -p 5432:5432 -v aris-pgdata:/var/lib/postgresql/data postgres:16-alpine
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in DATABASE_URL, JWT_SECRET, SMTP settings
node init-db.js           # creates every table, column and index
npm run dev
```

`init-db.js` is idempotent — safe to re-run, and it migrates an existing database
in place.

### 3. NLP service

```bash
cd nlp-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm      # required; the service will not start without it
uvicorn main:app --port 8000
```

The first start takes about 45 seconds while BERT, MiniLM and spaCy load.

> The fine-tuned BERT model (`bert_resume_model/`) is not in the repository because
> of its size. Train it with `python train_bert.py` after
> `python download_dataset.py`, or obtain the trained weights from the team.

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

### 5. LM Studio (optional)

Load `qwen/qwen3-4b-2507`, set context length to 8192, and start the server on port
1234. Verify with:

```bash
curl -s http://localhost:8000/health
```

`"llm": { "available": true }` means the language features are live.

---

## Reproducing the results

```bash
cd nlp-service
python evaluate_bert.py                  # BERT on the full test split
python evaluate_svm_baseline.py          # TF-IDF + SVM on the same split
python evaluate_llm_classification.py 5  # three-way comparison
python evaluate_skill_extraction.py 30   # fixed list vs LLM
```

Each writes a Markdown report next to itself.

---

## Project layout

```
backend/           Express API — auth, jobs, applications, matching, email
  config/          database pool (SSL auto-detected for hosted vs local)
  routes/          one file per resource
  utils/           pure, unit-tested helpers
  init-db.js       schema creation and migrations
frontend/          React + Vite + Tailwind
  src/pages/       one file per screen
  src/components/  shared UI
nlp-service/       FastAPI — BERT, embeddings, spaCy, LLM
  llm_client.py    the only place that talks to the language model
  llm_tasks.py     skill extraction, job parsing, tips, explanations
  evaluate_*.py    reproducible evaluation scripts
database/          reference SQL schema
```

## Tests

```bash
cd backend && npm test
```

34 tests covering job ranking, career-tips caching, dashboard statistics and job
posting rules.

---

## Team

| | |
|---|---|
| [@aadityabaral17](https://github.com/aadityabaral17) | NLP service, LLM integration, model evaluation |
| [@khanalayush619](https://github.com/khanalayush619) | Backend API, database, authentication |
| [@nis6hal](https://github.com/nis6hal) | Frontend, dashboards, UI |

Bachelor of Computer Engineering, Pokhara University.

---

## Notes and limitations

- **Batch ranking uses the classical extractor on both sides.** Running the LLM over
  20 CVs would take about two minutes, so that screen trades accuracy for speed. Its
  scores are not directly comparable with the apply flow.
- **The classification comparison used a 215-resume stratified sample** (5 per
  category), enough to establish a 21-point gap but not for confident per-category
  claims.
- **Zero-shot LLM against a trained BERT is not like-for-like.** It measures whether
  a general model can replace a task-specific one, not which architecture is better.
- The category is used to **rank** vacancies, never to filter them. BERT's recall is
  0.56 for React Developer, and filtering on it hid every relevant job from those
  candidates.
