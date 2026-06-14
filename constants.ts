export const PLATFORM = 'twitch';

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
] as const;
