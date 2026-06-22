import {
  pushFramedSystemChatNotification,
  pushShoutoutChatNotification,
} from './dashboard-feed';
import { getSettings } from './settings';

type ChatNotificationEvent = Record<string, unknown>;

const SUBSCRIPTION_NOTICE_TYPES = new Set([
  'sub',
  'resub',
  'sub_gift',
  'community_sub_gift',
  'gift_paid_upgrade',
  'prime_paid_upgrade',
  'pay_it_forward',
  'shared_chat_sub',
  'shared_chat_resub',
  'shared_chat_sub_gift',
  'shared_chat_community_sub_gift',
  'shared_chat_gift_paid_upgrade',
  'shared_chat_prime_paid_upgrade',
  'shared_chat_pay_it_forward',
]);

const readString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const readNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const readRaidPayload = (event: ChatNotificationEvent, noticeType: string) => {
  if (noticeType === 'shared_chat_raid') {
    return event.shared_chat_raid;
  }
  if (noticeType === 'raid') {
    return event.raid;
  }
  return null;
};

const readWatchStreakPayload = (event: ChatNotificationEvent) => {
  const payload = event.watch_streak;
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as { streak_count?: unknown; channel_points_awarded?: unknown };
};

const chatNotificationMessageId = (messageId: string, noticeType: string) =>
  `twitch:chat-notice:${noticeType}:${messageId}`;

export const handleChatNotificationEvent = async (
  event: ChatNotificationEvent
) => {
  const settings = getSettings();
  const noticeType = readString(event.notice_type);
  if (!noticeType) {
    return;
  }

  const chatterUserId = readString(event.chatter_user_id);
  const chatterLogin = readString(event.chatter_user_login);
  const chatterName = readString(event.chatter_user_name);
  if (!chatterUserId || !chatterLogin || !chatterName) {
    return;
  }

  const messageId = readString(event.message_id);
  const systemMessage = readString(event.system_message);
  const userMessage = readString(
    event.message &&
      typeof event.message === 'object' &&
      typeof (event.message as { text?: unknown }).text === 'string'
      ? (event.message as { text: string }).text
      : ''
  );
  const content = systemMessage || userMessage;
  if (!content) {
    return;
  }

  if (noticeType === 'raid' || noticeType === 'shared_chat_raid') {
    if (!settings.showChatRaid) {
      return;
    }
    const raid = readRaidPayload(event, noticeType);
    const viewerCount = readNumber(
      raid && typeof raid === 'object'
        ? (raid as { viewer_count?: unknown }).viewer_count
        : 0
    );
    if (viewerCount < settings.chatRaidMinViewers) {
      return;
    }
    await pushFramedSystemChatNotification({
      kind: 'raid',
      content,
      messageId: messageId
        ? chatNotificationMessageId(messageId, noticeType)
        : undefined,
      login: chatterLogin,
      displayName: chatterName,
      twitchUserId: chatterUserId,
    });
    return;
  }

  if (noticeType === 'watch_streak') {
    if (!settings.showWatchStreak) {
      return;
    }
    const streak = readWatchStreakPayload(event);
    const streakCount = readNumber(streak?.streak_count);
    if (streakCount < settings.watchStreakMinCount) {
      return;
    }
    await pushFramedSystemChatNotification({
      kind: 'watch_streak',
      content,
      messageId: messageId
        ? chatNotificationMessageId(messageId, noticeType)
        : undefined,
      login: chatterLogin,
      displayName: chatterName,
      twitchUserId: chatterUserId,
    });
    return;
  }

  if (SUBSCRIPTION_NOTICE_TYPES.has(noticeType)) {
    if (!settings.showChatSubscriptions) {
      return;
    }
    await pushFramedSystemChatNotification({
      kind: 'subscription',
      content,
      messageId: messageId
        ? chatNotificationMessageId(messageId, noticeType)
        : undefined,
      login: chatterLogin,
      displayName: chatterName,
      twitchUserId: chatterUserId,
    });
  }
};

export const handleShoutoutCreateEvent = async (
  event: ChatNotificationEvent
) => {
  if (!getSettings().showShoutout) {
    return;
  }

  const toName = readString(event.to_broadcaster_user_name);
  const toLogin = readString(event.to_broadcaster_user_login);
  const moderatorName = readString(event.moderator_user_name);
  const moderatorLogin = readString(event.moderator_user_login);
  const viewerCount = readNumber(event.viewer_count);

  if (!toName || !toLogin || !moderatorName || !moderatorLogin) {
    return;
  }

  await pushShoutoutChatNotification({
    moderatorLogin,
    moderatorName,
    toLogin,
    toName,
    viewerCount,
  });
};
