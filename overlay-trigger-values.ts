import { TwitchApi } from './api';
import { rememberRewardMeta } from './reward-meta';
import { applyUnavailablePolicyToReward } from './reward-lifecycle';
import { randomRewardBackgroundColor } from './reward-color';
import { syncMissingChannelPointRewards } from './reward-sync';
import { buildRewardTitle } from './reward-title';
import { reloadSettings } from './settings';

const PROVIDER = 'rewards';

/**
 * Returns whether a Twitch custom reward is unavailable for redemption.
 * @param reward Listed Twitch reward.
 * @example
 * isRewardDisabled({ id: 'a', title: 'x', cost: 1, is_enabled: false });
 */
const isRewardDisabled = (reward: {
  is_enabled: boolean;
  is_paused?: boolean;
}) => reward.is_enabled === false || reward.is_paused === true;

/**
 * Resolves channel-point cost from a create/update context payload.
 * @param context Optional requireValue context from settings UI.
 * @example
 * resolveRewardCost({ cost: 116 }); // 116
 */
const resolveRewardCost = (
  context?: Record<string, string | number | boolean>
): number | null => {
  const rawCost = context?.cost;
  const cost =
    typeof rawCost === 'number'
      ? rawCost
      : typeof rawCost === 'string'
        ? Number(rawCost)
        : 1;
  if (!Number.isFinite(cost) || cost < 1) {
    return null;
  }
  return Math.floor(cost);
};

events.On(`overlayTriggerValue:${PROVIDER}:list`, async () => {
  if (!TwitchApi.accessToken) {
    return {
      success: false,
      message: 'Twitch is not authorized',
      items: [],
    };
  }

  let remappedValues: Array<{ from: string; to: string }> = [];
  try {
    remappedValues = await syncMissingChannelPointRewards();
  } catch (error) {
    console.error('Failed to sync missing Twitch rewards before list:', error);
  }

  const result = await TwitchApi.ListCustomRewards();
  if (!result.success) {
    return {
      success: false,
      message: result.message || 'Failed to load Twitch rewards',
      items: [],
      remappedValues: remappedValues.length ? remappedValues : undefined,
    };
  }

  for (const reward of result.rewards) {
    rememberRewardMeta(reward.id, reward.title, reward.cost);
  }

  return {
    success: true,
    items: result.rewards.map(item => ({
      id: item.id,
      label: item.title,
      meta: String(item.cost),
      disabled: isRewardDisabled(item) ? true : undefined,
    })),
    remappedValues: remappedValues.length ? remappedValues : undefined,
  };
});

events.On(
  `overlayTriggerValue:${PROVIDER}:create`,
  async (payload: {
    title?: string;
    overlayId?: string;
    valueId?: string;
    context?: Record<string, string | number | boolean>;
  }) => {
    if (!TwitchApi.accessToken) {
      return { success: false, message: 'Twitch is not authorized' };
    }

    const cost = resolveRewardCost(payload?.context);
    if (cost == null) {
      return { success: false, message: 'Reward cost must be at least 1' };
    }

    const existingValueId = payload?.valueId?.trim();
    if (existingValueId) {
      const updated = await TwitchApi.UpdateCustomReward(existingValueId, {
        cost,
      });
      if (updated.success && updated.reward?.id) {
        rememberRewardMeta(
          updated.reward.id,
          updated.reward.title,
          updated.reward.cost
        );
        return {
          success: true,
          valueId: updated.reward.id,
          label: updated.reward.title,
          meta: String(updated.reward.cost),
          reloadList: true,
        };
      }

      const apiMessage = updated.message?.trim() || '';
      const foreignClient = /different client_id|different client id/i.test(
        apiMessage
      );
      const message = foreignClient
        ? 'This reward was created outside StreamKit (Twitch dashboard or another app). Its cost can only be changed there, or generate a new reward in StreamKit.'
        : apiMessage || 'Failed to update Twitch reward cost';

      return {
        success: false,
        message,
        notify: {
          variant: 'error' as const,
          title: {
            en: 'Cannot update reward',
            ru: 'Не удалось обновить награду',
            uk: 'Не вдалося оновити нагороду',
          },
          message: foreignClient
            ? {
                en: 'This reward was created outside StreamKit (Twitch dashboard or another app). Change its cost there, or generate a new reward here.',
                ru: 'Эта награда создана не через StreamKit (панель Twitch или другое приложение). Меняйте стоимость там или сгенерируйте новую награду здесь.',
                uk: 'Цю нагороду створено не через StreamKit (панель Twitch або інший застосунок). Змініть вартість там або згенеруйте нову нагороду тут.',
              }
            : {
                en: message,
                ru: message,
                uk: message,
              },
        },
      };
    }

    const title = payload?.title?.trim();
    if (!title) {
      return { success: false, message: 'Reward title is required' };
    }

    const settings = await reloadSettings();
    const rewardTitle = await buildRewardTitle({
      title,
      overlayId: payload?.overlayId,
      context: payload?.context,
      addEmoji: settings.addRewardEmoji,
    });

    const ensured = await TwitchApi.EnsureCustomReward(
      rewardTitle,
      cost,
      settings.randomRewardColor
        ? { backgroundColor: randomRewardBackgroundColor() }
        : undefined
    );
    if (!ensured.success || !ensured.reward?.id) {
      return {
        success: false,
        message: ensured.message || 'Failed to create Twitch reward',
      };
    }

    rememberRewardMeta(
      ensured.reward.id,
      ensured.reward.title,
      ensured.reward.cost
    );

    return {
      success: true,
      valueId: ensured.reward.id,
      label: ensured.reward.title,
      meta: String(ensured.reward.cost),
      reloadList: true,
    };
  }
);

events.On(
  `overlayTriggerValue:${PROVIDER}:release`,
  async (payload: { valueId?: string }) => {
    if (!TwitchApi.accessToken) {
      return { success: false, message: 'Twitch is not authorized' };
    }

    const valueId = payload?.valueId?.trim();
    if (!valueId) {
      return { success: false, message: 'Invalid reward id' };
    }

    const settings = await reloadSettings();
    if (settings.rewardLifecycle === 'none') {
      return { success: true };
    }

    return applyUnavailablePolicyToReward(valueId);
  }
);
