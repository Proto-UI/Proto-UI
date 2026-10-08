# Non-Compiler candidate batch orchestration

This is **public-development tooling**, not an admitted experiment, a real model result, an authorization artifact, or a replacement for the historical exchange gate. The independent oracle remains `candidate-unreviewed` / `not-admitted`. Discovery proposals require an independent semantic crosswalk. Valid JSON and keyword overlap cannot establish property coverage or equivalence.

## Offline preparation and coordinator API

The earlier local experiments used Node 24; the repository CI baseline is Node 22. Local Node 24 results do not establish CI parity. The API is in `scripts/benchmark/participant/batch-plan.mjs`:

```js
import { prepareBatch, inspectBatch } from './scripts/benchmark/participant/batch-plan.mjs';
const ready = await prepareBatch({
  directory: '/absolute/new-plan-directory', // parent must exist
  model: 'synthetic-not-a-model',
  stage: 'repeated-development',
  maxOutputTokens: 8192,
  wallMs: 180000,
  totalWallMs: 2400000,
  attemptCap: 12,
});
// Keep this digest outside the mutable plan directory, in coordinator evidence.
const plan = await inspectBatch({
  directory: ready.directory,
  expectedSha256: ready.planSha256,
});
```

Preparation never selects a provider, finds a credential, invokes a model, or sets a financial budget. It exclusively creates a new directory with exact task packets, wire request bytes, source snapshots and a digest-bound schedule. Inspection rejects changed request bytes, source inventory, captured/current source, packets, unknown fields, and self-asserted admission/review/billing. `plan.sha256` alone is not a trusted external digest. Hashes are not signatures. These are coordination checks, not malicious-host or loaded-module TOCTOU proof. Platform reference bytes still need separate retention and independent review.

`round0` has four slots (one per task × condition). `repeated-development` has 12 slots (three per cell): discovery AB/BA/AB, implementation BA/AB/BA. Order is predeclared and is not changed after viewing a response. This balances condition-first counts across tasks, **not all task/time confounds**. Every request is stateless: no previous response, prior submission, tool dispatcher or feedback. Identical repeated input hashes do not prove independent provider sampling, absence of caching, or an immutable model snapshot.

## Execution and boundaries

`scripts/benchmark/participant/batch-runner.mjs` exports `executeCandidateBatch({planDir, expectedSha256, directory, transportFactory, executionClass, chromiumPath})`. There is no default live endpoint or credential lookup. Tests inject hand-authored responses or an explicit literal-loopback HTTP server, and always use `executionClass: 'synthetic-controls'`.

The injected factory receives `{run, archiveDir, signal}` and must only construct a single-use transport, **not send a request or spend money**. It is trusted, nonblocking coordinator code. Its asynchronous waiting is deadline-bounded; late factory results are never dispatched. Ignored cancellation or blocking JS is not forcibly terminated. The transport receives only a recursively frozen request and AbortSignal. Request hash is verified before invocation. No retries or automatic restart are provided. An actual provider requires current human budget/route authorization and enforceable billing controls outside this API. `provider-attempts-unreviewed` is a provenance label, not admission or proof of real model origin; its real-model count remains unavailable until verified.

An attempt slot is reserved before construction; even failed constructors consume a slot. The report separately counts reservations and participant invocations. Transport errors, refusals, unsupported tool outputs, incomplete responses, invalid submissions, assessment blocks, and all unexecuted later slots remain present. Raw HTTP bodies and malformed responses are preserved by the injected bounded HTTP transport. An exchange timeout can finish while HTTP evidence is still writing; verify the final `transport.json` and file hashes separately. Never treat a retained prefix as a complete raw response.

Deadlines bound client waits and registered browser worker/process groups, not billing settlement, OS syscalls, escaped groups, provider processing, or a full OS sandbox. Browser launch, input staging, cleanup polling and evidence writes can extend elapsed time beyond the worker timer. Model and batch time controls are not money limits. Output token limits do not establish verified charges.

## Evidence, interruption and reports

Each batch keeps `execution-start.json`, per-slot `reservation.json`, `dispatch-intent.json`, `exchange.json`, `participant.txt`, assessment evidence and `result.json`, followed by `execution.json` and `report.json`. All writes are exclusive. A filesystem error can prevent terminal artifacts; starts and partial files are evidence, not completion. No persistence is guaranteed if storage fails before the initial journal is written.

`inspectInterruptedBatch({planDir, expectedSha256, directory})` is read-only. It identifies missing/corrupt terminal artifacts and unresolved slots, preserves reservation/dispatch uncertainty, and never resumes or retries. A dispatch intent without a result cannot prove whether a provider request happened. Terminal artifact existence is explicitly unverified, not authenticated success. Inspection requires a matching current source; retain the source snapshot for later offline forensic review when development advances.

`batchReport` reports all planned slots, outcomes, assessment coverage, check-layer counts, proposal-count distributions, request duration, partial unverified provider-reported usage, unavailable cost, exact-hash duplicates, and failing check-ID clusters. Incomplete layer summaries remain **null**, not zero. Check counts are repeated observations, not independent semantic properties or a conformance score. Failure clusters are check-ID grouping, not semantic clustering. Exact output identity is not semantic agreement, independence or cache proof. Synthetic reports always have `realModelRuns: 0` and `formalCompletion: false`.

## Verification

```sh
node --test scripts/benchmark/participant/batch.test.mjs
PROTO_BENCHMARK_BROWSER_TESTS=1 \
PROTO_BENCHMARK_CHROMIUM='/absolute/verified/chromium' \
PROTO_BENCHMARK_EVIDENCE_ROOT='/absolute/evidence-parent' \
node --test --test-concurrency=1 scripts/benchmark/participant/batch-browser.test.mjs
```

The end-to-end test deliberately returns a valid discovery proposal, an invalid proposal, an implementation with a known mutation, and a positive implementation. It checks request/raw archive hashes and uses **real Chrome** for positive/negative browser observations. This choice of output per slot is a diagnostic control, not a measured knowledge-assisted/blind effect, a model response or Round0.

Remaining exits: fresh independent oracle/executor/semantic review; authorized provider, snapshot/controls and enforceable financial cap; **real** Round0; policy freeze; three real independent attempts per formal cell, raw evidence, independent discovery adjudication, multi-dimensional report and limitations.

## Superseding next-batch decision (2026-10-05)

The user authorized zero-new-participant-call repair and offline reassessment only. The original four-cell, three-repetition run is **not approved**. New discovery calls are deferred. The next proposal is one actual Tabs modification/regression task with no extra docs, equal-information ordinary docs and Proto-derived docs, three fresh requests per condition. Its three randomized blocks and frozen policy are separate from this API's historical four-/12-slot matrix; do not pass it to the old runner or treat this document as authorization. See `trust-repair-next-batch.md`.
