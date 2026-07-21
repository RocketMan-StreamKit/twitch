import { TwitchApi } from './api';
import { patchParams } from './params';
import {
  buildTwitchAuthorizationUrl,
  buildTwitchBotAuthorizationUrl,
  getMissingScopes,
  getRequiredScopes,
  loadPersistedScopeRequests,
  requestReauthorizationIfNeeded,
  setGrantedScopes,
  setHadAuthorization,
} from './scopes';
import { startTwitchTracking, stopTwitchTracking } from './tracking';

const clearTwitchAuth = () => {
  stopTwitchTracking();
  return patchParams({ access_token: '' }).then(() => {
    TwitchApi.accessToken = null;
    RegenerateConfig();
  });
};

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
 * Builds localized bot disconnect button labels with the authorized Twitch login in parentheses.
 */
const formatBotDisconnectLabel = (login: string) => ({
  en: `Disconnect bot account (${login})`,
  ru: `Отключить аккаунт бота (${login})`,
  uk: `Відключити акаунт бота (${login})`,
});

/**
 * Strips `editor` from one field and recursively from nested `spoiler` / `page` items.
 * @param field Schema field that should stay in storage but remain hidden in the UI.
 * @example
 * withoutEditor({
 *   key: 'chat',
 *   type: 'page',
 *   editor: { label: { en: 'Chat' } },
 *   items: [{ key: 'show_polls', type: 'boolean', editor: { label: { en: 'Polls' } } }],
 * });
 */
const withoutEditor = (field: AddonConfigField): AddonConfigField => {
  const next: AddonConfigField = { ...field, editor: undefined };
  if (
    (field.type === 'spoiler' || field.type === 'page') &&
    Array.isArray(field.items)
  ) {
    next.items = withoutEditors(field.items as AddonConfigSchema);
  }
  return next;
};

/**
 * Returns schema fields without `editor` blocks so values persist but stay hidden in the UI.
 * Recurses into nested `spoiler` / `page` containers.
 * @param fields Addon config fields that should remain in storage when not shown in settings.
 * @example
 * withoutEditors([{ key: 'debug', type: 'boolean', editor: { label: { en: 'Debug' } } }]);
 */
const withoutEditors = (fields: AddonConfigSchema): AddonConfigSchema =>
  fields.map(entry => {
    if (Array.isArray(entry)) {
      return entry.map(withoutEditor);
    }
    return withoutEditor(entry);
  });

/**
 * Builds localized auth URL field labels for copy-paste OAuth links.
 */
const authUrlField = (
  key: string,
  labels: { en: string; ru: string; uk: string }
): AddonConfigSchema[number] => ({
  key,
  type: 'text',
  default: '',
  editor: {
    label: labels,
    description: {
      en: 'Copy this link and open it in a browser to authorize',
      ru: 'Скопируйте ссылку и откройте в браузере для авторизации',
      uk: 'Скопіюйте посилання та відкрийте в браузері для авторизації',
    },
  },
});

/**
 * Builds addon settings schema fields for the current auth state.
 * @param access_token Stored main OAuth access token, if any.
 * @param login Authorized main Twitch login shown on the logout button.
 * @param bot_access_token Stored bot OAuth access token, if any.
 * @param botLogin Authorized bot Twitch login shown on the bot logout button.
 */
const buildConfigFields = (
  access_token: string,
  login?: string,
  bot_access_token?: string,
  botLogin?: string
): AddonConfigSchema => {
  const chatEventFields: AddonConfigSchema = [
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
    {
      key: 'colorize_me_messages',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Color /me messages with nickname color',
          ru: 'Окрашивать сообщения /me цветом ника',
          uk: 'Забарвлювати повідомлення /me кольором ніка',
        },
        description: {
          en: 'When a viewer uses /me, show the message text in their nickname color',
          ru: 'Когда зритель использует /me, текст сообщения показывается цветом его ника',
          uk: 'Коли глядач використовує /me, текст повідомлення показується кольором його ніка',
        },
      },
    },
    {
      key: 'speak_highlighted_messages',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Speak highlighted messages via TTS',
          ru: 'Озвучивать выделенные сообщения через TTS',
          uk: 'Озвучувати виділені повідомлення через TTS',
        },
        description: {
          en: 'Uses the TTS engine configured in StreamKit+ settings',
          ru: 'Использует движок TTS из настроек StreamKit+',
          uk: 'Використовує рушій TTS із налаштувань StreamKit+',
        },
      },
    },
  ];

  const rewardFields: AddonConfigSchema = [
    {
      key: 'reward_lifecycle',
      type: 'select',
      default: 'none',
      options: [
        {
          value: 'none',
          label: {
            en: 'Do nothing',
            ru: 'Ничего не делать',
            uk: 'Нічого не робити',
          },
        },
        {
          value: 'pause',
          label: {
            en: 'Pause on Twitch',
            ru: 'Ставить на паузу на Twitch',
            uk: 'Ставити на паузу на Twitch',
          },
        },
        {
          value: 'disable',
          label: {
            en: 'Disable on Twitch',
            ru: 'Отключать на Twitch',
            uk: 'Вимикати на Twitch',
          },
        },
        {
          value: 'delete',
          label: {
            en: 'Delete on Twitch',
            ru: 'Удалять на Twitch',
            uk: 'Видаляти на Twitch',
          },
        },
      ],
      editor: {
        label: {
          en: 'When a reward is no longer needed',
          ru: 'Когда награда больше не нужна',
          uk: 'Коли нагорода більше не потрібна',
        },
        description: {
          en: 'Applies when you remove a trigger, disable a sound/hotkey, or close StreamKit / disable this addon. While StreamKit is connected, rewards used by active triggers are always forced enabled and unpaused (even if changed manually on Twitch).',
          ru: 'Срабатывает при удалении триггера, выключении звука/хоткея или закрытии StreamKit / отключении аддона. Пока StreamKit подключён, награды активных триггеров всегда принудительно включаются и снимаются с паузы (даже если их меняли вручную на Twitch).',
          uk: 'Спрацьовує при видаленні тригера, вимкненні звуку/хоткея або закритті StreamKit / вимкненні аддона. Поки StreamKit підключений, нагороди активних тригерів завжди примусово вмикаються і знімаються з паузи (навіть якщо їх змінювали вручну на Twitch).',
        },
      },
    },
    {
      key: 'delete_unused_rewards',
      type: 'boolean',
      default: false,
    },
    {
      key: 'add_reward_emoji',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Add emoji to reward titles',
          ru: 'Добавлять эмодзи к названию награды',
          uk: 'Додавати емодзі до назви нагороди',
        },
        description: {
          en: 'When enabled, a prefix emoji is added to generated reward titles: sounds — 🔊, overlays — 📺, hotkey integrations — ⌨️, game integrations — 🎮',
          ru: 'Когда включено, в начале названия награды при генерации добавляется эмодзи: для звуков — 🔊, оверлеев — 📺, хоткей-интеграций — ⌨️, игровых интеграций — 🎮',
          uk: 'Коли увімкнено, на початку назви нагороди під час генерації додається емодзі: для звуків — 🔊, оверлеїв — 📺, хоткей-інтеграцій — ⌨️, ігрових інтеграцій — 🎮',
        },
      },
    },
  ];

  const chatSettingsPage: AddonConfigField = {
    key: 'chat_settings',
    type: 'page',
    editor: {
      label: {
        en: 'Chat settings',
        ru: 'Настройки чата',
        uk: 'Налаштування чату',
      },
      description: {
        en: 'Chat event display, TTS, and channel point rewards',
        ru: 'Отображение событий чата, TTS и награды за баллы канала',
        uk: 'Відображення подій чату, TTS і нагороди за бали каналу',
      },
    },
    items: [
      ...chatEventFields,
      {
        key: 'channel_point_rewards',
        type: 'spoiler',
        editor: {
          label: {
            en: 'Channel point rewards',
            ru: 'Награды за баллы канала',
            uk: 'Нагороди за бали каналу',
          },
        },
        items: rewardFields,
      },
    ],
  };

  const mainAccountFields: AddonConfigSchema = [
    authUrlField('auth_url', {
      en: 'Main account authorization link',
      ru: 'Ссылка для авторизации основной учётки',
      uk: 'Посилання для авторизації основного акаунта',
    }),
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

  const botAccountFields: AddonConfigSchema = [
    authUrlField('bot_auth_url', {
      en: 'Bot account authorization link',
      ru: 'Ссылка для авторизации учётки бота',
      uk: 'Посилання для авторизації акаунта бота',
    }),
    bot_access_token
      ? {
          type: 'button',
          key: 'bot_logout',
          event: 'twitchBotLogout',
          editor: {
            label: botLogin
              ? formatBotDisconnectLabel(botLogin)
              : {
                  en: 'Disconnect bot account',
                  ru: 'Отключить аккаунт бота',
                  uk: 'Відключити акаунт бота',
                },
          },
        }
      : {
          type: 'button',
          key: 'bot_login',
          event: 'twitchBotLogin',
          editor: {
            label: {
              en: 'Login bot via Twitch',
              ru: 'Войти ботом через Twitch',
              uk: 'Увійти ботом через Twitch',
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
      key: 'bot_access_token',
      type: 'text',
      default: '',
    },
    {
      key: 'last_update',
      type: 'number',
      default: 0,
    },
    {
      key: 'addon_requested_scopes',
      type: 'object',
      default: {},
    },
    {
      key: 'main_account',
      type: 'spoiler',
      editor: {
        label: {
          en: 'Main account',
          ru: 'Основной аккаунт',
          uk: 'Основний акаунт',
        },
      },
      items: mainAccountFields,
    },
    {
      key: 'bot_account',
      type: 'spoiler',
      editor: {
        label: {
          en: 'Bot account',
          ru: 'Аккаунт бота',
          uk: 'Акаунт бота',
        },
        description: {
          en: 'Optional second login for sending chat messages',
          ru: 'Опциональный второй вход для отправки сообщений в чат',
          uk: 'Опційний другий вхід для надсилання повідомлень у чат',
        },
      },
      items: botAccountFields,
    },
    access_token ? chatSettingsPage : withoutEditor(chatSettingsPage),
  ];
};

export const RegenerateConfig = () => {
  void api.config.getParams().then(async params => {
    const access_token = params.access_token;
    const bot_access_token =
      typeof params.bot_access_token === 'string'
        ? params.bot_access_token
        : '';
    TwitchApi.accessToken = access_token;
    TwitchApi.botAccessToken = bot_access_token || null;
    await loadPersistedScopeRequests();
    setHadAuthorization(Boolean(access_token));

    const authUrl = buildTwitchAuthorizationUrl();
    const botAuthUrl = buildTwitchBotAuthorizationUrl();
    await patchParams({
      auth_url: authUrl,
      bot_auth_url: botAuthUrl,
    });

    let botLogin: string | undefined;
    let activeBotToken = bot_access_token;
    if (bot_access_token) {
      const botValidation =
        await TwitchApi.fetchTokenValidation(bot_access_token);
      if (botValidation.status !== 'valid') {
        await patchParams({ bot_access_token: '' });
        TwitchApi.botAccessToken = null;
        activeBotToken = '';
      } else {
        const botUser = await TwitchApi.GetMe(bot_access_token);
        if (!botUser) {
          await patchParams({ bot_access_token: '' });
          TwitchApi.botAccessToken = null;
          activeBotToken = '';
        } else {
          botLogin = botUser.login;
        }
      }
    }

    if (TwitchApi.accessToken) {
      const validation = await TwitchApi.fetchTokenValidation();
      if (validation.status !== 'valid') {
        await clearTwitchAuth();
        return;
      }

      setGrantedScopes(validation.scopes);
      const missingScopes = getMissingScopes(getRequiredScopes());
      if (missingScopes.length > 0) {
        requestReauthorizationIfNeeded(missingScopes);
      }

      const user = await TwitchApi.GetMe();
      if (!user) {
        await clearTwitchAuth();
        return;
      }

      startTwitchTracking();
      GenerateConfig(
        buildConfigFields(access_token, user.login, activeBotToken, botLogin)
      );
      return;
    }

    stopTwitchTracking();
    GenerateConfig(
      buildConfigFields(access_token, undefined, activeBotToken, botLogin)
    );
  });
};
