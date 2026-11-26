# Focus readiness fan-out and Vue retained-view recovery

Date: 2026-10-06 UTC. Source parent: `1292b5afeb5737d93066a84ef9ae14a6d120af9b` (#832).

## Bounded findings and repair

Reviews [4191411697](https://github.com/Proto-UI/Proto-UI/pull/832#discussion_r4191411697) and [4191411704](https://github.com/Proto-UI/Proto-UI/pull/832#discussion_r4191411704) were independently reproduced rather than accepted from their descriptions alone.

- The four real Web adapters notified only the first throwing subscriber. Eight controls (React, Vue, Vue2, WC; first throw is an Error or `undefined`) observed `['first']` rather than `['first', 'second', 'last']`. The owning readiness loops now attempt the existing listener snapshot completely and then rethrow the first captured value. A later observer's error cannot replace that first value. Subscription wrappers still suppress disposed or stale-owner callbacks; there is no new subscription lifetime or retry budget.
- Actual Vue KeepAlive and retained-overlay release errors were delivered to Vue, but returning the same host left its mount count at one. The old `lastInitRoot` marker skipped replacement attachment. Both detach callers now settle bookkeeping in `finally`, only when no newer view owns it; hidden presentation state is cleared only if presence is still false. Returning the detach Promise lets Vue observe Runtime unmount rejections. No detached view's disposer or session ownership is rewritten.

The applicable catalog direction is draft `HC-FOCUS-TARGET-0001-C/D` and `C-AS-FOCUSABLE-0001-G`. Narrow new `T-FOCUS-0001` cases map only fan-out and retained-root recovery. No normative criteria, public API, null-entry cancellation, Focus Module policy, budget ceiling, protection, timeout or workflow changed.

## Executable evidence

The five new integration files and shared fixture are linked directly from `T-FOCUS-0001`. The original ten intended red controls pass after the repair. Four additional permanent Vue controls cover a synchronous reopen request inside the throwing release observer and Runtime unmount rejection delivered to `errorHandler`, each for KeepAlive and retained overlay. The final fourteen controls pass; an independent reviewer reran all fourteen, checked the production diff and found no actionable defect in this bounded change.

The retained-overlay fixture uses a fixed observed presence binding and explicit lifecycle hide/show. Framework mounting, detaching, reattaching, registry leases, native-focus event delivery in happy-dom and observed Focus facts remain real. Deliberate injections are host focus rejection, layout clock delivery and readiness/unmounted callback errors. Reopen requests are not proof of synchronous physical replacement. These tests do not establish arbitrary native DOM exception transactions or native-browser exception guarantees.

Validation on the final production code:

- `vitest run packages/adapters/{react,vue,vue2,web-component}/test/focus-*.test.ts packages/adapters/vue/test/lifecycle-keep-alive.test.ts packages/adapters/base/test/view-epoch-owner.test.ts --exclude '**/*.browser.test.ts' --maxWorkers=2 --minWorkers=1`: 354 tests / 34 files passed before adding the four extra Vue controls; the final six-case Vue file and complete fourteen-case new matrix were separately rerun successfully.
- `node --test scripts/test/run-runtime-tests.test.mjs scripts/test/happy-dom-mutation-keepalive.test.mjs`: 115 passed.
- `pnpm build:packages`: all 44 public packages built.
- `pnpm check:types`: workspace and docs passed (446 docs files, zero errors/warnings, four hints). The first docs attempt failed before checking due to the default Astro configuration directory being unwritable; the unchanged command passed using a temporary `XDG_CONFIG_HOME` with Astro telemetry disabled. This environment failure is retained as a failed attempt, not a source fix.
- Catalog, base-bound spec authoring, formatting and `git diff --check` passed.
- Full general test plan: 4,396 passed, three CLI initialization assertions failed, 34 todo (649 files: 645 passed, one failed, three skipped). A serial unchanged rerun of that entire CLI file passed all 37 tests. The concurrent first attempt is retained as failed; the full suite is not relabeled green. Package/type builds overlapped the initial run and can recreate CLI dist; contention is a plausible cause, not a proven source defect. Exact-head CI and a non-overlapping full retry remain required.
- Local cloud Chromium launch was attempted for the 50-case cross-adapter native suite and the React/Vue nine-case suites. All three hooks failed at process startup (`socket() failed: Operation not permitted`); all 68 test bodies were skipped. No browser flag, sandbox or permission workaround was applied. New exact-head normal GitHub native CI remains required.

## Whole-combination measurement, not a cap change

A clean application to validation-only #826 parent `38d9479f398c436d931dcfaf9315b049e407da5c` retained every earlier material/source change. Direct complete measurements (Node 24.19.0, esbuild 0.25.12, Linux x64) passed all nine existing gates: Runtime 68,953/69,200; React 90,873/91,000; Vue 90,643/90,800; WC 99,495/104,500. Relative to the preceding exact combination, Runtime is unchanged and React/Vue/WC add 31/36/27 gzip bytes. Both complete consumer diagnostics were also measured; hashes and environment are in the adjacent JSON receipt. No compressed source-delta estimate or extra margin was substituted.

The combined candidate's full type command also passed (455 docs files, zero errors/warnings, four hints); its fourteen new controls pass. Source #832's older independent budget limits still fail and remain visible. Normal source integration and reviewed budget integration remain separate from this validation-only PR. **Never merge #826.**

The preceding #826 TOC workflow had a loopback `route.fetch` ECONNRESET. A single unchanged job rerun [112162579797](https://github.com/Proto-UI/Proto-UI/actions/runs/37411780790/job/112162579797) passed every step, including motion and reduced-motion captures. That result belongs to 38d, not the new candidate.

## Remaining acceptance

New exact-source and combined CI, all native shards, canonical measurement matching, new review reconciliation and required independent platform review remain distinct checks. A passing narrow regression test is not whole-PR acceptance or permission to merge. Per-commit comments bind subsequent results to the actual published SHA. This is an internal logic/lifecycle repair with executed state-transition evidence, not a cosmetic UI change or a screenshot claim.
