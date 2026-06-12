import { TwitchApi } from './api';
import { PLATFORM } from './constants';
import { TwitchEventSubClient } from './eventsub';
import { notifyConnectionStatus } from './status-notify';

let eventSub: TwitchEventSubClient | null = null;
let starting = false;
let badgesRefreshTimer: ReturnType<typeof setInterval> | null = null;
let emotesRefreshTimer: ReturnType<typeof setInterval> | null = null;
let broadcasterId: string | null = null;

const BADGES_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
const EMOTES_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

export const startTwitchTracking = async () => {
  if (starting || !TwitchApi.accessToken) {
    return;
  }

  starting = true;
  stopTwitchTracking();

  status.Update({ current: 'connecting' });

  try {
    const user = await TwitchApi.GetMe();
    if (!user || !TwitchApi.accessToken) {
      status.Update({ current: 'offline' });
      notifyConnectionStatus('offline');
      return;
    }

    broadcasterId = user.id;
    await refreshChatBadges(user.id);
    await refreshChatEmotes(user.id);
    if (!badgesRefreshTimer) {
      badgesRefreshTimer = setInterval(() => {
        if (!broadcasterId) {
          return;
        }
        void refreshChatBadges(broadcasterId);
      }, BADGES_REFRESH_INTERVAL_MS);
    }

    if (!emotesRefreshTimer) {
      emotesRefreshTimer = setInterval(() => {
        if (!broadcasterId) {
          return;
        }
        void refreshChatEmotes(broadcasterId);
      }, EMOTES_REFRESH_INTERVAL_MS);
    }

    await TwitchApi.clearWebSocketEventSubSubscriptions();

    eventSub = new TwitchEventSubClient(user);
    await eventSub.start();

    void dashboard.onChatSend(async ({ text }) => {
      if (!TwitchApi.accessToken || !broadcasterId) {
        throw new Error('Twitch is not authorized');
      }
      const sent = await TwitchApi.SendChatMessage(
        text,
        broadcasterId,
        broadcasterId
      );
      if (!sent) {
        throw new Error('Twitch chat message was not sent');
      }
    });
  } catch (error) {
    console.error('Twitch tracking failed to start:', error);
    status.Update({ current: 'error' });
    notifyConnectionStatus('error');
    stopTwitchTracking({ notify: false });
  } finally {
    starting = false;
  }
};

export const stopTwitchTracking = (options?: { notify?: boolean }) => {
  void dashboard.offChatSend();
  eventSub?.stop();
  eventSub = null;
  broadcasterId = null;
  if (badgesRefreshTimer) {
    clearInterval(badgesRefreshTimer);
    badgesRefreshTimer = null;
  }
  if (emotesRefreshTimer) {
    clearInterval(emotesRefreshTimer);
    emotesRefreshTimer = null;
  }
  status.Update({ current: 'offline' });
  if (options?.notify !== false) {
    notifyConnectionStatus('offline');
  }
};

const refreshChatBadges = async (channelId: string) => {
  if (!TwitchApi.accessToken) {
    return;
  }

  const [globalSets, channelSets] = await Promise.all([
    TwitchApi.GetGlobalChatBadges(),
    TwitchApi.GetChannelChatBadges(channelId),
  ]);

  const mapping = new Map<string, { url: string; title?: string }>();

  const ingest = (
    sets: Awaited<ReturnType<typeof TwitchApi.GetGlobalChatBadges>>
  ) => {
    for (const set of sets) {
      for (const version of set.versions ?? []) {
        const url =
          version.image_url_1x || version.image_url_2x || version.image_url_4x;
        if (!url) {
          continue;
        }
        const badgeId = `${set.set_id}/${version.id}`;
        const title =
          version.title || version.info || `${set.set_id} ${version.id}`;
        mapping.set(badgeId, { url, title });
      }
    }
  };

  ingest(globalSets);
  ingest(channelSets);

  const badges = [...mapping.entries()].map(([id, info]) => ({
    id,
    url: info.url,
    title: info.title,
  }));
  if (badges.length === 0) {
    return;
  }
  await dashboard.registerChatBadges(badges);
};

const refreshChatEmotes = async (channelId: string) => {
  if (!TwitchApi.accessToken) {
    return;
  }

  const [globalEmotes, channelEmotes] = await Promise.all([
    TwitchApi.GetGlobalChatEmotes(),
    TwitchApi.GetChannelChatEmotes(channelId),
  ]);

  const mapping = new Map<string, string>();

  const ingest = (
    emotes: Awaited<ReturnType<typeof TwitchApi.GetGlobalChatEmotes>>
  ) => {
    for (const emote of emotes) {
      const word = emote?.name;
      if (typeof word !== 'string' || !word) {
        continue;
      }

      const url =
        emote.images?.url_1x || emote.images?.url_2x || emote.images?.url_4x;
      if (!url) {
        continue;
      }

      mapping.set(word, url);
    }
  };

  // Channel emotes should override global ones when names collide.
  ingest(globalEmotes);
  ingest(channelEmotes);

  const emotes = [...mapping.entries()].map(([word, url]) => ({
    word,
    url,
  }));

  if (emotes.length === 0) {
    return;
  }

  await dashboard.registerChatEmotes({
    platforms: [PLATFORM],
    emotes,
  });
};
