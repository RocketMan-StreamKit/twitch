export type TwitchAddonSettings = {
  showModeratorActions: boolean;
  showJoinLeave: boolean;
  showPolls: boolean;
};

const DEFAULTS: TwitchAddonSettings = {
  showModeratorActions: true,
  showJoinLeave: false,
  showPolls: true,
};

let cached: TwitchAddonSettings = { ...DEFAULTS };

export const reloadSettings = async (): Promise<TwitchAddonSettings> => {
  const params = await api.config.getParams();
  cached = {
    showModeratorActions: params.show_moderator_actions !== false,
    showJoinLeave: params.show_join_leave === true,
    showPolls: params.show_polls !== false,
  };
  return cached;
};

export const getSettings = (): TwitchAddonSettings => cached;
