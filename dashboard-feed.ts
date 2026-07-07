import { dispatchChatMessageTriggers } from './chat-triggers';
import { PLATFORM } from './constants';
import {
  buildTwitchProfile,
  resolveUserAvatar,
  type TwitchEventUser,
} from './dashboard-user';
import { getSettings } from './settings';

export type { TwitchEventUser } from './dashboard-user';
export { buildTwitchProfile, toDashboardUser } from './dashboard-user';

const userId = (id: string) => `twitch:${id}`;

export const pushFollow = async (user: TwitchEventUser) => {
  const profile = await buildTwitchProfile(user);
  return dashboard.addRecord(
    {
      type: 'follow',
      platform: PLATFORM,
      from: profile.id,
      message: {
        en: 'New follower',
        ru: 'Новый фолловер',
        uk: 'Новий фоловер',
      },
    },
    profile,
    { trigger: { type: 'follow' } }
  );
};

export const pushBits = async (
  user: TwitchEventUser,
  bits: number,
  message?: string
) => {
  const profile = await buildTwitchProfile(user);
  const cheerMessage =
    message?.trim() || (bits > 0 ? `${bits} bits` : undefined);
  return dashboard.addRecord(
    {
      type: 'donation',
      platform: PLATFORM,
      from: profile.id,
      message: cheerMessage,
      attach: [{ type: 'bits', value: String(bits) }],
    },
    profile,
    { trigger: { type: 'custom', key: 'bits', value: bits } }
  );
};

export const pushSubscribe = async (
  user: TwitchEventUser,
  tier: string,
  isGift?: boolean
) => {
  const profile = await buildTwitchProfile(user);
  const tierLabel = formatTier(tier);
  const message = isGift ? `Gift subscription (${tierLabel})` : tierLabel;
  return dashboard.addRecord(
    {
      type: 'subscribe',
      platform: PLATFORM,
      from: profile.id,
      message,
      attach: [{ type: 'tier', value: tier }],
    },
    profile,
    {
      trigger: isGift
        ? { type: 'subgift', value: tier }
        : { type: 'subscribe', value: tier },
    }
  );
};

export const pushSubGift = async (
  gifter: TwitchEventUser,
  total: number,
  tier: string
) => {
  const profile = await buildTwitchProfile(gifter);
  return dashboard.addRecord(
    {
      type: 'custom',
      platform: PLATFORM,
      from: profile.id,
      message: `Gifted ${total} sub${total === 1 ? '' : 's'} (${formatTier(tier)})`,
      attach: [
        { type: 'tier', value: tier },
        { type: 'gift_total', value: String(total) },
      ],
    },
    profile,
    {
      triggers: [
        { type: 'subgift', value: tier },
        { type: 'subgift', key: 'total', value: total },
      ],
    }
  );
};

/**
 * Pushes a single dashboard line for a one-to-one gifted subscription.
 * @param gifter Twitch gifter profile fields.
 * @param recipient Twitch recipient profile fields.
 * @param tier Subscription tier code.
 * @example
 * await pushCombinedGiftSub(gifter, recipient, '1000');
 */
export const pushCombinedGiftSub = async (
  gifter: TwitchEventUser,
  recipient: TwitchEventUser,
  tier: string
) => {
  const profile = await buildTwitchProfile(gifter);
  const recipientName = recipient.user_name || recipient.user_login;
  const tierLabel = formatTier(tier);
  return dashboard.addRecord(
    {
      type: 'custom',
      platform: PLATFORM,
      from: profile.id,
      message: `Gifted sub to ${recipientName} (${tierLabel})`,
      attach: [
        { type: 'tier', value: tier },
        { type: 'gift_total', value: '1' },
        { type: 'recipient', value: recipient.user_id },
      ],
    },
    profile,
    {
      triggers: [
        { type: 'subgift', value: tier },
        { type: 'subgift', key: 'total', value: 1 },
      ],
    }
  );
};

/**
 * Pushes a resub line from `channel.subscribe` when no separate resub message event arrives.
 * @param user Twitch subscriber profile fields.
 * @param tier Subscription tier code.
 * @param cumulativeMonths Total subscribed months.
 * @example
 * await pushResubSubscribe(user, '1000', 70);
 */
export const pushResubSubscribe = async (
  user: TwitchEventUser,
  tier: string,
  cumulativeMonths: number
) => {
  const profile = await buildTwitchProfile(user);
  const months = cumulativeMonths > 0 ? `${cumulativeMonths} months` : 'resub';
  const tierLabel = formatTier(tier);
  return dashboard.addRecord(
    {
      type: 'custom',
      platform: PLATFORM,
      from: profile.id,
      message: `Resub — ${months} (${tierLabel})`,
      attach: [
        { type: 'months', value: String(cumulativeMonths) },
        { type: 'tier', value: tier },
      ],
    },
    profile
  );
};

export const pushSubRenewal = async (
  user: TwitchEventUser,
  cumulativeMonths: number,
  text?: string,
  tier?: string
) => {
  const profile = await buildTwitchProfile(user);
  const months = cumulativeMonths > 0 ? `${cumulativeMonths} months` : 'resub';
  const tierLabel = tier ? formatTier(tier) : undefined;
  const message = text?.trim()
    ? tierLabel
      ? `Resub (${months}, ${tierLabel}): ${text}`
      : `Resub (${months}): ${text}`
    : tierLabel
      ? `Resub — ${months} (${tierLabel})`
      : `Resub — ${months}`;
  const attach = [{ type: 'months', value: String(cumulativeMonths) }];
  if (tier) {
    attach.push({ type: 'tier', value: tier });
  }
  return dashboard.addRecord(
    {
      type: 'custom',
      platform: PLATFORM,
      from: profile.id,
      message,
      attach,
    },
    profile
  );
};

type ChatMessageStyle = {
  color: string;
  header?: { en: string; ru?: string; uk?: string };
  icon?: 'exclamation' | 'question' | 'megaphone' | 'list';
};

const TWITCH_ANNOUNCEMENT_COLORS: Record<string, string> = {
  primary: '#9147FF',
  purple: '#9147FF',
  blue: '#0094FF',
  green: '#00AD03',
  orange: '#FF6905',
};

const ANNOUNCEMENT_STYLE_HEADER = {
  en: 'Announcement',
  ru: 'Анонс',
  uk: 'Анонс',
} as const;

const PINNED_STYLE_HEADER = {
  en: 'Pinned',
  ru: 'Закреплено',
  uk: 'Закріплено',
} as const;

const FIRST_MESSAGE_STYLE_HEADER = {
  en: 'First message',
  ru: 'Первое сообщение',
  uk: 'Перше повідомлення',
} as const;

const CHAT_NOTIFICATION_STYLE_HEADERS = {
  raid: {
    en: 'Raid',
    ru: 'Рейд',
    uk: 'Рейд',
  },
  watch_streak: {
    en: 'Watch streak',
    ru: 'Watch streak',
    uk: 'Watch streak',
  },
  subscription: {
    en: 'Subscription',
    ru: 'Подписка',
    uk: 'Підписка',
  },
  reward: {
    en: 'Reward',
    ru: 'Награда',
    uk: 'Нагорода',
  },
  highlighted_message: {
    en: 'Highlighted message',
    ru: 'Выделенное сообщение',
    uk: 'Виділене повідомлення',
  },
  shoutout: {
    en: 'Shoutout',
    ru: 'Shoutout',
    uk: 'Shoutout',
  },
} as const;

const CHAT_NOTIFICATION_STYLE_COLORS = {
  raid: '#E91E63',
  watch_streak: '#FF9800',
  subscription: '#9147FF',
  reward: '#9C27B0',
  highlighted_message: '#FFC107',
  shoutout: '#00BCD4',
  first_message: '#4CAF50',
} as const;

type ChatNotificationKind = keyof typeof CHAT_NOTIFICATION_STYLE_HEADERS;

const chatNotificationStyle = (
  kind: ChatNotificationKind
): ChatMessageStyle => ({
  color: CHAT_NOTIFICATION_STYLE_COLORS[kind],
  header: CHAT_NOTIFICATION_STYLE_HEADERS[kind],
  icon: 'megaphone',
});

const FIRST_MESSAGE_STYLE: ChatMessageStyle = {
  color: CHAT_NOTIFICATION_STYLE_COLORS.first_message,
  header: FIRST_MESSAGE_STYLE_HEADER,
  icon: 'megaphone',
};

const PINNED_STYLE = {
  color: '#FFB800',
  header: PINNED_STYLE_HEADER,
  icon: 'list' as const,
};

const MODERATION_STYLE = {
  color: '#F44336',
  header: {
    en: 'Moderation',
    ru: 'Модерация',
    uk: 'Модерація',
  },
  icon: 'exclamation' as const,
};

const JOIN_LEAVE_STYLE = {
  color: '#607D8B',
};

const POLL_STYLE = {
  color: '#2196F3',
  header: {
    en: 'Poll',
    ru: 'Опрос',
    uk: 'Опитування',
  },
  icon: 'list' as const,
};

type LocalizedText = { en: string; ru?: string; uk?: string };

export const twitchChatMessageId = (messageId: string) =>
  `twitch:msg:${messageId}`;

const pushSystemChat = async (
  content: LocalizedText,
  options?: {
    id?: string;
    style?: ChatMessageStyle;
  }
) => {
  return dashboard.addSystemChatMessage({
    id: options?.id,
    content,
    style: options?.style,
  });
};

export const pushChatMessage = async (
  login: string,
  displayName: string,
  content: string,
  twitchUserId?: string,
  color?: string,
  icons?: string[],
  emotes?: { word: string; url: string }[],
  style?: ChatMessageStyle,
  messageId?: string
) => {
  const id = twitchUserId ? userId(twitchUserId) : `twitch:login:${login}`;
  const avatar = twitchUserId ? await resolveUserAvatar(twitchUserId) : '';
  const profile = {
    id,
    name: displayName || login,
    avatar,
    platform: PLATFORM,
    color,
    icons,
  };
  return dashboard.addChatMessage(
    {
      id: messageId,
      content,
      platform: PLATFORM,
      from: profile.id,
      emotes: emotes?.length ? emotes : undefined,
      style,
    },
    profile
  );
};

const badgeIconId = (setId: string, versionId: string) => {
  return `${setId}/${versionId}`;
};

const resolveTwitchEmoteUrl = (emote: unknown): string | null => {
  if (!emote || typeof emote !== 'object') {
    return null;
  }

  const anyEmote = emote as Record<string, unknown>;

  const pickUrl = (...values: unknown[]) => {
    for (const v of values) {
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
    return null;
  };

  // Prefer payload-provided urls (if any), fallback to static-cdn by id.
  const direct = pickUrl(
    anyEmote['url_1x'],
    anyEmote['url_2x'],
    anyEmote['url_4x'],
    anyEmote['image_url_1x'],
    anyEmote['image_url_2x'],
    anyEmote['image_url_4x']
  );
  if (direct) {
    return direct;
  }

  const images = anyEmote['images'];
  if (images && typeof images === 'object') {
    const anyImages = images as Record<string, unknown>;
    const fromImages = pickUrl(
      anyImages['url_1x'],
      anyImages['url_2x'],
      anyImages['url_4x']
    );
    if (fromImages) {
      return fromImages;
    }
  }

  const emoteId = anyEmote['emote_id'] ?? anyEmote['id'];
  if (typeof emoteId === 'string' && emoteId.trim()) {
    return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0`;
  }

  return null;
};

const extractEmotesFromTwitchFragments = (
  fragments: unknown
): { word: string; url: string }[] | undefined => {
  if (!Array.isArray(fragments)) {
    return undefined;
  }

  // Dedupe by exact token (case-sensitive).
  const map: Record<string, string> = {};

  for (const fragment of fragments) {
    if (!fragment || typeof fragment !== 'object') {
      continue;
    }

    const anyFragment = fragment as Record<string, unknown>;
    const text =
      typeof anyFragment['text'] === 'string' ? anyFragment['text'] : undefined;
    const emote = anyFragment['emote'];

    const wordFromEmote =
      emote &&
      typeof emote === 'object' &&
      typeof (emote as any).name === 'string'
        ? ((emote as any).name as string)
        : undefined;

    const word = text ?? wordFromEmote;
    if (typeof word !== 'string' || !word) {
      continue;
    }

    const url = resolveTwitchEmoteUrl(emote);
    if (!url) {
      continue;
    }

    map[word] = url;
  }

  return Object.entries(map).map(([word, url]) => ({ word, url }));
};

export const pushChatFromEventSub = async (event: {
  chatter_user_id: string;
  chatter_user_login: string;
  chatter_user_name: string;
  message?: { text?: string; fragments?: unknown };
  color?: string;
  badges?: { set_id: string; id: string }[];
  channel_points_custom_reward_id?: string | null;
  message_id?: string;
  is_pinned?: boolean;
  message_type?: string;
}) => {
  if (event.channel_points_custom_reward_id) {
    return;
  }
  if (event.message_type === 'channel_points_highlighted') {
    return;
  }
  const content = event.message?.text?.trim();
  if (!content) {
    return;
  }

  const emotes = extractEmotesFromTwitchFragments(event.message?.fragments);
  const icons = event.badges
    ? event.badges.map(b => badgeIconId(b.set_id, b.id)).sort()
    : undefined;
  const messageId = event.message_id
    ? twitchChatMessageId(event.message_id)
    : undefined;
  const style = event.is_pinned
    ? PINNED_STYLE
    : event.message_type === 'user_intro' && getSettings().showFirstUserMessage
      ? FIRST_MESSAGE_STYLE
      : undefined;
  await pushChatMessage(
    event.chatter_user_login,
    event.chatter_user_name,
    content,
    event.chatter_user_id,
    event.color,
    icons,
    emotes,
    style,
    messageId
  );

  await dispatchChatMessageTriggers(
    {
      user_id: event.chatter_user_id,
      user_login: event.chatter_user_login,
      user_name: event.chatter_user_name,
    },
    content,
    event.message_id
  );
};

export const pushFramedSystemChatNotification = async (event: {
  kind: ChatNotificationKind;
  content: string;
  login: string;
  displayName: string;
  twitchUserId: string;
  messageId?: string;
}) => {
  return pushChatMessage(
    event.login,
    event.displayName,
    event.content,
    event.twitchUserId,
    undefined,
    undefined,
    undefined,
    chatNotificationStyle(event.kind),
    event.messageId
  );
};

export const pushShoutoutChatNotification = async (event: {
  moderatorLogin: string;
  moderatorName: string;
  toLogin: string;
  toName: string;
  viewerCount: number;
}) => {
  const viewerSuffix =
    event.viewerCount > 0 ? ` (${event.viewerCount} viewers)` : '';
  const content = `${event.moderatorName} shouted out ${event.toName}${viewerSuffix}`;
  return pushChatMessage(
    event.moderatorLogin,
    event.moderatorName,
    content,
    undefined,
    undefined,
    undefined,
    undefined,
    chatNotificationStyle('shoutout'),
    `twitch:shoutout:${event.toLogin}:${Date.now()}`
  );
};

export const pushRewardRedemptionChatNotification = async (event: {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  user_input?: string;
  rewardTitle: string;
  rewardCost: number;
  kind?: Extract<ChatNotificationKind, 'reward' | 'highlighted_message'>;
}) => {
  const kind = event.kind ?? 'reward';
  const input = event.user_input?.trim();
  const message =
    kind === 'highlighted_message'
      ? formatHighlightedMessage(input)
      : formatRewardMessage(event.rewardTitle, event.rewardCost, input);
  return pushChatMessage(
    event.user_login,
    event.user_name,
    message,
    event.user_id,
    undefined,
    undefined,
    undefined,
    chatNotificationStyle(kind),
    `twitch:reward-chat:${event.id}`
  );
};

export const pushChatAnnouncementFromEventSub = async (event: {
  chatter_user_id: string;
  chatter_user_login: string;
  chatter_user_name: string;
  message?: { text?: string; fragments?: unknown };
  color?: string;
  badges?: { set_id: string; id: string }[];
  message_id?: string;
  announcement_color?: string;
}) => {
  const content = event.message?.text?.trim();
  if (!content) {
    return;
  }

  const emotes = extractEmotesFromTwitchFragments(event.message?.fragments);
  const icons = event.badges
    ? event.badges.map(b => badgeIconId(b.set_id, b.id)).sort()
    : undefined;
  const announcementColor = event.announcement_color?.trim().toLowerCase();
  const styleColor =
    (announcementColor && TWITCH_ANNOUNCEMENT_COLORS[announcementColor]) ||
    TWITCH_ANNOUNCEMENT_COLORS.primary;

  return pushChatMessage(
    event.chatter_user_login,
    event.chatter_user_name,
    content,
    event.chatter_user_id,
    event.color,
    icons,
    emotes,
    {
      color: styleColor,
      header: ANNOUNCEMENT_STYLE_HEADER,
      icon: 'megaphone',
    },
    event.message_id ? `twitch:announcement:${event.message_id}` : undefined
  );
};

export const pushPinnedChatMessage = async (event: {
  message_id: string;
  sender_user_id: string;
  sender_user_login: string;
  sender_user_name: string;
  message?: { text?: string; fragments?: unknown };
}) => {
  const content = event.message?.text?.trim();
  if (!content) {
    return;
  }

  const emotes = extractEmotesFromTwitchFragments(event.message?.fragments);
  return pushChatMessage(
    event.sender_user_login,
    event.sender_user_name,
    content,
    event.sender_user_id,
    undefined,
    undefined,
    emotes,
    PINNED_STYLE,
    twitchChatMessageId(event.message_id)
  );
};

/**
 * Re-sends a chat message without the pinned frame so the chat UI re-renders it.
 * @example await repushChatMessageWithoutPin({ message_id: 'abc', sender_user_id: '1', ... });
 */
export const repushChatMessageWithoutPin = async (event: {
  message_id: string;
  sender_user_id: string;
  sender_user_login: string;
  sender_user_name: string;
  message?: { text?: string; fragments?: unknown };
}) => {
  const content = event.message?.text?.trim();
  if (!content) {
    return;
  }

  const emotes = extractEmotesFromTwitchFragments(event.message?.fragments);
  return pushChatMessage(
    event.sender_user_login,
    event.sender_user_name,
    content,
    event.sender_user_id,
    undefined,
    undefined,
    emotes,
    undefined,
    twitchChatMessageId(event.message_id)
  );
};

export const pushChatterJoined = async (displayName: string, login: string) => {
  return pushSystemChat(
    {
      en: `${displayName} joined the chat`,
      ru: `${displayName} вошёл(а) в чат`,
      uk: `${displayName} увійшов(ла) до чату`,
    },
    {
      id: `twitch:join:${login}:${Date.now()}`,
      style: JOIN_LEAVE_STYLE,
    }
  );
};

export const pushChatterLeft = async (displayName: string, login: string) => {
  return pushSystemChat(
    {
      en: `${displayName} left the chat`,
      ru: `${displayName} вышел(а) из чата`,
      uk: `${displayName} вийшов(ла) з чату`,
    },
    {
      id: `twitch:part:${login}:${Date.now()}`,
      style: JOIN_LEAVE_STYLE,
    }
  );
};

type ModerationUser = {
  user_id: string;
  user_login: string;
  user_name: string;
  reason?: string;
  expires_at?: string;
  message_body?: string;
  message_id?: string;
};

const formatModeratorPrefix = (moderatorName: string, moderatorLogin: string) =>
  `${moderatorName} (${moderatorLogin})`;

const formatTargetUser = (user: ModerationUser) =>
  `${user.user_name} (${user.user_login})`;

const formatReasonSuffix = (reason?: string) => {
  const trimmed = reason?.trim();
  return trimmed ? `: ${trimmed}` : '';
};

export const pushModerationEvent = async (event: {
  action: string;
  moderator_user_name: string;
  moderator_user_login: string;
  user?: ModerationUser | null;
  follow_duration_minutes?: number;
  wait_time_seconds?: number;
  viewer_count?: number;
  terms?: string[];
  list?: string;
  automod_action?: string;
  is_approved?: boolean;
  moderator_message?: string;
}) => {
  const mod = formatModeratorPrefix(
    event.moderator_user_name,
    event.moderator_user_login
  );
  const user = event.user;
  let content: LocalizedText;

  switch (event.action) {
    case 'ban':
    case 'shared_chat_ban':
      content = user
        ? {
            en: `${mod} banned ${formatTargetUser(user)}${formatReasonSuffix(user.reason)}`,
            ru: `${mod} забанил(а) ${formatTargetUser(user)}${formatReasonSuffix(user.reason)}`,
            uk: `${mod} забанив(ла) ${formatTargetUser(user)}${formatReasonSuffix(user.reason)}`,
          }
        : {
            en: `${mod} banned a user`,
            ru: `${mod} забанил(а) пользователя`,
            uk: `${mod} забанив(ла) користувача`,
          };
      break;
    case 'timeout':
    case 'shared_chat_timeout':
      content = user
        ? {
            en: `${mod} timed out ${formatTargetUser(user)}${formatReasonSuffix(user.reason)}`,
            ru: `${mod} выдал(а) таймаут ${formatTargetUser(user)}${formatReasonSuffix(user.reason)}`,
            uk: `${mod} дав(ла) таймаут ${formatTargetUser(user)}${formatReasonSuffix(user.reason)}`,
          }
        : {
            en: `${mod} timed out a user`,
            ru: `${mod} выдал(а) таймаут`,
            uk: `${mod} дав(ла) таймаут`,
          };
      break;
    case 'unban':
    case 'shared_chat_unban':
      content = user
        ? {
            en: `${mod} unbanned ${formatTargetUser(user)}`,
            ru: `${mod} разбанил(а) ${formatTargetUser(user)}`,
            uk: `${mod} розбанив(ла) ${formatTargetUser(user)}`,
          }
        : {
            en: `${mod} unbanned a user`,
            ru: `${mod} разбанил(а) пользователя`,
            uk: `${mod} розбанив(ла) користувача`,
          };
      break;
    case 'untimeout':
    case 'shared_chat_untimeout':
      content = user
        ? {
            en: `${mod} removed timeout for ${formatTargetUser(user)}`,
            ru: `${mod} снял(а) таймаут с ${formatTargetUser(user)}`,
            uk: `${mod} зняв(ла) таймаут з ${formatTargetUser(user)}`,
          }
        : {
            en: `${mod} removed a timeout`,
            ru: `${mod} снял(а) таймаут`,
            uk: `${mod} зняв(ла) таймаут`,
          };
      break;
    case 'delete':
    case 'shared_chat_delete':
      content = user
        ? {
            en: `${mod} deleted message from ${formatTargetUser(user)}${user.message_body ? `: «${user.message_body}»` : ''}`,
            ru: `${mod} удалил(а) сообщение ${formatTargetUser(user)}${user.message_body ? `: «${user.message_body}»` : ''}`,
            uk: `${mod} видалив(ла) повідомлення ${formatTargetUser(user)}${user.message_body ? `: «${user.message_body}»` : ''}`,
          }
        : {
            en: `${mod} deleted a message`,
            ru: `${mod} удалил(а) сообщение`,
            uk: `${mod} видалив(ла) повідомлення`,
          };
      break;
    case 'clear':
      content = {
        en: `${mod} cleared the chat`,
        ru: `${mod} очистил(а) чат`,
        uk: `${mod} очистив(ла) чат`,
      };
      break;
    case 'warn':
      content = user
        ? {
            en: `${mod} warned ${formatTargetUser(user)}${formatReasonSuffix(user.reason)}`,
            ru: `${mod} выдал(а) предупреждение ${formatTargetUser(user)}${formatReasonSuffix(user.reason)}`,
            uk: `${mod} дав(ла) попередження ${formatTargetUser(user)}${formatReasonSuffix(user.reason)}`,
          }
        : {
            en: `${mod} issued a warning`,
            ru: `${mod} выдал(а) предупреждение`,
            uk: `${mod} дав(ла) попередження`,
          };
      break;
    case 'mod':
      content = user
        ? {
            en: `${mod} granted moderator to ${formatTargetUser(user)}`,
            ru: `${mod} назначил(а) модератором ${formatTargetUser(user)}`,
            uk: `${mod} призначив(ла) модератором ${formatTargetUser(user)}`,
          }
        : {
            en: `${mod} granted moderator`,
            ru: `${mod} назначил(а) модератора`,
            uk: `${mod} призначив(ла) модератора`,
          };
      break;
    case 'unmod':
      content = user
        ? {
            en: `${mod} removed moderator from ${formatTargetUser(user)}`,
            ru: `${mod} снял(а) модератора с ${formatTargetUser(user)}`,
            uk: `${mod} зняв(ла) модератора з ${formatTargetUser(user)}`,
          }
        : {
            en: `${mod} removed moderator`,
            ru: `${mod} снял(а) модератора`,
            uk: `${mod} зняв(ла) модератора`,
          };
      break;
    case 'vip':
      content = user
        ? {
            en: `${mod} granted VIP to ${formatTargetUser(user)}`,
            ru: `${mod} выдал(а) VIP ${formatTargetUser(user)}`,
            uk: `${mod} надав(ла) VIP ${formatTargetUser(user)}`,
          }
        : {
            en: `${mod} granted VIP`,
            ru: `${mod} выдал(а) VIP`,
            uk: `${mod} надав(ла) VIP`,
          };
      break;
    case 'unvip':
      content = user
        ? {
            en: `${mod} removed VIP from ${formatTargetUser(user)}`,
            ru: `${mod} снял(а) VIP с ${formatTargetUser(user)}`,
            uk: `${mod} зняв(ла) VIP з ${formatTargetUser(user)}`,
          }
        : {
            en: `${mod} removed VIP`,
            ru: `${mod} снял(а) VIP`,
            uk: `${mod} зняв(ла) VIP`,
          };
      break;
    case 'emoteonly':
      content = {
        en: `${mod} enabled emote-only mode`,
        ru: `${mod} включил(а) режим только эмоты`,
        uk: `${mod} увімкнув(ла) режим лише емоутів`,
      };
      break;
    case 'emoteonlyoff':
      content = {
        en: `${mod} disabled emote-only mode`,
        ru: `${mod} выключил(а) режим только эмоты`,
        uk: `${mod} вимкнув(ла) режим лише емоутів`,
      };
      break;
    case 'followers':
      content = {
        en: `${mod} enabled followers-only mode (${event.follow_duration_minutes ?? 0} min)`,
        ru: `${mod} включил(а) режим только для фолловеров (${event.follow_duration_minutes ?? 0} мин)`,
        uk: `${mod} увімкнув(ла) режим лише для фолловерів (${event.follow_duration_minutes ?? 0} хв)`,
      };
      break;
    case 'followersoff':
      content = {
        en: `${mod} disabled followers-only mode`,
        ru: `${mod} выключил(а) режим только для фолловеров`,
        uk: `${mod} вимкнув(ла) режим лише для фолловерів`,
      };
      break;
    case 'slow':
      content = {
        en: `${mod} enabled slow mode (${event.wait_time_seconds ?? 0}s)`,
        ru: `${mod} включил(а) медленный режим (${event.wait_time_seconds ?? 0} сек)`,
        uk: `${mod} увімкнув(ла) повільний режим (${event.wait_time_seconds ?? 0} сек)`,
      };
      break;
    case 'slowoff':
      content = {
        en: `${mod} disabled slow mode`,
        ru: `${mod} выключил(а) медленный режим`,
        uk: `${mod} вимкнув(ла) повільний режим`,
      };
      break;
    case 'subscribers':
      content = {
        en: `${mod} enabled subscribers-only mode`,
        ru: `${mod} включил(а) режим только для подписчиков`,
        uk: `${mod} увімкнув(ла) режим лише для підписників`,
      };
      break;
    case 'subscribersoff':
      content = {
        en: `${mod} disabled subscribers-only mode`,
        ru: `${mod} выключил(а) режим только для подписчиков`,
        uk: `${mod} вимкнув(ла) режим лише для підписників`,
      };
      break;
    case 'uniquechat':
      content = {
        en: `${mod} enabled unique chat mode`,
        ru: `${mod} включил(а) режим уникальных сообщений`,
        uk: `${mod} увімкнув(ла) режим унікальних повідомлень`,
      };
      break;
    case 'uniquechatoff':
      content = {
        en: `${mod} disabled unique chat mode`,
        ru: `${mod} выключил(а) режим уникальных сообщений`,
        uk: `${mod} вимкнув(ла) режим унікальних повідомлень`,
      };
      break;
    case 'raid':
      content = user
        ? {
            en: `${mod} started raid to ${formatTargetUser(user)}`,
            ru: `${mod} начал(а) рейд на ${formatTargetUser(user)}`,
            uk: `${mod} розпочав(ла) рейд на ${formatTargetUser(user)}`,
          }
        : {
            en: `${mod} started a raid`,
            ru: `${mod} начал(а) рейд`,
            uk: `${mod} розпочав(ла) рейд`,
          };
      break;
    case 'unraid':
      content = {
        en: `${mod} cancelled the raid`,
        ru: `${mod} отменил(а) рейд`,
        uk: `${mod} скасував(ла) рейд`,
      };
      break;
    case 'approve_unban_request':
      content = user
        ? {
            en: `${mod} approved unban request for ${formatTargetUser(user)}${formatReasonSuffix(event.moderator_message)}`,
            ru: `${mod} одобрил(а) запрос на разбан ${formatTargetUser(user)}${formatReasonSuffix(event.moderator_message)}`,
            uk: `${mod} схвалив(ла) запит на розбан ${formatTargetUser(user)}${formatReasonSuffix(event.moderator_message)}`,
          }
        : {
            en: `${mod} approved an unban request`,
            ru: `${mod} одобрил(а) запрос на разбан`,
            uk: `${mod} схвалив(ла) запит на розбан`,
          };
      break;
    case 'deny_unban_request':
      content = user
        ? {
            en: `${mod} denied unban request for ${formatTargetUser(user)}${formatReasonSuffix(event.moderator_message)}`,
            ru: `${mod} отклонил(а) запрос на разбан ${formatTargetUser(user)}${formatReasonSuffix(event.moderator_message)}`,
            uk: `${mod} відхилив(ла) запит на розбан ${formatTargetUser(user)}${formatReasonSuffix(event.moderator_message)}`,
          }
        : {
            en: `${mod} denied an unban request`,
            ru: `${mod} отклонил(а) запрос на разбан`,
            uk: `${mod} відхилив(ла) запит на розбан`,
          };
      break;
    case 'add_blocked_term':
    case 'add_permitted_term':
    case 'remove_blocked_term':
    case 'remove_permitted_term':
      content = {
        en: `${mod} updated ${event.list ?? 'chat'} terms (${event.action})`,
        ru: `${mod} обновил(а) список слов (${event.action})`,
        uk: `${mod} оновив(ла) список слів (${event.action})`,
      };
      break;
    default:
      content = {
        en: `${mod}: ${event.action}`,
        ru: `${mod}: ${event.action}`,
        uk: `${mod}: ${event.action}`,
      };
      break;
  }

  return pushSystemChat(content, {
    id: `twitch:moderation:${event.action}:${Date.now()}`,
    style: MODERATION_STYLE,
  });
};

export const pushPollBegin = async (event: {
  id: string;
  title: string;
  choices: { id: string; title: string }[];
}) => {
  const options = event.choices
    .map((choice, index) => `${index + 1}. ${choice.title}`)
    .join('\n');
  return pushSystemChat(
    {
      en: `Poll started: «${event.title}»\n${options}`,
      ru: `Опрос создан: «${event.title}»\n${options}`,
      uk: `Опитування створено: «${event.title}»\n${options}`,
    },
    {
      id: `twitch:poll:begin:${event.id}`,
      style: POLL_STYLE,
    }
  );
};

export const pushPollEnd = async (event: {
  id: string;
  title: string;
  choices: {
    id: string;
    title: string;
    votes?: number;
  }[];
  status?: string;
}) => {
  const totalVotes = event.choices.reduce(
    (sum, choice) => sum + (choice.votes ?? 0),
    0
  );
  const lines = event.choices.map(choice => {
    const votes = choice.votes ?? 0;
    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    return `• ${choice.title} — ${percent}% (${votes})`;
  });
  const winner = [...event.choices].sort(
    (a, b) => (b.votes ?? 0) - (a.votes ?? 0)
  )[0];
  const winnerSuffix = winner
    ? {
        en: `\nWinner: ${winner.title} (${winner.votes ?? 0})`,
        ru: `\nПобедитель: ${winner.title} (${winner.votes ?? 0})`,
        uk: `\nПереможець: ${winner.title} (${winner.votes ?? 0})`,
      }
    : { en: '', ru: '', uk: '' };

  return pushSystemChat(
    {
      en: `Poll ended: «${event.title}»\n${lines.join('\n')}${winnerSuffix.en}`,
      ru: `Опрос завершён: «${event.title}»\n${lines.join('\n')}${winnerSuffix.ru}`,
      uk: `Опитування завершено: «${event.title}»\n${lines.join('\n')}${winnerSuffix.uk}`,
    },
    {
      id: `twitch:poll:end:${event.id}`,
      style: POLL_STYLE,
    }
  );
};

export const pushCustomRewardRedemption = async (event: {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  user_input?: string;
  reward: { id: string; title: string; cost: number };
}) => {
  const profile = await buildTwitchProfile({
    user_id: event.user_id,
    user_login: event.user_login,
    user_name: event.user_name,
  });
  const input = event.user_input?.trim();
  const message = formatRewardMessage(
    event.reward.title,
    event.reward.cost,
    input
  );
  const record = await dashboard.addRecord(
    {
      id: `twitch:redemption:${event.id}`,
      type: 'custom',
      platform: PLATFORM,
      from: profile.id,
      message,
      attach: [
        { type: 'reward_id', value: event.reward.id },
        { type: 'cost', value: String(event.reward.cost) },
      ],
    },
    profile,
    {
      trigger: {
        type: 'custom',
        key: 'redeems',
        value: event.reward.id,
      },
    }
  );

  if (getSettings().showRewardRedemption) {
    await pushRewardRedemptionChatNotification({
      id: event.id,
      user_id: event.user_id,
      user_login: event.user_login,
      user_name: event.user_name,
      user_input: input,
      rewardTitle: event.reward.title,
      rewardCost: event.reward.cost,
    });
  }

  return record;
};

export const pushAutomaticRewardRedemption = async (event: {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  user_input?: string;
  reward: { type: string; channel_points?: number; cost?: number };
  message?: { text?: string };
}) => {
  const profile = await buildTwitchProfile({
    user_id: event.user_id,
    user_login: event.user_login,
    user_name: event.user_name,
  });
  const title = formatAutomaticRewardType(event.reward.type);
  const cost = event.reward.channel_points ?? event.reward.cost ?? 0;
  const input =
    event.user_input?.trim() || event.message?.text?.trim() || undefined;
  const message = formatRewardMessage(title, cost, input);
  const record = await dashboard.addRecord(
    {
      id: `twitch:redemption:${event.id}`,
      type: 'custom',
      platform: PLATFORM,
      from: profile.id,
      message,
      attach: [
        { type: 'reward_type', value: event.reward.type },
        { type: 'cost', value: String(cost) },
      ],
    },
    profile
  );

  const isHighlighted = event.reward.type === 'send_highlighted_message';
  if (getSettings().showRewardRedemption || isHighlighted) {
    await pushRewardRedemptionChatNotification({
      id: event.id,
      user_id: event.user_id,
      user_login: event.user_login,
      user_name: event.user_name,
      user_input: input,
      rewardTitle: title,
      rewardCost: cost,
      kind: isHighlighted ? 'highlighted_message' : 'reward',
    });
  }

  return record;
};

const formatRewardMessage = (
  title: string,
  cost: number,
  userInput?: string
) => {
  const costSuffix = cost > 0 ? ` (${cost} pts)` : '';
  if (userInput) {
    return `«${title}»${costSuffix}: ${userInput}`;
  }
  return `«${title}»${costSuffix}`;
};

const formatHighlightedMessage = (userInput?: string) => {
  const text = userInput?.trim();
  return text || 'Highlighted message';
};

const formatAutomaticRewardType = (type: string) => {
  const labels: Record<string, string> = {
    send_highlighted_message: 'Highlighted message',
    random_sub_emote_unlock: 'Random sub emote',
    chosen_sub_emote_unlock: 'Chosen sub emote',
    message_effect: 'Message effect',
    gigantify_an_emote: 'Gigantified emote',
    celebration: 'On-screen celebration',
  };
  return labels[type] ?? type.replace(/_/g, ' ');
};

const formatTier = (tier: string) => {
  if (tier === '1000') {
    return 'Tier 1';
  }
  if (tier === '2000') {
    return 'Tier 2';
  }
  if (tier === '3000') {
    return 'Tier 3';
  }
  if (tier === 'Prime') {
    return 'Prime';
  }
  return tier;
};
