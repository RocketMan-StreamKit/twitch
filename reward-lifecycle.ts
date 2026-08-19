import { TwitchApi } from './api';
import {
  collectActiveRewardIds,
  collectManagedRewardBindingsFromCategories,
  collectManagedRewardBindingsFromSnapshot,
  collectManagedRewardIds,
  type ManagedRewardBinding,
} from './reward-bindings';
import { readRewardMetaMap } from './reward-meta';
import { reloadSettings, type RewardLifecycleAction } from './settings';

/** One automatically managed reward shown in addon settings. */
export type ManagedRewardListItem = {
  /** Twitch custom reward id. */
  id: string;
  /** Display title (Twitch title, stored meta, or a consumer name). */
  title: string;
  /** Channel points cost when known. */
  cost: number | null;
  /** True when at least one bound consumer is currently enabled. */
  active: boolean;
};

type TriggersAppliedSnapshotLike = Parameters<
  typeof collectManagedRewardBindingsFromSnapshot
>[0];

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
 * @param policy Optional already-resolved lifecycle action (avoids extra config IPC).
 * @example
 * await applyUnavailablePolicyToReward('reward-id');
 * await applyUnavailablePolicyToReward('reward-id', 'disable');
 */
export const applyUnavailablePolicyToReward = async (
  rewardId: string,
  policy?: RewardLifecycleAction
): Promise<{ success: boolean; message?: string }> => {
  const id = rewardId.trim();
  if (!id) {
    return { success: false, message: 'Invalid reward id' };
  }

  const action = policy ?? (await reloadSettings()).rewardLifecycle;

  switch (action) {
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
 * Reloads addon settings once, then reuses that policy for every id.
 * @param rewardIds Twitch custom reward ids.
 * @example
 * await applyUnavailablePolicyToRewards(['a', 'b']);
 */
export const applyUnavailablePolicyToRewards = async (
  rewardIds: Iterable<string>
) => {
  const settings = await reloadSettings();
  if (settings.rewardLifecycle === 'none') {
    return;
  }
  for (const rewardId of rewardIds) {
    const result = await applyUnavailablePolicyToReward(
      rewardId,
      settings.rewardLifecycle
    );
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

  const ids = collectActiveRewardIds(
    collectManagedRewardBindingsFromCategories(applied.categories)
  );
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

  const prevIds = collectActiveRewardIds(
    collectManagedRewardBindingsFromSnapshot(previous)
  );
  const nextBindings = collectManagedRewardBindingsFromSnapshot(current);
  const nextIds = collectActiveRewardIds(nextBindings);

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
 * Applies the unavailable policy to every reward this addon still binds.
 * Includes consumers that are already off — those were skipped previously
 * when prepare-stop only looked at "currently active" ids, so a failed
 * overlay-off disable was never retried on quit.
 * @example
 * await syncRewardsOnPrepareStop();
 */
export const syncRewardsOnPrepareStop = async () => {
  if (!TwitchApi.accessToken) {
    return;
  }

  const settings = await reloadSettings();
  if (settings.rewardLifecycle === 'none') {
    return;
  }

  const applied = await triggers.getApplied();
  if (!applied.success) {
    return;
  }

  const ids = collectManagedRewardIds(
    collectManagedRewardBindingsFromCategories(applied.categories)
  );
  await applyUnavailablePolicyToRewards(ids);
};

/**
 * Resolves a display title/cost for a managed reward binding.
 * @param binding Bound reward from applied triggers.
 * @param helixById Live Twitch rewards keyed by id.
 * @param metaMap Stored recreate metadata.
 * @example
 * resolveManagedRewardListItem(binding, helix, meta);
 */
const resolveManagedRewardListItem = (
  binding: ManagedRewardBinding,
  helixById: Map<string, { title: string; cost: number }>,
  metaMap: ReturnType<typeof readRewardMetaMap>
): ManagedRewardListItem => {
  const helix = helixById.get(binding.rewardId);
  if (helix) {
    return {
      id: binding.rewardId,
      title: helix.title,
      cost: helix.cost,
      active: binding.active,
    };
  }
  const stored = metaMap[binding.rewardId];
  if (stored?.title?.trim()) {
    return {
      id: binding.rewardId,
      title: stored.title.trim(),
      cost: stored.cost,
      active: binding.active,
    };
  }
  return {
    id: binding.rewardId,
    title: binding.titleHint?.trim() || binding.rewardId,
    cost: null,
    active: binding.active,
  };
};

/**
 * Lists channel-point rewards this addon currently manages (settings info block).
 * @example
 * const items = await listManagedRewardsForSettings();
 */
export const listManagedRewardsForSettings = async (): Promise<
  ManagedRewardListItem[]
> => {
  const applied = await triggers.getApplied();
  if (!applied.success) {
    return [];
  }

  const bindings = collectManagedRewardBindingsFromCategories(
    applied.categories
  );
  if (!bindings.length) {
    return [];
  }

  const helixById = new Map<string, { title: string; cost: number }>();
  if (TwitchApi.accessToken) {
    const listed = await TwitchApi.ListCustomRewards();
    if (listed.success) {
      for (const reward of listed.rewards) {
        helixById.set(reward.id, { title: reward.title, cost: reward.cost });
      }
    }
  }

  const metaMap = readRewardMetaMap();
  return bindings
    .map(binding =>
      resolveManagedRewardListItem(binding, helixById, metaMap)
    )
    .sort((left, right) =>
      left.title.localeCompare(right.title, undefined, {
        sensitivity: 'base',
      })
    );
};
