/**
 * Coordinates track transitions between AudioContext and AudioEngineHost,
 * ensuring stale playerRefs after a compatibility fallback are cleared first
 * and that AudioElementPlayer loads Track 2 without double-loading.
 */

export function bindAudioPlayerLoadTracking(player, lastLoadedVideoIdRef) {
  if (!player || player.__loadTrackingBound) return player;
  const origLoad = player.loadVideoById.bind(player);
  const origCue = player.cueVideoById.bind(player);

  player.loadVideoById = async function trackedLoadVideoById(args = {}) {
    if (args?.videoId && lastLoadedVideoIdRef) {
      lastLoadedVideoIdRef.current = args.videoId;
    }
    return origLoad(args);
  };

  player.cueVideoById = async function trackedCueVideoById(args = {}) {
    if (args?.videoId && lastLoadedVideoIdRef) {
      lastLoadedVideoIdRef.current = args.videoId;
    }
    return origCue(args);
  };

  player.__loadTrackingBound = true;
  return player;
}

export function prepareTrackSelection({ track, currentTrackVideoId, playerRef, uiStore }) {
  if (!track || !track.videoId) {
    return { shouldLoadOnPlayerRef: false, isSameTrack: false, hadCompatFallback: false };
  }

  const uiState = uiStore?.getState ? uiStore.getState() : null;
  const hadCompatFallback = Boolean(uiState?.compatFallback || uiState?.temporaryEngineOverride);

  if (hadCompatFallback) {
    uiState.clearCompatFallback?.();
    return { shouldLoadOnPlayerRef: false, isSameTrack: false, hadCompatFallback: true };
  }

  const activePlayerVideoId = playerRef?.current?.currentVideoId || null;
  const isSameTrack =
    currentTrackVideoId === track.videoId &&
    (activePlayerVideoId === track.videoId || activePlayerVideoId !== null);

  if (isSameTrack) {
    return { shouldLoadOnPlayerRef: false, isSameTrack: true, hadCompatFallback: false };
  }

  return { shouldLoadOnPlayerRef: true, isSameTrack: false, hadCompatFallback: false };
}

export function syncAudioEngineTrack({
  effectiveEngine,
  currentTrack,
  isPlaying,
  currentTime,
  audioPlayer,
  lastLoadedVideoIdRef,
  setPlayerRef,
}) {
  if (effectiveEngine !== 'audio') {
    if (lastLoadedVideoIdRef) {
      lastLoadedVideoIdRef.current = null;
    }
    if (audioPlayer && typeof audioPlayer.pauseVideo === 'function') {
      audioPlayer.pauseVideo();
    }
    return false;
  }

  if (!audioPlayer) {
    return false;
  }

  setPlayerRef?.(audioPlayer);

  const videoId = currentTrack?.videoId || null;
  if (!videoId) {
    return false;
  }

  if (lastLoadedVideoIdRef.current !== videoId) {
    lastLoadedVideoIdRef.current = videoId;
    if (isPlaying) {
      audioPlayer.loadVideoById({
        videoId,
        startSeconds: currentTime || 0,
      });
    } else {
      audioPlayer.cueVideoById({
        videoId,
        startSeconds: currentTime || 0,
      });
    }
    return true;
  }

  return false;
}
