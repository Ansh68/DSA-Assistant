import uuid

from sentence_transformers import SentenceTransformer
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
)

from app.core.qdrant import client
from app.core.config import QDRANT_COLLECTION

from app.ingestion.playlist import get_playlist_videos
from app.ingestion.transcript import get_transcript
from app.ingestion.chunker import chunk_transcript
from youtube_transcript_api import IpBlocked, RequestBlocked


MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

EMBEDDING_DIMENSION = 384

BATCH_SIZE = 50


def create_collection_if_not_exists():

    collections = client.get_collections()

    collection_names = [
        collection.name
        for collection in collections.collections
    ]

    if QDRANT_COLLECTION not in collection_names:

        print(
            f"Creating collection: "
            f"{QDRANT_COLLECTION}"
        )

        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(
                size=EMBEDDING_DIMENSION,
                distance=Distance.COSINE,
            ),
        )

    else:

        print(
            f"Collection already exists: "
            f"{QDRANT_COLLECTION}"
        )


def video_already_indexed(video_id: str) -> bool:

    result = client.scroll(
        collection_name=QDRANT_COLLECTION,
        scroll_filter={
            "must": [
                {
                    "key": "video_id",
                    "match": {
                        "value": video_id
                    },
                }
            ]
        },
        limit=1,
        with_payload=False,
        with_vectors=False,
    )

    points = result[0]

    return len(points) > 0


def upload_points(points):

    for start in range(0, len(points), BATCH_SIZE):

        batch = points[
            start:start + BATCH_SIZE
        ]

        client.upsert(
            collection_name=QDRANT_COLLECTION,
            points=batch,
        )

        uploaded = min(
            start + BATCH_SIZE,
            len(points),
        )

        print(
            f"Uploaded "
            f"{uploaded}/{len(points)} points"
        )


def main():

    print("=" * 70)
    print("YOUTUBE PLAYLIST INGESTION")
    print("=" * 70)

    # 1. Load embedding model

    print("\nLoading embedding model...")

    model = SentenceTransformer(
        MODEL_NAME
    )

    # 2. Make sure Qdrant collection exists

    create_collection_if_not_exists()

    # 3. Get all playlist videos
  

    videos = get_playlist_videos()

    print(
        f"\nFound {len(videos)} videos "
        f"in playlist."
    )

    # 4. Process videos

    for video_number, video in enumerate(
        videos,
        start=1,
    ):

        video_id = video["video_id"]
        video_title = video["title"]

        print("\n")
        print("=" * 70)
        print(
            f"[{video_number}/{len(videos)}] "
            f"{video_title}"
        )
        print(
            f"Video ID: {video_id}"
        )
        print("=" * 70)

        # Check if already indexed
        
        try:

            if video_already_indexed(
                video_id
            ):

                print(
                    "Already indexed. "
                    "Skipping..."
                )

                continue

        except Exception as e:

            print(
                "Could not check whether "
                f"video is indexed: {e}"
            )

            print(
                "Continuing with ingestion..."
            )

        # Fetch transcript

        print("Fetching transcript...")

        try:
            transcript = get_transcript(video_id)

        except( IpBlocked, RequestBlocked):
            print()
            print("=" * 70)
            print("🛑 INGESTION PAUSED")
            print("=" * 70)
            print("YouTube has blocked transcript requests from this IP.")
            print()
            print("No more YouTube requests will be made.")
            print("Already indexed videos are safe in Qdrant.")
            print()
            print("Stop the program and try again later.")
            print("=" * 70)
            print()
            break

        if not transcript:

            print(
                "No usable Hindi transcript. "
                "Skipping video."
            )

            continue

        print(
            f"Transcript entries: "
            f"{len(transcript)}"
        )

        # Chunk transcript

        chunks = chunk_transcript(
            transcript
        )

        if not chunks:

            print(
                "No chunks generated. "
                "Skipping video."
            )

            continue

        print(
            f"Created {len(chunks)} chunks"
        )

        # Create embeddings

        texts = [
            chunk["text"]
            for chunk in chunks
        ]

        print("Creating embeddings...")

        embeddings = model.encode(
            texts,
            normalize_embeddings=True,
        )

        print(
            f"Created {len(embeddings)} embeddings"
        )

        # Create Qdrant points
   
        points = []

        for index, (
            chunk,
            embedding
        ) in enumerate(
            zip(chunks, embeddings)
        ):

            point_id = str(
                uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"{video_id}_{index}",
                )
            )

            payload = {
                "video_id": video_id,
                "video_title": video_title,
                "text": chunk["text"],
                "start_time": chunk["start_time"],
                "end_time": chunk["end_time"],
            }

            points.append(
                PointStruct(
                    id=point_id,
                    vector=embedding.tolist(),
                    payload=payload,
                )
            )

        # Upload to Qdrant

        print(
            f"Uploading {len(points)} points..."
        )

        upload_points(points)

        print(
            f"Successfully indexed: "
            f"{video_title}"
        )

    print("\n")
    print("=" * 70)
    print("PLAYLIST INGESTION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()