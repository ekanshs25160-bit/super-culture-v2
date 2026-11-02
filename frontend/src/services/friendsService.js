/**
 * @file friendsService.js
 * Typed Friends & Activity Service.
 *
 * Currently, there are NO backend endpoints or database tables for social friends and activity streams.
 * Returns an empty array so UI shows real state rather than mock users.
 * Endpoints to be connected once implemented on server:
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

export const friendsService = {
  /**
   * Fetches the current friend activity stream.
   * @returns {Promise<FriendActivity[]>}
   */
  getFriendActivities: async () => {
    // Empty stream pending backend friends API implementation
    return [];
  },

  /**
   * Follow a user by ID.
   * @param {string} friendId
   * @returns {Promise<boolean>}
   */
  followFriend: async (friendId) => {
    console.info(`[friendsService] followFriend(${friendId}) - Social features pending backend API.`);
    return true;
  },
};
