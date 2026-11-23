# Sprint 7 offline protocol source checkpoint

This checkpoint recovers four previously uncommitted files from the original Sprint 7 experiment worktree, under the current user's instruction to continue the existing Sprint portfolio. Its base is freshly fetched main `38afc8942bfd245e12eaa661298c2feddbc63af8`. It preserves source and makes the existing offline protocol controls reviewable; it does not complete the experiment under [#750](https://github.com/Proto-UI/Proto-UI/issues/750).

## Preserved source

The four files under `scripts/analysis/value-experiments/` are `model-request.py`, `test-model-request.py`, `consumer-broker.py` and `test-consumer-broker.py`. All 35,356 source bytes are unchanged from the original untracked files at local head `dc3b184ba10b0de53e40359c52d012b204b2cd01` in `/workspace/scratch/b8a4839de6ed/s7-experiments`.

[source-preservation.json](source-preservation.json) records each original state, byte length, SHA-256, Git blob identity, import inventory and unchanged old-worktree status. There was no original commit for these four files; this restoration does not invent one or attribute an unrecorded author. The other 17 experiment scripts and the knowledge-consumer/Dialog changes are outside this checkpoint.

## Actual offline checks

[commands.json](commands.json) binds the exact interpreter, commands, source scope, terminal return codes and stdout/stderr hashes. The existing controls ran from this isolated worktree:

| Existing test file | Tests | Failures | Exit code |
| --- | ---: | ---: | ---: |
| `test-model-request.py` | 9 | 0 | 0 |
| `test-consumer-broker.py` | 6 | 0 | 0 |

To repeat these bounded checks from the repository root:

```sh
python -B scripts/analysis/value-experiments/test-model-request.py -v
python -B scripts/analysis/value-experiments/test-consumer-broker.py -v
```

The implementations import only Python standard-library modules. Each test file loads only its corresponding adjacent implementation. The tests construct their own temporary fixtures and exercise request/response validation, bounded file capabilities, rejection of invalid actions and paths, and the existing build-before-observe condition. They do not require the other experiment scripts or call either live executor entrypoint.

This continuation performed **0 model runs, 0 API requests, 0 browser runs, 0 package installs, 0 consumer builds, 0 consumer observations and 0 participant journeys**. Temporary fixture reads, writes and copies are test actions. The 15 passing controls do not establish a full process/network sandbox, complete consumer capability correctness, artifact admission or comparative product advantage.

## Separate inputs needed for live execution

`model-request.py` takes an operator-supplied packet, a fresh output directory and an explicitly configured inference endpoint. Provider behavior and authentication were not exercised here.

The complete `consumer-broker.py` runner takes a separately prepared and independently reviewed frozen stage. That stage must include `protocol.json`, `participant-system.txt`, `task.md`, its starter and genuine distribution, fixed-lock dependencies and a declared Node runtime. The build and observe capabilities additionally consume **stage-local** `build-submission.mjs` and `consumer-check.mjs`. Those inputs are not imports needed by the four-file offline test closure, and they are not supplied or executed by this checkpoint. A complete live consumer-run package remains outside the recovered scope.

## Known execution limits retained for follow-up

- **PROTOCOL-BUILD-001:** after a successful build, a later failed or timed-out build at the same revision does not clear `built_revision`. An observation could use stale or partially changed `dist`. Before live consumer execution, invalidate the previous build authority before rebuilding and verify failed/timeout rejection plus successful recovery, or independently prove transactional output freshness. The existing six tests do not establish this guarantee. The original source is preserved unchanged here so that a repair can be reviewed separately.
- **Finish semantics:** `participant-finished` and process exit 0 mean that a `finish` action was received. An action with `completed: false` can still end the protocol. Process termination is not task success, product acceptance or a successful participant journey.
- **Unverified transport/authentication:** the broker does not add `PUI_STUDY_API_KEY` as an Authorization header. Its live provider contract and authentication remain untested; the offline controls establish no provider compatibility.

These limits remain open. This checkpoint changes no experimental result, acceptance criterion, ownership, spec lifecycle or existing Sprint head, and performs no issue closure or merge.
