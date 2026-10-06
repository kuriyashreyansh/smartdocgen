import json, time
from openai import OpenAI
from app.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL

client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)

def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return text.strip()

def ask_json(system: str, user: str, retries: int = 2) -> dict:
    for attempt in range(retries + 1):
        try:
            resp = client.chat.completions.create(
                model=LLM_MODEL,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            return json.loads(_strip_fences(resp.choices[0].message.content))
        except Exception:
            if attempt == retries:
                raise
            time.sleep(1.5)

def ask_text(system: str, user: str, max_tokens: int = 600) -> str:
    resp = client.chat.completions.create(
        model=LLM_MODEL, temperature=0.4, max_tokens=max_tokens,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
    )
    return resp.choices[0].message.content.strip()