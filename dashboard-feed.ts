import { TwitchApi } from './api';
import { PLATFORM } from './constants';

export type TwitchEventUser = {
  user_id: string;
  user_login: string;
  user_name: string;
};

const userId = (id: string) => `twitch:${id}`;

const avatarCache = new Map<string, string>();

const resolveUserAvatar = async (twitchUserId: string) => {
  if (!twitchUserId || twitchUserId === 'anonymous') {
    return '';
  }

  const cached = avatarCache.get(twitchUserId);
  if (cached) {
    return cached;
  }

  const url = await TwitchApi.GetUserProfileImage(twitchUserId);
  if (!url) {
    return '';
  }

  avatarCache.set(twitchUserId, url);
  return url;
};

const buildTwitchProfile = async (
  user: TwitchEventUser,
  extra?: { color?: string }
) => {
  const avatar = await resolveUserAvatar(user.user_id);
  return {
    id: userId(user.user_id),
    name: user.user_name,
    avatar,
    platform: PLATFORM,
    ...extra,
  };
};

export const toDashboardUser = (user: TwitchEventUser, avatar = '') => ({
  id: userId(user.user_id),
  name: user.user_name,
  avatar,
  platform: PLATFORM,
});

export const pushFollow = async (user: TwitchEventUser) => {
  const profile = await buildTwitchProfile(user);
  return dashboard.addRecord(
    {
      type: 'follow',
      platform: PLATFORM,
      from: profile.id,
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

export const pushSubRenewal = async (
  user: TwitchEventUser,
  cumulativeMonths: number,
  text?: string
) => {
  const profile = await buildTwitchProfile(user);
  const months = cumulativeMonths > 0 ? `${cumulativeMonths} months` : 'resub';
  const message = text?.trim()
    ? `Resub (${months}): ${text}`
    : `Resub — ${months}`;
  return dashboard.addRecord(
    {
      type: 'custom',
      platform: PLATFORM,
      from: profile.id,
      message,
      attach: [{ type: 'months', value: String(cumulativeMonths) }],
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
  const map = new Map<string, string>();

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

    map.set(word, url);
  }

  const entries = [...map.entries()].map(([word, url]) => ({ word, url }));
  return entries.length ? entries : undefined;
};

export const pushChatFromEventSub = async (event: {
  chatter_user_id: string;
  chatter_user_login: string;
  chatter_user_name: string;
  message?: { text?: string; fragments?: unknown };
  color?: string;
  badges?: { set_id: string; id: string }[];
  channel_points_custom_reward_id?: string | null;
}) => {
  if (event.channel_points_custom_reward_id) {
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
  return pushChatMessage(
    event.chatter_user_login,
    event.chatter_user_name,
    content,
    event.chatter_user_id,
    event.color,
    icons,
    emotes
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
  return dashboard.addRecord(
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
  return dashboard.addRecord(
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
