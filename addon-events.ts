/**
 * Normalized poll choice for addon-to-addon poll events.
 */
export type PollAddonChoice = {
  /** Choice id from Twitch. */
  id: string;
  /** Choice title shown to viewers. */
  title: string;
  /** Total votes (bits + channel points + free) when present. */
  votes?: number;
  /** Votes cast with Bits when present. */
  bits_votes?: number;
  /** Votes cast with Channel Points when present. */
  channel_points_votes?: number;
};

/**
 * Normalized poll payload emitted to other addons.
 */
export type PollAddonEvent = {
  /** Twitch poll id. */
  id: string;
  /** Poll question / title. */
  title: string;
  /** Poll choices (with vote counts when available). */
  choices: PollAddonChoice[];
  /** End status (`completed`, `terminated`, `archived`) when the poll ended. */
  status?: string;
  /** ISO timestamp when the poll started. */
  started_at?: string;
  /** ISO timestamp when the poll is scheduled to end. */
  ends_at?: string;
  /** ISO timestamp when the poll ended. */
  ended_at?: string;
  /** Bits voting settings from EventSub when present. */
  bits_voting?: { is_enabled: boolean; amount_per_vote: number };
  /** Channel Points voting settings from EventSub when present. */
  channel_points_voting?: { is_enabled: boolean; amount_per_vote: number };
};

/**
 * Top predictor entry on a prediction outcome.
 */
export type PredictionTopPredictor = {
  /** Twitch user id. */
  user_id: string;
  /** Twitch login. */
  user_login: string;
  /** Twitch display name. */
  user_name: string;
  /** Channel Points spent on this outcome. */
  channel_points_used: number;
  /** Channel Points won after resolution; `null` while unresolved. */
  channel_points_won: number | null;
};

/**
 * Normalized prediction outcome for addon-to-addon prediction events.
 */
export type PredictionAddonOutcome = {
  /** Outcome id from Twitch. */
  id: string;
  /** Outcome title. */
  title: string;
  /** Twitch color (`blue` | `pink`) when present. */
  color?: string;
  /** Number of users who predicted this outcome when present. */
  users?: number;
  /** Total Channel Points on this outcome when present. */
  channel_points?: number;
  /** Up to 10 top predictors when present. */
  top_predictors?: PredictionTopPredictor[];
};

/**
 * Normalized prediction payload emitted to other addons.
 */
export type PredictionAddonEvent = {
  /** Twitch prediction id. */
  id: string;
  /** Prediction title. */
  title: string;
  /** Prediction outcomes. */
  outcomes: PredictionAddonOutcome[];
  /** Winning outcome id when the prediction ended with a winner. */
  winning_outcome_id?: string;
  /** End status (`resolved`, `canceled`, …) when present. */
  status?: string;
  /** ISO timestamp when the prediction started. */
  started_at?: string;
  /** ISO timestamp when betting locks (begin/progress). */
  locks_at?: string;
  /** ISO timestamp when the prediction was locked. */
  locked_at?: string;
  /** ISO timestamp when the prediction ended. */
  ended_at?: string;
};

/** Addon event names for channel poll lifecycle. */
export type PollAddonEventName = 'pollBegin' | 'pollProgress' | 'pollEnd';

/** Addon event names for channel prediction lifecycle. */
export type PredictionAddonEventName =
  | 'predictionBegin'
  | 'predictionProgress'
  | 'predictionLock'
  | 'predictionEnd';

/**
 * Parses optional Bits / Channel Points voting settings from an EventSub object.
 * @param value Raw EventSub voting settings object.
 * @returns Normalized settings or `undefined` when the shape is invalid.
 * @example
 * parseVotingSettings({ is_enabled: true, amount_per_vote: 10 });
 */
const parseVotingSettings = (
  value: unknown
): { is_enabled: boolean; amount_per_vote: number } | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const item = value as Record<string, unknown>;
  if (
    typeof item.is_enabled !== 'boolean' ||
    typeof item.amount_per_vote !== 'number'
  ) {
    return undefined;
  }
  return {
    is_enabled: item.is_enabled,
    amount_per_vote: item.amount_per_vote,
  };
};

/**
 * Builds a normalized poll payload for `addons.emit` from a Twitch EventSub event.
 * @param event Raw `channel.poll.*` EventSub event object.
 * @returns Normalized poll payload, or `null` when required fields are missing.
 * @example
 * const poll = buildPollAddonEvent(eventSubPayload);
 * if (poll) await emitPollEvent('pollBegin', poll);
 */
export const buildPollAddonEvent = (
  event: Record<string, unknown>
): PollAddonEvent | null => {
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
      const item = choice as Record<string, unknown>;
      const normalized: PollAddonChoice = {
        id: item.id as string,
        title: item.title as string,
      };
      if (typeof item.votes === 'number') {
        normalized.votes = item.votes;
      }
      if (typeof item.bits_votes === 'number') {
        normalized.bits_votes = item.bits_votes;
      }
      if (typeof item.channel_points_votes === 'number') {
        normalized.channel_points_votes = item.channel_points_votes;
      }
      return normalized;
    });

  if (choices.length === 0) {
    return null;
  }

  const payload: PollAddonEvent = {
    id: event.id,
    title: event.title,
    choices,
  };

  if (typeof event.status === 'string') {
    payload.status = event.status;
  }
  if (typeof event.started_at === 'string') {
    payload.started_at = event.started_at;
  }
  if (typeof event.ends_at === 'string') {
    payload.ends_at = event.ends_at;
  }
  if (typeof event.ended_at === 'string') {
    payload.ended_at = event.ended_at;
  }

  const bitsVoting = parseVotingSettings(event.bits_voting);
  if (bitsVoting) {
    payload.bits_voting = bitsVoting;
  }
  const channelPointsVoting = parseVotingSettings(event.channel_points_voting);
  if (channelPointsVoting) {
    payload.channel_points_voting = channelPointsVoting;
  }

  return payload;
};

/**
 * Parses top predictors from a prediction outcome.
 * @param value Raw `top_predictors` array from EventSub.
 * @returns Normalized top predictors, or `undefined` when empty/invalid.
 * @example
 * parseTopPredictors(outcome.top_predictors);
 */
const parseTopPredictors = (
  value: unknown
): PredictionTopPredictor[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const predictors = value
    .filter(entry => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }
      const item = entry as Record<string, unknown>;
      const userId =
        typeof item.user_id === 'string' || typeof item.user_id === 'number'
          ? String(item.user_id)
          : '';
      return (
        userId.length > 0 &&
        typeof item.user_login === 'string' &&
        typeof item.user_name === 'string' &&
        typeof item.channel_points_used === 'number'
      );
    })
    .map(entry => {
      const item = entry as Record<string, unknown>;
      return {
        user_id: String(item.user_id),
        user_login: item.user_login as string,
        user_name: item.user_name as string,
        channel_points_used: item.channel_points_used as number,
        channel_points_won:
          typeof item.channel_points_won === 'number'
            ? item.channel_points_won
            : null,
      };
    });

  return predictors.length > 0 ? predictors : undefined;
};

/**
 * Builds a normalized prediction payload for `addons.emit` from a Twitch EventSub event.
 * @param event Raw `channel.prediction.*` EventSub event object.
 * @returns Normalized prediction payload, or `null` when required fields are missing.
 * @example
 * const prediction = buildPredictionAddonEvent(eventSubPayload);
 * if (prediction) await emitPredictionEvent('predictionBegin', prediction);
 */
export const buildPredictionAddonEvent = (
  event: Record<string, unknown>
): PredictionAddonEvent | null => {
  if (
    typeof event.id !== 'string' ||
    typeof event.title !== 'string' ||
    !Array.isArray(event.outcomes)
  ) {
    return null;
  }

  const outcomes = (event.outcomes as unknown[])
    .filter(outcome => {
      if (!outcome || typeof outcome !== 'object') {
        return false;
      }
      const item = outcome as Record<string, unknown>;
      return typeof item.id === 'string' && typeof item.title === 'string';
    })
    .map(outcome => {
      const item = outcome as Record<string, unknown>;
      const normalized: PredictionAddonOutcome = {
        id: item.id as string,
        title: item.title as string,
      };
      if (typeof item.color === 'string') {
        normalized.color = item.color;
      }
      if (typeof item.users === 'number') {
        normalized.users = item.users;
      }
      if (typeof item.channel_points === 'number') {
        normalized.channel_points = item.channel_points;
      }
      const topPredictors = parseTopPredictors(item.top_predictors);
      if (topPredictors) {
        normalized.top_predictors = topPredictors;
      }
      return normalized;
    });

  if (outcomes.length === 0) {
    return null;
  }

  const payload: PredictionAddonEvent = {
    id: event.id,
    title: event.title,
    outcomes,
  };

  if (typeof event.winning_outcome_id === 'string') {
    payload.winning_outcome_id = event.winning_outcome_id;
  }
  if (typeof event.status === 'string') {
    payload.status = event.status;
  }
  if (typeof event.started_at === 'string') {
    payload.started_at = event.started_at;
  }
  if (typeof event.locks_at === 'string') {
    payload.locks_at = event.locks_at;
  }
  if (typeof event.locked_at === 'string') {
    payload.locked_at = event.locked_at;
  }
  if (typeof event.ended_at === 'string') {
    payload.ended_at = event.ended_at;
  }

  return payload;
};

/**
 * Emits a poll lifecycle event to other addons via `addons.emit`.
 * @param event Event name (`pollBegin`, `pollProgress`, or `pollEnd`).
 * @param data Normalized poll payload.
 * @example
 * await emitPollEvent('pollBegin', {
 *   id: '1243456',
 *   title: 'Vote now',
 *   choices: [{ id: '1', title: 'Yes' }, { id: '2', title: 'No' }],
 * });
 */
export const emitPollEvent = async (
  event: PollAddonEventName,
  data: PollAddonEvent
): Promise<void> => {
  try {
    await addons.emit(event, data);
  } catch (error) {
    console.error(`Failed to emit Twitch ${event}:`, error);
  }
};

/**
 * Emits a prediction lifecycle event to other addons via `addons.emit`.
 * @param event Event name (`predictionBegin`, `predictionProgress`, `predictionLock`, or `predictionEnd`).
 * @param data Normalized prediction payload.
 * @example
 * await emitPredictionEvent('predictionBegin', {
 *   id: '1243456',
 *   title: 'Will they win?',
 *   outcomes: [
 *     { id: '1', title: 'Yes', color: 'blue' },
 *     { id: '2', title: 'No', color: 'pink' },
 *   ],
 * });
 */
export const emitPredictionEvent = async (
  event: PredictionAddonEventName,
  data: PredictionAddonEvent
): Promise<void> => {
  try {
    await addons.emit(event, data);
  } catch (error) {
    console.error(`Failed to emit Twitch ${event}:`, error);
  }
};
