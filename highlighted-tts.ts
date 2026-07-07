import { getSettings } from './settings';

/**
 * Speaks a highlighted chat message through the app's configured TTS engine.
 */
export const speakHighlightedMessage = async (text: string): Promise<void> => {
  if (!getSettings().speakHighlightedMessages) {
    return;
  }

  const message = text.trim();
  if (!message || !permissions.has('TTS')) {
    return;
  }

  try {
    const result = await tts.speak(message);
    if (!result.success) {
      console.warn('Highlighted message TTS failed:', result.message);
    }
  } catch (error) {
    console.error('Highlighted message TTS error:', error);
  }
};
