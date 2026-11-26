# Preserve native border calibration diagnostics before the audit begins

Date: 2026-10-06 UTC. Diagnostic-only continuation of #775; no product or measurement remediation is claimed.

## Exact observations and missing evidence

At source `db7a1f43775c025b075cfd04bd4193b9db8a19f8`, contrast audit run `37404215143` stopped in all four shards at the newly added non-solid-border instrument calibration. Each shard passed the existing 25 calibration tests and failed the new test's exact exterior RGB comparison: expected `[255, 255, 255]`, observed `[255, 255, 247]`. No product audit cases ran. Canonical CI run `37404215176`, browser shard 5, reproduced that same failure while its other 58 tests passed.

The previous fixture did not retain its PNG, facts or ref/side/coordinates before the failure. Therefore the five consistent failures establish a deterministic observation to investigate, but do not locate the unexpected pixel. Glyph overhang, antialiasing, neighboring paint and coordinate effects remain hypotheses. The fixture is not moved or simplified, and the RGB assertion is not relaxed to match the observed value.

## Added observations only

The calibration now writes bounded, create-only phase records beneath the existing `RUNNER_TEMP/contrast-evidence/calibration` directory, starting before bundling/browser startup. A startup timeout can leave its last completed phase even though an external test-runner timeout need not execute a catch block. No PNG is invented if capture never occurred.

For the failing border fixture only, the actual PNG and exact authored HTML are saved as soon as capture returns. The ensuing facts record includes the actual viewport, DPR, scroll metrics, PNG dimensions, source HEAD, fixture/bundle/PNG hashes and complete measured facts. A failed assertion additionally identifies its ref, side, rectangle, sample point, recorded style/paint and numerical results. Diagnostic write failures are logged without replacing the original setup, capture or assertion failure. No broad environment dump, credentials, unrelated page or private screen is recorded.

All fixture markup/CSS, exact assertion expectations, screenshot options, viewport/DPR, numerical algorithms and the 30-second startup bound remain unchanged. The probe, selected-subject logic, Escape checks, Runtime/Adapters/spec, budgets and thresholds are unchanged.

The four contrast audit shards' existing `always()` artifact upload covers this directory even when calibration fails before the later server/audit step. Canonical browser shard 5 has a different `runtime-ci` upload path; this patch does not claim its saved PNG/facts will be uploaded. The four audit artifacts are the intended diagnostic source, with canonical failure text as additional evidence.

## Validation and next step

Local diagnostic-helper model controls, the existing 158 public-docs tests, narrow TypeScript, formatting and the existing 19 startup/toolbar contracts pass. No local browser was launched. These controls establish bounded persistence and unchanged expectations, not the cause or correction of the native pixel discrepancy.

Publish this diagnostic change normally, inspect the new source-bound PNG/facts and exact failure coordinates, then decide the smallest evidence-backed calibration or measurement repair. The next native run may remain red by design because its expectations were deliberately preserved. Prior native failures remain failures, and the selected-subject/Escape audit outcomes remain unmeasured until calibration succeeds.
