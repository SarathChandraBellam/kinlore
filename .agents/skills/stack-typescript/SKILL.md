---
name: stack-typescript
description: TypeScript conventions for this repo (strict config, workspaces, ESM, tests). Use when writing, editing, reviewing or testing any .ts or .tsx file.
metadata:
  type: stack
  technology: typescript
---

# TypeScript conventions (stack-typescript)

## Layout

- Packages under `packages/<name>/src`, apps under `apps/desktop/src`.
- Public API is `src/index.ts`. Tests are `*.test.ts` next to the code.
- Each package `tsconfig.json` extends `tsconfig.base.json` (`strict`,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `module: Node16`).

## Commands

Use the root scripts in `AGENTS.md`: `npm run typecheck`, `npm test`,
`npm run lint`, `npm run format`.

## Style and typing

- ESM (`"type": "module"`). Compiled packages use `.js` suffixes on relative imports.
- `import type` for types (`consistent-type-imports`).
- No `any`. Optional properties: omit them; do not assign `undefined` unless the
  field is `T | undefined` (`exactOptionalPropertyTypes`).
- `node` types in main/preload; `DOM` + `vite/client` in the renderer tsconfig.

## Errors and logging

- Throw `Error` with a useful message. Do not swallow IPC failures in main.
- Renderer shows `error.message` to the user; do not log archive contents.

## Tests

- Vitest, Node environment, files matching `packages/**/*.test.ts`.
- Storage tests write to `os.tmpdir()` and delete it in `afterEach`.

## Avoid

- Deep imports into another package's `src/`.
- Compiling the renderer with Node16 (it is Vite-bundled; use `moduleResolution: bundler`).
