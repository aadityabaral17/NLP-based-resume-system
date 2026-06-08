# Frequency of skills based on job market data
# Higher number = more in demand
SKILL_FREQUENCY = {
    "python": 95,
    "sql": 90,
    "machine learning": 88,
    "git": 87,
    "javascript": 85,
    "docker": 85,
    "aws": 82,
    "react": 80,
    "postgresql": 78,
    "rest api": 78,
    "node": 75,
    "linux": 74,
    "deep learning": 72,
    "tensorflow": 70,
    "pandas": 70,
    "numpy": 68,
    "scikit-learn": 67,
    "java": 65,
    "mongodb": 63,
    "fastapi": 62,
    "django": 60,
    "flask": 58,
    "typescript": 57,
    "agile": 55,
    "scrum": 53,
    "teamwork": 50,
    "communication": 48,
    "leadership": 46,
    "project management": 45,
    "data analysis": 44,
    "nlp": 42,
    "pytorch": 40,
    "graphql": 35,
    "html": 33,
    "css": 30,
    "excel": 28,
    "powerpoint": 20,
    "azure": 75,
    "kubernetes": 70,
    "ci/cd": 65,
}

def get_priority(frequency: int) -> str:
    """Convert frequency to priority level"""
    if frequency >= 75:
        return "HIGH"
    elif frequency >= 50:
        return "MEDIUM"
    else:
        return "LOW"

def get_skill_recommendations(missing_skills: list) -> list:
    """
    Takes missing skills list and returns
    frequency-weighted recommendations sorted by importance
    """
    recommendations = []

    for skill in missing_skills:
        frequency = SKILL_FREQUENCY.get(skill, 30)  # default 30 if not found
        priority = get_priority(frequency)
        recommendations.append({
            "skill": skill,
            "frequency": frequency,
            "priority": priority
        })

    # Sort by frequency — highest first
    recommendations.sort(key=lambda x: x["frequency"], reverse=True)

    return recommendations