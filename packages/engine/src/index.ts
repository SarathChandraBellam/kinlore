/**
 * Speech and voice seams ship no model weights. Optional text assistance uses
 * the separate OpenRouter client after main-process approval.
 */
export interface SpeechEngine {
  readonly id: string;
  readonly runsLocally: boolean;
  transcribe(audio: Uint8Array): Promise<never>;
}

export interface VoiceEngine {
  readonly id: string;
  readonly installed: boolean;
  synthesize(text: string): Promise<never>;
}

export class UnavailableSpeechEngine implements SpeechEngine {
  readonly id = 'none';
  readonly runsLocally = true;

  transcribe(_audio: Uint8Array): Promise<never> {
    return Promise.reject(
      new Error(
        'No speech engine is installed. Type the words that were spoken. Nothing was sent.',
      ),
    );
  }
}

export class NoVoiceEngine implements VoiceEngine {
  readonly id = 'none';
  readonly installed = false;

  synthesize(_text: string): Promise<never> {
    return Promise.reject(
      new Error('Generated voice is off. No voice model is installed. Nothing was created.'),
    );
  }
}

export { OpenRouterClient } from './openrouter.js';
export type { LlmMessage, OpenRouterRequest } from './openrouter.js';
