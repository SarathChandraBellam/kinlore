# QA report 002

Date: 2026-10-26

## Gates

| Gate                   | Result         |
| ---------------------- | -------------- |
| `npm run format:check` | pass           |
| `npm run lint`         | pass           |
| `npm run typecheck`    | pass           |
| `npm test`             | pass, 57 tests |
| `npm run build`        | pass           |

## Criteria

| Criterion | Evidence                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------ |
| AC1       | `archive-session.test.ts` rejects capture before consent                                         |
| AC2       | same test returns the typed sentence as the clip                                                 |
| AC3       | `ask.test.ts` returns `unknown` for a question with no shared words                              |
| AC4       | `ask.test.ts` keeps Ada's and Lin's sentences apart                                              |
| AC5       | `archive-session.test.ts` null media URL, unknown ask, earlier seal refused                      |
| AC6       | import test reads the sibling `.srt` and rejects an unchosen path                                |
| AC7       | `ingest.test.ts` rejects `../outside.mp3`                                                        |
| AC8       | `encryption.test.ts` unlocks with passphrase and recovery key; key absent from `encryption.json` |
| AC9       | `policy.test.ts` and `engine.test.ts`: remote step `sent: false`, voice not installed            |
| AC10      | `scripts/release-assets.test.ts`; staging and production workflows call it before publish        |

No GUI pass was run. Playback uses the `kinlore://` media protocol inside Electron, which unit tests do not boot.
