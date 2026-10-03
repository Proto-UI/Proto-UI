# Bootstrap 2.3.2 Base state/text controls

Date: 2026-10-03. Non-normative, local candidate for #799 within the still-open #792. Baseline `36b43ac4a81b7ac8f17586f32bf6fcd468594c49`. This increment is eight parts / six additional kinds, not completion of the 53-part Base inventory.

## Authored and registered scope

| Kind | Parts and unchanged semantic owner | Version-fixed reference / projection difference |
| --- | --- | --- |
| Checkbox | Root `asCheckboxRoot`; Indicator `asCheckboxIndicator`, same-domain derived checked/mixed | [2.3.2 forms](https://getbootstrap.com/2.3.2/base-css.html#forms). Custom square/glyph projection rather than the original native checkbox skin |
| Switch | Root `asSwitchRoot`; Thumb `asSwitchThumb`, context-only derived value | [2.3.2 buttons](https://getbootstrap.com/2.3.2/base-css.html#buttons) palette/raised relief extension. Core 2.3.2 supplies no Switch |
| Toggle | `asToggle`, persistent active plus inherited press/hover/disabled/focus | [2.3.2 buttons plugin](https://getbootstrap.com/2.3.2/javascript.html#buttons) appearance reference only. Design-language extension; no copied plugin or competing active owner |
| Input | `asInputRoot` and its module requirement, one single-line host editor | [2.3.2 forms](https://getbootstrap.com/2.3.2/base-css.html#forms). White compact field, inset shadow, stronger focus-visible ring and scalable geometry |
| Textarea | `asTextareaRoot` and its module requirement, one multiline host editor | Same archived forms reference; Base retains stable controlledness, IME, rows/wrap and physical focus; vertical resize and 64px scalable minimum |
| Separator | `asSeparatorRoot`, contentless orientation/decorative owner | [2.3.2 Base CSS](https://getbootstrap.com/2.3.2/base-css.html). Simplified one-pixel horizontal/vertical palette divider, without historical two-edge rule or margins |

All eight parts are real source exports and draft catalog entities. The partial public registry and dynamic loaders now contain Button plus these six kinds; absent kinds remain explicit errors. Six real DemoSpec recipes, bilingual library/detail pages and sidebar entries expose the actual parts. Every Bootstrap library/detail preview follows the global four-Web runtime selection and has no toolbar requiring a nonexistent same-family Select. The eleven-kind homepage family selector remains unchanged.

## Style and packaging

The two additional finite translator entries are `justify-start` and the archived `shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]`. Current-main `font-sans` and `rounded-base` remain present and have a regression assertion. The draft-family preset is regenerated from actual source, not hand-edited. The GPUI fixture is regenerated through the same physical translator and adds three data entries: alignment, existing 6px padding and the inset-shadow token. It preserves the same unsupported property kinds; no native rendering support is added or inferred.

`@proto.ui/cli` was built in this worktree and packed into an actual npm tarball using `npm pack --ignore-scripts` after the build. The unpacked CLI executed its real `tokens` command on the Bootstrap source and emitted 88 physical tokens without unsupported-token diagnostics. `LICENSE-BOOTSTRAP` and the expanded `THIRD_PARTY_NOTICES.md` both appear in the archive and compare byte-for-byte to the source copies. The private source package retains its separate Apache attribution. No package was published.

## Local evidence and failures retained

- Eight focused files total 96 passing tests across source, real simulated-WC controls, physical translator, partial manifests/loaders, docs recipes, library overview and composition. The initially mistyped lowercase Overview test filter was detected as uncollected and rerun at its real path, adding the three Overview tests. Controlled Checkbox/Switch/Toggle each emit one proposal, retain externally controlled state, suppress disabled requests and recover. Context indicators, unique editors/IME, live disabled/read-only values and separator orientation are exercised.
- Draft preset check, Prototype catalog, public manifest check, public docs check and lifecycle authoring pass. Lifecycle authoring was run directly with `node --import tsx` against the exact baseline.
- Narrow TypeScript covering the Bootstrap source/tests and public manifest/loader dependency closure passes. A test collector's `unknown[]` inference was corrected to the collector's string-token contract before the passing run.
- Six new recipes and all seven kinds pass public registration/composition checks; 16 Bootstrap MDX pages, both changed Astro components and the new fixture compile locally. Nine static evidence/browser-plan tests pass. This is not real browser paint evidence.
- A separate Astro-strict TypeScript program reports no diagnostics on the new fixture client script or browser suite, but 96 dependency-graph TS1484 type-only-import diagnostics. They are not reconciled against a baseline and are not silently counted as a passing dependency check.
- Full workspace TypeScript was attempted twice and terminated with SIGKILL, without TypeScript diagnostics; it is not recorded as passing. The narrow check does not replace it.
- Initial test collection lacked per-package dependency links in this fresh worktree; linking to the existing dependency store resolved it without installing another version. A first pack attempt could not create the default npm cache; the same pack succeeded with an explicit writable temporary cache.
- The repository `tsx` CLI wrapper used by lifecycle authoring and four GPUI generator subprocess checks attempted an unavailable IPC pipe and failed with EPERM. No browser/socket retry or sandbox escalation was made. Direct Node import execution of the same generator passes, including three real positive/stale/missing controls. Five independent GPUI fixture inventory assertions pass; the original four CLI-wrapper checks remain blocked locally.
- A test attempt to inspect private `__asHooks` metadata on exported objects failed because the WC adapter executes derived prototypes rather than mutating those exports. That invalid assertion was removed; exact source hook invocation, physical composition, runtime-owned state and loader identity remain independently asserted.

## Prepared evidence, not yet collected

`/en/test/bootstrap-state-controls/` mounts all eight parts using the four actual Web runtimes and source-derived CSS. The new bounded workflow is `contents: read`, checks out the PR head without persisted credentials, verifies exact SHA before any server starts, and retains screenshots plus a failure-aware manifest. The browser suite is deliberately opt-in and Actions-only; local Chromium, server, socket, ptrace and native UI execution were not used. The suite is also registered in the repository browser inventory so ordinary no-server test phases exclude it.

Real browser paint/keyboard/hit testing, independent exact-head Actions acceptance and final screenshots remain pending. The planned checks do not prove public general Prototype Compiler, GPUI, Flutter or Qt conformance. #792 remains open for the remaining Base family parts, native transaction/layout/paint, missing backends and generated-target differential evidence. There is no newly identified Proto atomic semantic gap in these eight projections: existing Base hooks and modules are sufficient for their authored behavior.

## Independent local review

A fresh-context reviewer independently ran five source/registry/docs/CSS files (70 tests), catalog, nine-input lifecycle authoring, preset and diff checks. It found no evidenced blocking source defect. A separate continuation reviewed the finalized evidence scaffold and ran its five static checks without a blocker. Both conclusions are local source review only; there is no canonical v5 PR packet, published approval, real browser result or exact-head CI acceptance yet.
