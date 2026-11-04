/**
 * Helper utilities for playlist track normalization and local storage persistence.
 */

export const MOODS_LIST = [
  { index: 0, name: 'Energetic' },
  { index: 1, name: 'Chill' },
  { index: 2, name: 'Melancholic' },
  { index: 3, name: 'Focused' },
];

export function normalizeTrack(track) {
  if (!track) return null;
  const videoId = track.videoId || track.id;
  return {
    id: videoId,
    videoId,
    title: track.title || 'Untitled Track',
    artist: track.artist || 'Unknown Artist',
    cover:
      track.cover ||
      track.albumArt ||
      track.thumbnailUrl ||
      track.thumbnail_url ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
    duration: track.durationFormatted || track.duration || '3:30',
    seconds: typeof track.seconds === 'number' ? track.seconds : (typeof track.duration === 'number' ? track.duration : 210),
  };
}

export function loadSavedTracks(playlistId) {
  try {
    const raw = localStorage.getItem(`superculture_playlist_tracks_${playlistId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function persistTracks(playlistId, tracks) {
  try {
    localStorage.setItem(`superculture_playlist_tracks_${playlistId}`, JSON.stringify(tracks));
  } catch (e) {
    console.warn('[LibraryStore] Failed to persist playlist tracks:', e);
  }
}

export function loadFollowedArtists() {
  try {
    const raw = localStorage.getItem('superculture_followed_artists');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFollowedArtists(artists) {
  try {
    localStorage.setItem('superculture_followed_artists', JSON.stringify(artists));
  } catch (e) {
    console.warn('[LibraryStore] Failed to save followed artists:', e);
  }
}

export function loadDownloadedTracks() {
  try {
    const raw = localStorage.getItem('sc_downloaded_tracks');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDownloadedTracks(tracks) {
  try {
    localStorage.setItem('sc_downloaded_tracks', JSON.stringify(tracks));
  } catch (e) {
    console.warn('[LibraryStore] Failed to save downloaded tracks:', e);
  }
}


