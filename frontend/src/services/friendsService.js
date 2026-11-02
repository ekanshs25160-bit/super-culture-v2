/**
 * @file friendsService.js
 * Typed Friends & Activity Service.
 *
 * TODO: Connect to backend Friends & Activity API once available (e.g. GET /api/friends/activity).
 * Currently, there are NO backend endpoints or database tables for social friends and activity streams.
 * We provide this typed mock implementation with realistic editorial listener activity.
 * Do NOT pretend this is real server data until the backend implements:
 * - GET /api/friends/activity
 * - POST /api/friends/:friendId/follow
 * - DELETE /api/friends/:friendId/follow
 */

/**
 * @typedef {Object} FriendTrack
 * @property {string} title
 * @property {string} artist
 * @property {string} cover
 * @property {number} [duration]
 * @property {string} [videoId]
 */

/**
 * @typedef {Object} FriendActivity
 * @property {string} id
 * @property {string} name
 * @property {string} avatar
 * @property {FriendTrack} track
 * @property {string} lastActive
 * @property {boolean} isLive
 */

const MOCK_FRIEND_ACTIVITIES = [
  {
    id: 'friend-emily-chang',
    name: 'Emily Chang',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    track: {
      id: 'emily-track-1',
      videoId: 'IlEkvbRmfrA',
      title: 'Archangel (Hyperdub 2007)',
      artist: 'Burial',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=544&h=544&fit=crop',
      duration: 238,
    },
    lastActive: 'Listening Live',
    isLive: true,
  },
  {
    id: 'friend-ryan-williams',
    name: 'Ryan Williams',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    track: {
      id: 'ryan-track-1',
      videoId: 'r4l9bFqgMaQ',
      title: 'Nights (Blonde 2016)',
      artist: 'Frank Ocean',
      cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=544&h=544&fit=crop',
      duration: 307,
    },
    lastActive: '44m ago',
    isLive: false,
  },
  {
    id: 'friend-elizabeth-clark',
    name: 'Elizabeth Clark',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    track: {
      id: 'elizabeth-track-1',
      videoId: '0Z-hZ_b8nYo',
      title: 'Alberto Balsalm (I Care Because You Do)',
      artist: 'Aphex Twin',
      cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=544&h=544&fit=crop',
      duration: 311,
    },
    lastActive: '3h ago',
    isLive: false,
  },
];

export const friendsService = {
  /**
   * Fetches the current friend activity stream.
   * @returns {Promise<FriendActivity[]>}
   */
  getFriendActivities: async () => {
    // Artificial 150ms network tick to mirror async pattern
    await new Promise((resolve) => setTimeout(resolve, 150));
    return MOCK_FRIEND_ACTIVITIES;
  },

  /**
   * Follow a user by ID.
   * @param {string} friendId
   * @returns {Promise<boolean>}
   */
  followFriend: async (friendId) => {
    console.warn(`[friendsService] followFriend(${friendId}) - MOCK ONLY: Missing backend endpoint POST /api/friends/${friendId}/follow`);
    return true;
  },
};

