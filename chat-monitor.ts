import { TwitchApi } from './api';
import {
  pushChatterJoined,
  pushChatterLeft,
  pushPinnedChatMessage,
} from './dashboard-feed';
import { getSettings, reloadSettings } from './settings';

const CHATTERS_POLL_INTERVAL_MS = 30_000;
const PINNED_POLL_INTERVAL_MS = 15_000;

let chattersTimer: ReturnType<typeof setInterval> | null = null;
let pinnedTimer: ReturnType<typeof setInterval> | null = null;
let knownChatters = new Map<string, { login: string; name: string }>();
let chattersInitialized = false;
let lastPinnedMessageId: string | null = null;
let currentBroadcasterId: string | null = null;

export const getCurrentPinnedMessageId = () => lastPinnedMessageId;

export const startChatMonitor = async (broadcasterId: string) => {
  stopChatMonitor();
  currentBroadcasterId = broadcasterId;
  knownChatters = new Map();
  chattersInitialized = false;
  lastPinnedMessageId = null;

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
  currentBroadcasterId = null;
  knownChatters = new Map();
  chattersInitialized = false;
  lastPinnedMessageId = null;
};

const pollPinnedMessage = async () => {
  if (!currentBroadcasterId || !TwitchApi.accessToken) {
    return;
  }

  await reloadSettings();
  const pinned = await TwitchApi.GetPinnedChatMessage(currentBroadcasterId);
  const messageId = pinned?.message_id?.trim() || null;

  if (messageId === lastPinnedMessageId) {
    return;
  }

  lastPinnedMessageId = messageId;

  if (!messageId || !pinned) {
    return;
  }

  await pushPinnedChatMessage({
    message_id: messageId,
    sender_user_id: pinned.sender_user_id,
    sender_user_login: pinned.sender_user_login,
    sender_user_name: pinned.sender_user_name,
    message: pinned.message,
  }).catch(error => console.error(error));
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
