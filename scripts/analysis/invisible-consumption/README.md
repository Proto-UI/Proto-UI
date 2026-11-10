# Invisible generated-knowledge consumption — Issue #750

This directory prepares the existing [consumer experiment](https://github.com/Proto-UI/Proto-UI/issues/750). **No generated artifact, participant journey or benefit was measured while authoring it.** The checked-in `blocked.packet.json` truthfully has no artifact and no runs. The study remains behind its real artifact prerequisite and the maintainer's [0.4 deferral](https://github.com/Proto-UI/Proto-UI/issues/750#issuecomment-6684445067).

The experiment asks whether an ordinary consumer can discover/install, use, customize, debug and ship a real generated Button without Proto UI onboarding. It adds no package, public Compiler profile, component subset or release promise. `P-BASE-BUTTON`, `C-AS-TRIGGER-0001`, `C-EXPOSE-EVENT-0001` and `T-BASE-BUTTON-0001` remain draft; `C-PROPS-0001` is active. The experiment does not promote them.

## Fixed inputs and consumer boundary

`protocol.json` binds the exact task and all seven starter files, React 19.2.6, `react-dom-source-v1`, the five stages and a 60-minute window. The declared TypeScript, Vite and React type versions come from the current repository lockfile. The operator captures exact Node24, npm, OS, browser and the actual dependency lock before releasing any task. Do not silently change controls between participants.

Give an uninformed participant only `task.md`, a pristine copy of `starter/`, the actual distribution with its ordinary instructions, and ordinary framework/tool documentation. Keep this README, producer, observer, Compiler source, internal docs, admission records and other participants' answers outside their workspace. Keep generated source, helpers, maps, dependency declarations and provenance intact; unavoidable provenance revelation is an observation, not something to redact. Someone who has already worked on Proto UI cannot supply the primary no-onboarding baseline. Record prior framework/library experience and prior internal knowledge for each sanitized participant or Agent alias.

The starter is an ordinary unfinished app task, not a replacement component. It intentionally has no supplied Save Button. `storage.ts` implements actual browser-local persistence and a 600ms save operation. Its checkbox injects an explicitly disclosed storage error so the participant can debug pending/disabled/recovery behavior. This injected application error is not a discovered component bug. No reference package is selected. An optional later reference calibration has a separate manifest/report and only a matched task subset; do not pool it into generated-artifact rates.

The current job was supplied by the experiment, not independently discovered demand. No follow-on product is selected. Before moving beyond Button, preserve the [demand companion requirements](https://github.com/Proto-UI/Proto-UI/issues/750#issuecomment-5909770134): concrete job, dated firsthand source, recurring workaround/cost, alternatives, insufficiency, switching cost and observable voluntary adoption. Existing solutions satisfying the job cheaply are a valid reason to defer a product. Consumption, demand and optional two-target maintenance economics remain separate.

## Main-only serial execution

These commands are **proposed, unrun**. Main owns the portfolio's single heavy slot, dependency setup, all native instances, independent review and external writes. Run repository commands in the supplied Issue #750 worktree using Node24. No worker should execute them to refresh evidence.

First run only the admission/accounting controls and the real missing-prerequisite producer:

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node --test scripts/analysis/invisible-consumption/test/study.test.mjs
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node scripts/analysis/invisible-consumption/study.mjs scripts/analysis/invisible-consumption/blocked.packet.json .
```

The second command must return `blocked-prerequisite`, `observedRuns: 0`, `measurements: null`, and `originalCriteriaComplete: false`. The synthetic tests challenge abandonment, install failure, prior knowledge, changed controls and output, absent generated artifacts, unbound admission, unsupported compilation, runtime leakage, failed builds, chronology, production capture, edit preimages and missing explanation/change evidence. They execute no generated component and are not study results. There is no claimed product regression or failed-before run: the base has no experiment collector.

Prepare the **unchanged official Base Button**, not a reduced fixture or handwritten substitute:

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node --import tsx scripts/analysis/invisible-consumption/produce-button.mjs prepare /tmp/i750-main-01
```

The real existing `compileFile` and `writeCompilation` APIs read the direct Base Button source closure, emit `react-dom-source-v1` with `GeneratedButton`, and create an external source distribution plus a separate informed operator app. The producer preserves compiler input bytes, Compiler source bytes, repository lock, actual compile/write diagnostics, every generated artifact including hidden helpers, and exact hashes. `candidate.json` is explicitly **not admitted**. Any source rejection or missing dependency leaves the actual failure intact and the study blocked; route Compiler defects to the existing owner.

For an independent unsupported-profile boundary, Main may run the actual CLI once, retaining its real stdout/stderr/exit and confirming it created no output:

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node --import tsx packages/compiler/src/cli.ts compile --root . --entry packages/prototypes/base/src/button/button.proto.ts --profile react-dom-ssr-v1 --output /tmp/i750-unsupported-01 --json
```

The expected boundary is a nonzero unsupported-profile diagnostic, not acceptance of public SSR. A different setup/parser failure must retain its real classification. Do not replace it with the private SSR harness or a runtime-backed profile.

In `/tmp/i750-main-01/clean-consumer`, Main installs the exact declared external dependencies in this independent project:

```sh
env PATH=/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin:$PATH npm install --ignore-scripts --no-audit --no-fund
```

Record actual npm version, registry and command outcome. The producer has not installed anything. A failed install remains a failed prerequisite; do not link workspace/source `node_modules` to make it pass. Then, back in the Issue worktree:

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node --import tsx scripts/analysis/invisible-consumption/produce-button.mjs verify /tmp/i750-main-01
```

`verify` runs the real `npm run build` (`tsc --noEmit` and Vite production build), retains command status/stdout/stderr, binds the production files and package-lock, compares delivered and consumer generated bytes, and uses the existing `verifyConsumerClosure`. It keeps the original compiler provenance unchanged and uses the established dependency-only projection for closure inspection. Two explicitly injected controls must be rejected for `undeclared-import` and `missing-helper`. These controls are not product defects or naive-consumer observations. `clean-consumer.json` remains `operator-preflight-only`, even after success.

Start an owned, managed preview in `/tmp/i750-main-01/clean-consumer`:

```sh
env PATH=/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin:$PATH npm run preview -- --port 4750 --strictPort
```

After that exact preview is ready, execute in the Issue worktree:

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node --import tsx scripts/analysis/invisible-consumption/observe-button.mjs /tmp/i750-main-01 http://127.0.0.1:4750/
```

The observer binds the served index and script/stylesheet responses to the actual production bytes. Its nine native checkpoints are enabled, pointer activation, Tab focus, Enter activation, Space held, Space released, disabled, attempted disabled pointer activation, and re-enabled activation. It retains PNGs, geometry/hit/focus/disabled/count observations, a finite 250ms disabled rejection observation, native errors and a Playwright trace. Review every adjacent image pair. The unstyled Base shell has no admitted family paint: do not label a count, computed color or screenshot as complete visual-family, accessibility-technology or Adapter parity. Stop only Main's owned preview after capture. A native failure is a prerequisite finding, not a study outcome.

For the **participant's actual production app**, inspect enabled → saving/disabled → success, enabled → saving/disabled → injected error → enabled recovery → successful retry, keyboard focus/Enter/Space, and saved name after reload. Use the participant's actual build/preview commands and retain their command receipts, output bytes, edited source and adjacent captures. The operator preflight app and observer cannot replace that journey.

Formatting and all checks remain Main's work. If task/starter formatting changes before the first run, preserve these preimages and update protocol bindings and the source manifest before releasing any task. Once measurements exist, use a separately frozen protocol rather than rewriting measured inputs. Product dependency linking may be needed because the worker's checkout initially has metadata-only dependencies. Missing setup is not a passing test or a compiler regression.

## Content-bound artifact admission

A file reference is `{path, sha256}` relative to a compact evidence directory. All referenced files are regular files confined to that directory. Reuse `scripts/benchmark/evidence.mjs` to copy selected actual files with `writeNew`, then `sealEvidence` the complete compact tree after recording. Do not include installed `node_modules` or fabricate receipts. The existing full-tree `verifyEvidence` rejects missing, added, symlinked or changed archive bytes. Keep every failed producer attempt separately.

The artifact manifest consumed by `study.mjs` requires these actual fields:

| Field | Required evidence |
| --- | --- |
| `schemaVersion`, `kind`, `scope`, `profile`, `target` | `1`, `generated-source`, `Base Button`, the exact protocol profile/target |
| `sourceRevision`, `compilerRevision`, `inputs` | Actual exact commits and source preimages; preserve dirty-source/producer hashes as additional provenance rather than pretending HEAD describes edited bytes |
| `outputs`, `outputInventorySha256`, `provenance` | Every emitted file and unchanged original provenance, including supporting files; `outputDigest(outputs)` binds the sorted physical inventory |
| `distribution` | `method: directory-copy`, its actual relative `directory`, and a bound ordinary `instructions` file; no public package is implied |
| `recipe`, `generation`, `compileResult` | Reproducible real operator recipe, actual successful generation command receipt and compiler `ok: true` result |
| `cleanConsumerBuild`, `shippedFiles`, `lockfile`, `consumerClosure` | Actual independent production build and nonempty output, exact package-lock, and native closure success with no internal packages |
| `supportedBehavior`, `omissions` | Each claimed behavior has actual bound evidence references; omit unsupported/untested behavior explicitly |
| `review` | Actual admission record with `disposition: admitted-for-experiment`, the same `compilerRevision`/`outputInventorySha256`, and its real repository Issue/PR review URL |

Command receipts contain exact `argv`, `cwd`, ISO `startedAt`/`finishedAt`, actual `exitCode`, `signal`, `error`, and bound `stdout`/`stderr`. A successful wrapper with compiler `ok: false`, missing output, nonzero build, unresolved helper, source link or internal import cannot admit the artifact. A #736 merge, a nominally implemented profile, a self-authored JSON review or Happy DOM trace is insufficient. Main must independently establish actual execution, rights and admission from the real platform/source evidence. The reducer validates bytes and required relationships; it does **not authenticate** those facts.

No admitted manifest is checked in because no genuine artifact is supplied. Main can form it only from the real producer/consumer/native/review results. If any prerequisite is unavailable, preserve `artifact: null` and keep Issue #750 staged/open.

## Actual participant recording and reduction

Start the operator-only clock recorder in a fresh external directory:

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node scripts/analysis/invisible-consumption/record-events.mjs /tmp/i750-p01
```

On actual task delivery, send one JSON line with `kind: release`, the real `protocolSha256`, task SHA and sanitized `participantAlias`. The task SHA is pinned in `protocol.json`; compute the protocol SHA from its actual file bytes. Send stage events as the observations happen, with `stage`, `kind`, `detail` and bound `evidence` references; `finish` ends recording. The recorder, not the sender, supplies monotonic offsets. It preserves received input, released input, events and the clock receipt. EOF/error before finish is a recorder interruption, never participant completion or abandonment. Receipt timing measures observation delivery; document actual task-delivery brackets and observer delay. Do not estimate missing timestamps or relabel an interrupted recorder as a measured failed consumer.

A session file combines the actual clock/events with:

- `schemaVersion: 1`, unique `id`, and `evidenceClass: observed-consumer` or `injected-control`;
- exact `protocolSha256`, `artifactManifestSha256`, task SHA, `controlLockfileSha256` and the starting `environment` copied from frozen controls;
- `initialApp`: one `{starterPath, file}` for every original starter preimage;
- `participant`: sanitized `alias`, `frameworkExperience`, `libraryExperience`, `priorProtoKnowledge` (`none`, `some` or `unknown`);
- `startedAt`, `endedMs`, `clock: monotonic-ms-from-task-release`, bound `rawLog`, actual `events`, `limitations`, and an operator `interpretation` with `verdict` (`supported`, `weakened`, `inconclusive`, `falsified`) and `reason`.

Stages start in protocol order and terminate with `completed`, `failed` or `abandoned`. Ordinary unsuccessful attempts inside a continuing stage are `step` events with their retained diagnostics. Additional kinds are `successful-use`, `internals`, `escape-hatch`, `edit`, `explanation` and `capture`. Record why internals or a bypass were necessary, not just their counts. Every event has source-bound evidence. A successful discover/install terminal event includes the actual `installedLockfile`; an unsuccessful installation needs no invented lockfile. A completed ship terminal event requires the participant's actual successful `build` receipt, `shippedFiles` and a preceding production-browser `capture` event. A source `edit` includes actual `before`, `after`, `diff`, `ownership` (`app` or `generated`) and `consumerPath`; for generated edits the path is relative to the generated directory and its first preimage must match the admitted output. Subsequent edits chain from the prior after hash. Record app edits as well as generated edits, and retain the complete final consumer source.

The packet has `schemaVersion: 1`, an actual `artifact` file reference, frozen `controls` (`target`, exact `environment` and `lockfile`), and all session references in `runs`. Never omit failures/abandonments. A changed dependency lock, exceeded window, prior internal knowledge or injected control stays in the report with its explicit exclusion; failed installation remains an attempted primary task. Invalid/contradictory evidence makes reduction fail and preserves the raw input; it is not silently dropped. Runs missing actual code-change/explanation evidence do not enter completed-task counts.

After copying the bound actual artifacts into `/tmp/i750-evidence-01`, writing the actual packet there and sealing that compact evidence tree, Main can execute the after-admission/reduction command:

```sh
/home/ezra/.npm/_npx/387698761821791d/node_modules/node/bin/node scripts/analysis/invisible-consumption/study.mjs /tmp/i750-evidence-01/packet.json /tmp/i750-evidence-01
```

This is the meaningful before/after input boundary: absent artifact → blocked/no measurements; real independently admitted artifact plus retained actual sessions → attributed observations. Both outputs retain all original source keys and `originalCriteriaComplete: false`. Main's independent review must decide original-condition completion and lawful integration; the tool never closes the Issue.

## Interpretation and remaining original work

The measured scope is one artifact/profile/version/task, not a whole library. Package/docs maturity, framework familiarity, generated-code style, provenance visibility, participant experience, supplied task realism, local storage, tooling, observer delivery, warm caches and optional reference selection are confounders. Task completion is not voluntary adoption, business usability, overall UX or cross-target maintenance savings. Preserve weakened, inconclusive and falsified outcomes, including a consumer who must learn internals or cannot finish. No preference or satisfaction result is required.

The dated record in `internal/records/2026-11-10-invisible-consumption-750.md` retains every original `issue.750.001`–`issue.750.005` condition and current source/ownership boundaries. All five remain pending actual evidence and integration. A source-ready producer, the synthetic controls and the missing-artifact guard do not complete them.
