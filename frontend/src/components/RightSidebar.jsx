import { useState, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';
import { FRIEND_ACTIVITIES, JAM_ROOMS } from '../data/tracks';

export default function RightSidebar() {
  const { playTrack, isPlaying, showToast } = useContext(AudioContext);

  const [isEmptyJamState, setIsEmptyJamState] = useState(false);
  const [joinedRooms, setJoinedRooms] = useState({});

  const handleToggleJoinRoom = (room) => {
    const isCurrentlyJoined = Boolean(joinedRooms[room.id]);
    if (!isCurrentlyJoined) {
      setJoinedRooms((prev) => ({ ...prev, [room.id]: true }));
      playTrack({
        ...room.track,
        artist: `${room.track.artist} • Live in ${room.name}`,
      });
      showToast(`Joined Jam Room: ${room.name}`);
    } else {
      setJoinedRooms((prev) => ({ ...prev, [room.id]: false }));
      showToast(`Left Jam Room: ${room.name}`);
    }
  };

  const handleToggleJamEmpty = () => {
    setIsEmptyJamState((prev) => !prev);
  };

  return (
    <aside className="lg:col-span-3 w-full max-w-[305px] lg:ml-auto flex flex-col gap-3 pointer-events-auto">
      {/* CARD A: FRIEND ACTIVITY CARD */}
      <section className="sc-card sc-card-hover p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[#F4F4F2] tracking-tight">Friend Activity</h3>
          <button
            onClick={() => showToast('Find Friends on Super Culture')}
            title="Add Friends"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#8A8A8E] hover:text-white transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <circle cx="9" cy="7" r="4" />
              <path strokeLinecap="round" d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2M19 8v6M22 11h-6" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {/* Friend 1: Emily Chang (Live Equalizer) */}
          <div
            onClick={() => playTrack(FRIEND_ACTIVITIES[0].track)}
            className="group p-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] cursor-pointer transition"
          >
            <div className="flex items-center gap-2.5">
              <img
                src={FRIEND_ACTIVITIES[0].track.cover}
                alt={FRIEND_ACTIVITIES[0].track.title}
                className="w-9 h-9 rounded-lg object-cover grayscale contrast-125 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="px-1 py-[1px] rounded text-[8px] font-bold bg-white/20 text-[#F4F4F2]">E</span>
                  <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                    {FRIEND_ACTIVITIES[0].track.title}
                  </p>
                </div>
                <p className="text-[10px] text-[#8A8A8E] truncate">{FRIEND_ACTIVITIES[0].track.artist}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <img
                  src={FRIEND_ACTIVITIES[0].avatar}
                  alt={FRIEND_ACTIVITIES[0].name}
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="text-[10px] text-[#8A8A8E]">{FRIEND_ACTIVITIES[0].name}</span>
              </div>
              {/* Green Equalizer for Live Listener */}
              <div className={`flex items-end gap-[2px] h-3.5 ${!isPlaying ? 'paused-eq' : ''}`}>
                <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-1"></span>
                <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-3"></span>
                <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-2"></span>
                <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-4"></span>
              </div>
            </div>
          </div>

          {/* Friend 2: Ryan Williams (44 min grey pill) */}
          <div
            onClick={() => playTrack(FRIEND_ACTIVITIES[1].track)}
            className="group p-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] cursor-pointer transition"
          >
            <div className="flex items-center gap-2.5">
              <img
                src={FRIEND_ACTIVITIES[1].track.cover}
                alt={FRIEND_ACTIVITIES[1].track.title}
                className="w-9 h-9 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                  {FRIEND_ACTIVITIES[1].track.title}
                </p>
                <p className="text-[10px] text-[#8A8A8E] truncate">{FRIEND_ACTIVITIES[1].track.artist}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <img
                  src={FRIEND_ACTIVITIES[1].avatar}
                  alt={FRIEND_ACTIVITIES[1].name}
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="text-[10px] text-[#8A8A8E]">{FRIEND_ACTIVITIES[1].name}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/[0.07] text-[9px] text-[#8A8A8E] font-mono">
                {FRIEND_ACTIVITIES[1].lastActive}
              </span>
            </div>
          </div>

          {/* Friend 3: Elizabeth Clark (3 hr grey pill) */}
          <div
            onClick={() => playTrack(FRIEND_ACTIVITIES[2].track)}
            className="group p-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] cursor-pointer transition"
          >
            <div className="flex items-center gap-2.5">
              <img
                src={FRIEND_ACTIVITIES[2].track.cover}
                alt={FRIEND_ACTIVITIES[2].track.title}
                className="w-9 h-9 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                  {FRIEND_ACTIVITIES[2].track.title}
                </p>
                <p className="text-[10px] text-[#8A8A8E] truncate">{FRIEND_ACTIVITIES[2].track.artist}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <img
                  src={FRIEND_ACTIVITIES[2].avatar}
                  alt={FRIEND_ACTIVITIES[2].name}
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="text-[10px] text-[#8A8A8E]">{FRIEND_ACTIVITIES[2].name}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/[0.07] text-[9px] text-[#8A8A8E] font-mono">
                {FRIEND_ACTIVITIES[2].lastActive}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: "See others activity ↗" */}
        <button
          onClick={() => showToast('Opening Full Friend Activity Feed')}
          className="mt-3 w-full py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] text-[11px] text-[#F4F4F2]/90 font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <span>See others activity</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
          </svg>
        </button>
      </section>

      {/* CARD B: LIVE JAM ROOMS CARD */}
      <section className="sc-card sc-card-hover p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1ED760] glow-green-sm"></span>
            <h3 className="meta-label text-[#F4F4F2] font-semibold">LIVE JAM ROOMS</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Toggle Active vs Empty-State Variant */}
            <button
              id="jam-state-toggle"
              onClick={handleToggleJamEmpty}
              title="Switch between Active Jam Rooms and Empty State Variant"
              className="meta-label text-[9px] px-2 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-[#8A8A8E] hover:text-white transition cursor-pointer"
            >
              {isEmptyJamState ? 'ACTIVE (2)' : 'EMPTY VIEW'}
            </button>
            {/* "+" Button to host room */}
            <button
              onClick={() => showToast('Created Live Jam Room • Invite link copied')}
              title="Host a Jam Room"
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        {/* ACTIVE STATE: 2 Active Room Rows */}
        {!isEmptyJamState && (
          <div id="jam-rooms-active" className="space-y-2">
            {JAM_ROOMS.map((room) => {
              const isJoined = Boolean(joinedRooms[room.id]);
              return (
                <div
                  key={room.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-white/[0.04] border border-white/[0.05]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={room.avatar}
                        alt={room.host}
                        className="w-8 h-8 rounded-full object-cover border border-[#1ED760]"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#1ED760] ring-2 ring-[#141416]"></span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#F4F4F2] truncate">{room.name}</p>
                      <p className="text-[10px] text-[#8A8A8E] truncate">{room.host} • {room.listeners} listening</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleJoinRoom(room)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition shrink-0 cursor-pointer ${
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
          <div id="jam-rooms-empty" className="py-3.5 px-3 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center">
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-[#8A8A8E] mb-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-[#F4F4F2]">No active Jam Rooms</p>
            <p className="text-[10px] text-[#8A8A8E] mt-0.5 mb-2.5">Host a live synchronized session with friends</p>
            <button
              onClick={() => {
                setIsEmptyJamState(false);
                showToast('Live Jam Room Started!');
              }}
              className="px-3.5 py-1.5 rounded-full bg-[#1ED760] text-[#0B0B0C] text-[11px] font-semibold hover:bg-[#22e868] transition cursor-pointer"
            >
              + Start a Room
            </button>
          </div>
        )}
      </section>
    </aside>
  );
}

