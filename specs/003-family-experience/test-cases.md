# Test cases 003: Family experience and optional OpenRouter assistance

P1 automated cases use Vitest with temporary archives and mocked/injected fetch.
UI cases are explicit manual smoke checks because no browser/electron test harness
is currently installed. No real family archive, key, or provider charge is needed.

| ID   | Criterion | Level              | Priority  | Given / when                                                                                          | Then                                                                                                                      |
| ---- | --------- | ------------------ | --------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| TC1  | AC1       | UI smoke           | P1 manual | Open fresh Home, then configured Home                                                                 | Clear create/open or next-story action; five primary destinations; secondary archive tools reachable                      |
| TC2  | AC2       | Integration        | P1        | Save consented audio with omitted or blank optional words                                             | Recording/interview saved, no invented transcript; playback URL allowed                                                   |
| TC3  | AC2       | Integration        | P1        | Save consented audio with typed words                                                                 | Transcript contains exact words and local Ask returns the real clip                                                       |
| TC4  | AC2       | Integration        | P1        | Save without recording consent, with invalid media/language, or oversized words                       | Rejected without media/entity writes                                                                                      |
| TC5  | AC2, AC3  | UI smoke           | P1 manual | Record → stop → review → save; deny microphone; navigate away                                         | Playback preview works, state is clear, error is recoverable, tracks/URLs released                                        |
| TC6  | AC3       | UI smoke           | P1 manual | Trigger slow/error/success operations; use keyboard and narrow layout                                 | Pending visible, duplicate submission blocked, input retained on error, success announced, controls labeled/focus visible |
| TC7  | AC4       | Integration        | P1        | Save config/key, read config, recreate session, remove key                                            | Model persists outside archive; status only reveals key presence; fetch never called                                      |
| TC8  | AC4, AC9  | Integration        | P1        | Configure blank/oversized/invalid model or key                                                        | Safe validation error, existing valid state preserved                                                                     |
| TC9  | AC5       | Integration        | P1        | Prepare eligible task, inspect preview, cancel or omit approval                                       | Exact outbound user text/model/task/destination visible; zero fetch before approval                                       |
| TC10 | AC5       | Integration        | P1        | Approve same token twice or concurrently, or use unknown/expired token                                | At most one send; subsequent requests rejected                                                                            |
| TC11 | AC5       | Integration        | P1        | Change model/source text, switch archive, lock, revoke export, or seal source after preview           | Old token cannot send; no stale payload transmitted                                                                       |
| TC12 | AC5       | Integration        | P1        | Change archive/consent/seal while provider response is deferred                                       | Stale source-derived result rejected and not written                                                                      |
| TC13 | AC6       | Integration        | P1        | Select one eligible recording among unrelated/sealed/no-consent sources                               | Payload contains selected transcript only, no audio/path/key/unrelated text                                               |
| TC14 | AC6       | Integration        | P1        | Select recording with two people but export consent for only one                                      | Request rejected, regardless of selected speaker                                                                          |
| TC15 | AC6, AC9  | Integration        | P1        | Empty, missing, duplicate, unknown, oversized source selection or invalid task/language/question      | Deterministic validation; no fetch or partial archive writes                                                              |
| TC16 | AC7       | Unit + integration | P1        | Valid interview response for selected language/context                                                | Bounded suggestions returned for user choice; local prompts unchanged                                                     |
| TC17 | AC7       | Unit + integration | P1        | Ask response selects a supplied clip and invents text/times                                           | Returned clip text/times come exclusively from matching original source                                                   |
| TC18 | AC7       | Unit + integration | P1        | Ask returns unknown, no evidence, fabricated/other-person/sealed IDs                                  | Unknown or safe rejection; no unsupported source presented                                                                |
| TC19 | AC8       | Unit + integration | P1        | Valid story/recipe/timeline draft from eligible selected sources                                      | Correct task shape and source IDs returned; archive collections unchanged                                                 |
| TC20 | AC8       | Unit               | P1        | Invalid draft fields/citations, huge arrays, malformed JSON, or prompt injection text                 | Invalid shape rejected; content remains data and never becomes tool instructions                                          |
| TC21 | AC8       | UI smoke           | P1 manual | Generate draft, apply to matching form, edit, then save                                               | AI label/source visible, editable values, explicit save required, original words unchanged                                |
| TC22 | AC9       | Unit               | P1        | Mock 401, 402, 429, 500, fetch rejection, timeout, invalid JSON, empty completion, oversized response | Safe useful error, no secret/provider body echoed, no retry or archive write                                              |
| TC23 | AC9       | Unit               | P1        | Observe successful request with mocked transport                                                      | Fixed HTTPS endpoint, bearer header, chosen model, bounded tokens, timeout, no redirects to another host                  |
| TC24 | AC9       | Integration        | P1        | No key/config or offline provider, then local capture/browse/Ask                                      | AI reports configuration/failure; local functions remain usable                                                           |
| TC25 | AC10      | Documentation      | P1 manual | Inspect setup/design/contribution/provider guidance                                                   | Honest limits, optional provider, mock-only tests, accessible contribution paths                                          |
| TC26 | AC1, AC3  | UI smoke           | P2 manual | Select English/Telugu/Hindi/Tamil and revisit primary flows                                           | Language still selectable, no missing translation keys or broken text layout                                              |

Untestable or unclear criteria: none. Automated evidence does not replace family
usability research; document that limit in QA. Regression scope: existing archive,
consent, encryption, imports, sealed playback, local Ask, secret store, package
boundaries, and all root quality gates.

Additional encrypted-local/persona cases (AC11–AC12):

- TC27 / P1 integration: reject missing/short creation passphrase before archive files;
  save family records and media, verify encrypted bytes, reopen locked, unlock with
  passphrase and recovery. Legacy plaintext family writes reject until migration.
- TC28 / P1 unit: OS-protected secret payload hides keys, accounts, and model;
  migrate legacy secrets; fail closed for unavailable and Linux basic_text backends.
- TC29 / P1 integration: pause export-consent disk write; preparing or approving a
  request during mutation sends nothing, and completion invalidates older previews.
- TC30 / P1 integration: persona is exactly previewed, selected-person sharing is
  required and revalidated, invalid task/persona lengths reject without network.
- TC31 / P1 reducer: discard take A with words, capture B, verify no words carry over;
  recorder failure followed by stop cannot produce a normal partial take.
- TC32 / P1 reducer: apply/edit draft A then choose source B; all applied fields
  clear and B is the only source. Editing with A unchanged retains A.
- TC33 / manual: inspect sky-blue/white/black theme, modal passphrase confirmation,
  recovery-key acknowledgement, legacy migration, persona prompt flow, and narrow layout.
