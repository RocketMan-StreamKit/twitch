import { PLATFORM } from './constants';

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
  soundName?: string;
  presetName?: string;
  sourceAddonId?: string;
};

type TriggersAppliedSnapshotLike = {
  overlay?: RedeemSourceRule[];
  timer?: RedeemSourceRule[];
  game?: RedeemSourceRule[];
  gameInput?: RedeemSourceRule[];
  sounds?: RedeemSourceRule[];
  hotkeys?: RedeemSourceRule[];
};

type TriggersCategoryMapLike = {
  overlay?: Record<string, RedeemSourceRule[]>;
  timer?: Record<string, RedeemSourceRule[]>;
  game?: Record<string, RedeemSourceRule[]>;
  gameInput?: Record<string, RedeemSourceRule[]>;
  sounds?: Record<string, RedeemSourceRule[]>;
  hotkeys?: Record<string, RedeemSourceRule[]>;
};

/** Bound Twitch reward that StreamKit enables/disables automatically. */
export type ManagedRewardBinding = {
  /** Twitch custom reward id stored on the trigger. */
  rewardId: string;
  /** Fallback title from a sound, hotkey preset, or similar consumer name. */
  titleHint?: string;
  /** True when at least one consumer that uses this reward is currently enabled. */
  active: boolean;
};

/**
 * Returns whether a trigger rule is a channel-point redeem with a reward id.
 * @param trigger Applied trigger rule.
 * @example
 * isRedeemTrigger({ type: 'custom', key: 'redeems', value: 'abc' });
 */
export const isRedeemTrigger = (
  trigger: TriggerRuleLike | undefined
): trigger is TriggerRuleLike & { value: string } => {
  if (!trigger || trigger.type !== 'custom' || trigger.key !== REDEEMS_KEY) {
    return false;
  }
  return typeof trigger.value === 'string' && Boolean(trigger.value.trim());
};

/**
 * Merges one redeem rule into the managed-reward map.
 * @param rule Overlay/sound/hotkey/game rule that may reference a reward.
 * @param into Destination map keyed by reward id.
 * @example
 * addManagedBinding({ trigger: { type: 'custom', key: 'redeems', value: 'a' } }, map);
 */
const addManagedBinding = (
  rule: RedeemSourceRule | undefined,
  into: Map<string, ManagedRewardBinding>
) => {
  if (!rule || !isRedeemTrigger(rule.trigger)) {
    return;
  }
  const rewardId = rule.trigger.value.trim();
  const titleHint =
    rule.soundName?.trim() || rule.presetName?.trim() || undefined;
  const active = rule.enabled !== false;
  const existing = into.get(rewardId);
  if (!existing) {
    into.set(rewardId, { rewardId, titleHint, active });
    return;
  }
  if (active) {
    existing.active = true;
  }
  if (!existing.titleHint && titleHint) {
    existing.titleHint = titleHint;
  }
};

/**
 * Collects this addon's redeem rules from one getApplied() category map.
 * `gameInput` is keyed by game addon id, so only rules sourced from Twitch
 * are kept.
 * @param group Category map (`addonId → rules[]`, or game id for `gameInput`).
 * @param into Destination map.
 * @param gameInput When true, skip rules whose `sourceAddonId` is not Twitch.
 * @example
 * ingestCategoryGroup(categories.overlay, map);
 */
const ingestCategoryGroup = (
  group: Record<string, RedeemSourceRule[]> | undefined,
  into: Map<string, ManagedRewardBinding>,
  gameInput = false
) => {
  if (!group) {
    return;
  }
  if (gameInput) {
    for (const rules of Object.values(group)) {
      for (const rule of rules) {
        if (rule.sourceAddonId && rule.sourceAddonId !== PLATFORM) {
          continue;
        }
        addManagedBinding(rule, into);
      }
    }
    return;
  }
  for (const rule of group[PLATFORM] || []) {
    addManagedBinding(rule, into);
  }
};

/**
 * Collects every Twitch reward id this addon currently binds as a trigger,
 * including consumers that are turned off.
 * @param snapshot `previous` / `current` from `triggers:applied-changed`.
 * @example
 * const bindings = collectManagedRewardBindingsFromSnapshot(payload.current);
 */
export const collectManagedRewardBindingsFromSnapshot = (
  snapshot: TriggersAppliedSnapshotLike | undefined
): ManagedRewardBinding[] => {
  const into = new Map<string, ManagedRewardBinding>();
  if (!snapshot) {
    return [];
  }
  for (const rule of snapshot.overlay || []) {
    addManagedBinding(rule, into);
  }
  for (const rule of snapshot.timer || []) {
    addManagedBinding(rule, into);
  }
  for (const rule of snapshot.game || []) {
    addManagedBinding(rule, into);
  }
  for (const rule of snapshot.gameInput || []) {
    addManagedBinding(rule, into);
  }
  for (const rule of snapshot.sounds || []) {
    addManagedBinding(rule, into);
  }
  for (const rule of snapshot.hotkeys || []) {
    addManagedBinding(rule, into);
  }
  return [...into.values()];
};

/**
 * Collects every Twitch reward id this addon binds, from `triggers.getApplied()`.
 * @param categories Map returned by `triggers.getApplied()`.
 * @example
 * const bindings = collectManagedRewardBindingsFromCategories(categories);
 */
export const collectManagedRewardBindingsFromCategories = (
  categories: TriggersCategoryMapLike
): ManagedRewardBinding[] => {
  const into = new Map<string, ManagedRewardBinding>();
  ingestCategoryGroup(categories.overlay, into);
  ingestCategoryGroup(categories.timer, into);
  ingestCategoryGroup(categories.game, into);
  ingestCategoryGroup(categories.gameInput, into, true);
  ingestCategoryGroup(categories.sounds, into);
  ingestCategoryGroup(categories.hotkeys, into);
  return [...into.values()];
};

/**
 * Reward ids that currently have at least one enabled consumer.
 * @param bindings Managed reward bindings.
 * @example
 * collectActiveRewardIds(bindings); // Set { 'abc' }
 */
export const collectActiveRewardIds = (
  bindings: ManagedRewardBinding[]
): Set<string> => {
  const ids = new Set<string>();
  for (const binding of bindings) {
    if (binding.active) {
      ids.add(binding.rewardId);
    }
  }
  return ids;
};

/**
 * Every bound reward id, whether the consumer is on or off.
 * @param bindings Managed reward bindings.
 * @example
 * collectManagedRewardIds(bindings); // Set { 'abc', 'def' }
 */
export const collectManagedRewardIds = (
  bindings: ManagedRewardBinding[]
): Set<string> => new Set(bindings.map(binding => binding.rewardId));
