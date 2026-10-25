# Scaffold result

Layout: `apps/desktop` (Electron main/preload + React/Vite); `packages/core` (Person, Recording, Story, Keepsake, Consent); `packages/storage` (JSON KinloreArchive + StorageProvider); `packages/ipc-contract` (typed IPC).

Done: npm workspaces, strict TS, ESLint/Prettier/Vitest, OSS docs (Apache-2.0), CI, AGENTS.md/CLAUDE.md, local archive create/open/round-trip. Encryption is interface/TODO only.

| Command | Result |
| --- | --- |
| `npm install` | pass |
| `npm run lint` | pass |
| `npm run format:check` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass (11) |
| `npm run build` | pass |

Open: no AI/ASR; no DPAPI/Keychain encryption; Electron GUI not launched; npm skipped electron/esbuild install scripts here (build still ok).
