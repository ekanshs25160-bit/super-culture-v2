import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Radio, Plus, ArrowUpRight } from 'lucide-react';
import { AudioContext } from '../context/AudioContext';
import { useJamStore } from '../store/useJamStore';
import { friendsService } from '../services/friendsService';
import CoverImage from './shared/CoverImage';

export default function RightSidebar() {
  const { playTrack, isPlaying, showToast } = useContext(AudioContext);
  const { activeRooms, fetchActiveRooms, joinRoom, createRoom, socketConnected } = useJamStore();
  const navigate = useNavigate();

  const [friends, setFriends] = useState([]);
  const [isEmptyJamState, setIsEmptyJamState] = useState(false);
  const [joinedRooms, setJoinedRooms] = useState({});

  useEffect(() => {
    fetchActiveRooms();
    friendsService.getFriendActivities().then(setFriends);
  }, [fetchActiveRooms]);

  const handleToggleJoinRoom = async (room) => {
    const isCurrentlyJoined = Boolean(joinedRooms[room.id || room.roomId]);
    const id = room.roomId || room.id;

    if (!isCurrentlyJoined) {
      setJoinedRooms((prev) => ({ ...prev, [id]: true }));
      await joinRoom(id);
      if (room.currentTrack || room.track) {
        const trk = room.currentTrack || room.track;
        playTrack({
          ...trk,
          artist: `${trk.artist || 'Curated'} • Live in ${room.name}`,
        });
      }
      navigate(`/jam/${id}`);
      showToast(`Joined Jam Room: ${room.name}`);
    } else {
      setJoinedRooms((prev) => ({ ...prev, [id]: false }));
      showToast(`Left Jam Room: ${room.name}`);
    }
  };

  const handleHostRoom = async () => {
    const defaultName = 'Tokyo High-End Studio';
    const name = window.prompt ? window.prompt('Name your Jam Room:', defaultName) : defaultName;
    if (name && name.trim()) {
      const room = await createRoom(name.trim());
      if (room) {
        showToast(`Created Live Jam Room: ${room.name}`);
        navigate(`/jam/${room.roomId || room.id}`);
      }
    }
  };

  return (
    <aside className="w-full flex flex-col gap-3 pointer-events-auto h-full min-h-0 overflow-y-auto no-scrollbar">
      {/* CARD A: FRIEND ACTIVITY CARD */}
      <section className="sc-card sc-card-hover p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8A8A8E]" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-[#F4F4F2] tracking-tight">Friend Activity</h3>
          </div>
          <button
            onClick={() => showToast('Friend invitations coming in next release (Mock stream active)')}
            aria-label="Add friends"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#8A8A8E] hover:text-white transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2.5">
          {friends.map((friend) => (
            <div
              key={friend.id}
              onClick={() => playTrack(friend.track)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') playTrack(friend.track);
              }}
              aria-label={`Listen to what ${friend.name} is playing: ${friend.track.title}`}
              className="group p-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] cursor-pointer transition select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CoverImage
                  src={friend.track.cover}
                  alt=""
                  iconSize="w-3.5 h-3.5"
                  className="w-9 h-9 rounded-lg object-cover grayscale contrast-125 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                    {friend.track.title}
                  </p>
                  <p className="text-[11px] text-[#8A8A8E] truncate">{friend.track.artist}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.05]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CoverImage
                    src={friend.avatar}
                    alt=""
                    iconSize="w-2.5 h-2.5"
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                  <span className="text-[11px] text-[#8A8A8E] truncate">{friend.name}</span>
                </div>

                {friend.isLive ? (
                  <div className={`flex items-end gap-[2px] h-3 px-1 ${!isPlaying ? 'paused-eq' : ''}`}>
                    <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-1 motion-reduce:animate-none"></span>
                    <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-2 motion-reduce:animate-none"></span>
                    <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-3 motion-reduce:animate-none"></span>
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-white/[0.07] text-[10px] text-[#8A8A8E] font-mono">
                    {friend.lastActive}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Link */}
        <button
          onClick={() => navigate('/followed')}
          aria-label="See others activity"
          className="mt-3 w-full py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] text-xs text-[#F4F4F2]/90 font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <span>See others activity</span>
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </section>

      {/* CARD B: LIVE JAM ROOMS CARD */}
      <section className="sc-card sc-card-hover p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                socketConnected ? 'bg-[#1ED760] glow-green-sm' : 'bg-[#8A8A8E]'
              }`}
              aria-hidden="true"
            />
            <h3 className="meta-label text-[#F4F4F2] font-semibold">LIVE JAM ROOMS</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsEmptyJamState((prev) => !prev)}
              aria-label="Toggle Jam active view vs empty view"
              className="meta-label text-[9px] px-2 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-[#8A8A8E] hover:text-white transition cursor-pointer"
            >
              {isEmptyJamState ? `ACTIVE (${activeRooms.length})` : 'EMPTY VIEW'}
            </button>
            <button
              onClick={handleHostRoom}
              aria-label="Host a Jam room"
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ACTIVE STATE: Active Room Rows */}
        {!isEmptyJamState && (
          <div className="space-y-2 overflow-y-auto no-scrollbar flex-1 min-h-0">
            {activeRooms.map((room) => {
              const id = room.roomId || room.id;
              const isJoined = Boolean(joinedRooms[id]);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-white/[0.04] border border-white/[0.05]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <CoverImage
                        src={room.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'}
                        alt=""
                        iconSize="w-3.5 h-3.5"
                        className="w-8 h-8 rounded-full object-cover border border-[#1ED760]"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#1ED760] ring-2 ring-[#141416]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#F4F4F2] truncate">{room.name}</p>
                      <p className="text-[11px] text-[#8A8A8E] truncate">
                        {room.host || 'Host'} • {room.listeners || 1} listening
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleJoinRoom(room)}
                    aria-label={`${isJoined ? 'Joined' : 'Join'} room ${room.name}`}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition shrink-0 cursor-pointer ${
                      isJoined
                        ? 'bg-white text-[#0B0B0C]'
                        : 'bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C]'
                    }`}
                  >
                    {isJoined ? 'Joined' : 'Join'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* EMPTY-STATE VARIANT */}
        {isEmptyJamState && (
          <div className="py-4 px-3 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center my-auto">
            <Radio className="w-6 h-6 text-[#8A8A8E] mx-auto mb-2" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F4F4F2]">No active Jam Rooms</p>
            <p className="text-[11px] text-[#8A8A8E] mt-0.5 mb-3">Host a synchronized audio session with peers</p>
            <button
              onClick={() => {
                setIsEmptyJamState(false);
                handleHostRoom();
              }}
              aria-label="Start a new Jam room"
              className="px-3.5 py-1.5 rounded-full bg-[#1ED760] text-[#0B0B0C] text-xs font-semibold hover:bg-[#22e868] transition cursor-pointer"
            >
              + Start a Room
            </button>
          </div>
        )}
      </section>
    </aside>
  );
}
