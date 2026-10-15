
import os
import time
import random

from dotenv import load_dotenv
from google import genai
from google.genai import types
from qdrant_client import QdrantClient, models

load_dotenv()

SOURCE_COLLECTION = "youtube_transcripts"
TARGET_COLLECTION = "youtube_transcripts_gemini_test"

MODEL_NAME = "gemini-embedding-001"
VECTOR_SIZE = 3072

# Start conservatively to avoid large requests.
BATCH_SIZE = 8
MAX_RETRIES = 5

gemini_key = os.getenv("GEMINI_API_KEY")
qdrant_url = os.getenv("QDRANT_URL")
qdrant_key = os.getenv("QDRANT_API_KEY")

if not all([gemini_key, qdrant_url, qdrant_key]):
    raise RuntimeError(
        "Missing GEMINI_API_KEY, QDRANT_URL or QDRANT_API_KEY."
    )

gemini = genai.Client(api_key=gemini_key)

qdrant = QdrantClient(
    url=qdrant_url,
    api_key=qdrant_key,
    timeout=60,
)


def embed_documents(texts):
    """Generate embeddings and respect Gemini rate limits."""

    for attempt in range(MAX_RETRIES):
        try:
            response = gemini.models.embed_content(
                model=MODEL_NAME,
                contents=texts,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=VECTOR_SIZE,
                ),
            )

            vectors = [
                item.values for item in response.embeddings
            ]

            if len(vectors) != len(texts):
                raise RuntimeError(
                    "Embedding count does not match input count."
                )

            for vector in vectors:
                if len(vector) != VECTOR_SIZE:
                    raise RuntimeError(
                        f"Expected {VECTOR_SIZE} dimensions; "
                        f"received {len(vector)}."
                    )

            return vectors

        except Exception as exc:
            message = str(exc).lower()
            is_rate_limit = (
                "429" in message
                or "resource_exhausted" in message
                or "quota exceeded" in message
            )

            if attempt == MAX_RETRIES - 1:
                raise

            if is_rate_limit:
                # The API error reports roughly 60 seconds.
                delay = 65
                print(
                    f"Gemini rate limit reached. "
                    f"Waiting {delay} seconds before retrying."
                )
            else:
                delay = min(60, 2 ** (attempt + 1))
                print(
                    f"Embedding request failed: {type(exc).__name__}: {exc}"
                )
                print(f"Retrying in {delay} seconds.")

            time.sleep(delay)

    raise RuntimeError("Embedding failed after retries.")


def get_existing_target_ids():
    """Collect IDs already indexed in the Gemini target collection."""

    ids = set()
    offset = None

    while True:
        points, next_offset = qdrant.scroll(
            collection_name=TARGET_COLLECTION,
            limit=500,
            offset=offset,
            with_payload=False,
            with_vectors=False,
        )

        ids.update(str(point.id) for point in points)

        if next_offset is None:
            break

        offset = next_offset

    return ids


def main():
    # Safety checks: do not create or overwrite an unknown collection.
    collections = {
        item.name
        for item in qdrant.get_collections().collections
    }

    if SOURCE_COLLECTION not in collections:
        raise RuntimeError(
            f"Source collection {SOURCE_COLLECTION!r} not found."
        )

    if TARGET_COLLECTION not in collections:
        raise RuntimeError(
            f"Target collection {TARGET_COLLECTION!r} not found. "
            "Run the earlier Gemini test-indexing script first."
        )

    source_info = qdrant.get_collection(SOURCE_COLLECTION)
    target_info = qdrant.get_collection(TARGET_COLLECTION)

    if source_info.config.params.vectors.size != 384:
        raise RuntimeError(
            "Source vector size is not 384; verify the source collection."
        )

    if target_info.config.params.vectors.size != VECTOR_SIZE:
        raise RuntimeError(
            "Target collection does not use 3072-dimensional vectors."
        )

    print("Source vectors:", source_info.points_count)
    print("Target vectors before:", target_info.points_count)

    existing_ids = get_existing_target_ids()
    print("Already indexed in Gemini:", len(existing_ids))

    offset = None
    scanned = 0
    indexed_this_run = 0

    while True:
        points, next_offset = qdrant.scroll(
            collection_name=SOURCE_COLLECTION,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )

        if not points:
            break

        scanned += len(points)

        # Exclude previously indexed IDs and incomplete payloads.
        candidates = []

        for point in points:
            if str(point.id) in existing_ids:
                continue

            payload = point.payload or {}
            text = payload.get("text")

            if not isinstance(text, str) or not text.strip():
                print(
                    f"Skipping point {point.id}: missing transcript text."
                )
                continue

            candidates.append(point)

        for start in range(0, len(candidates), BATCH_SIZE):
            batch = candidates[start:start + BATCH_SIZE]
            texts = [
                point.payload["text"]
                for point in batch
            ]

            vectors = embed_documents(texts)

            # Preserve source IDs and payloads in the separate collection.
            new_points = [
                models.PointStruct(
                    id=point.id,
                    vector=vector,
                    payload=point.payload,
                )
                for point, vector in zip(batch, vectors)
            ]

            qdrant.upsert(
                collection_name=TARGET_COLLECTION,
                points=new_points,
                wait=True,
            )

            # Update in-memory progress only after Qdrant confirms upsert.
            existing_ids.update(str(point.id) for point in batch)
            indexed_this_run += len(batch)

            print(
                f"Scanned {scanned} source points | "
                f"Indexed this run: {indexed_this_run} | "
                f"Gemini indexed: {len(existing_ids)}"
            )

        if next_offset is None:
            break

        offset = next_offset

    final_info = qdrant.get_collection(TARGET_COLLECTION)

    print("\nIndexing finished.")
    print("Source collection:", SOURCE_COLLECTION)
    print("Source vector count:", source_info.points_count)
    print("Target collection:", TARGET_COLLECTION)
    print("Target vector count:", final_info.points_count)
    print("New vectors indexed this run:", indexed_this_run)
    print("Original collection was not modified.")


if __name__ == "__main__":
    main()
