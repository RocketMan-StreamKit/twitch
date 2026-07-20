import {
  syncRewardsOnAppliedChanged,
  syncRewardsOnPrepareStop,
} from './reward-lifecycle';

events.On(
  'triggers:applied-changed',
  async (payload: {
    previous?: Parameters<typeof syncRewardsOnAppliedChanged>[0];
    current?: Parameters<typeof syncRewardsOnAppliedChanged>[1];
  }) => {
    try {
      await syncRewardsOnAppliedChanged(
        payload?.previous || {},
        payload?.current || {}
      );
    } catch (error) {
      console.error(
        'Failed to sync Twitch rewards after trigger change:',
        error
      );
    }
  }
);

events.On('addon:prepare-stop', async () => {
  try {
    await syncRewardsOnPrepareStop();
  } catch (error) {
    console.error('Failed to sync Twitch rewards on prepare-stop:', error);
  }
  return { success: true };
});
