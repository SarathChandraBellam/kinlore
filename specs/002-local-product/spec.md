# Spec 002: Local record, ask, and keep

Status: implemented · Owner: Kinlore contributors

## Problem

The skeleton can store a person. Families still cannot record, import, ask, or
keep the things the product promises, and a release can be published without
installer files.

## Goal

A local-first Kinlore that interviews, imports recordings, answers from real
clips, and keeps stories, recipes, keepsakes, a timeline, and sealed
recordings. Staging and production releases both attach the same installer
assets.

## Acceptance criteria

- **AC1**: Given a person without recording consent, when a capture or import
  is saved, then the archive rejects it.
- **AC2**: Given consent and words typed from a recording, when the family asks
  a matching question, then the answer is that verbatim clip.
- **AC3**: Given no matching words, when the family asks, then the result is
  unknown and no new sentence is produced.
- **AC4**: Given two speakers, when the family asks one question, then each
  person's clip is returned separately.
- **AC5**: Given a future seal date, when the family asks or requests playback,
  then that recording is hidden, and an earlier date is refused.
- **AC6**: Given a subtitle beside a chosen audio file, when it is imported,
  then the cues are stored as the transcript and an unchosen path is rejected.
- **AC7**: Given a zip entry whose name escapes the archive, when it is read,
  then import throws and returns no bytes.
- **AC8**: Given a passphrase, when encryption is turned on, then the archive
  does not open until the passphrase or recovery key is supplied, and the
  recovery key is not inside `encryption.json`.
- **AC9**: Given generated voice or a remote step, when the family uses this
  build, then no audio is synthesized and nothing is sent.
- **AC10**: Given a release asset directory, when an AppImage, exe, dmg, or
  `SHA256SUMS` is missing, then the asset check fails. Staging and production
  both run that check before `gh release create`.

## Non-functional

- NFR1: Local-first. No network client is added.
- NFR2: Renderer does not import storage, Node, or Electron.
- NFR3: Encryption stays out of the plaintext `LocalJsonStorage` write path
  until a codec is set.
