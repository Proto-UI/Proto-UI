# Bootstrap Button fixed-source pixel dimensions

Date: 2026-10-14. Candidate against PR #887 head `87d6117cbd93570d78c5c7b4d081eae754f73706`; not a publication or complete-family acceptance record.

## Scope and authority

The PR #872 upstream sizing decision in `internal/agent-operations/prototype-upstream-conformance.md` requires preserving the confirmed upstream units. The original draft Button explicitly converted fixed pixel dimensions to rem; that historical deviation is now corrected for default/primary Button only, with its draft definition and reader projections updated together.

Fixed reference: [twbs/bootstrap v2.3.2 compiled CSS, lines 3198–3226](https://github.com/twbs/bootstrap/blob/v2.3.2/docs/assets/css/bootstrap.css#L3198-L3226), [buttons.less](https://github.com/twbs/bootstrap/blob/v2.3.2/less/buttons.less), and [variables.less](https://github.com/twbs/bootstrap/blob/v2.3.2/less/variables.less). The values are padding 4px 12px, font size 14px, line height 20px, border 1px and radius 4px. Single-line border-box height is 30px. Changing the root font size must not double these fixed pixel values.

Base remains the one activation/focus/disabled owner. Button uses shared prototype feedback tokens, not page CSS or a host-specific component fork. The physical style renderer adds only nonnegative finite decimal px typography, reusing the existing spacing value decoding after strict validation. No Compiler, IR, collector, Runtime or Adapter implementation changes are included. Existing rem typography, colors and state handling remain intact.

## Evidence

- Before implementation, the new Button source/CSS regression failed because the source lacked `px-[12px]`; the three existing Button tests passed. This isolates the dimension mismatch rather than a test collection problem.
- Before the translation change, the new typography regression failed because px typography was unsupported; 58 existing CSS-renderer tests passed.
- After implementation, the six selected test files passed: Button (4), CSS renderer (59), source token collection (84), Shadow split styles (14), family closure (5), and disabled-paint regressions (10): 176 tests total, Node 24.19.0 / Vitest 2.1.9, one worker.
- The new generic typography tests cover zero, decimal and fractional values in document and Shadow outputs, and reject negative/sign/exponent/nonfinite/malformed/injected/function values and decimal overflow. Existing token tests remain part of the same run.
- The draft-family preset was regenerated through its generator, and its check mode passed. Spec authoring passed for the two changed catalog files against the exact base. `git diff --check` passed.
- A first collection attempt lacked per-package dependency links. Linking the existing workspace dependencies resolved it; no package version installation or credentials were needed.

The existing real-four-Web fixture now includes a separate root16/root32 case for default/primary computed padding, font size, line height, radius and height, real pointer/Enter/Space activation, disabled suppression, and explicit default/false restoration through the public demo API. Independent review caught an invalid planned undefined-removal assertion: the patch API retains keys, and Props fallback retains previous valid values. The browser assertion was corrected to explicit restoration. Actual `controller.applyRawProps({})` removal remains covered by the existing unit test; four-Web browser prop removal needs a consumer API that can remove keys and remains unverified. Captures and observations are retained by the existing evidence workflow when it runs. The new browser case is cataloged as planned, not absorbed into the older browser pass.

Exact-candidate real-browser execution, screenshots, browser zoom, native targets and general Prototype Compiler parity remain unverified. Root-font mutation is not browser zoom. No local browser launch or restriction bypass was attempted. Full workspace validation and independent review are separate from the focused passes above. The aggregate prototype catalog reports 536 failures; an isolated exact-base worktree produces byte-identical output, so this candidate does not introduce those diagnostics. Initial workspace type checking lacked the generated website Shadow module; the official CLI build and website generator then succeeded before retrying. The retry of `tsc -p tsconfig.workspace.json --noEmit` passed; this excludes the website and is not a full docs/browser type check.

## Remaining ownership and follow-up

Other variants and sizes are still absent and explicitly unfinished. Stronger focus feedback and the recorded non-sizing appearance differences are unchanged. This slice does not mark Button or the family complete.

Form Submit/Reset and AlertDialog Action/Cancel retain copied rem-based default Button metrics; hand their fixed-unit gaps to their respective owners instead of silently changing those components. Dropdown/Select/Toggle have related sizing gaps and retain their own scope. Shared passive colors/shadows were not changed.

Next: finish independent source review, retain any aggregate-check failures with exact-base comparison, publish only under the parent task's existing authorization, then collect and inspect the naturally triggered exact-head browser evidence and append it to that commit's progress record.

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.
