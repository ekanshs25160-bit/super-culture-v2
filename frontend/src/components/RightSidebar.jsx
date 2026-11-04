import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, ArrowUpRight } from 'lucide-react';
import { AudioContext } from '../context/AudioContext';
import { friendsService } from '../services/friendsService';
import CoverImage from './shared/CoverImage';

export default function RightSidebar() {
  const { playTrack, isPlaying, showToast } = useContext(AudioContext);
  const navigate = useNavigate();

  const [friends, setFriends] = useState([]);

  useEffect(() => {
    friendsService.getFriendActivities().then(setFriends);
  }, []);

  return (
    <aside className="h-full min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-3 w-full pointer-events-auto">
      {/* FRIEND ACTIVITY CARD */}
      <section className="sc-card sc-card-hover p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8A8A8E]" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-[#F4F4F2] tracking-tight">Friend Activity</h3>
          </div>
          <button
            onClick={() => showToast('Friend invitations feature coming soon')}
            aria-label="Add friends"
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#8A8A8E] hover:text-white transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2.5 overflow-y-auto no-scrollbar flex-1 min-h-0">
          {friends.length > 0 ? (
            friends.map((friend) => (
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
            ))
          ) : (
            <div className="py-5 px-3 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center">
              <Users className="w-5 h-5 text-[#8A8A8E] mx-auto mb-1.5" aria-hidden="true" />
              <p className="text-xs font-medium text-[#F4F4F2]">No friend activity</p>
              <p className="text-[11px] text-[#8A8A8E] mt-0.5">Friends you follow will show their live listening activity here.</p>
            </div>
          )}
        </div>

        {/* Footer Link */}
        <button
          onClick={() => navigate('/followed')}
          aria-label="See others activity"
          className="mt-3 w-full py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] text-xs text-[#F4F4F2]/90 font-medium flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
        >
          <span>See others activity</span>
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </section>
    </aside>
  );
}
