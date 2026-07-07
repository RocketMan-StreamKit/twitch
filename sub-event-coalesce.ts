import {
  pushCombinedGiftSub,
  pushResubSubscribe,
  pushSubGift,
  pushSubRenewal,
  pushSubscribe,
  type TwitchEventUser,
} from './dashboard-feed';

/** How long to wait for a paired EventSub notification before emitting a single event. */
const COALESCE_WINDOW_MS = 8000;

/** Delay before emitting a resub from `channel.subscribe` when `channel.subscription.message` may still arrive. */
const RESUB_MESSAGE_WAIT_MS = 3000;

type PendingSingleGift = {
  gifter: TwitchEventUser;
  tier: string;
  at: number;
  timeout: ReturnType<typeof setTimeout>;
};

let pendingSingleGift: PendingSingleGift | null = null;

const recentResubByUser = new Map<string, number>();

const pendingResubSubscribe = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Drops expired resub dedupe markers.
 */
const pruneResubMarks = () => {
  const now = Date.now();
  for (const [userId, at] of recentResubByUser) {
    if (now - at > COALESCE_WINDOW_MS) {
      recentResubByUser.delete(userId);
    }
  }
};

/**
 * Marks a user resub as already written to the dashboard feed.
 * @param userId Twitch user id.
 */
const markResubHandled = (userId: string) => {
  recentResubByUser.set(userId, Date.now());
  pruneResubMarks();
};

/**
 * Returns whether a resub line for the user was written recently.
 * @param userId Twitch user id.
 */
const wasResubRecentlyHandled = (userId: string) => {
  pruneResubMarks();
  const at = recentResubByUser.get(userId);
  return at !== undefined && Date.now() - at <= COALESCE_WINDOW_MS;
};

/**
 * Cancels a delayed resub emit for the given user.
 * @param userId Twitch user id.
 */
const cancelPendingResubSubscribe = (userId: string) => {
  const timeout = pendingResubSubscribe.get(userId);
  if (timeout) {
    clearTimeout(timeout);
    pendingResubSubscribe.delete(userId);
  }
};

/**
 * Handles `channel.subscription.gift` and buffers single gifts until the recipient sub arrives.
 * @param gifter Twitch gifter profile fields.
 * @param total Number of gifted subs.
 * @param tier Subscription tier code.
 * @example
 * await handleSubGiftNotification(gifter, 1, '1000');
 */
export const handleSubGiftNotification = async (
  gifter: TwitchEventUser,
  total: number,
  tier: string
) => {
  if (total !== 1) {
    await pushSubGift(gifter, total, tier);
    return;
  }

  if (pendingSingleGift?.timeout) {
    clearTimeout(pendingSingleGift.timeout);
  }

  const timeout = setTimeout(() => {
    if (pendingSingleGift?.gifter.user_id !== gifter.user_id) {
      return;
    }
    pendingSingleGift = null;
    pushSubGift(gifter, 1, tier).catch(error => console.error(error));
  }, COALESCE_WINDOW_MS);

  pendingSingleGift = { gifter, tier, at: Date.now(), timeout };
};

/**
 * Tries to merge a pending single gift with the recipient `channel.subscribe` event.
 * @param recipient Twitch recipient profile fields.
 * @param tier Subscription tier code.
 * @returns `true` when a combined gift line was emitted.
 */
const tryConsumePendingSingleGift = async (
  recipient: TwitchEventUser,
  tier: string
) => {
  const pending = pendingSingleGift;
  if (!pending || pending.tier !== tier) {
    return false;
  }
  if (Date.now() - pending.at > COALESCE_WINDOW_MS) {
    return false;
  }

  clearTimeout(pending.timeout);
  pendingSingleGift = null;
  await pushCombinedGiftSub(pending.gifter, recipient, tier);
  return true;
};

/**
 * Handles `channel.subscribe` and coalesces resubs and gift recipients into one feed line.
 * @param user Twitch subscriber profile fields.
 * @param tier Subscription tier code.
 * @param cumulativeMonths Total subscribed months, when provided by EventSub.
 * @param isGift Whether the subscription was gifted.
 * @example
 * await handleSubscribeNotification(user, '1000', 70, false);
 */
export const handleSubscribeNotification = async (
  user: TwitchEventUser,
  tier: string,
  cumulativeMonths: number,
  isGift: boolean
) => {
  if (isGift) {
    await tryConsumePendingSingleGift(user, tier);
    return;
  }

  if (cumulativeMonths > 1) {
    if (wasResubRecentlyHandled(user.user_id)) {
      return;
    }

    cancelPendingResubSubscribe(user.user_id);
    const timeout = setTimeout(() => {
      pendingResubSubscribe.delete(user.user_id);
      if (wasResubRecentlyHandled(user.user_id)) {
        return;
      }
      markResubHandled(user.user_id);
      pushResubSubscribe(user, tier, cumulativeMonths).catch(error =>
        console.error(error)
      );
    }, RESUB_MESSAGE_WAIT_MS);
    pendingResubSubscribe.set(user.user_id, timeout);
    return;
  }

  await pushSubscribe(user, tier, false);
};

/**
 * Handles `channel.subscription.message` and emits one resub line with tier and optional text.
 * @param user Twitch subscriber profile fields.
 * @param cumulativeMonths Total subscribed months.
 * @param text Optional resub message text.
 * @param tier Subscription tier code.
 * @example
 * await handleSubRenewalNotification(user, 70, undefined, '1000');
 */
export const handleSubRenewalNotification = async (
  user: TwitchEventUser,
  cumulativeMonths: number,
  text: string | undefined,
  tier: string
) => {
  cancelPendingResubSubscribe(user.user_id);
  markResubHandled(user.user_id);
  await pushSubRenewal(user, cumulativeMonths, text, tier);
};
