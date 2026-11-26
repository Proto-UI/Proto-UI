# Shadcn Dropdown Label/Item fixed New York inset candidate

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and authority

PR #887, baseline `a404cb8862d0e99f64c1954b4c44d5371f10aea1`. This bounded family paint slice aligns Label and Item to [the fixed New York Dropdown source](https://github.com/shadcn-ui/ui/blob/02cad61166c4c20edbc8a3f71bd720eed4c1f49b/apps/v4/registry/new-york-v4/ui/dropdown-menu.tsx). The upstream file was read, not executed. It uses physical-left `pl-8`, including RTL; it does not specify logical-start inset. The family-only optional prop and all Base semantics remain unchanged. Content/Trigger and full Dropdown upstream parity are outside this change and remain open.

## Preserved failure and diagnosis

[Actions job 115950604734](https://github.com/Proto-UI/Proto-UI/actions/jobs/115950604734), run `38592464714`, recorded 8 failed inset cases and 8 passed destructive cases on the baseline. The first failing geometry was the inset Label: 6px actual against the old Nova 28px oracle. This does not establish that this commit introduced the defect, or separately measure the later Item assertions.

The old Label/Item recipes combined `px-1.5` and `pl-7`. Static inspection finds separate semantic groups, alphabetical token collection, and later `padding-inline` emission than `padding-left`. This explains the observed value but is not a candidate browser measurement. Generic CSS cascade ordering remains the existing Compiler/CLI owner's concern; this change does not modify the collector, renderer, semantic merger, Compiler, Runtime, Base or Portal.

## Candidate

Label/Item each use mutually exclusive complete horizontal recipes: ordinary `pl-2 pr-2`, inset `pl-8 pr-2`. No horizontal shorthand remains on either base recipe. Label uses `py-1.5 text-sm font-medium`; Item uses `gap-2 rounded-sm py-1.5`. Existing state-driven colors, local press extension, and known deviations remain explicit. Current draft criteria and executable expectations use the fixed New York source while previous Nova references/revisions remain historical.

The real public inset demo has a visible Toggle inset control. Its ordinary renderer API updates the three existing Label/Item props. The browser suite observes LTR and RTL true→false→true transitions through that control, asserts computed left/right padding (32px/8px inset or 8px/8px ordinary at a 16px root), preserves the 16-case runtime/theme matrix, and captures distinct source-bound images per direction/step. The test changes document direction as an environment input; it injects neither padding nor the expected prop result. Source-host tests check withdrawal of stale padding tokens. Preset tokens were regenerated through the existing generator.

## Evidence boundaries and next step

Local focused family/definition suites: 5 files, 20 tests passed. Public-documentation tests: 71 passed. Targeted TypeScript, generated Shadcn preset check, and changed-spec authoring check passed. These are source/definition checks, not real browser paint or native GPUI/Qt acceptance. The additional existing graph test's positional `implementations[0]` notes assertion fails; its fixture and selected Item test spec are unchanged. The graph failure reproduces on the unchanged baseline. Whole catalog validation remains red with 536 findings; candidate and clean-baseline outputs are byte-identical, outside this bounded slice. Environment-only missing workspace dependency links from the first attempt were repaired using the already installed shared workspace dependencies; no dependency version was changed.

Exact-head browser evidence is pending through `.github/workflows/finf-representative-features-evidence.yml`, matrix `group: dropdown`, running `apps/www/src/content/docs/zh-cn/finf-dropdown-recipes.browser.test.ts` on the real public documentation route. The Actions-only guard, clean tracked-source requirement, loopback request restriction, browser sandbox, real input and failure receipts are preserved. Independent review and exact final-head Actions results remain required before claiming closure. No screenshots from the earlier baseline may be presented as this candidate's result.

Independent local review found stale public English/Chinese `pl-7` prose; both pages now state the fixed source, physical-left/right metrics, RTL behavior and the real Toggle inset control. The historical action-arrangement examples remain separately attributed.
