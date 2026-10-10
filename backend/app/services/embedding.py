from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

model = SentenceTransformer(MODEL_NAME)

def create_embedding(text: str):
    embedding = model.encode(
        text,
        normalize_embeddings=True
    )

    return embedding.tolist()