def select_diverse_results(
    reranked_results,
    top_k=3,
    min_gap_seconds=60,
):
    selected = []

    for result, score in reranked_results:

        payload = result.payload

        video_id = payload.get("video_id")
        start_time = payload.get("start_time")

        # Check whether this result is too close
        # to an already selected result
        too_close = False

        for selected_result, _ in selected:

            selected_payload = selected_result.payload

            selected_video_id = selected_payload.get("video_id")
            selected_start_time = selected_payload.get("start_time")

            # Only compare timestamps from the same video
            if video_id == selected_video_id:

                if abs(start_time - selected_start_time) < min_gap_seconds:
                    too_close = True
                    break

        if not too_close:
            selected.append((result, score))

        if len(selected) == top_k:
            break

    return selected