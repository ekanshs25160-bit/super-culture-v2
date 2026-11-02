import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Radio, Users, SkipForward, Plus, Disc } from 'lucide-react';
import { PageHeader, TrackRow, EmptyState, CoverImage } from '../components/shared';
import { useAudio } from '../hooks/useAudio';
import { useJamStore } from '../store/useJamStore';
import { TRENDING_TRACKS } from '../data/tracks';

export default function JamRoomView() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { playTrack, currentTrack, isPlaying } = useAudio();

  const {
    currentRoom,
    socketConnected,
    joinRoom,
    leaveRoom,
    addToQueue,
    broadcastVoteSkip,
  } = useJamStore();

  const [newSongTitle, setNewSongTitle] = useState('');
  const [votes, setVotes] = useState(0);

  useEffect(() => {
    if (roomId && (!currentRoom || (currentRoom.roomId !== roomId && currentRoom.id !== roomId))) {
      joinRoom(roomId);
    }
  }, [roomId, currentRoom, joinRoom]);

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  const handleVoteSkip = () => {
    broadcastVoteSkip();
    setVotes((v) => v + 1);
  };

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!newSongTitle.trim() || !roomId) return;
    const song = {
      id: `queue-${Date.now()}`,
      videoId: 'MV_3Dpw-BRY',
      title: newSongTitle.trim(),
      artist: 'Member Added Track',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
      duration: '3:45',
      seconds: 225,
    };
    await addToQueue(roomId, song);
    setNewSongTitle('');
  };

  const roomName = currentRoom?.name || (roomId ? roomId.replace(/-/g, ' ') : 'Live Jam');
  const participants = currentRoom?.participants || [
    { uid: 'u1', name: 'Sora Takahashi (Host)', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80' },
    { uid: 'u2', name: 'Emily Chang', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80' },
  ];
  const queue = currentRoom?.queue?.length > 0 ? currentRoom.queue : TRENDING_TRACKS.slice(0, 4);
  const nowPlaying = queue[0] || TRENDING_TRACKS[0];

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      {/* Standardized PageHeader */}
      <PageHeader
        title={roomName}
        meta="LIVE JAM SESSION"
        backTo="/"
        backLabel="Leave Jam"
        onBack={handleLeave}
      >
        <span
          className={`sc-pill px-3 py-1 text-xs flex items-center gap-1.5 ${
            socketConnected
              ? 'text-[#1ED760] bg-[#1ED760]/10 border border-[#1ED760]/20'
              : 'text-[#8A8A8E] bg-white/5 border border-white/10'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-[#1ED760]' : 'bg-[#8A8A8E]'}`} />
          <span>{socketConnected ? 'WEBSOCKET SYNCED (<15ms)' : 'RECONNECTING WS...'}</span>
        </span>
      </PageHeader>

      {/* Hero Now Playing in Jam */}
      <div className="sc-card p-5 mb-4 rounded-2xl flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-28 h-28 shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-xl">
          <CoverImage src={nowPlaying.cover} alt="" iconSize="w-8 h-8" className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/80 text-[8px] font-mono text-[#1ED760] flex items-center gap-1">
            <Radio className="w-2.5 h-2.5" />
            <span>LIVE</span>
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left min-w-0">
          <span className="meta-label text-[9px] text-[#1ED760] block mb-1">CURRENTLY BROADCASTING</span>
          <h2 className="text-base sm:text-lg font-semibold text-[#F4F4F2] truncate">{nowPlaying.title}</h2>
          <p className="text-xs text-[#8A8A8E] truncate mb-3">{nowPlaying.artist}</p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <button
              onClick={() => playTrack(nowPlaying, queue)}
              aria-label={`Listen to ${nowPlaying.title}`}
              className="sc-pill px-4 py-2 bg-[#1ED760] text-black font-semibold text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 transition"
            >
              <Disc className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>{isPlaying && currentTrack?.title === nowPlaying.title ? 'Live Synced' : 'Sync Stream'}</span>
            </button>

            <button
              onClick={handleVoteSkip}
              aria-label="Vote to skip current track"
              className="sc-pill px-3 py-2 bg-white/10 hover:bg-white/20 text-[#F4F4F2] text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Vote Skip ({votes})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Participants List */}
      <div className="sc-card p-4 mb-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-[#F4F4F2] uppercase tracking-wider">
              Room Members ({participants.length})
            </h3>
          </div>
          <span className="meta-label text-[9px] text-[#8A8A8E]">LOW-LATENCY PEERS</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {participants.map((p, i) => (
            <div
              key={p.uid || i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10"
            >
              <CoverImage
                src={p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'}
                alt=""
                iconSize="w-3 h-3"
                className="w-5 h-5 rounded-full object-cover"
              />
              <span className="text-xs text-[#F4F4F2] font-medium">{p.name || `Listener ${i + 1}`}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shared Queue Section with Add Form */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif italic text-lg font-semibold text-[#F4F4F2]">
          Shared Queue ({queue.length})
        </h3>
      </div>

      {/* Quick Add Song to Queue Form */}
      <form onSubmit={handleAddSong} className="flex gap-2 mb-3">
        <input
          type="text"
          value={newSongTitle}
          onChange={(e) => setNewSongTitle(e.target.value)}
          placeholder="Queue a track into this Jam session..."
          aria-label="Queue track title"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-[#F4F4F2] placeholder-[#8A8A8E] outline-none focus:border-[#1ED760]/50"
        />
        <button
          type="submit"
          aria-label="Add to shared queue"
          className="sc-pill px-4 bg-white/10 hover:bg-[#1ED760] hover:text-black text-xs font-medium text-[#F4F4F2] flex items-center gap-1.5 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add to Queue</span>
        </button>
      </form>

      {/* Queue Track List */}
      <div className="space-y-2">
        {queue.length > 0 ? (
          queue.map((t, idx) => (
            <TrackRow key={t.id + idx} track={t} index={idx} queue={queue} />
          ))
        ) : (
          <EmptyState
            title="Shared Queue is Empty"
            description="Add tracks to the room queue to broadcast synchronously."
          />
        )}
      </div>
    </div>
  );
}
