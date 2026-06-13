import { TwitchApi } from './api';

/**
 * Exposes Twitch channel metadata to other addons via `addons.request`.
 * @example
 * // From another addon:
 * const response = await addons.request('twitch', 'getChannelId');
 */
addons.onRequest('getChannelId', async ({ fromAddonId }) => {
  if (!TwitchApi.accessToken) {
    return {
      success: false,
      message: 'Twitch is not authorized',
      fromAddonId,
    };
  }

  const user = await TwitchApi.GetMe();
  if (!user?.id) {
    return {
      success: false,
      message: 'Twitch channel is unavailable',
      fromAddonId,
    };
  }

  return {
    channelId: user.id,
    username: user.login,
    login: user.login,
    displayName: user.display_name,
  };
});
