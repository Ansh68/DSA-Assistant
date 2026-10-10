from qdrant_client import QdrantClient

from app.core.config import QDRANT_URI, QDRANT_API_KEY


client = QdrantClient(
    url=QDRANT_URI,
    api_key=QDRANT_API_KEY,
)

