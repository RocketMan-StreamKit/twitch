import { CLIENT_ID } from './config';
import { EVENTSUB_TYPES } from './constants';

export type TwitchBroadcaster = {
  id: string;
  login: string;
  display_name: string;
};

export type TwitchChatBadgeVersion = {
  id: string;
  image_url_1x: string;
  image_url_2x?: string;
  image_url_4x?: string;
  title?: string;
  info?: string;
};

export type TwitchChatBadgeSet = {
  set_id: string;
  versions: TwitchChatBadgeVersion[];
};

export type TwitchChatEmoteImages = {
  url_1x?: string;
  url_2x?: string;
  url_4x?: string;
};

export type TwitchChatEmote = {
  id: string;
  name: string;
  images?: TwitchChatEmoteImages;
};

export type TwitchCustomReward = {
  id: string;
  title: string;
  cost: number;
  is_enabled: boolean;
};

export const TwitchApi = new (class {
  accessToken: string | null = null;

  private authHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Client-ID': CLIENT_ID,
      'Content-Type': 'application/json',
    };
  }

  async validateTokenScopes(required: readonly string[]): Promise<boolean> {
    const accessToken = this.accessToken;
    if (!accessToken) {
      return false;
    }

    try {
      const response = await network.request.get(
        'https://id.twitch.tv/oauth2/validate',
        { Authorization: `OAuth ${accessToken}` }
      );
      const data = JSON.parse(response) as {
        scopes?: string[];
        status?: number;
        message?: string;
      };
      if (data.status && data.status >= 400) {
        console.warn(
          'Twitch token validation failed:',
          data.message ?? response
        );
        return false;
      }
      const granted = new Set(data.scopes ?? []);
      const missing = required.filter(scope => !granted.has(scope));
      if (missing.length > 0) {
        console.warn('Twitch token missing scopes:', missing.join(', '));
        return false;
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async GetUserProfileImage(userId: string): Promise<string | null> {
    const accessToken = this.accessToken;
    if (!accessToken || !userId) {
      return null;
    }

    try {
      const response = await network.request.get(
        `https://api.twitch.tv/helix/users?id=${encodeURIComponent(userId)}`,
        {
          Authorization: `Bearer ${accessToken}`,
          'Client-ID': CLIENT_ID,
        }
      );
      const data = JSON.parse(response) as {
        data?: { profile_image_url?: string }[];
      };
      const url = data.data?.[0]?.profile_image_url?.trim();
      return url || null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private parseHelixBody<T extends Record<string, unknown>>(
    response: string,
    fallbackMessage: string
  ): { ok: true; body: T } | { ok: false; message: string } {
    if (!response?.trim()) {
      return { ok: false, message: fallbackMessage };
    }

    let body: T;
    try {
      body = JSON.parse(response) as T;
    } catch {
      return { ok: false, message: fallbackMessage };
    }

    const errorBody = body as {
      error?: string;
      status?: number;
      message?: string;
    };
    if (
      errorBody.error ||
      (typeof errorBody.status === 'number' && errorBody.status >= 400)
    ) {
      return {
        ok: false,
        message: errorBody.message || errorBody.error || fallbackMessage,
      };
    }

    return { ok: true, body };
  }

  async GetMe(): Promise<TwitchBroadcaster | null> {
    const accessToken = this.accessToken;
    if (!accessToken) {
      return null;
    }

    try {
      const response = await network.request.get(
        'https://api.twitch.tv/helix/users',
        {
          Authorization: `Bearer ${accessToken}`,
          'Client-ID': CLIENT_ID,
        }
      );
      const parsed = this.parseHelixBody<{
        data?: { id: string; login: string; display_name: string }[];
      }>(response, 'Failed to resolve Twitch user');
      if (!parsed.ok) {
        console.error(parsed.message);
        return null;
      }

      const user = parsed.body.data?.[0];
      if (!user) {
        return null;
      }
      return {
        id: user.id,
        login: user.login,
        display_name: user.display_name,
      };
    } catch (error) {
      console.error('Failed to resolve Twitch user:', error);
      return null;
    }
  }

  async GetGlobalChatBadges(): Promise<TwitchChatBadgeSet[]> {
    const accessToken = this.accessToken;
    if (!accessToken) {
      return [];
    }

    try {
      const response = await network.request.get(
        'https://api.twitch.tv/helix/chat/badges/global',
        this.authHeaders()
      );

      const parsed = JSON.parse(response) as {
        data?: TwitchChatBadgeSet[];
        badge_sets?: TwitchChatBadgeSet[];
      };

      const sets = parsed.data ?? parsed.badge_sets ?? [];
      return Array.isArray(sets) ? sets : [];
    } catch (error) {
      console.error('Failed to fetch Twitch global chat badges:', error);
      return [];
    }
  }

  async GetChannelChatBadges(
    broadcasterId: string
  ): Promise<TwitchChatBadgeSet[]> {
    const accessToken = this.accessToken;
    if (!accessToken || !broadcasterId) {
      return [];
    }

    try {
      const response = await network.request.get(
        `https://api.twitch.tv/helix/chat/badges?broadcaster_id=${encodeURIComponent(
          broadcasterId
        )}`,
        this.authHeaders()
      );

      const parsed = JSON.parse(response) as {
        data?: TwitchChatBadgeSet[];
        badge_sets?: TwitchChatBadgeSet[];
      };

      const sets = parsed.data ?? parsed.badge_sets ?? [];
      return Array.isArray(sets) ? sets : [];
    } catch (error) {
      console.error('Failed to fetch Twitch channel chat badges:', error);
      return [];
    }
  }

  async GetGlobalChatEmotes(): Promise<TwitchChatEmote[]> {
    const accessToken = this.accessToken;
    if (!accessToken) {
      return [];
    }

    try {
      const response = await network.request.get(
        'https://api.twitch.tv/helix/chat/emotes/global',
        this.authHeaders()
      );
      const parsed = JSON.parse(response) as {
        data?: TwitchChatEmote[];
        emotes?: TwitchChatEmote[];
      };
      const emotes = parsed.data ?? parsed.emotes ?? [];
      return Array.isArray(emotes) ? emotes : [];
    } catch (error) {
      console.error('Failed to fetch Twitch global chat emotes:', error);
      return [];
    }
  }

  async GetChannelChatEmotes(
    broadcasterId: string
  ): Promise<TwitchChatEmote[]> {
    const accessToken = this.accessToken;
    if (!accessToken || !broadcasterId) {
      return [];
    }

    try {
      const response = await network.request.get(
        `https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${encodeURIComponent(
          broadcasterId
        )}`,
        this.authHeaders()
      );
      const parsed = JSON.parse(response) as {
        data?: TwitchChatEmote[];
        emotes?: TwitchChatEmote[];
      };
      const emotes = parsed.data ?? parsed.emotes ?? [];
      return Array.isArray(emotes) ? emotes : [];
    } catch (error) {
      console.error('Failed to fetch Twitch channel chat emotes:', error);
      return [];
    }
  }

  async createEventSubSubscriptions(
    sessionId: string,
    broadcasterId: string
  ): Promise<void> {
    for (const spec of EVENTSUB_TYPES) {
      try {
        const response = await network.request.post(
          'https://api.twitch.tv/helix/eventsub/subscriptions',
          {
            type: spec.type,
            version: spec.version,
            condition: spec.condition(broadcasterId),
            transport: {
              method: 'websocket',
              session_id: sessionId,
            },
          },
          this.authHeaders()
        );
        const parsed = JSON.parse(response) as {
          data?: { id: string }[];
          error?: string;
          message?: string;
          status?: number;
        };
        if (parsed.error || parsed.status) {
          console.error(
            `EventSub subscribe rejected (${spec.type}):`,
            parsed.message ?? parsed.error ?? response
          );
        }
      } catch (error) {
        console.error(`EventSub subscribe failed (${spec.type}):`, error);
      }
    }
  }

  async SendChatMessage(
    message: string,
    broadcasterId: string,
    senderId: string
  ): Promise<boolean> {
    const accessToken = this.accessToken;
    if (!accessToken || !message.trim() || !broadcasterId || !senderId) {
      return false;
    }

    try {
      const response = await network.request.post(
        'https://api.twitch.tv/helix/chat/messages',
        {
          broadcaster_id: broadcasterId,
          sender_id: senderId,
          message: message.trim(),
        },
        this.authHeaders()
      );
      const parsed = JSON.parse(response) as {
        data?: { is_sent?: boolean; drop_reason?: { message?: string } }[];
        error?: string;
        message?: string;
        status?: number;
      };
      if (parsed.error || parsed.status) {
        console.error(
          'Twitch send chat message failed:',
          parsed.message ?? parsed.error ?? response
        );
        return false;
      }
      const result = parsed.data?.[0];
      if (result?.is_sent === false) {
        console.warn(
          'Twitch chat message was not sent:',
          result.drop_reason?.message ?? 'unknown reason'
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to send Twitch chat message:', error);
      return false;
    }
  }

  async ListCustomRewards(): Promise<{
    success: boolean;
    rewards: TwitchCustomReward[];
    message?: string;
  }> {
    const accessToken = this.accessToken;
    if (!accessToken) {
      return {
        success: false,
        rewards: [],
        message: 'Twitch is not authorized',
      };
    }

    const broadcaster = await this.GetMe();
    if (!broadcaster) {
      return {
        success: false,
        rewards: [],
        message: 'Twitch channel not found',
      };
    }

    const rewards: TwitchCustomReward[] = [];
    let cursor: string | undefined;

    try {
      do {
        const query = new URLSearchParams({
          broadcaster_id: broadcaster.id,
        });
        if (cursor) {
          query.set('after', cursor);
        }

        const response = await network.request.get(
          `https://api.twitch.tv/helix/channel_points/custom_rewards?${query}`,
          this.authHeaders()
        );
        const parsed = this.parseHelixBody<{
          data?: TwitchCustomReward[];
          pagination?: { cursor?: string };
        }>(response, 'Failed to load Twitch rewards');

        if (!parsed.ok) {
          return { success: false, rewards: [], message: parsed.message };
        }

        for (const item of parsed.body.data ?? []) {
          if (item?.id && item?.title) {
            rewards.push(item);
          }
        }
        cursor = parsed.body.pagination?.cursor;
      } while (cursor);

      return { success: true, rewards };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load Twitch rewards';
      console.error('Failed to list Twitch custom rewards:', message);
      return { success: false, rewards: [], message };
    }
  }

  async CreateCustomReward(
    title: string,
    cost = 1
  ): Promise<{
    success: boolean;
    reward?: TwitchCustomReward;
    message?: string;
  }> {
    const accessToken = this.accessToken;
    if (!accessToken) {
      return { success: false, message: 'Twitch is not authorized' };
    }

    const broadcaster = await this.GetMe();
    if (!broadcaster) {
      return { success: false, message: 'Twitch channel not found' };
    }

    const trimmedTitle = title.trim().slice(0, 45);
    if (!trimmedTitle) {
      return { success: false, message: 'Reward title is required' };
    }

    try {
      const response = await network.request.post(
        'https://api.twitch.tv/helix/channel_points/custom_rewards',
        {
          broadcaster_id: broadcaster.id,
          title: trimmedTitle,
          cost: Math.max(1, Math.floor(cost)),
          is_user_input_required: false,
          is_enabled: true,
        },
        this.authHeaders()
      );
      const parsed = this.parseHelixBody<{ data?: TwitchCustomReward[] }>(
        response,
        'Failed to create Twitch reward'
      );
      if (!parsed.ok) {
        return { success: false, message: parsed.message };
      }

      const reward = parsed.body.data?.[0];
      if (!reward?.id) {
        return { success: false, message: 'Twitch did not return reward id' };
      }

      return { success: true, reward };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create Twitch reward';
      console.error('Failed to create Twitch custom reward:', message);
      return { success: false, message };
    }
  }

  async DeleteCustomReward(rewardId: string): Promise<boolean> {
    const accessToken = this.accessToken;
    if (!accessToken || !rewardId) {
      return false;
    }

    const broadcaster = await this.GetMe();
    if (!broadcaster) {
      return false;
    }

    try {
      await network.request.delete(
        `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(
          broadcaster.id
        )}&id=${encodeURIComponent(rewardId)}`,
        this.authHeaders()
      );
      return true;
    } catch (error) {
      console.error('Failed to delete Twitch custom reward:', error);
      return false;
    }
  }

  async clearWebSocketEventSubSubscriptions(): Promise<void> {
    if (!this.accessToken) {
      return;
    }

    let cursor: string | undefined;
    do {
      const query = cursor
        ? `?transport_method=websocket&after=${cursor}`
        : '?transport_method=websocket';
      let response: string;
      try {
        response = await network.request.get(
          `https://api.twitch.tv/helix/eventsub/subscriptions${query}`,
          {
            Authorization: `Bearer ${this.accessToken}`,
            'Client-ID': CLIENT_ID,
          }
        );
      } catch (error) {
        console.error(error);
        return;
      }

      let parsed: {
        data: { id: string }[];
        pagination?: { cursor?: string };
      };
      try {
        parsed = JSON.parse(response);
      } catch (error) {
        console.error(error);
        return;
      }

      for (const sub of parsed.data) {
        try {
          await network.request.delete(
            `https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`,
            this.authHeaders()
          );
        } catch (error) {
          console.error(error);
        }
      }

      cursor = parsed.pagination?.cursor;
    } while (cursor);
  }
})();
