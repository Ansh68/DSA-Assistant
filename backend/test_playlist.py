from app.ingestion.transcript import get_transcript

video_id = "XpHIIQwVxvI"

transcript = get_transcript(video_id)

if transcript:
    print("Transcript fetched successfully!")
    print(f"Entries: {len(transcript)}")
else:
    print("Transcript could not be fetched.")