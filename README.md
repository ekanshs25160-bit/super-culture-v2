# Super Culture v2

> A personal, glassmorphic music streaming platform powered by YouTube's audio engine and AI curation.

---

## ✨ Features

- **Personalized AI Magic Vibe DJ**: Powered by Google Gemini GenAI, creating personalized vibe-matched playlists, transition mixes, and mood-adaptive curation.
- **Color-Extracted Audio Auras**: Dynamic, aesthetic aura visualizations generated from your listening history, genre distributions, and liked music.
- **OLED Glassmorphic UI**: Ultra-clean dark aesthetic with fluid animations, interactive gestures, and responsive spatial navigation.
- **Mobile-First Experience & PWA**: Mobile mini-player expanding to a full-screen swipeable Now Playing sheet, $\ge 44\text{px}$ touch targets, safe-area inset preservation, and installable as a standalone Progressive Web App.
- **Background Playback & Lock-Screen Controls**: Integrated with the Web Media Session API for album art, play/pause, seek, and track skip actions from mobile lock screens.
- **Dual Playback Engine with Auto-Fallback**: Seamless switching between HTML5 `<audio>` and headless YouTube player for maximum device compatibility.
- **Single-Port Architecture**: Express serves the compiled React single-page app, REST API endpoints, and WebSocket sync from a single port (`5001`).
- **Synchronized Live Jam Rooms**: Real-time collaborative listening sessions synchronized across participants via low-latency WebSockets.
- **Multi-Tier Edge Caching & SWR**: Stale-While-Revalidate caching across home shelves, discographies, and up-next queues with in-flight request de-duplication.
- **Local-First Security & Threshold Limits**: Strict CORS allowlists, optional signed HTTP-only cookie passcode gate, rate limiting, and daily AI cost caps.

---

## 📋 Prerequisites

- **Node.js**: `v18.0.0` or higher (Node 20+ recommended) and `npm`
- *or* **Docker**: Docker Engine 20+ and Docker Compose (optional)

---

## 🐳 Quickstart (Docker)

The fastest way to spin up the entire application using the single-port production container:

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/super-culture-v2.git
cd super-culture-v2

# 2. Configure environment variables
cp .env.example .env
# Edit .env and insert your GEMINI_API_KEY (optional, for AI features)

# 3. Build the container
docker build -t super-culture-v2 .

# 4. Run the container
docker run -d \
  --name super-culture \
  -p 5001:5001 \
  -v $(pwd)/backend/data:/app/backend/data \
  --env-file .env \
  super-culture-v2

# 5. Open your browser
# Navigate to http://localhost:5001
```

---

## 💻 Quickstart (Local Development)

### Concurrent Mode (HMR Development)

```bash
# 1. Clone & enter repository
git clone https://github.com/<your-username>/super-culture-v2.git
cd super-culture-v2

# 2. Configure environment
cp .env.example .env

# 3. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 4. Run services
# Terminal 1: Backend API & WebSocket Server (port 5001)
cd backend && npm run dev

# Terminal 2: Frontend Vite Dev Server with HMR (port 3000)
cd frontend && npm run dev
```

Visit `http://localhost:3000` for development with Hot Module Replacement.

### Single-Port Production Mode (Local)

To run the unified server locally without Docker:

```bash
# 1. Build frontend assets
cd frontend && npm run build

# 2. Build and start backend server
cd ../backend && npm run build
npm start
```

Visit `http://localhost:5001` to access both frontend and backend through a single port.

---

## 📱 Mobile Access & PWA Installation

You can run Super Culture v2 directly on your phone as a full-screen, standalone application:

1. **Find your computer's Local IP address**:
   - **macOS**: Run `ipconfig getifaddr en0` (Wi-Fi)
   - **Linux**: Run `hostname -I | awk '{print $1}'`
   - **Windows**: Run `ipconfig` and look for `IPv4 Address`
   *(Example: `192.168.1.45`)*

2. **Connect to the same Wi-Fi**:
   Ensure your phone is connected to the same local Wi-Fi network as the host computer.

3. **Open the browser on your phone**:
   Navigate to:
   ```text
   http://<YOUR_LOCAL_IP>:5001
   ```
   *(e.g., `http://192.168.1.45:5001`)*

4. **Install as a PWA**:
   - **iOS (Safari)**: Tap the **Share** button $\rightarrow$ Select **"Add to Home Screen"**.
   - **Android (Chrome)**: Tap the menu $\rightarrow$ Select **"Add to Home screen"** or **"Install app"**.

Once launched from your home screen, the app runs standalone without browser chrome, supports swipe gestures, keeps playback alive across tabs, and enables lock-screen playback controls.

---

## 🚀 Render Deployment Guide & Cold-Start Behavior

The Super Culture backend is optimized for zero-cost deployment on platforms like Render:

### 1. Free-Tier Cold-Start Behavior
- **Container Sleep Cycle**: On Render's Free tier, the web service automatically spins down ("sleeps") after **15 minutes** of HTTP inactivity.
- **Cold Start Duration**: When a sleeping service receives an incoming request, Render spins up a fresh container. This wake-up process typically takes **30–60 seconds**.
- **Client-Side Mitigations**:
  - **Non-blocking Wake Ping**: On frontend app load, a non-blocking `GET /health` request is immediately dispatched in the background to initiate the container wake-up process before the user interacts with audio playback.
  - **Visual Skeleton State**: If the first data request takes longer than **3 seconds**, the UI automatically displays an ambient notification badge inside skeleton loaders: `Waking up the server...`.
  - **In-Memory Cache Preservation**: On spin-up, the backend immediately pre-warms the home shelves cache and maintains background refresh intervals every 15 minutes.

### 2. Recommended Region
- **Primary Recommendation**: **`Oregon (US West)`** (`us-west-1`)
  - Upstream YouTube Music and Google GenAI APIs exhibit the lowest transit latency and fewest IP blocks from US West cloud data centers.
- **Alternative (European Users)**: **`Frankfurt (EU Central)`** (`eu-central-1`) if your primary audience is based in EMEA.

### 3. Health & Readiness Probes
- **Liveness Probe**: `GET /health` — Fast, lightweight probe returning HTTP 200 `{ status: "ok" }` without database or external network queries.
- **Readiness Probe**: `GET /ready` — Validates SQLite database connectivity (`SELECT 1`).

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `5001` | HTTP & WebSocket server port |
| `NODE_ENV` | Optional | `development` | Set to `production` for containerized runs to enforce secure cookies |
| `CORS_ORIGIN` | Optional | `https://super-culture-v2.onrender.com` | Comma-separated list of allowed frontend origins (e.g., `https://super-culture-v2.onrender.com,http://localhost:3000`) |
| `APP_PASSCODE` | Optional | `""` | Shared secret passcode gating all `/api` routes with signed cookies |
| `COOKIE_SECRET` | Optional | Auto-derived | Secret key used to sign session cookies |
| `STREAM_SECRET` | Optional | Auto-derived | HMAC secret for signing 5-minute temporary audio streaming tokens |
| `MAX_AI_CALLS_PER_DAY` | Optional | `100` | Global daily quota counter for Gemini AI calls to prevent unexpected costs |
| `GEMINI_API_KEY` | Optional | `""` | Google Gemini GenAI API key for Magic Vibe and AI DJ curation |
| `DB_PATH` | Optional | `data/super_culture.db` | Persistent SQLite database file path |

---

## ⚠️ Disclaimer

Super Culture v2 is an experimental, personal open-source software project designed strictly for personal use, education, and portfolio showcase purposes.

- Audio resolution and metadata discovery utilize the `youtubei.js` open-source library.
- Audio streaming is subject to YouTube's Terms of Service.
- No copyrighted media files are hosted or permanently stored on this server; the application proxies publicly accessible streams for personal listening.
- All trademarks, logos, and artist brand assets belong to their respective copyright holders.
