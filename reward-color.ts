/**
 * Builds a random Twitch reward background color in `#RRGGBB` form.
 * @example
 * randomRewardBackgroundColor(); // '#A1B2C3'
 */
export const randomRewardBackgroundColor = (): string => {
  const channel = () => Math.floor(Math.random() * 256);
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(channel())}${toHex(channel())}${toHex(channel())}`.toUpperCase();
};
