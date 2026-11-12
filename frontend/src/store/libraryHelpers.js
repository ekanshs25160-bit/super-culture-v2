/**
 * Helper utilities for playlist track normalization and local storage persistence.
 */

import { normalizeTrackMetadata, formatDuration, parseDurationSeconds } from '../utils/csvPlaylistParser.js';

export { normalizeTrackMetadata, formatDuration, parseDurationSeconds };

export const MOODS_LIST = [
  { index: 0, name: 'Energetic' },
  { index: 1, name: 'Chill' },
  { index: 2, name: 'Melancholic' },
  { index: 3, name: 'Focused' },
];

export function normalizeTrack(track, csvFallback = {}) {
  if (!track) return null;
  return normalizeTrackMetadata(track, csvFallback);
}

export function loadSavedTracks(playlistId) {
  try {
    const raw = localStorage.getItem(`superculture_playlist_tracks_${playlistId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t, idx) =>
      normalizeTrackMetadata(t, {
        addedAt: t.addedAt !== undefined ? t.addedAt : (1000000 + idx),
      })
    );
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


