import type {
  Consent,
  ConsentScope,
  OutboundApproval,
  OutboundDisclosure,
  OutboundPurpose,
  RemoteStepResult,
  VoiceDecision,
} from './model.js';

export function isRecordingSealed(recording: { sealedUntil?: string }, now: Date): boolean {
  if (recording.sealedUntil === undefined) {
    return false;
  }
  const time = Date.parse(recording.sealedUntil);
  if (Number.isNaN(time)) {
    return true;
  }
  return time > now.getTime();
}

export function consentAllows(
  consents: readonly Consent[],
  personId: string,
  scope: ConsentScope,
): boolean {
  return consents.some(
    (consent) => consent.personId === personId && consent.scope === scope && consent.granted,
  );
}

export function generatedVoiceDecision(input: {
  enabled: boolean;
  consentGranted: boolean;
  modelInstalled: boolean;
}): VoiceDecision {
  if (!input.enabled) {
    return { allowed: false, reason: 'off' };
  }
  if (!input.consentGranted) {
    return { allowed: false, reason: 'no-consent' };
  }
  if (!input.modelInstalled) {
    return { allowed: false, reason: 'no-model' };
  }
  return { allowed: true, labeled: true };
}

export function outboundDisclosure(purpose: OutboundPurpose): OutboundDisclosure {
  if (purpose === 'transcribe') {
    return {
      purpose,
      contactedHost: null,
      wouldLeaveIfRemote: ['the recording audio', 'an API key you saved'],
      stays: ['the archive folder', 'other recordings', 'the secret file'],
    };
  }
  return {
    purpose,
    contactedHost: null,
    wouldLeaveIfRemote: ['the question text', 'an API key you saved'],
    stays: ['recordings', 'transcripts already in the archive'],
  };
}

export function assertOutboundApproved(
  disclosure: OutboundDisclosure,
  approval: OutboundApproval,
): void {
  if (!approval.approved || approval.purpose !== disclosure.purpose || approval.host !== 'none') {
    throw new Error('Outbound request was not approved');
  }
}

/** Approval is checked, then nothing is sent. No remote engine is installed. */
export function remoteStepResult(
  disclosure: OutboundDisclosure,
  approval: OutboundApproval,
): RemoteStepResult {
  assertOutboundApproved(disclosure, approval);
  return {
    sent: false,
    message: 'No remote engine is installed. Nothing left this computer.',
  };
}
