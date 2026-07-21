import { TwitchApi } from './api';
import {
  resolveAddonChatSender,
  sendChatMessageWithCredentials,
} from './chat-sender';
import { getSettings, reloadSettings } from './settings';

/** Target offset of the overlay trigger inside the published clip. */
const CLIP_TRIGGER_OFFSET_SECONDS = 5;
/** How long to poll Get Clips after Create Clip before giving up. */
const CLIP_READY_TIMEOUT_MS = 60_000;
/** Delay between Get Clips polls while waiting for the clip to become ready. */
const CLIP_READY_POLL_MS = 2_000;

/** Record ids already scheduled or processed for auto-clip. */
const scheduledRecordIds = new Set<string>();
/** Active delay / poll timers that must be cleared on disconnect. */
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

/**
 * Clamps clip duration to the addon setting range (15–60 seconds).
 * @param seconds Requested clip length from settings.
 * @example
 * clampClipDurationSeconds(30); // 30
 * clampClipDurationSeconds(90); // 60
 */
const clampClipDurationSeconds = (seconds: number): number =>
  Math.min(60, Math.max(15, Math.floor(seconds)));

/**
 * Waits for the given number of milliseconds.
 * @param ms Delay duration in milliseconds.
 * @example
 * await sleep(1000);
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
 * Returns whether a latest-events record has a system overlay attach.
 * @param attach Attach entries from the stored dashboard record.
 * @example
 * hasOverlayAttach([{ type: 'overlay', value: 'my-overlay' }]); // true
 */
const hasOverlayAttach = (
  attach: DashboardAttachEntry[] | undefined
): boolean => {
  if (!attach?.length) {
    return false;
  }
  return attach.some(entry => entry.type === 'overlay');
};

/**
 * Builds a public clip URL from a clip id when Get Clips has not returned yet.
 * @param clipId Twitch clip id / slug.
 * @example
 * buildFallbackClipUrl('AwkwardHelplessSalamanderSwiftRage');
 */
const buildFallbackClipUrl = (clipId: string): string =>
  `https://clips.twitch.tv/${encodeURIComponent(clipId)}`;

/**
 * Polls Get Clips until the clip is ready or the timeout elapses.
 * @param clipId Twitch clip id returned by Create Clip.
 * @example
 * const url = await waitForClipUrl('AwkwardHelplessSalamanderSwiftRage');
 */
const waitForClipUrl = async (clipId: string): Promise<string | null> => {
  const deadline = Date.now() + CLIP_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await TwitchApi.GetClip(clipId);
    if (result.success && result.clip?.url) {
      return result.clip.url;
    }
    await sleep(CLIP_READY_POLL_MS);
  }
  return null;
};

/**
 * Creates a timed clip for an overlay-triggered latest-events record and
 * optionally posts the clip URL to chat.
 * @param recordId Stable dashboard record id used for de-duplication.
 * @param broadcasterId Live channel id to clip.
 * @example
 * void processAutoClipForRecord('twitch:follow:1', '123');
 */
const processAutoClipForRecord = async (
  recordId: string,
  broadcasterId: string
): Promise<void> => {
  const settings = await reloadSettings();
  if (!settings.autoClipOnOverlay) {
    scheduledRecordIds.delete(recordId);
    return;
  }

  const durationSeconds = clampClipDurationSeconds(
    settings.autoClipDurationSeconds
  );
  const delayMs = Math.max(
    0,
    (durationSeconds - CLIP_TRIGGER_OFFSET_SECONDS) * 1000
  );
  if (delayMs > 0) {
    await sleep(delayMs);
  }

  const liveSettings = getSettings();
  if (!liveSettings.autoClipOnOverlay || !TwitchApi.accessToken) {
    scheduledRecordIds.delete(recordId);
    return;
  }

  const created = await TwitchApi.CreateClip(broadcasterId, {
    duration: clampClipDurationSeconds(liveSettings.autoClipDurationSeconds),
  });
  if (!created.success || !created.id) {
    console.warn(
      'Auto-clip create failed:',
      created.message || 'unknown error'
    );
    scheduledRecordIds.delete(recordId);
    return;
  }

  if (!liveSettings.autoClipPostChat) {
    return;
  }

  const clipUrl =
    (await waitForClipUrl(created.id)) || buildFallbackClipUrl(created.id);
  const credentials = await resolveAddonChatSender();
  if (!credentials) {
    console.warn('Auto-clip chat post skipped: Twitch is not authorized');
    return;
  }

  const sent = await sendChatMessageWithCredentials(
    clipUrl,
    credentials,
    broadcasterId
  );
  if (!sent) {
    console.warn('Auto-clip chat post failed for', created.id);
  }
};

/**
 * Handles a latest-events record and schedules an auto-clip when an overlay
 * attach is present and the feature is enabled.
 * @param payload Incoming dashboard record payload from `dashboard.onRecord`.
 * @param broadcasterId Authorized broadcaster id.
 * @example
 * void handleAutoClipRecord(payload, '123');
 */
export const handleAutoClipRecord = (
  payload: DashboardRecordIncomingPayload,
  broadcasterId: string
): void => {
  void (async () => {
    const settings = await reloadSettings();
    if (!settings.autoClipOnOverlay) {
      return;
    }
    if (!hasOverlayAttach(payload.record.attach)) {
      return;
    }

    const recordId = payload.record.id || payload.id;
    if (!recordId || scheduledRecordIds.has(recordId)) {
      return;
    }

    scheduledRecordIds.add(recordId);
    try {
      await processAutoClipForRecord(recordId, broadcasterId);
    } catch (error) {
      scheduledRecordIds.delete(recordId);
      console.error('Auto-clip processing failed:', error);
    }
  })();
};

/**
 * Clears pending auto-clip timers and de-duplication state on disconnect.
 * @example
 * resetAutoClipState();
 */
export const resetAutoClipState = (): void => {
  for (const timer of pendingTimers) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
  scheduledRecordIds.clear();
};
