/**
 * Super Culture v2.0 - Curated Seed Tracks mapped to real playable YouTube Video IDs
 */

export const INITIAL_TRACK_QUEUE = [
  {
    id: 'kavinsky-nightcall',
    title: 'NIGHTCALL (RUNWAY EDIT)',
    artist: 'Kavinsky, Lovefoxxx',
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
    duration: '4:12',
    seconds: 252,
    videoId: 'MV_3Dpw-BRY',
  },
  {
    id: 'daft-punk-veridis-quo',
    title: 'Veridis Quo',
    artist: 'Daft Punk',
    cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&q=80',
    duration: '5:45',
    seconds: 345,
    videoId: 'TCd6PfxOy0Y',
  },
  {
    id: 'burial-archangel',
    title: 'Archangel (2026 Remaster)',
    artist: 'Burial',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80',
    duration: '3:58',
    seconds: 238,
    videoId: 'IlEkvbRmfrA',
  },
  {
    id: 'frank-ocean-nights',
    title: 'Nights',
    artist: 'Frank Ocean',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80',
    duration: '5:07',
    seconds: 307,
    videoId: 'r4l9bFqgMaQ',
  },
];

export const TRENDING_TRACKS = [
  {
    id: 'trend-archangel',
    title: 'Archangel',
    artist: 'Burial',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
    duration: '3:58',
    seconds: 238,
    videoId: 'IlEkvbRmfrA',
  },
  {
    id: 'trend-nights',
    title: 'Nights',
    artist: 'Frank Ocean',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&q=80',
    duration: '5:07',
    seconds: 307,
    videoId: 'r4l9bFqgMaQ',
  },
  {
    id: 'trend-windowlicker',
    title: 'Windowlicker',
    artist: 'Aphex Twin',
    cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=400&q=80',
    duration: '6:07',
    seconds: 367,
    videoId: 'UBS4Gi1y_nc',
  },
  {
    id: 'trend-cherry-coloured',
    title: 'Cherry-coloured',
    artist: 'Cocteau Twins',
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
    duration: '3:12',
    seconds: 192,
    videoId: 'JQpKtnLUduE',
  },
];

export const GENRE_STACKS = {
  chillVibes: {
    id: 'chill-vibes-stack',
    title: 'Chill Vibes Mix • Track 01',
    artist: 'Brian Eno, Floating Points',
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80',
    duration: '4:40',
    seconds: 280,
    videoId: 'TCd6PfxOy0Y', // Veridis Quo
  },
  hipHopEssentials: {
    id: 'hip-hop-essentials-stack',
    title: 'N.Y. State of Mind',
    artist: 'Nas, DJ Premier',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80',
    duration: '4:54',
    seconds: 294,
    videoId: 'hI8A14Qcv68', // N.Y. State of Mind
  },
  lateNightDrive: {
    id: 'late-night-drive-stack',
    title: 'Nightcall (Runway Edit)',
    artist: 'Kavinsky, Lovefoxxx',
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
    duration: '4:12',
    seconds: 252,
    videoId: 'MV_3Dpw-BRY', // Nightcall
  },
};

export const MADE_FOR_YOU_TRACK = {
  id: 'made-for-you-xtal',
  title: 'Daily Mix 01 • Xtal',
  artist: 'Aphex Twin, Blood Orange, Tirzah',
  cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  duration: '4:51',
  seconds: 291,
  videoId: '2tOutF8B3f8', // Xtal
};

export const LIBRARY_TRACKS = {
  likedSongs: {
    id: 'liked-songs-archive',
    title: 'Liked Songs Archive',
    artist: '874 Curated Tracks',
    cover: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
    duration: '3:48',
    seconds: 228,
    videoId: 'MV_3Dpw-BRY',
  },
  fredAgain: {
    id: 'fred-again-delilah',
    title: 'Delilah (pull me out of this)',
    artist: 'Fred again..',
    cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    duration: '4:11',
    seconds: 251,
    videoId: 'sw4c17Z4N4I', // Delilah
  },
  tapeArchive: {
    id: 'kowloon-35mm-tape',
    title: 'Kowloon 35mm Tape',
    artist: 'Ryuichi Sakamoto, Alva Noto',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80',
    duration: '5:22',
    seconds: 322,
    videoId: 'TCd6PfxOy0Y',
  },
};

export const FRIEND_ACTIVITIES = [
  {
    id: 'friend-emily',
    name: 'Emily Chang',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80',
    isLive: true,
    track: {
      id: 'the-weeknd-wicked-games',
      title: 'Wicked Games',
      artist: 'The Weeknd',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
      duration: '5:25',
      seconds: 325,
      videoId: 'O1OTWCd40bc', // Wicked Games
    },
  },
  {
    id: 'friend-ryan',
    name: 'Ryan Williams',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
    isLive: false,
    lastActive: '44 min',
    track: {
      id: 'rammstein-deutschland',
      title: 'Deutschland',
      artist: 'Rammstein',
      cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&q=80',
      duration: '5:23',
      seconds: 323,
      videoId: 'NeQM1c-XCDc', // Deutschland
    },
  },
  {
    id: 'friend-elizabeth',
    name: 'Elizabeth Clark',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80',
    isLive: false,
    lastActive: '3 hr',
    track: {
      id: 'joji-glimpse-of-us',
      title: 'Glimpse of Us',
      artist: 'Joji',
      cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
      duration: '3:53',
      seconds: 233,
      videoId: 'FvOpPeKSf_4', // Glimpse of Us
    },
  },
];

