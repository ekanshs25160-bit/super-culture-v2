import os
import json
from ytmusicapi import YTMusic

class YTService:
    def __init__(self):
        # If there's a headers_auth.json, initialize with it. Otherwise, initialize unauthenticated.
        # Check if auth.json or headers_auth.json exists
        auth_file = "headers_auth.json"
        if os.path.exists(auth_file):
            self.yt = YTMusic(auth_file)
        else:
            self.yt = YTMusic()

    def search_tracks(self, query: str, limit: int = 40):
        """
        Search for songs and return cleaned-up metadata with limit support.
        """
        try:
            results = self.yt.search(query, filter="songs", limit=limit)
            clean_results = []
            for r in results:
                # Safely extract thumbnail and upgrade resolution
                thumbnails = r.get("thumbnails", [])
                thumbnail_url = thumbnails[-1]["url"] if thumbnails else ""
                if thumbnail_url and "=" in thumbnail_url:
                    base_url = thumbnail_url.split("=")[0]
                    thumbnail_url = f"{base_url}=w1200-h1200-l90-rj"

                # Safely extract artists
                artists = r.get("artists", [])
                artist_name = ", ".join(a["name"] for a in artists) if artists else "Unknown Artist"

                clean_results.append({
                    "videoId": r.get("videoId"),
                    "title": r.get("title", "Unknown Title"),
                    "artist": artist_name,
                    "duration": r.get("duration", ""),
                    "thumbnail_url": thumbnail_url,
                    "albumArt": thumbnail_url, # Adding albumArt to maintain frontend compatibility
                    "id": r.get("videoId") # Adding id to maintain frontend compatibility
                })
            return clean_results
        except Exception as e:
            print(f"Error in ytmusicapi search: {e}")
            return []

    def search_songs(self, query: str, limit: int = 40):
        """
        Alias for search_tracks to maintain backward compatibility.
        """
        return self.search_tracks(query, limit)

    def get_playlists(self):
        """
        Return the user's library playlists (requires auth)
        """
        try:
            return self.yt.get_library_playlists()
        except Exception as e:
            return {"error": str(e), "message": "Authentication required for this feature."}

yt_service = YTService()
search_tracks = yt_service.search_tracks
