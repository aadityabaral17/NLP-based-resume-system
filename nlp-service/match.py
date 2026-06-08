import pickle
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# ── Load trained model and vectorizer ────────────────
with open("model.pkl", "rb") as f:
    model = pickle.load(f)

with open("vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)

# ── Common skills list ────────────────────────────────
SKILLS_LIST = [
    "python", "java", "javascript", "react", "node", "sql", "postgresql",
    "mongodb", "fastapi", "django", "flask", "machine learning", "deep learning",
    "nlp", "data analysis", "tensorflow", "pytorch", "scikit-learn", "pandas",
    "numpy", "git", "docker", "aws", "linux", "html", "css", "typescript",
    "excel", "powerpoint", "communication", "leadership", "teamwork",
    "project management", "agile", "scrum", "rest api", "graphql"
]

def extract_skills(text: str) -> list:
    text_lower = text.lower()
    return [skill for skill in SKILLS_LIST if skill in text_lower]

def compute_match(cv_text: str, jd_text: str, user_id: int = None) -> dict:
    cv_vector = vectorizer.transform([cv_text])
    jd_vector = vectorizer.transform([jd_text])
    similarity = cosine_similarity(cv_vector, jd_vector)[0][0]
    score = round(float(similarity) * 100, 2)
    predicted_category = model.predict(cv_vector)[0]
    cv_skills = set(extract_skills(cv_text))
    jd_skills = set(extract_skills(jd_text))
    missing_skills = list(jd_skills - cv_skills)
    matching_skills = list(cv_skills & jd_skills)
    eligible = score >= 70.0
    return {
        "user_id": user_id,
        "score": score,
        "eligible": eligible,
        "predicted_category": predicted_category,
        "matching_skills": matching_skills,
        "missing_skills": missing_skills,
        "cv_skills": list(cv_skills),
        "jd_skills": list(jd_skills)
    }