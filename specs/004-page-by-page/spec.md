# Spec 004: Working page actions and existing archive recovery

The user reported that Start attempts to recreate their existing default archive,
then requested page-by-page verification, an icy-blue theme, open/select/replace
choices for existing archives, and optional locally downloaded Gemma models.

- AC1: Startup detects an existing default archive and offers its appropriate next
  step (unlock or migrate), without invoking create or overwriting family data.
- AC2: Choosing an existing archive offers Open, Choose another folder, or Replace
  with backup. Replacement requires an explicit choice and a new passphrase; old
  contents remain in a separately named backup. A failed replacement restores the old root.
- AC3: Invoke calls are checked from preload through guarded IPC to a real temporary
  archive for Home, Family, Record, Memories, and Settings. Unsafe/unready forms
  show their prerequisite or validation before sending invalid IPC requests.
- AC4: AI draft validation matches the archive save parsers so accepted drafts can
  be saved. Initial AI settings failures provide retry. Raw Electron wrapper text
  is replaced with the useful underlying error.
- AC5: Local Gemma support is optional. No model/runner install or large download
  happens without the user's selection. No real family data is used for tests.

The existing archive must never be deleted as part of troubleshooting. Live UI
verification remains subject to approved Electron access; mocks are not represented
as a visual or microphone check.
