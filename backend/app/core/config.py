import os
from dotenv import load_dotenv

load_dotenv()

QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
QDRANT_URI = os.environ.get("QDRANT_URL")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

QDRANT_COLLECTION = os.environ.get("QDRANT_COLLECTION", "youtube_transcripts")

PLAYLIST_URL = os.environ.get("PLAYLIST_URL")
