export type RewardConsumer = 'sounds' | 'overlay' | 'hotkeys' | 'game';

const REWARD_EMOJI: Record<RewardConsumer, string> = {
  sounds: '🔊',
  overlay: '📺',
  hotkeys: '⌨️',
  game: '🎮',
};

const REWARD_EMOJI_VALUES = Object.values(REWARD_EMOJI);
const TWITCH_REWARD_TITLE_MAX = 45;
const TIMER_TRIGGER_CONTEXT_ID = '__timer__';

const OVERLAY_MANIFEST_TYPES = new Set(['overlay', 'overlay.info']);

const isRewardConsumer = (value: string): value is RewardConsumer =>
  value in REWARD_EMOJI;

const hasRewardEmojiPrefix = (title: string): boolean =>
  REWARD_EMOJI_VALUES.some(emoji => title.startsWith(`${emoji} `));

const consumerFromManifestType = (type: string): RewardConsumer | null => {
  if (type === 'game') {
    return 'game';
  }
  if (OVERLAY_MANIFEST_TYPES.has(type)) {
    return 'overlay';
  }
  return null;
};

const resolveConsumerFromApplied = (
  overlayId: string,
  categories: TriggersAppliedCategoryMap
): RewardConsumer | null => {
  for (const rules of Object.values(categories.sounds)) {
    if (rules.some(rule => rule.soundId === overlayId)) {
      return 'sounds';
    }
  }

  for (const rules of Object.values(categories.hotkeys)) {
    if (rules.some(rule => rule.presetId === overlayId)) {
      return 'hotkeys';
    }
  }

  for (const rules of Object.values(categories.overlay)) {
    if (rules.some(rule => rule.targetId === overlayId)) {
      return 'overlay';
    }
  }

  for (const rules of Object.values(categories.game)) {
    if (rules.some(rule => rule.gameAddonId === overlayId)) {
      return 'game';
    }
  }

  return null;
};

const resolveConsumerFromAddonInfo = async (
  overlayId: string
): Promise<RewardConsumer | null> => {
  const info = await addons.getInfo([overlayId]);
  if (!info.success) {
    return null;
  }

  const entry = info.addons.find(item => item.id === overlayId);
  if (!entry || entry.missing || !entry.manifest) {
    return null;
  }

  return consumerFromManifestType(entry.manifest.type);
};

const resolveConsumerFromLegacyId = (overlayId: string): RewardConsumer | null => {
  if (overlayId.startsWith('sound-')) {
    return 'sounds';
  }

  if (overlayId.startsWith('hotkey-')) {
    return 'hotkeys';
  }

  return null;
};

export const resolveRewardConsumer = async (args: {
  overlayId?: string;
  context?: Record<string, string | number | boolean>;
}): Promise<RewardConsumer | null> => {
  const overlayId = args.overlayId?.trim();
  if (!overlayId || overlayId === TIMER_TRIGGER_CONTEXT_ID) {
    return null;
  }

  const contextConsumer = args.context?.consumer;
  if (typeof contextConsumer === 'string' && isRewardConsumer(contextConsumer)) {
    return contextConsumer;
  }

  const applied = await triggers.getApplied();
  if (applied.success) {
    const fromApplied = resolveConsumerFromApplied(overlayId, applied.categories);
    if (fromApplied) {
      return fromApplied;
    }
  }

  const fromAddonInfo = await resolveConsumerFromAddonInfo(overlayId);
  if (fromAddonInfo) {
    return fromAddonInfo;
  }

  return resolveConsumerFromLegacyId(overlayId);
};

export const formatRewardTitle = (
  title: string,
  consumer: RewardConsumer | null,
  addEmoji: boolean
): string => {
  const trimmedTitle = title.trim();
  if (!trimmedTitle || !addEmoji || !consumer) {
    return trimmedTitle.slice(0, TWITCH_REWARD_TITLE_MAX);
  }

  if (hasRewardEmojiPrefix(trimmedTitle)) {
    return trimmedTitle.slice(0, TWITCH_REWARD_TITLE_MAX);
  }

  const emoji = REWARD_EMOJI[consumer];
  const prefixed = `${emoji} ${trimmedTitle}`;
  return prefixed.slice(0, TWITCH_REWARD_TITLE_MAX);
};

export const buildRewardTitle = async (args: {
  title: string;
  overlayId?: string;
  context?: Record<string, string | number | boolean>;
  addEmoji: boolean;
}): Promise<string> => {
  const consumer = await resolveRewardConsumer({
    overlayId: args.overlayId,
    context: args.context,
  });

  return formatRewardTitle(args.title, consumer, args.addEmoji);
};
