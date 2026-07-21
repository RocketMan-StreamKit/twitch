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
  /** When true, newly generated rewards get a random Twitch background color. */
  randomRewardColor: boolean;
  showFirstUserMessage: boolean;
  showChatSubscriptions: boolean;
  colorizeMeMessages: boolean;
  /**
   * When true, creates a Twitch clip after a latest-events record includes an
   * overlay attach (timed so the trigger lands near the 5th second).
   */
  autoClipOnOverlay: boolean;
  /** When true, posts the auto-created clip URL to Twitch chat. */
  autoClipPostChat: boolean;
  /** Auto-created clip length in seconds (addon setting range: 15–60). */
  autoClipDurationSeconds: number;
  /** When true, sends a Helix shoutout to the raiding channel. */
  autoShoutoutOnRaid: boolean;
  /** Minimum raid viewer count required before auto-shoutout runs. */
  autoShoutoutMinViewers: number;
  /** Seconds to wait after a raid before sending the auto-shoutout. */
  autoShoutoutDelaySeconds: number;
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
  randomRewardColor: false,
  showFirstUserMessage: true,
  showChatSubscriptions: true,
  colorizeMeMessages: true,
  autoClipOnOverlay: false,
  autoClipPostChat: true,
  autoClipDurationSeconds: 30,
  autoShoutoutOnRaid: false,
  autoShoutoutMinViewers: 10,
  autoShoutoutDelaySeconds: 10,
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

/**
 * Parses a positive integer setting (≥ 1), otherwise returns the fallback.
 * @param value Raw config value.
 * @param fallback Default when parsing fails.
 * @example
 * readPositiveInt('12', 1); // 12
 * readPositiveInt('x', 3); // 3
 */
const readPositiveInt = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
};

/**
 * Parses a non-negative integer setting (≥ 0), otherwise returns the fallback.
 * @param value Raw config value.
 * @param fallback Default when parsing fails.
 * @example
 * readNonNegativeInt('0', 10); // 0
 * readNonNegativeInt(-1, 10); // 10
 */
const readNonNegativeInt = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

/**
 * Parses a clip duration setting (addon range: 15–60 seconds).
 * @param value Raw config value.
 * @param fallback Default when parsing fails.
 * @example
 * readClipDurationSeconds(45, 30); // 45
 * readClipDurationSeconds(10, 30); // 30
 */
const readClipDurationSeconds = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const floored = Math.floor(parsed);
  if (floored < 15 || floored > 60) {
    return fallback;
  }
  return floored;
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
    randomRewardColor: params.random_reward_color === true,
    showFirstUserMessage: params.show_first_user_message !== false,
    showChatSubscriptions: params.show_chat_subscriptions !== false,
    colorizeMeMessages: params.colorize_me_messages !== false,
    autoClipOnOverlay: params.auto_clip_on_overlay === true,
    autoClipPostChat: params.auto_clip_post_chat !== false,
    autoClipDurationSeconds: readClipDurationSeconds(
      params.auto_clip_duration_seconds,
      DEFAULTS.autoClipDurationSeconds
    ),
    autoShoutoutOnRaid: params.auto_shoutout_on_raid === true,
    autoShoutoutMinViewers: readPositiveInt(
      params.auto_shoutout_min_viewers,
      DEFAULTS.autoShoutoutMinViewers
    ),
    autoShoutoutDelaySeconds: readNonNegativeInt(
      params.auto_shoutout_delay_seconds,
      DEFAULTS.autoShoutoutDelaySeconds
    ),
  };
  return cached;
};

export const getSettings = (): TwitchAddonSettings => cached;
