# Twitch

[English](#english) | [Русский](#русский) | [Українська](#українська)

## English

### For users

Integration with Twitch API to display stream information, chat, viewer count in the status bar, and more.

**Chat notifications:** configurable framed chat events — raids, shoutouts, watch streaks, reward redemptions, first-time chatter messages, and subscription notices (same style as announcements).

**Channel point rewards:** optional setting to delete Twitch rewards when they are removed from all triggers in the app (off by default).

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

## Русский

### Для пользователей

Интеграция с Twitch API для отображения информации о стриме, чата, онлайна в строке состояния и многого другого.

**Оповещения в чате:** настраиваемые события в рамке — рейды, shoutout, watch streak, применение наград, первые сообщения зрителей и подписки (в том же стиле, что и анонсы).

**Награды за баллы канала:** опциональная настройка удалять награды Twitch, когда они убраны из всех триггеров в приложении (по умолчанию выключено).

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

**Нагороди за бали каналу:** опціональне налаштування видаляти нагороди Twitch, коли їх прибрано з усіх тригерів у програмі (за замовчуванням вимкнено).

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

