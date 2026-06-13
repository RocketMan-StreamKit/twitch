import { TwitchApi } from './api';
import { startTwitchTracking, stopTwitchTracking } from './tracking';

export const CLIENT_ID = `9e32kmze4fkvldsxqr3apoq3k5qpmm`;

const clearTwitchAuth = () => {
  stopTwitchTracking();
  return api.config.updateParams({ access_token: '' }).then(() => {
    TwitchApi.accessToken = null;
    RegenerateConfig();
  });
};

/** Scopes for EventSub (bits, subs, follows) and IRC chat. */
export const SCOPES = [
  'user:read:email',
  'user:read:chat',
  'user:write:chat',
  'channel:read:subscriptions',
  'channel:read:redemptions',
  'channel:manage:redemptions',
  'bits:read',
  'moderator:read:followers',
];

/**
 * Builds localized logout button labels with the authorized Twitch login in parentheses.
 * @param login Twitch account login (username).
 * @example
 * formatLogoutLabel('streamer_name');
 * // { en: 'Logout (streamer_name)', ru: 'Выйти (streamer_name)', ... }
 */
const formatLogoutLabel = (login: string) => ({
  en: `Logout (${login})`,
  ru: `Выйти (${login})`,
  uk: `Вийти (${login})`,
});

/**
 * Builds addon settings schema fields for the current auth state.
 * @param access_token Stored OAuth access token, if any.
 * @param login Authorized Twitch login shown on the logout button.
 */
const buildConfigFields = (
  access_token: string,
  login?: string
): AddonConfigSchema => [
  {
    key: 'access_token',
    type: 'text',
    default: '',
  },
  {
    key: 'last_update',
    type: 'number',
    default: 0,
  },
  access_token
    ? {
        type: 'button',
        key: 'logout',
        event: 'twitchLogout',
        editor: {
          label: login
            ? formatLogoutLabel(login)
            : { en: 'Logout', ru: 'Выйти', uk: 'Вийти' },
        },
      }
    : {
        type: 'button',
        key: 'test',
        event: 'twitchLogin',
        editor: {
          label: {
            en: 'Login via Twitch',
            ru: 'Войти через Twitch',
            uk: 'Войти через Twitch',
          },
        },
      },
];

export const RegenerateConfig = () => {
  void api.config.getParams().then(async params => {
    const access_token = params.access_token;
    TwitchApi.accessToken = access_token;

    if (TwitchApi.accessToken) {
      const scopesOk = await TwitchApi.validateTokenScopes(SCOPES);
      if (!scopesOk) {
        await clearTwitchAuth();
        return;
      }

      const user = await TwitchApi.GetMe();
      if (!user) {
        await clearTwitchAuth();
        return;
      }

      startTwitchTracking();
      GenerateConfig(buildConfigFields(access_token, user.login));
      return;
    }

    stopTwitchTracking();
    GenerateConfig(buildConfigFields(access_token));
  });
};
