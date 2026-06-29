import { TwitchApi } from './api';
import {
  ensureScopes,
  getGrantedScopes,
  getMissingScopes,
  getRequiredScopes,
  registerScopeRequest,
} from './scopes';

type AddonRequestParams = {
  scopes?: string[];
  url?: string;
  body?: unknown;
};

type TwitchApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Parses a Twitch API proxy response body when possible.
 * @param body Raw response text from Twitch API.
 */
const parseProxyBody = (body: string): unknown => {
  if (!body.trim()) {
    return null;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
};

/**
 * Reads optional scope requirements from addon RPC params.
 * @param params Request payload from the calling addon.
 */
const readRequestedScopes = (params: AddonRequestParams | undefined): string[] => {
  if (!Array.isArray(params?.scopes)) {
    return [];
  }
  return [
    ...new Set(
      params.scopes
        .filter((scope): scope is string => typeof scope === 'string')
        .map(scope => scope.trim())
        .filter(Boolean)
    ),
  ];
};

/**
 * Handles proxied Twitch API requests from other addons.
 * @param method HTTP method used for the Twitch API call.
 * @param fromAddonId Calling addon manifest id.
 * @param params Request payload with URL, optional body, and optional scopes.
 */
const handleTwitchApiRequest = async (
  method: TwitchApiMethod,
  fromAddonId: string,
  params: AddonRequestParams | undefined
) => {
  const url = typeof params?.url === 'string' ? params.url.trim() : '';
  if (!url) {
    return { success: false, message: 'Missing url parameter' };
  }

  console.log(
    `[Twitch addon] API ${method} requested by addon "${fromAddonId}": ${url}`
  );

  if (!TwitchApi.accessToken) {
    return { success: false, message: 'Twitch is not authorized' };
  }

  const requiredScopes = readRequestedScopes(params);
  const missingScopes = ensureScopes(requiredScopes);
  if (missingScopes.length > 0) {
    return {
      success: false,
      message: `Missing Twitch scopes: ${missingScopes.join(', ')}`,
      missingScopes,
      reauthorizationRequested: true,
      grantedScopes: getGrantedScopes(),
      requiredScopes: getRequiredScopes(),
    };
  }

  const result = await TwitchApi.proxyTwitchApiRequest(
    method,
    url,
    params?.body
  );
  if (!result.ok) {
    return {
      success: false,
      message: result.message ?? 'Twitch API request failed',
      status: result.status,
      body: parseProxyBody(result.body),
    };
  }

  return {
    success: true,
    status: result.status,
    body: parseProxyBody(result.body),
  };
};

/**
 * Exposes Twitch channel metadata to other addons via `addons.request`.
 * @example
 * // From another addon:
 * const response = await addons.request('twitch', 'getChannelId');
 */
addons.onRequest('getChannelId', async ({ fromAddonId }) => {
  if (!TwitchApi.accessToken) {
    return {
      success: false,
      message: 'Twitch is not authorized',
      fromAddonId,
    };
  }

  const user = await TwitchApi.GetMe();
  if (!user?.id) {
    return {
      success: false,
      message: 'Twitch channel is unavailable',
      fromAddonId,
    };
  }

  return {
    channelId: user.id,
    username: user.login,
    login: user.login,
    displayName: user.display_name,
  };
});

/**
 * Returns scopes granted by the current Twitch token and the full required scope list.
 * @example
 * const { grantedScopes, requiredScopes } = await addons.request('twitch', 'getScopes');
 */
addons.onRequest('getScopes', async () => ({
  authorized: Boolean(TwitchApi.accessToken),
  grantedScopes: getGrantedScopes(),
  requiredScopes: getRequiredScopes(),
}));

/**
 * Registers additional OAuth scopes requested by another addon.
 * @example
 * await addons.request('twitch', 'addScopes', { scopes: ['clips:edit'] });
 */
addons.onRequest('addScopes', async ({ fromAddonId, params }) => {
  const requestParams = params as AddonRequestParams | undefined;
  const scopes = readRequestedScopes(requestParams);
  if (scopes.length === 0) {
    return {
      success: false,
      message: 'Missing scopes parameter',
    };
  }

  let addedAny = false;
  for (const scope of scopes) {
    const result = await registerScopeRequest(fromAddonId, scope);
    addedAny = addedAny || result.added;
  }

  const missingScopes = getMissingScopes(getRequiredScopes());
  return {
    success: true,
    added: addedAny,
    grantedScopes: getGrantedScopes(),
    requiredScopes: getRequiredScopes(),
    missingScopes,
    reauthorizationRequested: missingScopes.length > 0,
  };
});

addons.onRequest('apiGet', async ({ fromAddonId, params }) =>
  handleTwitchApiRequest('GET', fromAddonId, params as AddonRequestParams | undefined)
);

addons.onRequest('apiPost', async ({ fromAddonId, params }) =>
  handleTwitchApiRequest('POST', fromAddonId, params as AddonRequestParams | undefined)
);

addons.onRequest('apiPut', async ({ fromAddonId, params }) =>
  handleTwitchApiRequest('PUT', fromAddonId, params as AddonRequestParams | undefined)
);

addons.onRequest('apiDelete', async ({ fromAddonId, params }) =>
  handleTwitchApiRequest('DELETE', fromAddonId, params as AddonRequestParams | undefined)
);
