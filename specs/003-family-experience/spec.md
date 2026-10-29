# Spec 003: Family experience and optional OpenRouter assistance

Status: approved direction · Owner: maintainer · Date: 2026-10-29

## Problem

Families currently assemble a recording journey from twelve navigation destinations,
archive controls, consent toggles, and a recording form that requires typed words.
The app also has no working LLM provider despite a request to use OpenRouter models.

## Goal

Make the first story easy to record, save, and replay, and make returning memories
easy to find. Offer optional OpenRouter assistance with no added SDK dependency,
while keeping the archive usable offline and preserving authentic source clips.

## Scope

- Home, Family, Record, Memories, and Settings as primary navigation; preserve
  existing stories, keepsakes, recipes, timeline, sealed recordings, imports,
  encryption, and local question/answer functionality as contextual views.
- Guided archive/person/consent/record/review journey, optional typed words,
  playback preview, clear busy/error/success states, accessible responsive layout.
- User-configured OpenRouter key and model; explicit review and approval for each
  remote interview, Ask, story, recipe, or timeline request.
- OpenRouter drafts are editable suggestions tied to real recordings. They are
  never transcripts or automatically accepted archive facts.
- Update README/contribution guidance and project intent to describe the new
  optional provider, design principles, roadmap, and contribution opportunities.
- Out: audio uploads, speech recognition, generated voice, background calls,
  automatic archive edits, accounts, telemetry, publishing, or new dependencies.

The user's OpenRouter request explicitly supersedes the earlier no-remote-text
non-goal. Local-first, consent, authentic recordings, and no network by default remain.
The user approved the proposed design direction with “go with your design”.

## Acceptance criteria

- **AC1:** Given a new or existing archive, when a family opens Home, then it
  presents a clear next step and five primary destinations; all existing archive
  features remain reachable in an appropriate secondary view.
- **AC2:** Given a person with recording consent and microphone permission, when
  a family records, stops, reviews, and saves without typing words, then the real
  audio is saved and replayable without fabricated transcript text. Typed words
  remain optional and, when supplied, remain searchable as before.
- **AC3:** Given a recording or form operation, when it is pending, fails, or
  succeeds, then the UI communicates that state, prevents duplicate submission,
  preserves recoverable input on failure, and supports keyboard operation and
  readable layouts at narrow and desktop widths.
- **AC4:** Given Settings, when a family saves or removes its OpenRouter key and
  enters a model identifier, then status is shown without revealing the stored
  key; settings stay outside the portable archive and no network request occurs.
- **AC5:** Given an assistance task, when a family requests assistance, then it
  first sees the selected model, OpenRouter/upstream-provider destination, and
  exact outbound text. Cancel sends nothing; only approval sends that preview
  once. Missing/expired/replayed approval, changed archive/content/config,
  revoked consent, locked archive, or newly sealed source blocks the request.
- **AC6:** Given selected family sources, when remote context is prepared, then
  only explicitly selected, unsealed, eligible transcript text is included, with
  export consent for every person attached to its recording. No audio, keys,
  filesystem paths, unrelated records, or sealed text appears in the preview.
- **AC7:** Given an approved interview or Ask request, when a valid model result
  returns, then interview suggestions can be chosen and Ask only returns actual
  validated source clips. Unknown/missing evidence returns unknown; model-supplied
  quotes, timestamps, source IDs, or instructions cannot override archive facts.
- **AC8:** Given an approved story, recipe, or timeline request, when a result
  returns, then it is labeled as an AI draft with valid source citations and may
  be edited/applied through the existing form before explicit saving. No model
  result writes archive entities or changes original transcripts by itself.
- **AC9:** Given invalid input, malformed/oversized provider output, HTTP failure,
  or timeout, when assistance runs, then it fails with a useful safe error, no
  automatic retry or archive write, and no key or family payload in error output.
  Offline recording, browsing, and local questions remain usable.
- **AC10:** Given a contributor, when reading the repository documentation, then
  they can find the design rationale, setup and verification commands, optional
  provider configuration, honest feature limits, and code/design/language contribution
  paths without needing private family data or a paid provider to run tests.

## Non-functional requirements

- Renderer remains isolated; all network and key access are main-process owned.
- No dependency additions. New desktop archives use the existing encrypted v2 format. Legacy plaintext archives require the existing encryption migration before edits. Existing archives open.
- Provider traffic uses a fixed HTTPS endpoint, bounded request/response sizes,
  bounded completion output, a timeout, and runtime validation of unknown data.
- Existing four interface languages remain selectable; new copy uses the same
  translation mechanism. Visible focus, labels, contrast, and recording state
  must be checked in the running UI.
- Run format check, lint, typecheck, unit/integration tests, and build before done.

## Approved steering: encrypted local storage and sky theme

The user subsequently required sky blue, white, black text, a web-app-like aesthetic,
and encrypted local storage. Postgres and login are explicitly deferred. They
confirmed optional OpenRouter by requesting persona-based questions and said proceed.

- **AC11:** Given new archive setup, when a passphrase is supplied and confirmed,
  then the archive is created encrypted and its recovery key is shown before setup
  completes. Family records and media are encrypted on disk; no passphrase or raw
  data key is persisted. A legacy plaintext archive rejects all family mutations
  until migration. Local API credentials/model settings use OS-backed encryption
  and persistence fails closed if protection is unavailable.
- **AC12:** Given Record, when the user enters an interview persona, then OpenRouter
  receives only that reviewed context and explicitly selected sources. A selected
  person must allow sharing. Questions adapt to persona/language without assuming
  unrecorded events; no persona or generated answer is saved automatically.

## Open questions

None blocking. The user selects their own OpenRouter model; no billable test call
or default model is required. Usability sessions with families and public release
work are follow-ups, not claims of validation in this change.
