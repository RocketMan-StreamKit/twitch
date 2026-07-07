import { CLIENT_ID } from './constants';

/** Scopes required by the Twitch addon itself (EventSub, IRC chat, rewards). */
export const SCOPES = [
  'user:read:email',
  'user:read:chat',
  'user:write:chat',
  'channel:read:subscriptions',
  'channel:read:redemptions',
  'channel:manage:redemptions',
  'bits:read',
  'moderator:read:followers',
  'moderator:read:chat_messages',
  'moderator:read:chatters',
  'moderator:read:banned_users',
  'moderator:read:chat_settings',
  'moderator:read:blocked_terms',
  'moderator:read:unban_requests',
  'moderator:read:warnings',
  'moderator:read:moderators',
  'moderator:read:vips',
  'channel:read:polls',
  'moderator:read:shoutouts',
] as const;

/** OAuth scopes required for the optional bot account (chat send only). */
export const BOT_SCOPES = ['user:write:chat'] as const;

const CONFIG_KEY = 'addon_requested_scopes';
const SCOPE_PATTERN = /^[a-z0-9:_-]+$/i;

type AddonRequestedScopes = Record<string, string[]>;

let grantedScopes: string[] = [];
let addonRequestedScopes: AddonRequestedScopes = {};
let hadAuthorization = false;
let reauthScheduled = false;
let reauthorizationHandler: (() => void) | null = null;

/**
 * Registers a callback that opens Twitch OAuth in the browser.
 * @param handler Opens the authorization URL with the current required scope list.
 */
export const setReauthorizationHandler = (handler: () => void): void => {
  reauthorizationHandler = handler;
};

/**
 * Marks whether the user had a stored access token before scope checks.
 * @param value True when an access token was present at startup or after login.
 */
export const setHadAuthorization = (value: boolean): void => {
  hadAuthorization = value;
};

/**
 * Returns scopes currently granted by the stored OAuth token.
 */
export const getGrantedScopes = (): string[] => [...grantedScopes];

/**
 * Returns the full scope list used for OAuth (base addon scopes plus requests from other addons).
 */
export const getRequiredScopes = (): string[] => {
  const merged = new Set<string>(SCOPES);
  for (const scopes of Object.values(addonRequestedScopes)) {
    for (const scope of scopes) {
      merged.add(scope);
    }
  }
  return [...merged];
};

/**
 * Returns scopes requested by a specific addon via `addScopes`.
 * @param addonId Requesting addon manifest id.
 */
export const getAddonRequestedScopes = (addonId: string): string[] => [
  ...(addonRequestedScopes[addonId] ?? []),
];

/**
 * Loads persisted scope requests from addon config.
 */
export const loadPersistedScopeRequests = async (): Promise<void> => {
  const params = await api.config.getParams();
  const raw = params[CONFIG_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    addonRequestedScopes = {};
    return;
  }

  const parsed: AddonRequestedScopes = {};
  for (const [addonId, scopes] of Object.entries(
    raw as Record<string, unknown>
  )) {
    if (!addonId.trim() || !Array.isArray(scopes)) {
      continue;
    }
    const normalized = scopes
      .filter((scope): scope is string => typeof scope === 'string')
      .map(scope => scope.trim())
      .filter(scope => scope.length > 0 && SCOPE_PATTERN.test(scope));
    if (normalized.length > 0) {
      parsed[addonId.trim()] = [...new Set(normalized)];
    }
  }
  addonRequestedScopes = parsed;
};

/**
 * Persists addon scope requests to config storage.
 */
const persistScopeRequests = async (): Promise<void> => {
  await api.config.updateParams({ [CONFIG_KEY]: addonRequestedScopes });
};

/**
 * Updates cached granted scopes from a Twitch token validation response.
 * @param scopes Scope strings returned by `https://id.twitch.tv/oauth2/validate`.
 */
export const setGrantedScopes = (scopes: readonly string[]): void => {
  grantedScopes = [
    ...new Set(scopes.map(scope => scope.trim()).filter(Boolean)),
  ];
};

/**
 * Returns scopes from `required` that are not present on the current token.
 * @param required Scope names to check against the cached granted list.
 */
export const getMissingScopes = (required: readonly string[]): string[] => {
  const granted = new Set(grantedScopes);
  return required.filter(scope => !granted.has(scope));
};

/**
 * Opens Twitch OAuth when scopes are missing and the user was previously authorized.
 * @param missing Scope names that triggered re-authorization.
 */
export const requestReauthorizationIfNeeded = (
  missing: readonly string[]
): boolean => {
  if (!hadAuthorization || missing.length === 0 || !reauthorizationHandler) {
    return false;
  }

  if (reauthScheduled) {
    return true;
  }

  reauthScheduled = true;
  console.warn(
    `[Twitch addon] Missing scopes (${missing.join(', ')}). Opening Twitch authorization.`
  );
  reauthorizationHandler();
  setTimeout(() => {
    reauthScheduled = false;
  }, 2000);
  return true;
};

/**
 * Builds the implicit-grant Twitch OAuth URL for the main account.
 */
export const buildTwitchAuthorizationUrl = (): string => {
  const baseUrl =
    'https://id.twitch.tv/oauth2/authorize' +
    `?client_id=${CLIENT_ID}` +
    '&redirect_uri=http://localhost:3000/addon/twitch/auth' +
    '&response_type=token' +
    '&state=main' +
    `&scope=${encodeURIComponent(getRequiredScopes().join(' '))}`;
  return baseUrl;
};

/**
 * Builds the implicit-grant Twitch OAuth URL for the optional bot account.
 */
export const buildTwitchBotAuthorizationUrl = (): string => {
  const baseUrl =
    'https://id.twitch.tv/oauth2/authorize' +
    `?client_id=${CLIENT_ID}` +
    '&redirect_uri=http://localhost:3000/addon/twitch/auth' +
    '&response_type=token' +
    '&state=bot' +
    `&scope=${encodeURIComponent(BOT_SCOPES.join(' '))}`;
  return baseUrl;
};

/**
 * Opens Twitch OAuth in the system browser for the main account.
 */
export const openTwitchAuthorization = (): void => {
  api.openUrl(buildTwitchAuthorizationUrl());
};

/**
 * Opens Twitch OAuth in the system browser for the bot account.
 */
export const openTwitchBotAuthorization = (): void => {
  api.openUrl(buildTwitchBotAuthorizationUrl());
};

/**
 * Registers a scope request from another addon and persists it for future OAuth flows.
 * @param fromAddonId Addon manifest id that requested the scope.
 * @param scope Twitch OAuth scope name.
 * @returns True when the scope was newly added for that addon.
 */
export const registerScopeRequest = async (
  fromAddonId: string,
  scope: string
): Promise<{ added: boolean; missing: string[] }> => {
  const addonId = fromAddonId.trim();
  const normalizedScope = scope.trim();
  if (!addonId || !normalizedScope || !SCOPE_PATTERN.test(normalizedScope)) {
    return { added: false, missing: getMissingScopes([normalizedScope]) };
  }

  console.log(
    `[Twitch addon] Scope "${normalizedScope}" requested by addon "${addonId}"`
  );

  const current = new Set(addonRequestedScopes[addonId] ?? []);
  const added = !current.has(normalizedScope);
  current.add(normalizedScope);
  addonRequestedScopes[addonId] = [...current];
  await persistScopeRequests();

  const missing = getMissingScopes(getRequiredScopes());
  requestReauthorizationIfNeeded(missing);

  return { added, missing };
};

/**
 * Ensures the token includes the given scopes; may trigger re-authorization.
 * @param scopes Required scope names for the upcoming API call.
 * @returns Missing scopes after optional re-authorization was requested.
 */
export const ensureScopes = (
  scopes: readonly string[] | undefined
): string[] => {
  const required = scopes?.length ? scopes : [];
  const missing = getMissingScopes(required);
  requestReauthorizationIfNeeded(missing);
  return missing;
};
