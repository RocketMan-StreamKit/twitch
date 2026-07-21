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
        description: {
          en: 'Show timeouts, bans, and other moderator actions in the chat feed',
          ru: 'Показывать таймауты, баны и другие действия модераторов в ленте чата',
          uk: 'Показувати таймаути, бани та інші дії модераторів у стрічці чату',
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
        description: {
          en: 'Notify when viewers join or leave the chat (can be noisy on large streams)',
          ru: 'Уведомлять о входе и выходе зрителей из чата (на больших стримах может быть шумно)',
          uk: 'Сповіщати про вхід і вихід глядачів з чату (на великих стрімах може бути шумно)',
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
        description: {
          en: 'Show channel poll start and end events in the chat feed',
          ru: 'Показывать в ленте чата начало и завершение опросов канала',
          uk: 'Показувати у стрічці чату початок і завершення опитувань каналу',
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
        description: {
          en: 'Show incoming raid notifications in the chat feed',
          ru: 'Показывать уведомления о входящих рейдах в ленте чата',
          uk: 'Показувати сповіщення про вхідні рейди у стрічці чату',
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
        description: {
          en: 'Raid is shown in chat only if it brings at least this many viewers',
          ru: 'Рейд показывается в чате только если пришло не меньше указанного числа зрителей',
          uk: 'Рейд показується в чаті лише якщо прийшло не менше вказаної кількості глядачів',
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
        description: {
          en: 'Show Twitch shoutout events in the chat feed when a channel is shouted out',
          ru: 'Показывать в ленте чата события Twitch shoutout, когда каналу делают shoutout',
          uk: 'Показувати у стрічці чату події Twitch shoutout, коли каналу роблять shoutout',
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
        description: {
          en: 'Show when a viewer reaches a watch streak milestone in the chat feed',
          ru: 'Показывать в ленте чата, когда зритель достигает вехи watch streak',
          uk: 'Показувати у стрічці чату, коли глядач досягає віхи watch streak',
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
        description: {
          en: 'Watch streak is shown only if the streak count is at least this value',
          ru: 'Watch streak показывается только если длина streak не меньше этого значения',
          uk: 'Watch streak показується лише якщо довжина streak не менша за це значення',
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
        description: {
          en: 'Show channel point reward redemptions in the chat feed',
          ru: 'Показывать в ленте чата активации наград за баллы канала',
          uk: 'Показувати у стрічці чату активації нагород за бали каналу',
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
        description: {
          en: "Highlight a viewer's first chat message on the channel",
          ru: 'Выделять первое сообщение зрителя в чате канала',
          uk: 'Виділяти перше повідомлення глядача в чаті каналу',
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
        description: {
          en: 'Show new subscriptions, resubs, and gift subs in the chat feed',
          ru: 'Показывать в ленте чата новые подписки, продления и подарочные подписки',
          uk: 'Показувати у стрічці чату нові підписки, продовження та подарункові підписки',
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
    {
      key: 'random_reward_color',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Random color for each reward',
          ru: 'Случайный цвет для каждой награды',
          uk: 'Випадковий колір для кожної нагороди',
        },
        description: {
          en: 'When enabled, each newly generated channel-point reward gets a random background color on Twitch',
          ru: 'Когда включено, при генерации каждой новой награды за баллы канала задаётся случайный цвет фона на Twitch',
          uk: 'Коли увімкнено, під час генерації кожної нової нагороди за бали каналу задається випадковий колір фону на Twitch',
        },
      },
    },
  ];

  const clipAutomationFields: AddonConfigSchema = [
    {
      key: 'auto_clip_on_overlay',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Auto-create clip on overlay trigger',
          ru: 'Автоматически создавать клип при вызове оверлея',
          uk: 'Автоматично створювати кліп при виклику оверлею',
        },
        description: {
          en: 'When an event that shows an overlay appears, a clip is created automatically',
          ru: 'При появлении события с отображением оверлея автоматически создаётся клип',
          uk: 'При появі події з показом оверлею автоматично створюється кліп',
        },
      },
    },
    {
      key: 'auto_clip_duration_seconds',
      type: 'number',
      default: 30,
      editor: {
        validation: {
          min: 15,
          max: 60,
        },
        label: {
          en: 'Clip length (seconds)',
          ru: 'Длина клипа (секунды)',
          uk: 'Довжина кліпу (секунди)',
        },
        description: {
          en: 'Clip duration sent to Twitch Create Clip (15–60). Default is 30',
          ru: 'Длительность клипа для Twitch Create Clip (15–60). По умолчанию 30',
          uk: 'Тривалість кліпу для Twitch Create Clip (15–60). За замовчуванням 30',
        },
      },
    },
    {
      key: 'auto_clip_post_chat',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Post auto-created clip link to chat',
          ru: 'Отправлять ссылку на авто-клип в чат',
          uk: 'Надсилати посилання на авто-кліп у чат',
        },
        description: {
          en: 'After an auto-created clip is ready, send its URL to Twitch chat (uses the bot account when connected)',
          ru: 'После готовности автоматически созданного клипа отправляет его URL в чат Twitch (через аккаунт бота, если он подключён)',
          uk: 'Після готовності автоматично створеного кліпу надсилає його URL у чат Twitch (через акаунт бота, якщо він підключений)',
        },
      },
    },
  ];

  const raidShoutoutFields: AddonConfigSchema = [
    {
      key: 'auto_shoutout_on_raid',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Send shoutout on raid',
          ru: 'Отправлять shoutout при рейде',
          uk: 'Надсилати shoutout під час рейду',
        },
        description: {
          en: 'Sends a /shoutout mentioning the raiding channel',
          ru: 'Отправляет /shoutout с упоминанием канала-рейдера',
          uk: 'Надсилає /shoutout зі згадкою каналу-рейдера',
        },
      },
    },
    {
      key: 'auto_shoutout_min_viewers',
      type: 'number',
      default: 10,
      editor: {
        label: {
          en: 'Minimum raiders for auto-shoutout',
          ru: 'Минимум рейдеров для авто-shoutout',
          uk: 'Мінімум рейдерів для авто-shoutout',
        },
        description: {
          en: 'Auto-shoutout runs only when the raid brings at least this many viewers',
          ru: 'Авто-shoutout срабатывает только если в рейде не меньше указанного числа зрителей',
          uk: 'Авто-shoutout спрацьовує лише якщо в рейді не менше вказаної кількості глядачів',
        },
      },
    },
    {
      key: 'auto_shoutout_delay_seconds',
      type: 'number',
      default: 10,
      editor: {
        label: {
          en: 'Delay before auto-shoutout (seconds)',
          ru: 'Задержка перед авто-shoutout (секунды)',
          uk: 'Затримка перед авто-shoutout (секунди)',
        },
        description: {
          en: 'How long to wait after the raid notification before calling the shoutout API',
          ru: 'Сколько секунд ждать после оповещения о рейде перед вызовом API shoutout',
          uk: 'Скільки секунд чекати після сповіщення про рейд перед викликом API shoutout',
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
          description: {
            en: 'Lifecycle policy and options applied when generating rewards',
            ru: 'Политика жизненного цикла и опции при генерации наград',
            uk: 'Політика життєвого циклу та опції під час генерації нагород',
          },
        },
        items: rewardFields,
      },
    ],
  };

  const automationSettingsPage: AddonConfigField = {
    key: 'automation_settings',
    type: 'page',
    editor: {
      label: {
        en: 'Automation',
        ru: 'Автоматизация',
        uk: 'Автоматизація',
      },
      description: {
        en: 'Auto clips for overlay triggers and shoutouts for incoming raids',
        ru: 'Авто-клипы при вызове оверлея и shoutout при входящих рейдах',
        uk: 'Авто-кліпи при виклику оверлею та shoutout під час вхідних рейдів',
      },
    },
    items: [
      {
        key: 'auto_clips',
        type: 'spoiler',
        editor: {
          label: {
            en: 'Auto clips',
            ru: 'Авто-клипы',
            uk: 'Авто-кліпи',
          },
          description: {
            en: 'Create and optionally share clips when overlays fire from latest events',
            ru: 'Создание и опциональная публикация клипов при срабатывании оверлеев из последних событий',
            uk: 'Створення та опційна публікація кліпів при спрацюванні оверлеїв з останніх подій',
          },
        },
        items: clipAutomationFields,
      },
      {
        key: 'auto_raid_shoutout',
        type: 'spoiler',
        editor: {
          label: {
            en: 'Raid shoutout',
            ru: 'Shoutout при рейде',
            uk: 'Shoutout під час рейду',
          },
          description: {
            en: 'Automatically shout out raiding channels via the Twitch API',
            ru: 'Автоматический shoutout каналам-рейдерам через API Twitch',
            uk: 'Автоматичний shoutout каналам-рейдерам через API Twitch',
          },
        },
        items: raidShoutoutFields,
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
    access_token
      ? automationSettingsPage
      : withoutEditor(automationSettingsPage),
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
