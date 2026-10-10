from app.core.config import QDRANT_COLLECTION
from app.core.qdrant import client

def retrieve_chunks(query_embedding, limit: int = 15):
    results = client.query_points(
        collection_name=QDRANT_COLLECTION,
        query=query_embedding,
        limit=limit,

    ).points

    return results