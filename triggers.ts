const TWITCH_SUBSCRIBE_TIER_OPTIONS = [
  { value: '1000', label: { en: 'Tier 1', ru: 'Тир 1', uk: 'Тир 1' } },
  { value: '2000', label: { en: 'Tier 2', ru: 'Тир 2', uk: 'Тир 2' } },
  { value: '3000', label: { en: 'Tier 3', ru: 'Тир 3', uk: 'Тир 3' } },
  { value: 'Prime', label: { en: 'Prime', ru: 'Prime', uk: 'Prime' } },
];

const TWITCH_SUBGIFT_TIER_OPTIONS = [
  { value: '1000', label: { en: 'Tier 1', ru: 'Тир 1', uk: 'Тир 1' } },
  { value: '2000', label: { en: 'Tier 2', ru: 'Тир 2', uk: 'Тир 2' } },
  { value: '3000', label: { en: 'Tier 3', ru: 'Тир 3', uk: 'Тир 3' } },
];

/** Overlay trigger options exposed in overlay settings UI. */
export const registerTwitchOverlayTriggers = () => {
  return dashboard.registerTriggers([
    {
      type: 'follow',
      label: {
        en: 'New follower',
        ru: 'Новый фолловер',
        uk: 'Новий фоловер',
      },
    },
    {
      type: 'custom',
      key: 'bits',
      label: {
        en: 'Cheer (bits)',
        ru: 'Cheer (битсы)',
        uk: 'Cheer (бітси)',
      },
      valueType: 'number',
      valueMatch: 'minimum',
      valueHint: {
        en: 'Amount of bits',
        ru: 'Сумма в битсах',
        uk: 'Кількість бітсів',
      },
    },
    {
      type: 'subscribe',
      label: {
        en: 'Subscription',
        ru: 'Подписка',
        uk: 'Підписка',
      },
      valueType: 'select',
      valueOptions: TWITCH_SUBSCRIBE_TIER_OPTIONS,
    },
    {
      type: 'subgift',
      label: {
        en: 'Sub gift (tier)',
        ru: 'Сабгифт (тир)',
        uk: 'Сабгифт (тир)',
      },
      valueType: 'select',
      valueOptions: TWITCH_SUBGIFT_TIER_OPTIONS,
    },
    {
      type: 'subgift',
      key: 'total',
      label: {
        en: 'Sub gift (count)',
        ru: 'Сабгифт (количество)',
        uk: 'Сабгифт (кількість)',
      },
      valueType: 'number',
      valueMatch: 'minimum',
      valueHint: {
        en: 'Minimum subs gifted at once',
        ru: 'Минимум подаренных сабов за раз',
        uk: 'Мінімум подарованих сабів за раз',
      },
    },
    {
      type: 'custom',
      key: 'redeems',
      label: {
        en: 'Channel point reward',
        ru: 'Награда за баллы канала',
        uk: 'Нагорода за бали каналу',
      },
      valueType: 'dynamic',
      valueProvider: 'rewards',
      valueGenerateLabel: {
        en: 'Generate reward',
        ru: 'Сгенерировать награду',
        uk: 'Згенерувати нагороду',
      },
      requireValue: {
        key: 'cost',
        type: 'number',
        label: {
          en: 'Reward cost',
          ru: 'Стоимость награды',
          uk: 'Вартість нагороди',
        },
        default: 100,
        min: 1,
      },
    },
  ]);
};
