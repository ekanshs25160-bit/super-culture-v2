<div align="center">

# Super Culture

**An editorial, dark-mode music streaming client and standalone Android player.**  
Stream unthrottled audio, import playlists via CSV, cache tracks for offline playback, and listen seamlessly across Desktop Web and Standalone Android.

[![Android APK](https://img.shields.io/github/v/release/ekanshs25160-bit/super-culture-v2?color=22c55e&label=Android%20APK&logo=android&logoColor=white)](https://github.com/ekanshs25160-bit/super-culture-v2/releases/latest)
[![Release Workflow](https://img.shields.io/github/actions/workflow/status/ekanshs25160-bit/super-culture-v2/android-release.yml?label=APK%20Build&logo=github)](https://github.com/ekanshs25160-bit/super-culture-v2/actions)
[![Platforms](https://img.shields.io/badge/Platforms-Android%20%7C%20Web%20%7C%20Docker%20%7C%20PWA-09090b)](#platform-availability--how-to-get-it)

</div>

---

## Platform Availability & How to Get It

Super Culture is available across three environments depending on how you listen:

| Platform | Independence | Best For | How to Get It |
| :--- | :--- | :--- | :--- |
| **1. Android App (APK)** | **100% Standalone** *(No laptop or backend server required)* | Daily mobile listening, lock-screen playback, cellular/Wi-Fi streaming, on-device playlists & offline downloads | Download the latest signed `.apk` from **[GitHub Releases](https://github.com/ekanshs25160-bit/super-culture-v2/releases/latest)** |
| **2. Desktop Web** *(macOS, Windows, Linux)* | **Self-Hosted** *(Node.js + SQLite or Docker)* | Desktop listening, keyboard-driven navigation, `.m4a` file exports, SQLite library sync, and Gemini AI discovery | Run locally via `npm run dev` or `docker build` (see **[Quick Start](#quick-start-desktop-web--backend)**) |
| **3. Mobile Web / PWA** *(iOS & LAN/Tailscale)* | **Tethered to Home Server** | iPhone/iPad users or local network streaming without installing an APK | Host the backend on your computer, connect over LAN or Tailscale HTTPS, and tap **Add to Home Screen** |

---

### Getting the Android App (Standalone APK)

1. Go to the **[Latest GitHub Release](https://github.com/ekanshs25160-bit/super-culture-v2/releases/latest)** on your Android phone and download the `.apk` asset.
2. Open the downloaded file and allow installation from your browser/file manager if prompted.
3. **Grant Notification Permission (Android 13+):** Allow notifications on first launch so the lock-screen media controls and foreground playback service can display.
4. **Updating:** Whenever a new version ships, an in-app update banner (or **Settings → Check for Updates**) lets you download and install the latest APK directly in place without losing your playlists, liked tracks, or offline downloads.

---

## Key Features

* **Unthrottled Standalone Audio Engine:**
  * Resolves direct `audio/mp4` (`mp4a` / `itag=140`) streams using the `VISIONOS` player client paired with watch-page `visitorData` tokens and a 1.5 MiB deep byte-range probe.
  * Streams through a bounded **1 MiB chunked proxy** (`chunkedProxy.ts` on Node / `LocalStreamProxy.kt` on Android `127.0.0.1`) to prevent CDN range throttling and mid-track stalls.
* **Lock-Screen Playback & Zero-Await Auto-Advance:**
  * Native Android `MediaPlaybackService` holds a bounded `PARTIAL_WAKE_LOCK`, Wi-Fi high-performance lock, and `MediaSession` notification so the OS never suspends playback when the screen is off.
  * Pre-resolves the upcoming track URL (`preloadNextStreamUrl`) while the current track is playing so track transitions occur synchronously in a single tick.
* **Deterministic Shuffle & Repeat (`off` | `all` | `one`):**
  * Shuffling deterministically reorders the active queue while preserving the original queue in memory, ensuring the lock-screen preloader always pre-fetches the true next track.
* **Universal CSV Playlist Importer:**
  * Upload `.csv` exports from **Spotify (Exportify)**, **TuneMyMusic**, **Soundiiz**, **Apple Music**, or generic CSV files.
  * Automatically matches tracks in batches with live progress, normalizes artist names and millisecond durations (`m:ss`), and saves playlists to SQLite (Web) or local storage (Android).
* **Playlist Sorting & High-DPI Responsive UI:**
  * Sort playlists by **Date Added (Newest / Oldest)**, **Import Order**, **Title (A–Z)**, **Artist (A–Z)**, or **Duration**.
  * Fluid Flexbox layouts and Android 15 (`targetSdk 36`) edge-to-edge safe-area insets ensure controls remain accessible even under large OS font and display scaling.
* **Offline Downloads & `.m4a` Export:**
  * Cache tracks for zero-internet playback in the **Downloaded** view (stored on-device on Android and in **IndexedDB** on Desktop Web, with one-click `.m4a` file export on desktop).
* **AI Discovery & Magic Vibe (Web/Backend):**
  * Generate personalized queues and mood-based recommendations powered by the Google Gemini API.

---

## Desktop Keyboard Shortcuts

When using the Desktop Web app (outside of text inputs):

| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause |
| `→` / `←` | Seek Forward `+5s` / Backward `-5s` |
| `N` or `Shift + →` | Next Track |
| `P` or `Shift + ←` | Previous Track |
| `S` | Toggle Shuffle |
| `R` | Cycle Repeat Mode (`Off` → `All` → `One`) |
| `M` | Toggle Mute |

Hardware media keys (Play/Pause, Next, Previous) on macOS, Windows, Linux, and Bluetooth headphones are also supported via `navigator.mediaSession`.

---

## Architecture Overview

Super Culture shares a single React codebase (`frontend/src/`) across Web and Android, dynamically routing API and media calls based on `Capacitor.isNativePlatform()`:

| Responsibility | Desktop / Mobile Web | Standalone Android APK |
| :--- | :--- | :--- |
| **Stream Resolution** | `backend/src/services/ytService.ts` | `frontend/src/services/nativeYtClient.js` via `CapacitorHttp` |
| **1 MiB Chunked Proxy** | `backend/src/services/chunkedProxy.ts` (`/api/yt/stream/:id`) | `LocalStreamProxy.kt` (`http://127.0.0.1:<port>/stream`) |
| **Search, Shelves & Up-Next** | `backend/src/controllers/musicController.ts` | `frontend/src/services/nativeYtClient.js` |
| **Background / Media Controls** | Browser `navigator.mediaSession` (`useMediaSession.js`) | `MediaPlaybackService.kt` + `StreamProxyPlugin.kt` |
| **Playlists, Likes & History** | Backend SQLite (`backend/src/db/schema.ts`) | On-device persistence (`useLibraryStore.js`) |
| **Offline Audio Storage** | Browser IndexedDB + `.m4a` download | On-device storage |

---

## Quick Start (Desktop Web & Backend)

### Prerequisites
* **Node.js** `v20+` and `npm`
* *(Optional)* **JDK 21** and **Android SDK** (only needed if building the Android APK locally)

### 1. Clone & Configure Environment
```bash
git clone [https://github.com/ekanshs25160-bit/super-culture-v2.git](https://github.com/ekanshs25160-bit/super-culture-v2.git)
cd super-culture-v2
cp .env.example backend/.env
Edit backend/.env to configure your port, stream secret, and optional Gemini API key:

Code snippet
PORT=5001
STREAM_SECRET=replace-with-a-random-secret
GEMINI_API_KEY=your-gemini-api-key-optional
ALLOW_PRIVATE_NETWORK_ORIGINS=true
```
2. Install Dependencies & Run Development Servers
```bash
# Install and start the Node/TypeScript backend (http://localhost:5001)
cd backend
npm install
npm run dev
```
In a second terminal:

```bash
# Install and start the React/Vite frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```
Open http://localhost:3000 in your browser.

3. Run with Docker (Optional)
```bash
docker build -t super-culture .
docker run -d -p 5001:5001 --env-file backend/.env -v $(pwd)/backend/data:/app/backend/data super-culture
```
Building the Standalone Android APK from Source
To build the standalone Android APK (which runs without the backend server):
```bash
cd frontend

# 1. Build the frontend bundle without a hardcoded VITE_API_URL
npm run build

# 2. Sync web assets and Capacitor plugins to the Android project
npx cap sync android

# 3. Assemble the debug APK (or open in Android Studio with: npx cap open android)
cd android
./gradlew assembleDebug
```
The compiled APK will be generated at:frontend/android/app/build/outputs/apk/debug/app-debug.apk

Updating Launcher Icons & Splash Screens
Place a 1024x1024 PNG at frontend/assets/icon.png (and 2732x2732 PNG at frontend/assets/splash.png), then run:

```bash
cd frontend
npm run generate:assets
npx cap sync android
```
Running Tests
```bash
# Backend unit & integration tests (Vitest)
npm test --prefix backend

# Frontend unit tests (Vitest — player engine, CSV parser, shuffle/repeat, offline store, updates)
npm test --prefix frontend

# Android Kotlin unit & security tests (JUnit — LocalStreamProxy range matrix, SSRF guard, WakeLock)
cd frontend/android && ./gradlew testDebugUnitTest
```
Release Pipeline (GitHub Actions)
Signed Android releases are automated via .github/workflows/android-release.yml:

Configure four repository secrets under GitHub Settings → Secrets and variables → Actions:

ANDROID_KEYSTORE_BASE64

ANDROID_KEYSTORE_PASSWORD

ANDROID_KEY_ALIAS

ANDROID_KEY_PASSWORD

Bump the version in frontend/package.json, commit, and push a matching v* tag:

```bash
npm version patch --prefix frontend --no-git-tag-version
VERSION=$(node -p "require('./frontend/package.json').version")
git add frontend/package.json
git commit -m "chore(release): v$VERSION"
git tag "v$VERSION"
git push origin main --tags
```
GitHub Actions runs the Backend, Frontend, and Android unit test suites, compiles and signs the minified release APK, and publishes it to GitHub Releases, where installed apps detect it via the in-app update checker.

## Privacy & Security
Direct On-Device Connections: In standalone Android mode, the app communicates directly from your phone to YouTube (youtube.com, music.youtube.com, and *.googlevideo.com) to resolve catalog data and audio streams. No intermediate tracking or relay server is used.

Hardened Local Loopback Proxy (LocalStreamProxy.kt):

Binds strictly to 127.0.0.1 on an ephemeral port.

Requires a cryptographically random per-launch secret token (?k=<uuid>) verified in constant time on every request.

Enforces an upstream allowlist permitting only https://*.googlevideo.com on port 443 and blocks loopback, link-local, site-local, and multicast IP resolutions to prevent SSRF and DNS rebinding.

Restricts CORS headers strictly to the local Capacitor WebView origin (http://localhost / https://localhost).

Local Data & Cloud Backup Disabled: Playlists, liked songs, playback history, cached offline audio, and short-lived visitorData tokens are stored locally on your device. Android cloud auto-backup is explicitly disabled (android:allowBackup="false") so local app state is never uploaded to third-party cloud backups.