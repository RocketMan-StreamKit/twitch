import { CLIENT_ID, RegenerateConfig, SCOPES } from './config';
import { stopTwitchTracking } from './tracking';

events.On('twitchLogin', () => {
  const url = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=http://localhost:3000/addon/twitch/auth`;
  const response_type = 'token';
  const scope = SCOPES.join(' ');
  const fullUrl = `${url}&response_type=${response_type}&scope=${scope}`;
  api.openUrl(fullUrl);
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
      'Authorization successful. You can close this window.'
    ),
  };
});
