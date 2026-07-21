# Twitch

[English](#english) | [Русский](#русский) | [Українська](#українська)

## English

### For users

Integration with Twitch API to display stream information, chat, viewer count in the status bar, and more.

**Chat notifications:** configurable framed chat events — raids, shoutouts, watch streaks, reward redemptions, first-time chatter messages, and subscription notices (same style as announcements). Optional TTS for highlighted channel-point messages (off by default; uses the TTS engine from StreamKit+ settings). `/me` messages are unwrapped from CTCP ACTION form; when enabled (default), their text uses the author's nickname color (`_as_user_`).

**Channel point rewards:** setting **When a reward is no longer needed** controls what happens when a trigger is removed, a sound/hotkey is disabled, or StreamKit / this addon shuts down: do nothing (default), pause on Twitch, disable on Twitch, or delete on Twitch. While StreamKit is connected, rewards used by active triggers are always forced enabled and unpaused (including after manual changes on Twitch while the app was closed). Generating a reward through a trigger reuses an existing reward with the same title and updates its cost. When a reward is already selected, changing the cost field and blurring it (or clicking **Update cost**) updates that reward by id on Twitch — only for rewards created by StreamKit (Twitch only allows the creating app to change cost). Rewards from the Twitch dashboard or another app can be selected as triggers, but their cost must be changed outside StreamKit. The cost field syncs from Twitch when you are not editing it. Disabled or paused rewards are marked in the picker. Saving a reward trigger without selecting or generating a reward is blocked. Optional emoji prefixes in generated reward titles (on by default): sounds — 🔊, overlays — 📺, hotkey integrations — ⌨️, game integrations — 🎮. Optional random background color for each newly generated reward (off by default). If a reward used by triggers was deleted on Twitch, the addon recreates it automatically (or remaps onto an existing same-title reward without changing its cost) and updates trigger bindings to the new reward id.

**Automation:** optional auto-clip when a latest-events record includes an overlay attach (off by default): creates a Helix clip (`clips:edit`) with configurable length (15–60 seconds, default 30), timed so the trigger lands near the 5th second. Optional chat post of the clip URL after creation (on by default; uses the bot account when connected). Optional Helix shoutout on incoming raid (off by default; not the `/shoutout` chat command; needs `moderator:manage:shoutouts`), with configurable minimum raiders (default 10) and delay in seconds (default 10).

**Addon RPC:** other addons can reuse Twitch OAuth and Helix API through `addons.request('twitch', …)` — `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `getChannelId`, and `sendChatMessage`. Missing scopes trigger re-authorization in the browser when the user was already logged in.

**Bot account:** optional second Twitch login for sending chat messages (`user:write:chat` only). Other addons' `sendChatMessage` uses the bot when configured, otherwise the main account. Dashboard `onChatSend` with `system: true` uses the bot when connected, otherwise (and for non-system messages, including the chat input) the main account. Authorization links for both accounts can be copied from settings.

**Install:** Settings → Addons → Install from folder (or drag-and-drop the folder/zip into the app window).

### For developers

This addon is a **TypeScript worker** integration. Entry point: `index.ts` (compiled to `index.js`).

**Local build**

```bash
npm install
npm run build
```

Install the `dist/` folder contents (or the release zip) via StreamKit+ settings.

**Dependencies**

- [`@rocketman-streamkit/types`](https://www.npmjs.com/package/@rocketman-streamkit/types) — sandbox API typings
- [Addon developer docs](https://github.com/RocketMan-StreamKit/types)

**Manifest**

| Field | Value |
| --- | --- |
| Type | `platform.streaming` |
| Permissions | NETWORK_REQUEST, NETWORK_WEBSOCKET, WEB_END_POINTS, DASHBOARD_EVENTS, DASHBOARD_EVENTS_INCOMING, DASHBOARD_CHAT, STATUS, NOTIFY, TTS |

**Addon-to-addon API** (`depends_on: ["twitch"]` recommended):

```ts
// Current OAuth scopes
const { grantedScopes, requiredScopes } = await addons.request('twitch', 'getScopes');

// Request additional scopes (logged: which addon requested which scope)
await addons.request('twitch', 'addScopes', { scopes: ['clips:edit'] });

// Proxy Twitch API calls (logged: which addon requested which URL)
const clips = await addons.request('twitch', 'apiGet', {
  url: 'https://api.twitch.tv/helix/clips?broadcaster_id=123',
  scopes: ['clips:edit'],
});

// Send a chat message (bot account when configured, otherwise main)
await addons.request('twitch', 'sendChatMessage', { message: 'Hello!' });
```

Methods: `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `getChannelId`, `sendChatMessage`. If scopes are missing and the user was previously authorized, the Twitch addon opens OAuth in the browser automatically.

**Addon events** (`addons.subscribe('twitch', …)`): the addon emits poll and prediction lifecycle events from Twitch EventSub so other addons can react without polling.

| Event | When | Payload highlights |
| --- | --- | --- |
| `pollBegin` | Poll created / started | `id`, `title`, `choices[]`, voting settings, `started_at`, `ends_at` |
| `pollProgress` | Votes updated | same + per-choice `votes` / `bits_votes` / `channel_points_votes` |
| `pollEnd` | Poll ended | same + `status`, `ended_at` |
| `predictionBegin` | Prediction created / started | `id`, `title`, `outcomes[]`, `started_at`, `locks_at` |
| `predictionProgress` | Bets updated | same + `users`, `channel_points`, `top_predictors` |
| `predictionLock` | Betting locked | same + `locked_at` |
| `predictionEnd` | Prediction resolved / canceled | same + `status`, `winning_outcome_id`, `ended_at` |

```ts
const sub = await addons.subscribe('twitch', 'pollBegin', ({ data }) => {
  console.log('Poll started:', data.title, data.choices);
});

await addons.subscribe('twitch', 'predictionEnd', ({ data }) => {
  console.log('Prediction ended:', data.title, data.winning_outcome_id, data.status);
});

// later: sub.Destroy();
```

Requires Twitch scopes `channel:read:polls` and `channel:read:predictions` (already requested by this addon). Events are emitted even when chat-feed poll notifications are disabled in settings.

## Русский

### Для пользователей

Интеграция с Twitch API для отображения информации о стриме, чата, онлайна в строке состояния и многого другого.

**Оповещения в чате:** настраиваемые события в рамке — рейды, shoutout, watch streak, применение наград, первые сообщения зрителей и подписки (в том же стиле, что и анонсы). Опциональное озвучивание выделенных сообщений через TTS (по умолчанию выкл.; использует движок TTS из настроек StreamKit+). Сообщения `/me` разбираются из CTCP ACTION; при включённой настройке (по умолчанию) текст показывается цветом ника автора (`_as_user_`).

**Награды за баллы канала:** настройка **Когда награда больше не нужна** задаёт действие при удалении триггера, выключении звука/хоткея или закрытии StreamKit / отключении аддона: ничего не делать (по умолчанию), пауза на Twitch, отключение на Twitch или удаление на Twitch. Пока StreamKit подключён, награды активных триггеров всегда принудительно включаются и снимаются с паузы (в том числе если их меняли вручную на Twitch, пока приложение было выключено). При генерации награды через триггер используется существующая награда с таким же названием, а её стоимость обновляется. Если награда уже выбрана, изменение поля стоимости с потерей фокуса (или кнопка **Обновить стоимость**) обновляет эту награду на Twitch по id — только для наград, созданных через StreamKit (Twitch разрешает менять стоимость только приложению-создателю). Награды из панели Twitch или другого приложения можно выбрать как триггер, но их стоимость нужно менять вне StreamKit. Поле стоимости синхронизируется с Twitch, пока вы его не редактируете. Отключённые или приостановленные награды помечаются в списке. Сохранение триггера награды без выбора или генерации награды блокируется. Опциональные эмодзи в начале названия при генерации (по умолчанию включено): звуки — 🔊, оверлеи — 📺, хоткей-интеграции — ⌨️, игровые интеграции — 🎮. Опциональный случайный цвет фона для каждой новой генерируемой награды (по умолчанию выкл.). Если награда, используемая в триггерах, была удалена на Twitch, аддон автоматически пересоздаёт её (или перепривязывает к существующей с тем же названием без смены стоимости) и обновляет привязки триггеров на новый id.

**Автоматизация:** опциональный авто-клип, когда в последних событиях есть запись с прикреплённым вызовом оверлея (по умолчанию выкл.): создаёт клип через Helix (`clips:edit`) с настраиваемой длиной (15–60 секунд, по умолчанию 30), с таймингом так, чтобы момент срабатывания был около 5-й секунды. Опциональная отправка ссылки на клип в чат после создания (по умолчанию вкл.; через аккаунт бота, если он подключён). Опциональный Helix shoutout при входящем рейде (по умолчанию выкл.; не команда чата `/shoutout`; нужен `moderator:manage:shoutouts`), с настраиваемым минимумом рейдеров (по умолчанию 10) и задержкой в секундах (по умолчанию 10).

**RPC для аддонов:** другие аддоны могут использовать OAuth и Helix API Twitch через `addons.request('twitch', …)` — `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `getChannelId`, `sendChatMessage`. При нехватке scope откроется повторная авторизация в браузере, если пользователь уже входил ранее.

**Аккаунт бота:** опциональный второй вход в Twitch только для отправки сообщений в чат (`user:write:chat`). RPC `sendChatMessage` использует бота, если он настроен, иначе основную учётку. Dashboard `onChatSend` с `system: true` отправляет через бота, если он подключён; иначе (и для несистемных сообщений, включая поле ввода чата) — через основной аккаунт. Ссылки для авторизации обеих учёток можно скопировать в настройках.

**Установка:** Настройки → Аддоны → Установить из папки (или перетащите папку/zip в окно приложения).

### Для разработчиков

Аддон — **TypeScript worker**. Точка входа: `index.ts` (собирается в `index.js`).

**Локальная сборка**

```bash
npm install
npm run build
```

Установите содержимое `dist/` (или zip из релиза) через настройки StreamKit+.

**Зависимости**

- [`@rocketman-streamkit/types`](https://www.npmjs.com/package/@rocketman-streamkit/types) — типы sandbox API
- [Документация для разработчиков](https://github.com/RocketMan-StreamKit/types)

**Манифест**

| Поле | Значение |
| --- | --- |
| Тип | `platform.streaming` |
| Права | NETWORK_REQUEST, NETWORK_WEBSOCKET, WEB_END_POINTS, DASHBOARD_EVENTS, DASHBOARD_EVENTS_INCOMING, DASHBOARD_CHAT, STATUS, NOTIFY, TTS |

**API для других аддонов** (`depends_on: ["twitch"]` рекомендуется):

```ts
const { grantedScopes, requiredScopes } = await addons.request('twitch', 'getScopes');
await addons.request('twitch', 'addScopes', { scopes: ['clips:edit'] });
const clips = await addons.request('twitch', 'apiGet', {
  url: 'https://api.twitch.tv/helix/clips?broadcaster_id=123',
  scopes: ['clips:edit'],
});
await addons.request('twitch', 'sendChatMessage', { message: 'Привет!' });
```

Методы: `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `getChannelId`, `sendChatMessage`.

**События аддона** (`addons.subscribe('twitch', …)`): жизненный цикл опросов и ставок (predictions) из Twitch EventSub.

| Событие | Когда | Основные поля |
| --- | --- | --- |
| `pollBegin` | Опрос создан / начат | `id`, `title`, `choices[]`, настройки голосования, `started_at`, `ends_at` |
| `pollProgress` | Обновление голосов | то же + `votes` / `bits_votes` / `channel_points_votes` у вариантов |
| `pollEnd` | Опрос завершён | то же + `status`, `ended_at` |
| `predictionBegin` | Ставка создана / начата | `id`, `title`, `outcomes[]`, `started_at`, `locks_at` |
| `predictionProgress` | Обновление ставок | то же + `users`, `channel_points`, `top_predictors` |
| `predictionLock` | Приём ставок закрыт | то же + `locked_at` |
| `predictionEnd` | Ставка разрешена / отменена | то же + `status`, `winning_outcome_id`, `ended_at` |

```ts
await addons.subscribe('twitch', 'pollBegin', ({ data }) => {
  console.log('Опрос начат:', data.title, data.choices);
});

await addons.subscribe('twitch', 'predictionEnd', ({ data }) => {
  console.log('Ставка завершена:', data.title, data.winning_outcome_id, data.status);
});
```

Нужны scope `channel:read:polls` и `channel:read:predictions` (уже запрашиваются этим аддоном). События уходят подписчикам даже если показ опросов в ленте чата выключен.

## Українська

### Для користувачів

Інтеграція з Twitch API для відображення інформації про стрім, чат, онлайну в рядку стану та багато іншого.

**Сповіщення в чаті:** налаштовувані події в рамці — рейди, shoutout, watch streak, застосування нагород, перші повідомлення глядачів і підписки (у тому ж стилі, що й анонси). Опціональне озвучування виділених повідомлень через TTS (за замовчуванням вимкнено; використовує рушій TTS із налаштувань StreamKit+). Повідомлення `/me` розбираються з CTCP ACTION; за увімкненого налаштування (за замовчуванням) текст показується кольором ніка автора (`_as_user_`).

**Нагороди за бали каналу:** налаштування **Коли нагорода більше не потрібна** задає дію при видаленні тригера, вимкненні звуку/хоткея або закритті StreamKit / вимкненні аддона: нічого не робити (за замовчуванням), пауза на Twitch, вимкнення на Twitch або видалення на Twitch. Поки StreamKit підключений, нагороди активних тригерів завжди примусово вмикаються і знімаються з паузи (зокрема якщо їх змінювали вручну на Twitch, поки програма була вимкнена). Під час генерації нагороди через тригер використовується існуюча нагорода з такою ж назвою, а її вартість оновлюється. Якщо нагороду вже вибрано, зміна поля вартості з втратою фокусу (або кнопка **Оновити вартість**) оновлює цю нагороду на Twitch за id — лише для нагород, створених через StreamKit (Twitch дозволяє змінювати вартість тільки застосунку-творцю). Нагороди з панелі Twitch або іншого застосунку можна вибрати як тригер, але їхню вартість потрібно змінювати поза StreamKit. Поле вартості синхронізується з Twitch, поки ви його не редагуєте. Вимкнені або призупинені нагороди позначаються в списку. Збереження тригера нагороди без вибору або генерації нагороди блокується. Опціональні емодзі на початку назви під час генерації (за замовчуванням увімкнено): звуки — 🔊, оверлеї — 📺, хоткей-інтеграції — ⌨️, ігрові інтеграції — 🎮. Опційний випадковий колір фону для кожної нової згенерованої нагороди (за замовчуванням вимкнено). Якщо нагороду, що використовується в тригерах, було видалено на Twitch, аддон автоматично перестворює її (або переприв’язує до існуючої з тією ж назвою без зміни вартості) і оновлює прив’язки тригерів на новий id.

**Автоматизація:** опційний авто-кліп, коли в останніх подіях є запис із прикріпленим викликом оверлею (за замовчуванням вимкнено): створює кліп через Helix (`clips:edit`) з налаштовуваною довжиною (15–60 секунд, за замовчуванням 30), з таймінгом так, щоб момент спрацювання був близько 5-ї секунди. Опційне надсилання посилання на кліп у чат після створення (за замовчуванням увімкнено; через акаунт бота, якщо він підключений). Опційний Helix shoutout під час вхідного рейду (за замовчуванням вимкнено; не команда чату `/shoutout`; потрібен `moderator:manage:shoutouts`), з налаштовуваним мінімумом рейдерів (за замовчуванням 10) і затримкою в секундах (за замовчуванням 10).

**RPC для аддонів:** інші аддони можуть використовувати OAuth і Helix API Twitch через `addons.request('twitch', …)` — `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `getChannelId`, `sendChatMessage`. Якщо scope не вистачає, відкриється повторна авторизація в браузері, якщо користувач уже входив раніше.

**Акаунт бота:** опціональний другий вхід у Twitch лише для надсилання повідомлень у чат (`user:write:chat`). RPC `sendChatMessage` використовує бота, якщо він налаштований, інакше основний акаунт. Dashboard `onChatSend` з `system: true` надсилає через бота, якщо він підключений; інакше (і для несистемних повідомлень, включно з полем вводу чату) — через основний акаунт. Посилання для авторизації обох акаунтів можна скопіювати в налаштуваннях.

**Встановлення:** Налаштування → Аддони → Встановити з папки (або перетягніть папку/zip у вікно програми).

**Маніфест**

| Поле | Значення |
| --- | --- |
| Тип | `platform.streaming` |
| Права | NETWORK_REQUEST, NETWORK_WEBSOCKET, WEB_END_POINTS, DASHBOARD_EVENTS, DASHBOARD_EVENTS_INCOMING, DASHBOARD_CHAT, STATUS, NOTIFY, TTS |

**API для інших аддонів** (`depends_on: ["twitch"]` рекомендовано):

```ts
const { grantedScopes, requiredScopes } = await addons.request('twitch', 'getScopes');
await addons.request('twitch', 'addScopes', { scopes: ['clips:edit'] });
const clips = await addons.request('twitch', 'apiGet', {
  url: 'https://api.twitch.tv/helix/clips?broadcaster_id=123',
  scopes: ['clips:edit'],
});
await addons.request('twitch', 'sendChatMessage', { message: 'Привіт!' });
```

Методи: `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, `getChannelId`, `sendChatMessage`.

**Події аддона** (`addons.subscribe('twitch', …)`): життєвий цикл опитувань і ставок (predictions) з Twitch EventSub.

| Подія | Коли | Основні поля |
| --- | --- | --- |
| `pollBegin` | Опитування створено / почато | `id`, `title`, `choices[]`, налаштування голосування, `started_at`, `ends_at` |
| `pollProgress` | Оновлення голосів | те саме + `votes` / `bits_votes` / `channel_points_votes` у варіантів |
| `pollEnd` | Опитування завершено | те саме + `status`, `ended_at` |
| `predictionBegin` | Ставку створено / почато | `id`, `title`, `outcomes[]`, `started_at`, `locks_at` |
| `predictionProgress` | Оновлення ставок | те саме + `users`, `channel_points`, `top_predictors` |
| `predictionLock` | Прийом ставок закрито | те саме + `locked_at` |
| `predictionEnd` | Ставку вирішено / скасовано | те саме + `status`, `winning_outcome_id`, `ended_at` |

```ts
await addons.subscribe('twitch', 'pollBegin', ({ data }) => {
  console.log('Опитування почато:', data.title, data.choices);
});

await addons.subscribe('twitch', 'predictionEnd', ({ data }) => {
  console.log('Ставку завершено:', data.title, data.winning_outcome_id, data.status);
});
```

Потрібні scope `channel:read:polls` і `channel:read:predictions` (вже запитуються цим аддоном). Події надсилаються підписникам навіть якщо показ опитувань у стрічці чату вимкнено.

