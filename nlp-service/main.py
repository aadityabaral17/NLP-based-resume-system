from fastapi import FastAPI, UploadFile, File, Form
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import pickle
import pdfplumber
import docx
import spacy
import io
import re
import requests
import torch
from transformers import BertTokenizer, BertForSequenceClassification

app = FastAPI()

# ─── Load models ─────────────────────────────────────
print("Loading spaCy model...")
nlp = spacy.load("en_core_web_sm")

print("Loading sentence transformer model...")
sentence_model = SentenceTransformer('all-MiniLM-L6-v2')

print("Loading fine-tuned BERT classifier...")

if torch.cuda.is_available():
    bert_device = "cuda"
    print(f"BERT using CUDA GPU: {torch.cuda.get_device_name(0)}")
elif torch.backends.mps.is_available():
    bert_device = "mps"
    print("BERT using Apple Silicon MPS")
else:
    bert_device = "cpu"
    print("BERT using CPU")

bert_tokenizer = BertTokenizer.from_pretrained("./bert_resume_model")
bert_model = BertForSequenceClassification.from_pretrained("./bert_resume_model")
bert_model.to(bert_device)
bert_model.eval()

with open("bert_label_encoder.pkl", "rb") as f:
    bert_label_encoder = pickle.load(f)

print("BERT classifier loaded successfully!")

# ─── Skills list ─────────────────────────────────────
SKILLS_LIST = [
    "python", "java", "javascript", "typescript", "c++", "c#", "php",
    "ruby", "swift", "kotlin", "go", "rust", "scala", "r", "matlab",
    "html", "css", "react", "angular", "vue", "node", "express",
    "django", "flask", "fastapi", "spring", "laravel", "next.js",
    "tailwind", "bootstrap", "jquery", "webpack", "vite",
    "sql", "postgresql", "mysql", "mongodb", "redis", "sqlite",
    "oracle", "cassandra", "elasticsearch", "firebase",
    "aws", "azure", "gcp", "docker", "kubernetes", "jenkins",
    "git", "github", "gitlab", "linux", "nginx", "terraform",
    "machine learning", "deep learning", "nlp", "data analysis",
    "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy",
    "matplotlib", "data science", "computer vision", "opencv",
    "visual studio code", "postman", "figma", "jira",
    "rest api", "graphql", "microservices", "agile", "scrum",
    "communication", "leadership", "teamwork", "project management"
]

# ─── Skill aliases ──────────────────────────────────────
SKILL_ALIASES = {
    "golang": "go",
    "go lang": "go",
    "r programming": "r",
    "r language": "r",
    "reactjs": "react",
    "react.js": "react",
    "vuejs": "vue",
    "vue.js": "vue",
    "nodejs": "node",
    "node.js": "node",
    "nextjs": "next.js",
    "next js": "next.js",
    "postgres": "postgresql",
    "mongo": "mongodb",
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "ml": "machine learning",
    "dl": "deep learning",
    "cv": "computer vision",
}

def normalize_skill(skill: str) -> str:
    skill_lower = skill.lower().strip()
    return SKILL_ALIASES.get(skill_lower, skill_lower)

# ─── Skill implication map ─────────────────────────────
SKILL_IMPLICATIONS = {
    "react": ["javascript", "html", "css"],
    "next.js": ["react", "javascript", "html", "css"],
    "vue": ["javascript", "html", "css"],
    "angular": ["javascript", "html", "css", "typescript"],
    "django": ["python"],
    "flask": ["python"],
    "fastapi": ["python"],
    "express": ["node", "javascript"],
    "node": ["javascript"],
    "spring": ["java"],
    "laravel": ["php"],
    "tensorflow": ["python"],
    "pytorch": ["python"],
    "scikit-learn": ["python"],
    "pandas": ["python"],
    "numpy": ["python"],
    "react native": ["react", "javascript"],
    "tailwind": ["css", "html"],
    "bootstrap": ["css", "html"],
}

def expand_implied_skills(skills: list) -> list:
    """Given a list of explicit skills, add any skills implied by them."""
    skills_lower = set(normalize_skill(s) for s in skills)
    expanded = set(skills_lower)
    for skill in skills_lower:
        if skill in SKILL_IMPLICATIONS:
            expanded.update(SKILL_IMPLICATIONS[skill])
    return list(expanded)

# ─── Section headers ──────────────────────────────────
SECTION_HEADERS = {
    "skills": [
        "skill", "technical skill", "core competenc",
        "technology", "tools", "expertise", "proficienc"
    ],
    "projects": [
        "project", "personal project", "academic project",
        "work project", "portfolio", "development"
    ],
    "experience": [
        "experience", "work experience", "employment",
        "work history", "professional experience", "internship"
    ],
    "education": [
        "education", "academic", "qualification",
        "degree", "certification", "course"
    ],
    "summary": [
        "summary", "objective", "profile",
        "about", "introduction", "overview"
    ]
}

# ─── Category-aware section weighting ─────────────────
TECHNICAL_CATEGORIES = {
    "Information Technology", "Data Science", "DevOps", "Database",
    "Java Developer", "Python Developer", "React Developer",
    "DotNet Developer", "ETL Developer", "SQL Developer",
    "SAP Developer", "Network Security Engineer", "Testing",
    "Web Designing", "Designing", "Digital Media", "Blockchain",
    "Civil Engineer", "Electrical Engineering", "Mechanical Engineer",
    "Architecture", "Business Analyst"
}

def get_section_weights(predicted_category: str) -> dict:
    """Technical/project-based categories weight Projects highest.
    Experience-based professions (Teacher, Advocate, Agriculture, etc.)
    weight Experience highest instead, since they rarely have a
    'Projects' section in the conventional sense."""
    if predicted_category in TECHNICAL_CATEGORIES:
        return {"skills": 0.25, "projects": 0.40, "experience": 0.20, "summary": 0.15}
    else:
        return {"skills": 0.25, "projects": 0.10, "experience": 0.40, "summary": 0.25}

# ─── Helper functions ─────────────────────────────────
def extract_text_from_file(contents: bytes, filename: str) -> str:
    text = ""
    if filename.endswith(".pdf"):
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
    elif filename.endswith(".docx"):
        document = docx.Document(io.BytesIO(contents))
        for para in document.paragraphs:
            text += para.text + "\n"
    return text

def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = re.sub(r'http\S+|www\S+', '', text)
    text = re.sub(r'\S+@\S+', '', text)
    text = re.sub(r'[^a-zA-Z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.lower()
    doc = nlp(text)
    tokens = [
        token.lemma_
        for token in doc
        if not token.is_stop
        and not token.is_punct
        and not token.is_space
        and len(token.text) > 2
    ]
    return " ".join(tokens)

def extract_skills(text: str) -> list:
    text_lower = text.lower()
    found = []
    for skill in SKILLS_LIST:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            found.append(skill)
    for alias, canonical in SKILL_ALIASES.items():
        pattern = r'\b' + re.escape(alias) + r'\b'
        if re.search(pattern, text_lower) and canonical not in found:
            found.append(canonical)
    return found

def extract_entities(text: str) -> dict:
    doc = nlp(text)
    entities = {
        "names": [], "organizations": [],
        "locations": [], "dates": [], "other": []
    }
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            entities["names"].append(ent.text)
        elif ent.label_ == "ORG":
            entities["organizations"].append(ent.text)
        elif ent.label_ in ["GPE", "LOC"]:
            entities["locations"].append(ent.text)
        elif ent.label_ == "DATE":
            entities["dates"].append(ent.text)
        else:
            entities["other"].append(ent.text)
    return entities

def classify_resume(text: str) -> str:
    encoded = bert_tokenizer(
        text,
        truncation=True,
        padding="max_length",
        max_length=256,
        return_tensors="pt"
    )
    input_ids = encoded["input_ids"].to(bert_device)
    attention_mask = encoded["attention_mask"].to(bert_device)

    with torch.no_grad():
        outputs = bert_model(input_ids=input_ids, attention_mask=attention_mask)

    predicted_id = outputs.logits.argmax(dim=1).cpu().numpy()
    category = bert_label_encoder.inverse_transform(predicted_id)[0]
    return category

def extract_sections(text: str) -> dict:
    sections = {
        "skills": "",
        "projects": "",
        "experience": "",
        "education": "",
        "summary": "",
        "other": ""
    }
    lines = text.split('\n')
    current_section = "other"
    for line in lines:
        line_lower = line.lower().strip()
        detected = False
        for section, keywords in SECTION_HEADERS.items():
            if any(kw in line_lower for kw in keywords):
                if len(line_lower) < 50:
                    current_section = section
                    detected = True
                    break
        if not detected:
            sections[current_section] += line + "\n"
    return sections

def semantic_similarity(text1: str, text2: str) -> float:
    """Compute semantic similarity using sentence transformers"""
    if not text1.strip() or not text2.strip():
        return 0.0
    embeddings = sentence_model.encode([text1, text2])
    sim = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
    return float(sim)

# ─── API Endpoints ────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "model": "sentence-transformers + fine-tuned BERT"}

@app.post("/api/parse/cv")
async def parse_resume(file: UploadFile = File(...)):
    contents = await file.read()
    if not (file.filename.endswith(".pdf") or file.filename.endswith(".docx")):
        return {"error": "Only PDF or DOCX files supported"}

    raw_text = extract_text_from_file(contents, file.filename)
    cleaned_text = clean_text(raw_text)
    skills = extract_skills(raw_text)
    entities = extract_entities(raw_text)
    category = classify_resume(raw_text)
    sections = extract_sections(raw_text)

    return {
        "filename": file.filename,
        "raw_text": raw_text,
        "cleaned_text": cleaned_text,
        "skills": skills,
        "entities": entities,
        "predicted_category": category,
        "sections": {
            "skills":     sections["skills"][:200],
            "projects":   sections["projects"][:200],
            "experience": sections["experience"][:200],
            "summary":    sections["summary"][:200]
        },
        "word_count": len(raw_text.split())
    }

@app.post("/api/parse/job")
async def parse_job(data: dict):
    description = data.get("description", "")
    title = data.get("title", "")
    full_text = description + " " + title
    cleaned = clean_text(full_text)
    skills = extract_skills(full_text)
    return {
        "required_skills": skills,
        "experience_level": "Entry Level",
        "cleaned_text": cleaned
    }

@app.post("/api/match")
async def match_cv_job(data: dict):
    cv_text          = data.get("cv_text", "")
    job_description  = data.get("job_description", "")
    cv_skills        = data.get("skills", [])
    required_skills  = data.get("required_skills", [])

    cv_category = classify_resume(cv_text)
    weights = get_section_weights(cv_category)

    sections = extract_sections(cv_text)

    skills_sim   = semantic_similarity(sections["skills"],   job_description)
    projects_sim = semantic_similarity(sections["projects"], job_description)
    exp_sim      = semantic_similarity(sections["experience"], job_description)
    summary_sim  = semantic_similarity(sections["summary"],  job_description)
    full_sim     = semantic_similarity(cv_text,              job_description)

    section_score = (
        skills_sim   * weights["skills"] +
        projects_sim * weights["projects"] +
        exp_sim      * weights["experience"] +
        summary_sim  * weights["summary"]
    )

    if section_score < 0.01:
        section_score = full_sim

    cv_skills_lower       = expand_implied_skills(cv_skills)
    required_skills_lower = [normalize_skill(s) for s in required_skills]

    if required_skills_lower:
        matched        = [s for s in required_skills_lower if s in cv_skills_lower]
        skill_overlap  = len(matched) / len(required_skills_lower)
        missing_skills = [s for s in required_skills_lower
                         if s not in cv_skills_lower]
    else:
        skill_overlap  = 1.0
        missing_skills = []

    composite_score = (section_score * 0.40) + (skill_overlap * 0.60)
    is_eligible     = composite_score >= 0.65

    return {
        "cosine_similarity": float(full_sim),
        "section_scores": {
            "skills":     float(skills_sim),
            "projects":   float(projects_sim),
            "experience": float(exp_sim),
            "summary":    float(summary_sim)
        },
        "section_score":   float(section_score),
        "skill_overlap":   float(skill_overlap),
        "final_score":     float(composite_score),
        "missing_skills":  missing_skills,
        "is_eligible":     bool(is_eligible),
        "cv_category":     cv_category
    }

@app.post("/api/match/batch")
async def match_batch(files: list[UploadFile] = File(...), job_description: str = Form(...)):
    results = []

    for file in files:
        try:
            contents = await file.read()
            if not (file.filename.endswith(".pdf") or file.filename.endswith(".docx")):
                results.append({
                    "filename": file.filename,
                    "error": "Unsupported file type"
                })
                continue

            raw_text = extract_text_from_file(contents, file.filename)
            skills = extract_skills(raw_text)
            category = classify_resume(raw_text)
            weights = get_section_weights(category)
            sections = extract_sections(raw_text)

            skills_sim = semantic_similarity(sections["skills"], job_description)
            projects_sim = semantic_similarity(sections["projects"], job_description)
            exp_sim = semantic_similarity(sections["experience"], job_description)
            summary_sim = semantic_similarity(sections["summary"], job_description)
            full_sim = semantic_similarity(raw_text, job_description)

            section_score = (
                skills_sim * weights["skills"] +
                projects_sim * weights["projects"] +
                exp_sim * weights["experience"] +
                summary_sim * weights["summary"]
            )
            if section_score < 0.01:
                section_score = full_sim

            required_skills = extract_skills(job_description)
            cv_skills_lower = expand_implied_skills(skills)
            required_skills_lower = [normalize_skill(s) for s in required_skills]

            if required_skills_lower:
                matched = [s for s in required_skills_lower if s in cv_skills_lower]
                skill_overlap = len(matched) / len(required_skills_lower)
                missing_skills = [s for s in required_skills_lower if s not in cv_skills_lower]
            else:
                skill_overlap = 1.0
                missing_skills = []

            composite_score = (section_score * 0.40) + (skill_overlap * 0.60)

            results.append({
                "filename": file.filename,
                "candidate_name": sections.get("summary", "")[:50] or file.filename,
                "predicted_category": category,
                "skills": skills,
                "missing_skills": missing_skills,
                "final_score": float(composite_score),
                "skill_overlap": float(skill_overlap),
                "section_score": float(section_score),
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e)
            })

    results.sort(key=lambda r: r.get("final_score", -1), reverse=True)

    return {"results": results, "count": len(results)}
