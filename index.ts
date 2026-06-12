import './auth';
import './requests';
import './overlay-trigger-values';
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
