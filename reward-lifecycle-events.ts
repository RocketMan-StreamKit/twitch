import { restoreFollowModeIfLifted } from './auto-follow-mode';
import { refreshChatTriggerRules } from './chat-triggers';
import { refreshManagedRewardsConfig } from './config';
import {
  syncRewardsOnAppliedChanged,
  syncRewardsOnPrepareStop,
} from './reward-lifecycle';

/**
 * Chat-rule refresh and reward lifecycle share one `triggers:applied-changed`
 * subscription so both always run (older hosts only dispatched the first
 * `events.On` handler per event name).
 *
 * Returns immediately so settings IPC is not blocked by Twitch Helix calls;
 * reward pause/disable/delete runs in the background.
 */
events.On(
  'triggers:applied-changed',
  (payload: {
    previous?: Parameters<typeof syncRewardsOnAppliedChanged>[0];
    current?: Parameters<typeof syncRewardsOnAppliedChanged>[1];
  }) => {
    void refreshChatTriggerRules().catch(error => console.error(error));

    void syncRewardsOnAppliedChanged(
      payload?.previous || {},
      payload?.current || {}
    )
      .catch(error => {
        console.error(
          'Failed to sync Twitch rewards after trigger change:',
          error
        );
      })
      .finally(() => {
        void refreshManagedRewardsConfig().catch(error => {
          console.error(
            'Failed to refresh managed Twitch rewards list:',
            error
          );
        });
      });

    return { success: true };
  }
);

events.On('addon:prepare-stop', async () => {
  try {
    await restoreFollowModeIfLifted();
  } catch (error) {
    console.error(
      'Failed to restore Twitch followers-only mode on prepare-stop:',
      error
    );
  }
  try {
    await syncRewardsOnPrepareStop();
  } catch (error) {
    console.error('Failed to sync Twitch rewards on prepare-stop:', error);
  }
  return { success: true };
});
