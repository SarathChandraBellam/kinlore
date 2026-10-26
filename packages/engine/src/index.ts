/**
 * Swappable local engines. This build ships no model weights and performs no
 * network calls. A future engine can implement these interfaces.
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
