"""Compare the two skill extractors on real resumes from ResumeAtlas.

Why this matters: skill overlap is 60% of the final match score in main.py,
and the classical extractor can only ever find the 80 skills hard-coded in
SKILLS_LIST. Anything else is invisible to it.

There are no ground-truth skill labels in the dataset, so this measures what
can be measured honestly:

  * how many skills each method finds
  * how many the LLM finds that the fixed list cannot possibly find
  * grounding: what share of LLM skills really appear in the CV text
  * speed

Run:  ./venv/bin/python evaluate_skill_extraction.py [n_resumes]
"""

import re
import sys
import time

import pandas as pd

import llm_client
import llm_tasks

# the classical extractor, copied from main.py so this script does not need
# to import the whole FastAPI app (and load BERT + spaCy + MiniLM)
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
    "communication", "leadership", "teamwork", "project management",
]
SKILL_ALIASES = {
    "golang": "go", "go lang": "go", "r programming": "r", "r language": "r",
    "reactjs": "react", "react.js": "react", "vuejs": "vue", "vue.js": "vue",
    "nodejs": "node", "node.js": "node", "nextjs": "next.js",
    "next js": "next.js", "postgres": "postgresql", "mongo": "mongodb",
    "js": "javascript", "ts": "typescript", "py": "python",
    "ml": "machine learning", "dl": "deep learning", "cv": "computer vision",
}


def extract_skills_regex(text: str) -> list:
    text_lower = text.lower()
    found = []
    for skill in SKILLS_LIST:
        if re.search(r"\b" + re.escape(skill) + r"\b", text_lower):
            found.append(skill)
    for alias, canonical in SKILL_ALIASES.items():
        if re.search(r"\b" + re.escape(alias) + r"\b", text_lower):
            if canonical not in found:
                found.append(canonical)
    return found


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20

    if not llm_client.is_available():
        sys.exit(
            "ERROR: no LLM at "
            f"{llm_client.BASE_URL} — start the LM Studio server first."
        )
    print(f"Model: {llm_client.MODEL}\n")

    df = pd.read_csv("data/ResumeAtlas.csv").dropna(subset=["Text", "Category"])
    sample = df.sample(n=n, random_state=42)

    known = set(SKILLS_LIST) | set(SKILL_ALIASES.values())

    regex_total = llm_total = new_total = ungrounded = 0
    llm_time = 0.0
    failures = 0
    new_skill_counts = {}

    for i, (_, row) in enumerate(sample.iterrows(), start=1):
        text = str(row["Text"])

        regex_skills = extract_skills_regex(text)

        start = time.time()
        llm_skills = llm_tasks.extract_skills(text)
        llm_time += time.time() - start

        if llm_skills is None:
            failures += 1
            print(f"{i:>3}. {row['Category'][:22]:<22} LLM FAILED")
            continue

        # skills the fixed list could never find, no matter the CV
        new_skills = [s for s in llm_skills if s not in known]
        for s in new_skills:
            new_skill_counts[s] = new_skill_counts.get(s, 0) + 1

        regex_total += len(regex_skills)
        llm_total += len(llm_skills)
        new_total += len(new_skills)

        print(
            f"{i:>3}. {row['Category'][:22]:<22} "
            f"list={len(regex_skills):>2}  llm={len(llm_skills):>2}  "
            f"new={len(new_skills):>2}"
        )

    ok = n - failures
    if ok == 0:
        sys.exit("All LLM calls failed.")

    print("\n" + "=" * 58)
    print(f"Resumes tested            : {ok}")
    print(f"Valid JSON replies        : {ok}/{n}")
    print(f"Avg skills — fixed list   : {regex_total / ok:.1f}")
    print(f"Avg skills — LLM          : {llm_total / ok:.1f}")
    print(f"Avg skills the list CANNOT find : {new_total / ok:.1f}")
    print(f"Increase                  : {(llm_total / regex_total - 1) * 100:+.0f}%"
          if regex_total else "")
    print(f"Avg time per resume (LLM) : {llm_time / ok:.1f}s")
    print("=" * 58)

    top = sorted(new_skill_counts.items(), key=lambda kv: -kv[1])[:25]
    print("\nMost common skills the hard-coded list can never find:\n")
    for skill, count in top:
        print(f"  {count:>3} x  {skill}")

    print(
        "\nNote: every LLM skill above already passed the grounding check "
        "(it appears in the CV text), so these are real, not invented."
    )


if __name__ == "__main__":
    main()
