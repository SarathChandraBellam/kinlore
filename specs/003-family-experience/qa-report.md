# QA report 003: Family experience, encrypted local archives, and OpenRouter

Date: 2026-10-29 (Asia/Kolkata).

Verdict: **FAIL for full QA sign-off — required live UI checks remain pending.**
All automated quality gates pass. This is a verification limitation, not an open
known failing automated test. No merge, commit, push, or public release was made.

## Quality gates

| Gate                                   | Command                | Result                                                                |
| -------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| Format                                 | `npm run format:check` | PASS, exit 0                                                          |
| Lint                                   | `npm run lint`         | PASS, exit 0                                                          |
| Types                                  | `npm run typecheck`    | PASS, exit 0                                                          |
| Unit/integration/rendering/state tests | `npm test`             | PASS, exit 0; 123 tests, 19 files; none skipped                       |
| Production build                       | `npm run build`        | PASS, exit 0; renderer and preload bundles generated                  |
| Diff hygiene                           | `git diff --check`     | PASS, exit 0                                                          |
| Changed-line coverage                  | —                      | Not configured; no coverage claim                                     |
| Dependency/secret scan                 | —                      | No defined gate; no dependencies added, no credential files inspected |

Final automated run: 123/123 tests, 19/19 files, approximately 2.55 seconds.
The desktop dev process was restarted using `env -u ELECTRON_RUN_AS_NODE npm run dev`.
Preload built, Electron remained running, and no startup error was emitted during
observation. Process presence verifies launch only, not window appearance.

## Acceptance evidence

| Criterion / cases   | Evidence                                                                                                                                                                                                                | Result                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| AC1 / TC1           | `renderer/experience.test.ts`: five primary destinations, initial CTA, empty/consented Home; secondary tools inspected in App                                                                                           | Automated structure PASS; live navigation pending                         |
| AC2 / TC2–5         | `assistance.test.ts`: omitted/blank words create audio without a transcript; `archive-session.test.ts`: exact typed words remain searchable; encrypted media round-trip                                                 | Integration PASS; actual microphone/preview/playback pending              |
| AC3 / TC6, TC31–32  | `experience-state.test.ts`: discard/failure isolation, draft source changes and retained edits; shared fieldset pending/error states inspected                                                                          | State tests PASS; keyboard, screen reader, and visual interaction pending |
| AC4 / TC7–8, TC28   | `assistance.test.ts`, `file-secret-store.test.ts`, `secret-protection.test.ts`: config status only, no send on save, encrypted secret payload, migration, unavailable/basic_text fail-closed                            | PASS with mocked OS protection; native keychain interaction not tested    |
| AC5 / TC9–12, TC29  | `assistance.test.ts`: exact preview, expiry, replay, archive/config/source/consent/seal invalidation, in-flight response revocation; paused consent write rejects preview and approval                                  | PASS; no real provider call                                               |
| AC6 / TC13–15       | Selected transcript-only payload, no key/path/media bytes, all recording participants and transcript speakers require export consent, sealed/invalid sources reject                                                     | PASS                                                                      |
| AC7 / TC16–18       | `openrouter.test.ts`, `assistance.test.ts`: bounded question output, original clip text/times, unsupported citations reject, unknown stays unknown                                                                      | PASS with mocked provider                                                 |
| AC8 / TC19–21, TC32 | Session result does not mutate archive; draft field/citation validation; reducers clear applied draft on source change; apply/save wiring inspected                                                                     | Automated PASS; actual click/edit/save journey pending                    |
| AC9 / TC22–24       | Adapter tests for HTTP/auth/rate/credit/network/timeout/malformed/size failures; fixed endpoint/redirect refusal; local capture and Ask regressions                                                                     | PASS                                                                      |
| AC10 / TC25         | README, CONTRIBUTING, spec/plan/test cases and repo knowledge updated; no private fixture or paid key needed                                                                                                            | PASS by document inspection                                               |
| AC11 / TC27–28      | `encrypted-session.test.ts`: passphrase validation before creation, encrypted entity/transcript/media bytes, locked reopen, passphrase/recovery unlock, legacy write rejection and migration; OS-protected secret tests | Automated PASS; passphrase/recovery modal and native OS checks pending    |
| AC12 / TC30         | Persona exactly previewed, bounded/interview-only, selected-person sharing required and revoked approval rejected; persona UI and system prompt inspected                                                               | PASS with mocked provider; model question quality not evaluated           |
| TC26, TC33          | All four new copy sets are nonempty; sky-blue/white/black CSS and responsive breakpoints inspected                                                                                                                      | Static PASS; live language layout/appearance pending                      |

## Review and regressions

Fresh-context code and security reviews approved after these fixes:

- Discard clears take-local transcript words; recorder failure cannot present a
  partial take as an ordinary successful recording.
- Applied story/recipe/timeline draft content clears when its source changes.
- Archive mutations block assistance snapshots for their entire async lifetime,
  invalidating previews before and after; the consent race has a deferred-write test.
- Sealed transcript words are hidden alongside playback. Media responses use
  `Cache-Control: no-store` to avoid persisting decrypted media in an HTTP cache.
- Keys/model settings are encrypted with OS protection in production. Linux
  `basic_text` and unavailable OS protection never fall back to plaintext saves.
- Wrapped archive keys are now persisted before legacy migration rewrites files.

Regression bite checks temporarily restored the old behaviors, then restored the
fixed source before the final run:

- Late wrapped-key persistence: the new interrupted-migration test failed.
- Discard preserving words: take isolation tests failed.
- Source changes preserving applied drafts: all three provenance cases failed.

## Required remaining checks and limits

Native computer use returned “Computer Use was not approved to use Electron”.
The in-app browser host was unavailable. No alternative UI-control method was
used to bypass that limitation. Before full QA sign-off, a person with native UI
access must verify:

1. Desktop and narrow sky theme, readable black text, all four languages, keyboard
   focus and screen-reader announcements.
2. Create/confirm passphrase, recovery-key acknowledgement, close/reopen/unlock,
   and legacy encryption setup on a backed-up synthetic archive.
3. Microphone allow/deny, record/stop/review/save, discard/re-record, permission
   request followed by navigation, device failure, and replay.
4. Model/key setup, persona request review/cancel/approve, and draft apply/edit/save.
   A real OpenRouter request requires the user's own key/model and may incur charges;
   none was made during implementation.

Legacy plaintext migration is still non-transactional: interruption can leave
mixed files and require restoring a backup. Saving wrapped keys first prevents
key loss for already-encrypted files, but does not make migration atomic. The UI
and README explicitly require a backup before migration. New archives are encrypted
from creation and do not use that migration path.

Encryption covers family records and media. Format metadata, entity filenames,
and wrapped-key envelopes remain visible. No Postgres, login, hosted archive,
ASR, generated voice, or background upload was added. Optional OpenRouter receives
only explicitly approved text; encrypted local storage does not make that remote
request local.
