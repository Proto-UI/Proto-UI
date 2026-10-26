# Shadcn Popover command density (v0, proposed bounded presentation)

Status: independently reviewed bounded presentation direction, admitted for this local implementation on 2026-10-11. This is an uncataloged transitional presentation slice, not full Popover or Button admission.

## Fixed reference and scope

The owner-directed Finf work already selects Base-route Nova. Pin shadcn/ui revision `c2a67849be260701852b0977ba15eb5f3a0ce2a4`:

- [Nova Button rules](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/styles/style-nova.css#L148-L206): base `rounded-lg text-sm font-medium`; default `h-8 gap-1.5 px-2.5`, with no vertical-padding contribution.
- [Base Button](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/bases/base/ui/button.tsx): omitted size selects default.
- [Base Popover examples](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/bases/base/examples/popover-example.tsx): basic/form/dialog triggers use an outline Button with default size; alignment examples explicitly select small.
- [Base Popover wrapper](https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/bases/base/ui/popover.tsx): no Close export. The Proto UI Close is an existing consumer command; choosing Nova default Button density for it is this project's explicit presentation choice, not a claim that upstream defines a Popover Close of that size.

Do not substitute Maia, New York, another family, or old 36px defaults. This proposal covers only the existing Shadcn Popover Trigger and Close's single-line default density and radius. It does not claim full outline Button color, hover, dark or focus parity.

This selection is local to the uncataloged Popover command slice. The separate draft `P-SHADCN-BUTTON` keeps its existing fixed New York reference and obligations; this proposal neither changes that entity nor globally migrates Button to Nova. The instruction above excludes mixing references in this slice, not the cataloged Button's comparison basis.

## Ownership and expected presentation

Keep exactly the existing `asPopoverTrigger()` and `asPopoverClose()` composition. Do not add `asButton()`, another interaction subject, activation listener, DOM inspection, public prop, anatomy or host-specific rendering path. Root open/request ownership, controlled refusal, focus, portal membership, disabled behavior and disposal remain unchanged. The applicable shared composition and style boundaries remain draft `C-AS-HOOK-0001` and `C-FEEDBACK-STYLE-0003`.

Both commands contribute `h-8 px-2.5 rounded-lg` instead of their current `px-3 py-2 rounded-md`. Remove `py-2`; do not layer fixed height over the old vertical padding. Preserve `text-sm font-medium` and all unrelated tokens/rules. `h-8` means a 2rem border-box target; `px-2.5` means 0.625rem on each inline edge. At the public page's 16px root font, expected painted border-box height is 32px and horizontal padding is 10px. Rem scaling remains supported rather than freezing pixel values.

Typography has a different owner from Title: these commands already contribute `text-sm`, which sets 0.875rem font size and 1.25rem line height. Keep that explicit small text even when their ancestor provides 19px/31px. Font family continues to inherit. The default 14px/20px text is vertically centered inside the 32px border-box; free centering space is not an invented 5px CSS padding declaration.

Verify actual `box-sizing: border-box` and actual border widths in each host. Do not add page CSS or change an Adapter if a host produces a different box. The demo's Close width continues to come from its container's stretch; this slice does not assert a fixed width or make the upstream example's absent Close into a full-width upstream standard.

## Acceptance and evidence

1. Independent source expectations reject the old recipe for both commands; the repaired authored contribution contains `h-8 px-2.5 rounded-lg`, lacks `py-2 px-3 rounded-md`, retains `text-sm font-medium`, and preserves existing command composition.
2. Real source-host contributions and normal complete-family Document and Shadow CSS support the density utilities without unsupported-token diagnostics. CSS must lower height to 2rem, inline padding to 0.625rem and small typography to 0.875rem/1.25rem. Family-wide vocabulary may still contain old tokens used by unrelated components.
3. The unchanged existing public demo must produce separate actual DOM/computed receipts for Trigger and Close in WC, React, Vue and Vue2, light and dark. Record font/root metrics, box-sizing, CSS height/min/max-height, all padding and border sides, host rect, offset/client/scroll sizes, role/tag/tokens and any Shadow visual/button surface separately. At root16, actual border-box height is32 and inline padding10; vertical padding is0. Do not infer these from source tokens or a screenshot alone.
4. A controlled ancestor-typography probe confirms commands retain14/20 small text at root16 rather than inheriting19/31. A root32 probe separately verifies rem scaling to64px height and20px horizontal padding. This is text-root scaling, not a browser zoom claim.
5. Native browser pointer checks distinguish painted box from hit testing: record actual DOM/deep-shadow hit targets at inset center-edge samples and just-outside samples, and verify actual Open/Close pointer activation from a safe inset sample. Do not label visual height as a minimum accessible touch target or assume a hidden expanded hit region. Screenshot, CSS geometry and input evidence remain separate.
6. Existing source-runtime overlay controlled/focus/lifecycle tests remain green. The bounded public browser journey checks pointer Close/reopen and keyboard Escape without repeating the unproven single-Tab-to-named-Outside assumption from the existing Title suite. Existing Title suite failures remain visible and unmodified.
7. Screenshots and receipts bind exact commit/tree plus local patch/source hashes where relevant, runtime, scheme, viewport, DPR, font readiness and execution environment. Official clean-head browser execution remains separate from local source tests. Missing native/browser/GPUI evidence is debt, never a pass.

## Boundaries and mapping

Planned source/CSS suite: `packages/prototypes/shadcn/test/popover-command-density.test.ts`. Planned public browser suite: `apps/www/src/content/docs/zh-cn/finf-popover-command-density.browser.test.ts`, separately registered with the existing dedicated Finf evidence workflow and runtime planner. Registration is not executed evidence.

Only the two Shadcn family recipes, this definition and directly associated evidence/registration may change. No Base, Compiler, IR, Adapter, Body, other family, public demo content, or Finf completion-count mutation. LiquidGlass appearance, material admission and diagnostic planning are outside this definition.

Agent: dot
