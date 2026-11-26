# Independent review: synchronous Contents measurement transaction

**No unresolved substantive source finding was identified in the frozen files below. Native acceptance remains pending.** This is a local technical review, not a GitHub approval, release disposition or platform acceptance.

## Binding and scope

- Base: `9b6a7e54a82cf0758cb0eb94a9befa69a0516a5e`; this review binds the nine working-tree file hashes, not an uncreated commit.
- Mode: `human-assisted` / `current-user`; class: `review-bounded-regression`.
- Scope: two production files, five tests, removal of the temporary browser trace, and one workflow source-recording addition. The reviewer did not modify repository source. The B implementation and tests were authored by separate agents.
- `M-POSITIONING-0001`, `C-ANCHORED-POSITIONING-0001`, `HC-ANCHORED-POSITION-0001` and `T-ANCHORED-POSITIONING-0001` remain **draft**. This repair does not promote their lifecycle. The earlier reviewer-authored observer merge resolution is inherited context, not newly independently accepted here.

| File | SHA-256 |
| --- | --- |
| `packages/modules/positioning/src/web/floating-ui-host.ts` | `298087c31bba3cc7b11b0a9b73735cd065d933f935117ca5557bd0e8c30531bd` |
| `packages/modules/positioning/src/web/owned-style-lease.ts` | `5e3911a7d2a532ba64ce9977f5a8e683801bf6a1c11a468f2026f15e55c3faea` |
| `packages/modules/positioning/test/floating-ui-host.test.ts` | `1ea123dcba936032ab4e084b7b831419d8016624fab6081aa8a7c4a4d1139939` |
| `packages/modules/positioning/test/available-projection-ownership.test.ts` | `5f8d015597035efbf22e7a81fce2cb71c4bfecdbc6be884c264031d061610c99` |
| `packages/modules/positioning/test/lease-generation.test.ts` | `64751343f10a6a15705b184d6fcad71d40e6e352be48f147c8e14dbb0af01737` |
| `packages/modules/positioning/test/floating-ui-host-intrinsic-invalidation.test.ts` | `7c53e83f9cfd01ffdaeec2f7e915c27ccc09db4b94a05422160cf81f1c1366b2` |
| `packages/modules/positioning/test/owned-style-lease.test.ts` | `ae2557dd040d7b3f5925729add5decb32ccddc952dee7f87bfaa2628be16ca7e` |
| `apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts` | `7fc2042c5955e9a2cf9fe21a0cfa4293ebb67b5abf2293e1f0141ec7c741212d` |
| `.github/workflows/browser-suite-repair-evidence.yml` | `541bdf1277c012d464543f0b86c197931909e2e97193e643dbd858877baf8844` |

## Findings and their resolution

**F-SYNC-001 — P2, resolved.** An empty style claim set can remain current, and a reentrant write can change a claim revision without making its new value noncurrent. Restoring offsets on `isCurrent()` alone could overwrite a new read-side state even though no cap was suspended or the transaction was interrupted. The host now requires positive `changed` and `restored` proofs, current generation/ownership and an actual offset difference (`floating-ui-host.ts:547,571–577`). The helper retains claim identity/revision and only marks a real departure from the authored baseline. Final public empty-claim/successor and lower-level revision/full/partial-handoff controls cover this boundary. No historical red execution is claimed for this first finding.

**F-SYNC-002 — P2, resolved by independently executed controls.** The intermediate helper `219182ff9924d9864d7913d37ed26aabfe3ebba70c7bf946262076e32e9e5045` could stop restoration after one setter wrote and then threw, while reporting the whole transaction restored. I directly reproduced width/height `300/200`, with `restored=true`, despite the original projection being `300/400`. The final helper certifies every value and priority against the original snapshot and continues safe remaining restoration while preserving the first error (`owned-style-lease.ts:103,151`).

| Direct control | Final width / height | Restored proof | Original error |
| --- | --- | --- | --- |
| Old helper; first restore writes then throws | 300 / 200 | **Incorrectly true** | Preserved |
| Fixed helper; second restore succeeds | 300 / 400 | True | Preserved |
| Fixed helper; second restore also throws before writing | 300 / 200 | **False** | Preserved |

These are actual local Happy DOM style/ownership controls with an instrumented throwing setter, not browser-layout or wheel evidence. The final two cases are also retained in `owned-style-lease.test.ts`; the intermediate source remains separately archived.

## Boundaries checked

The transaction reads Floating UI DOM1.8.0's real synchronous dimensions, preserving its CSS/offset and fractional-size semantics. It restores live owned caps and, when needed, the actual two-axis scroll snapshot before any await. It uses `instant`, never the test's wheel delta. Empty/unchanged claims, changed revisions and successor ownership do not authorize compensation; true content shrinkage retains the browser/model's actual range clamp. First-pass natural dimensions remain separate from size-middleware resets, which read the real capped box and fresh reference geometry.

The old intrinsic cache and mutation/font heuristics and temporary decision trace are removed. Size matching/target alignment and existing composed-ancestor, ShadowRoot, nested-reference and Event-redispatch paths remain. No new scroll-event filter was added. An earlier speculative compensation-event loop was not established as a UA regression; its overly strong model was withdrawn.

The matrix retains the original **1000ms** progress check, both final displacement assertions after the existing two animation frames, owner/readiness/native-wheel/cancellation checks, and **180s** outer timeout. Its delta only removes temporary tracing. The workflow only adds the new owned-style test to recording: **18 source files, the same five generated outputs**, and unchanged selection/execution/security boundaries.

## Actual validation

The implementer's final execution receipts are in `/tmp/contents-sync-transaction-validation.json`, SHA-256 `1321a21c6ab1d80ef50df642a0dfb57265cfffbdb8d43a8e5fa278fd99b2489f`. I matched all nine source hashes and all three final log hashes; no optional suite reruns were added.

- **27 files / 351 tests passed, exit0,24.82s.** Actual positioning and four-adapter run; completion `99769 /85d8f2`.
- **Workspace typecheck exit0**,4GB Node heap; completion `98406 /b5bdcf`. Its empty log is supported by the completion receipt, not inferred as success.
- **Prettier exit0** for the eight changed TypeScript files; completion `9006 /269c27`. The reviewer also ran `git diff --check`, exit0.
- Historical control: frozen7642 positioning source plus the new eight-case test yielded **4pass/4fail/0skip, exit1**. I compared all18 production files with Git blobs and17 loaded-source records with retained bytes; the test hash matches this candidate. This uses current dependencies/shared aliases, not a full historical checkout. Paint fails before later ARIA/childList iterations, growth before shrink assertions, and both smooth cases before later-input checks; those unreached assertions are not historical failures or passes.

## Remaining acceptance limits

There is **no native result for these B bytes at review cutoff**. Earlier92d/b110/dca8/7642 failures remain retained;7642 passed12 Shadcn combinations, failed Brutalist/WC/click, and did not reach23 combinations. Local geometry, clamp and smooth-scroll models do not establish native wheel delivery, event timing or the full36-combination matrix. Main52 integration also changes the observer/generated-input closure, so the next native run must bind current source and actual generated outputs.

This review does not claim full `check:types`/docs/Astro, full CI, DCO/platform review, publication or release acceptance. The machine-readable companion preserves the source bindings, first-counterexample/final-control observations, execution receipts and limitations.
