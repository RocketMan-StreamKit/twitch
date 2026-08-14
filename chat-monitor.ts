import { TwitchApi } from './api';
import {
  pushChatterJoined,
  pushChatterLeft,
  pushPinnedChatMessage,
  repushChatMessageWithoutPin,
} from './dashboard-feed';
import { patchParams } from './params';
import { getSettings, reloadSettings } from './settings';

const CHATTERS_POLL_INTERVAL_MS = 30_000;
const PINNED_POLL_INTERVAL_MS = 3_000;
/** Addon param key for the last pinned chat message id (hidden, persisted). */
const LAST_PINNED_MESSAGE_ID_PARAM = 'last_pinned_message_id';

type PinnedMessageSnapshot = {
  message_id: string;
  sender_user_id: string;
  sender_user_login: string;
  sender_user_name: string;
  message?: { text?: string; fragments?: unknown };
};

let chattersTimer: ReturnType<typeof setInterval> | null = null;
let pinnedTimer: ReturnType<typeof setInterval> | null = null;
let knownChatters = new Map<string, { login: string; name: string }>();
let chattersInitialized = false;
let lastPinnedMessageId: string | null = null;
let lastPinnedMessage: PinnedMessageSnapshot | null = null;
/** True only after this session pushed the current pin into the chat feed. */
let pinAnnouncedThisSession = false;
let currentBroadcasterId: string | null = null;
let pinRefreshTimer: ReturnType<typeof setTimeout> | null = null;

export const getCurrentPinnedMessageId = () => lastPinnedMessageId;

/**
 * Reads the last pinned Twitch chat message id from persisted addon params.
 * @example
 * const id = await readPersistedPinnedMessageId();
 */
const readPersistedPinnedMessageId = async (): Promise<string | null> => {
  const params = await api.config.getParams();
  const raw = params[LAST_PINNED_MESSAGE_ID_PARAM];
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed || null;
};

/**
 * Persists the current pinned Twitch chat message id so a later restart
 * does not push the same pin into the dashboard chat feed again.
 * @param messageId Helix chat message id, or `null` when nothing is pinned.
 * @example
 * await persistPinnedMessageId('abc-123');
 * await persistPinnedMessageId(null);
 */
const persistPinnedMessageId = async (messageId: string | null) => {
  await patchParams({ [LAST_PINNED_MESSAGE_ID_PARAM]: messageId ?? '' });
};

/**
 * Builds an in-memory snapshot of a pinned Helix chat message.
 * @param messageId Helix chat message id.
 * @param pinned Pinned message payload from Helix.
 * @example
 * snapshotPinnedMessage('abc', pinned);
 */
const snapshotPinnedMessage = (
  messageId: string,
  pinned: {
    sender_user_id: string;
    sender_user_login: string;
    sender_user_name: string;
    message?: { text?: string; fragments?: unknown };
  }
): PinnedMessageSnapshot => ({
  message_id: messageId,
  sender_user_id: pinned.sender_user_id,
  sender_user_login: pinned.sender_user_login,
  sender_user_name: pinned.sender_user_name,
  message: pinned.message,
});

export const startChatMonitor = async (broadcasterId: string) => {
  stopChatMonitor();
  currentBroadcasterId = broadcasterId;
  knownChatters = new Map();
  chattersInitialized = false;
  lastPinnedMessageId = await readPersistedPinnedMessageId();
  lastPinnedMessage = null;
  pinAnnouncedThisSession = false;

  await reloadSettings();
  await pollPinnedMessage();
  await pollChatters();

  pinnedTimer = setInterval(() => {
    void pollPinnedMessage();
  }, PINNED_POLL_INTERVAL_MS);

  chattersTimer = setInterval(() => {
    void pollChatters();
  }, CHATTERS_POLL_INTERVAL_MS);
};

export const stopChatMonitor = () => {
  if (chattersTimer) {
    clearInterval(chattersTimer);
    chattersTimer = null;
  }
  if (pinnedTimer) {
    clearInterval(pinnedTimer);
    pinnedTimer = null;
  }
  if (pinRefreshTimer) {
    clearTimeout(pinRefreshTimer);
    pinRefreshTimer = null;
  }
  currentBroadcasterId = null;
  knownChatters = new Map();
  chattersInitialized = false;
  lastPinnedMessageId = null;
  lastPinnedMessage = null;
  pinAnnouncedThisSession = false;
};

/**
 * Schedules a near-term pinned-message check after chat activity.
 * @example schedulePinnedMessageRefresh();
 */
export const schedulePinnedMessageRefresh = () => {
  if (!currentBroadcasterId || pinRefreshTimer) {
    return;
  }

  pinRefreshTimer = setTimeout(() => {
    pinRefreshTimer = null;
    void pollPinnedMessage();
  }, 500);
};

/**
 * Immediately checks the broadcaster's pinned chat message via Helix API.
 * @example await refreshPinnedMessage();
 */
export const refreshPinnedMessage = () => pollPinnedMessage();

const pollPinnedMessage = async () => {
  if (!currentBroadcasterId || !TwitchApi.accessToken) {
    return;
  }

  await reloadSettings();
  const pinned = await TwitchApi.GetPinnedChatMessage(currentBroadcasterId);
  const messageId = pinned?.message_id?.trim() || null;

  if (messageId === lastPinnedMessageId) {
    lastPinnedMessage =
      messageId && pinned ? snapshotPinnedMessage(messageId, pinned) : null;
    return;
  }

  const previousPinned = lastPinnedMessage;
  const shouldUnstylePrevious =
    Boolean(previousPinned) && pinAnnouncedThisSession;
  lastPinnedMessageId = messageId;
  lastPinnedMessage =
    messageId && pinned ? snapshotPinnedMessage(messageId, pinned) : null;
  pinAnnouncedThisSession = false;
  await persistPinnedMessageId(messageId).catch(error => console.error(error));

  if (messageId && pinned) {
    if (
      shouldUnstylePrevious &&
      previousPinned &&
      previousPinned.message_id !== messageId
    ) {
      await repushChatMessageWithoutPin(previousPinned).catch(error =>
        console.error(error)
      );
    }

    await pushPinnedChatMessage({
      message_id: messageId,
      sender_user_id: pinned.sender_user_id,
      sender_user_login: pinned.sender_user_login,
      sender_user_name: pinned.sender_user_name,
      message: pinned.message,
    }).catch(error => console.error(error));
    pinAnnouncedThisSession = true;
    return;
  }

  if (shouldUnstylePrevious && previousPinned) {
    await repushChatMessageWithoutPin(previousPinned).catch(error =>
      console.error(error)
    );
  }
};

const pollChatters = async () => {
  if (!currentBroadcasterId || !TwitchApi.accessToken) {
    return;
  }

  await reloadSettings();
  if (!getSettings().showJoinLeave) {
    chattersInitialized = false;
    knownChatters = new Map();
    return;
  }

  const chatters = await TwitchApi.GetChatters(currentBroadcasterId);
  const next = new Map(
    chatters.map(chatter => [
      chatter.user_id,
      { login: chatter.user_login, name: chatter.user_name },
    ])
  );

  if (!chattersInitialized) {
    knownChatters = next;
    chattersInitialized = true;
    return;
  }

  for (const [userId, user] of next) {
    if (!knownChatters.has(userId)) {
      pushChatterJoined(user.name, user.login).catch(error =>
        console.error(error)
      );
    }
  }

  for (const [userId, user] of knownChatters) {
    if (!next.has(userId)) {
      pushChatterLeft(user.name, user.login).catch(error =>
        console.error(error)
      );
    }
  }

  knownChatters = next;
};
