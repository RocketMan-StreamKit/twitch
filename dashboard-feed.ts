import { dispatchChatMessageTriggers } from './chat-triggers';
import { PLATFORM } from './constants';
import {
  buildTwitchProfile,
  resolveUserAvatar,
  type TwitchEventUser,
} from './dashboard-user';
import { speakHighlightedMessage } from './highlighted-tts';
import { getSettings } from './settings';
import { getBroadcasterLogin } from './tracking';

export type { TwitchEventUser } from './dashboard-user';
export { buildTwitchProfile, toDashboardUser } from './dashboard-user';

type LocalizedText = { en: string; ru?: string; uk?: string };

/**
 * Returns a localized subscription tier label.
 * @param tier Twitch tier code (`1000`, `2000`, `3000`, `Prime`, …).
 * @example localizedTier('1000') // { en: 'Tier 1', ru: 'Тир 1', uk: 'Тир 1' }
 */
const localizedTier = (tier: string): LocalizedText => {
  if (tier === '1000') {
    return { en: 'Tier 1', ru: 'уровень 1', uk: 'рівень 1' };
  }
  if (tier === '2000') {
    return { en: 'Tier 2', ru: 'уровень 2', uk: 'рівень 2' };
  }
  if (tier === '3000') {
    return { en: 'Tier 3', ru: 'уровень 3', uk: 'рівень 3' };
  }
  if (tier === 'Prime') {
    return { en: 'Prime', ru: 'Prime', uk: 'Prime' };
  }
  return { en: tier, ru: tier, uk: tier };
};

/**
 * Formats a Russian plural noun phrase with a numeric prefix.
 * @param count Numeric value.
 * @param one Nominative singular (1, 21, …).
 * @param few Genitive singular (2–4, 22–24, …).
 * @param many Genitive plural (0, 5–20, 25–30, …).
 */
const pluralRussian = (
  count: number,
  one: string,
  few: string,
  many: string
) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${count} ${one}`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} ${few}`;
  }
  return `${count} ${many}`;
};

/**
 * Formats a Ukrainian plural noun phrase with a numeric prefix.
 * @param count Numeric value.
 * @param one Nominative singular (1, 21, …).
 * @param few Nominative plural (2–4, 22–24, …).
 * @param many Genitive plural (0, 5–20, 25–30, …).
 */
const pluralUkrainian = (
  count: number,
  one: string,
  few: string,
  many: string
) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${count} ${one}`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} ${few}`;
  }
  return `${count} ${many}`;
};

/**
 * Returns a localized subscribed-months label for resub messages.
 * @param months Cumulative subscribed months; `0` yields a generic resub label.
 */
const localizedMonths = (months: number): LocalizedText => {
  if (months <= 0) {
    return { en: 'resub', ru: 'ресаб', uk: 'ресаб' };
  }
  return {
    en: `${months} month${months === 1 ? '' : 's'}`,
    ru: pluralRussian(months, 'месяц', 'месяца', 'месяцев'),
    uk: pluralUkrainian(months, 'місяць', 'місяці', 'місяців'),
  };
};

/**
 * Builds a localized message for bulk gifted subs.
 * @param total Number of gifted subs.
 * @param tier Twitch tier code.
 */
const localizedGiftedSubs = (total: number, tier: string): LocalizedText => {
  const tierLabel = localizedTier(tier);
  if (total === 1) {
    return {
      en: `Gifted 1 sub (${tierLabel.en})`,
      ru: `Подарена 1 подписка (${tierLabel.ru})`,
      uk: `Подарована 1 підписка (${tierLabel.uk})`,
    };
  }
  return {
    en: `Gifted ${total} subs (${tierLabel.en})`,
    ru: `Подарено ${pluralRussian(total, 'подписку', 'подписки', 'подписок')} (${tierLabel.ru})`,
    uk: `Подаровано ${pluralUkrainian(total, 'підписку', 'підписки', 'підписок')} (${tierLabel.uk})`,
  };
};

/**
 * Builds a localized message for a one-to-one gifted sub.
 * @param recipientName Recipient display name.
 * @param tier Twitch tier code.
 */
const localizedGiftedSubTo = (
  recipientName: string,
  tier: string
): LocalizedText => {
  const tierLabel = localizedTier(tier);
  return {
    en: `Gifted sub to ${recipientName} (${tierLabel.en})`,
    ru: `Подарочная подписка для ${recipientName} (${tierLabel.ru})`,
    uk: `Подарункова підписка для ${recipientName} (${tierLabel.uk})`,
  };
};

/**
 * Builds a localized gift-subscription message for the recipient.
 * @param tier Twitch tier code.
 */
const localizedGiftSubscription = (tier: string): LocalizedText => {
  const tierLabel = localizedTier(tier);
  return {
    en: `Gift subscription (${tierLabel.en})`,
    ru: `Подарочная подписка (${tierLabel.ru})`,
    uk: `Подарункова підписка (${tierLabel.uk})`,
  };
};

/**
 * Builds a localized paid subscription message (new sub, not resub).
 * @param tier Twitch tier code.
 */
const localizedPaidSubscription = (tier: string): LocalizedText => {
  const tierLabel = localizedTier(tier);
  return {
    en: `Paid subscription (${tierLabel.en})`,
    ru: `Платная подписка (${tierLabel.ru})`,
    uk: `Платна підписка (${tierLabel.uk})`,
  };
};

/**
 * Builds a localized resub line with months and tier.
 * @param months Cumulative subscribed months.
 * @param tier Twitch tier code.
 */
const localizedResubLine = (months: number, tier: string): LocalizedText => {
  const monthsLabel = localizedMonths(months);
  const tierLabel = localizedTier(tier);
  return {
    en: `Renewed subscription: ${monthsLabel.en} (${tierLabel.en})`,
    ru: `Продлил подписку: ${monthsLabel.ru} (${tierLabel.ru})`,
    uk: `Продовжив підписку: ${monthsLabel.uk} (${tierLabel.uk})`,
  };
};

/**
 * Builds a localized resub line with months only.
 * @param months Cumulative subscribed months.
 */
const localizedResubMonthsOnly = (months: number): LocalizedText => {
  const monthsLabel = localizedMonths(months);
  return {
    en: `Renewed subscription: ${monthsLabel.en}`,
    ru: `Продлил подписку: ${monthsLabel.ru}`,
    uk: `Продовжив підписку: ${monthsLabel.uk}`,
  };
};

/**
 * Builds a localized resub line that includes optional user message text.
 * @param months Cumulative subscribed months.
 * @param tier Optional Twitch tier code.
 * @param text Resub message text from chat.
 */
const localizedResubWithText = (
  months: number,
  tier: string | undefined,
  text: string
): LocalizedText => {
  const monthsLabel = localizedMonths(months);
  if (tier) {
    const tierLabel = localizedTier(tier);
    return {
      en: `Renewed subscription (${monthsLabel.en}, ${tierLabel.en}): ${text}`,
      ru: `Продлил подписку (${monthsLabel.ru}, ${tierLabel.ru}): ${text}`,
      uk: `Продовжив підписку (${monthsLabel.uk}, ${tierLabel.uk}): ${text}`,
    };
  }
  return {
    en: `Renewed subscription (${monthsLabel.en}): ${text}`,
    ru: `Продлил подписку (${monthsLabel.ru}): ${text}`,
    uk: `Продовжив підписку (${monthsLabel.uk}): ${text}`,
  };
};

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
  const message = isGift
    ? localizedGiftSubscription(tier)
    : localizedPaidSubscription(tier);
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
      type: 'subscribe',
      platform: PLATFORM,
      from: profile.id,
      message: localizedGiftedSubs(total, tier),
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
  return dashboard.addRecord(
    {
      type: 'subscribe',
      platform: PLATFORM,
      from: profile.id,
      message: localizedGiftedSubTo(recipientName, tier),
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
  return dashboard.addRecord(
    {
      type: 'subscribe',
      platform: PLATFORM,
      from: profile.id,
      message: localizedResubLine(cumulativeMonths, tier),
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
  const message = text?.trim()
    ? localizedResubWithText(cumulativeMonths, tier, text.trim())
    : tier
      ? localizedResubLine(cumulativeMonths, tier)
      : localizedResubMonthsOnly(cumulativeMonths);
  const attach = [{ type: 'months', value: String(cumulativeMonths) }];
  if (tier) {
    attach.push({ type: 'tier', value: tier });
  }
  return dashboard.addRecord(
    {
      type: 'subscribe',
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

/**
 * Pushes a user chat line to the dashboard.
 * @param login Twitch login of the author.
 * @param displayName Display name shown in chat.
 * @param content Message text (already cleaned of CTCP wrappers when needed).
 * @param twitchUserId Optional Helix user id for avatar/profile lookup.
 * @param color Optional nickname color for the author profile.
 * @param icons Optional badge icon ids.
 * @param emotes Optional emote word→url map for rendering.
 * @param style Optional bordered/header frame style.
 * @param messageId Optional stable dashboard message id.
 * @param textColor Optional message text color (`#rrggbb` or `_as_user_`).
 * @example
 * await pushChatMessage('viewer', 'Viewer', 'hello', '123', '#9147ff');
 */
const isMention = (content: string, login: string): boolean => {
  if (!login) return false;
  const escaped = login.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionRegex = new RegExp(
    `(?:^|[\\s,])@?${escaped},?(?:[\\s,]|$)`,
    'i'
  );
  return mentionRegex.test(content);
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
  messageId?: string,
  textColor?: string,
  system?: boolean
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
  const mention = !system && isMention(content, getBroadcasterLogin() ?? '');
  return dashboard.addChatMessage(
    {
      id: messageId,
      content,
      platform: PLATFORM,
      from: profile.id,
      color: textColor,
      emotes: emotes?.length ? emotes : undefined,
      style,
      system,
      mention: mention || undefined,
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

/** CTCP delimiter used by Twitch for `/me` (ACTION) messages. */
const CTCP_DELIMITER = '\u0001';

/** Prefix of a Twitch `/me` ACTION payload (`\u0001ACTION `). */
const ACTION_PREFIX = `${CTCP_DELIMITER}ACTION `;

/**
 * Parses Twitch chat text, stripping CTCP ACTION wrappers from `/me` messages.
 * @param text Raw `message.text` from EventSub (`\u0001ACTION …\u0001` for `/me`).
 * @returns Clean content and whether the message was a `/me` action.
 * @example
 * parseTwitchChatText('\u0001ACTION test message\u0001')
 * // { content: 'test message', isAction: true }
 */
const parseTwitchChatText = (
  text: string
): { content: string; isAction: boolean } => {
  const raw = text.trim();
  if (!raw.startsWith(ACTION_PREFIX)) {
    return { content: raw, isAction: false };
  }
  let body = raw.slice(ACTION_PREFIX.length);
  if (body.endsWith(CTCP_DELIMITER)) {
    body = body.slice(0, -1);
  }
  return { content: body.trim(), isAction: true };
};

/**
 * Pushes a Twitch EventSub chat message to the dashboard and dispatches triggers.
 * `/me` messages (`\u0001ACTION …\u0001`) are unwrapped; when colorize is enabled,
 * their text color is set to `_as_user_`.
 * @param event Channel chat message EventSub payload fields used by the addon.
 */
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
  const { content, isAction } = parseTwitchChatText(event.message?.text ?? '');
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
  const textColor =
    isAction && getSettings().colorizeMeMessages ? '_as_user_' : undefined;
  await pushChatMessage(
    event.chatter_user_login,
    event.chatter_user_name,
    content,
    event.chatter_user_id,
    event.color,
    icons,
    emotes,
    style,
    messageId,
    textColor
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
    event.messageId,
    undefined,
    true
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
    `twitch:shoutout:${event.toLogin}:${Date.now()}`,
    undefined,
    true
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
  if (kind === 'highlighted_message') {
    void speakHighlightedMessage(input ?? '');
  }
  return pushChatMessage(
    event.user_login,
    event.user_name,
    message,
    event.user_id,
    undefined,
    undefined,
    undefined,
    chatNotificationStyle(kind),
    `twitch:reward-chat:${event.id}`,
    undefined,
    true
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
    event.message_id ? `twitch:announcement:${event.message_id}` : undefined,
    undefined,
    true
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
