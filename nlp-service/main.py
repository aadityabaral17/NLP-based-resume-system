from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
import pdfplumber
import docx
import spacy
import io
from match import compute_match

app = FastAPI()
nlp = spacy.load("en_core_web_sm")

SKILLS_LIST = [
    "python", "java", "javascript", "react", "node", "sql", "postgresql",
    "mongodb", "fastapi", "django", "flask", "machine learning", "deep learning",
    "nlp", "data analysis", "tensorflow", "pytorch", "scikit-learn", "pandas",
    "numpy", "git", "docker", "aws", "linux", "html", "css", "typescript",
    "excel", "powerpoint", "communication", "leadership", "teamwork",
    "project management", "agile", "scrum", "rest api", "graphql"
]

class MatchRequest(BaseModel):
    user_id: int
    cv_text: str
    jd_text: str

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
    doc = nlp(text.lower())
    tokens = [
        token.lemma_
        for token in doc
        if not token.is_stop
        and not token.is_punct
        and not token.is_space
        and len(token.text) > 1
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

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/parse")
async def parse_resume(file: UploadFile = File(...)):
    contents = await file.read()
    if not (file.filename.endswith(".pdf") or file.filename.endswith(".docx")):
        return {"error": "Only PDF or DOCX files supported"}
    raw_text = extract_text_from_file(contents, file.filename)
    cleaned_text = clean_text(raw_text)
    skills = extract_skills(raw_text)
    entities = extract_entities(raw_text)
    return {
        "filename": file.filename,
        "raw_text": raw_text[:500],
        "cleaned_text": cleaned_text[:500],
        "skills": skills,
        "entities": entities,
        "word_count": len(raw_text.split())
    }

@app.post("/match")
def match_resume(request: MatchRequest):
    result = compute_match(
        cv_text=request.cv_text,
        jd_text=request.jd_text,
        user_id=request.user_id
    )
    return result