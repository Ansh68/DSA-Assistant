from FlagEmbedding import FlagReranker

MODEL_NAME = "BAAI/bge-reranker-v2-m3"

reranker = FlagReranker(
    MODEL_NAME,
    use_fp16=False,
)

def rerank(query ,results , top_k = 5):
    pairs = []

    for result in results:
        text= result.payload.get("text", "")

        pairs.append([query, text])

    scores = reranker.compute_score(
        pairs,
        normalize=True
    )

    if not isinstance(scores, list):
        scores = [scores]

    reranked = sorted(
        zip(results, scores),
        key=lambda x: x[1],
        reverse=True,
    )


    return reranked[:top_k]