from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/parse")
def parse_resume():
    return {"message": "Parsing works!", "skills": ["Python", "FastAPI"]}
