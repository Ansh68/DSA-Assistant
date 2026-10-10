from groq import Groq
from app.core.config import GROQ_API_KEY


groq_client = Groq(api_key=GROQ_API_KEY)

query_cache = {}

QUERY_PROMPT =  """Rewrite the user's question in Hindi Devanagari, exactly as YouTube auto-captions
would write a Hindi speaker saying it. English technical words are spelled phonetically in
Devanagari, for example: two pointer -> टू पॉइंटर, hash map -> हैश मैप,
time complexity -> टाइम कॉम्प्लेक्सिटी, sliding window -> स्लाइडिंग विंडो,
sorted array -> सॉर्टेड एरे. Keep the meaning identical. Return ONLY the rewritten question."""


def normalize_query(query: str):
    if query in query_cache:
        return query_cache[query]

    try:
        response = groq_client.chat.completions.create(
            model = "openai/gpt-oss-120b",
            temperature = 0,
            messages = [
                {
                    "role": "system",
                    "content": QUERY_PROMPT
                },
                {
                    "role": "user",
                    "content": query
                }
            ]
        )

        normalized = (response.choices[0].message.content.strip())

        query_cache[query] = normalized or query

    except Exception as e:
        print(
            f"Query normalization failed: "
            f"{type(e).__name__}: {e}"
        )

        query_cache[query] = query

    return query_cache[query]