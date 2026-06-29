# Twitch

[English](#english) | [Русский](#русский) | [Українська](#українська)

## English

### For users

Integration with Twitch API to display stream information, chat, viewer count in the status bar, and more.

**Chat notifications:** configurable framed chat events — raids, shoutouts, watch streaks, reward redemptions, first-time chatter messages, and subscription notices (same style as announcements).

**Channel point rewards:** optional setting to delete Twitch rewards when they are removed from all triggers in the app (off by default). Generating a reward through a trigger reuses an existing reward with the same title and updates its cost.

**Addon RPC:** other addons can reuse Twitch OAuth and Helix API through `addons.request('twitch', …)` — `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiDelete`, and `getChannelId`. Missing scopes trigger re-authorization in the browser when the user was already logged in.

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
| Permissions | NETWORK_REQUEST, NETWORK_WEBSOCKET, WEB_END_POINTS, DASHBOARD_EVENTS, DASHBOARD_CHAT, STATUS, NOTIFY |

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
```

Methods: `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiDelete`, `getChannelId`. If scopes are missing and the user was previously authorized, the Twitch addon opens OAuth in the browser automatically.

## Русский

### Для пользователей

Интеграция с Twitch API для отображения информации о стриме, чата, онлайна в строке состояния и многого другого.

**Оповещения в чате:** настраиваемые события в рамке — рейды, shoutout, watch streak, применение наград, первые сообщения зрителей и подписки (в том же стиле, что и анонсы).

**Награды за баллы канала:** опциональная настройка удалять награды Twitch, когда они убраны из всех триггеров в приложении (по умолчанию выключено). При генерации награды через триггер используется существующая награда с таким же названием, а её стоимость обновляется.

**RPC для аддонов:** другие аддоны могут использовать OAuth и Helix API Twitch через `addons.request('twitch', …)` — `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiDelete`, `getChannelId`. При нехватке scope откроется повторная авторизация в браузере, если пользователь уже входил ранее.

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
| Права | NETWORK_REQUEST, NETWORK_WEBSOCKET, WEB_END_POINTS, DASHBOARD_EVENTS, DASHBOARD_CHAT, STATUS, NOTIFY |

## Українська

### Для користувачів

Інтеграція з Twitch API для відображення інформації про стрім, чат, онлайну в рядку стану та багато іншого.

**Сповіщення в чаті:** налаштовувані події в рамці — рейди, shoutout, watch streak, застосування нагород, перші повідомлення глядачів і підписки (у тому ж стилі, що й анонси).

**Нагороди за бали каналу:** опціональне налаштування видаляти нагороди Twitch, коли їх прибрано з усіх тригерів у програмі (за замовчуванням вимкнено). Під час генерації нагороди через тригер використовується існуюча нагорода з такою ж назвою, а її вартість оновлюється.

**RPC для аддонів:** інші аддони можуть використовувати OAuth і Helix API Twitch через `addons.request('twitch', …)` — `getScopes`, `addScopes`, `apiGet`, `apiPost`, `apiPut`, `apiDelete`, `getChannelId`. Якщо scope не вистачає, відкриється повторна авторизація в браузері, якщо користувач уже входив раніше.

**Встановлення:** Налаштування → Аддони → Встановити з папки (або перетягніть папку/zip у вікно програми).

### Для розробників

Аддон — **TypeScript worker**. Вхідна точка: `index.ts` (збирається в `index.js`).

**Локальна збірка**

```bash
npm install
npm run build
```

Встановіть вміст `dist/` (або zip з релізу) через налаштування StreamKit+.

**Залежності**

- [`@rocketman-streamkit/types`](https://www.npmjs.com/package/@rocketman-streamkit/types) — типи sandbox API
- [Документація для розробників](https://github.com/RocketMan-StreamKit/types)

**Маніфест**

| Поле | Значення |
| --- | --- |
| Тип | `platform.streaming` |
| Права | NETWORK_REQUEST, NETWORK_WEBSOCKET, WEB_END_POINTS, DASHBOARD_EVENTS, DASHBOARD_CHAT, STATUS, NOTIFY |

