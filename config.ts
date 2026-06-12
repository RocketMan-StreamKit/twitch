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

export const RegenerateConfig = () => {
  api.config.getParams().then(params => {
    const access_token = params.access_token;
    TwitchApi.accessToken = access_token;
    if (TwitchApi.accessToken) {
      TwitchApi.validateTokenScopes(SCOPES).then(scopesOk => {
        if (!scopesOk) {
          clearTwitchAuth();
          return;
        }
        TwitchApi.GetMe().then(user => {
          if (!user) {
            clearTwitchAuth();
            return;
          }
          startTwitchTracking();
        });
      });
    } else {
      stopTwitchTracking();
    }
    GenerateConfig([
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
            editor: { label: { en: 'Logout', ru: 'Выйти', uk: 'Вийти' } },
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
    ]);
  });
};
