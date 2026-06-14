type ModerationUser = {
  user_id: string;
  user_login: string;
  user_name: string;
  reason?: string;
  expires_at?: string;
  message_body?: string;
  message_id?: string;
};

const parseModerationUser = (payload: unknown): ModerationUser | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const value = payload as Record<string, unknown>;
  if (
    typeof value.user_id !== 'string' ||
    typeof value.user_login !== 'string' ||
    typeof value.user_name !== 'string'
  ) {
    return null;
  }

  return {
    user_id: value.user_id,
    user_login: value.user_login,
    user_name: value.user_name,
    reason: typeof value.reason === 'string' ? value.reason : undefined,
    expires_at: typeof value.expires_at === 'string' ? value.expires_at : undefined,
    message_body:
      typeof value.message_body === 'string' ? value.message_body : undefined,
    message_id: typeof value.message_id === 'string' ? value.message_id : undefined,
  };
};

const readNestedNumber = (
  payload: unknown,
  key: string
): number | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : undefined;
};

export const buildModerationFeedEvent = (event: Record<string, unknown>) => {
  const action = typeof event.action === 'string' ? event.action : '';
  if (
    !action ||
    typeof event.moderator_user_name !== 'string' ||
    typeof event.moderator_user_login !== 'string'
  ) {
    return null;
  }

  const payload = event[action];
  let user = parseModerationUser(payload);

  if (!user && action === 'warn') {
    user = parseModerationUser(event.warn);
  }

  if (
    !user &&
    (action === 'approve_unban_request' || action === 'deny_unban_request')
  ) {
    user = parseModerationUser(event.unban_request);
  }

  const unbanRequest =
    event.unban_request && typeof event.unban_request === 'object'
      ? (event.unban_request as Record<string, unknown>)
      : null;

  return {
    action,
    moderator_user_name: event.moderator_user_name,
    moderator_user_login: event.moderator_user_login,
    user,
    follow_duration_minutes: readNestedNumber(event.followers, 'follow_duration_minutes'),
    wait_time_seconds: readNestedNumber(event.slow, 'wait_time_seconds'),
    viewer_count: readNestedNumber(event.raid, 'viewer_count'),
    list:
      event.automod_terms &&
      typeof event.automod_terms === 'object' &&
      typeof (event.automod_terms as Record<string, unknown>).list === 'string'
        ? ((event.automod_terms as Record<string, unknown>).list as string)
        : undefined,
    automod_action:
      event.automod_terms &&
      typeof event.automod_terms === 'object' &&
      typeof (event.automod_terms as Record<string, unknown>).action === 'string'
        ? ((event.automod_terms as Record<string, unknown>).action as string)
        : undefined,
    moderator_message:
      unbanRequest && typeof unbanRequest.moderator_message === 'string'
        ? unbanRequest.moderator_message
        : undefined,
  };
};

export const buildPollFeedEvent = (event: Record<string, unknown>) => {
  if (
    typeof event.id !== 'string' ||
    typeof event.title !== 'string' ||
    !Array.isArray(event.choices)
  ) {
    return null;
  }

  const choices = (event.choices as unknown[])
    .filter(choice => {
      if (!choice || typeof choice !== 'object') {
        return false;
      }
      const item = choice as Record<string, unknown>;
      return typeof item.id === 'string' && typeof item.title === 'string';
    })
    .map(choice => {
      const item = choice as {
        id: string;
        title: string;
        votes?: unknown;
      };
      return {
        id: item.id,
        title: item.title,
        votes: typeof item.votes === 'number' ? item.votes : undefined,
      };
    });

  if (choices.length === 0) {
    return null;
  }

  return {
    id: event.id,
    title: event.title,
    choices,
    status: typeof event.status === 'string' ? event.status : undefined,
  };
};
