import { PLATFORM } from './constants';
import { buildTwitchProfile, type TwitchEventUser } from './dashboard-user';

/** Custom trigger keys for chat message matching in overlay settings. */
export const CHAT_TRIGGER_KEYS = new Set([
  'message',
  'message_contains',
  'message_starts_with',
]);

type ChatTriggerRule = {
  type: 'custom';
  key: string;
  value: string | number | boolean;
};

type AppliedTriggerCategories = Extract<
  Awaited<ReturnType<typeof triggers.getApplied>>,
  { success: true }
>['categories'];

type TriggerCarrier = {
  trigger: { type: string; key?: string; value: string | number | boolean };
};

let chatTriggerRules: ChatTriggerRule[] = [];

/**
 * Builds a stable id for deduplicating saved chat trigger rules.
 * @param rule Trigger rule from settings.
 */
const chatTriggerRuleId = (rule: {
  type: string;
  key?: string;
  value: string | number | boolean;
}) => `${rule.type}:${rule.key}:${String(rule.value)}`;

/**
 * Collects chat-related trigger rules bound to this addon across consumer systems.
 * @param categories Trigger map from `triggers.getApplied()`.
 */
const collectChatTriggerRules = (
  categories: AppliedTriggerCategories
): ChatTriggerRule[] => {
  const seen = new Set<string>();
  const rules: ChatTriggerRule[] = [];

  const addRule = (trigger: {
    type: string;
    key?: string;
    value: string | number | boolean;
  }) => {
    if (
      trigger.type !== 'custom' ||
      !trigger.key ||
      !CHAT_TRIGGER_KEYS.has(trigger.key)
    ) {
      return;
    }

    const id = chatTriggerRuleId(trigger);
    if (seen.has(id)) {
      return;
    }

    seen.add(id);
    rules.push({
      type: 'custom',
      key: trigger.key,
      value: trigger.value,
    });
  };

  const readGroup = (group: Record<string, TriggerCarrier[]> | undefined) => {
    if (!group) {
      return;
    }

    for (const item of group[PLATFORM] || []) {
      addRule(item.trigger);
    }
  };

  readGroup(categories.overlay);
  readGroup(categories.timer);
  readGroup(categories.game);
  readGroup(categories.sounds);
  readGroup(categories.hotkeys);

  return rules;
};

/**
 * Reloads cached chat trigger rules from saved app settings.
 */
export const refreshChatTriggerRules = async () => {
  const response = await triggers.getApplied();
  if (!response.success) {
    console.error(
      'Failed to load applied triggers:',
      response.message || 'unknown error'
    );
    chatTriggerRules = [];
    return;
  }

  chatTriggerRules = collectChatTriggerRules(response.categories);
};

/**
 * Returns whether a chat line matches a configured chat trigger rule.
 * @param content Incoming chat message text.
 * @param rule Saved trigger rule from settings.
 */
const matchesChatTriggerRule = (content: string, rule: ChatTriggerRule) => {
  const pattern = String(rule.value);

  switch (rule.key) {
    case 'message':
      return content === pattern;
    case 'message_contains':
      return content.includes(pattern);
    case 'message_starts_with':
      return content.startsWith(pattern);
    default:
      return false;
  }
};

/**
 * Pushes a dashboard record when an incoming chat message matches configured triggers.
 * @param user Twitch chatter who sent the message.
 * @param content Normalized chat message text.
 * @param messageId Optional Twitch message id for deduplicated record ids.
 * @example
 * await dispatchChatMessageTriggers(
 *   { user_id: '1', user_login: 'viewer', user_name: 'Viewer' },
 *   '!hello',
 *   'msg-1'
 * );
 */
export const dispatchChatMessageTriggers = async (
  user: TwitchEventUser,
  content: string,
  messageId?: string
) => {
  if (!chatTriggerRules.length) {
    return;
  }

  const matched = chatTriggerRules.filter(rule =>
    matchesChatTriggerRule(content, rule)
  );
  if (!matched.length) {
    return;
  }

  const profile = await buildTwitchProfile(user);
  const recordId = messageId ? `twitch:chat-trigger:${messageId}` : undefined;

  return dashboard.addRecord(
    {
      id: recordId,
      type: 'custom',
      platform: PLATFORM,
      from: profile.id,
      message: content,
    },
    profile,
    {
      triggers: matched.map(rule => ({
        type: rule.type,
        key: rule.key,
        value: rule.value,
      })),
    }
  );
};

events.On('triggers:applied-changed', () => {
  void refreshChatTriggerRules().catch(error => console.error(error));
});

void refreshChatTriggerRules().catch(error => console.error(error));
