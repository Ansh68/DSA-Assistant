from groq import Groq
from app.core.config import GROQ_API_KEY


groq_client = Groq(api_key=GROQ_API_KEY)

query_cache = {}

QUERY_PROMPT = """You are a search query optimizer for a DSA YouTube tutorial database with Hindi transcripts.
Extract and output ONLY the concise search keywords for semantic search:
1. Strip all conversational filler words (e.g., 'ko kaise solve karte hai', 'kya hota hai', 'batao', 'kaise karein', 'how to solve', 'explain').
2. Identify the core DSA problem, algorithm, or underlying pattern (e.g., Sliding Window, Two Pointers, Prefix Sum, Kadane, Binary Search, Stack, Linked List).
3. Transcribe technical concepts into Hindi Devanagari phonetics as spoken by instructors (e.g., sliding window -> स्लाइडिंग विंडो, two pointer -> टू पॉइंटर, longest substring -> लॉन्गेस्ट सबस्ट्रिंग, target sum / pair sum -> टार्गेट सम पेयर सम, duplicate / distinct -> डुप्लीकेट डिस्टिंक्ट, prefix sum -> प्रीफिक्स सम).
4. Include both the Devanagari phonetic keywords and the core pattern name.
5. Return ONLY the search keywords, nothing else."""


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