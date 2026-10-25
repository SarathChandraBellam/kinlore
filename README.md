# Kinlore

Your family's stories, in their own voices.

Kinlore is an open-source desktop app that helps families keep stories told by
elders. It is local-first: recordings, transcripts, and keepsakes live in a
portable archive folder on your computer. There is no account, server, or
subscription. Nothing leaves the machine unless you explicitly export it or
bring your own API keys later.

This repository is an early skeleton (Electron + TypeScript + Node). Recording,
transcription, and the interviewer are not built yet.

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

| Path                    | Role                                                      |
| ----------------------- | --------------------------------------------------------- |
| `apps/desktop`          | Electron shell and UI                                     |
| `packages/core`         | Domain types: Person, Recording, Story, Keepsake, Consent |
| `packages/storage`      | Local KinloreArchive (JSON metadata + media files)        |
| `packages/ipc-contract` | Typed IPC between renderer and main                       |

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
  consent/<id>.json
```

Pretty-printed JSON plus media files. Copy the folder to back it up. Encryption
via Windows DPAPI / macOS Keychain is a planned extension, not implemented.

## Roadmap

1. **Record and listen** — interviews, family questions, real-clip answers, keepsakes, English and Telugu.
2. **Understand** — WhatsApp/video import, adaptive interviewer, ask the whole family, timeline, recipes, bring-your-own keys.
3. **Extend** — sealed recordings, opt-in style voice, encryption with a recovery key, more languages.

## License

Apache-2.0. See [LICENSE](LICENSE). Please read [CONTRIBUTING.md](CONTRIBUTING.md)
and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
