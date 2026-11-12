/**
 * Universal RFC-4180 Compliant CSV Playlist Parser
 * Handles quoted cells, escaped quotes (""), CRLF/LF line endings, and UTF-8 BOM.
 * Auto-detects delimiters (comma, semicolon, tab) and columns across Spotify/Exportify,
 * TuneMyMusic, Apple Music, Soundiiz, and generic CSVs.
 */

/**
 * Detects whether the CSV content is delimited by commas, semicolons, or tabs.
 * @param {string} text
 * @returns {',' | ';' | '\t'}
 */
export function detectDelimiter(text) {
  if (typeof text !== 'string' || !text.length) return ',';

  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;
  let lines = 0;

  for (let i = 0; i < text.length && lines < 5; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes) {
      if (char === '\n') {
        lines++;
      } else if (char === ',') {
        commas++;
      } else if (char === ';') {
        semicolons++;
      } else if (char === '\t') {
        tabs++;
      }
    }
  }

  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas && semicolons > tabs) return ';';
  return ',';
}

/**
 * Parses raw CSV text into a 2D array of rows and cells adhering to RFC-4180.
 * @param {string} text
 * @param {string} [customDelimiter]
 * @returns {string[][]}
 */
export function parseRawCsv(text, customDelimiter) {
  if (typeof text !== 'string' || !text.trim()) return [];

  // 1. Strip UTF-8 BOM if present
  const cleanText = text.replace(/^\uFEFF/, '');
  const delimiter = customDelimiter || detectDelimiter(cleanText);

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

    if (char === delimiter && !inQuotes) {
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
export function findColumnIndex(headers, candidates) {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ' '));
  const normalizedCandidates = candidates.map((c) => c.toLowerCase().replace(/[\s_-]+/g, ' '));

  // 1. Exact match
  for (const candidate of normalizedCandidates) {
    const idx = normalizedHeaders.indexOf(candidate);
    if (idx !== -1) return idx;
  }

  // 2. Header contains candidate phrase (e.g. "spotify track name" matches "track name")
  for (const candidate of normalizedCandidates) {
    const idx = normalizedHeaders.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }

  // 3. Word boundary match if candidate is a single word (e.g. "title", "artist")
  for (const candidate of normalizedCandidates) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
    const idx = normalizedHeaders.findIndex((h) => regex.test(h));
    if (idx !== -1) return idx;
  }

  return -1;
}

/**
 * Cleans track titles from Spotify/streaming export noise (e.g. "- Remastered 2021", "(feat. X)", etc.)
 * for resilient YouTube Music search query matching.
 * @param {string} title
 * @returns {string}
 */
export function cleanSearchTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return '';

  let cleaned = title;

  // 1. Remove bracketed/parenthesized edition/remaster/live/feat tags
  cleaned = cleaned.replace(
    /\s*[\(\[](?:(?:feat\.?|ft\.?|featuring|with)\s+[^)\]]+|(?:19|20)\d{2}\s+remaster(?:ed)?|remaster(?:ed)?(?:\s+(?:19|20)\d{2})?|live(?:\s+at|\s+from)?\s+[^)\]]*|deluxe(?:\s+edition)?|bonus\s+track|radio\s+edit|original\s+mix|mono(?:\s+version)?|stereo(?:\s+version)?|acoustic(?:\s+version)?|instrumental|edit|mix|version)[\)\]]/gi,
    ''
  );

  // 2. Remove trailing dashes with remaster/live/feat
  cleaned = cleaned.replace(
    /\s*-\s*(?:(?:feat\.?|ft\.?|featuring)\s+.+|(?:19|20)\d{2}\s+remaster(?:ed)?|remaster(?:ed)?(?:\s+(?:19|20)\d{2})?|live(?:\s+at|\s+from)?.+|deluxe.*|bonus\s+track.*|radio\s+edit.*|version.*)$/gi,
    ''
  );

  // 3. Remove inline "feat. / ft." up to next parenthesis or end
  cleaned = cleaned.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+[^(\[-]+/gi, '');

  // 4. Strip extra whitespace and trailing dashes/punctuation
  cleaned = cleaned.replace(/\s*[-–—:]\s*$/, '').trim();

  return cleaned || title.trim();
}

/**
 * Extracts the primary artist name from a multi-artist string (e.g. "Daft Punk, Pharrell Williams" -> "Daft Punk").
 * @param {string} artist
 * @returns {string}
 */
export function getPrimaryArtist(artist) {
  if (typeof artist !== 'string' || !artist.trim()) return '';
  const parts = artist.split(/[,;/]|(?:\s+&\s+)|\s+(?:feat\.?|ft\.?|featuring)\s+/i);
  return (parts[0] || '').trim();
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
    'track title',
    'tracktitle',
    'song name',
    'song_name',
    'song title',
    'song',
    'title',
    'name',
    'track',
  ]);

  const artistIdx = findColumnIndex(headers, [
    'artist name(s)',
    'artist name',
    'artist names',
    'artist_name',
    'track artist',
    'song artist',
    'artist',
    'artists',
    'performer',
    'performers',
    'author',
    'singer',
    'creator',
  ]);

  const albumIdx = findColumnIndex(headers, [
    'album name',
    'album_name',
    'album title',
    'album',
    'record',
    'collection',
  ]);

  const artworkIdx = findColumnIndex(headers, [
    'album image url',
    'image url',
    'image_url',
    'artwork url',
    'artwork_url',
    'artwork',
    'album art',
    'album_art',
    'cover url',
    'cover_url',
    'cover',
    'image',
    'thumbnail',
  ]);

  const durationIdx = findColumnIndex(headers, [
    'track duration (ms)',
    'duration (ms)',
    'duration_ms',
    'duration ms',
    'duration',
    'track duration',
    'track length',
    'length',
    'time',
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
            durationMs: parseDurationMs(row[3]) || null,
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

/**
 * Formats duration into standard "m:ss" (or "h:mm:ss") string.
 * Accepts milliseconds (e.g. 214533, 214000), seconds (e.g. 214), or pre-formatted strings ("3:34", "03:34").
 * @param {string|number} duration
 * @returns {string}
 */
export function formatDuration(duration) {
  if (duration === null || duration === undefined || duration === '') return '';

  if (typeof duration === 'string') {
    const trimmed = duration.trim();
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      if (parts.length === 2) {
        const min = parseInt(parts[0], 10);
        const sec = parts[1].padStart(2, '0');
        if (!isNaN(min)) return `${min}:${sec}`;
      }
      return trimmed;
    }
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) {
      return formatDuration(num);
    }
    return trimmed;
  }

  if (typeof duration === 'number' && !isNaN(duration) && duration > 0) {
    // If > 10000, interpret as milliseconds (Spotify format e.g. 214000)
    const totalSecs = duration > 10000 ? Math.round(duration / 1000) : Math.round(duration);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    const secStr = seconds < 10 ? `0${seconds}` : `${seconds}`;

    if (hours > 0) {
      const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
      return `${hours}:${minStr}:${secStr}`;
    }
    return `${minutes}:${secStr}`;
  }

  return '';
}

/**
 * Parses duration into numeric total seconds for comparison and player scrubbers.
 * @param {string|number} duration
 * @returns {number}
 */
export function parseDurationSeconds(duration) {
  if (duration === null || duration === undefined || duration === '') return 0;
  if (typeof duration === 'number') {
    if (isNaN(duration) || duration <= 0) return 0;
    return duration > 10000 ? Math.round(duration / 1000) : Math.round(duration);
  }
  if (typeof duration === 'string') {
    const trimmed = duration.trim();
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':').map((p) => parseFloat(p));
      if (!parts.some((p) => isNaN(p))) {
        if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
        if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
      }
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num > 0) {
      return num > 10000 ? Math.round(num / 1000) : Math.round(num);
    }
  }
  return 0;
}

/**
 * Normalizes track metadata from search APIs, player engines, or CSV fallbacks.
 * Ensures consistent Title, Artist, Album, Cover, Duration (m:ss), and addedAt timestamp.
 * @param {Object} track
 * @param {Object} csvFallback
 * @returns {Object}
 */
export function normalizeTrackMetadata(track = {}, csvFallback = {}) {
  const safeTrack = track || {};
  const safeFallback = csvFallback || {};

  // 1. Resolve Title
  let title = safeTrack.title || safeTrack.name;
  if (!title || title === 'Untitled Track' || title === 'Unknown Title') {
    title = safeFallback.title || title || 'Unknown Title';
  }

  // 2. Resolve Artist (checking author, channelTitle, artists array, or csvFallback)
  let artist = '';
  if (safeTrack.artist && safeTrack.artist !== 'Unknown Artist') {
    artist = safeTrack.artist;
  } else if (safeTrack.author) {
    artist = typeof safeTrack.author === 'string' ? safeTrack.author : (safeTrack.author.name || '');
  } else if (safeTrack.channelTitle) {
    artist = safeTrack.channelTitle;
  } else if (Array.isArray(safeTrack.artists) && safeTrack.artists.length > 0) {
    artist = safeTrack.artists
      .map((a) => (typeof a === 'string' ? a : (a.name || '')))
      .filter(Boolean)
      .join(', ');
  } else if (safeTrack.artist) {
    artist = safeTrack.artist;
  }

  if (!artist || artist === 'Unknown Artist') {
    artist = safeFallback.artist || 'Unknown Artist';
  }

  // 3. Resolve Album
  const album = safeTrack.album || safeFallback.album || '';

  // 4. Resolve Duration
  const rawDuration =
    (safeTrack.duration !== undefined && safeTrack.duration !== null && safeTrack.duration !== '')
      ? safeTrack.duration
      : safeTrack.durationText ||
        safeTrack.lengthSeconds ||
        safeTrack.durationMs ||
        safeFallback.durationMs ||
        safeFallback.duration;

  const formattedDuration = formatDuration(rawDuration) || (safeTrack.seconds ? formatDuration(safeTrack.seconds) : '3:30');
  const seconds =
    parseDurationSeconds(rawDuration) ||
    parseDurationSeconds(safeTrack.seconds) ||
    parseDurationSeconds(formattedDuration) ||
    210;

  // 5. Video ID / Unique ID
  const videoId = safeTrack.videoId || safeTrack.id || safeFallback.videoId || safeFallback.id || '';

  // 6. Cover Art
  const cover =
    safeTrack.cover ||
    safeTrack.thumbnailUrl ||
    safeTrack.thumbnail_url ||
    safeTrack.albumArt ||
    safeFallback.artworkUrl ||
    safeFallback.cover ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';

  // 7. Added Timestamp
  const addedAt =
    safeTrack.addedAt !== undefined && safeTrack.addedAt !== null
      ? Number(safeTrack.addedAt)
      : safeFallback.addedAt !== undefined && safeFallback.addedAt !== null
      ? Number(safeFallback.addedAt)
      : Date.now();

  return {
    ...safeTrack,
    id: videoId,
    videoId,
    title,
    artist,
    album,
    cover,
    thumbnailUrl: cover,
    duration: formattedDuration,
    durationFormatted: formattedDuration,
    seconds,
    addedAt,
  };
}

/**
 * Deterministically sorts playlist tracks by user selected order.
 * @param {Array} tracks
 * @param {'custom'|'date_desc'|'date_asc'|'title_asc'|'artist_asc'|'duration_asc'} sortKey
 * @returns {Array}
 */
export function sortPlaylistTracks(tracks, sortKey = 'custom') {
  if (!Array.isArray(tracks) || tracks.length <= 1) {
    return Array.isArray(tracks) ? [...tracks] : [];
  }

  const indexed = tracks.map((t, idx) => ({ track: t, originalIndex: idx }));

  switch (sortKey) {
    case 'date_desc':
      indexed.sort((a, b) => {
        const timeA = typeof a.track.addedAt === 'number' ? a.track.addedAt : a.originalIndex;
        const timeB = typeof b.track.addedAt === 'number' ? b.track.addedAt : b.originalIndex;
        if (timeB !== timeA) return timeB - timeA;
        return b.originalIndex - a.originalIndex;
      });
      break;

    case 'date_asc':
      indexed.sort((a, b) => {
        const timeA = typeof a.track.addedAt === 'number' ? a.track.addedAt : a.originalIndex;
        const timeB = typeof b.track.addedAt === 'number' ? b.track.addedAt : b.originalIndex;
        if (timeA !== timeB) return timeA - timeB;
        return a.originalIndex - b.originalIndex;
      });
      break;

    case 'title_asc':
      indexed.sort((a, b) => {
        const titleA = (a.track.title || '').trim();
        const titleB = (b.track.title || '').trim();
        const cmp = titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return a.originalIndex - b.originalIndex;
      });
      break;

    case 'artist_asc':
      indexed.sort((a, b) => {
        const artistA = (a.track.artist || '').trim();
        const artistB = (b.track.artist || '').trim();
        const cmp = artistA.localeCompare(artistB, undefined, { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        const titleCmp = (a.track.title || '').localeCompare(b.track.title || '', undefined, { sensitivity: 'base' });
        if (titleCmp !== 0) return titleCmp;
        return a.originalIndex - b.originalIndex;
      });
      break;

    case 'duration_asc':
      indexed.sort((a, b) => {
        const durA = parseDurationSeconds(a.track.duration || a.track.seconds || a.track.durationMs);
        const durB = parseDurationSeconds(b.track.duration || b.track.seconds || b.track.durationMs);
        if (durA !== durB) return durA - durB;
        return a.originalIndex - b.originalIndex;
      });
      break;

    case 'custom':
    default:
      return [...tracks];
  }

  return indexed.map((item) => item.track);
}

export default parseCsvPlaylist;
