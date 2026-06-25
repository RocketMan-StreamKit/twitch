import { TwitchApi } from './api';
import { PLATFORM } from './constants';

export type TwitchEventUser = {
  user_id: string;
  user_login: string;
  user_name: string;
};

const userId = (id: string) => `twitch:${id}`;

const avatarCache = new Map<string, string>();

/**
 * Resolves a Twitch user avatar URL with in-memory caching.
 * @param twitchUserId Twitch user id.
 */
export const resolveUserAvatar = async (twitchUserId: string) => {
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

/**
 * Builds a dashboard user profile for a Twitch EventSub / Helix user payload.
 * @param user Twitch user ids and display fields.
 * @param extra Optional profile fields such as chat color.
 */
export const buildTwitchProfile = async (
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

/**
 * Maps a Twitch user to a dashboard record user without fetching an avatar.
 * @param user Twitch user ids and display fields.
 * @param avatar Optional cached avatar URL.
 */
export const toDashboardUser = (user: TwitchEventUser, avatar = '') => ({
  id: userId(user.user_id),
  name: user.user_name,
  avatar,
  platform: PLATFORM,
});
