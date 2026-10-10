CHUNK_DURATION = 30
OVERLAP = 10
STEP = CHUNK_DURATION - OVERLAP

def chunk_transcript(transcript):

    if not transcript:
        return []

    total_duration = transcript[-1].start + transcript[-1].duration

    chunks = []

    start_time = 0

    while start_time < total_duration:
        end_time = start_time + CHUNK_DURATION

        texts = []

        for entry in transcript:
            entry_start = entry.start
            entry_end = entry.start + entry.duration

            if entry_end > start_time and entry_start < end_time:
                texts.append(entry.text)

        if texts:
            chunks.append({
                "text": " ".join(texts),
                "start_time": start_time,
                "end_time": min(end_time, total_duration),
            })

        start_time += STEP
    return chunks




        
        

        
