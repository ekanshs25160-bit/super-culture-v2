import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRawCsv,
  parseDurationMs,
  parseCsvPlaylist,
  formatDuration,
  normalizeTrackMetadata,
  sortPlaylistTracks,
} from '../utils/csvPlaylistParser.js';

describe('CSV Playlist Parser Suite', () => {
  it('parses raw RFC-4180 CSV with quotes, escaped quotes, and newlines', () => {
    const csv = 'Track,Artist,Album\r\n"Song, with comma","Artist ""The Great""",Album 1\nSimple,Artist 2,"Multi\nline Album"';
    const rows = parseRawCsv(csv);

    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], ['Track', 'Artist', 'Album']);
    assert.deepEqual(rows[1], ['Song, with comma', 'Artist "The Great"', 'Album 1']);
    assert.deepEqual(rows[2], ['Simple', 'Artist 2', 'Multi\nline Album']);
  });

  it('strips UTF-8 BOM if present at the start of CSV', () => {
    const csvWithBom = '\uFEFFTrack Name,Artist Name\nBlinding Lights,The Weeknd';
    const { tracks, errors } = parseCsvPlaylist(csvWithBom);

    assert.equal(errors.length, 0);
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].title, 'Blinding Lights');
    assert.equal(tracks[0].artist, 'The Weeknd');
  });

  it('correctly auto-detects Spotify / Exportify CSV headers', () => {
    const spotifyCsv = `Track URI,Track Name,Artist Name(s),Album Name,Album Release Date,Disc Number,Track Number,Track Duration (ms),Explicit,Popularity,Added By,Added At,Album Image URL
spotify:track:0VjIjW4GlUZAMYd2vXMi3b,Blinding Lights,The Weeknd,After Hours,2020-03-20,1,9,200040,false,90,,,"https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36"
spotify:track:7qiZfU4dY1lWllzX7mPBI3,Shape of You,Ed Sheeran,÷ (Deluxe),2017-03-03,1,4,233712,false,88,,,"https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96"`;

    const { tracks, errors } = parseCsvPlaylist(spotifyCsv);
    assert.equal(errors.length, 0);
    assert.equal(tracks.length, 2);

    assert.equal(tracks[0].title, 'Blinding Lights');
    assert.equal(tracks[0].artist, 'The Weeknd');
    assert.equal(tracks[0].album, 'After Hours');
    assert.equal(tracks[0].durationMs, 200040);
    assert.equal(tracks[0].artworkUrl, 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36');

    assert.equal(tracks[1].title, 'Shape of You');
    assert.equal(tracks[1].artist, 'Ed Sheeran');
    assert.equal(tracks[1].durationMs, 233712);
  });

  it('correctly auto-detects TuneMyMusic / Soundiiz and generic formats', () => {
    const tuneMyMusicCsv = `Track,Artist,Album,Duration
"Bad Guy","Billie Eilish","WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?","3:14"
"Levitating","Dua Lipa","Future Nostalgia","3:23"`;

    const { tracks, errors } = parseCsvPlaylist(tuneMyMusicCsv);
    assert.equal(errors.length, 0);
    assert.equal(tracks.length, 2);

    assert.equal(tracks[0].title, 'Bad Guy');
    assert.equal(tracks[0].artist, 'Billie Eilish');
    assert.equal(tracks[0].album, 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?');
    assert.equal(tracks[0].durationMs, 194000); // 3*60 + 14 = 194s -> 194000ms

    assert.equal(tracks[1].title, 'Levitating');
    assert.equal(tracks[1].artist, 'Dua Lipa');
    assert.equal(tracks[1].durationMs, 203000); // 3*60 + 23 = 203s -> 203000ms
  });

  it('parses duration accurately across various representations', () => {
    assert.equal(parseDurationMs('180000'), 180000); // milliseconds
    assert.equal(parseDurationMs(210), 210000); // seconds
    assert.equal(parseDurationMs('3:45'), 225000); // mm:ss
    assert.equal(parseDurationMs('01:02:03'), 3723000); // hh:mm:ss
    assert.equal(parseDurationMs(''), null);
    assert.equal(parseDurationMs(null), null);
    assert.equal(parseDurationMs('invalid'), null);
  });

  it('handles empty input and reports errors when required fields are missing', () => {
    const emptyResult = parseCsvPlaylist('');
    assert.equal(emptyResult.tracks.length, 0);
    assert.equal(emptyResult.errors.length, 1);

    const missingTitleCsv = `Track Name,Artist Name\n,Unknown Singer\nReal Song,Real Artist`;
    const res = parseCsvPlaylist(missingTitleCsv);
    assert.equal(res.tracks.length, 1);
    assert.equal(res.tracks[0].title, 'Real Song');
    assert.equal(res.errors.length, 1);
  });

  it('formatDuration accurately formats milliseconds, seconds, and strings to m:ss', () => {
    // Spotify Duration (ms) formats
    assert.equal(formatDuration(214000), '3:34');
    assert.equal(formatDuration(214533), '3:35');
    assert.equal(formatDuration(65000), '1:05');
    assert.equal(formatDuration(3665000), '1:01:05'); // with hours

    // Seconds format
    assert.equal(formatDuration(214), '3:34');
    assert.equal(formatDuration(65), '1:05');

    // String formats
    assert.equal(formatDuration('3:34'), '3:34');
    assert.equal(formatDuration('03:34'), '3:34');
    assert.equal(formatDuration('214000'), '3:34');
    assert.equal(formatDuration(''), '');
    assert.equal(formatDuration(null), '');
  });

  it('normalizeTrackMetadata correctly parses duration and preserves artist from search results and CSV fallbacks', () => {
    // 1. Search result with complete info
    const searchResult = {
      videoId: 'vid-123',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      duration: '3:20',
      album: 'After Hours',
    };
    const normalized1 = normalizeTrackMetadata(searchResult);
    assert.equal(normalized1.title, 'Blinding Lights');
    assert.equal(normalized1.artist, 'The Weeknd');
    assert.equal(normalized1.duration, '3:20');
    assert.equal(normalized1.seconds, 200);

    // 2. Search result with missing artist & duration, but provided via CSV fallback with Spotify Duration (ms)
    const sparseResult = {
      videoId: 'vid-456',
      title: 'Starboy',
    };
    const csvFallback = {
      title: 'Starboy',
      artist: 'The Weeknd ft. Daft Punk',
      album: 'Starboy (Deluxe)',
      durationMs: 230000, // 3:50
      addedAt: 1700000000000,
    };
    const normalized2 = normalizeTrackMetadata(sparseResult, csvFallback);
    assert.equal(normalized2.title, 'Starboy');
    assert.equal(normalized2.artist, 'The Weeknd ft. Daft Punk');
    assert.equal(normalized2.album, 'Starboy (Deluxe)');
    assert.equal(normalized2.duration, '3:50');
    assert.equal(normalized2.seconds, 230);
    assert.equal(normalized2.addedAt, 1700000000000);

    // 3. Artist variations (author object, channelTitle, artists array)
    const authorResult = { videoId: 'v3', title: 'Song', author: { name: 'Channel Author' } };
    assert.equal(normalizeTrackMetadata(authorResult).artist, 'Channel Author');

    const channelResult = { videoId: 'v4', title: 'Song', channelTitle: 'Official Channel' };
    assert.equal(normalizeTrackMetadata(channelResult).artist, 'Official Channel');

    const artistsArrayResult = { videoId: 'v5', title: 'Song', artists: ['Artist One', 'Artist Two'] };
    assert.equal(normalizeTrackMetadata(artistsArrayResult).artist, 'Artist One, Artist Two');
  });

  describe('sortPlaylistTracks Suite', () => {
    const tracks = [
      { id: '1', title: 'Zebra', artist: 'Charlie', duration: '3:00', seconds: 180, addedAt: 100 },
      { id: '2', title: 'Apple', artist: 'Bob', duration: '2:15', seconds: 135, addedAt: 200 },
      { id: '3', title: 'Mango', artist: 'Alice', duration: '4:30', seconds: 270, addedAt: 300 },
    ];

    it('sorts by date_desc (newest added first)', () => {
      const sorted = sortPlaylistTracks(tracks, 'date_desc');
      assert.deepEqual(sorted.map((t) => t.id), ['3', '2', '1']);
    });

    it('sorts by date_asc (oldest added first)', () => {
      const sorted = sortPlaylistTracks(tracks, 'date_asc');
      assert.deepEqual(sorted.map((t) => t.id), ['1', '2', '3']);
    });

    it('sorts by title_asc (A to Z)', () => {
      const sorted = sortPlaylistTracks(tracks, 'title_asc');
      assert.deepEqual(sorted.map((t) => t.title), ['Apple', 'Mango', 'Zebra']);
    });

    it('sorts by artist_asc (A to Z)', () => {
      const sorted = sortPlaylistTracks(tracks, 'artist_asc');
      assert.deepEqual(sorted.map((t) => t.artist), ['Alice', 'Bob', 'Charlie']);
    });

    it('sorts by duration_asc (shortest duration first)', () => {
      const sorted = sortPlaylistTracks(tracks, 'duration_asc');
      assert.deepEqual(sorted.map((t) => t.id), ['2', '1', '3']);
    });

    it('preserves custom import order', () => {
      const sorted = sortPlaylistTracks(tracks, 'custom');
      assert.deepEqual(sorted.map((t) => t.id), ['1', '2', '3']);
    });

    it('falls back to index order for legacy tracks without addedAt', () => {
      const legacyTracks = [
        { id: 'a', title: 'First' },
        { id: 'b', title: 'Second' },
        { id: 'c', title: 'Third' },
      ];
      const desc = sortPlaylistTracks(legacyTracks, 'date_desc');
      assert.deepEqual(desc.map((t) => t.id), ['c', 'b', 'a']);

      const asc = sortPlaylistTracks(legacyTracks, 'date_asc');
      assert.deepEqual(asc.map((t) => t.id), ['a', 'b', 'c']);
    });
  });
});
