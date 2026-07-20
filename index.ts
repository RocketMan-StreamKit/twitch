import './auth';
import './requests';
import './chat-triggers';
import './overlay-trigger-values';
import './reward-lifecycle-events';
import './trigger-validation';
import { RegenerateConfig } from './config';
import { PLATFORM } from './constants';
import { registerTwitchOverlayTriggers } from './triggers';

void dashboard.registerPlatform({
  id: PLATFORM,
  name: {
    en: 'Twitch',
    ru: 'Twitch',
    uk: 'Twitch',
  },
});

void registerTwitchOverlayTriggers();

status.OnClick(() => {
  api.restart();
});

RegenerateConfig();
