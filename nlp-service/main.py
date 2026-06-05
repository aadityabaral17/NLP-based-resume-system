from fastapi import FastAPI, UploadFile, File
import pdfplumber
import docx
import spacy
import io

app = FastAPI()
nlp = spacy.load("en_core_web_sm")

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/parse")
async def parse_resume(file: UploadFile = File(...)):
    
    # Step 1: Read the uploaded file
    contents = await file.read()
    text = ""

    # Step 2: Extract text based on file type
    if file.filename.endswith(".pdf"):
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""

    elif file.filename.endswith(".docx"):
        document = docx.Document(io.BytesIO(contents))
        for para in document.paragraphs:
            text += para.text + "\n"

    else:
        return {"error": "Only PDF or DOCX files supported"}

    # Step 3: Run spaCy NLP on extracted text
    doc = nlp(text)

    # Step 4: Extract named entities
    entities = {}
    for ent in doc.ents:
        if ent.label_ not in entities:
            entities[ent.label_] = []
        entities[ent.label_].append(ent.text)

    # Step 5: Return structured response
    return {
        "filename": file.filename,
        "text_preview": text[:300],
        "word_count": len(text.split()),
        "named_entities": entities,
        "skills": ["Python", "FastAPI"],        # hardcoded for now
        "predicted_category": "Data Science",   # SVM will do this later
        "match_score": 0.0                      # cosine similarity later
    }