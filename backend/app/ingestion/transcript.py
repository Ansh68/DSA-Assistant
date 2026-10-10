from youtube_transcript_api import (
    YouTubeTranscriptApi,
    IpBlocked,
    RequestBlocked,
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
    AgeRestricted,
)


api = YouTubeTranscriptApi()


def get_transcript(video_id: str):
    try:
        transcript_list = api.list(video_id)

        for transcript in transcript_list:
            if transcript.language_code == "hi":
                print(f"Found Hindi transcript for {video_id}")
                return transcript.fetch()

        print(f"No Hindi transcript found for {video_id}")
        return None

    except (IpBlocked, RequestBlocked) as e:
        print()
        print("=" * 70)
        print("🛑 YOUTUBE REQUEST BLOCKED")
        print("=" * 70)
        print(f"Video ID: {video_id}")
        print()
        print("YouTube has blocked requests from this IP.")
        print("The ingestion process should STOP immediately.")
        print()
        print(f"Error: {type(e).__name__}")
        print("=" * 70)
        print()

        # Important:
        # Re-raise the exception so index.py knows that this
        # is an IP/request block and must stop the ingestion.
        raise

    except NoTranscriptFound:
        print(f"No Hindi transcript found for {video_id}")
        return None

    except TranscriptsDisabled:
        print(f"Transcripts are disabled for {video_id}")
        return None

    except VideoUnavailable:
        print(f"Video unavailable: {video_id}")
        return None

    except AgeRestricted:
        print(f"Video is age restricted: {video_id}")
        return None

    except Exception as e:
        print(
            f"Transcript error for {video_id}: "
            f"{type(e).__name__}: {e}"
        )
        return None