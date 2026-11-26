# Sprint 5: program-owned tint-source boundary

## Observed integration failure

PR #1738 head `d9958d163436ea08d4a19b325d9e7f5dad3dc951` completed the real documentation production build in [run 45216953529, job 137840575461](https://github.com/Proto-UI/Proto-UI/actions/runs/45216953529/job/137840575461), but its bundle checker reported four issues. The two exact material diagnostic entries each reached `packages/adapters/base/src/material/style-tint-source.ts`, a new internal dependency of the already reviewed optical program, without that module being in the finite reviewed list.

The unchanged production artifact is ID `14837573771`, archive SHA-256 `ee4770712812d43cc730c2abea635c02e121172d981d1ab9089dde190a48a44e`. Its real graph is 5,054,925 bytes with SHA-256 `822cb367cf0eb8addece00c3e97154626530b7a8d3624ca962cdb744ad88c975`. The archive digest was verified before extraction. Neither the graph nor its original failure log was edited.

## Bounded change

Add only that exact material module to the existing diagnostic list. The two reviewed route facades must still actually import their exact tint-stage or visible-refraction producer, and their producer must own the program and this dependency through complete unique module edges. The original finite static site-control bridge, framework/Adapter rejection, route bypass detection, copied identity rejection, and global server-only wall are unchanged.

Independent source review followed each real route to its producer, then `material/program.ts` to `style-tint-source.ts`. The new module contains TypedArray arithmetic and internal numeric preparation, with no imports or framework/runtime entry. The finite list remains scoped to the two material diagnostic owners and grants no ordinary Website shell permission.

## Executed validation

- The exact original d995 checker reproduces all four original issues on the original production graph.
- The candidate checker reports zero issues on those same bytes. The graph hash is identical before and after both calls.
- The complete bundle checker suite passes **2,082 / 2,082**, with **0 failed and 0 skipped**. The prior 2,064 controls remain present.
- The 18 added controls cover both exact routes, static and dynamic delivery, direct and intermediate source bypass to the same module, ordinary shell imports, and emitted chunk presence after source ownership is removed. Every negative control first proves its unmodified graph is valid and then checks the exact expected issue.
- Prettier and `git diff --check` pass. Tested source hashes remain identical after the run: checker `4d9cf1dd97f00afa77d39184c4df2573f4fc985ab3dc53139145e3b1afbc46ff`; test `1203eb1dfc9756c4b44bcd123acc7180f5e2f3e4a8f4d55e16314e51f0a3146c`.

The first validation wrapper expected TAP summary prefixes, while Node 24 emitted the spec reporter's summary prefixes. All three actual commands had already exited zero, but the wrapper failed while parsing the counts. Its unchanged failed status is retained. A separate finalizer reads the unchanged raw log, checks the exact 2,082/2,082 result, verifies source hashes and graph replay, and performs the difference check. No test result was rewritten and no passing test run was repeated to conceal the wrapper failure.

## Evidence and review boundary

Raw graph, original build log, original and candidate checker source, candidate tests, complete test output, original wrapper status, finalizer status, replay report and drivers are retained under `internal/records/evidence/2026-11-23-sprint5-tint-source-boundary`. The manifest records original and compressed byte counts and SHA-256 digests.

Two other team agents independently reviewed the actual source ownership chain; the root agent also read the final checker/test diff and replay results. This is source review, not GitHub approval. This gate repair does not claim a new production build, browser acceptance, GPUI native acceptance, merge, or release. PR #1738 remains Draft while its separate real browser cleanup failure is being repaired.

Agent: ChatGPT / Codex, continuing the user's authorized implementation and readiness work.
