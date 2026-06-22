import { TwitchApi, TwitchBroadcaster } from './api';
import {
  getCurrentPinnedMessageId,
  schedulePinnedMessageRefresh,
} from './chat-monitor';
import { EVENTSUB_WS_URL } from './constants';
import {
  pushAutomaticRewardRedemption,
  pushBits,
  pushChatAnnouncementFromEventSub,
  pushChatFromEventSub,
  pushCustomRewardRedemption,
  pushFollow,
  pushModerationEvent,
  pushPollBegin,
  pushPollEnd,
  pushSubGift,
  pushSubRenewal,
  pushSubscribe,
  TwitchEventUser,
} from './dashboard-feed';
import { buildModerationFeedEvent, buildPollFeedEvent } from './moderation';
import { getSettings, reloadSettings } from './settings';
import { notifyConnectionStatus } from './status-notify';

type EventSubFrame = {
  metadata: {
    message_type: string;
    message_id?: string;
    subscription_type?: string;
  };
  payload: {
    session?: {
      id: string;
      reconnect_url?: string | null;
      keepalive_timeout_seconds?: number;
    };
    subscription?: { type: string };
    event?: Record<string, unknown>;
  };
};

type WsConnection = Awaited<ReturnType<(typeof network.websocket)['connect']>>;

const MAX_SEEN_EVENTSUB_MESSAGE_IDS = 500;

export class TwitchEventSubClient {
  private connection: WsConnection | null = null;
  private keepaliveTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingReconnectUrl: string | null = null;
  private oldConnection: WsConnection | null = null;
  private seenMessageIds = new Set<string>();
  private endedPollIds = new Set<string>();

  constructor(private broadcaster: TwitchBroadcaster) {}

  async start() {
    this.destroyed = false;
    await this.connect(EVENTSUB_WS_URL);
  }

  stop() {
    this.destroyed = true;
    this.clearKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.destroyConnection(this.connection);
    this.destroyConnection(this.oldConnection);
    this.connection = null;
    this.oldConnection = null;
  }

  private async connect(url: string, isReconnect = false) {
    if (this.destroyed) {
      return;
    }

    try {
      const ws = await network.websocket.connect(url, {});
      if (this.destroyed) {
        ws.Destroy();
        return;
      }

      if (isReconnect && this.connection) {
        this.oldConnection = this.connection;
      } else if (!isReconnect) {
        this.destroyConnection(this.connection);
      }

      this.connection = ws;

      ws.On('message', (raw: string) => this.onMessage(raw, ws));
      ws.On('close', () => {
        if (!this.destroyed && this.connection === ws) {
          this.scheduleReconnect();
        }
      });
      ws.On('error', (error: Error) => {
        console.error('EventSub WebSocket error:', error);
      });
    } catch (error) {
      console.error('EventSub connect failed:', error);
      this.scheduleReconnect();
    }
  }

  private onMessage(raw: string, ws: WsConnection) {
    let frame: EventSubFrame;
    try {
      frame = JSON.parse(raw) as EventSubFrame;
    } catch (error) {
      console.error(error);
      return;
    }

    const type = frame.metadata.message_type;

    if (type === 'session_welcome') {
      const session = frame.payload.session;
      if (!session?.id) {
        return;
      }

      if (this.oldConnection && ws === this.connection) {
        this.destroyConnection(this.oldConnection);
        this.oldConnection = null;
      }

      this.resetKeepalive(session.keepalive_timeout_seconds ?? 30);
      TwitchApi.createEventSubSubscriptions(
        session.id,
        this.broadcaster.id
      ).catch(error => console.error(error));

      status.Update({
        current: 'online',
        message: { en: 'Twitch' },
      });
      notifyConnectionStatus('online');
      return;
    }

    if (type === 'session_keepalive') {
      this.resetKeepalive(30);
      return;
    }

    if (type === 'session_reconnect') {
      const reconnectUrl = frame.payload.session?.reconnect_url;
      if (reconnectUrl) {
        this.pendingReconnectUrl = reconnectUrl;
        this.connect(reconnectUrl, true).catch(error => console.error(error));
      }
      return;
    }

    if (type === 'notification') {
      this.resetKeepalive(30);
      this.handleNotification(frame);
      return;
    }

    if (type === 'revocation') {
      console.warn(
        'EventSub subscription revoked:',
        frame.metadata.subscription_type,
        frame.payload.subscription
      );
    }
  }

  private rememberEventSubMessage(messageId: string) {
    this.seenMessageIds.add(messageId);
    if (this.seenMessageIds.size > MAX_SEEN_EVENTSUB_MESSAGE_IDS) {
      const drop = this.seenMessageIds.size - MAX_SEEN_EVENTSUB_MESSAGE_IDS;
      for (const id of this.seenMessageIds) {
        this.seenMessageIds.delete(id);
        if (--drop <= 0) {
          break;
        }
      }
    }
  }

  private shouldSkipDuplicateNotification(frame: EventSubFrame) {
    const messageId = frame.metadata.message_id?.trim();
    if (!messageId) {
      return false;
    }
    if (this.seenMessageIds.has(messageId)) {
      return true;
    }
    this.rememberEventSubMessage(messageId);
    return false;
  }

  private handleNotification(frame: EventSubFrame) {
    if (this.shouldSkipDuplicateNotification(frame)) {
      return;
    }

    const subType =
      frame.metadata.subscription_type || frame.payload.subscription?.type;
    const event = frame.payload.event;
    if (!subType || !event) {
      return;
    }

    switch (subType) {
      case 'channel.follow':
        if (isEventUser(event)) {
          pushFollow(event).catch(error => console.error(error));
        }
        break;
      case 'channel.cheer':
        if (typeof event.bits === 'number') {
          const cheerUser = isEventUser(event)
            ? event
            : {
                user_id: 'anonymous',
                user_login: 'anonymous',
                user_name: 'Anonymous',
              };
          pushBits(
            cheerUser,
            event.bits,
            typeof event.message === 'string' ? event.message : undefined
          ).catch(error => console.error(error));
        }
        break;
      case 'channel.subscribe':
        if (isEventUser(event) && typeof event.tier === 'string') {
          pushSubscribe(event, event.tier, Boolean(event.is_gift)).catch(
            error => console.error(error)
          );
        }
        break;
      case 'channel.subscription.gift':
        if (
          isEventUser(event) &&
          typeof event.total === 'number' &&
          typeof event.tier === 'string'
        ) {
          pushSubGift(event, event.total, event.tier).catch(error =>
            console.error(error)
          );
        }
        break;
      case 'channel.subscription.message':
        if (isEventUser(event)) {
          const text =
            event.message &&
            typeof event.message === 'object' &&
            typeof (event.message as { text?: string }).text === 'string'
              ? (event.message as { text: string }).text
              : undefined;
          const months =
            typeof event.cumulative_months === 'number'
              ? event.cumulative_months
              : 0;
          pushSubRenewal(event, months, text).catch(error =>
            console.error(error)
          );
        }
        break;
      case 'channel.chat.message':
        if (
          typeof event.chatter_user_id === 'string' &&
          typeof event.chatter_user_login === 'string' &&
          typeof event.chatter_user_name === 'string'
        ) {
          const messageId =
            typeof event.message_id === 'string' ? event.message_id : undefined;
          pushChatFromEventSub({
            chatter_user_id: event.chatter_user_id,
            chatter_user_login: event.chatter_user_login,
            chatter_user_name: event.chatter_user_name,
            message:
              event.message && typeof event.message === 'object'
                ? {
                    text:
                      typeof (event.message as any).text === 'string'
                        ? (event.message as any).text
                        : undefined,
                    fragments: Array.isArray((event.message as any).fragments)
                      ? (event.message as any).fragments
                      : undefined,
                  }
                : undefined,
            color: typeof event.color === 'string' ? event.color : undefined,
            badges: Array.isArray(event.badges)
              ? (event.badges as unknown[])
                  .filter(b => {
                    if (!b || typeof b !== 'object') {
                      return false;
                    }
                    const badge = b as {
                      set_id?: unknown;
                      id?: unknown;
                    };
                    return (
                      typeof badge.set_id === 'string' &&
                      typeof badge.id === 'string'
                    );
                  })
                  .map(b => {
                    const badge = b as { set_id: string; id: string };
                    return { set_id: badge.set_id, id: badge.id };
                  })
              : undefined,
            channel_points_custom_reward_id:
              typeof event.channel_points_custom_reward_id === 'string'
                ? event.channel_points_custom_reward_id
                : null,
            message_id: messageId,
            is_pinned: Boolean(
              messageId && messageId === getCurrentPinnedMessageId()
            ),
          }).catch(error => console.error(error));
          schedulePinnedMessageRefresh();
        }
        break;
      case 'channel.chat.notification':
        if (
          typeof event.chatter_user_id === 'string' &&
          typeof event.chatter_user_login === 'string' &&
          typeof event.chatter_user_name === 'string'
        ) {
          const noticeType = event.notice_type;
          if (
            noticeType === 'announcement' ||
            noticeType === 'shared_chat_announcement'
          ) {
            const announcementPayload =
              noticeType === 'shared_chat_announcement'
                ? event.shared_chat_announcement
                : event.announcement;
            const announcementColor =
              announcementPayload &&
              typeof announcementPayload === 'object' &&
              typeof (announcementPayload as { color?: string }).color ===
                'string'
                ? (announcementPayload as { color: string }).color
                : 'primary';

            pushChatAnnouncementFromEventSub({
              chatter_user_id: event.chatter_user_id,
              chatter_user_login: event.chatter_user_login,
              chatter_user_name: event.chatter_user_name,
              message:
                event.message && typeof event.message === 'object'
                  ? {
                      text:
                        typeof (event.message as any).text === 'string'
                          ? (event.message as any).text
                          : undefined,
                      fragments: Array.isArray((event.message as any).fragments)
                        ? (event.message as any).fragments
                        : undefined,
                    }
                  : undefined,
              color: typeof event.color === 'string' ? event.color : undefined,
              badges: Array.isArray(event.badges)
                ? (event.badges as unknown[])
                    .filter(b => {
                      if (!b || typeof b !== 'object') {
                        return false;
                      }
                      const badge = b as {
                        set_id?: unknown;
                        id?: unknown;
                      };
                      return (
                        typeof badge.set_id === 'string' &&
                        typeof badge.id === 'string'
                      );
                    })
                    .map(b => {
                      const badge = b as { set_id: string; id: string };
                      return { set_id: badge.set_id, id: badge.id };
                    })
                : undefined,
              message_id:
                typeof event.message_id === 'string'
                  ? event.message_id
                  : undefined,
              announcement_color: announcementColor,
            }).catch(error => console.error(error));
          }
        }
        break;
      case 'channel.moderate':
        void reloadSettings()
          .then(() => {
            if (!getSettings().showModeratorActions) {
              return;
            }
            const moderationEvent = buildModerationFeedEvent(event);
            if (!moderationEvent) {
              return;
            }
            return pushModerationEvent(moderationEvent);
          })
          .catch(error => console.error(error));
        break;
      case 'channel.poll.begin':
        void reloadSettings()
          .then(() => {
            if (!getSettings().showPolls) {
              return;
            }
            const pollEvent = buildPollFeedEvent(event);
            if (!pollEvent) {
              return;
            }
            return pushPollBegin(pollEvent);
          })
          .catch(error => console.error(error));
        break;
      case 'channel.poll.end': {
        const pollEvent = buildPollFeedEvent(event);
        if (!pollEvent || this.endedPollIds.has(pollEvent.id)) {
          break;
        }
        this.endedPollIds.add(pollEvent.id);
        void reloadSettings()
          .then(() => {
            if (!getSettings().showPolls) {
              return;
            }
            return pushPollEnd(pollEvent);
          })
          .catch(error => console.error(error));
        break;
      }
      case 'channel.channel_points_custom_reward_redemption.add':
        if (
          isEventUser(event) &&
          typeof event.id === 'string' &&
          event.reward &&
          typeof event.reward === 'object' &&
          typeof (event.reward as { id?: string }).id === 'string' &&
          typeof (event.reward as { title?: string }).title === 'string' &&
          typeof (event.reward as { cost?: number }).cost === 'number'
        ) {
          const reward = event.reward as {
            id: string;
            title: string;
            cost: number;
          };
          pushCustomRewardRedemption({
            id: event.id,
            user_id: event.user_id,
            user_login: event.user_login,
            user_name: event.user_name,
            user_input:
              typeof event.user_input === 'string'
                ? event.user_input
                : undefined,
            reward,
          }).catch(error => console.error(error));
        }
        break;
      case 'channel.channel_points_automatic_reward_redemption.add':
        if (
          isEventUser(event) &&
          typeof event.id === 'string' &&
          event.reward &&
          typeof event.reward === 'object' &&
          typeof (event.reward as { type?: string }).type === 'string'
        ) {
          pushAutomaticRewardRedemption({
            id: event.id,
            user_id: event.user_id,
            user_login: event.user_login,
            user_name: event.user_name,
            user_input:
              typeof event.user_input === 'string'
                ? event.user_input
                : undefined,
            reward: event.reward as {
              type: string;
              channel_points?: number;
              cost?: number;
            },
            message:
              event.message && typeof event.message === 'object'
                ? (event.message as { text?: string })
                : undefined,
          }).catch(error => console.error(error));
        }
        break;
      default:
        break;
    }
  }

  private resetKeepalive(seconds: number) {
    this.clearKeepalive();
    const ms = Math.max(seconds, 10) * 1000 + 2000;
    this.keepaliveTimer = setTimeout(() => {
      if (!this.destroyed) {
        console.warn('EventSub keepalive timeout, reconnecting');
        this.destroyConnection(this.connection);
        this.connection = null;
        this.scheduleReconnect(0);
      }
    }, ms);
  }

  private clearKeepalive() {
    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private scheduleReconnect(delayMs = 5000) {
    if (this.destroyed || this.reconnectTimer) {
      return;
    }
    status.Update({ current: 'connecting' });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed) {
        return;
      }
      const url = this.pendingReconnectUrl || EVENTSUB_WS_URL;
      this.pendingReconnectUrl = null;
      this.connect(url).catch(error => console.error(error));
    }, delayMs);
  }

  private destroyConnection(ws: WsConnection | null) {
    if (!ws) {
      return;
    }
    try {
      ws.Destroy();
    } catch (error) {
      console.error(error);
    }
  }
}

const isEventUser = (
  event: Record<string, unknown>
): event is TwitchEventUser & Record<string, unknown> => {
  return (
    typeof event.user_id === 'string' &&
    typeof event.user_login === 'string' &&
    typeof event.user_name === 'string'
  );
};
