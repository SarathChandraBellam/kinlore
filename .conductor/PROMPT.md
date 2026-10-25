You are scaffolding the Kinlore repo in the current directory (created from the agentic-dev-starter template; read its AGENTS.md, .agents/ and specs/ first and keep their conventions). Product vision: .conductor/VISION.md.

GOAL: turn this template into a clean, modular, open-source Electron + TypeScript + Node.js desktop app skeleton for Kinlore. Ignore the old README's Tauri/Python mention: the stack is now Electron + TypeScript + Node.

REQUIREMENTS
- Monorepo with npm workspaces (or pnpm if already in template), modular packages, e.g.: apps/desktop (Electron main + preload + renderer, renderer React+Vite or similar, contextIsolation on, nodeIntegration off, typed IPC via preload), packages/core (domain types: Person, Recording, Story, Keepsake, Consent), packages/storage (local archive folder: open, documented, portable layout — JSON/SQLite metadata + media files under a user-chosen or app-data "KinloreArchive" folder; a StorageProvider interface so encryption via Windows DPAPI/macOS Keychain can be added later — leave a clearly marked TODO/interface, do not implement encryption), packages/shared or ipc-contract for typed IPC. Keep it minimal: interfaces + one working local implementation, no AI/ASR yet.
- Strict TypeScript (strict, noUncheckedIndexedAccess), project references or per-package tsconfig extending a base.
- ESLint (flat config, typescript-eslint) + Prettier, plus scripts: lint, format, format:check, typecheck, test (vitest), build, dev. Add a few real unit tests for packages/storage (write/read an archive in a temp dir).
- Open-source standards: README.md rewritten for Kinlore (use vision text, Electron stack, dev setup), LICENSE (Apache-2.0, copyright Kinlore contributors), CONTRIBUTING.md, CODE_OF_CONDUCT.md (Contributor Covenant), SECURITY.md, CHANGELOG.md, .editorconfig, .nvmrc, .github/ISSUE_TEMPLATE + PULL_REQUEST_TEMPLATE, .github/workflows/ci.yml running lint, format:check, typecheck, test, build.
- AGENTS.md: rewrite for this repo: architecture, package map, archive/data model, commands, coding standards (strict types, modular boundaries, no cross-package deep imports), security rules (local-first, nothing leaves the machine without explicit user action), roadmap. Make CLAUDE.md a short pointer to AGENTS.md (README links CLAUDE.md).
- .gitignore covers node_modules, dist, out, the local archive folder, .env.
- Simplest thing that works; don't add unused deps.

DONE MEANS: `npm install` then `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` all pass (run them; Electron GUI launch not required). Commit everything on the current branch with clear commits. Do NOT push.

FINALLY write .conductor/RESULT.md (max 20 lines): package layout, what's done, each check command with pass/fail, open issues/TODOs.
