import { TwitchApi } from './api';

export type ChatSendCredentials = {
  accessToken: string;
  senderId: string;
};

/**
 * Resolves chat send credentials for the main (broadcaster) account.
 * @returns Main-account token and sender id, or `null` when unauthorized.
 * @example
 * const credentials = await resolveMainChatSender();
 * // { accessToken: '…', senderId: '123' } | null
 */
const resolveMainChatSender = async (): Promise<ChatSendCredentials | null> => {
  const broadcaster = await TwitchApi.GetMe();
  if (!broadcaster?.id || !TwitchApi.accessToken) {
    return null;
  }

  return {
    accessToken: TwitchApi.accessToken,
    senderId: broadcaster.id,
  };
};

/**
 * Resolves chat send credentials for the bot account when it is connected.
 * @returns Bot-account token and sender id, or `null` when the bot is unavailable.
 * @example
 * const credentials = await resolveBotChatSender();
 * // { accessToken: '…', senderId: '456' } | null
 */
const resolveBotChatSender = async (): Promise<ChatSendCredentials | null> => {
  if (!TwitchApi.botAccessToken) {
    return null;
  }

  const bot = await TwitchApi.GetMe(TwitchApi.botAccessToken);
  if (!bot?.id) {
    return null;
  }

  return {
    accessToken: TwitchApi.botAccessToken,
    senderId: bot.id,
  };
};

/**
 * Resolves chat send credentials for addon RPC (`sendChatMessage`).
 * Prefers the bot account when configured, otherwise the main account.
 * @example
 * const credentials = await resolveAddonChatSender();
 */
export const resolveAddonChatSender =
  async (): Promise<ChatSendCredentials | null> => {
    const bot = await resolveBotChatSender();
    if (bot) {
      return bot;
    }
    return resolveMainChatSender();
  };

/**
 * Resolves chat send credentials for `dashboard.onChatSend`.
 * System messages use the bot account when connected; otherwise (or for
 * non-system messages) the main account is used.
 * @param options Optional send metadata from the dashboard chat-send payload.
 * @param options.system When `true`, prefer the bot account if it is connected.
 * @example
 * const credentials = await resolveDashboardChatSender({ system: true });
 */
export const resolveDashboardChatSender = async (options?: {
  system?: boolean;
}): Promise<ChatSendCredentials | null> => {
  if (options?.system === true) {
    const bot = await resolveBotChatSender();
    if (bot) {
      return bot;
    }
  }

  return resolveMainChatSender();
};

/**
 * Sends a chat message to the authorized broadcaster channel.
 * @param message Message text to send.
 * @param credentials OAuth token and sender user id.
 * @param broadcasterId Twitch user id of the channel owner.
 * @example
 * await sendChatMessageWithCredentials('Hello!', credentials, '123');
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
