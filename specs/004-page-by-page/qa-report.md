# QA report 004: Working page actions, existing archive recovery, and desktop UI/UX hardening

Date: 2026-11-22 (Asia/Kolkata).

Verdict: **PASS for automated quality gates, live Electron end-to-end UI/UX verification, and macOS packaging dry-run** (physical microphone hardware capture remains an interactive hardware check).
No merge, commit, push, or public release was made.

## Quality gates

| Gate                                   | Command                | Result                                                                |
| -------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| Format                                 | `npm run format:check` | PASS, exit 0                                                          |
| Lint                                   | `npm run lint`         | PASS, exit 0                                                          |
| Types                                  | `npm run typecheck`    | PASS, exit 0                                                          |
| Unit/integration/rendering/state tests | `npm test`             | PASS, exit 0; 181 tests, 23 files; none skipped                       |
| Production build                       | `npm run build`        | PASS, exit 0; main, preload, and renderer bundles generated           |
| macOS packaging dry-run                | `electron-builder`     | PASS, exit 0; `Kinlore.app` (`darwin-arm64`) packaged and cleaned up  |
| Diff hygiene                           | `git diff --check`     | PASS, exit 0                                                          |
| Changed-line coverage                  | —                      | Not configured; no coverage claim                                     |
| Dependency/secret scan                 | —                      | No defined gate; no dependencies added, no credential files inspected |

## Acceptance evidence

| Criterion / cases | Evidence                                                                                                                                                                                                                                          | Result |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1               | `archive-flow.test.ts`, `experience.test.ts`, live Electron startup (`01-welcome-home.png`, `17-home-locked.png`): missing default archive shows Start CTA; existing encrypted archive opens locked onto inline unlock without calling create.    | PASS   |
| AC2               | `archive-choice.test.ts`, `experience.test.ts`, `existing-archive.tsx`, `archive-setup.tsx`: existing archive dialog offers Open, Choose another folder, or Replace with backup; backup retains old bytes and failed replacement restores root.   | PASS   |
| AC3               | `page-invokes.test.ts`, `ipc-guard.test.ts`, `media-protocol.test.ts`, and live Electron E2E run across Home, Family, Record, Memories (Recordings, Ask, Stories, Keepsakes, Cookbook, Timeline, Sealed), and Settings against a temp archive.    | PASS   |
| AC4               | `assistance.test.ts`, `experience.test.ts`, `archive-flow.test.ts`: AI draft length and parser alignment, initial OpenRouter config failure retry, invocation error unwrapping, and silent read-only queries (`nextPrompts`, `ask`, `askFamily`). | PASS   |
| AC5               | `openrouter.test.ts`, `engine.test.ts`, `SettingsPage.tsx`: local engines report offline status without background downloads or non-approved outbound requests; all tests and live QA run against synthetic temp archives only.                   | PASS   |

## Live Electron end-to-end & visual verification (`1220x820`)

Executed a live Electron 37.10.3 runner against compiled `apps/desktop/dist` and `apps/desktop/out/renderer/index.html` with an isolated temporary `--user-data-dir` (never touching `~/Library/Application Support/Kinlore`):

- **Console, page, and network health**: `0` console errors, `0` console warnings, `0` uncaught `pageerror` / `unhandledrejection` events, `0` unexpected failed requests, and `0` horizontal overflow (`scrollWidth === clientWidth === 1220`) across all 20 captured states.
- **Renderer isolation & permissions**: `window.kinlore` bridge present; `window.require` and `window.process` undefined (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`). `setPermissionRequestHandler` allows `'media'` and `'clipboard-sanitized-write'` only when `isAppFrameUrl(contents.getURL(), appUrl())` is true.
- **Encrypted archive creation & recovery key copy**: Passphrase modal (`02-create-archive-modal.png`) creates an AES-GCM encrypted archive and displays the one-time recovery key (`03-recovery-key-modal.png`). Clicking **Copy recovery key** writes to the clipboard and transitions to **`✓ Copied`**; the confirmation button remains disabled until the acknowledgment checkbox is checked.
- **Family consent & Ask the family**: Added two synthetic speakers (`Ammamma Lakshmi`, `te`; `Thatha Rao`, `en`), granted Recording / Archive / Sharing switches (`04-family-people.png`), and verified **Ask the family** (`09-family-ask-everyone.png`) returns distinct speaker clips with the separate-memories banner.
- **Record studio & media protocol (`kinlore://media/...`)**: Verified speaker selection, local question bank loading (`05-record-studio.png`), and saving 3 synthetic 16-bit PCM WAV recordings (`9644` bytes, `0.6s`). In **Memories -> Recordings** (`07-memories-recordings.png`), `<audio>` loaded metadata (`readyState === 4`, `duration === 0.6`), played cleanly, served `200 OK` on full fetch, and served `206 Partial Content` (`Content-Range: bytes 0-43/9644`, `Accept-Ranges: bytes`) on HTTP `Range: bytes=0-43`.
- **Memories tabs & seal enforcement**: Verified **Ask** (`08-memories-ask.png`, clip cards rendered above the `820px` fold immediately below the Ask form), **Stories** (`10-memories-stories.png`), **Keepsakes** (`11-memories-keepsakes.png`), **Cookbook** (`12-memories-cookbook.png`), **Timeline** (`13-memories-timeline.png`, labeled **Date** with event notes), and **Sealed** (`14-memories-sealed.png`, `15-memories-recordings-sealed.png`). Sealing a recording hides its transcript words and `<audio>` element everywhere, causes `window.kinlore.mediaUrl(...)` to return `null`, returns `403` on direct `kinlore://media/...` fetch, excludes the sealed recording from Story/Recipe/Timeline source pickers, and returns `"Kinlore does not have that in the archive."` when queried in **Ask**.
- **Settings, Lock/Unlock, and 4-language i18n**: Verified **Settings** (`16-settings.png`), locking to the inline **Home** unlock card (`17-home-locked.png`), toggling to **Recovery key** unlock (`18-home-locked-recovery.png`), unlocking with the recovery key, re-locking (confirming reset back to passphrase mode) and unlocking with the passphrase, and switching UI localization (`19-home-unlocked-telugu.png`, confirming `document.documentElement.lang` syncs to `'te'`).

## Issues found and resolved during QA

1. **Electron clipboard write permission (`apps/desktop/src/main.ts`)**: `setPermissionRequestHandler` previously allowed only `'media'`, causing `CopyButton` (`navigator.clipboard.writeText`) to fail silently in Electron. Fixed by allowing `'clipboard-sanitized-write'` for trusted app frame URLs; verified live (`copyButtonTextAfterClick === 'Copied'`).
2. **Inline form button alignment & banner spacing (`apps/desktop/src/renderer/styles.css`)**: Added `.inline-form > button { align-self: flex-end; margin-top: 0; }`, `.inline-form { margin-bottom: 16px; }`, and `form > .actions, form fieldset > .actions { margin-top: 12px; }`.
3. **Panel header badge & archive status bar wrapping (`apps/desktop/src/renderer/styles.css`)**: Set `.panel-header-row { flex-wrap: nowrap; }` with `.panel-header-row > div:first-child { flex: 1; min-width: 0; }` and kept `.archive-status-bar` on a single desktop row so count badges and the **Lock** button stay pinned right.
4. **Above-the-fold Ask results & silent read-only queries (`App.tsx`, `MemoriesPage.tsx`, `RecordPage.tsx`, `FamilyPage.tsx`)**: Added `{ silent: true }` to `run()` for `nextPrompts`, `ask`, and `askFamily`, and moved `<ClipList>` directly below the Ask form so returned clips appear at `top ≈ 509px` (well above the `820px` fold).
5. **Timeline date label, sticky recovery mode, and defense-in-depth seal guards (`ux-copy.ts`, `HomePage.tsx`, `shared.tsx`, `MemoriesPage.tsx`)**: Added localized `eventDate` (`"Date"`) for Timeline, reset `useRecovery` on unlock, filtered sealed recordings out of `RecordingSelect` by default, and added a sealed guard in `ClipCard`.

## Remaining interactive hardware boundary

Automated and live Electron tests verified the Record studio UI, `saveCapturedAnswer` IPC with real WAV audio bytes, and `<audio>` playback via `kinlore://media/...`. Physical microphone capture (`navigator.mediaDevices.getUserMedia({ audio: true })` with live ambient audio into `MediaRecorder` and the `AudioContext` RMS meter) requires a physical microphone input device and should be spot-checked by a human operator when testing on hardware.
