import { TwitchApi } from './api';
import { getSettings, reloadSettings } from './settings';

const REDEEMS_KEY = 'redeems';

type TriggerRuleLike = {
  type?: string;
  key?: string;
  value?: string | number | boolean;
};

type RedeemSourceRule = {
  trigger: TriggerRuleLike;
  /** When false, the consumer is disabled and the reward should be unavailable. */
  enabled?: boolean;
};

type TriggersAppliedSnapshotLike = {
  overlay?: RedeemSourceRule[];
  timer?: RedeemSourceRule[];
  game?: RedeemSourceRule[];
  sounds?: RedeemSourceRule[];
  hotkeys?: RedeemSourceRule[];
};

type TriggersCategoryMapLike = {
  overlay?: Record<string, RedeemSourceRule[]>;
  timer?: Record<string, RedeemSourceRule[]>;
  game?: Record<string, RedeemSourceRule[]>;
  sounds?: Record<string, RedeemSourceRule[]>;
  hotkeys?: Record<string, RedeemSourceRule[]>;
};

/**
 * Returns whether a trigger rule is a channel-point redeem with a reward id.
 * @param trigger Applied trigger rule.
 * @example
 * isRedeemTrigger({ type: 'custom', key: 'redeems', value: 'abc' });
 */
const isRedeemTrigger = (
  trigger: TriggerRuleLike | undefined
): trigger is TriggerRuleLike & { value: string } => {
  if (!trigger || trigger.type !== 'custom' || trigger.key !== REDEEMS_KEY) {
    return false;
  }
  return typeof trigger.value === 'string' && Boolean(trigger.value.trim());
};

/**
 * Collects reward ids from rules that are currently active (consumer enabled).
 * @param rules Redeem-capable applied rules.
 * @param into Destination set.
 * @example
 * collectActiveFromRules(snapshot.sounds || [], ids);
 */
const collectActiveFromRules = (
  rules: RedeemSourceRule[] | undefined,
  into: Set<string>
) => {
  if (!rules?.length) {
    return;
  }
  for (const rule of rules) {
    if (rule.enabled === false) {
      continue;
    }
    if (!isRedeemTrigger(rule.trigger)) {
      continue;
    }
    into.add(rule.trigger.value.trim());
  }
};

/**
 * Collects active reward ids from a per-addon applied snapshot.
 * @param snapshot `previous` / `current` from `triggers:applied-changed`.
 * @example
 * const ids = collectActiveRewardIdsFromSnapshot(payload.current);
 */
export const collectActiveRewardIdsFromSnapshot = (
  snapshot: TriggersAppliedSnapshotLike | undefined
): Set<string> => {
  const ids = new Set<string>();
  if (!snapshot) {
    return ids;
  }
  collectActiveFromRules(snapshot.overlay, ids);
  collectActiveFromRules(snapshot.timer, ids);
  collectActiveFromRules(snapshot.game, ids);
  collectActiveFromRules(snapshot.sounds, ids);
  collectActiveFromRules(snapshot.hotkeys, ids);
  return ids;
};

/**
 * Collects active reward ids from `triggers.getApplied()` categories map.
 * @param categories Map returned by `triggers.getApplied()`.
 * @example
 * const ids = collectActiveRewardIdsFromCategories(categories);
 */
export const collectActiveRewardIdsFromCategories = (
  categories: TriggersCategoryMapLike
): Set<string> => {
  const ids = new Set<string>();
  const ingest = (group: Record<string, RedeemSourceRule[]> | undefined) => {
    if (!group) {
      return;
    }
    for (const rules of Object.values(group)) {
      collectActiveFromRules(rules, ids);
    }
  };
  ingest(categories.overlay);
  ingest(categories.timer);
  ingest(categories.game);
  ingest(categories.sounds);
  ingest(categories.hotkeys);
  return ids;
};

/**
 * Forces a reward into the available state on Twitch (enabled + unpaused).
 * @param rewardId Twitch custom reward id.
 * @example
 * await ensureRewardAvailable('reward-id');
 */
const ensureRewardAvailable = async (rewardId: string) => {
  const result = await TwitchApi.UpdateCustomReward(rewardId, {
    is_enabled: true,
    is_paused: false,
  });
  if (!result.success) {
    console.warn(
      'Failed to enable/unpause Twitch reward:',
      rewardId,
      result.message
    );
  }
};

/**
 * Applies the configured unavailable policy to one reward id.
 * @param rewardId Twitch custom reward id.
 * @example
 * await applyUnavailablePolicyToReward('reward-id');
 */
export const applyUnavailablePolicyToReward = async (
  rewardId: string
): Promise<{ success: boolean; message?: string }> => {
  const settings = await reloadSettings();
  const id = rewardId.trim();
  if (!id) {
    return { success: false, message: 'Invalid reward id' };
  }

  switch (settings.rewardLifecycle) {
    case 'none':
      return { success: true };
    case 'pause': {
      const result = await TwitchApi.UpdateCustomReward(id, {
        is_paused: true,
      });
      return result.success
        ? { success: true }
        : {
            success: false,
            message: result.message || 'Failed to pause Twitch reward',
          };
    }
    case 'disable': {
      const result = await TwitchApi.UpdateCustomReward(id, {
        is_enabled: false,
      });
      return result.success
        ? { success: true }
        : {
            success: false,
            message: result.message || 'Failed to disable Twitch reward',
          };
    }
    case 'delete': {
      const deleted = await TwitchApi.DeleteCustomReward(id);
      return deleted
        ? { success: true }
        : { success: false, message: 'Failed to delete Twitch reward' };
    }
    default:
      return { success: true };
  }
};

/**
 * Applies the unavailable policy to many reward ids (sequentially).
 * @param rewardIds Twitch custom reward ids.
 * @example
 * await applyUnavailablePolicyToRewards(['a', 'b']);
 */
export const applyUnavailablePolicyToRewards = async (
  rewardIds: Iterable<string>
) => {
  if (getSettings().rewardLifecycle === 'none') {
    return;
  }
  for (const rewardId of rewardIds) {
    const result = await applyUnavailablePolicyToReward(rewardId);
    if (!result.success) {
      console.warn(
        'Failed to apply Twitch reward unavailable policy:',
        rewardId,
        result.message
      );
    }
  }
};

/**
 * Forces every currently active (bound + enabled consumer) reward online.
 * @example
 * await syncOnlineRewards();
 */
export const syncOnlineRewards = async () => {
  if (!TwitchApi.accessToken) {
    return;
  }

  const applied = await triggers.getApplied();
  if (!applied.success) {
    return;
  }

  const ids = collectActiveRewardIdsFromCategories(applied.categories);
  for (const rewardId of ids) {
    await ensureRewardAvailable(rewardId);
  }
};

/**
 * Reacts to trigger binding changes: make newly inactive rewards unavailable
 * and force newly/still active rewards online.
 * @param previous Previous applied snapshot for this addon.
 * @param current Current applied snapshot for this addon.
 * @example
 * await syncRewardsOnAppliedChanged(previous, current);
 */
export const syncRewardsOnAppliedChanged = async (
  previous: TriggersAppliedSnapshotLike,
  current: TriggersAppliedSnapshotLike
) => {
  if (!TwitchApi.accessToken) {
    return;
  }

  await reloadSettings();

  const prevIds = collectActiveRewardIdsFromSnapshot(previous);
  const nextIds = collectActiveRewardIdsFromSnapshot(current);

  const unavailable: string[] = [];
  for (const id of prevIds) {
    if (!nextIds.has(id)) {
      unavailable.push(id);
    }
  }
  if (unavailable.length) {
    await applyUnavailablePolicyToRewards(unavailable);
  }

  for (const id of nextIds) {
    await ensureRewardAvailable(id);
  }
};

/**
 * Applies the unavailable policy to all currently active rewards (app/addon stop).
 * @example
 * await syncRewardsOnPrepareStop();
 */
export const syncRewardsOnPrepareStop = async () => {
  if (!TwitchApi.accessToken) {
    return;
  }

  await reloadSettings();
  if (getSettings().rewardLifecycle === 'none') {
    return;
  }

  const applied = await triggers.getApplied();
  if (!applied.success) {
    return;
  }

  const ids = collectActiveRewardIdsFromCategories(applied.categories);
  await applyUnavailablePolicyToRewards(ids);
};
