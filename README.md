# Kinlore

Your family's stories, in their own voices.

Kinlore is an open-source desktop app that helps families keep stories told by
elders. It is local-first: recordings, transcripts, and keepsakes live in a
portable archive folder on your computer. There is no account, server, or
subscription. Nothing leaves the machine unless you explicitly export it or
bring your own API keys later.

Record an interview, import a voice note or home video, and ask a question.
Kinlore plays the moment someone actually answered, or it says the archive
does not have it. It does not invent memories, and it does not ship a speech
model: you type the words that were spoken, or you import a subtitle file.

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
- Optional user API keys stay in the OS keychain; the app will show exactly what would leave the computer.

## Stack

Electron (main + preload + React/Vite renderer) and TypeScript on Node.js, as an
npm-workspace monorepo. The renderer runs with `contextIsolation` on and
`nodeIntegration` off.

| Path                    | Role                                                |
| ----------------------- | --------------------------------------------------- |
| `apps/desktop`          | Electron shell and UI                               |
| `packages/core`         | People, recordings, stories, consent, and the rules |
| `packages/storage`      | Local KinloreArchive, plus optional encryption      |
| `packages/interview`    | Question bank in English, Telugu, Hindi, and Tamil  |
| `packages/ask`          | Real-clip answers, including the whole family       |
| `packages/ingest`       | Audio, video, WhatsApp zip, and subtitle import     |
| `packages/secrets`      | API keys in a secret file outside the archive       |
| `packages/engine`       | Swappable speech and voice engines (none installed) |
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

Pretty-printed JSON plus media files. Copy the folder to back it up. Encryption
is optional: a passphrase and a recovery key wrap the data key. The plaintext
archive stays readable until you turn encryption on. API keys, if you save
them, live in a secret file outside the archive. This build does not call a
network service with them.

## Roadmap

1. **Record and listen** — interviews, family questions, real-clip answers, keepsakes, English and Telugu.
2. **Understand** — WhatsApp/video import, adaptive interviewer, ask the whole family, timeline, recipes, bring-your-own keys.
3. **Extend** — sealed recordings, opt-in style voice, encryption with a recovery key, more languages.

## License

Apache-2.0. See [LICENSE](LICENSE). Please read [CONTRIBUTING.md](CONTRIBUTING.md)
and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
