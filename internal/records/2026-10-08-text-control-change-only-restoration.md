# Controlled change-only owner restoration

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and authority

Finf [#872 review finding](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4210567494), reproduced from `c0f83b30f613e6dafd6ae2e7a83589ca3427f6d2`. This is a bounded repair under draft `C-TEXT-CONTROL-0001-D/E/F/G/CHANGE-COMMIT` and `M-TEXT-CONTROL-0001`, not a lifecycle promotion or full Finf acceptance.

The native input/textarea can deliver `change` without an earlier `input`. The module emitted the candidate but scheduled no reconciliation, so rejected candidates remained in the physical editor while the module/Field canonical value remained the owner value. The prior queued-owner prelude repair remains necessary: a change callback must let older queued owner patches project normally. Its historical record is retained unchanged.

## Repair and discriminating evidence

`packages/modules/text-control/src/impl.ts` now schedules the existing callback-boundary restoration for non-composing `change`, alongside non-composing `input` and `compositionend`. It still does not install an input-style prelude for `change`; active composition and lease-epoch guards are unchanged. There is no new event, acceptance heuristic or prototype workaround.

Before repair, the two affected test files collected 99 tests: seven failed for the expected reason, 92 passed. Input and textarea each failed rejected-candidate DOM restoration, deferred owner acceptance in canonical state, and deferred replacement in the DOM. The real Web Component Field integration independently failed rejected-candidate DOM restoration; synchronous acceptance/replacement were passing controls.

The retained six change-prelude controls cover queued owner patch drain, unchanged-value caret and active composition. Added tests also observe physical input/textarea values and caret through composing changes, composition completion, detach/replacement, disposal, and a new composition started before the pending restoration. Field tests verify the DOM, public value, outward candidate and subsequent validation request value together. Events are synthetic under Happy DOM; these are not native-browser or OS IME results.

Source binding (SHA-256):

- `packages/modules/text-control/src/impl.ts`: `8ce556abad22d96368ab3f54ba026b36216495d2046d20db8d67fa61ad2a6845`
- `packages/modules/text-control/test/impl-spec.test.ts`: `65f114dc7184e9f268bc09a968bac5280856903ffa6e762f49b10fcfcab28e48`
- `packages/prototypes/base/test/field-review-regressions.test.ts`: `4efb86edcccee4972fce44f70c2cce29e3f74572bca2800a4bfc7e09e44231c1`

## Validation and remaining work

Node 24.19.0, pnpm 10.32.1, Vitest 2.1.9, Happy DOM 15.11.7. Tests used `pnpm exec vitest run <paths> --maxWorkers=2 --minWorkers=1`. An initial invocation specifying only maxWorkers never collected tests because the runner's default minimum conflicted; it is setup failure, not a red product test.

The combined bounded regression run passed 372 tests in all 18 selected files, including both TextControl suites, Base Input/Textarea, all four Base Field test files, Base Accordion, all four Adapter TextControl suites (Vue2's path is `textarea.integration.test.ts`), Web Component shadow TextControl, and all four Adapter Accordion suites. The TextControl/Field portion is 199 tests in 13 files. The independent Accordion candidate was present for that combined run; no TextControl test depends on its repair.

`check:prototype-catalog` passes. Initial workspace types reported missing generated website shadow-style modules; the existing `--filter apps-www generate:proto-ui-style` generator restored these artifacts, and the subsequent `check:types:workspace` passed. No generated outputs are committed. Final integration should rerun current-head types, package budgets/builds and required native journeys. Independent review, public commit-bound evidence/comment publication and full Finf acceptance remain separate work; no push or external mutation is part of this local repair.
