from fastapi import FastAPI
from app.core.qdrant import client
from app.api.query import router as query_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Youtube RAG",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(query_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/health/qdrant")
def qdrant_health_check():
    try:
        collections = client.get_collections()

        return {
            "status": "ok",
            "qdrant": "connected",
            "collections": len(collections.collections),
        }

    except Exception as e:
        return {
            "status": "error",
            "qdrant": "disconnected",
            "error": str(e),
        }
