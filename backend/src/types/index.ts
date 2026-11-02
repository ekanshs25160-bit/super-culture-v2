/**
 * Super Culture v2.0 - Core Domain Types & Interfaces
 */

export type PlaybackState = 'waiting' | 'playing' | 'paused' | 'ended';
export type UserPrivacyMode = 'public' | 'private';
export type MoodType = 'energetic' | 'chill' | 'melancholy' | 'focus';

export interface TrackMeta {
  id?: string;
  videoId: string;
  title: string;
  artist: string;
  cover?: string;
  albumArt?: string;
  thumbnail_url?: string;
  thumbnailUrl: string;
  duration?: number | string;
  durationFormatted?: string;
  album?: string;
  addedBy?: string;
  addedAt?: string;
}

export interface ArtistMeta {
  id: string;
  name: string;
  subscribers?: string;
  avatar: string;
  role?: string;
}

export interface SearchResultPayload {
  artists: ArtistMeta[];
  tracks: TrackMeta[];
  results: TrackMeta[];
}

export interface StreamEntry {
  videoId: string;
  url: string;
  mimeType: string;
  bitrate?: number;
  expiresAt: number;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  mode: UserPrivacyMode;
  mood: MoodType;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  userId: string;
  tracks: TrackMeta[];
  createdAt: string;
  updatedAt: string;
}

export interface FriendStatus {
  uid: string;
  name: string;
  avatarUrl?: string;
  isLive: boolean;
  track?: TrackMeta;
  lastActiveMinutes: number;
}

export interface JamParticipant {
  uid: string;
  name: string;
  joinedAt: string;
  lastSeen: string;
  avatarUrl?: string;
}

export interface JamRoom {
  roomId: string;
  roomCode: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  state: PlaybackState;
  queue: TrackMeta[];
  currentTrackIndex: number;
  seekPosition: number;
  startedAt?: string | null;
  lastActive: string;
  participants: JamParticipant[];
  voteCount: number;
  voteRoundId: number;
}

export type JamSocketAction =
  | 'JOIN'
  | 'SYNC'
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'TRACK_CHANGE'
  | 'ADD_QUEUE'
  | 'VOTE_SKIP'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'HEARTBEAT'
  | 'ERROR';

export interface JamSocketMessage<T = unknown> {
  type: JamSocketAction;
  roomId: string;
  userId?: string;
  payload: T;
  timestamp: number;
}

export interface VibeRequest {
  mood?: string;
  genre?: string;
  language?: string;
  referenceSongs?: string;
}

export interface AIDJRecommendation {
  title: string;
  artist: string;
  reason?: string;
}

export interface ShelfCategory {
  id: string;
  title: string;
  type: 'trending' | 'curated_stack' | 'made_for_you';
  items: TrackMeta[];
}
