# Refresh the integrated GPUI Checkbox session fixture

## Original native lane failure

The real Adapter lane for head `d9958d163436ea08d4a19b325d9e7f5dad3dc951` failed its source-vector check in [job 137840576178](https://github.com/Proto-UI/Proto-UI/actions/runs/45216953529/job/137840576178): `native/gpui/fixtures/base-checkbox-session.json` was stale. Later Rust and actual AccessKit controls in that job passed, but they do not turn the failed source-vector step into a pass.

Normal integration retained both reviewed repairs, current main `457d27f7fe554f398970a836ee9c95edb4846f47`, and the historical CI-boundary follow-up, producing source head `d946f7758a1f6a2bf7151aaea88989b80e8b8bd2`. The CI-boundary follow-up's old reusable-browser assumption is being corrected separately to preserve current main's manual-only browser entry; this record does not claim that unrelated gate is green.

## Formal generator red and green

The frozen install passed. The repository's unmodified `check:gpui-session-fixtures` command then failed with exactly one stale file, the Checkbox session. The official `gpui:session-fixtures` generator ran the real GPUI peer and current Base prototypes. A second unchanged check passed.

Only the Checkbox session JSON changed; Label, Button, Toggle and Switch fixtures retained their exact original bytes. The new capture records the current Checkbox's `readOnly` state, `resetValue` method, and actual `press.commit` registration order and lease identities. No fixture field, generator, runtime source, protocol or test assertion was hand-edited. The normal generator is the author of this JSON change.

The raw hosted failure, frozen-install and check output, formal generator output, before/after JSON, exact patch, driver and source-bound status are under `internal/records/evidence/2026-11-23-gpui-checkbox-session-refresh`. A successful source-vector regeneration is not a new Cargo/native or browser acceptance result. Those remain separately recorded on the final published head.

## Emitted-artifact count clarification

The earlier GPUI producer archive counted file-hash checks while iterating module receipt records. The original receipt causes 135 checks and the deduplicated receipt causes 132 checks. Both sets of records cover the same **132 distinct emitted artifact paths**, with identical bytes and hashes. The duplicate `scroll_reader` emission wrote the same directory twice; removing it does not remove three distinct generated files. The first Scroll reader consumer and all its artifacts remain.

This update gives those fields explicit record-count and distinct-path names in the earlier manifest, preserves every original raw archive and commit, and retains the actual path/hash comparison. These counts concern emitted artifacts listed in module receipts, not every extra file the consumer composition writes.

Agent: ChatGPT / Codex, continuing the user's authorized implementation and readiness work.
