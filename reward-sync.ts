import { TwitchApi } from './api';
import {
  moveRewardMeta,
  readRewardMetaMap,
  rememberRewardMeta,
  type StoredRewardMeta,
} from './reward-meta';

const REDEEMS_KEY = 'redeems';
const DEFAULT_REWARD_COST = 100;

type TriggerRuleLike = {
  type?: string;
  key?: string;
  value?: string | number | boolean;
};

type RedeemBinding = {
  /** Twitch reward id currently stored in the trigger. */
  rewardId: string;
  /** Fallback title when storage meta is missing. */
  titleHint?: string;
};

type TriggersReplaceApi = {
  replaceAppliedValues: (args: {
    replacements: Array<{ from: string; to: string }>;
    key?: string;
  }) => Promise<{ success: true; updated: number } | { success: false; message?: string }>;
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
 * Collects unique redeem reward ids (and title hints) from applied triggers.
 * @param categories Map from `triggers.getApplied().categories`.
 * @example
 * const bindings = collectRedeemBindings(categories);
 */
const collectRedeemBindings = (categories: {
  overlay?: Record<string, Array<{ trigger: TriggerRuleLike; targetId?: string }>>;
  timer?: Record<string, Array<{ trigger: TriggerRuleLike }>>;
  game?: Record<
    string,
    Array<{ trigger: TriggerRuleLike; gameAddonId?: string }>
  >;
  sounds?: Record<
    string,
    Array<{ trigger: TriggerRuleLike; soundName?: string }>
  >;
  hotkeys?: Record<
    string,
    Array<{ trigger: TriggerRuleLike; presetName?: string }>
  >;
}): RedeemBinding[] => {
  const byId = new Map<string, RedeemBinding>();

  const add = (trigger: TriggerRuleLike, titleHint?: string) => {
    if (!isRedeemTrigger(trigger)) {
      return;
    }
    const rewardId = trigger.value.trim();
    const existing = byId.get(rewardId);
    if (existing) {
      if (!existing.titleHint && titleHint) {
        existing.titleHint = titleHint;
      }
      return;
    }
    byId.set(rewardId, {
      rewardId,
      titleHint: titleHint?.trim() || undefined,
    });
  };

  const twitchOverlay = categories.overlay?.twitch || [];
  for (const rule of twitchOverlay) {
    add(rule.trigger);
  }

  const twitchTimer = categories.timer?.twitch || [];
  for (const rule of twitchTimer) {
    add(rule.trigger, 'Timer');
  }

  const twitchGame = categories.game?.twitch || [];
  for (const rule of twitchGame) {
    add(rule.trigger);
  }

  const twitchSounds = categories.sounds?.twitch || [];
  for (const rule of twitchSounds) {
    add(rule.trigger, rule.soundName);
  }

  const twitchHotkeys = categories.hotkeys?.twitch || [];
  for (const rule of twitchHotkeys) {
    add(rule.trigger, rule.presetName);
  }

  return [...byId.values()];
};

/**
 * Resolves title/cost used to recreate a missing Twitch reward.
 * @param binding Applied redeem binding.
 * @param metaMap Stored reward metadata.
 * @example
 * resolveRecreateMeta(binding, readRewardMetaMap());
 */
const resolveRecreateMeta = (
  binding: RedeemBinding,
  metaMap: Record<string, StoredRewardMeta>
): StoredRewardMeta | null => {
  const stored = metaMap[binding.rewardId];
  if (stored?.title?.trim()) {
    return {
      title: stored.title.trim().slice(0, 45),
      cost: Math.max(1, Math.floor(stored.cost) || DEFAULT_REWARD_COST),
    };
  }
  if (binding.titleHint?.trim()) {
    return {
      title: binding.titleHint.trim().slice(0, 45),
      cost: DEFAULT_REWARD_COST,
    };
  }
  return null;
};

/**
 * Remaps saved trigger values after rewards were recreated with new ids.
 * No-ops on older StreamKit+ builds that lack `replaceAppliedValues`.
 * @param replacements Old → new reward id pairs.
 * @example
 * await applyRewardIdRemaps([{ from: 'old', to: 'new' }]);
 */
const applyRewardIdRemaps = async (
  replacements: Array<{ from: string; to: string }>
) => {
  if (!replacements.length) {
    return;
  }
  const api = triggers as unknown as TriggersReplaceApi;
  if (typeof api.replaceAppliedValues !== 'function') {
    console.warn(
      'triggers.replaceAppliedValues is unavailable; recreate remaps were skipped'
    );
    return;
  }
  const result = await api.replaceAppliedValues({
    key: REDEEMS_KEY,
    replacements,
  });
  if (!result.success) {
    console.error(
      'Failed to remap recreated Twitch reward ids:',
      result.message
    );
  }
};

/**
 * Recreates Twitch channel-point rewards that triggers still reference but
 * that no longer exist on Twitch, then remaps saved trigger value ids.
 * When a reward with the same title already exists, bindings are remapped to
 * that id without changing its cost (avoids fighting generate/update).
 * @returns Remapped old → new reward id pairs applied to storage.
 * @example
 * const remapped = await syncMissingChannelPointRewards();
 */
export const syncMissingChannelPointRewards = async (): Promise<
  Array<{ from: string; to: string }>
> => {
  if (!TwitchApi.accessToken) {
    return [];
  }

  const listed = await TwitchApi.ListCustomRewards();
  if (!listed.success) {
    return [];
  }

  for (const reward of listed.rewards) {
    rememberRewardMeta(reward.id, reward.title, reward.cost);
  }

  const applied = await triggers.getApplied();
  if (!applied.success) {
    return [];
  }

  const existingIds = new Set(listed.rewards.map(item => item.id));
  const rewardsByTitle = new Map(
    listed.rewards.map(item => [item.title, item] as const)
  );
  const metaMap = readRewardMetaMap();
  const bindings = collectRedeemBindings(applied.categories);
  const replacements: Array<{ from: string; to: string }> = [];

  for (const binding of bindings) {
    if (existingIds.has(binding.rewardId)) {
      continue;
    }

    const meta = resolveRecreateMeta(binding, metaMap);
    if (!meta) {
      console.warn(
        'Twitch reward missing from channel and no recreate metadata:',
        binding.rewardId
      );
      continue;
    }

    // Prefer remapping onto an existing same-title reward without changing its
    // cost. EnsureCustomReward would overwrite cost and fight intentional
    // generate/update flows that briefly leave applied triggers on the old id.
    const existingByTitle = rewardsByTitle.get(meta.title);
    if (existingByTitle?.id) {
      existingIds.add(existingByTitle.id);
      moveRewardMeta(binding.rewardId, existingByTitle.id, {
        title: existingByTitle.title,
        cost: existingByTitle.cost,
      });
      if (existingByTitle.id !== binding.rewardId) {
        replacements.push({ from: binding.rewardId, to: existingByTitle.id });
      }
      continue;
    }

    const created = await TwitchApi.CreateCustomReward(meta.title, meta.cost);
    if (!created.success || !created.reward?.id) {
      console.error(
        'Failed to recreate missing Twitch reward:',
        binding.rewardId,
        created.message
      );
      continue;
    }

    const newId = created.reward.id;
    existingIds.add(newId);
    rewardsByTitle.set(created.reward.title, created.reward);
    moveRewardMeta(binding.rewardId, newId, {
      title: created.reward.title,
      cost: created.reward.cost,
    });

    if (newId !== binding.rewardId) {
      replacements.push({ from: binding.rewardId, to: newId });
    }
  }

  if (replacements.length) {
    await applyRewardIdRemaps(replacements);
  }

  return replacements;
};
