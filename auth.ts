import { RegenerateConfig } from './config';
import {
  openTwitchAuthorization,
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

events.On('twitchLogout', async () => {
  stopTwitchTracking();
  await api.config.updateParams({ access_token: '' });
  RegenerateConfig();
});

network.endpoints.create('auth', 'GET', 'authCallback');

events.On('authCallback', ({ query }) => {
  if (!query.access_token) {
    const html = `<html>
      <body>Redirecting...</body>
      <script>
        const hash = window.location.hash.substring(1); // убираем #
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        location.href = 'http://localhost:3000/addon/twitch/auth?access_token=' + accessToken;
      </script>
    </html>`;
    return html;
  }

  void api.config
    .updateParams({ access_token: query.access_token })
    .then(() => {
      RegenerateConfig();
    });

  return {
    redirect: ui.auth.generateSuccess(
      AUTH_SUCCESS_MESSAGE[LANG.current] ?? AUTH_SUCCESS_MESSAGE.en
    ),
  };
});
