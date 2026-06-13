from fastapi import FastAPI, UploadFile, File
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import pickle
import pdfplumber
import docx
import spacy
import io
import re
import numpy as np

app = FastAPI()

# ─── Load models ─────────────────────────────────────
print("Loading spaCy model...")
nlp = spacy.load("en_core_web_sm")

print("Loading sentence transformer model...")
sentence_model = SentenceTransformer('all-MiniLM-L6-v2')

print("Loading trained SVM model...")
with open("model.pkl", "rb") as f:
    svm_model = pickle.load(f)
with open("vectorizer.pkl", "rb") as f:
    tfidf_vectorizer = pickle.load(f)
with open("label_encoder.pkl", "rb") as f:
    label_encoder = pickle.load(f)

print("All models loaded successfully!")

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
    return [skill for skill in SKILLS_LIST if skill in text_lower]

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
    cleaned = clean_text(text)
    vector = tfidf_vectorizer.transform([cleaned])
    prediction = svm_model.predict(vector)
    category = label_encoder.inverse_transform(prediction)[0]
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
    return {"status": "ok", "model": "sentence-transformers + SVM"}

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

    # Extract CV sections
    sections = extract_sections(cv_text)

    # Semantic similarity for each section vs JD
    skills_sim   = semantic_similarity(sections["skills"],   job_description)
    projects_sim = semantic_similarity(sections["projects"], job_description)
    exp_sim      = semantic_similarity(sections["experience"], job_description)
    summary_sim  = semantic_similarity(sections["summary"],  job_description)
    full_sim     = semantic_similarity(cv_text,              job_description)

    # Weighted section score (projects weighted highest)
    section_score = (
        skills_sim   * 0.25 +
        projects_sim * 0.40 +
        exp_sim      * 0.20 +
        summary_sim  * 0.15
    )

    # Fall back to full similarity if sections not detected
    if section_score < 0.01:
        section_score = full_sim

    # Skill overlap
    cv_skills_lower       = [s.lower() for s in cv_skills]
    required_skills_lower = [s.lower() for s in required_skills]

    if required_skills_lower:
        matched        = [s for s in required_skills_lower if s in cv_skills_lower]
        skill_overlap  = len(matched) / len(required_skills_lower)
        missing_skills = [s for s in required_skills_lower
                         if s not in cv_skills_lower]
    else:
        skill_overlap  = 1.0
        missing_skills = []

    # Final composite score
    composite_score = (section_score * 0.40) + (skill_overlap * 0.60)
    is_eligible     = composite_score >= 0.65

    # Classify CV
    cv_category = classify_resume(cv_text)

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