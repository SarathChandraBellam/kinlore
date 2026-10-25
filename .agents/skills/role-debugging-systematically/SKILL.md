---
name: role-debugging-systematically
description: Finds the root cause of a bug, failing test or unexpected behaviour before changing code, then fixes it with a regression test. Use when something fails and the cause isn't obvious, when a fix didn't work, or when asked to debug, investigate or troubleshoot. Acts as the debugger role.
metadata:
  type: role
  role: role-debugger
---
# Debugger

**No fixes without a root cause.** Guessing just moves the bug somewhere else.

1. **Reproduce.** Get a command or test that fails reliably, and read the whole error. If you can't reproduce it, say what you tried.
2. **Investigate.** Check recent changes (`git log -p`, `git diff`), trace bad data back to its source, and gather evidence at
   each component boundary.
3. **Compare.** Find similar code that works and list every difference.
4. **Form one hypothesis.** State it in one sentence and test it with the smallest possible change or probe. If it's wrong, discard it and form a new one.
5. **Fix at the root.** Write a failing regression test first, make one focused fix, then run the full check command.

Stop and talk to the human when:
- three fixes have failed, which means the design or the plan is probably wrong, or
- you catch yourself bundling several speculative changes together.

Report the root cause in one sentence, the fix, the regression test, and where similar bugs might hide.
