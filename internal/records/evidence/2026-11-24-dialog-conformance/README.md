# #754 executed Dialog discrimination evidence

The [dated report](../../2026-11-24-dialog-conformance-discrimination.md) explains the observations and their limits. [summary.json](summary.json) keeps the original 28 checks separate from five added observations and distinguishes public calibration from independently authored held-out variants. [manifest.json](manifest.json) binds every member of [raw-evidence.tar.gz](raw-evidence.tar.gz), which was read back after creation.

## Scope

The subject is `d0eb81d3c61c3d3e93e46c4151e78031273d6116`. Node 24.22.3, pnpm 10.32.1, Vitest 2.1.9 and HappyDOM 15.11.7 executed actual WC Adapter/Base Dialog modules. Input was synthetic, entry was explicitly completed, and no browser paint, native input, screen reader or model result is claimed. Original unchanged early-entry checks passed 26/28; those two failures remain outside settled-entry mutation scoring.

Final collection: nine cells, 297 assertions, 274 pass, 23 deliberate mutation failures, zero skips. Runner exit 1 retains the failures; reducer exit 0 admits the completed evidence. Five component-contract mutants were caught by existing checks. The Cancel-to-Save application mutant passed all existing checks and failed the added action observation. Two legal customizations passed all 33 checks each.

## Contents and preservation

- `final-09/`: all nine complete cells and the final report. Each cell contains original source snapshots, injected source when applicable, prepared-check source and transform receipts, raw Vitest JSON, step observations, process-exit integrity, exact command status and runner logs.
- `attempt-04/`: the six public calibration cells and their report before combined held-out execution.
- `attempt-01/`, `attempt-02/`, `attempt-03/`: setup failures, interrupted collection and the raw 26/28 baseline. Their interruption records are retained beside the directories. Incomplete cells remain incomplete.
- `focus-isolated.*`, `focus-cancelable.*`, `focus-enter-completed.*`: the isolated failure, rejected cancelability hypothesis and explicit entry-completion diagnosis, including actual filtered counts.
- `original-source/`, `public-calibration-plan.json`, `wc-overlay-before-cancelable.ts`: historical preparation and source bytes.
- `check-freeze.json`, `root-heldout-variants.json`: checker freeze followed by a different Agent's three variants and expectation review.
- `remote-preflight/`: actual original-plan guard rejection and nine classifier controls from the device, copied with tool-returned SHA-256 verification.
- `github/`: #754 body, all four comments, and read-only owner-scope snapshots. #1191 is mobile navigation, not shared Focus; the current new failure inventory routes to open #1178 with closed #1161/#1177 retained as historical scope sources.
- `governance/`: scoped Agent preparation and validation records. Their early pending states remain historical; they are not rewritten to look completed at the original time.

These raw bytes are historical evidence. Formatting or editing them changes their meaning as source-bound receipts. The maintained runner refuses drift in the pinned source/fixture/checker inputs. Future semantic or source changes need a new study revision and preserved old observations.

## Reproduce execution

Use a checkout containing this study and the pinned subject inputs, with Node 24 and the locked repository dependency installation. Use a new output directory outside the checkout. The small integrity/classifier suite is:

```sh
node --test scripts/analysis/dialog-conformance-study/report.test.mjs scripts/analysis/dialog-conformance-study/source-variant.test.mjs
```

The complete bounded study is serial and takes one worker. Supervise it with the local watchdog; intentional mutants make its actual command exit 1. Run the reducer afterward as a separate command; it reports exclusions explicitly and does not reinterpret setup or cleanup failures as detections.

```sh
timeout --kill-after=10s 360s node scripts/analysis/dialog-conformance-study/run.mjs /tmp/dialog-754-new-run
node scripts/analysis/dialog-conformance-study/report.mjs /tmp/dialog-754-new-run
```

The two original early-entry failures can be investigated independently, using the unchanged repository file and the original root Vitest configuration:

```sh
corepack pnpm@10.32.1 exec vitest run packages/adapters/web-component/test/dialog-overlay.test.ts --no-file-parallelism --maxWorkers=1 --minWorkers=1 -t 'traps tab navigation|merges dialog-close'
```

This is an intentionally filtered diagnosis command. It cannot establish all 28 original checks or a native browser result.

## Independently recompute the archived classification

Extract the archive to a new disposable directory; the archive contains only relative member paths. Then run the following from the source checkout. It validates every source, plan, prepared-check, mutation, runner and report binding before comparing the recomputed classification with the archived one. It does not overwrite an observation or rerun the component.

```sh
mkdir /tmp/dialog-754-retained
tar -xzf internal/records/evidence/2026-11-24-dialog-conformance/raw-evidence.tar.gz -C /tmp/dialog-754-retained
D754_RUN=/tmp/dialog-754-retained/final-09 node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readPlan } from './scripts/analysis/dialog-conformance-study/source-variant.mjs';
import { loadCell, summarize } from './scripts/analysis/dialog-conformance-study/report.mjs';
const plan = readPlan(process.cwd());
const directory = process.env.D754_RUN;
const cells = Object.fromEntries(plan.variants.map(variant => [
  variant.id, loadCell(path.join(directory, variant.id), plan, variant),
]));
const actual = summarize(plan, cells);
const retained = JSON.parse(fs.readFileSync(path.join(directory, 'study-report.json'), 'utf8'));
assert.deepEqual(actual, retained);
console.log({ matched: true, cells: actual.outcomes.length, exclusions: actual.exclusions.length });
JS
```

## Delivery boundary

The source worker did not push, change Issue checkboxes, or publish comments. The parent is responsible for independent source review, integration, actual merge/evidence bindings and live readback. The five original #754 experimental conditions have concrete evidence for that review. Optional Agent maintenance/repair comparisons, native/AT acceptance and the unresolved early-entry product/fixture diagnosis remain distinct work.
