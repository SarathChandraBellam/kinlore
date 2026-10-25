# Test cases 001

| ID   | Criterion | Level       | Priority | Given                   | When                                                | Then                                                          |
| ---- | --------- | ----------- | -------- | ----------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| TC1  | AC4       | unit        | P1       | empty temp dir          | create archive                                      | `kinlore.json` exists with format `kinlore-archive` version 1 |
| TC2  | AC4       | unit        | P1       | archive created         | save then list a person                             | listed person matches what was saved                          |
| TC3  | AC4       | unit        | P1       | archive created         | write then read media bytes                         | bytes are identical                                           |
| TC4  | AC4       | unit        | P1       | archive with person     | open the same path in a new provider                | person is still listed                                        |
| TC5  | AC4       | unit        | P2       | archive created         | save recording, story, keepsake, consent            | each list returns the saved entity                            |
| TC6  | AC5       | unit        | P1       | open archive            | writeMedia with `../outside.txt`                    | throws; no file written outside root                          |
| TC7  | AC5       | unit        | P1       | open archive            | writeMedia with an absolute path                    | throws                                                        |
| TC8  | AC5       | unit        | P2       | open archive            | savePerson with id `../escape`                      | throws                                                        |
| TC9  | AC4       | unit        | P1       | empty temp dir          | open without create                                 | throws                                                        |
| TC10 | AC4       | unit        | P2       | archive already created | create again on the same path                       | throws                                                        |
| TC11 | AC1       | integration | P1       | dependencies installed  | lint, format:check, typecheck, test, build          | each exits 0                                                  |
| TC12 | AC3       | unit        | P2       | core package            | TypeScript compile of a file importing domain types | typecheck passes                                              |
| TC13 | AC6       | review      | P1       | desktop main/preload    | inspect BrowserWindow + preload                     | isolation on, nodeIntegration off, typed contextBridge        |
| TC14 | AC7       | review      | P1       | storage package         | inspect encryption module                           | interface + TODO; no OS crypto calls                          |
| TC15 | AC8       | review      | P1       | repo root               | list OSS and CI files                               | required files present; CI runs the five scripts              |
| TC16 | AC9       | review      | P1       | tsconfig.base.json      | read compilerOptions                                | strict and noUncheckedIndexedAccess true                      |
| TC17 | AC2       | review      | P1       | package.json files      | read exports                                        | only `.` export; workspace names `@kinlore/*`                 |

Untestable or unclear criteria: none (Electron GUI launch is explicitly out of
scope for TC11).

Regression scope: none — greenfield.
