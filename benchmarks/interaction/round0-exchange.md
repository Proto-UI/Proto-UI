# Round0 exchange contract v1

This is an inert, **public synthetic development** exchange protocol. It checks copied bytes against declared inventories and coordinator-supplied expectations. It invokes no model, candidate, shell command, browser or oracle. `contract: valid` always accompanies `execution: blocked`, `isolation: unproven` and `oracle: unavailable`. Exit code zero means only that the requested contract operation succeeded.

The CLI deliberately uses `inspect`, not an execution-admission command. A caller-authored receipt, a new directory or a native subagent does not prove isolation. The existing `benchmark.mjs run` and every model/evaluation/held-out execution request remain blocked.

## Documents and data flow

The authoritative schemas and semantic limits are in `scripts/benchmark/round0-exchange-schema.mjs`; export their JSON shapes with `node scripts/benchmark/round0-exchange.mjs schemas`. All documents have `schemaVersion: 1`, a distinct `proto-ui.round0.*` kind and `scope: public-development-contract-only`. Unknown fields/kinds/outcomes are rejected. JSON Schema shape validation alone does not apply the inventory limits or cross-document rules; use the CLI/`validateExchange` as applicable.

1. The coordinator prepares a `proto-ui.round0.packet` plan with `packetId`, `source` and an explicit `files` inventory. Each inventory item has `path`, byte count `bytes`, and `sha256`. `source` holds `repository`, 40-character `revision` and `inventorySha256`. These are **declared provenance anchors**, not source capture or verified checkout identity. The coordinator must retain the independently approved source inventory and source bytes; this protocol cannot authenticate an invented inventory digest.
2. `pack` validates the entire input tree before reading declared payloads, snapshots exact bytes into `participant/`, and writes `packet.json` outside that directory last. The participant payload allows only a nonempty `task.txt` and `material-N.txt`. Nonempty bytes do not establish meaningful requirements. Task/arm/case meaning is the coordinator's responsibility; an opaque packet ID is not a semantic audit. Expose only the `participant/` directory in a future executor. Its sibling receipt contains provenance and is not participant input.
3. A synthetic producer supplies a `proto-ui.round0.submission` plan: `submissionId`, `attemptId`, `packet: {packetId, receiptSha256}`, the same `source`, `participant: synthetic`, `outcome`, and explicit `files`. The packet receipt digest hashes the exact canonical `packet.json` bytes. Candidate bytes live at `candidate/<filename>` and raw producer evidence at `evidence/producer.log`. The log is mandatory and nonempty; it is opaque, supplied evidence, not an authenticated model/tool trace.
4. `submit` verifies the packet and its bindings, validates the exact input tree, and copies inert bytes to `payload/`. `submission.json` is written last. A completed synthetic submission needs a nonempty candidate. Failed, aborted and excluded submissions retain any partial candidates, their log, and `evidence/disposition.json`. The disposition uses kind `proto-ui.round0.disposition`, matching `outcome`, code `synthetic-failure`, `synthetic-interruption` or `synthetic-exclusion`, and a nonempty reason. Unknown failures cannot become success.
5. `inspect` reads a separately supplied `proto-ui.round0.expected-submission`: `submissionId`, `attemptId`, `packet`, and `source`. It verifies both complete trees, exact receipt bytes, payload hashes, typed dispositions and every expectation binding. It creates a new inspection directory containing `inspection.json` and, when structurally valid, the original `expected.json`, including on rejection. A mismatch is rejected without modifying the submitted files. Preserve all three artifacts and the CLI logs together; an inspection directory alone is not a self-contained experiment archive.

Example command sequence with operator-prepared plans and **public synthetic** inputs:

```sh
node scripts/benchmark/round0-exchange.mjs pack \
  --plan /tmp/example-packet-plan.json --input /tmp/example-public-input --out /tmp/example-packet-001
node scripts/benchmark/round0-exchange.mjs submit \
  --plan /tmp/example-submission-plan.json --packet /tmp/example-packet-001 \
  --input /tmp/example-synthetic-output --out /tmp/example-submission-001
node scripts/benchmark/round0-exchange.mjs inspect \
  --expect /tmp/example-expected.json --packet /tmp/example-packet-001 \
  --submission /tmp/example-submission-001 --out /tmp/example-inspection-001
```

Use new output paths every time. This example describes file roles, not preexisting files or a model run. The executable tests construct all four outcomes and the malformed cases from public synthetic data. `pnpm benchmark:test` includes those tests automatically.

## Bounded files and interruption behavior

Each plan permits at most 32 files, 1 MiB per payload file and 8 MiB total. JSON plans/receipts/dispositions are bounded to 64 KiB; disposition reasons to 4096 characters. Paths are shallow allowlisted ASCII names. Absolute paths, traversal, nested candidate paths, hidden files, undeclared files/directories, symbolic links (including path ancestors), hardlinks and special files are rejected. Input reads check file identity/size and use bounded buffers; output must be separate from input trees. Use canonical paths without symlink ancestors.

Validation failures before copying do not create a packet/submission archive. Inputs and emitted command errors remain available and must be retained. Once a copy begins, errors preserve partial bytes and attempt an `incomplete.json` record. Storage failure or abrupt termination may prevent that record. Without the final receipt, inspection rejects the incomplete attempt; it never manufactures a receipt or deletes a failure. Reusing a packet, submission or inspection output path is refused. Successful and rejected inspections may be repeated in new output directories: this is audit replay, **not a global one-use execution lease**.

The caller must ensure a single owner with no concurrent filesystem writers. These checks are bounded at-rest packaging checks, not a sandbox against a process actively replacing directories during filesystem operations. They do not certify source authenticity, actual model identity, logs, chronology, secure isolation, behavior, durable storage or a trusted clock. Hashes detect differences against retained expectations; an owner can rewrite both bytes and manifests. This protocol provides no network denial or independent immutable storage.

## Compatibility and later gates

The exchange uses additive artifact kinds, separate from calibration run/result schema v1 and `p0-calibration-v1/v2/v3` archives. It does not modify, upgrade, reinterpret or accept those archives as submissions. Existing `benchmark.mjs verify` continues to verify historical calibration evidence; exchange inspection rejects old run/result documents. The public dataset, task text, fixture sources, scoring and oracle versions are unchanged.

Before a real Frontier development dry run, implement and independently review a separate executor with an enforced filesystem/Git/network/context/tool boundary, narrow artifact transport, measured negative leakage probes and protected evaluator storage. An execution boundary must be demonstrated on the actual executor, not supplied as a success string. Candidates need a reviewed semantic oracle rather than the fixture-ID checks; see [the separate follow-up plan](round0-semantic-oracle-plan.md).

Model access must identify the authorized provider and executable model, requested/effective supported controls, tool/context limits and stop policy. The operator must provide an enforceable per-cell and whole-attempt wall/token/cost budget where applicable, with currency and billing scope. Provider non-disclosures and unsupported controls stay explicitly unavailable; never invent model snapshots, seeds, usage, cost or run dates. This slice adds neither a model adapter nor a spending commitment. Real-model result/first-pass/repair/discovery schemas, raw provider/tool evidence and independently reviewed three-layer judgments remain separate work.

Round0 remains a tiny development exercise with no strategic conclusion. Public cases cannot become strict held-out. Formal comparison needs frozen `interaction-benchmark-v0`, predeclared scoring/conflict/repair policy and at least three independent repetitions per task/condition/model under the existing dataset policy. Current copied fixture repetitions do not satisfy that requirement.
