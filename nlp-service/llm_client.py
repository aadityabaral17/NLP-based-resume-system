"""Single place where this project talks to an LLM.

Everything goes through here so the model, the address and the timeouts can be
changed in one file (or by environment variable) instead of being scattered
across endpoints.

Configuration (all optional, sensible defaults for LM Studio):
    LLM_BASE_URL   default http://127.0.0.1:1234/v1
    LLM_MODEL      default qwen/qwen3-4b-2507
    LLM_TIMEOUT    default 120   (seconds)
    LLM_ENABLED    set to "0" to switch the LLM off completely

Design rules:
  * Never raise. If the LLM is unreachable or replies with nonsense, return
    None and let the caller fall back to the classical path. The service must
    keep working when LM Studio is closed.
  * Always ask for JSON using a schema. Parsing free text with regular
    expressions is what broke the previous career-tips feature.
  * Strip <think> blocks, in case a reasoning model is loaded by mistake.
"""

import json
import os
import re
import time

import requests

BASE_URL = os.getenv("LLM_BASE_URL", "http://127.0.0.1:1234/v1").rstrip("/")
MODEL = os.getenv("LLM_MODEL", "qwen/qwen3-4b-2507")
TIMEOUT = float(os.getenv("LLM_TIMEOUT", "120"))
ENABLED = os.getenv("LLM_ENABLED", "1") != "0"

# availability is cached so a closed LM Studio does not add a network
# round-trip to every single request
_available_cache = {"value": None, "checked_at": 0.0}
_CACHE_SECONDS = 30.0

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def is_available(force: bool = False) -> bool:
    """True if an LLM server is reachable. Result cached for 30 seconds."""
    if not ENABLED:
        return False

    now = time.time()
    if not force and _available_cache["value"] is not None:
        if now - _available_cache["checked_at"] < _CACHE_SECONDS:
            return _available_cache["value"]

    try:
        response = requests.get(f"{BASE_URL}/models", timeout=3)
        ok = response.status_code == 200
    except Exception:
        ok = False

    _available_cache["value"] = ok
    _available_cache["checked_at"] = now
    return ok


def _strip_think(text: str) -> str:
    return _THINK_RE.sub("", text).strip()


def _extract_json(text: str):
    """Parse JSON, tolerating markdown fences or leading prose."""
    text = _strip_think(text)
    if not text:
        return None

    # strip ```json ... ``` fences
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # last resort: first {...} or [...] block in the reply
    match = re.search(r"[\{\[].*[\}\]]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # the reply ran into max_tokens and was cut off mid-array. Salvage the
    # elements that did arrive complete rather than throwing the whole lot away.
    if text.lstrip().startswith("["):
        items = re.findall(r'"((?:[^"\\]|\\.)*)"', text)
        if items:
            return [json.loads(f'"{item}"') for item in items]

    return None


def chat_json(
    system: str,
    user: str,
    max_tokens: int = 400,
    temperature: float = 0.2,
    expect: str = "object",
):
    """Send a prompt and return the parsed JSON reply, or None on any failure.

    Note on structured output: LM Studio accepts an OpenAI-style
    `response_format: json_schema` and answers HTTP 200, but the MLX backend
    does not actually constrain generation to the schema — it happily returns a
    completely different shape. So correctness is enforced here instead, by
    asking for one simple shape in the prompt (with an example) and validating
    the reply in llm_tasks.py. Keep the requested shape flat; nested objects
    are markedly less reliable on a 4B model.
    """
    if not is_available():
        return None

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    try:
        response = requests.post(
            f"{BASE_URL}/chat/completions",
            json=payload,
            timeout=TIMEOUT,
        )

        # If the server has structured output switched on it refuses any
        # request without a schema ("JSON schema is missing in json-mode
        # request"). Whether that toggle is on is a setting in the LM Studio
        # UI, not something this service can see, so retry once with a
        # permissive schema rather than letting a UI switch silently disable
        # every LLM feature.
        if response.status_code == 400 and "schema" in response.text.lower():
            # LM Studio requires "type" to be a single string, so the caller
            # tells us which shape this particular prompt asks for.
            retry = dict(payload)
            retry["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "response",
                    "schema": {"type": "array", "items": {"type": "string"}}
                    if expect == "array"
                    else {"type": "object"},
                },
            }
            response = requests.post(
                f"{BASE_URL}/chat/completions",
                json=retry,
                timeout=TIMEOUT,
            )

        if response.status_code != 200:
            print(f"[llm] HTTP {response.status_code}: {response.text[:200]}")
            return None

        content = response.json()["choices"][0]["message"]["content"]
        parsed = _extract_json(content)
        if parsed is None:
            print(f"[llm] could not parse JSON from: {content[:200]}")
        return parsed

    except Exception as exc:
        print(f"[llm] request failed: {exc}")
        return None


def info() -> dict:
    """Small summary for the /health endpoint."""
    return {
        "enabled": ENABLED,
        "available": is_available(),
        "base_url": BASE_URL,
        "model": MODEL,
    }
