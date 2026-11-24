# Quoted regression audit and bounded repairs

## Request and source

Agent paraphrase: check reports of duplicate GPUI dependencies, a zero-scroll browser assertion, a timed-out Drawer compiler worker, misleading Button availability text, and alleged author self-acceptance; repair established defects and preserve the evidence boundaries.

The integrated source reviewed locally is `9c42d114afe55e6196393161b16b6e2f10d2e02d`, based on main `952722e5b619c60ddf797543fba11eea6c06d812`. Later main activity is not silently substituted for that tested source. The independent review's native-evidence cutoff is 10:41:39 UTC on 2026-11-24. Subsequent browser results must be appended with their actual source and environment.

## Findings

| Report | Established observation | Disposition |
| --- | --- | --- |
| `external_scroll` appears twice | The older `88fc0883` producer retained two registrations. By `248f8270`, the duplicate registration had already been removed during S6 integration. Main `952722e5` also includes the duplicate-name guard from PR #1786. | Keep the upstream repair. The integrated producer emits 38 unique module names and one `external_scroll`; all 39 generated Cargo TOML files parse. A deliberate repeated-name mutation verifies refusal before overwriting the first files. TOML parsing is not full Cargo dependency resolution or native behavior. |
| `expected +0 not to be +0` | [Main run 45314673679 / browser job 138198390177](https://github.com/Proto-UI/Proto-UI/actions/runs/45314673679/job/138198390177) observes no Content scroll-offset change after real wheel input. The assertion compares before/after measurements; it is not a literal `0 != 0`. | Preserve the assertion and its 1000 ms deadline. Fix its positioned-surface readiness/coordinates and add read-only owner, event and failure evidence. Historical root cause and native product acceptance remain unconfirmed until the same-environment comparison runs. |
| Drawer worker is killed after 180 seconds | Clean `952722e5` reproduces `SIGTERM` / `ETIMEDOUT` after 180087 ms, with only 1 of 6 profile results. | Bound the expanding callable-analysis work and active-call depth; return explicit source-located `PUI1007`. The integrated worker exits normally after 30961 ms with all six diagnostic rows. All six remain `UNSUPPORTED`; no Drawer compilation success is claimed. |
| Button Draft/version caveats disappear | The documentation rewrite removed the explicit draft/workspace boundary from Base and made an unqualified four-host consistency statement in Shadcn. Vue 2 and Liquid Glass still had some availability caveats. Both catalog identities remain draft. | Restore concise lifecycle and published-0.2.0/workspace boundaries in both locales, including workspace-only `styleProfile`, `icon-compact`, `wrap`, and focus-retained visibility. Link Base behavior and Shadcn visual coverage separately. Do not claim that every warning was removed. |
| Author Agent self-review is effective acceptance | The quoted wording was not located in the inspected tracked records or live discussions. This is not proof about every historical discussion. Current contributor rules reject author/contributor self-approval and require independent exact-head evidence. | Keep existing governance and admission enforcement. Three selected negative-boundary tests pass. No author self-check or local agent review supplies a GitHub approval or merge permission. |

## Changes and preserved limits

The compiler change does not modify Drawer source, increase the 180000 ms worker deadline, approximate alias identity, or emit partially proven output. The resource envelope is scoped to instrumented abstract analysis, not a universal time or memory guarantee. The existing nullish-spread positive test still fails with `PUI1006` on both clean main and the candidate; its red logs remain retained.

The wheel observer does not set scroll offsets, change CSS/focus, or synthesize input. Each observation resolves the current public dialog, retains the actual scroll surface, and requires a connected, viewport-contained, scrollable owner. It retains the original WheelEvent and samples cancellation after dispatch. Original movement, signed direction, document-scroll isolation and event-path checks remain. Evidence-writing and cleanup errors do not replace the first assertion failure.

The added native control uses an authored viewport to compare uncancelled/cancelled real wheel input and reject an entirely replaced dialog. It is an oracle control, not acceptance of the public Popover. It is registered in the existing development browser phase and remains separate from the real three-family/four-runtime/click-Enter-Space matrix.

The documentation change preserves `draft` lifecycle and release boundaries. A workspace preview selector is not proof of published or cross-host support.

## Validation and independent review

| Evidence | Actual result |
| --- | --- |
| Current-main Drawer comparison | 180087 ms / SIGTERM / 1 diagnostic row before; 30961 ms / normal exit / 6 unsupported rows after. Same 13-file Drawer closure and unchanged worker settings. |
| Integrated compiler focus | 14 files: 264 passed, 1 known baseline failure. Compiler/new-test no-emit typecheck passed. |
| Independent compiler focus | 106 passed, 1 same baseline failure. New resource controls and demand-opaque handling reviewed. |
| Frontend observer/site controls | 19 passed, including an independent rerun. These are layout-controlled unit observations, not native browser results. |
| Browser-suite registration | Author ran the 138-test runtime-plan suite successfully; independent inventory review confirmed the new suite's intended registration. |
| Public-doc validation | 307 bilingual primary routes and four library inventories passed. This is not rendered visual acceptance or an installed npm consumer test. |
| Current review-admission boundaries | Three selected existing tests passed; no platform disposition was submitted. |
| GPUI composition | 38 unique names, one `external_scroll`, 39 TOML files parsed; deliberate duplicate guard behavior retained. Native Cargo execution is separately pending. |
| Native wheel control and public matrix | Pending at the local independent review cutoff. Prior local attempts failed before execution because Chromium could not create its process-singleton socket (`EPERM`). Remote setup and any resulting observations must be reported separately. |

A fresh reviewing context raised five P2 findings: two missing documentation boundaries, premature cancellation sampling, incomplete retained-owner checks, and cleanup masking the primary error in the new control. All five are resolved in the inspected source. The [retained local review](evidence/2026-11-24-quoted-regression-audit/independent-review/review.md) and its manifest bind source bytes, executed checks, supplied logs and limitations. This local review is not a platform approval.

The original complete agent-operations invocation was interrupted during disk pressure; no whole-suite pass is claimed. Original agent-doc launch/dependency failures are retained alongside the narrower successful generator/check execution. No full repository, full compiler inventory, successful Drawer lowering, mounted GPUI behavior, or all-host release acceptance is inferred from the focused checks.

## Detailed evidence

- [Button lifecycle and review-evidence correction](2026-11-24-button-lifecycle-correction.md).
- [Contents wheel readiness and retained failure evidence](2026-11-24-contents-wheel-readiness.md).
- [Drawer timeout, bounded refusal and current-main comparison](2026-11-24-drawer-analysis-bound.md).
- [Root evidence manifest](evidence/2026-11-24-quoted-regression-audit/manifest.json), including retained historical CI output and current producer/review-boundary logs.

Source and evidence commits retain actual Codex authorship and sign-offs. External branch publication, trusted CI, eligible independent GitHub review and any merge are separate observable steps. An unavailable connection, an unsupported result, or an unrun check must remain visible rather than becoming acceptance by declaration.
