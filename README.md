# Kinlore

Your family's stories, in their own voices.

Kinlore is an open-source desktop app that helps families keep stories told by
elders. It is local-first: recordings, transcripts, and keepsakes live in a
portable archive folder on your computer. There is no Kinlore account, server, or subscription. Nothing leaves the machine by default. Optional OpenRouter text assistance
requires your own API key, chosen model, and approval of each exact request.

Record an interview, import a voice note or home video, and ask a question.
Kinlore plays the moment someone actually answered, or it says the archive
does not have it. It does not invent memories, and it does not ship a speech
model: recordings can be saved without words. To search spoken content, type the
words that were spoken or import a subtitle file.

## What it will do

- A curious interviewer with follow-ups, in the family's languages
- Import WhatsApp voice notes, home videos, and old recordings
- Transcribe, diarize speakers, and turn sessions into stories
- Answer family questions with the real clip — never invented memories
- Keepsakes, a family cookbook told aloud, a timeline, sealed recordings
- Telugu, Hindi, Tamil, and English, including code-mixing

## Beliefs

- Real recordings first. Generated voice is optional, off by default, consented, and labeled.
- Consent is built in.
- Open source and an open, portable archive format. Models are swappable.
- Optional API keys stay in an OS-encrypted local secret file outside the archive. The app shows exactly which text would leave before each AI request.

## A family experience

The app has five main destinations: **Home, Family, Record, Memories, Settings**.
Create an encrypted archive with a passphrase and save its recovery key, add a
person in Family, ask for recording permission, then record and review their story. Typed words are optional. Memories contains recordings,
stories, keepsakes, recipes, timeline, seals, and questions that play real clips.

The design uses readable system fonts, visible keyboard focus, clear recording
states, and sky-blue and white surfaces with black text. Language is selectable in English, Telugu,
Hindi, and Tamil. The design and acceptance criteria live in
[spec 003](specs/003-family-experience/spec.md). Family usability research and
native microphone/accessibility checks are still needed; automated tests do not
establish usability.

## Optional OpenRouter assistance

1. Open **Settings → OpenRouter**. Enter your OpenRouter model identifier and API key.
   No model is chosen for you; saving settings does not contact OpenRouter.
2. In Record, describe an interview persona (their background, interests, and preferred
   tone) to generate tailored questions. Persona context is editable and is never
   automatically saved or sent. Use optional assistance in Ask, Stories, Cookbook, or Timeline too.
   For source-based tasks, explicitly select recordings that have transcript words.
3. Every participant must grant sharing permission in **Family**. Sealed recordings
   cannot be shared. For a generic interview question, no archive source is needed. A persona tied to
   a selected person requires that person’s sharing permission as well.
4. Review the destination, chosen model, and exact system/user text, then choose
   **Send this text to OpenRouter**. Cancel sends nothing. Each preview is single-use
   and expires after five minutes; archive, source, consent, or settings changes
   require a new preview. Provider charges may apply.
5. Interview questions are suggestions. Ask resolves model-selected IDs to original
   transcript clips. Story, recipe, and timeline output is labeled as an AI draft:
   check it against the original, apply it to the editable form, and explicitly save.
   Valid citations do not guarantee factual accuracy. Original transcripts stay intact.

OpenRouter and its selected upstream provider receive the previewed text and the
API key is used to authenticate with OpenRouter. No audio is uploaded, and there
is no automatic AI processing, transcription, generated voice, or telemetry.
Provider privacy and retention policies apply to text you choose to send.
Without a key or internet connection, local recording, listening, questions, and
archive tools remain usable.

The main process calls the [OpenRouter compatible HTTP API](https://openrouter.ai/docs/quickstart)
using Node's built-in `fetch`; this integration adds no SDK dependencies. Keys and model configuration are outside the portable archive in an OS-protected
local secret file. The app refuses to save keys if OS encryption is unavailable
(including Linux `basic_text`); it never falls back to plaintext. See
[Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage). Unit and integration tests
mock the transport and never require a real key or paid API request.

## Stack

Electron (main + preload + React/Vite renderer) and TypeScript on Node.js, as an
npm-workspace monorepo. The renderer runs with `contextIsolation` on and
`nodeIntegration` off.

| Path                    | Role                                                |
| ----------------------- | --------------------------------------------------- |
| `apps/desktop`          | Electron shell and UI                               |
| `packages/core`         | People, recordings, stories, consent, and the rules |
| `packages/storage`      | Local KinloreArchive, encrypted desktop archives    |
| `packages/interview`    | Question bank in English, Telugu, Hindi, and Tamil  |
| `packages/ask`          | Real-clip answers, including the whole family       |
| `packages/ingest`       | Audio, video, WhatsApp zip, and subtitle import     |
| `packages/secrets`      | API keys in a secret file outside the archive       |
| `packages/engine`       | Optional OpenRouter text; speech/voice unavailable  |
| `packages/ipc-contract` | Typed IPC between renderer and main                 |

## Develop

Requires Node.js 20+ (see `.nvmrc`).

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite renderer and opens the Electron window. The GUI
is optional for contributing to packages; the checks below do not launch it.

## Checks

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Format locally with `npm run format`.

Agent instructions live in [AGENTS.md](AGENTS.md). Claude Code also reads
[CLAUDE.md](CLAUDE.md), which points at that file.

## Archive layout

A Kinlore archive is a folder you choose, or `<appData>/KinloreArchive`:

```
<archive>/
  kinlore.json
  people/<id>.json
  recordings/<id>.json
  recordings/media/<file>
  stories/<id>.json
  keepsakes/<id>.json
  keepsakes/media/<file>
  consent/<id>.json
  transcripts/<id>.json
  interviews/<id>.json
  timeline/<id>.json
  recipes/<id>.json
  encryption.json
```

The archive stores JSON records and media behind the encryption codec. Copy the
folder to back it up. New desktop archives are encrypted from their first family write using AES-256-GCM.
A passphrase and recovery key wrap the data key. Existing plaintext archives open
read-only until encrypted in Settings; back them up before migration. Migration
is not transactional: an interruption can leave mixed files requiring backup restoration.
Wrapped keys are persisted before rewriting so already-encrypted files remain recoverable. People,
transcripts, other family records, and media are encrypted; format metadata, entity
filenames, and the wrapped-key envelope remain visible. The portable storage
library still supports a plaintext codec for explicit callers, but the desktop
app requires encryption for all family writes. API keys, if saved, live in an OS-encrypted secret file outside the archive. OpenRouter is contacted only after an explicit, reviewed text request.
Audio is never uploaded by this integration.

## Roadmap

The next milestones are family usability sessions, an improved first-story flow
based on observation, translation review, an optional local speech engine, and
installer accessibility testing. See the [design plan](specs/003-family-experience/plan.md).
Postgres, login, and hosted storage are deferred. This release keeps family data
on the local machine. Design feedback, language review, docs, and small regression fixes are welcome;
use synthetic examples, never private family media.

Longer-term direction:

1. **Record and listen** — interviews, family questions, real-clip answers, keepsakes, English and Telugu.
2. **Understand** — WhatsApp/video import, adaptive interviewer, ask the whole family, timeline, recipes, bring-your-own keys.
3. **Extend** — sealed recordings, opt-in style voice, encryption with a recovery key, more languages.

## License

Apache-2.0. See [LICENSE](LICENSE). Please read [CONTRIBUTING.md](CONTRIBUTING.md)
and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
