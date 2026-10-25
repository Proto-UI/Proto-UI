# Neo Brutalism Popover Title presentation (v0, uncataloged slice)

Status: independently reviewed bounded presentation direction, approved for this local implementation on 2026-10-11. Full component admission remains open.

This transitional definition concerns only the passive typography of the existing Neo Brutalism Popover Title. It is not an active catalog entity, a complete Popover protocol, a new public API, or full upstream/native acceptance. No complete Popover P/T entity currently exists; this coherent narrow definition must be independently reviewed before changing the recipe, and must eventually be replaced by coherent Popover catalog admission rather than an empty placeholder.

## Fixed presentation reference and token translation

Use neobrutalism-components revision `3306a802724874a85f93079702b2795370a279d4`:

- [Popover Title, lines 65–75](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/popover.tsx#L65-L75), Git blob `f313943b5ee811a6bf9ff5b57de4fee25da3b739`, uses `font-heading leading-none` without a local font size.
- [Global theme](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/styling/globals.css), Git blob `0db21814a42d75973b09ca8de9cad69c6475d115`, declares `--heading-font-weight: 700`, maps `--font-weight-heading` to it, and declares DM Sans as the base family. Upstream `font-heading` therefore expresses weight, not a font-family utility.

Proto UI's existing `font-heading` token instead means `font-family: var(--pui-font-heading, ui-sans-serif, system-ui, sans-serif)`. It cannot substitute for the upstream weight. The proposed family projection is `font-heading font-bold leading-none`: the existing Neo heading-family role, explicit weight 700, and unitless line height 1. Its default DM Sans heading role matches the selected Neo theme's base font. This retains the project's theme-controlled heading role without adding a new token, runtime state, or external font request. It does not claim upstream's custom heading-weight variable is exposed by Proto UI. Body and heading-family customization may differ; only font size is required to inherit in this slice.

## Ownership and inputs

- The unchanged Content and host environment supply font size. Title contributes no local font-size token and must inherit a deliberately changed container size.
- With a standard 16px root and unchanged default Content, Title computes 16px font size, 16px line height and weight 700. These are default environment observations, not hard-coded public pixel constraints. With an explicitly 19px Content, Title computes 19px/19px/700 even if Content line height is 31px.
- The unitless Title line height is locally owned and does not inherit Content's line height. Its family is the existing Neo heading role; the default standard theme declares DM Sans with its existing fallback stack.
- Family typography is passive `feedback.style` intent attached to the existing `asPopoverTitle` composition. No new props, parts, semantic owner, event listeners, DOM inspection, Web-specific bypass or runtime state are added.

## Semantic and lifecycle non-regression boundary

The Base implementation remains untouched. Existing Title anatomy, contextual ID and accessible-name contribution remain attached to the same instance; Content continues to reference the Title. Existing Root open/request ownership, controlled rejection, dismissal, focus movement, portal membership, disposal and reconnect must not change because of typography. These are bounded regression requirements, not admission of the full uncataloged Popover protocol.

Shared boundaries `C-AS-HOOK-0001` and `C-FEEDBACK-STYLE-0003` are currently draft. They govern composition and author-side style intent; token spelling does not prove final typography. The legacy overlay contract supplies background, not the exact typography oracle.

## Independent acceptance criteria

1. The isolated Title contribution uses existing heading-family intent, explicit 700 weight and unitless line-height 1, without a local font-size override. Default Content remains byte-for-byte unchanged.
2. The actual existing public Neo Popover demo computes inherited font size, weight 700 and line-height equal to that size. At a standard 16px root/default Content this is 16px/16px/700. Repeat after close/reopen and report each of four Web runtimes and both themes independently.
3. An explicitly styled Content fixture proves size inheritance with a different font size and proves that Title's unitless line height remains locally owned. Do not style Title directly or add page CSS to hide a wrong recipe. Sample computed heading family and resolved heading variable separately.
4. Existing Title ID/name relations, relevant controlled/open/focus/lifecycle regressions and instance disposal remain intact. Source-host tests are not real browser-native keyboard evidence.
5. Complete-family token collection and normal Document/Shadow CSS generation preserve the intended contribution. Other components may still use `text-xl` and `font-black`; isolated Title assertions must not erase legitimate family-wide vocabulary.
6. Real-input screenshot and computed-style receipts identify exact candidate commit/tree or local patch, runtime, theme, viewport and font environment. Explicitly record portal ancestry, Content/Title theme variables and font-family. Any existing portal theme propagation defect is separate evidence debt, not silently fixed with Content constants, Adapter changes or Web-only hacks.

## Limits and validation boundary

Only the Neo Title recipe, this narrow definition and relevant tests/evidence may change. Keep Content geometry, padding, colors, border, available-space limits, transitions, Base, Compiler, IR and Adapters unchanged. No Header part is introduced; current Title/Description spacing is not declared equal to the upstream Header composition.

The planned source suite is `packages/prototypes/brutalist/test/popover-title.test.ts`, with existing Base `overlay-windows.test.ts` and `popover-focus-outside.test.ts` for regressions. The browser evidence uses the unchanged public `demo-brutalist-popover`. Eight independent typography cases cover four Web runtimes × light/dark, controlled ancestor size, pointer close/reopen and a 320px/200%-root-text long-title boundary. Four separate light-theme interaction diagnostics observe the actual native Tab target, WC-owned name/remount behavior, explicit outside pointer dismissal and Escape/focus return. The typography cases do not depend on naming or Tab-order diagnostics reaching a later stage. The 200%-root-text fixture is text scaling, not physical browser zoom. Tests must retain official native-runner exact-head and loopback-only safeguards; local setup blocks remain unrun evidence, never passes.

The public demo callback-only `setProps` can clear its fallback `a11yLabel`; that fixture debt is observed independently and is not a typography acceptance prerequisite. A native Tab is not assumed to reach a named outside button. Diagnostics preserve the actual target and state, then re-establish an open panel before an explicit outside pointer click. That click may dismiss via pointer-outside before focus changes, so it does not prove pure focus-outside or natural Tab-order semantics. Existing Shadcn browser failures and source-host definition assertions remain unchanged. Real keyboard-only outside dismissal remains unverified until the actual focus order is established.

GPUI anchored overlays, compiler composition, generated and packed consumers, React/Vue/Vue2 renderer-driven Title removal/remount, paired same-state upstream screenshots and full Popover/catalog acceptance remain separate obligations. This slice does not close a Finf item or change the 68-item ledger.

## Executable mapping and current evidence boundary

- Criteria 1 and 5: `packages/prototypes/brutalist/test/popover-title.test.ts` checks the isolated source contribution, actual source-host tokens and complete-family Document/Shadow output. The old recipe fails the new isolated/source-host assertions while the pre-existing family vocabulary already contains the desired tokens; the whole-family check alone is deliberately not a discriminating regression oracle.
- Criterion 4: that source-host suite exercises live text/ID relations, Title removal/remount, close/reopen and balanced instance disposal. Existing `overlay-windows.test.ts` and `popover-focus-outside.test.ts` remain the controlled/focus/lifecycle regression boundary; Happy DOM does not establish real keyboard interaction.
- Criteria 2, 3 and 6: `apps/www/src/content/docs/zh-cn/finf-neo-popover-title.browser.test.ts` uses the unchanged public demo. It independently normalizes the heading role's resolved family with a separate browser probe, then checks Title's computed family without styling Title. It retains both theme-variable absence debt and font availability receipts without claiming every glyph used DM Sans. It checks the narrow panel against the viewport as well as Title against Content.
- The dedicated `neo-popover-title` group in `.github/workflows/finf-representative-features-evidence.yml` owns eight typography cases plus four independent light-theme interaction diagnostics and retains exact-commit JSON/PNG artifacts. `scripts/test/runtime-test-plan.mjs` registers that executable owner.
- The actual local browser invocation stops at the official GitHub Actions / clean exact-head gate before opening a browser. All twelve cases and their screenshots are therefore **not run** here. Prepared assertions, source-host passes and generated CSS are not native acceptance. The default and custom computed sizes, native interactions, portal theme observations, narrow/200%-text bounds and screenshots require the dedicated official run before they can be reported as passing.

## Separately authorized Website consumer follow-up (2026-10-11)

The original Title-only scope and local-run boundary above describe that implementation slice. The subsequent official `5c5b2e440e98405c0ee8f60140575c4dfc89589d` run resolved the public route but observed missing portal heading/body variables and fallback computed families in all eight typography cases. This authorizes no change to the passive Title definition.

The separate Website consumer repair explicitly opts the existing public demo Content into the existing `ref` + `previewTheme: 'portal'` composition API. Preview owns the complete theme input, updates and cleanup through normalized `surfaceStyle`; no Prototype, Base, Compiler, IR, Adapter, automatic DOM inheritance or new public API is introduced. The generic preview README and real four-runtime public-demo tests map this opt-in.

For this consumer follow-up, the browser oracle requires Title and Content heading/body variables to equal the default Neo `"DM Sans", ui-sans-serif, system-ui, sans-serif` stack and their computed families to match an independent browser-normalized copy of that fixed stack. An absent variable or fallback-only family is a failure. The existing DM Sans resource must also be loaded; its availability remains separately recorded and does not establish the font used by every glyph. New real-browser evidence is still required for the repaired candidate.

The shared public-DOM timeline probe only observes existing typography journeys, including the 320px/root-200% transition and final real Close click. It retains the original assertions and timeouts; no coordinate, focus, scroll or production behavior is repaired by the probe. The prior React/Vue off-viewport Close failures and independent interaction debts remain open until new evidence resolves them.

Agent: dot
