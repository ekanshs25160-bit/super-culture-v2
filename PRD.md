
# Product Requirements Document (PRD): Super Culture (v2.0)

| Document Metadata | Details |
| :--- | :--- |
| **Product Name** | Super Culture |
| **Version** | 2.0.0 (Clean Architecture Rebuild) |
| **Status** | Ready for Implementation |
| **Target Platform** | Desktop Web Application (`1440x1024` reference viewport) |
| **Core Stack** | React / Next.js (Frontend), FastAPI / Node.js (Backend), In-Memory Repository (`MemoryRepo`), YouTube Music API (`ytmusicapi` + `yt-dlp` / `youtubei.js`), WebSockets |

---

## 1. Executive Summary & Vision
**Super Culture** is a desktop-first music streaming application that blends a monochrome fashion-house editorial aesthetic with real-time social listening and AI-driven curation. 

Version 2.0 (`super-culture-v2`) is a ground-up architectural rebuild designed to eliminate legacy state couplings, resolve YouTube Music stream expiration/CORS bottlenecks, and establish a strict, reusable design system across all application views (**Home, Search, Library, Artist, Jam Rooms, Settings**).

---

## 2. Problem Statement & Rebuild Objectives
During the initial prototype phase, direct coupling between the frontend UI and raw YouTube Music API calls introduced several critical issues:
1. **Unreliable Audio Playback:** Direct `googlevideo.com` URLs expired rapidly, suffered from CORS restrictions, and broke HTML5 `<audio>` byte-range seeking.
2. **Slow UI Hydration:** Sequential live calls to YouTube Music endpoints caused layout shift and slow initial load times on the Home canvas.
3. **Low-Resolution Artwork:** Default API thumbnails (`60x60` or `120x120`) degraded the high-fashion editorial visual language.
4. **Fragmented State Management:** Library actions (likes, playlists, mood selection, and live Jam Rooms) lacked a unified, low-latency state layer.

### Core Objectives for v2.0
* **Decouple External APIs via `MemoryRepo`:** Introduce a singleton In-Memory Repository (`MemoryRepo`) with LRU caching to serve UI state in `<15ms` and cache resolved audio streams.
* **Spatial Editorial UI System:** Preserve the open-center canvas where UI modules float around the full-bleed monochrome photography and "Super culture" serif wordmark.
* **Zero-Friction Audio Proxy:** Guarantee instant playback, scrubbing, and queue transitions via a dedicated stream resolver and byte-range proxy endpoint.

---

## 3. Design System & Visual Language

### 3.1 Color Palette
The UI enforces a strict monochrome editorial palette where all vibrant color originates exclusively from album artwork and a single functional accent color:
* **Canvas Base:** Near-Black `#0B0B0C` with a `20%–30%` dark legibility overlay over the unblurred full-bleed background photography.
* **Floating Glass Cards:** Graphite `rgba(20, 20, 22, 0.72)` with `backdrop-filter: blur(24px)`, `1px solid rgba(255, 255, 255, 0.08)` border, `24px` border-radius, `16px–20px` internal padding, and `12px` grid gaps.
* **Highlight Surface:** Pure Editorial White `#FFFFFF` with `#0B0B0C` typography (strictly reserved for 1–2 focal modules such as *"Made for you"* and active segmented pills).
* **Primary Typography:** Off-White `#F4F4F2`.
* **Secondary / Muted Typography:** Warm Grey `#8A8A8E`.
* **Single Functional Accent:** Neon Green `#1ED760` — used **exclusively** for primary play buttons, active navigation edge indicators, live equalizer bars, liked hearts, notification dots, and the playback progress bar.

### 3.2 Typography Hierarchy
* **Display / Editorial Headings:** High-contrast serif (*Playfair Display* / *GT Sectra* / *Canela*) for the hero wordmark (`Super` in italic over upright `culture`) and primary shelf headers (*"Trending Worldwide"*).
* **UI & Body Copy:** Clean geometric sans-serif (*Inter*) for track titles, navigation items, artist names, and controls.
* **Architectural Micro-Labels:** Uppercase monospace (*JetBrains Mono*, `10px`, letter-spaced) for metadata tags (`LIVE JAM ROOMS`, `PLAYING NEXT`, `PUBLIC MODE`, `SUPER CULTURE / MUSIC`, and live local timestamps).

---

## 4. Functional Requirements & UI Modules (Home / Landing Canvas)

The `1440x1024` viewport leaves the center canvas unobstructed so the background photography, thin `1px` white architectural grid lines, and giant serif wordmark remain visible.

### 4.1 Floating Top Bar
* **Left Cluster:**
  * Circular white brand emblem.
  * Frosted glass search pill (`"What do you want to play?"`) supporting instant query debouncing.
  * Green `"Start AI DJ"` action pill (`#1ED760`) with a sparkle icon.
* **Right Cluster:**
  * Segmented privacy toggle pill (`Public | Private`) where the active state renders with a solid white pill background.
  * Dark utility pill housing a notification bell (with `#1ED760` unread dot), settings gear icon, user avatar, and fullscreen toggle button.

### 4.2 Left Column (`~270px` width, stacked vertical cards)
1. **Primary Navigation Card:**
   * Items: **Home** (active state indicated by a vertical `#1ED760` bar on the left edge), **Search**, **Magic Vibe** (sparkle icon), **Recents**, **Followed artists**, and **Downloaded**.
2. **Mood Selector Card:**
   * 4 circular emoji buttons (first button active with yellow fill) paired with dynamic status text: `"I feel Energetic today"`.
   * Clicking any mood updates `MemoryRepo.user_profile.mood` and refreshes personalized shelves.
3. **Library Card:**
   * Header with expand arrow (`↗`) and `+` button to create a new playlist.
   * **Liked Songs** row: Pinned item with purple heart tile and subtitle `"Playlist • 874 songs"`.
   * **Followed Artist** row: Circular avatar with an animated `#1ED760` equalizer icon when currently playing/active.
   * **User Playlists**: Custom and imported playlists with square cover art thumbnails.

### 4.3 Right Column (`~300px` width, stacked vertical cards)
1. **Friend Activity Card:**
   * Displays friend avatar, track title, and artist name.
   * Shows an animated `#1ED760` equalizer for live listeners or a muted grey pill (`"44 min"`, `"3 hr"`) for recently active friends.
   * Includes footer action link: `"See others activity ↗"`.
2. **Live Jam Rooms Card:**
   * Header with `+` button to spin up a new synchronous listening room.
   * **Active State:** Displays 2 active room rows featuring room name, host avatar, active listener count, and a `#1ED760` `"Join"` pill button.
   * **Empty-State Variant:** Clean fallback UI when zero rooms are active (`"No live rooms right now • Start a Jam"`).

### 4.4 Center-Bottom Shelf Row (Floating above Player Bar)
* **Trending Worldwide Card:** Translucent glass card with serif heading and 4 square high-res album covers (`w544-h544`), track titles, and artist names.
* **Curated Genre Stack Cards:** Compact cards for **"Chill Vibes"**, **"Hip Hop Essentials"**, and **"Late Night Drive"**, each displaying 3 overlapping cover thumbnails and a `#1ED760` hover play button.
* **White Highlight Card ("Made for you"):** Far-right high-contrast white card featuring a sparkle icon, daily mix cover art, and a `#1ED760` play button.

### 4.5 Floating Bottom Player Bar (Full-Width, `24px` radius)
* **Left Section (Track Info):**
  * **Active State:** Square album art, track title, artist name, `#1ED760` heart toggle, and `+` add-to-playlist button.
  * **Empty State:** Displays placeholder tile with `"NO TRACK / Select a track"`.
* **Center Section (Transport & Progress):**
  * Controls: Shuffle, Previous, large circular white Play/Pause button, Next, Repeat.
  * Scrubber: Thin `#1ED760` progress bar with current elapsed and total duration timestamps.
* **Right Section (Queue & Hardware Controls):**
  * `"PLAYING NEXT"` monospace pill showing next track thumbnail, title, and queue icon.
  * Volume slider, lyrics toggle icon, and audio output devices icon.

---

## 5. System Architecture & `MemoryRepo` Specification

### 5.1 Directory Structure (`super-culture-v2`)

super-culture-v2/
├── frontend/                   # Next.js / React + Tailwind CSS
│   ├── src/
│   │   ├── components/         # Modular UI: TopBar, LeftNav, MoodCard, LibraryCard, JamRooms, PlayerBar
│   │   ├── store/              # Global Audio & App State (Zustand + HTML5 Audio Controller)
│   │   ├── hooks/              # useAudioStream, useJamSocket, useYTMusic
│   │   └── styles/             # Design tokens (#0B0B0C, #1ED760, glassmorphism utilities)
└── backend/                    # Node.js (Express / Fastify)
    ├── server.js               # Application entry point & WebSocket server
    ├── routers/                # ytmusic, library, social, aidj
    ├── repositories/
    │   └── memory_repo.js      # Singleton In-Memory Store + LRU Stream Cache
    └── services/
        └── yt_service.js       # youtubei.js stream resolver & thumbnail upscaler


### 5.2 In-Memory Repository (`MemoryRepo`) Data Models

| Store Key | Type / Structure | TTL / Persistence | Description |
| --- | --- | --- | --- |
| `stream_cache` | `Map<videoId, StreamEntry>` | 4 Hours (LRU) | Caches direct audio URLs (`m4a`/`webm`), MIME types, and expiry timestamps. |
| `metadata_cache` | `Map<videoId, TrackMeta>` | Session + JSON Snapshot | Normalized track title, artist, duration, and upscaled `544x544` artwork URL. |
| `home_shelves` | `Map<shelfId, List<TrackMeta>>` | 1 Hour | Pre-warmed data for *Trending Worldwide*, *Chill Vibes*, *Hip Hop Essentials*, and *Late Night Drive*. |
| `user_profile` | `{ mode: 'public'|'private', mood: string }` | Persistent JSON | Controls Top Bar privacy state and Left Column Mood state. |
| `liked_songs` | `OrderedSet<videoId>` | Persistent JSON | Drives the pinned *Liked Songs* counter (`874 songs`) and Player Bar heart state. |
| `playlists` | `Map<playlistId, Playlist>` | Persistent JSON | Stores user-created playlists and track arrays. |
| `followed_artists` | `Map<browseId, ArtistMeta>` | Persistent JSON | Tracks followed artists and whether their tracks are currently spinning. |
| `play_history` | `Deque<TrackMeta>` (Max 100) | Persistent JSON | Powers the *Recents* tab and seeds the AI DJ queue generator. |
| `jam_rooms` | `Map<roomId, JamRoomState>` | Ephemeral (Real-time) | Active rooms (`id`, `name`, `host`, `listeners[]`, `videoId`, `position`, `isPlaying`). |
| `friend_activity` | `List<FriendStatus>` | Ephemeral / Simulated | Tracks friend playback status (`isLive`, `track`, `lastActiveMinutes`). |

---

## 6. API & WebSocket Specification

### 6.1 YouTube Music Proxy & Streaming (`/api/yt`)

| Method | Endpoint | Request / Params | Response & Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/yt/home-shelves` | None | Returns pre-warmed shelves from `MemoryRepo.home_shelves`. If cold, fetches from `ytmusicapi`, upscales artwork, caches, and returns. |
| `GET` | `/api/yt/search` | `?q={query}&filter={songs|artists|albums}` | Queries `ytmusic.search()`, normalizes cover URLs to `=w544-h544-l90-rj`, caches metadata in `MemoryRepo`, and returns results. |
| `GET` | `/api/yt/stream/{videoId}` | `Headers: Range: bytes=...` | Checks `MemoryRepo.stream_cache`. Extracts audio via `yt-dlp` (`bestaudio[ext=m4a]/bestaudio`) on cache miss and proxies byte-range chunks (`206 Partial Content`) to prevent CORS issues. |
| `GET` | `/api/yt/up-next/{videoId}` | None | Calls `ytmusic.get_watch_playlist(videoId)`. Populates the Player Bar `"PLAYING NEXT"` pill and playback queue. |
| `GET` | `/api/yt/lyrics/{videoId}` | None | Resolves `lyrics` browseId from watch playlist and returns synchronized or plain lyrics. |
| `GET` | `/api/yt/artist/{browseId}` | None | Fetches artist header, monthly listeners, top tracks, and discography for the Artist View. |

### 6.2 User Library, Mood & AI DJ (`/api/library` & `/api/vibe`)

| Method | Endpoint | Payload | Response & Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/library/overview` | None | Returns `liked_songs` count, `followed_artists`, `playlists`, and current `user_profile`. |
| `POST` | `/api/library/likes/{videoId}` | `{ trackMeta?: TrackMeta }` | Toggles `videoId` in `MemoryRepo.liked_songs` and returns updated boolean status + total count. |
| `POST` | `/api/library/playlists` | `{ name: string, description?: string }` | Creates a new playlist in `MemoryRepo.playlists` (`+` button in Library card). |
| `POST` | `/api/library/playlists/{id}/tracks` | `{ videoId: string }` | Appends track to specified playlist (`+` button in Player Bar). |
| `GET` | `/api/library/recents` | None | Returns the `MemoryRepo.play_history` deque. |
| `POST` | `/api/library/recents` | `{ videoId: string }` | Triggered after 15s of continuous playback; pushes track to the top of `play_history`. |
| `POST` | `/api/vibe/mood` | `{ mood: 'energetic'|'chill'|'melancholy'|'focus' }` | Updates `MemoryRepo.user_profile.mood` and recalculates the **"Made for you"** highlight card. |
| `POST` | `/api/vibe/ai-dj` | None | Combines current `mood` + top 5 `play_history` seeds with `ytmusic.get_watch_playlist(radio=True)` to return a 20-track AI DJ queue. |

### 6.3 Social, Privacy & Jam Rooms (`/api/social` & `/ws`)

| Method | Endpoint | Payload | Response & Behavior |
| --- | --- | --- | --- |
| `PATCH` | `/api/social/mode` | `{ mode: 'public' | 'private' }` | Updates privacy state. When `private`, suppresses user playback updates to `friend_activity`. |
| `GET` | `/api/social/friends` | None | Returns list of friend statuses for the **Friend Activity** card. |
| `GET` | `/api/social/jam-rooms` | None | Returns active rooms array (or `[]` to render the empty-state variant). |
| `POST` | `/api/social/jam-rooms` | `{ name: string, initialTrackId?: string }` | Creates a new room in `MemoryRepo.jam_rooms` and assigns caller as host. |
| `POST` | `/api/social/jam-rooms/{roomId}/join` | `{ userId: string, name: string }` | Adds user to room listener list and returns initial sync payload (`videoId`, `timestamp`, `isPlaying`). |
| `WS` | `/ws/jam/{roomId}` | `{ type: 'PLAY'|'PAUSE'|'SEEK'|'TRACK_CHANGE', payload }` | Broadcasts playback state mutations across connected room members with `<150ms` drift tolerance. |

---

## 7. Technical Safeguards (Lessons Learned from v1)

1. **Automated Artwork Upscaling Pipeline:**
Every thumbnail URL ingested from `ytmusicapi` must pass through `upscale_thumbnail(url)` in `yt_service.py`, replacing `=w60-h60` or `=w120-h120` patterns with `=w544-h544-l90-rj` before hitting `MemoryRepo`.
2. **Stream Pre-Fetching for "Playing Next":**
When a track reaches `75%` progress (or within 20 seconds of completion), the frontend silently triggers a background warmup request for the `"PLAYING NEXT"` `videoId` so `MemoryRepo.stream_cache` resolves the next URL before track transition.
3. **Graceful Degradation & Empty States:**
* If `MemoryRepo.jam_rooms` is empty, the **Live Jam Rooms** card renders its dedicated empty-state CTA rather than collapsing the right column layout.
* On cold boot prior to user selection, the **Player Bar** cleanly renders the `"NO TRACK / Select a track"` state with disabled transport controls.


4. **JSON Snapshot Persistence:**
While `MemoryRepo` runs in RAM for zero-latency reads, a background worker flushes user mutations (`liked_songs`, `playlists`, `play_history`, `user_profile`) to a local `data/memory_snapshot.json` file on disk so state survives server restarts.

---

## 8. Implementation Milestones

* **Phase 1: Backend Core & `MemoryRepo` Setup**
* Initialize `super-culture-v2/backend`, implement `MemoryRepo` with JSON snapshot persistence, and build the `yt_service.py` wrapper with thumbnail upscaling and byte-range audio streaming.


* **Phase 2: Design System & Static Shell (`1440x1024`)**
* Build the full-bleed background canvas, architectural grid lines, typography tokens, and all 5 floating UI zones (Top Bar, Left Column, Right Column, Center-Bottom Shelves, and Bottom Player Bar).


* **Phase 3: Audio Engine & API Wiring**
* Connect the HTML5 `<audio>` controller to `/api/yt/stream/{videoId}`, wire up the Search pill, Home shelves, Liked Songs toggle, Mood selector, and `"Start AI DJ"` queue builder.


* **Phase 4: Real-Time Social & Jam Rooms**
* Implement the `Public | Private` toggle, Friend Activity polling, and WebSocket synchronization for Live Jam Rooms (including active and empty states).

---

## 9. What You Would Need to Build / Change to 100% Satisfy the v2.0 PRD

To transition from the initial prototype phase to full, 100% compliance with the v2.0 specification, the engineering team must execute the following architectural replacements and UI module implementations.

### 9.1 Delta & Transformation Summary Matrix

| Architectural Domain | Legacy Prototype Implementation (v1) | Target v2.0 Specification Requirement | Primary Deliverables & Impact |
| :--- | :--- | :--- | :--- |
| **Audio Streaming Engine** | Headless YouTube IFrame API (`YT.Player`), brittle postMessage/state polling, no raw byte access. | Dedicated backend `yt-dlp` audio resolver, byte-range proxy (`/api/yt/stream/{videoId}`), and HTML5 `<audio>` player with pre-fetching. | Eliminates iframe overhead, enables sub-second scrubbing, avoids YouTube CORS/expiration, ensures gapless queue transitions. |
| **Backend Repository Layer** | Direct SQLite database queries via SQLAlchemy ORM; blocking disk I/O on audio/social routes. | Singleton `MemoryRepo` (in-memory dicts/maps with LRU cache) backed by asynchronous `data/memory_snapshot.json` disk persistence. | Reduces API read latency to `<15ms`, centralizes real-time state, and decouples external rate limits. |
| **Real-Time Jam Rooms** | 2-second HTTP polling loop (`GET /api/social/jam-rooms`), causing high latency jitter and clock drift. | Bi-directional `/ws/jam/{roomId}` WebSocket channels with host-driven broadcast synchronization. | Real-time state replication (`<150ms` drift tolerance) for playback transport, track changes, and active listener counts. |
| **UI: Left Navigation** | Basic flat vertical link list; missing mood-based contextual controls. | Dedicated **Mood Selector Card** with 4 circular emoji buttons and live status copy (`"I feel Energetic today"`). | Direct state synchronization with `MemoryRepo.user_profile.mood` and dynamic re-hydration of personalized shelves. |
| **UI: Home Shelves** | Uniform card grids without editorial focal hierarchy or genre depth. | High-contrast **"Made for you"** Editorial White Card (`#FFFFFF`) and Curated Genre Stack Cards with 3 overlapping album covers. | Establishes luxury editorial magazine aesthetic with clear visual anchor point and interactive `#1ED760` hover triggers. |
| **UI: Bottom Player Bar** | Standard 3-button transport bar with static track label; no queue visibility. | Architectural `"PLAYING NEXT"` monospace metadata pill and dedicated lyrics toggle button. | Real-time queue transparency, upcoming stream pre-fetching trigger, and synchronized lyric view. |
| **UI: Right Column Sidebar** | Monolithic combined social container without distinct listening room states. | Two distinct, stacked modular cards: **Friend Activity Card** and **Live Jam Rooms Card** with explicit empty-state fallback. | Clear separation of asynchronous social listening from synchronous live jam sessions; prevents UI collapse on zero rooms. |

---

### 9.2 Audio Streaming Engine: IFrame Elimination & Byte-Range Streaming
* **Problem in Legacy Stack:** The headless YouTube IFrame player (`iframe_api`) introduces substantial DOM overhead, suffers from playback initialization delays, blocks custom Web Audio API integration, and is prone to broken playback states due to video player ad injections and cross-origin security restrictions.
* **v2.0 Implementation Requirements:**
  1. **Backend Audio Extraction & Stream Resolver:**
     * Integrate `yt-dlp` (or `youtubei.js`) within `backend/services/yt_service.py` to resolve direct streaming URLs (`bestaudio[ext=m4a]/bestaudio`).
     * Cache resolved stream URLs with audio metadata in `MemoryRepo.stream_cache` with a 4-hour sliding TTL.
  2. **Byte-Range Proxy Controller (`GET /api/yt/stream/{videoId}`):**
     * Implement an HTTP streaming proxy endpoint in FastAPI/Node.js supporting standard `Range: bytes=start-end` headers.
     * Stream partial content via `206 Partial Content` with `Content-Type: audio/mp4` (or `audio/webm`), streaming chunks directly from upstream CDN servers while preserving client-side scrubbing.
  3. **Frontend HTML5 `<audio>` Engine (`useAudioStream`):**
     * Replace `YT.Player` with a native HTML5 `<audio>` element managed by a central Zustand audio store.
     * Bind native playback events (`timeupdate`, `loadeddata`, `ended`, `error`, `progress`) directly to the Player Bar UI state.
  4. **Proactive Stream Pre-Fetching Pipeline:**
     * Monitor active track playback progress. When elapsed duration hits `75%` (or `<20s` remaining), dispatch a silent background warm-up request to `/api/yt/stream/{nextVideoId}`.
     * Ensure the upcoming track URL is already pre-resolved in `MemoryRepo.stream_cache` to deliver instantaneous, zero-latency track transitions.

---

### 9.3 Backend Repository Layer: Transition from SQLite/SQLAlchemy to `MemoryRepo`
* **Problem in Legacy Stack:** Direct SQLite read/write operations for high-frequency operations (metadata lookups, like toggles, friend listening state, playback position tracking) create disk I/O bottlenecks and complicate atomic synchronization across real-time sessions.
* **v2.0 Implementation Requirements:**
  1. **In-Memory Store Architecture (`backend/repositories/memory_repo.py`):**
     * Construct a singleton `MemoryRepo` class maintaining native in-memory data structures:
       * `stream_cache`: LRU cache mapping `videoId` to resolved audio stream URLs and expiry timestamps.
       * `metadata_cache`: Hash map of normalized track metadata with upscaled `544x544` artwork.
       * `home_shelves`: In-memory shelf cache for instant cold-boot canvas rendering.
       * `user_profile`: User preferences including privacy mode (`public` / `private`) and current `mood`.
       * `liked_songs`: `OrderedSet` or map of liked video IDs and timestamps.
       * `playlists`: In-memory playlist registry with mutable track sequences.
       * `play_history`: Bounded `deque` (last 100 tracks) powering recents and AI DJ seed generation.
       * `jam_rooms`: Active collaborative listening room sessions.
       * `friend_activity`: Ephemeral social listener status feed.
  2. **Sub-15ms Read Performance:**
     * Route all UI query endpoints (`/api/yt/home-shelves`, `/api/library/overview`, `/api/social/friends`) strictly through `MemoryRepo` without touching disk storage.
  3. **Asynchronous JSON Snapshot Persistence:**
     * Implement a persistence worker that serializes critical state (`liked_songs`, `playlists`, `user_profile`, `play_history`) to disk at `data/memory_snapshot.json`.
     * Execute writes asynchronously on state mutations (debounced at 1–2 seconds) and flush gracefully on server shutdown (`SIGTERM`/`SIGINT`).
     * On application startup, warm `MemoryRepo` directly from `memory_snapshot.json` before accepting incoming HTTP/WS traffic.

---

### 9.4 Real-Time Jam Rooms: Transition from HTTP Polling to WebSockets
* **Problem in Legacy Stack:** The 2-second HTTP polling loop (`GET /api/social/jam-rooms` or `/api/jam/{roomId}`) produces high server request volume, creates a jagged listener experience with audible sync drift between participants, and causes state lag during track changes and scrubbing.
* **v2.0 Implementation Requirements:**
  1. **WebSocket Channel Architecture (`/ws/jam/{roomId}`):**
     * Implement persistent WebSocket endpoints using FastAPI (`APIRouter.websocket`) or `ws` in Node.js.
     * Maintain active connection pools grouped by `roomId` in `MemoryRepo.jam_rooms`.
  2. **Bidirectional Protocol & Event Handlers:**
     * **Host Commands:** Broadcast `PLAY`, `PAUSE`, `SEEK`, and `TRACK_CHANGE` events immediately to all connected peers.
     * **Client Synchronization:** Clients maintain local playback alignment within `<150ms` drift of the host timestamp, automatically seeking if local audio time deviates beyond the threshold.
     * **Presence Management:** Broadcast `USER_JOINED` and `USER_LEFT` events to update live listener counters and participant avatar rows in real time.
  3. **Graceful Disconnect & Room Cleanup:**
     * When the host leaves or disconnects, either promote the next active listener to host or transition the room to an inactive state after a 60-second grace window.
     * Automatically update the **Live Jam Rooms Card** count and trigger empty states when all rooms close.

---

### 9.5 UI & Visual Shell Enhancements (PRD 4.1–4.5 Compliance)
To reach 100% visual and interactive fidelity with the reference editorial layout, the following discrete UI components and structural layouts must be built into the frontend:

#### 1. Mood Selector Card (PRD 4.2 - Left Navigation)
* **Location:** Directly below the Primary Navigation Card in the Left Column (`~270px` width).
* **Components:**
  * Container: Translucent glass card (`rgba(20, 20, 22, 0.72)` with `backdrop-filter: blur(24px)` and `24px` border-radius).
  * 4 Circular Emoji Buttons: Energetic (⚡ / 🔥), Chill (☕ / 🌴), Melancholy (🌧️ / 🌙), and Focus (🎯 / 🎧).
  * Active State: Vibrant background fill (e.g. yellow highlight on default active button) with smooth scale micro-animation on hover/press.
  * Contextual Status Label: Dynamic typography string updating based on selection (e.g., `"I feel Energetic today"`).
* **Interactivity:** Clicking any mood dispatches `POST /api/vibe/mood`, immediately mutating `MemoryRepo.user_profile.mood` and triggering a re-render of personalized shelf recommendations.

#### 2. Editorial Highlight & Overlapping Stacks (PRD 4.4 - Center-Bottom Shelves)
* **Location:** Center-bottom horizontal shelf row floating directly above the bottom Player Bar.
* **"Made for you" High-Contrast White Card:**
  * Visual Treatment: Pure Editorial White surface (`#FFFFFF`) with dark near-black typography (`#0B0B0C`), serving as the visual anchor of the shelf row.
  * Elements: Top row with sparkle icon and `"Made for you"` label, center daily mix cover artwork, and prominent circular neon green play button (`#1ED760`).
* **Curated Genre Stack Cards:**
  * Cards for **"Chill Vibes"**, **"Hip Hop Essentials"**, and **"Late Night Drive"**.
  * Overlapping Cover Art: Each card showcases 3 offset, overlapping square album thumbnails with slight drop-shadows and subtle hover expansion.
  * Neon Green Hover Play Button: Floating `#1ED760` circular play button revealing on card hover.

#### 3. "PLAYING NEXT" Metadata Pill & Lyrics Integration (PRD 4.5 - Bottom Player Bar)
* **Location:** Right Section of the full-width floating Bottom Player Bar (`24px` radius).
* **"PLAYING NEXT" Monospace Metadata Pill:**
  * Styling: Compact frosted pill featuring uppercase monospace typography (`JetBrains Mono`, `10px`, letter-spaced).
  * Content: Miniature square thumbnail (`24x24`) of the upcoming track, next track title, and queue drawer toggle icon.
  * Integration: Data-bound to `/api/yt/up-next/{videoId}` and acts as the trigger for automated stream pre-fetching.
* **Lyrics & Device Controls:**
  * Dedicated lyrics toggle button positioned next to the volume slider, triggering synchronized or plain text lyric overlay via `/api/yt/lyrics/{videoId}`.
  * Output device routing icon and interactive volume slider with neon green fill level.

#### 4. Right Sidebar Modularization & Empty-State Fallback (PRD 4.3 - Right Column)
* **Location:** Right Column (`~300px` width), replacing monolithic right rail with two separate glassmorphic cards:
* **Card 1: Friend Activity Card:**
  * Header with live presence count and footer action: `"See others activity ↗"`.
  * Rows displaying friend avatars, track names, artist credits, and either an animated `#1ED760` multi-bar equalizer (for active listeners) or muted grey time-ago pills (`"44 min"`, `"3 hr"`).
* **Card 2: Live Jam Rooms Card:**
  * Header with `+` action button to open the "Create a Jam Room" modal.
  * **Active State:** Renders active room rows with room title, host avatar, listener count badges, and `#1ED760` `"Join"` action pills.
  * **Empty-State Fallback:** When zero rooms are active in `MemoryRepo.jam_rooms`, renders an elegant fallback card (`"No live rooms right now • Start a Jam"`) with a centered secondary CTA button, maintaining the structural column layout without collapsing.

---

### 9.6 Definition of Done (DoD) for 100% v2.0 Compliance

To certify that `super-culture-v2` is 100% complete and satisfies all PRD criteria, the build must pass the following verification checklist:

- [ ] **Zero Headless IFrames:** DOM contains 0 instances of YouTube IFrame players; all audio originates from `<audio>` elements consuming `/api/yt/stream/{videoId}`.
- [ ] **Byte-Range Scrubbing Verification:** Audio scrubber responds instantly with `206 Partial Content` responses and sub-100ms audio resumption across any timeline position.
- [ ] **Pre-Fetching Continuity:** Track transitions occur with `<50ms` gap when reaching the end of a song due to automated pre-fetching of the `"PLAYING NEXT"` item.
- [ ] **Zero SQL Queries:** No SQLite or SQLAlchemy dependencies exist in the backend runtime path; all state resides in `MemoryRepo`.
- [ ] **Persistence Verification:** Modifying liked songs, creating a playlist, and changing mood updates `data/memory_snapshot.json` within 2 seconds; state restores completely upon server reboot.
- [ ] **Real-Time WebSocket Sync:** Two or more browser clients connected to `/ws/jam/{roomId}` stay synchronized in playback state and timeline position within `150ms`.
- [ ] **Pixel-Perfect Spatial Shell:**
  - [ ] Left column displays Mood Selector card with 4 emoji buttons and reactive text.
  - [ ] Center-bottom shelf displays the white "Made for you" card and 3-card overlapping stacks with hover play buttons.
  - [ ] Bottom Player Bar displays the `"PLAYING NEXT"` pill and lyrics toggle button.
  - [ ] Right column cleanly renders separate Friend Activity and Live Jam Rooms cards, with the empty-state fallback displaying when no rooms are active.


