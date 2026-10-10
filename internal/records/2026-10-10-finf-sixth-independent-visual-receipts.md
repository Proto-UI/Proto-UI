# Finf sixth-batch independent official browser receipts

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

2026-10-10 UTC. Exact source baseline: `4c3dd2fdf2851d8a6d9f0fa38db939cdb36e0b2f`. The source includes the sixth-batch family work and Runtime Tabs composition-owned focus correction. This change owns only the existing representative browser suite, its official workflow, a no-browser harness regression test and this record. The fifth frozen snapshot, component/Runtime/Compiler implementations, registrations and generated styles are untouched.

## Scope and execution boundary

The existing registered suite remains `apps/www/src/content/docs/zh-cn/finf-representative-features.browser.test.ts`, owned by `.github/workflows/finf-representative-features-evidence.yml` in the runtime test plan. No unregistered browser file is introduced. The workflow now has five independent matrix groups, `fail-fast: false`, at most four concurrent jobs:

- `forms`: 12 cases. Form editing/reset/fresh edit, Fieldset rest/keyboard entry, CheckboxGroup mixed/checked/cleared-and-keyboard-toggle, each across Shadcn, Neo, Bootstrap 2.3.2 and Liquid.
- `calendar`: five fresh-context Shadcn cases. October rest (plus retained October 15 selection), month menu, 101-year current-option/real-wheel scroll, November 7 focus-only and November 7 pointer-selected-and-focused. Host locale zh-CN, explicit English Calendar semantics and fixed 2026-10-10 UTC clock remain separate. Forty-two mounted capacity cells do not excuse more than 35 visible cells in these months.
- `disclosure-overlays`: eight cases. Accordion rest/open/close/reopen/controlled acceptance and Popover open/close/reopen/Escape across four families.
- `modal-overlays`: five cases. Four AlertDialog families with primary/cancel appearance, hover, keyboard focus, cancel and actual confirmation close; one Shadcn Drawer preserves its half-snap extent, viewport and Close intersection assertions, then performs actual Close, reopen and Escape.
- `runtime-tabs`: four family cases. Actual labels Web Components, React, Vue and Vue 2; manual arrows without selection; Enter/Space through all four real runtime generations; one generation increment per switch; focus restoration; Home/End; fresh rest/selected/narrow-focus images; actual underline/text-width/no-pill geometry and narrow horizontal-scroll checks.

There are **34 independently registered browser cases** and **five artifact groups**. A failed case cannot skip the next case: each has a new browser context. Every attempted case writes its own screenshot list, SHA-256 digests, exact running HEAD/tree, route, runtime, viewport, fixed clock, locale/DPR/font/theme, page errors, actual assertion error, capture errors and source-reference boundary. Captures happen before later paint assertions and again in `finally`, so failures retain actual pixels. Screenshot failure is not a pass and cannot invent an image. Shared setup failure writes 34 or the selected group's blocked receipts with no image claim.

The workflow's preset check remains a normal failing step with its real log. Subsequent capture explicitly runs when setup/surface are available even if presets failed; receipts record the preset outcome. The job remains failed, and upload runs with `always()`. Artifact names bind group, full candidate SHA, run ID and run attempt. No `continue-on-error` weakens that resource gate.

The suite launches only in official GitHub Actions with a provided exact candidate SHA, rejects tracked source drift and non-loopback servers, and explicitly keeps `chromiumSandbox: true`. It does not import the shared unsandboxed launcher. Its bounded Runtime Tabs chooser uses the real role/tab labels and the existing read-only runtime readiness helper, not the old Select-only chooser. All non-test HTTP(S) origins are aborted; no account, external screenshot upload or third-party-source execution is involved.

## Authority, references and non-equivalence

Calendar uses `internal/contracts/prototype-base/calendar-month-extent.v0.md` and the dated five-state correction record. Runtime Tabs uses the actual family Tabs protocol and runtime-box record, including the existing source-only rule/collector limitations. Form, overlay and Accordion source records remain linked in each receipt; their lifecycle and incomplete-definition caveats remain in force. This evidence change does not ratify new Base semantics or mark any Full-delivery item complete.

Ordinary no-card CheckboxGroup rows and unframed Fieldsets are asserted for the three source-compared families. Liquid's current bordered material/fallback card is captured separately, without silently imposing another family's recipe. Popover 18rem width is asserted only for Shadcn/Neo. Bootstrap adaptation and Liquid's absence of matching public Apple component source are disclosed. Drawer is bound to its actual own regression oracle rather than an invented newly verified upstream source.

The source records carry the inspected official Shadcn registry/page references, fixed Neo source revision and Bootstrap 2.3.2 source. These are comparison references, **not same-state upstream images or proof of pixel equivalence**. The fresh official output still requires a reviewer to compare the corresponding real upstream state. The family Select popup cannot stand in for native select popup pixels. Web images cannot stand in for native GPUI/Qt/Rust evidence.

## Local verification and failures retained

No native browser, no-sandbox retry, official CI run or external write was performed locally. Installed Node 24.19.0 / pnpm 10.32.1 dependencies were reused without downloads. Worktree-local dependency links were used only to resolve the already installed declared test packages; repository aliases retain the current source.

- The first scoped type attempt exposed a missing worktree-local `playwright-core` resolution. Linking the existing app dependencies fixed setup; no manifest or lockfile was changed.
- The first no-browser harness run passed 9/10; one source assertion was incorrectly sensitive to Prettier line wrapping of the unchanged actual-Close capture call. Its whitespace-tolerant correction preserves the same call/state requirement.
- A subsequent joint type check exposed an undeclared JS module import in the new source test. The test now loads the existing deterministic test-plan export through Node's supported module loader with a typed value boundary; no browser suite is imported.
- Final no-browser harness: **10/10 passed**. It reconciles all 34 cases/five groups and every real route, confirms suite ownership, executes mocked receipt paths for normal/failed/navigation/capture failures, preserves the original error, verifies fresh contexts after failure, and checks the sandbox/preset/final-upload boundaries. Mock image bytes stay in memory and are explicitly not visual evidence.
- Scoped strict TypeScript for the browser suite, harness and imported plumbing passes. `git diff --check` passes.

Reproduction:

```sh
corepack pnpm@10.32.1 exec vitest run apps/www/src/content/docs/zh-cn/finf-representative-features-evidence.test.ts --maxWorkers=1 --minWorkers=1
corepack pnpm@10.32.1 exec tsc --noEmit --target ES2022 --module ES2022 --moduleResolution Bundler --strict --skipLibCheck apps/www/src/content/docs/zh-cn/finf-representative-features.browser.test.ts apps/www/src/content/docs/zh-cn/finf-representative-features-evidence.test.ts
```

## Next gates

Integrate this separate commit, regenerate combined source resources with the normal generators, then execute the five official matrix jobs on the actual integrated head. Inspect every successful and failed case image and compare matching upstream states; correct selectors only when their source premise is demonstrably wrong, without suppressing genuine layout/collector failures. Calendar hidden/focused/selected CSS, native popup differences and long-year performance remain real pending observations. Runtime mixed-rule CSS resource proof and native focus/paint cannot be inferred from these local harness checks. Dark/forced-colors/200% text, additional calendar month lengths/families, optional basic-control captures, complete packed/native coverage and independent acceptance remain separate work.
