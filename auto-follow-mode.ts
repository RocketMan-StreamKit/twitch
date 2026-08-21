import { TwitchApi } from './api';
import {
  resolveAddonChatSender,
  sendChatMessageWithCredentials,
} from './chat-sender';
import { getSettings, reloadSettings } from './settings';

/** Helix chat messages longer than this are dropped by Twitch. */
const TWITCH_CHAT_MESSAGE_MAX_LENGTH = 500;

/** Default chat templates used when the setting is empty. */
export const FOLLOW_MODE_NOTIFY_TEXT_PLACEHOLDER = {
  en: 'Followers-only mode is off for {minutes} min because of a raid from {name} ({count} viewers).',
  ru: 'Режим «только фолловеры» снят на {minutes} мин из-за рейда от {name} ({count} зрителей).',
  uk: 'Режим «лише фоловери» знято на {minutes} хв через рейд від {name} ({count} глядачів).',
} as const;

/** Snapshot of followers-only settings to restore after a raid lift. */
type FollowModeRestoreState = {
  broadcasterId: string;
  moderatorId: string;
  followerModeDuration: number | null;
};

/** True while this addon currently has followers-only mode lifted. */
let liftedByAddon = false;
/** Followers-only duration to restore when the lift window ends. */
let pendingRestore: FollowModeRestoreState | null = null;
/** Timer that restores followers-only mode after the configured delay. */
let restoreTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Returns the localized default raid follow-mode chat template.
 * @example
 * getDefaultFollowModeNotifyText(); // 'Followers-only mode is off for {minutes} min ...'
 */
export const getDefaultFollowModeNotifyText = (): string => {
  const lang = LANG.current;
  if (lang === 'ru' || lang === 'uk') {
    return FOLLOW_MODE_NOTIFY_TEXT_PLACEHOLDER[lang];
  }
  return FOLLOW_MODE_NOTIFY_TEXT_PLACEHOLDER.en;
};

/**
 * Replaces `{name}`, `{login}`, `{count}`, `{minutes}` in a template.
 * Unknown `{tokens}` are left unchanged.
 * @param template User-edited or default notification text.
 * @param vars Values interpolated into the template.
 * @example
 * applyFollowModeNotifyTemplate('Raid from {name} ({count})', {
 *   name: 'Alice',
 *   login: 'alice',
 *   count: '12',
 *   minutes: '10',
 * });
 */
const applyFollowModeNotifyTemplate = (
  template: string,
  vars: { name: string; login: string; count: string; minutes: string }
): string =>
  template.replace(/\{([a-z]+)\}/gi, (match, key: string) => {
    const value = vars[key.toLowerCase() as keyof typeof vars];
    return typeof value === 'string' ? value : match;
  });

/**
 * Clamps a chat message to Twitch's maximum length.
 * @param message Fully interpolated notification text.
 * @example
 * clampChatMessage('hello'); // 'hello'
 */
const clampChatMessage = (message: string): string => {
  if (message.length <= TWITCH_CHAT_MESSAGE_MAX_LENGTH) {
    return message;
  }
  return message.slice(0, TWITCH_CHAT_MESSAGE_MAX_LENGTH);
};

/**
 * Cancels a pending restore timer without changing chat settings.
 * @example
 * clearRestoreTimer();
 */
const clearRestoreTimer = (): void => {
  if (!restoreTimer) {
    return;
  }
  clearTimeout(restoreTimer);
  restoreTimer = null;
};

/**
 * Schedules followers-only mode restore after the given number of minutes.
 * A later raid replaces the previous timer so the window extends.
 * @param minutes How long to keep followers-only mode off.
 * @example
 * scheduleFollowModeRestore(10);
 */
const scheduleFollowModeRestore = (minutes: number): void => {
  clearRestoreTimer();
  const delayMs = Math.max(1, minutes) * 60 * 1000;
  restoreTimer = setTimeout(() => {
    restoreTimer = null;
    void restoreFollowModeIfLifted();
  }, delayMs);
};

/**
 * Posts the optional raid follow-mode chat notification.
 * @param args Raid context and configured lift duration.
 * @example
 * await notifyFollowModeLifted({
 *   broadcasterId: '111',
 *   raiderName: 'Alice',
 *   raiderLogin: 'alice',
 *   viewerCount: 25,
 *   minutes: 10,
 * });
 */
const notifyFollowModeLifted = async (args: {
  broadcasterId: string;
  raiderName: string;
  raiderLogin: string;
  viewerCount: number;
  minutes: number;
}): Promise<void> => {
  const settings = getSettings();
  if (!settings.autoLiftFollowModeNotifyChat) {
    return;
  }

  const template =
    settings.autoLiftFollowModeNotifyText.trim() ||
    getDefaultFollowModeNotifyText();
  const message = clampChatMessage(
    applyFollowModeNotifyTemplate(template, {
      name: args.raiderName,
      login: args.raiderLogin,
      count: String(args.viewerCount),
      minutes: String(args.minutes),
    }).trim()
  );
  if (!message) {
    return;
  }

  const credentials = await resolveAddonChatSender();
  if (!credentials) {
    console.warn(
      'Follow-mode chat notify skipped: Twitch is not authorized to send chat'
    );
    return;
  }

  const sent = await sendChatMessageWithCredentials(
    message,
    credentials,
    args.broadcasterId
  );
  if (!sent) {
    console.warn('Follow-mode chat notify failed');
  }
};

/**
 * Restores followers-only chat when this addon previously lifted it.
 * No-ops when the mode was already turned back on manually, or when nothing
 * was lifted. Safe to await on logout, prepare-stop, and disconnect.
 * @example
 * await restoreFollowModeIfLifted();
 */
export const restoreFollowModeIfLifted = async (): Promise<void> => {
  clearRestoreTimer();
  if (!liftedByAddon || !pendingRestore) {
    liftedByAddon = false;
    pendingRestore = null;
    return;
  }

  const snapshot = pendingRestore;
  if (!TwitchApi.accessToken) {
    liftedByAddon = false;
    pendingRestore = null;
    return;
  }

  const current = await TwitchApi.GetChatSettings(
    snapshot.broadcasterId,
    snapshot.moderatorId
  );
  if (!current.success || !current.settings) {
    console.warn(
      'Follow-mode restore skipped: failed to read chat settings:',
      current.message || 'unknown error'
    );
    return;
  }

  if (current.settings.follower_mode) {
    liftedByAddon = false;
    pendingRestore = null;
    return;
  }

  const restored = await TwitchApi.UpdateChatSettings(
    snapshot.broadcasterId,
    snapshot.moderatorId,
    {
      follower_mode: true,
      follower_mode_duration: snapshot.followerModeDuration,
    }
  );
  if (!restored.success) {
    console.warn(
      'Follow-mode restore failed:',
      restored.message || 'unknown error'
    );
    return;
  }

  liftedByAddon = false;
  pendingRestore = null;
};

/**
 * Clears restore timers and restores followers-only mode on disconnect.
 * Fire-and-forget; prefer `restoreFollowModeIfLifted` when the token must
 * still be valid (logout / prepare-stop).
 * @example
 * resetAutoFollowModeState();
 */
export const resetAutoFollowModeState = (): void => {
  void restoreFollowModeIfLifted();
};

/**
 * Temporarily disables followers-only chat after an incoming raid.
 * Extends the restore window when another qualifying raid arrives while
 * the mode is already lifted by this addon.
 * @param args Raid context from the `channel.chat.notification` raid event.
 * @example
 * void scheduleAutoFollowModeOff({
 *   broadcasterId: '111',
 *   raiderUserId: '222',
 *   raiderName: 'Alice',
 *   raiderLogin: 'alice',
 *   viewerCount: 25,
 * });
 */
export const scheduleAutoFollowModeOff = async (args: {
  broadcasterId: string;
  raiderUserId: string;
  raiderName: string;
  raiderLogin: string;
  viewerCount: number;
}): Promise<void> => {
  const settings = await reloadSettings();
  if (!settings.autoLiftFollowModeOnRaid) {
    return;
  }

  const me = await TwitchApi.GetMe();
  const moderatorId = me?.id?.trim() ?? '';
  let broadcasterId = args.broadcasterId.trim();
  if (!broadcasterId) {
    broadcasterId = moderatorId;
  }
  const raiderUserId = args.raiderUserId.trim();
  if (!broadcasterId || !moderatorId || !raiderUserId) {
    return;
  }
  if (broadcasterId === raiderUserId) {
    return;
  }
  if (args.viewerCount < settings.autoLiftFollowModeMinViewers) {
    return;
  }

  const minutes = settings.autoLiftFollowModeMinutes;

  if (liftedByAddon && pendingRestore) {
    pendingRestore = {
      ...pendingRestore,
      broadcasterId,
      moderatorId,
    };
    scheduleFollowModeRestore(minutes);
    return;
  }

  if (!TwitchApi.accessToken) {
    return;
  }

  const current = await TwitchApi.GetChatSettings(broadcasterId, moderatorId);
  if (!current.success || !current.settings) {
    console.warn(
      'Follow-mode lift skipped: failed to read chat settings:',
      current.message || 'unknown error'
    );
    return;
  }
  if (!current.settings.follower_mode) {
    return;
  }

  const updated = await TwitchApi.UpdateChatSettings(
    broadcasterId,
    moderatorId,
    { follower_mode: false }
  );
  if (!updated.success) {
    console.warn(
      'Follow-mode lift failed:',
      updated.message || 'unknown error'
    );
    return;
  }

  liftedByAddon = true;
  pendingRestore = {
    broadcasterId,
    moderatorId,
    followerModeDuration: current.settings.follower_mode_duration,
  };
  scheduleFollowModeRestore(minutes);

  await notifyFollowModeLifted({
    broadcasterId,
    raiderName: args.raiderName.trim() || args.raiderLogin.trim(),
    raiderLogin: args.raiderLogin.trim(),
    viewerCount: args.viewerCount,
    minutes,
  });
};
