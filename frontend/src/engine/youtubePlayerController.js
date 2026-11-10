/**
 * Helper controller for YouTubePlayer initialization and track loading.
 * Prevents constructing YT.Player with { videoId: undefined } when currentTrack is null.
 */

export function hasValidVideoId(videoId) {
  return typeof videoId === 'string' && videoId.trim().length > 0;
}

export function buildYtPlayerOptions({ videoId, origin, events }) {
  const options = {
    height: '200',
    width: '200',
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      enablejsapi: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      playsinline: 1,
      origin,
    },
    events,
  };

  if (hasValidVideoId(videoId)) {
    options.videoId = videoId.trim();
  }

  return options;
}

export async function initOrSyncYouTubePlayer({
  currentTrack,
  initialVideoIdRef,
  isInitializedRef,
  isReadyRef,
  playerInstanceRef,
  containerRef,
  loadAPI,
  createPlayer,
  resumeFromFallback,
}) {
  const targetVideoId = currentTrack?.videoId || initialVideoIdRef?.current || null;

  // Do not construct YT.Player while no valid videoId exists
  if (!hasValidVideoId(targetVideoId)) {
    return { initialized: false, loaded: false };
  }

  // If already initialized and ready, load the track via loadVideoById
  if (isInitializedRef.current) {
    if (isReadyRef.current && playerInstanceRef.current && hasValidVideoId(currentTrack?.videoId)) {
      const currentUrl = playerInstanceRef.current.getVideoUrl?.() || '';
      if (!currentUrl.includes(currentTrack.videoId)) {
        const startSeconds = resumeFromFallback ? resumeFromFallback(currentTrack.videoId) || 0 : 0;
        playerInstanceRef.current.loadVideoById({
          videoId: currentTrack.videoId,
          startSeconds,
        });
        playerInstanceRef.current.playVideo?.();
        return { initialized: true, loaded: true };
      }
    }
    return { initialized: true, loaded: false };
  }

  await loadAPI();

  if (isInitializedRef.current || !containerRef.current) {
    return { initialized: Boolean(isInitializedRef.current), loaded: false };
  }

  isInitializedRef.current = true;
  playerInstanceRef.current = createPlayer(targetVideoId.trim());
  return { initialized: true, loaded: true };
}
