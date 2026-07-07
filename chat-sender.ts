import { TwitchApi } from './api';
import { getSettings, reloadSettings } from './settings';

export type ChatSendCredentials = {
  accessToken: string;
  senderId: string;
};

/**
 * Resolves chat send credentials for addon RPC (`sendChatMessage`).
 * Prefers the bot account when configured, otherwise the main account.
 */
export const resolveAddonChatSender =
  async (): Promise<ChatSendCredentials | null> => {
    const broadcaster = await TwitchApi.GetMe();
    if (!broadcaster?.id) {
      return null;
    }

    if (TwitchApi.botAccessToken) {
      const bot = await TwitchApi.GetMe(TwitchApi.botAccessToken);
      if (bot?.id) {
        return {
          accessToken: TwitchApi.botAccessToken,
          senderId: bot.id,
        };
      }
    }

    if (!TwitchApi.accessToken) {
      return null;
    }

    return {
      accessToken: TwitchApi.accessToken,
      senderId: broadcaster.id,
    };
  };

/**
 * Resolves chat send credentials for the dashboard chat input.
 * Uses the bot account only when the setting is enabled and a bot token exists.
 */
export const resolveDashboardChatSender =
  async (): Promise<ChatSendCredentials | null> => {
    await reloadSettings();
    const broadcaster = await TwitchApi.GetMe();
    if (!broadcaster?.id) {
      return null;
    }

    const settings = getSettings();
    if (settings.sendChatViaBot && TwitchApi.botAccessToken) {
      const bot = await TwitchApi.GetMe(TwitchApi.botAccessToken);
      if (bot?.id) {
        return {
          accessToken: TwitchApi.botAccessToken,
          senderId: bot.id,
        };
      }
    }

    if (!TwitchApi.accessToken) {
      return null;
    }

    return {
      accessToken: TwitchApi.accessToken,
      senderId: broadcaster.id,
    };
  };

/**
 * Sends a chat message to the authorized broadcaster channel.
 * @param message Message text to send.
 * @param credentials OAuth token and sender user id.
 * @param broadcasterId Twitch user id of the channel owner.
 */
export const sendChatMessageWithCredentials = async (
  message: string,
  credentials: ChatSendCredentials,
  broadcasterId: string
): Promise<boolean> =>
  TwitchApi.SendChatMessage(
    message,
    broadcasterId,
    credentials.senderId,
    credentials.accessToken
  );
