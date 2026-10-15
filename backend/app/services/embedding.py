from google import genai
from google.genai import types

from app.core.config import GEMINI_API_KEY


MODEL_NAME = "gemini-embedding-001"
EMBEDDING_DIMENSION = 3072

client = genai.Client(api_key=GEMINI_API_KEY)


def create_embedding(text: str) -> list[float]:
    """
    Generate a query embedding using Gemini.

    Must use RETRIEVAL_QUERY because the transcript
    chunks were embedded using RETRIEVAL_DOCUMENT.
    """

    if not text or not text.strip():
        raise ValueError("Query text cannot be empty.")

    response = client.models.embed_content(
        model=MODEL_NAME,
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=EMBEDDING_DIMENSION,
        ),
    )

    if not response.embeddings:
        raise RuntimeError("Gemini returned no embeddings.")

    embedding = response.embeddings[0].values

    if len(embedding) != EMBEDDING_DIMENSION:
        raise RuntimeError(
            f"Expected {EMBEDDING_DIMENSION} dimensions, "
            f"received {len(embedding)}."
        )

    return embedding