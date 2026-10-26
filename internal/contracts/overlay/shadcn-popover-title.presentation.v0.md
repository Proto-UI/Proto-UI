# Shadcn Popover Title presentation (v0, uncataloged slice)

Status: independently reviewed bounded presentation direction, approved for this local implementation on 2026-10-11. Full component admission remains open.

This transitional definition concerns only the passive typography of the existing Shadcn Popover Title. It is not an active catalog entity, a complete Popover protocol, a new public API, or full upstream/native acceptance. The current owner-directed Finf work selects the existing Base-route Nova presentation; this document makes the narrow expected result independently reviewable before its recipe changes. A future coherent Popover catalog must replace this uncataloged definition rather than treating implementation or passing tests as its authority.

## Fixed presentation reference

Use shadcn/ui revision `c2a67849be260701852b0977ba15eb5f3a0ce2a4`:

- [Base Popover anatomy](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/bases/base/ui/popover.tsx): the existing Title wraps the Base primitive and receives `cn-popover-title`.
- [Nova Popover rules, lines 925–944](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/styles/style-nova.css#L925-L944): Content provides small text with its standard line height; Title adds medium weight without a local font-size or line-height override.

These fixed files corroborate the previously selected Base/Nova direction. They are not asserted to be byte-identical to the earlier dated deployed registry. Do not substitute new-york, other Shadcn styles, Dialog typography, or Neo tokens.

## Ownership and inputs

- The existing family Content supplies the surrounding font size and line height. Title inherits both and contributes only medium font weight (500).
- In the unchanged default Content, with a 16px root font, the expected computed Title typography is 14px font size, 20px line height and weight 500. The rem-based relationship remains responsive to root typography; 14px is not a hard-coded public constraint.
- An explicitly styled surrounding container may supply another font size or line height. Title must inherit those values rather than locally resetting them to a fixed small or large size. No new Title props or runtime state are added.
- Family typography is passive `feedback.style` intent attached to the existing `asPopoverTitle` composition. It must not introduce another interaction subject, semantic owner, host event listener, DOM inspection, or browser-only render path.

## Semantic and lifecycle non-regression boundary

The recipe change leaves the existing Base implementation untouched. Existing Title anatomy, contextual ID and accessible-name contribution remain attached to the same instance. Content naming must continue to reference that Title. Current Root open/request ownership, controlled rejection, dismissal, focus movement, portal membership, disposal and reconnect behavior must not change because of typography. This preservation requirement is bounded regression protection, not admission of a complete or previously uncataloged Popover guarantee.

The shared composition/style boundaries are `C-AS-HOOK-0001` and `C-FEEDBACK-STYLE-0003`, both currently draft. They govern author-side ownership and intent, not a claim that token spelling alone proves rendered typography.

## Independent acceptance criteria

1. The Title's own passive contribution is weight 500 and contains no local font size or line-height override. The default Content remains unchanged.
2. The real existing public Popover demo computes the default rem-based small typography and weight 500 on Title, including after close/reopen. At a 16px root this is 14px / 20px / 500. Each tested runtime and theme is reported separately; source-host tokens alone do not satisfy this criterion.
3. A fixture with an explicitly styled ancestor demonstrates inheritance of a different font size and line height. The test must not style Title directly or use a page-specific rule to hide an incorrect prototype contribution.
4. Existing Title ID/name relations and relevant open, controlled, focus and lifecycle regressions remain intact. Tests distinguish source-runtime observations from browser-native input and accessibility evidence.
5. Normal complete-family token collection and generated Document/Shadow output preserve the intended contribution. Tests against Title's isolated source may reject its former local tokens; they must not require removing those tokens from a family-wide vocabulary while other components legitimately use them.
6. Real-input screenshots and computed-style receipts identify the exact candidate commit/tree and any local patch, viewport, theme, runtime and font environment. Missing browser/native execution remains explicit evidence debt, not a pass.

## Limits and implementation boundary

Only the Shadcn Title recipe and its evidence are changed. No Header part is introduced; the existing Title/Description spacing is not declared equivalent to the upstream Header composition. Content geometry, available-space limits, transition duration, Base semantics, Compiler, IR and Adapter implementation are outside this slice. No page CSS or hard-coded pixels may compensate for a host translation or inheritance failure; report that failure to its existing owner.

The four public Web runtimes and light/dark themes require independent computed typography observations. Narrow/zoomed content, real keyboard/focus journeys, generated and packed consumers, compiler composition, GPUI anchored overlays, upstream paired screenshots and complete Popover lifecycle/catalog acceptance remain separately reported obligations. Neither one green suite nor this proposal closes a Finf delivery item or changes the 68-item ledger.

## Executable acceptance mapping and current evidence boundary

- Criteria 1 and 5: `packages/prototypes/shadcn/test/popover-title.test.ts` checks the isolated authored contribution, actual source-host tokens, and complete family Document/Shadow output. The family vocabulary alone cannot distinguish the old Title from the repair.
- Criterion 4: that source-host suite covers live text/ID relations, Title remove/remount, close/reopen and balanced instance disposal. The existing `packages/prototypes/base/test/navigation-overlays/overlay-windows.test.ts` and `popover-focus-outside.test.ts` retain controlled, focus and lifecycle regression coverage; Happy DOM is not real browser keyboard acceptance.
- Criteria 2, 3 and 6: `apps/www/src/content/docs/zh-cn/finf-popover-title.browser.test.ts` targets the existing public `demo-shadcn-popover` in four Web runtimes and both themes. It includes default and explicit ancestor inheritance, WC-owned live name/Title removal and remount, all-runtime Close/reopen/Escape, native Tab-to-outside dismissal, and a long-title 320px/200%-root-text sample. The latter is text scaling, not a physical browser zoom claim.
- The dedicated `popover-title` group in `.github/workflows/finf-representative-features-evidence.yml` owns those eight browser cases and retains exact-commit JSON/PNG artifacts. The runtime test planner registers this owner rather than silently excluding the suite.
- This local implementation has **not run the eight browser cases**: the actual local invocation stops at the official GitHub Actions / clean exact-head gate. Consequently default computed typography, custom inheritance, browser-native focus/lifecycle, narrow/200% text and screenshots remain unverified here. GPUI, compiler composition and same-state upstream screenshots also remain unrun. React/Vue/Vue2 renderer-driven isolated Title removal/remount is not covered by direct DOM mutation and remains separate debt. Registration and a blocked setup are not passing evidence.

Agent: dot
