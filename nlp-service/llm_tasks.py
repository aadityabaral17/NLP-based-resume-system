"""The three LLM jobs in this project: find skills, write tips, explain a score.

Each function returns None when the LLM is unavailable or its answer cannot be
trusted, so every caller can fall back to the existing classical result.

Two safety rules are applied here rather than in the prompts, because a prompt
is a request and a check is a guarantee:

  * PII redaction  - names, emails, phone numbers and URLs are removed before
    any text is sent to the model. This is a hiring system; the model should
    judge skills, not people.
  * Grounding      - a skill is only accepted if it actually appears in the CV
    text. Language models invent plausible things, and an invented skill could
    get someone shortlisted for a job they cannot do.
"""

import re

import llm_client

MAX_CV_CHARS = 6000  # keep prefill fast and stay well inside an 8k context

_EMAIL_RE = re.compile(r"\S+@\S+")
_URL_RE = re.compile(r"(https?://\S+|www\.\S+)")
_PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")


def _first_lines(text: str, count: int = 2) -> str:
    """The top of the CV, where the candidate's name normally sits."""
    return "\n".join(text.splitlines()[:count]).lower()


def redact_pii(text: str, person_names=None) -> str:
    """Remove obvious identifying details before sending text to the LLM.

    Deliberately conservative about names. spaCy's NER labels plenty of
    technologies as PERSON — Airflow, Django, Jenkins, Kafka, Grafana — and
    blindly deleting every PERSON entity would erase exactly the skills we are
    trying to extract. So a name is only removed when it looks like a real
    candidate name: several words, or a single word sitting in the CV header.
    """
    if not text:
        return ""

    text = _EMAIL_RE.sub("[EMAIL]", text)
    text = _URL_RE.sub("[URL]", text)
    text = _PHONE_RE.sub("[PHONE]", text)

    header = _first_lines(text)

    for name in person_names or []:
        name = (name or "").strip()
        if len(name) < 3:
            continue

        words = [w for w in re.findall(r"[A-Za-z]+", name) if len(w) >= 3]
        looks_like_full_name = len(words) >= 2

        # a single-word PERSON is only treated as a name when it sits at the
        # very top of the CV; anywhere else it is far more likely a technology
        if not looks_like_full_name and name.lower() not in header:
            continue

        text = re.sub(re.escape(name), "[NAME]", text, flags=re.IGNORECASE)

        # also drop the separate first/last names, but only in the top lines
        if looks_like_full_name:
            lines = text.splitlines()
            top, rest = lines[:2], lines[2:]
            joined = "\n".join(top)
            for word in words:
                if word.lower() in header:
                    joined = re.sub(
                        r"\b" + re.escape(word) + r"\b",
                        "[NAME]",
                        joined,
                        flags=re.IGNORECASE,
                    )
            text = "\n".join([joined] + rest)

    return text


def _appears_in(skill: str, haystack: str) -> bool:
    """True if the skill is really present in the CV text."""
    skill = skill.strip().lower()
    if not skill:
        return False
    if skill in haystack:
        return True

    # tolerate punctuation differences: "node.js" vs "nodejs", "c++" vs "c"
    squashed = re.sub(r"[^a-z0-9]", "", skill)
    if len(squashed) >= 2 and squashed in re.sub(r"[^a-z0-9]", "", haystack):
        return True

    # the model often expands a name the CV writes short: it answers
    # "apache airflow" where the CV only says "Airflow", or "microsoft excel"
    # for "Excel". Accept when the distinctive last word is genuinely present.
    words = skill.split()
    if len(words) > 1 and len(words[-1]) >= 4:
        if re.search(r"\b" + re.escape(words[-1]) + r"\b", haystack):
            return True

    return False


# ─── 1. Skill extraction ──────────────────────────────
_SKILLS_SYSTEM = (
    "You extract skills from CVs. "
    "Output ONLY a JSON array of short lowercase skill names. "
    "No descriptions. No explanation. No markdown. "
    "Only include a skill if the CV clearly shows it — never guess. "
    "Include technical skills, tools and professional skills. "
    "At most 30 skills.\n"
    'Example output: ["python","docker","aws","team leadership"]'
)


def extract_skills(cv_text: str, person_names=None):
    """Open-vocabulary skill extraction. Returns a list, or None on failure.

    Unlike the fixed SKILLS_LIST this can find any skill, but every returned
    skill is checked against the CV text before being accepted.
    """
    if not cv_text or not cv_text.strip():
        return None

    safe_text = redact_pii(cv_text, person_names)[:MAX_CV_CHARS]

    result = llm_client.chat_json(
        system=_SKILLS_SYSTEM,
        user=f"CV:\n{safe_text}",
        max_tokens=500,
        temperature=0.1,
        expect="array",
    )

    # accept a bare array, or an object the model wrapped it in
    if isinstance(result, dict):
        for value in result.values():
            if isinstance(value, list):
                result = value
                break
        else:
            result = list(result.keys())  # {"python": "...", "docker": "..."}
    if not isinstance(result, list):
        return None

    haystack = cv_text.lower()
    accepted, seen = [], set()
    for raw in result:
        if not isinstance(raw, str):
            continue
        skill = raw.strip().lower()
        if not skill or len(skill) > 40 or skill in seen:
            continue
        if _appears_in(skill, haystack):  # grounding check
            accepted.append(skill)
            seen.add(skill)

    return accepted


# ─── 1b. Job description parsing ──────────────────────
# This must use the same extractor as the CV side. If CVs are read with an
# open vocabulary but jobs are still read with the 80-word SKILLS_LIST, the
# denominator of skill_overlap stays tiny while the candidate's skill set grows,
# and every candidate scores high for the wrong reason. skill_overlap is 60% of
# the final score, so the two sides have to be measured the same way.

EXPERIENCE_LEVELS = ["Internship", "Entry Level", "Mid Level", "Senior Level"]

_JOB_SYSTEM = (
    "You read job adverts. "
    "Output ONLY a JSON object with keys \"required_skills\" and "
    "\"experience_level\". No markdown, no explanation.\n"
    "\"required_skills\": array of at most 12 short lowercase skill names, the "
    "ones the advert actually asks for. Only skills named in the advert.\n"
    "\"experience_level\": exactly one of "
    "\"Internship\", \"Entry Level\", \"Mid Level\", \"Senior Level\".\n"
    'Example output: {"required_skills":["python","sql","airflow"],'
    '"experience_level":"Mid Level"}'
)


def parse_job(title: str, description: str):
    """Required skills and seniority for one job advert.

    Returns None on failure so the caller keeps the classical result.
    Skills are capped at 12: a long list would make skill_overlap almost
    impossible to satisfy and would push every candidate's score down.
    """
    full_text = f"{title or ''}\n{description or ''}".strip()
    if not full_text:
        return None

    result = llm_client.chat_json(
        system=_JOB_SYSTEM,
        user=f"Job title: {title or 'not given'}\n\nAdvert:\n{description or ''}"[:MAX_CV_CHARS],
        max_tokens=300,
        temperature=0.1,
    )
    if not isinstance(result, dict):
        return None

    raw_skills = result.get("required_skills")
    if not isinstance(raw_skills, list):
        return None

    haystack = full_text.lower()
    skills, seen = [], set()
    for raw in raw_skills:
        if not isinstance(raw, str):
            continue
        skill = raw.strip().lower()
        if not skill or len(skill) > 40 or skill in seen:
            continue
        if _appears_in(skill, haystack):  # same grounding rule as CVs
            skills.append(skill)
            seen.add(skill)

    level = str(result.get("experience_level", "")).strip()
    if level not in EXPERIENCE_LEVELS:
        level = None

    if not skills:
        return None

    return {"required_skills": skills[:12], "experience_level": level}


# ─── 2. Career tips ───────────────────────────────────
_TIPS_SYSTEM = (
    "You are a career advisor. "
    "Output ONLY a JSON array of exactly 3 objects. No markdown, no explanation. "
    "Each object has a \"title\" string and a \"bullets\" array of 2 strings. "
    "Advice must be specific to the candidate's own skills and field — never "
    "generic advice that would suit anybody. Each bullet is under 20 words and "
    "describes one concrete action.\n"
    'Example output: [{"title":"Skill Development","bullets":["Build a REST API '
    'with Flask","Add unit tests with pytest"]}]'
)


def career_tips(category, cv_skills, missing_skills, top_matches):
    """Three career tips grounded in this candidate's real skills."""
    skills_summary = ", ".join(cv_skills[:15]) if cv_skills else "not specified"
    missing_summary = ", ".join(missing_skills[:8]) if missing_skills else "none identified"
    titles = [m.get("job_title", "") for m in (top_matches or [])[:3] if m.get("job_title")]
    matches_summary = ", ".join(titles) if titles else "none yet"

    user = (
        f"Field: {category}\n"
        f"Skills the candidate has: {skills_summary}\n"
        f"Skills often missing in their applications: {missing_summary}\n"
        f"Job titles they match best: {matches_summary}\n\n"
        "Write exactly 3 tips, with these titles in this order: "
        "'Skill Development', 'Job Search Strategy', 'Career Growth'. "
        "Give 2 or 3 bullets for each."
    )

    result = llm_client.chat_json(
        system=_TIPS_SYSTEM,
        user=user,
        max_tokens=450,
        temperature=0.6,
        expect="array",
    )

    if isinstance(result, dict):
        for value in result.values():
            if isinstance(value, list):
                result = value
                break
    if not isinstance(result, list):
        return None

    tips = []
    for tip in result:
        if not isinstance(tip, dict):
            continue
        title = str(tip.get("title", "")).strip()
        bullets = [
            str(b).strip()
            for b in tip.get("bullets", [])
            if isinstance(b, (str, int, float)) and str(b).strip()
        ]
        if title and bullets:
            tips.append({"title": title, "bullets": bullets[:3]})

    return tips or None


# ─── 3. Match explanation ─────────────────────────────
# The model is asked for the sentence ONLY. The strengths and gaps are already
# known exactly — they are the matched and missing skill lists — so they are
# filled in from that data instead of being generated.
#
# This is not hypothetical tidiness. Asked to produce the lists itself, the
# model reported "docker" as a gap for a candidate whose CV listed Docker,
# dropping "terraform" (a real gap) to make room. In a system that ranks people
# for jobs, a confident wrong fact like that is the most damaging thing it can
# produce, so it is not allowed to author them.
_EXPLAIN_SYSTEM = (
    "You explain why a candidate matched a job, for the hiring team. "
    "Output ONLY a JSON object with a single key \"summary\". "
    "No markdown, no text outside the JSON. "
    "\"summary\" is one or two short sentences describing the fit. "
    "Do not repeat the numbers back — the reader can already see them. "
    "Do not list skills; the interface shows them separately. "
    "Base every statement only on the data given; invent nothing.\n"
    'Example output: {"summary":"Solid backend match, weaker on cloud tooling."}'
)


def explain_match(job_title, score, matched_skills, missing_skills, section_scores=None):
    """Short natural-language reason for a match score.

    Deliberately does NOT receive the CV text: the numbers and skill lists are
    enough, and keeping the prompt small keeps this fast (~1.5s).
    """
    sections = ""
    if section_scores:
        sections = "Section similarity: " + ", ".join(
            f"{k} {float(v):.2f}" for k, v in section_scores.items()
        )

    user = (
        f"Job title: {job_title or 'not given'}\n"
        f"Overall match score: {float(score) * 100:.0f}%\n"
        f"Skills the candidate has that the job needs: "
        f"{', '.join(matched_skills) if matched_skills else 'none'}\n"
        f"Skills the job needs that are missing: "
        f"{', '.join(missing_skills) if missing_skills else 'none'}\n"
        f"{sections}\n\n"
        "Write the summary sentence for this match."
    )

    result = llm_client.chat_json(
        system=_EXPLAIN_SYSTEM,
        user=user,
        max_tokens=160,
        temperature=0.3,
    )
    if not isinstance(result, dict) or not str(result.get("summary", "")).strip():
        return None

    # strengths and gaps come from the data, never from the model
    return {
        "summary": str(result["summary"]).strip(),
        "strengths": [str(s).strip() for s in (matched_skills or [])][:5],
        "gaps": [str(g).strip() for g in (missing_skills or [])][:5],
    }
