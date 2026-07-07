import { RegenerateConfig } from './config';
import {
  openTwitchAuthorization,
  openTwitchBotAuthorization,
  setReauthorizationHandler,
} from './scopes';
import { stopTwitchTracking } from './tracking';

setReauthorizationHandler(() => {
  openTwitchAuthorization();
});

const AUTH_SUCCESS_MESSAGE = {
  en: 'Authorization successful. You can close this window.',
  ru: 'Авторизация прошла успешно. Можно закрыть это окно.',
  uk: 'Авторизація успішна. Можна закрити це вікно.',
} as const;

events.On('twitchLogin', () => {
  openTwitchAuthorization();
});

events.On('twitchBotLogin', () => {
  openTwitchBotAuthorization();
});

events.On('twitchLogout', async () => {
  stopTwitchTracking();
  await api.config.updateParams({ access_token: '' });
  RegenerateConfig();
});

events.On('twitchBotLogout', async () => {
  await api.config.updateParams({ bot_access_token: '' });
  RegenerateConfig();
});

network.endpoints.create('auth', 'GET', 'authCallback');

events.On('authCallback', ({ query }) => {
  if (!query.access_token) {
    const html = `<html>
      <body>Redirecting...</body>
      <script>
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const state = params.get('state');
        let target = 'http://localhost:3000/addon/twitch/auth?access_token=' + encodeURIComponent(accessToken || '');
        if (state) {
          target += '&state=' + encodeURIComponent(state);
        }
        location.href = target;
      </script>
    </html>`;
    return html;
  }

  const isBotAuth = query.state === 'bot';
  const tokenKey = isBotAuth ? 'bot_access_token' : 'access_token';

  void api.config.updateParams({ [tokenKey]: query.access_token }).then(() => {
    RegenerateConfig();
  });

  return {
    redirect: ui.auth.generateSuccess(
      AUTH_SUCCESS_MESSAGE[LANG.current] ?? AUTH_SUCCESS_MESSAGE.en
    ),
  };
});
