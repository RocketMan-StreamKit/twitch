/** Action applied to Twitch rewards when they become unavailable (unbound / soft stop). */
export type RewardLifecycleAction = 'none' | 'pause' | 'disable' | 'delete';

export type TwitchAddonSettings = {
  showModeratorActions: boolean;
  showJoinLeave: boolean;
  showPolls: boolean;
  showChatRaid: boolean;
  chatRaidMinViewers: number;
  showShoutout: boolean;
  showWatchStreak: boolean;
  watchStreakMinCount: number;
  showRewardRedemption: boolean;
  speakHighlightedMessages: boolean;
  /**
   * What to do with channel-point rewards when they are no longer needed
   * (trigger removed, sound/hotkey disabled, or StreamKit/addon shutting down).
   */
  rewardLifecycle: RewardLifecycleAction;
  addRewardEmoji: boolean;
  showFirstUserMessage: boolean;
  showChatSubscriptions: boolean;
  colorizeMeMessages: boolean;
};

const REWARD_LIFECYCLE_ACTIONS: readonly RewardLifecycleAction[] = [
  'none',
  'pause',
  'disable',
  'delete',
];

const DEFAULTS: TwitchAddonSettings = {
  showModeratorActions: true,
  showJoinLeave: false,
  showPolls: true,
  showChatRaid: false,
  chatRaidMinViewers: 1,
  showShoutout: false,
  showWatchStreak: true,
  watchStreakMinCount: 3,
  showRewardRedemption: true,
  speakHighlightedMessages: false,
  rewardLifecycle: 'none',
  addRewardEmoji: true,
  showFirstUserMessage: true,
  showChatSubscriptions: true,
  colorizeMeMessages: true,
};

/**
 * Resolves the reward lifecycle setting, migrating the legacy boolean key.
 * @param params Raw addon config params.
 * @example
 * resolveRewardLifecycle({ reward_lifecycle: 'pause' }); // 'pause'
 * resolveRewardLifecycle({ delete_unused_rewards: true }); // 'delete'
 */
const resolveRewardLifecycle = (
  params: Record<string, unknown>
): RewardLifecycleAction => {
  const raw = params.reward_lifecycle;
  if (
    typeof raw === 'string' &&
    REWARD_LIFECYCLE_ACTIONS.includes(raw as RewardLifecycleAction)
  ) {
    return raw as RewardLifecycleAction;
  }
  if (params.delete_unused_rewards === true) {
    return 'delete';
  }
  return DEFAULTS.rewardLifecycle;
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
    speakHighlightedMessages: params.speak_highlighted_messages === true,
    rewardLifecycle: resolveRewardLifecycle(params),
    addRewardEmoji: params.add_reward_emoji !== false,
    showFirstUserMessage: params.show_first_user_message !== false,
    showChatSubscriptions: params.show_chat_subscriptions !== false,
    colorizeMeMessages: params.colorize_me_messages !== false,
  };
  return cached;
};

export const getSettings = (): TwitchAddonSettings => cached;
