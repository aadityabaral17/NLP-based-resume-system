from fastapi import FastAPI, UploadFile, File
import pdfplumber
import docx
import spacy
import io

app = FastAPI()
nlp = spacy.load("en_core_web_sm")

# Common skills keyword list
SKILLS_LIST = [
    "python", "java", "javascript", "react", "node", "sql", "postgresql",
    "mongodb", "fastapi", "django", "flask", "machine learning", "deep learning",
    "nlp", "data analysis", "tensorflow", "pytorch", "scikit-learn", "pandas",
    "numpy", "git", "docker", "aws", "linux", "html", "css", "typescript"
]

def extract_text_from_file(contents: bytes, filename: str) -> str:
    """Extract raw text from PDF or DOCX"""
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
    """Stop-word removal + lemmatisation using spaCy"""
    doc = nlp(text.lower())
    tokens = [
        token.lemma_          # lemmatisation — 'running' becomes 'run'
        for token in doc
        if not token.is_stop   # remove stop words — 'the', 'is', 'at'
        and not token.is_punct # remove punctuation
        and not token.is_space # remove extra spaces
        and len(token.text) > 1
    ]
    return " ".join(tokens)

def extract_skills(text: str) -> list:
    """Match skills from text against known skills list"""
    text_lower = text.lower()
    found_skills = []
    for skill in SKILLS_LIST:
        if skill in text_lower:
            found_skills.append(skill)
    return found_skills

def extract_entities(text: str) -> dict:
    """Run spaCy NER to extract named entities"""
    doc = nlp(text)
    entities = {
        "names": [],
        "organizations": [],
        "locations": [],
        "dates": [],
        "other": []
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

@app.post("/api/parse/cv")
async def parse_resume(file: UploadFile = File(...)):

    # Step 1: Read file
    contents = await file.read()

    # Step 2: Extract raw text
    if not (file.filename.endswith(".pdf") or file.filename.endswith(".docx")):
        return {"error": "Only PDF or DOCX files supported"}

    raw_text = extract_text_from_file(contents, file.filename)

    # Step 3: Clean text (stop-word removal + lemmatisation)
    cleaned_text = clean_text(raw_text)

    # Step 4: Extract skills
    skills = extract_skills(raw_text)

    # Step 5: Extract named entities
    entities = extract_entities(raw_text)

    # Step 6: Return structured JSON
    return {
        "filename": file.filename,
        "raw_text": raw_text[:500],        # first 500 chars preview
        "cleaned_text": cleaned_text[:500], # after stop-word removal
        "skills": skills,
        "entities": entities,
        "word_count": len(raw_text.split())
    }

@app.post("/parse/job")
async def parse_job(data: dict):
    description = data.get("description", "")
    title = data.get("title", "")
    
    # Clean text
    cleaned = clean_text(description + " " + title)
    
    # Extract required skills
    skills = extract_skills(description + " " + title)
    
    return {
        "required_skills": skills,
        "experience_level": "Entry Level",
        "cleaned_text": cleaned
    }