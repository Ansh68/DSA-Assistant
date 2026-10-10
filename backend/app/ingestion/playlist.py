from yt_dlp import YoutubeDL
from app.core.config import PLAYLIST_URL


def get_playlist_videos():
    if not PLAYLIST_URL:
        raise ValueError(
            "PLAYLIST_URL is not set. "
            "Add it to your .env file."
        )

    options = {
        "extract_flat": True,
        "quiet": True,
        "skip_download": True,
    }

    with YoutubeDL(options) as ydl:
        info = ydl.extract_info(
            PLAYLIST_URL,
            download=False,
        )

    videos = []

    for entry in info.get("entries", []):

        if not entry:
            continue

        video_id = entry.get("id")
        title = entry.get("title")

        if not video_id:
            continue

        videos.append({
            "video_id": video_id,
            "title": title or "Unknown title",
        })

    return videos