from dotenv import load_dotenv

load_dotenv()

from app.services.embedding import create_embedding
from app.services.retriever import retrieve_chunks
from app.core.config import QDRANT_COLLECTION


def test_query(query: str):

    print("\nQuestion:", query)

    embedding = create_embedding(query)

    print("Embedding dimensions:", len(embedding))
    print("Collection:", QDRANT_COLLECTION)

    results = retrieve_chunks(
        query_embedding=embedding,
        limit=5,
    )

    for index, result in enumerate(results, start=1):

        payload = result.payload or {}

        print(f"\nResult {index}")
        print("Score:", result.score)
        print("Video:", payload.get("video_title"))
        print("Start:", payload.get("start_time"))
        print("End:", payload.get("end_time"))
        print("Text:", (payload.get("text") or "")[:200])


if __name__ == "__main__":

    test_query("What is the two pointer technique?")

    test_query("Sliding window technique kaise kaam karti hai?")