export const PLATFORM = 'twitch';

/** Twitch application client id used for OAuth and Helix API calls. */
export const CLIENT_ID = '9e32kmze4fkvldsxqr3apoq3k5qpmm';

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
