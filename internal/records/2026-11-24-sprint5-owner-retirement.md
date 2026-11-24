# Sprint 5 generated owner retirement correction

## Source and boundary

This increment follows the Sprint 5 integration candidate `1709cd31b1d44775cd9e441e8f217e37a40a526c`, containing the earlier request-owner implementation and its [independent review corrections](2026-11-22-sprint5-request-owner-review-fixes.md). It addresses the concrete retirement/replacement boundary in `C-LIFECYCLE-OWNER-INITIALIZATION-0001-D/E`, tracked by #896. It does not change either lifecycle definition from draft or admit any canonical SSR profile. The four public SSR profiles continue to reject with `PUI4001`.

The original #895/#896 decision and acceptance conditions remain authoritative. The earlier 117-case and later 193-case receipts are historical evidence for their tested boundaries. They did not cover cleanup-triggered browser reconnection.

## S5-OWNER-003: retire the captured port before creating a replacement

A generated Web Component defers ordinary disconnect retirement until the microtask checkpoint, preserving an owner across a same-checkpoint move. When retirement actually starts, authored `unmounted` or `beforeDispose` behavior can emit a public event. An application listener can synchronously reconnect the element in that event.

Previously the disconnect callback cleared the old owner, invoked its cleanup, and then disposed `this.port`. Reconnection allocated a fresh owner and assigned its new port before the old callback reached that final disposal. The old callback therefore closed the replacement's port. A real generated consumer showed its replacement State changing from `3` to `9`, while its visible output remained `3`.

The disconnect callback now captures both the old owner and its port before cleanup, clears their published fields, and marks retirement in progress. Reentrant connection callbacks cannot start another owner until the captured owner and port have both retired. A still-connected element then starts a fresh owner in a generation-checked microtask. Explicit terminal disposal cancels that restart. Existing same-checkpoint movement continues to retain the original owner and State.

This uses the existing definition's retirement ordering. It introduces no new data migration, authentication policy, framework lifecycle, or public API.

## Actual generated consumer and counterexample

`owner-hydration-fixture.ts` compiles one authored prototype through the real parser and private Web Component SSR emitter. Its State, Prop watcher, lifecycle events and rendered output are emitted code. Both test environments load those artifacts. The tests do not replace the owner, port or output with a handcrafted implementation.

The first fixture attempt failed before adoption because it omitted the required generated CSS artifact. Those two setup failures are not product counterexamples. After adding the exact CSS artifact and its generated binding, the baseline ran two cases: **one failed and one passed**. The failure was the observed State `9` versus visible output `3` described above. Terminal disposal already passed.

The corrected regression tests exercise reconnection from both `unmounted` and `beforeDispose`, assert that the old State is unusable, observe no new owner during the cleanup callback, require distinct replacement owner/State identities, check the actual lifecycle event sequence, and independently read the replacement State and rendered output after a Prop update. The terminal-disposal control still refuses later updates and cannot revive the owner.

An initial static suspicion about outward events during `created` was not a reproduced defect: the existing browser port queues those events until acceptance, after the generated host assigns its owner. The defect repaired here is the accepted owner's disconnect cleanup path.

## Verification of this source increment

The final focused command after extracting the shared fixture was:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/owner-hydration-retirement.test.ts \
  packages/compiler/test/physical-control-ssr.test.ts \
  packages/compiler/test/request-owner-ssr.test.ts \
  --maxWorkers=1 --minWorkers=1
```

It completed with **170 passed across three files**, no skipped tests:

| Test file | Passed | Evidence boundary |
| --- | --: | --- |
| `owner-hydration-retirement.test.ts` | 3 | Actual emitted WC adoption, cleanup reconnection, replacement updates and terminal disposal in happy-dom |
| `physical-control-ssr.test.ts` | 84 | Existing generated SSR physical controls and hydration |
| `request-owner-ssr.test.ts` | 83 | Existing four-target generated request, error, abort and finite-carrier checks |

The run took 26.23 seconds. Existing intentional Vue setup-failure warnings and the Vite ES2024 target warning remained visible. The raw final output is retained by the integration handoff as `owner-retirement-final-green.log`; the valid baseline red is `owner-retirement-red-valid.log`.

`node --test scripts/test/run-runtime-tests.test.mjs` passed **134/134**, including the rule that each discovered browser suite has one explicit runtime-plan owner. A focused strict TypeScript program using the repository's compiler options, the changed emitter and the three new test/fixture entry files resolved 465 source files and produced **zero diagnostics**. These checks use the existing dependency installation and are not clean-install or final workspace receipts.

The lifecycle authoring check against the integration baseline passed for the one changed catalog input, using `node --import tsx` after the CLI's IPC socket was blocked and the worktree's existing spec dependencies were made available. Prettier and `git diff --check` also passed. Neither environment setup attempt is reported as a spec or product failure.

## S5-REQUEST-004: held real serializers, late settlement and concurrent isolation

The request suite now also exercises a real Vue 3 native child with asynchronous setup and a real Vue 2 native child with `serverPrefetch`. Each child holds its actual framework serializer on a controllable Promise. The helper observes the framework's returned Promise without providing synthetic HTML, owner behavior or lifecycle results.

While the first request is suspended with State `7`, a second request using the same emitted module completes independently with State `11` and exactly one serialized owner. The test then aborts the first request with `false`, requires its response to reject and its cleanup to finish before releasing the held serializer, and independently resolves or rejects the pending native work. In the fulfillment case, the resumed native render actually attempts to render a new generated child; the closed request prevents that child's authored lifecycle from starting. Late settlement cannot change the already rejected response, repeat the old cleanup, or modify the completed request's events or accepted carrier.

These four journeys passed on their first execution; they are added acceptance evidence rather than a new production repair. The subsequent complete `request-owner-ssr.test.ts` run passed **87/87** in 12.23 seconds with no skips. Its strict TypeScript program resolved 458 source files with zero diagnostics. The raw output is retained in the integration handoff as `owner-async-final.log`. Expected Vue warnings from late refused/failed setup remain visible. The draft test catalog maps this bounded witness to request abort, late-settlement, first-reason preservation and concurrent isolation. It does not establish every Context/resource capability combination or streaming SSR.

## Prepared physical browser evidence

`owner-hydration-retirement.browser.test.ts` serves the actual generated SSR HTML, the generated CSS and a bundle containing only the emitted client artifact set. It launches Chromium with `chromiumSandbox: true`. The four scenarios are:

1. Reconnection from the old owner's `unmounted` callback.
2. Reconnection from the old owner's `beforeDispose` callback.
3. Explicit terminal disposal during cleanup, followed by reconnection.
4. Same-checkpoint movement, preserving owner and State identities.

The browser assertions require adoption to retain the original output DOM node, the defined lifecycle counts, old State invalidation where applicable, and the replacement's State `9` and visible text `9`. Each run writes the Git head, source and artifact hashes, emitted hydration bindings, browser version, observed results, page errors and screenshot. The command is:

```sh
COMPILER_EVIDENCE_DIR=/absolute/evidence/directory \
  corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/owner-hydration-retirement.browser.test.ts \
  --maxWorkers=1 --minWorkers=1
```

Physical browser execution is pending in this commit. The local executor's previously observed Unix-socket restriction prevents sandboxed browser startup; this increment does not retry that blocked launch or relax the browser sandbox. The integration browser lane owns execution in a suitable environment and must bind its receipt to the actual tested source before claiming a physical pass.

## Remaining original acceptance

The new test is mapped to the narrow WC retirement case in `T-LIFECYCLE-REQUEST-OWNER-0001`. The existing `complete-target-initialization` implementation remains `missing`.

| Issue | Remaining condition after this correction |
| --- | --- |
| #895 | Accept the draft request-owner definition and bind each target to the accepted source/version; prove the complete request capability closure, concurrent request isolation, serializer abort/late-settlement behavior and normal/error cleanup in the actual consumers. |
| #896 | Accept the draft fresh-owner and finite-data definition; complete per-target browser adoption/replacement and current controlled-input authority; validate application trust, full source/compiler/helper/schema/request binding, Context reconstruction, stale async generations, abort/supersession and partial startup/adoption failure. |

The prepared WC browser journey supplies a bounded successor for one of those conditions when it runs successfully. It cannot establish the complete target matrix, application adoption by Shenko/Verdant, independent definition acceptance, or release readiness by itself.
