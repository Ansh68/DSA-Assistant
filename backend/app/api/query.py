import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.query_normalizer import normalize_query
from app.services.embedding import create_embedding
from app.services.retriever import retrieve_chunks
from app.services.reranker import rerank
from app.services.generator import generate_answer_stream
from app.services.diversity import select_diverse_results


router = APIRouter(
    prefix="/api",
    tags=["query"],
)


class QueryRequest(BaseModel):
    query: str


def format_timestamp(seconds: float) -> str:
    seconds = int(seconds)
    minutes = seconds // 60
    remaining_seconds = seconds % 60
    return f"{minutes:02d}:{remaining_seconds:02d}"


def sse_event(event_type: str, data: dict) -> str:
    """Format a single Server-Sent Event line."""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def build_context(reranked_results) -> str:
    context_parts = []
    for index, (result, score) in enumerate(reranked_results, start=1):
        payload = result.payload
        context_parts.append(
            f"""
[Transcript {index}]

Video:
{payload.get("video_title")}

Transcript:
{payload.get("text")}
"""
        )
    return "\n".join(context_parts)


def build_timestamp_results(selected_results) -> list:
    timestamp_results = []
    for result, score in selected_results:
        payload = result.payload
        start_time = payload.get("start_time")
        end_time = payload.get("end_time")
        timestamp_results.append({
            "video_id": payload.get("video_id"),
            "video_title": payload.get("video_title"),
            "start_time": start_time,
            "end_time": end_time,
            "start_timestamp": format_timestamp(start_time),
            "end_timestamp": format_timestamp(end_time),
            "reranker_score": score,
        })
    return timestamp_results


def stream_query(query: str):
    """
    Generator that runs the full RAG pipeline and yields SSE events:

      event: meta        — normalized query (immediately)
      event: token       — each LLM token as it arrives
      event: results     — final timestamp results after LLM finishes
      event: done        — signals the stream is complete
    """

    # 1. Normalize user query
    normalized_query = normalize_query(query)

    # 2. Create embedding
    query_embedding = create_embedding(normalized_query)

    # 3. Retrieve candidates from Qdrant
    results = retrieve_chunks(query_embedding, limit=15)

    # 4. Rerank candidates
    reranked_results = rerank(normalized_query, results, top_k=5)

    # 5. Build context for LLM
    context = build_context(reranked_results)

    # 6. Send meta event so the client knows the normalized query immediately
    yield sse_event("meta", {
        "query": query,
        "normalized_query": normalized_query,
    })

    # 7. Stream LLM answer token by token
    for token in generate_answer_stream(query=query, context=context):
        yield sse_event("token", {"content": token})

    # 8. Select diverse timestamps
    selected_results = select_diverse_results(
        reranked_results,
        top_k=3,
        min_gap_seconds=60,
    )

    selected_results.sort(
        key=lambda item: (
            item[0].payload.get("video_title", ""),
            item[0].payload.get("start_time", 0),
        )
    )

    timestamp_results = build_timestamp_results(selected_results)

    # 9. Send results event after the answer is fully streamed
    yield sse_event("results", {"results": timestamp_results})

    # 10. Signal completion
    yield sse_event("done", {})


@router.post("/query")
def query(request: QueryRequest):
    return StreamingResponse(
        stream_query(request.query),
        media_type="text/event-stream",
        headers={
            # Prevent buffering on proxies / Nginx
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
        },
    )