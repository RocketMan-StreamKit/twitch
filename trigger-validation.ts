/**
 * Validates Twitch dashboard trigger bindings before settings save.
 * Blocks save when a channel-point reward trigger has no reward id yet
 * (user selected "Generate reward" but did not create one).
 */

const REDEEMS_KEY = 'redeems';
const GENERATE_SENTINEL = '__overlay_generate_value__';

const INVALID_REWARD_MESSAGES = {
  en: 'Generate or select a channel point reward before saving',
  ru: 'Сгенерируйте или выберите награду за баллы канала перед сохранением',
  uk: 'Згенеруйте або виберіть нагороду за бали каналу перед збереженням',
} as const;

type TriggerRuleLike = {
  trigger?: {
    type?: string;
    key?: string;
    value?: string | number | boolean;
  };
};

type DraftSnapshot = {
  overlay?: TriggerRuleLike[];
  timer?: TriggerRuleLike[];
  game?: TriggerRuleLike[];
  sounds?: TriggerRuleLike[];
  hotkeys?: TriggerRuleLike[];
};

/**
 * Returns whether a rule is a channel-point reward trigger without a reward id.
 * @param rule Applied trigger rule from a draft snapshot group.
 * @example
 * isIncompleteRedeemRule({ trigger: { type: 'custom', key: 'redeems', value: '' } });
 */
const isIncompleteRedeemRule = (rule: TriggerRuleLike) => {
  const trigger = rule?.trigger;
  if (!trigger || trigger.type !== 'custom' || trigger.key !== REDEEMS_KEY) {
    return false;
  }
  const value = trigger.value;
  if (typeof value !== 'string') {
    return true;
  }
  const trimmed = value.trim();
  return !trimmed || trimmed === GENERATE_SENTINEL;
};

/**
 * Picks a localized validation message from the current app UI language.
 * @example
 * resolveInvalidRewardMessage();
 */
const resolveInvalidRewardMessage = () => {
  const lang = LANG.current;
  if (lang === 'ru' || lang === 'uk') {
    return INVALID_REWARD_MESSAGES[lang];
  }
  return INVALID_REWARD_MESSAGES.en;
};

events.On('triggers:validate', (payload: { draft?: DraftSnapshot } = {}) => {
  const draft = payload?.draft || {};
  const groups = [
    draft.overlay,
    draft.timer,
    draft.game,
    draft.sounds,
    draft.hotkeys,
  ];

  for (const group of groups) {
    if (!Array.isArray(group)) {
      continue;
    }
    if (group.some(isIncompleteRedeemRule)) {
      return {
        success: false as const,
        message: resolveInvalidRewardMessage(),
      };
    }
  }

  return { success: true as const };
});
