import { TwitchApi } from './api';
import { getSettings, reloadSettings } from './settings';

/** Active delay timers that must be cleared on disconnect. */
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
/** Raider user ids already queued for the current shoutout window. */
const scheduledRaiderIds = new Set<string>();

/**
 * Waits for the given number of milliseconds.
 * @param ms Delay duration in milliseconds.
 * @example
 * await sleep(10_000);
 */
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => {
    const timer = setTimeout(() => {
      pendingTimers.delete(timer);
      resolve();
    }, ms);
    pendingTimers.add(timer);
  });

/**
 * Schedules a Helix shoutout for an incoming raid when settings allow it.
 * @param args Raid context from the chat notification event.
 * @param args.broadcasterId Channel receiving the raid (from_broadcaster_id).
 * @param args.raiderUserId Raiding channel user id (to_broadcaster_id).
 * @param args.viewerCount Number of viewers in the raid.
 * @example
 * void scheduleAutoShoutoutOnRaid({
 *   broadcasterId: '111',
 *   raiderUserId: '222',
 *   viewerCount: 25,
 * });
 */
export const scheduleAutoShoutoutOnRaid = async (args: {
  broadcasterId: string;
  raiderUserId: string;
  viewerCount: number;
}): Promise<void> => {
  const settings = await reloadSettings();
  if (!settings.autoShoutoutOnRaid) {
    return;
  }

  let broadcasterId = args.broadcasterId.trim();
  if (!broadcasterId) {
    const me = await TwitchApi.GetMe();
    broadcasterId = me?.id?.trim() ?? '';
  }
  const raiderUserId = args.raiderUserId.trim();
  if (!broadcasterId || !raiderUserId || broadcasterId === raiderUserId) {
    return;
  }

  if (args.viewerCount < settings.autoShoutoutMinViewers) {
    return;
  }

  if (scheduledRaiderIds.has(raiderUserId)) {
    return;
  }
  scheduledRaiderIds.add(raiderUserId);

  try {
    const delayMs = Math.max(0, settings.autoShoutoutDelaySeconds) * 1000;
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const liveSettings = getSettings();
    if (!liveSettings.autoShoutoutOnRaid || !TwitchApi.accessToken) {
      return;
    }

    const result = await TwitchApi.SendShoutout(
      broadcasterId,
      raiderUserId,
      broadcasterId
    );
    if (!result.success) {
      console.warn('Auto-shoutout failed:', result.message || 'unknown error');
    }
  } catch (error) {
    console.error('Auto-shoutout processing failed:', error);
  } finally {
    scheduledRaiderIds.delete(raiderUserId);
  }
};

/**
 * Clears pending auto-shoutout timers and de-duplication state on disconnect.
 * @example
 * resetAutoShoutoutState();
 */
export const resetAutoShoutoutState = (): void => {
  for (const timer of pendingTimers) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
  scheduledRaiderIds.clear();
};
