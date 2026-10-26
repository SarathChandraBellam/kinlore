import { describe, expect, it } from 'vitest';
import type { Consent } from './model.js';
import {
  consentAllows,
  generatedVoiceDecision,
  isRecordingSealed,
  outboundDisclosure,
  remoteStepResult,
} from './policy.js';

const now = new Date('2026-10-26T00:00:00.000Z');

function consent(scope: Consent['scope'], granted: boolean): Consent {
  return {
    id: 'c1',
    personId: 'ada',
    scope,
    granted,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

describe('seal, consent, voice, and outbound policy', () => {
  it('keeps a recording sealed until the chosen instant', () => {
    expect(isRecordingSealed({ sealedUntil: '2026-12-01T00:00:00.000Z' }, now)).toBe(true);
    expect(isRecordingSealed({ sealedUntil: '2026-01-01T00:00:00.000Z' }, now)).toBe(false);
    expect(isRecordingSealed({}, now)).toBe(false);
  });

  it('fails closed when a seal date cannot be read', () => {
    expect(isRecordingSealed({ sealedUntil: 'not-a-date' }, now)).toBe(true);
  });

  it('requires an explicit grant for each scope', () => {
    const consents = [consent('recording', true), consent('generated-voice', false)];
    expect(consentAllows(consents, 'ada', 'recording')).toBe(true);
    expect(consentAllows(consents, 'ada', 'generated-voice')).toBe(false);
    expect(consentAllows(consents, 'lin', 'recording')).toBe(false);
  });

  it('keeps generated voice off unless consent and a model both exist', () => {
    expect(
      generatedVoiceDecision({ enabled: false, consentGranted: true, modelInstalled: true }),
    ).toEqual({
      allowed: false,
      reason: 'off',
    });
    expect(
      generatedVoiceDecision({ enabled: true, consentGranted: false, modelInstalled: true }),
    ).toEqual({
      allowed: false,
      reason: 'no-consent',
    });
    expect(
      generatedVoiceDecision({ enabled: true, consentGranted: true, modelInstalled: false }),
    ).toEqual({
      allowed: false,
      reason: 'no-model',
    });
    expect(
      generatedVoiceDecision({ enabled: true, consentGranted: true, modelInstalled: true }),
    ).toEqual({
      allowed: true,
      labeled: true,
    });
  });

  it('does not contact a host, even after approval', () => {
    const disclosure = outboundDisclosure('transcribe');
    expect(disclosure.contactedHost).toBeNull();
    expect(
      remoteStepResult(disclosure, { approved: true, purpose: 'transcribe', host: 'none' }),
    ).toEqual({
      sent: false,
      message: 'No remote engine is installed. Nothing left this computer.',
    });
    expect(() =>
      remoteStepResult(disclosure, { approved: true, purpose: 'transcribe', host: 'example.com' }),
    ).toThrow(/not approved/);
    expect(() =>
      remoteStepResult(disclosure, { approved: false, purpose: 'transcribe', host: 'none' }),
    ).toThrow(/not approved/);
  });
});
