import { describe, expect, it } from 'vitest';
import { NoVoiceEngine, UnavailableSpeechEngine } from './index.js';

describe('engines', () => {
  it('does not transcribe or invent a voice', async () => {
    const speech = new UnavailableSpeechEngine();
    const voice = new NoVoiceEngine();
    expect(speech.runsLocally).toBe(true);
    expect(voice.installed).toBe(false);
    await expect(speech.transcribe(new Uint8Array([1]))).rejects.toThrow(/Nothing was sent/);
    await expect(voice.synthesize('hello')).rejects.toThrow(/Nothing was created/);
  });
});
