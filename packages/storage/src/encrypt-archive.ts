import type { LocalJsonArchive } from './local-json-archive.js';
import { createArchiveKeys } from './passphrase-encryption.js';

/**
 * Rewrites a plaintext archive with an encryption codec. Copies the folder
 * first: a failure halfway through leaves mixed files, and the encrypted flag
 * is written only after every entity and media file has been sealed.
 */
export async function encryptExistingArchive(
  archive: LocalJsonArchive,
  passphrase: string,
): Promise<{ recoveryKey: string }> {
  const manifest = await archive.getManifest();
  if (manifest.encrypted === true) {
    throw new Error('Archive is already encrypted');
  }
  const people = await archive.listPeople();
  const recordings = await archive.listRecordings();
  const stories = await archive.listStories();
  const keepsakes = await archive.listKeepsakes();
  const consents = await archive.listConsents();
  const transcripts = await archive.listTranscripts();
  const interviews = await archive.listInterviews();
  const timeline = await archive.listTimeline();
  const recipes = await archive.listRecipes();
  const media = await archive.listMediaFiles();
  const created = await createArchiveKeys(passphrase);
  archive.useCodec(created.encryption);
  for (const person of people) {
    await archive.savePerson(person);
  }
  for (const recording of recordings) {
    await archive.saveRecording(recording);
  }
  for (const story of stories) {
    await archive.saveStory(story);
  }
  for (const keepsake of keepsakes) {
    await archive.saveKeepsake(keepsake);
  }
  for (const consent of consents) {
    await archive.saveConsent(consent);
  }
  for (const transcript of transcripts) {
    await archive.saveTranscript(transcript);
  }
  for (const interview of interviews) {
    await archive.saveInterview(interview);
  }
  for (const event of timeline) {
    await archive.saveTimelineEvent(event);
  }
  for (const recipe of recipes) {
    await archive.saveRecipe(recipe);
  }
  for (const file of media) {
    await archive.writeMedia(file.relativePath, file.bytes);
  }
  await archive.writeEncryptionEnvelope(created.envelope);
  await archive.markEncrypted();
  return { recoveryKey: created.recoveryKey };
}
