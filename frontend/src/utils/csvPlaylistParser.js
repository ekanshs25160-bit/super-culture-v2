/**
 * Universal RFC-4180 Compliant CSV Playlist Parser
 * Handles quoted cells, escaped quotes (""), CRLF/LF line endings, and UTF-8 BOM.
 * Auto-detects columns across Spotify/Exportify, TuneMyMusic, Apple Music, Soundiiz, and generic CSVs.
 */

/**
 * Parses raw CSV text into a 2D array of rows and cells adhering to RFC-4180.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseRawCsv(text) {
  if (typeof text !== 'string' || !text.trim()) return [];

  // 1. Strip UTF-8 BOM if present
  let cleanText = text.replace(/^\uFEFF/, '');

  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;
  const len = cleanText.length;

  while (i < len) {
    const char = cleanText[i];

    if (char === '"') {
      if (inQuotes && i + 1 < len && cleanText[i + 1] === '"') {
        // Escaped quote: "" -> "
        currentCell += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      i++;
      continue;
    }

    if ((char === '\r' || char === '\n') && !inQuotes) {
      // Handle CRLF or standalone LF / CR
      if (char === '\r' && i + 1 < len && cleanText[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentCell);
      currentCell = '';

      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      i++;
      continue;
    }

    currentCell += char;
    i++;
  }

  // Final cell / row push
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes duration string or number into milliseconds.
 * Supports: 234000 (ms), 234 (sec), "3:54", "03:54", "1:02:15".
 * @param {string|number} raw
 * @returns {number|null}
 */
export function parseDurationMs(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Format mm:ss or hh:mm:ss
  if (str.includes(':')) {
    const parts = str.split(':').map((p) => parseFloat(p));
    if (parts.some((p) => isNaN(p))) return null;
    if (parts.length === 2) {
      return Math.round((parts[0] * 60 + parts[1]) * 1000);
    }
    if (parts.length === 3) {
      return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000);
    }
  }

  const num = Number(str.replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) return null;

  // If already in milliseconds (> 10000, e.g. 180000)
  if (num > 10000) return Math.round(num);

  // If in seconds (e.g. 210)
  return Math.round(num * 1000);
}

/**
 * Finds the index of a column matching any of the candidate names.
 * @param {string[]} headers
 * @param {string[]} candidates
 * @returns {number}
 */
function findColumnIndex(headers, candidates) {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ' '));
  const normalizedCandidates = candidates.map((c) => c.toLowerCase().replace(/[\s_-]+/g, ' '));

  // 1. Exact match
  for (const candidate of normalizedCandidates) {
    const idx = normalizedHeaders.indexOf(candidate);
    if (idx !== -1) return idx;
  }

  // 2. Substring match (e.g. "Track Name" matches "track")
  for (const candidate of normalizedCandidates) {
    const idx = normalizedHeaders.findIndex((h) => h.includes(candidate) || candidate.includes(h));
    if (idx !== -1) return idx;
  }

  return -1;
}

/**
 * Parses a playlist CSV string into clean track row objects.
 * @param {string} csvContent
 * @returns {{ tracks: Array<{ title: string, artist: string, album?: string, artworkUrl?: string, durationMs?: number|null }>, errors: string[] }}
 */
export function parseCsvPlaylist(csvContent) {
  const rows = parseRawCsv(csvContent);
  const errors = [];

  if (rows.length === 0) {
    return { tracks: [], errors: ['CSV content is empty'] };
  }

  const headers = rows[0];

  const titleIdx = findColumnIndex(headers, [
    'track name',
    'track_name',
    'title',
    'song',
    'song name',
    'name',
    'track',
    'track title',
  ]);

  const artistIdx = findColumnIndex(headers, [
    'artist name(s)',
    'artist name',
    'artist names',
    'artist_name',
    'artist',
    'artists',
    'performer',
    'author',
  ]);

  const albumIdx = findColumnIndex(headers, [
    'album name',
    'album',
    'album_name',
    'record',
  ]);

  const artworkIdx = findColumnIndex(headers, [
    'album image url',
    'image url',
    'artwork',
    'artwork url',
    'album art',
    'cover',
    'cover url',
    'image',
  ]);

  const durationIdx = findColumnIndex(headers, [
    'duration (ms)',
    'duration_ms',
    'duration ms',
    'duration',
    'track duration (ms)',
    'track duration',
    'time',
    'length',
  ]);

  if (titleIdx === -1 && artistIdx === -1) {
    // If no recognizable headers, check if row 0 could be data (e.g. title, artist)
    if (rows[0].length >= 2) {
      // Fallback: assume column 0 is title, column 1 is artist
      const tracks = [];
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const title = (row[0] || '').trim();
        const artist = (row[1] || '').trim();
        if (title) {
          tracks.push({
            title,
            artist,
            album: (row[2] || '').trim(),
            artworkUrl: '',
            durationMs: null,
          });
        }
      }
      return { tracks, errors };
    }
    return {
      tracks: [],
      errors: ['Could not detect Title or Artist columns in CSV headers.'],
    };
  }

  const tracks = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawTitle = titleIdx !== -1 ? row[titleIdx] : '';
    const rawArtist = artistIdx !== -1 ? row[artistIdx] : '';
    const rawAlbum = albumIdx !== -1 ? row[albumIdx] : '';
    const rawArtwork = artworkIdx !== -1 ? row[artworkIdx] : '';
    const rawDuration = durationIdx !== -1 ? row[durationIdx] : '';

    const title = (rawTitle || '').trim();
    const artist = (rawArtist || '').trim();
    const album = (rawAlbum || '').trim();
    const artworkUrl = (rawArtwork || '').trim();
    const durationMs = parseDurationMs(rawDuration);

    if (!title && !artist) {
      continue; // Skip entirely blank data lines
    }

    if (!title && artist) {
      errors.push(`Row ${r + 1}: Missing track title for artist "${artist}".`);
      continue;
    }

    tracks.push({
      title,
      artist: artist || 'Unknown Artist',
      album,
      artworkUrl,
      durationMs,
    });
  }

  return { tracks, errors };
}

export default parseCsvPlaylist;
