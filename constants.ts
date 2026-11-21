export const PLATFORM = 'twitch';

/** Twitch application client id used for OAuth and Helix API calls. */
export const CLIENT_ID = '9e32kmze4fkvldsxqr3apoq3k5qpmm';

/**
 * Backup Twitch application client id for a second device.
 * Twitch keeps one implicit-grant session per account per application, so logging in
 * with the same account on another device through `CLIENT_ID` signs out the first one.
 * The second device logs in through this application instead.
 */
export const RESERVE_CLIENT_ID = 'tdl8zvf4tldorlt0ct3ohbtoyn7v4k';

/**
 * Which Twitch application a stored token was issued for.
 * `main` uses `CLIENT_ID`, `reserve` uses `RESERVE_CLIENT_ID`.
 */
export type TwitchAuthClient = 'main' | 'reserve';

/**
 * Normalizes a stored param value into a known auth client (defaults to `main`).
 * @param value Raw value from addon params (`auth_client` / `bot_auth_client`).
 * @example
 * parseAuthClient('reserve'); // 'reserve'
 * parseAuthClient(undefined); // 'main'
 */
export const parseAuthClient = (value: unknown): TwitchAuthClient =>
  value === 'reserve' ? 'reserve' : 'main';

/**
 * Returns the Twitch application client id for an auth client.
 * @param client Auth client the token was issued for.
 * @example
 * getClientId('reserve'); // 'tdl8zvf4tldorlt0ct3ohbtoyn7v4k'
 */
export const getClientId = (client: TwitchAuthClient): string =>
  client === 'reserve' ? RESERVE_CLIENT_ID : CLIENT_ID;

/** Allowed hostnames for addon-to-addon Twitch API proxy requests. */
export const TWITCH_API_HOSTS = new Set(['api.twitch.tv', 'id.twitch.tv']);

export const EVENTSUB_WS_URL =
  'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30';

export const EVENTSUB_TYPES = [
  {
    type: 'channel.chat.message',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
      user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.chat.notification',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
      user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.cheer',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.follow',
    version: '2',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
      moderator_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.subscribe',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.subscription.gift',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.subscription.message',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.channel_points_custom_reward_redemption.add',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.channel_points_automatic_reward_redemption.add',
    version: '2',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.moderate',
    version: '2',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
      moderator_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.poll.begin',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.poll.progress',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.poll.end',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.prediction.begin',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.prediction.progress',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.prediction.lock',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.prediction.end',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'channel.shoutout.create',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
      moderator_user_id: broadcasterId,
    }),
  },
  {
    type: 'stream.online',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
  {
    type: 'stream.offline',
    version: '1',
    condition: (broadcasterId: string) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
] as const;
