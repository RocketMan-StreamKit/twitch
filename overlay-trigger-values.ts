import { TwitchApi } from './api';
import { reloadSettings } from './settings';

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

    const ensured = await TwitchApi.EnsureCustomReward(title, cost);
    if (!ensured.success || !ensured.reward?.id) {
      return {
        success: false,
        message: ensured.message || 'Failed to create Twitch reward',
      };
    }

    return {
      success: true,
      valueId: ensured.reward.id,
      label: ensured.reward.title,
      meta: String(ensured.reward.cost),
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
    if (!settings.deleteUnusedRewards) {
      return { success: true };
    }

    const deleted = await TwitchApi.DeleteCustomReward(valueId);
    return deleted
      ? { success: true }
      : { success: false, message: 'Failed to delete Twitch reward' };
  }
);
