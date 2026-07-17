/** Persisted Twitch reward id → title/cost used to recreate deleted rewards. */
export type StoredRewardMeta = {
  /** Exact Twitch reward title (including emoji prefix when used). */
  title: string;
  /** Channel points cost. */
  cost: number;
};

type RewardMetaStorage = {
  /** Map of Twitch custom reward id to recreate metadata. */
  rewardMeta?: Record<string, StoredRewardMeta>;
};

/**
 * Reads the reward metadata map from addon private storage.
 * @example
 * const meta = readRewardMetaMap();
 */
export const readRewardMetaMap = (): Record<string, StoredRewardMeta> => {
  const stored = storage.Read<RewardMetaStorage>();
  if (!stored?.rewardMeta || typeof stored.rewardMeta !== 'object') {
    return {};
  }
  return { ...stored.rewardMeta };
};

/**
 * Writes the full reward metadata map back to addon private storage.
 * @param rewardMeta Map of reward id → title/cost.
 * @example
 * writeRewardMetaMap({ 'abc': { title: 'Hydrate', cost: 100 } });
 */
export const writeRewardMetaMap = (
  rewardMeta: Record<string, StoredRewardMeta>
) => {
  const stored = storage.Read<RewardMetaStorage>() ?? {};
  storage.Write<RewardMetaStorage>({
    ...stored,
    rewardMeta,
  });
};

/**
 * Remembers title and cost for a Twitch custom reward id.
 * @param rewardId Twitch reward id.
 * @param title Exact reward title on Twitch.
 * @param cost Channel points cost.
 * @example
 * rememberRewardMeta('reward-id', '🔊 Alert', 500);
 */
export const rememberRewardMeta = (
  rewardId: string,
  title: string,
  cost: number
) => {
  const id = rewardId.trim();
  const trimmedTitle = title.trim().slice(0, 45);
  if (!id || !trimmedTitle) {
    return;
  }
  const normalizedCost = Math.max(1, Math.floor(cost) || 1);
  const next = readRewardMetaMap();
  next[id] = { title: trimmedTitle, cost: normalizedCost };
  writeRewardMetaMap(next);
};

/**
 * Moves stored metadata from an old reward id to a new one after recreation.
 * @param fromId Previous Twitch reward id.
 * @param toId New Twitch reward id.
 * @param meta Title/cost for the new id.
 * @example
 * moveRewardMeta('old-id', 'new-id', { title: 'Hydrate', cost: 100 });
 */
export const moveRewardMeta = (
  fromId: string,
  toId: string,
  meta: StoredRewardMeta
) => {
  const from = fromId.trim();
  const to = toId.trim();
  if (!to) {
    return;
  }
  const next = readRewardMetaMap();
  if (from) {
    delete next[from];
  }
  next[to] = {
    title: meta.title.trim().slice(0, 45),
    cost: Math.max(1, Math.floor(meta.cost) || 1),
  };
  writeRewardMetaMap(next);
};
