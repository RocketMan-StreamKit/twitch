import { TwitchApi } from './api';

const PROVIDER = 'rewards';

events.On(`overlayTriggerValue:${PROVIDER}:list`, async () => {
  if (!TwitchApi.accessToken) {
    return {
      success: false,
      message: 'Twitch is not authorized',
      items: [],
    };
  }

  const result = await TwitchApi.ListCustomRewards();
  if (!result.success) {
    return {
      success: false,
      message: result.message || 'Failed to load Twitch rewards',
      items: [],
    };
  }

  return {
    success: true,
    items: result.rewards.map(item => ({
      id: item.id,
      label: item.title,
      meta: String(item.cost),
    })),
  };
});

events.On(
  `overlayTriggerValue:${PROVIDER}:create`,
  async (payload: {
    title?: string;
    context?: Record<string, string | number | boolean>;
  }) => {
    if (!TwitchApi.accessToken) {
      return { success: false, message: 'Twitch is not authorized' };
    }

    const title = payload?.title?.trim();
    if (!title) {
      return { success: false, message: 'Reward title is required' };
    }

    const rawCost = payload?.context?.cost;
    const cost =
      typeof rawCost === 'number'
        ? rawCost
        : typeof rawCost === 'string'
          ? Number(rawCost)
          : 1;
    if (!Number.isFinite(cost) || cost < 1) {
      return { success: false, message: 'Reward cost must be at least 1' };
    }

    const created = await TwitchApi.CreateCustomReward(title, cost);
    if (!created.success || !created.reward?.id) {
      return {
        success: false,
        message: created.message || 'Failed to create Twitch reward',
      };
    }

    return {
      success: true,
      valueId: created.reward.id,
      label: created.reward.title,
      meta: String(created.reward.cost),
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

    const deleted = await TwitchApi.DeleteCustomReward(valueId);
    return deleted
      ? { success: true }
      : { success: false, message: 'Failed to delete Twitch reward' };
  }
);
