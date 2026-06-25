import { TwitchApi } from './api';
import { PLATFORM } from './constants';

const POLL_INTERVAL_MS = 60 * 1000;

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Reports that the Twitch stream is offline in the main window viewer counter.
 * @example
 * reportViewerOffline();
 * // viewers.Update({ platform: 'twitch', count: -1 })
 */
export const reportViewerOffline = () => {
  stopViewerCountPolling();
  viewers.Update({ platform: PLATFORM, count: -1 });
};

/**
 * Reports the current live viewer count for Twitch.
 * @param count Non-negative viewer count from the Twitch API.
 * @example
 * reportViewerCount(128);
 */
export const reportViewerCount = (count: number) => {
  const normalized = Math.max(0, Math.floor(count));
  viewers.Update({ platform: PLATFORM, count: normalized });
};

/**
 * Fetches the current stream status and updates the viewer counter.
 * Sends `-1` when the broadcaster is offline.
 * @param broadcasterId Twitch user id of the authorized broadcaster.
 * @example
 * await refreshViewerCount('123456');
 */
export const refreshViewerCount = async (broadcasterId: string) => {
  const stream = await TwitchApi.GetLiveStream(broadcasterId);
  if (!stream) {
    reportViewerOffline();
    return;
  }

  reportViewerCount(stream.viewerCount);
  startViewerCountPolling(broadcasterId);
};

/**
 * Handles EventSub `stream.offline` by clearing polling and reporting offline state.
 * @example
 * onStreamOffline();
 */
export const onStreamOffline = () => {
  reportViewerOffline();
};

/**
 * Starts periodic viewer-count refresh while the stream is live.
 * @param broadcasterId Twitch user id of the authorized broadcaster.
 * @example
 * startViewerCountPolling('123456');
 */
export const startViewerCountPolling = (broadcasterId: string) => {
  stopViewerCountPolling();
  pollTimer = setInterval(() => {
    void TwitchApi.GetLiveStream(broadcasterId).then(stream => {
      if (!stream) {
        reportViewerOffline();
        return;
      }
      reportViewerCount(stream.viewerCount);
    });
  }, POLL_INTERVAL_MS);
};

/**
 * Stops periodic viewer-count refresh.
 * @example
 * stopViewerCountPolling();
 */
export const stopViewerCountPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};
