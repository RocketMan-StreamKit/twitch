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
  'moderator:read:chat_messages',
  'moderator:read:chatters',
  'moderator:read:banned_users',
  'moderator:read:chat_settings',
  'moderator:read:blocked_terms',
  'moderator:read:unban_requests',
  'moderator:read:warnings',
  'moderator:read:moderators',
  'moderator:read:vips',
  'channel:read:polls',
  'moderator:read:shoutouts',
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
): AddonConfigSchema => {
  const chatSettings: AddonConfigSchema = [
    {
      key: 'show_moderator_actions',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Show moderator actions',
          ru: 'Отображать действия модератора',
          uk: 'Відображати дії модератора',
        },
      },
    },
    {
      key: 'show_join_leave',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Show join/leave events',
          ru: 'Отображать вход/выход из чата',
          uk: 'Відображати вхід/вихід з чату',
        },
      },
    },
    {
      key: 'show_polls',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Show polls',
          ru: 'Отображать опросы',
          uk: 'Відображати опитування',
        },
      },
    },
    {
      key: 'show_chat_raid',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Show channel raids in chat',
          ru: 'Отображать рейды канала в чате',
          uk: 'Відображати рейди каналу в чаті',
        },
      },
    },
    {
      key: 'chat_raid_min_viewers',
      type: 'number',
      default: 1,
      editor: {
        label: {
          en: 'Minimum raiders for raid notification',
          ru: 'Минимум рейдеров для оповещения о рейде',
          uk: 'Мінімум рейдерів для сповіщення про рейд',
        },
      },
    },
    {
      key: 'show_shoutout',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Show shoutouts in chat',
          ru: 'Отображать shoutout в чате',
          uk: 'Відображати shoutout у чаті',
        },
      },
    },
    {
      key: 'show_watch_streak',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Show watch streaks in chat',
          ru: 'Отображать watch streak в чате',
          uk: 'Відображати watch streak у чаті',
        },
      },
    },
    {
      key: 'watch_streak_min_count',
      type: 'number',
      default: 3,
      editor: {
        label: {
          en: 'Minimum watch streak for notification',
          ru: 'Минимальный streak для оповещения',
          uk: 'Мінімальний streak для сповіщення',
        },
      },
    },
    {
      key: 'show_reward_redemption',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Show reward redemptions in chat',
          ru: 'Отображать применение наград в чате',
          uk: 'Відображати застосування нагород у чаті',
        },
      },
    },
    {
      key: 'delete_unused_rewards',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Delete unused channel point rewards',
          ru: 'Удалять неиспользуемые награды',
          uk: 'Видаляти невикористані нагороди',
        },
      },
    },
    {
      key: 'show_first_user_message',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Show first user messages in chat',
          ru: 'Отображать первые сообщения зрителей в чате',
          uk: 'Відображати перші повідомлення глядачів у чаті',
        },
      },
    },
    {
      key: 'show_chat_subscriptions',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Show subscriptions in chat',
          ru: 'Отображать подписки в чате',
          uk: 'Відображати підписки в чаті',
        },
      },
    },
  ];

  return [
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
  ...(access_token ? chatSettings : []),
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
};

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
