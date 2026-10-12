import cohere
import logging
from app.core.config import COHERE_API_KEY

logger = logging.getLogger(__name__)

MODEL_NAME = "rerank-multilingual-v3.0"

client = cohere.Client(api_key=COHERE_API_KEY)


def rerank(query: str, results: list, top_k: int = 5):
    if not results:
        return []

    documents = [
        f"Video: {result.payload.get('video_title', '')}\nTranscript: {result.payload.get('text', '')}"
        for result in results
    ]

    try:
        response = client.rerank(
            model=MODEL_NAME,
            query=query,
            documents=documents,
            top_n=min(top_k, len(documents)),
        )

        reranked = [
            (results[item.index], item.relevance_score)
            for item in response.results
        ]
        return reranked

    except Exception as e:
        logger.error(f"Cohere rerank failed: {e}. Falling back to original order.")
        return [(result, 1.0) for result in results[:top_k]]