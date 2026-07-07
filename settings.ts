export type TwitchAddonSettings = {
  sendChatViaBot: boolean;
  showModeratorActions: boolean;
  showJoinLeave: boolean;
  showPolls: boolean;
  showChatRaid: boolean;
  chatRaidMinViewers: number;
  showShoutout: boolean;
  showWatchStreak: boolean;
  watchStreakMinCount: number;
  showRewardRedemption: boolean;
  deleteUnusedRewards: boolean;
  showFirstUserMessage: boolean;
  showChatSubscriptions: boolean;
};

const DEFAULTS: TwitchAddonSettings = {
  sendChatViaBot: false,
  showModeratorActions: true,
  showJoinLeave: false,
  showPolls: true,
  showChatRaid: false,
  chatRaidMinViewers: 1,
  showShoutout: false,
  showWatchStreak: true,
  watchStreakMinCount: 3,
  showRewardRedemption: true,
  deleteUnusedRewards: false,
  showFirstUserMessage: true,
  showChatSubscriptions: true,
};

const readPositiveInt = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
};

let cached: TwitchAddonSettings = { ...DEFAULTS };

export const reloadSettings = async (): Promise<TwitchAddonSettings> => {
  const params = await api.config.getParams();
  cached = {
    sendChatViaBot: params.send_chat_via_bot === true,
    showModeratorActions: params.show_moderator_actions !== false,
    showJoinLeave: params.show_join_leave === true,
    showPolls: params.show_polls !== false,
    showChatRaid: params.show_chat_raid === true,
    chatRaidMinViewers: readPositiveInt(
      params.chat_raid_min_viewers,
      DEFAULTS.chatRaidMinViewers
    ),
    showShoutout: params.show_shoutout === true,
    showWatchStreak: params.show_watch_streak !== false,
    watchStreakMinCount: readPositiveInt(
      params.watch_streak_min_count,
      DEFAULTS.watchStreakMinCount
    ),
    showRewardRedemption: params.show_reward_redemption !== false,
    deleteUnusedRewards: params.delete_unused_rewards === true,
    showFirstUserMessage: params.show_first_user_message !== false,
    showChatSubscriptions: params.show_chat_subscriptions !== false,
  };
  return cached;
};

export const getSettings = (): TwitchAddonSettings => cached;
