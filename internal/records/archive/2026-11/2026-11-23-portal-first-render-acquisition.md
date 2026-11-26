# Portal first rendering: preserve authored entrance and exact mount ownership

This non-normative repair follows the original Sprint 3 image-preview entrance and Sprint 4 compositor acceptance. Its base is `19f783750878fbd555409d6520f73a48bc7df0b3`, which separately restored the declared not-present/detached assertion and narrowed the exposed transition state. Earlier failed source and observations remain preserved. This record does not declare all Sprint work or the current integrated public branch accepted.

## Authority and implementation

[C-LIFECYCLE-0008-J](../../spec/contracts/C-LIFECYCLE-0008.yaml) requires initial rendering and view effects to be coherent before visual exposure. [C-LIFECYCLE-0002-D](../../spec/contracts/C-LIFECYCLE-0002.yaml) keeps mounted notification after commit and retires queued work when its actual mount epoch is invalidated. [C-HOST-VIEW-ATTACHMENT-0001-B](../../spec/contracts/C-HOST-VIEW-ATTACHMENT-0001.yaml) binds the detached marker to view intent, independently of the compositor barrier retaining an existing physical projection.

The original Portal reveal guard suppressed descendant CSS transitions while an entering Surface had its first style computed. A native DOM control retains zero intermediate frames for the original guard and visibility/content-visibility alternatives. Deferring first style computation with display suppression preserves intermediate opacity and transform frames. Those controls diagnose the rendering boundary; they do not replace the original component gates.

Three adapter files implement the boundary without component-name exceptions or a new public author API:

- `host-display.ts` adds the private `data-pui-portal-preparing` display guard.
- `portal-mount.ts` applies that guard only to a newly acquired, not-yet-presented mount. The existing two-layout reveal barrier remains; it removes the transition guard before releasing initial display suppression. Later relocation of an already presented view does not acquire fresh display suppression.
- `adapt.ts` starts and retires acquisition by actual lifecycle epoch. It captures the matching acquisition at mounted-event entry, publishes it after synchronous diagnostics/readiness reentry returns, and consumes it for that exact subsequent original host-scheduled completion. A `finally` retires only that acquisition. The original scheduler and author callback timing are unchanged. A not-present view immediately receives the declared detached marker while the original compositor retention continues.

Candidate 02 captured a mutable current acquisition at schedule time. Real Runtime diagnostics can replace mount A synchronously with mount B before A calls `schedule`. Two new tests reproduce this through actual Runtime, Presence, and configured host scheduling: B remains behind Presence, or B has already queued its completion. Candidate 02 fails both required first-render guards; candidate 03 passes both. No phase or epoch event is fabricated. These controls also verify the replacement callback count and later retained-view relocation.

## Exact tested source

| File | SHA-256 |
| --- | --- |
| `packages/adapters/web-component/src/host-display.ts` | `ede0791cde1606dbf304b8f9d64e05fc7a112acd2d2dd1f84e0e8494804c36c2` |
| `packages/adapters/web-component/src/portal-mount.ts` | `fea35a6ed7a58f36a5be149b65d5356223976fe4f3a4f10b126ba381c4cc24ef` |
| `packages/adapters/web-component/src/adapt.ts` | `423e3dc9778bab73fc1d8c25f9d96f8f9fef7e137f3c3340aced05ad5d9d78ec` |
| `packages/adapters/web-component/test/portal-first-render-reentry.test.ts` | `c52f4fc91a53486b9873d15233c128fd2be1915ef4f96b78d2f74cdeb5e78a2d` |

The final native run checks these source bytes and all 74 files emitted by the official Web Component public-package producer before and after execution. Its `adapt.js` is `532129bd913d9977a0de5257a4da76401ed4218e6d6ca403f8bc57d616fcc938`.

## Original gates executed

| Gate | Actual result | Archive binding |
| --- | --- | --- |
| Original eight Portal/lifecycle/theme/focus unit files plus two reentry controls | 51/51 passed, zero skipped; 23.363 s | `runs/portal-first-render-03/receipt.json` |
| Official `node scripts/build/public-packages.mjs --package @proto.ui/adapter-web-component --json` | Exit 0; 71.385 s | Same receipt and emitted-file inventory |
| New fixture with root TypeScript options, TypeScript 5.9.3 | Zero owned-file diagnostics, stable source | `drivers-and-diagnostics/portal-targeted-types-03.json`; targeted, not whole workspace |
| Complete original `documentation-image-preview.browser.test.ts` | 32/32 passed, zero skipped or filtered; 167.758 s | `runs/portal-native-13/receipt.json` |
| Original S4 observer: light/split/mixed × four settings × two rounds | 24/24 paths, 163 observed CDP frames, zero page errors; 94.745 s | Same receipt and `s4-24` result |
| Complete original `apps/www/test/color-scheme.browser.test.ts` | 9/9 passed, zero skipped or filtered; 38.361 s | Same receipt |

The final native run lasted from 2026-11-23 15:51:07 UTC to 15:56:11 UTC. Node was 24.22.3. Browser was Chrome for Testing 145.0.7632.6, executable SHA-256 `481fea1516a1f2b76454664272f12cd9dd1f20117b21e1f1498e08bc7f872c00`. Original timing and assertions remain, including the image wheel's 1000 ms poll, S4's 380 ms close window, five frames per path, four marker pixels, no repaint after fade, and 2000 ms cleanup.

S4 uses the exact original observer plus a failure-only in-memory handoff after an assertion has already failed. Seven controls verify this capture boundary; the same helper bytes are retained. PNG persistence occurs only after failure. The 163 successful sampled frames are reported by the original observer; this record does not claim 163 saved raw PNGs.

Image/S4 consumed the owned historical Astro owner at `http://127.0.0.1:38027`, committed image fixes, and exact new public adapter output. The already-integrated reading-viewport prerequisite from `424a78e560bd9878da1ca4a7e1ae44b0fa3740b7` was applied with an exact blob guard and restored afterward; SHA-256 `38c40b79ba99dc444a43376052de3c39798f99db7eb965eb990eadc4d6cc77ec`. It is not included again. The nine color-scheme tests use their original source-based Vite fixture. The different production-site `site-startup-theme.browser.test.ts` was not executed here.

## Retained failures and limits

The exact original three-file baseline still has the declared detached assertion failure (17/18); candidate 01 retains it (48/49 across eight files). Candidate 02 passed those 49 tests but subsequently failed both genuine epoch-reentry controls. Reentry fixture attempts 01/02 had invalid setup assumptions and remain classified separately from the actual two-product-failure run 03.

Candidate 02's complete image run 10 remains 31/32: `zh-cn/1280/light` horizontal wheel observation stayed at scrollLeft 618 during the original 1000 ms poll. The later passive diagnostic records the trusted wheel reaching 684, and candidate 03's complete original 32-test run passes. The causal reason for the earlier intermittent wheel failure is not established. The epoch correction is not claimed to fix it. An ordinary-DOM diagnostic was prepared but cancelled before browser launch to prioritize original gates; its zero-execution receipt remains.

The root integrator and a separate agent independently reviewed the full candidate 03 source and both reentry controls against Runtime's event-to-schedule order. These are source reviews, not GitHub approvals. Integration must preserve the independent percentage-source imports and callback already in public `adapt.ts`; those are separate hunks absent from this historical branch. Current-branch CI, workspace types, other Sprint conditions, and Liquid Glass Accordion optical acceptance remain separate work.

## Durable evidence

Archive: `evidence/2026-11-23-portal-first-render-acquisition/portal-first-render-evidence.tar.gz`.

- Archive bytes: 17466064.
- SHA-256: `50b6954ae3f7dfdcdc093aa600841c84fa6ff2ec0f8b503728192e490efdde72`.
- Verified payload: 723 files, 23616252 bytes, plus `payload-manifest.json`.
- Every payload is read back from the completed archive and verified against its recorded length and SHA-256.
- Payload includes original failed/passed receipts and logs, screenshots, source snapshots, all final producer files, original observer inputs, drivers, and scoped type evidence. Reproducible Vite/dependency caches are excluded.
