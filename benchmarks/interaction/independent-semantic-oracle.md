# Independent semantic oracle candidate

The historical `independent-development-manual-tabs-v1-candidate` path remains a public-development candidate. The current `independent-development-manual-tabs-v2-trust-repair` path has a **bounded independent local review** of the role/cleanup repairs, not formal admission or global conformance approval. Neither path enables `run` in `benchmark.mjs`, modifies historical calibration checks, or admits model results. The exact review and source hashes are retained in the separate trust-repair evidence bundle.

The policy is in `scripts/benchmark/semantic/tabs-policy.mjs`; the evaluator in `tabs-oracle.mjs` imports neither product implementation nor control event logic. Accessible role/name selects unique targets. IDs resolve actual relationships; no fixture ID convention is required. Keyboard and pointer actions are real Playwright input, while DOM and Chromium AX reads support observation.

## Three layers and limits

- **Platform alignment**: Web roles, names, selected/disabled state, roving tab stops and present-view relationships, traced to ARIA 1.2 and APG Tabs. APG is authoring guidance, not a normative standard. Passing alignment checks is not full ARIA compliance or a screen-reader test.
- **Black-box journey**: independently authored actions from the public task, including manual navigation, explicit loop, activation, repeated selection, disabled pointer suppression and removal with either focus already on the surviving After control or Tab navigation from explicitly focused surviving Remove.
- **Proto alignment**: separately reported Web-observable observations mapped to pinned draft criteria. Internal context, controlled value, protocol identity, instance retention and full conformance remain untested. A duplicated layer observation is not another independent piece of empirical evidence.

All target names are task inputs, not implementation conventions. The candidate currently supports ordinary light-DOM HTML with inline code/styles and no external resources. Browser network controls do not prove participant filesystem isolation. Shadow-root relationship projection, framework builds and assistive technology are not covered by this slice.

Inactive panels may be rematerialized. Present panels must resolve reciprocal relationships; absent inactive targets are reported as **disputed**, not passed, failed, or silently reinterpreted using Proto. Independent review/adjudication and retained reference bytes are required before freezing that applicability policy. No public case is held-out. There is no automatic overall score or layer winner.

## Execute real controls explicitly

```sh
PROTO_BENCHMARK_BROWSER_TESTS=1 \
PROTO_BENCHMARK_CHROMIUM='/absolute/path/to/chromium' \
PROTO_BENCHMARK_EVIDENCE_ROOT='/absolute/path/to/evidence' \
node --test --test-concurrency=1 scripts/benchmark/semantic/tabs-oracle.test.mjs
```

Default `benchmark:test` collects these tests but skips browser cases unless the flag is set. A default green suite is **not** browser evidence. The trust-repair suite has eight positive structural alternatives (randomized IDs, wrappers, labelled names, generic tab controls, native-disabled tabindex-zero, rematerialized panels across those variants) and fifteen targeted negatives. Negative assertions name both the intended failed check and an unaffected check; discovery failures block the journey instead of selecting an arbitrary duplicate.

Each real browser evaluation preserves input bytes/digest, environment, browser version, per-layer checks/status/reasons, screenshots, DOM, AX, trace and logs. Evidence remains local outside Git. Input is bounded to 1 MiB; each launch/action has a timeout. **An outer process deadline and isolation are still required for arbitrary untrusted submissions**; the control suite's test timeout does not establish that security boundary. The candidate's admission remains closed.

See `internal/records/2026-10-05-noncompiler-value-experiment-plan.md` for the multi-stage outcome: real Round0 followed by frozen repeated first-batch results, not just completion of this oracle.

## POSIX worker deadline candidate

Use `boundedTabs` from `scripts/benchmark/semantic/bounded-worker.mjs` rather than calling `evaluateTabs` directly for a potentially hanging submission. It copies a bounded input into an exclusive evidence directory, runs a child worker, retains progress/logs, and applies a hard wall deadline. Playwright detaches Chromium into its own process group: the launcher records its PID before page execution, and the coordinator signals both registered groups. Cleanup is checked using the local process table; successful signal submission alone is not cleanup evidence. A real infinite-loop page and a normal control exercise this boundary.

An aborted result preserves input, start/receipt, logs and whatever progress was written. Missing `result.json` or incomplete trace is not a scored zero or passing run. The receipt records deadline termination separately from semantic failure. Worker and Chromium group cleanup is **not an OS sandbox**: escaped groups, crash-reporters, renderer exploits, storage/CPU/disk quota enforcement and other host processes are not proven contained. Do not admit arbitrary hostile code as safe or formal isolation on this evidence. This candidate supports POSIX only; Windows and Node 22 CI parity remain unverified; this phase used local Node 24. Existing in-process positive/negative controls are calibration, not participant runs.

## Bounded trust repair (2026-10-05)

The separate `independent-development-manual-tabs-v2-trust-repair` identity fixes role-attribute literal equality and cleanup's forced focus trajectory. Panel relationships use resolved role locators with hidden panels included: `tabpanel region` and unknown-leading fallback are accepted, whereas `region tabpanel` is not treated as a panel. Cleanup does not mandate automatic focus restoration; it accepts already-focused After or checks reachability from surviving Remove. Broken removal and a keyboard trap on surviving Remove remain negative controls. Independent review also found that a trap on After is outside this bounded journey; passing cleanup does not establish global keyboard-trap freedom.

These corrections do not settle the draft relationship-budget policy, Tab re-entry policy, screen-reader behavior, internal ownership, or cross-Adapter conformance. Round0 primary artifacts and prior exclusions are historical and remain unchanged. Offline reassessment has its own version and retains the broad relationship exclusions.

The next bounded task is a standalone Tabs settings modification/regression task, not a repository-wide conformance expansion. See `trust-repair-next-batch.md`. The old four-cell/12-slot runner is not authorized or suitable for that three-condition plan.
