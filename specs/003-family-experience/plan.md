# Plan 003: Family experience and optional OpenRouter assistance

## Design notes

Reuse `ArchiveSession` for archive ownership and policy, `FileSecretStore` outside
the archive, `KinloreApi`/trusted IPC/preload for renderer access, the existing
real-clip Ask types, and existing save forms/parsers for accepted drafts. Keep
the local question bank and local Ask path available independently of AI.

Use Node's native `fetch` against
`https://openrouter.ai/api/v1/chat/completions`: OpenRouter documents direct HTTP
and its OpenAI-like schema. No OpenRouter, OpenAI, or Vercel SDK is needed for
these bounded single-completion operations. Source:
[OpenRouter quickstart](https://openrouter.ai/docs/quickstart) and
[API reference](https://openrouter.ai/docs/api/reference/overview).

Typed API direction: `LlmTask = 'interview' | 'ask' | 'story' | 'recipe' | 'timeline'`;
`prepareLlm({task, language, question?, personId?, recordingIds?})` returns a
preview containing a one-time token, model, task, exact outbound text, and source
details; `runLlm({token, approved: true})` returns a discriminated validated result.
`getOpenRouterConfig` and `saveOpenRouterConfig({model, apiKey?})` expose key status
but never stored key contents. The implementing agent settles exact type names.

Main owns bounded, expiring preview snapshots. Validate archive identity, source
content, seals, consent, and config again before sending; consume the token before
awaiting the provider to prevent concurrent replay. Recheck current state before
returning stale source-derived results. Clear pending previews when archive or
configuration changes. For selected multi-person sources require export consent
for every attached person, not only the UI-selected speaker. Generic interview
questions may use only the user-entered question/language without archive text.

Ask returns selected real clip references mapped back to original archive text and
times, rather than accepting model-invented quotes. Structured drafts validate
their shape and citation membership; human review remains necessary for factual
accuracy. Render model text as plain React text. Never execute model instructions.

Visual design: sky-blue/white surfaces with black text and a light web-app shell, readable
multilingual system typography, clear action hierarchy, large recording controls,
and separate setup/record/review states. No decorative dependency or remote font.

## Tasks

### Batch A: provider and archive behavior

- [x] T1: Add provider request/response tests first; implement fixed-endpoint fetch,
      timeout, bounds, safe errors, and strict result validation in
      `packages/engine/src/openrouter.ts`, its test, and public `index.ts` (AC7–AC9).
- [x] T2: Add typed config/preview/run contracts in `packages/ipc-contract/src/index.ts`;
      implement preparation, one-time approval, source/consent/seal validation, and
      configuration outside archive in `apps/desktop/src/archive-session.ts` or a
      focused adjacent assistance service, with session tests (AC4–AC9).
- [x] T3: Wire guarded handlers and thin preload methods in
      `apps/desktop/src/register-ipc.ts` and `preload.ts`; adapt capture to optional
      words/no transcript in `archive-session.ts` and optional `CaptureResult.transcript`
      (never persist an empty-segment transcript); add regression
      tests for capture with and without words (AC2, AC4–AC9).

### Batch B: family experience

- [x] T4: Restructure primary/secondary navigation, contextual Home/onboarding,
      Family, Memories, and Settings in renderer `App.tsx` (extract focused components
      as needed), `styles.css`, and `i18n.ts`; preserve secondary tools and hide sealed
      transcript text as well as its playback controls (AC1, AC3, AC6).
- [x] T5: Implement focused Record with permission/error states, visible recording
      state, stop/review playback, optional words, pending/save success, and microphone
      track/object-URL cleanup in renderer files (AC2, AC3).
- [x] T6: Add OpenRouter configuration and reusable exact-text preview/approval UI;
      wire interview suggestions, grounded Ask, and editable draft application into
      existing story/recipe/timeline forms; protect against stale results when changing
      sources/tasks/archives (AC4–AC9).

### Batch C: documentation, review, verification

- [x] T7: Update `README.md`, `CONTRIBUTING.md`, project intent/domain skills, and
      any stale user-facing claims about no remote text; document the optional provider,
      local default, source review, design structure, and contributor roadmap (AC10).
- [ ] T8: Fresh-context code/security review, resolve major findings, then all
      quality gates and synthetic-data UI checks. Record evidence and limits in
      `qa-report.md`; do not commit, push, publish, or make a real provider call (all ACs).

## Test strategy

| Criteria | Level                                         | Evidence                                                                                                      |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| AC1, AC3 | UI smoke + unit where pure state logic exists | Five destinations, all secondary tools, setup/returning state, keyboard and width checks                      |
| AC2      | Session integration + UI smoke                | Temporary archive, no transcript when omitted, searchable transcript when supplied, audio preview/save/replay |
| AC4      | Session integration + UI smoke                | Key presence only, outside archive, configured model survives session, zero fetch on save                     |
| AC5, AC6 | Session integration with injected/mock fetch  | Approval lifecycle, content/config/archive changes, exports, multi-person consent, seals, payload contents    |
| AC7      | Provider unit + session integration           | Valid interview result, clip mapping from original source, unknown and fabricated citation rejection          |
| AC8      | Provider unit + UI smoke                      | Valid/invalid draft shapes, no automatic writes, editable form transfer and explicit save                     |
| AC9      | Provider unit + regression suite              | HTTP/auth/rate/network/timeout/malformed/size failures; offline paths still work                              |
| AC10     | Documentation inspection                      | Current setup/provider/design/contribution guidance with mock-only tests                                      |

Use existing Vitest Node setup and adjacent `*.test.ts` files; no paid network calls
in tests. Follow `AGENTS.md` root commands; preserve existing security tests.

## Risks and rollback

- Remote text is a deliberate product-policy extension: label OpenRouter and its
  upstream provider and require review per request; never imply local execution.
- Models may hallucinate validly shaped drafts: label drafts, cite selected sources,
  retain originals, and require review before saving; do not claim schema equals truth.
- Archive locks, consent changes, and source seals can race with requests: invalidate
  snapshots and reject stale results; tested with deferred mocked fetches.
- Capture result's transcript becomes optional; update every consumer and regression
  test. No transcript is better than representing generated or empty words as attested.
- Reverting code restores previous UI/provider-free behavior; archives need no
  migration. User-accepted drafts are ordinary existing-format entities.

## Approved additional tasks

- [x] T9: Encrypted archive creation and read-only plaintext migration gate; OS-protected
      local secrets; mutation/approval race regression; persona request support.
- [x] T10: Passphrase/recovery setup, sky theme, editable interview persona, and
      regression-tested take isolation and applied-draft provenance.

Implementation notes: code and focused security reviews approved after fixes.
T8 remains incomplete only for live visual/native microphone/keyboard checks:
Electron UI access was not approved and the in-app browser host was unavailable.
No alternate UI-control method was used. Automated gates and rendering/state tests
are recorded separately in `qa-report.md`. Legacy migration now persists wrapped
keys before rewriting; it remains non-transactional and requires a backup.
