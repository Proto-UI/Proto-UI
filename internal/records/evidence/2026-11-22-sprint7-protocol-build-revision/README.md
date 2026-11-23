# Sprint 7 protocol rebuild authority repair

This is a separate continuation of original-source checkpoint `69bf36be7237d34e8c387c8422b039ea37677003` in [PR #1727](https://github.com/Proto-UI/Proto-UI/pull/1727). It repairs **PROTOCOL-BUILD-001** in the offline protocol implementation. All original checkpoint source, review and observations remain available in that parent commit; its record files are unchanged.

## Problem and changed behavior

The original broker recorded the revision after a successful build. A later build at the same source revision could fail or time out while leaving the earlier `built_revision` in place. The next `observe` action would pass the revision guard and start an observer against potentially stale or partially replaced output.

A legal build now clears that previous authority immediately after the installed-dependency check and before any typecheck or bundler work. Only the existing complete-success path restores it. Failed typechecks, failed bundling, timeout results and raised deadline exceptions therefore leave observation unavailable until a subsequent full success. The install prerequisite, fixed command capabilities, file restrictions, observation guard, finish semantics and provider transport remain unchanged.

## Actual regression evidence

The new test exercises the real `Broker.dispatch` transitions with explicit command/server/thread test doubles. Each of five cases starts with a successful build, attempts a failed rebuild without changing the source revision, requires rejection before `TCPServer` is called, then performs a successful rebuild and checks that the observer path becomes available and is cleaned up.

| Failure during same-revision rebuild | Original source | Repaired source |
| --- | --- | --- |
| Typecheck returns nonzero | Observer path incorrectly reached | Rejected before server creation; recovery succeeds |
| Typecheck returns timeout (`exitCode: null`) | Observer path incorrectly reached | Rejected before server creation; recovery succeeds |
| Bundler returns nonzero | Observer path incorrectly reached | Rejected before server creation; recovery succeeds |
| Bundler returns timeout (`exitCode: null`) | Observer path incorrectly reached | Rejected before server creation; recovery succeeds |
| Command raises a deadline exception | Observer path incorrectly reached | Rejected before server creation; recovery succeeds |

[original-rebuild-red.json](original-rebuild-red.json) retains the actual original-source run: one new test, five failing subtests, exit 1. The complete stderr is stored losslessly as gzip because its original progress lines contain trailing whitespace. The original broker is the exact Git blob at the parent commit, and the test bytes are identical to the repaired run.

[validation.json](validation.json) binds all four tested source files, the Python runtime and terminal outputs. The repaired candidate passes **9 model-request tests + 7 broker tests = 16**, including the five transitions above. No test was skipped. The original 15 tests remain present and keep their assertions.

```sh
python -B scripts/analysis/value-experiments/test-model-request.py -v
python -B scripts/analysis/value-experiments/test-consumer-broker.py -v
```

## Scope and remaining execution work

This closes the demonstrated failed-rebuild authorization defect in source. The commands, HTTP server and thread in the new transition test are test doubles. The test performs no actual package installation, typecheck, bundle, server listen, browser observation or model request. All live model/API/browser/install/consumer-build/consumer-observation/participant run counts remain **0**. These state controls do not establish a complete sandbox or all possible artifact freshness guarantees.

The complete live consumer stage, its task/starter/genuine distribution, dependency lock, declared runtime and stage-local build/observer entries still need their own frozen review and actual execution. The original finish/exit-0 semantics and unverified provider authentication remain as recorded in [the source checkpoint](../2026-11-22-sprint7-protocol-checkpoint/README.md). No experiment outcome, advantage claim, acceptance criterion, spec lifecycle or issue status has changed.
