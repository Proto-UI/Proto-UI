# Sprint 3 component consumer evidence

Date: 2026-11-22. Scope: the current 0.3 Web consumer slices of [#1455](https://github.com/Proto-UI/Proto-UI/issues/1455), [#1018](https://github.com/Proto-UI/Proto-UI/issues/1018), [#1085](https://github.com/Proto-UI/Proto-UI/issues/1085), and [#1084](https://github.com/Proto-UI/Proto-UI/issues/1084).

This record maps executable consumers to their original conditions. The final integration SHA, independent review, CI, and served-page receipts belong to the Sprint 3 release acceptance record. A passing source-specific run below does not certify a later integration head.

## Authority and scope

Tooltip composition follows the draft `P-BASE-TOOLTIP-TRIGGER` same-subject, host-semantics and description conditions, with Content's draft Overlay and presence boundary. The Web host policy is the public `registerWebPortalDestination` export in `packages/adapters/base/src/index.ts`; its implementation is `platform/portal-destination.ts`. No new portable Tooltip prop or lifecycle guarantee is introduced.

Transition follows draft `C-AS-TRANSITION-0001` and `P-BASE-TRANSITION`, and the active L1 lifecycle in `C-LIFECYCLE-0008`. Draft view-operation and other lifecycle entities retain their original status. The new browser consumers compile the actual `as-transition.proto.ts`, `machine.ts`, and `types.ts` through `compilePrototype` and `writeCompilation`, then import the generated React, Vue, Vue 2 and Web Component modules into the corresponding real frameworks. They contain no alternate Transition interpreter or copied business machine.

## Criterion map

| Issue and original condition | Executable consumer | Distinguishing observations | Preserved boundary |
| --- | --- | --- | --- |
| #1455: one command focus/activation owner with supplementary description | `apps/www/test/component-consumer-repairs.browser.test.ts` | Base/Shadcn/Brutalist × React/Vue/Vue2/WC; native Tab/Shift+Tab, hover/focus, Escape, one command signal, root/command disabled and dynamic replacement | Native Chromium input and AX are not physical OS input or an assistive-technology session. |
| #1455: standalone trigger, original report shape and actual ShadowRoot | Same suite and `fixtures/component-consumer-repairs.ts` | Standalone exposes remain; nested Trigger + independently focusable Button produces the original two-stop shape; real `attachShadow` with a same-scene portal produces the browser-computed description; default body portal gives matching ID strings but no computed description | Detached DOM construction is not a no-DOM host. A remounted custom element is not by itself a ShadowRoot test. |
| #1455: public consumer guidance | Both locales of Base/Shadcn/Brutalist Tooltip documentation | Public host-policy import, connected scene/app/overlay mount topology, CSS inside the shadow tree, owner disposal before registration release | The default cross-root body destination is explicitly outside the described composition. |
| #1018: cold start/preparation, synchronous leave→enter, delayed completion, duplicate completion, dispose and old owner | `packages/compiler/test/transition-native.browser.test.ts` | 4 targets × Runtime/generated × 8 independent paths = 64 native cases; retained real DOM view on reentry, exact event ordering, native timers, reduced-motion preference | 60-second per-target compiler preparation is separate from unchanged 30-second cases, 5-second phase waits and 895/495ms timer lower bounds. No GPUI/Qt/Flutter/SSR acceptance is inferred. |
| #1018: retained old controls and replacement isolation | Same native suite | Capture `controls.enter` while alive, invoke that saved function after disposal, preserve the actual rejection in `retainedControl` JSON, keep the replacement's phase/view and own completion deadline | A post-dispose `getExposes` lookup failure is not used as evidence that an old callable was rejected. |
| #1085: Vue/Vue2 Button, Vue Select readiness and React Select End focus | `demo-brutalist-button.browser.test.ts`, `demo-select-first-paint.browser.test.ts` | Public runtime selection and source-bound physical projections; never-opened selected label; selected entry and native End/Home without changing selection | Existing simulated-DOM reader controls and historical 192/192 are retained as their own evidence. |
| #1084: persistent Spinner and passive reduced-motion rest | `demo-brutalist-spinner.browser.test.ts` | Four host cases sample all five real CSS animations' progressing time and transforms; reduced-motion frames have no animations and constant transforms; original 1s/linear/infinite, ring, nonfocusability, parent name/busy and narrow-page assertions stay | An infinite animation is never called idle. A static audit frame is not normal-motion evidence or a contrast verdict. |

The selected Button/Select/Spinner consumers are in `apps/www/src/content/docs/zh-cn/`. Spinner records each host's normal/reduced PNG and raw motion JSON when `PROTO_UI_RUNTIME_EVIDENCE_DIR` is set. It observes browser preference emulation, not the operating system's physical setting.

## Public Tooltip host inventory candidate

Base and Brutalist originally declared only WC, React and Vue in their two localized pages. Enabling Vue 2 is paired with actual public-page consumers:

- `demo-base-tooltip.browser.test.ts`: 8 cases, two locales × four hosts, published runtime selection, native sibling Tab/Shift+Tab, browser-computed description, Escape and replacement of an open owner.
- `contrast-tooltip-warm-handoff.browser.test.ts`: 20 cases after the expansion, including four hosts × two themes and the existing physical identity, ownership, retained-paint and delayed-second-paint negative controls.
- The Tooltip case in `demo-brutalist-controls.browser.test.ts`: the existing physical paint, shared theme and Group conditions now include Vue 2. Other families in that file retain their own original runtime inventories.

The public-page Vue 2 slice is **pending native execution** in this record. Registration tests or the independent 84-case fixture do not complete it. The source-bound default audit's current declared inventory changes with these pages; its historical 134-case report remains bound to the original pages.

## Executed evidence and retained failures

| Source / execution | Terminal outcome | Meaning |
| --- | --- | --- |
| `fb6a1ca3459ab90987fd51b3c4dc35b8dc8c2aba`, doesvm, Chromium 145, sandbox enabled | 84/84 native cases passed, 111.71s | The full containing consumer-repairs suite, including 72 Tooltip cases and the existing Label/Drawer cases. |
| Earlier attempt at the same Tooltip source, no `CHROME_PATH` | 84 not-run | Browser prerequisite failure. It is preserved rather than merged into the successful attempt. |
| Local `tooltip-button.test.ts`, `tooltip.test.ts`, Base `transition-timing-matrix.test.ts` | 17/17 passed in three files | Focused source-runtime tests; no native browser or OS AT claim. |
| Initial Transition fixture build | Output-parent `ENOENT`, fixed in the fixture before publication | `writeCompilation` reserves a fresh output directory; its parent must already exist. No product source or assertion changed. |
| Initial complete local canonical Transition build | Eight artifacts plus real-framework browser bundle generated, 4,637,776 bytes | Buildability only. Local Chromium is unavailable under the workspace's socket sandbox. |
| Remote integration `8599f77`, initial Transition launch hook | Hook exceeded 60s, 64 not-run; seven of eight compiler outputs retained, no bundle or browser | The compiler prerequisite was incorrectly grouped as one launch hook. Per-target preparation now records its own source and elapsed time, while lifecycle assertions are unchanged. |
| Remote integration `5d3ec32`, second Transition attempt | `/tmp` ENOSPC before collection; native cases not run | Execution-environment capacity failure; no lifecycle verdict. |
| Remote integration `94e934f11310a9d9c2f7304b4990dcce333af2a4`, doesvm, Chromium 145, sandbox enabled | 64/64 native Transition cases passed, 156.16s | Each target's canonical preparation took approximately 16–17s. This run includes the independently reviewed saved-old-function controls and their JSON outcomes. |
| Limited TypeScript check before the compiler-source hash addition | Passed | The five Tooltip/Transition source files were checked; not a workspace-wide type claim. |
| Repeated limited TypeScript check after hash addition | Process killed with SIGKILL, no compiler diagnostic | Resource termination is retained and does not count as a passing later check. |
| Runtime-runner contract tests | 126/126 passed, no skipped tests | Registration of the new native suite and runner protocol remain coherent; no browser was launched by this check. |
| Public documentation checker | Passed: 305 bilingual primary routes, four library inventories | Source routing/registration evidence; actual page rendering remains a native consumer requirement. |
| Public Tooltip registration and popup-control candidate | Initial three-file run: 76/77; `toolbar` witness did not exist | The current runtime toolbar uses Tabs, so the old test failed before performing its intended negative control. The newly added Tooltip/Vue2 popup path passed. |
| Corrected popup-control fixture | 60/60; subsequently strengthened connected/lease/state preconditions also passed in the selected one-case rerun | The original `toolbar` source key now explicitly constructs a separate connected DOM witness with matching public facts. The original exact rejection is retained; the selected rerun's other 59 cases were not rerun. |

The full successful Tooltip data remains on the execution host:

- `/home/ezra/proto-ui-sprint3-tooltip-browser.log`
- `/home/ezra/proto-ui-sprint3-tooltip-browser-result.json`
- `/home/ezra/proto-ui-sprint3-evidence/fb6a1ca-browser/`

The first Transition prerequisite failure remains in `/home/ezra/proto-ui-sprint3-transition.log`, its sibling result JSON, and `/home/ezra/proto-ui-sprint3-evidence/8599f77/`. Later native runs must retain their own source/result folders. Source manifests record exact working-tree inputs, compiler-source hashes, generated artifacts and bundle hashes.

The successful Transition run is preserved in `/home/ezra/proto-ui-sprint3-transition-round3.log`, `/home/ezra/proto-ui-sprint3-transition-round3-result.json`, and `/home/ezra/proto-ui-sprint3-evidence/94e934f/`.

Independent read-only review found that the initial disposal probe could stop at a new `getExposes()` lookup, without invoking a function retained before disposal. Commits `f2d919195` and `3165f1720` capture and invoke the actual old callable, verify the replacement's independent deadline, and retain the concrete rejection in the raw snapshots. The reviewer re-read both changes and accepted that correction. The same review prompted teardown guards that close a browser whose launch completes after a failed bootstrap owner has retired.

## Shenko and historical acceptance

The original nested-trigger report comes from Shenko. The current upstream pin in `crates/shenko-ui/web/upstream-pin.json` is Proto UI `f29738eb6a804ccfc58510cc5a5bd1692690716e` with React 19.3.1. The inspected current `ui-kit.tsx` consumes the Adapter and nine Shadcn families, but no Tooltip. The public nested-shape negative control therefore demonstrates the reported composition hazard; it is not a passing current Shenko Tooltip journey.

The original #775 audit head, missing native projection coordinates, captured Spinner publications, independent approval/CI/thread gates and GPUI stack remain in their original history. Current tests cannot recreate those missing historical receipts. Likewise, #1018's GPUI compile admission is not an executed native GPUI owner, and #1455 still requires true non-DOM/GPUI and applicable native assistive-technology work. These residuals must remain on the respective issues and their parent trackers after the 0.3 Web slice is accepted.

## Reproduction

Run the fixture-only suites with an installed sandbox-compatible Chromium:

```sh
CHROME_PATH=/path/to/chrome \
PROTO_UI_RUNTIME_EVIDENCE_DIR=/path/to/new-evidence \
corepack pnpm@10.32.1 exec vitest run \
  apps/www/test/component-consumer-repairs.browser.test.ts \
  packages/compiler/test/transition-native.browser.test.ts \
  --maxWorkers=1 --minWorkers=1 --reporter=verbose --reporter=json \
  --outputFile=/path/to/new-result.json
```

Serve the exact candidate's normal website build once, then supply `PROTO_UI_BROWSER_BASE_URL` and the same Chromium/evidence variables to the public-page suites named above. The test checkout alone does not attest a separately served page's revision. The supervising release receipt must bind both source sides. Run only one heavy browser/build process at a time.

To revisit the original full current audit, run `node --import tsx apps/www/scripts/audit-brutalist-contrast.mts` with a fresh `PROTO_UI_CONTRAST_EVIDENCE_DIR` and the same source-bound server. Omit `PROTO_UI_CONTRAST_FAMILIES` for the full declared matrix. A smaller `button,select,spinner` selection cannot stand for that original full scope.
