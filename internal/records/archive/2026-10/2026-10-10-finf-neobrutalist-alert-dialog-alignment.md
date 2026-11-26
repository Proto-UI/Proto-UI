# Neo-Brutalist AlertDialog: bounded source alignment

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and provenance

The owner requested continued implementation and a closer comparison with the official Neo-Brutalist AlertDialog. This local candidate starts at `2a67cb6173020c487591724538ca56e03f14a1ea` on PR #872 / tracker #870. It is a bounded prototype repair, not complete Finf or upstream visual acceptance.

The current baseline screenshot was inspected: two full-width action rows were direct children of Content's grid, and Header/Footer grouping was missing. That screenshot belongs to baseline tree `af287fdbda0bc5ab21e7a0ed59f328e51f5d7e86`, not the preceding product tree `d65e8a4d957560894b34dfe534e7dd503cc53cff` and not this new candidate.

Reference: [neobrutalism-components AlertDialog at 3306a802](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/alert-dialog.tsx), [Button](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/button.tsx), [default styling](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/styling/globals.css), and [example composition](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/examples/ui/alert-dialog/index.tsx). The existing `packages/prototypes/brutalist/THIRD_PARTY_NOTICES.md` retains the MIT license and Samuel Breznjak copyright. The upstream source was read, not executed, in this repair.

`K-BRUTALIST-0001` governs provenance. The existing source-aligned design record in `docs/superpowers/specs/2026-10-03-neobrutalism-source-aligned-design.md` was read from the Git tree because this checkout is sparse. It retains the Proto UI dark palette, theme-relative focus ring and instantaneous elevated control feedback as deliberate extensions.

## Definition and implementation decisions

- The existing `ALERT_DIALOG_FAMILY` already declares optional `header` and `footer` roles under Content. New family-owned Header/Footer prototypes use only those claims, static style plans and the anonymous slot. They have empty Props/Exposes and install no Base behavior hook, state, command, focus or event owner. Two new draft definitions and one test entity describe this boundary.
- Header groups Title and Description with an 8px gap. Footer groups Cancel then Action, uses intrinsic widths, right alignment, a 12px gap and natural reverse wrapping. The public demo consumes these real prototypes through two explicit preview registrations. It does not paint substitute controls.
- Content now uses 5px radius, 24px padding, theme `border` ink, the already supported black 4px hard shadow, and the existing centered available-region bounds. Its 16px grid gap now separates Header and Footer.
- Title owns `font-heading font-bold text-lg` (18px/28px at the default root font size); it deliberately does not borrow ordinary Dialog's `leading-none` or tracking. Description owns `font-sans font-medium text-sm` (14px/20px).
- Mask uses the existing overlay token: 80% black in Light, 85% in the retained Proto UI Dark extension. Trigger uses default elevated Button paint through its original AlertDialog command's borrowed interaction states. No second Button hook or input owner was introduced.
- No Body part exists in the pinned official default AlertDialog or this Base family's roles. Description remains the primary message; Content remains the scroll/available-region owner. This repair does not invent a Body API or resolve a wider Body/scroll-region design TODO.
- No Base, shared Core, Runtime, Adapter, Compiler, collector, common Button tokens or other design-family source is changed. The sole CLI-path edit is the generator-owned Brutalist token inventory: `flex-wrap-reverse` is added. There is no CLI implementation or facade-registry change; consuming the new parts through generated CLI facades remains outside this candidate.

## Validation and preserved failures

Node 24.19.0, pnpm 10.32.1 and the repository's installed dependencies were used.

- Before the repair, five focused cases failed on the intended missing rounded paint, Header/Footer exports/layout, Trigger paint and flattened demo. The existing controlled command case passed.
- Focused source/host-unit coverage passes for the new composition, inherited single-owner requests, Cancel focus, outside-dismiss guard, repeated opening, accessible relationships, static group boundaries and demo registration. Shared Base overlay, four-family passive command paint and four-runtime preview portal-theme tests are included in the evidence packet.
- Source closure renders the actual collected recipes through both unchanged document and Shadow CSS renderers, verifies their declarations and checks inclusion in the generated inventory. This is physical CSS closure, not computed geometry or pixel proof.
- An initial proposed `shadow-[4px_4px_0_0_var(--pui-border)]` token failed that closure because the renderer does not support it. The failed attempt is retained. The candidate uses the existing supported hard-black shadow; no renderer exception or generated-CSS patch was added.
- The official Brutalist generator and all-family preset freshness checks pass. The final generated diff contains one token only; the generated theme is unchanged. Workspace TypeScript and the three new catalog inputs' lifecycle authoring checks pass.
- The full prototype catalog checker still reports exactly 550 errors, matching an independent clean checkout at the same baseline line for line: zero new and zero removed diagnostics. Existing eight-part AlertDialog catalog debt and all unrelated debt remain visible and unmodified.
- Environment and fixture failures are retained in the packet: the first cross-workspace demo test import needed moving to its website-owned test; the collector return needed its existing string-array type; missing ignored website style artifacts required their official generator; the `tsx` CLI could not create its IPC socket, so the same lifecycle script ran through `node --import tsx`; sparse native source paths required read-only materialization from the identical baseline tree for the catalog loader.
- Package validation first found stale shared workspace links pointing at the recovery checkout's old declarations. Only this candidate's dependency links were rebound to its own workspace packages. Shared dependencies and source were not modified. Full command receipts and later results accompany the handoff; a narrow pass does not retroactively turn an earlier failure green.

- After rebinding declared workspace dependencies, the public build passed all 15 packages in the Brutalist dependency closure; root and `/alert-dialog` JavaScript exports resolve the same Header/Footer objects and their emitted declarations exist. A synthetic-click focus-return check initially omitted the browser's default Trigger focus; the corrected fixture establishes that entry focus before clicking and retains the focus-return assertion.

- Final official `check:types` passed: workspace TypeScript plus Astro over 810 files, zero errors/warnings and 11 retained hints. Its earlier environment failures (Astro configuration path and sparse `shared/links.json`) remain in the packet; the rerun used a writable config directory and materialized that unchanged tracked JSON.

Normal commit hooks and a signed-off author declaration apply to the local candidate. The parent publisher owns publication, exact-head CI, the per-commit PR report and screenshot follow-through; this worker neither pushes nor posts.

## Acceptance still open

`C-FEEDBACK-STYLE-0004` prohibits author-side `sm:` variants; only the static `selection:` exception is allowed. Natural Footer wrapping is a bounded improvement, not a replacement acceptance target. At ordinary 320/390px widths, short buttons may still fit on one row. Full upstream acceptance remains open:

1. Below 640px: Header text centered and full-width Footer reverse columns, with Action above Cancel. At 640px and above: left-aligned Header and right-aligned intrinsic-width action row. Check both 639 and 640 explicitly.
2. At 545–639px, upstream Content follows viewport minus 32px before its desktop 512px cap. This candidate retains the existing all-width 512px cap and available-region safety semantics.
3. Upstream 200ms enter/exit fade and scale are not implemented here; existing zero-duration transition configuration remains. The focus offset and Dark palette are retained Proto UI extensions, not upstream Dark equivalence.
4. Small-size and Media variants remain unavailable. Public demo copy remains a safe behavior demonstration and differs from the official example; use matching content before comparing complete screenshots pixel by pixel.
5. Real candidate-bound browser/native screenshots, computed dimensions and loaded-font checks are pending the existing official CI path. Required samples include Light/Dark, desktop, 320/390px, 639/640px, long text/200% text, hover/press/focus, Cancel/Action/Escape, repeated opening and focus restoration. Host-unit synthetic input is not native-input acceptance.

## Handoff requirement: general responsive layout

This is a requirements note for the framework/Compiler owners, not a new API or permission to change the shared implementation.

- Input must identify its coordinate space and source: logical root viewport extent versus safe available region versus parent content width. Upstream's 640px rule is viewport-based; whether two buttons happen to fit is different information. Choose explicitly rather than calling all three “width.”
- Define finite nonnegative units, equality at the threshold, unknown/unready input behavior, initial sampling, resize/reparent/view-replacement updates, zoom/text-scaling behavior and disposal. Web CSS pixels and native logical units need an explicit correspondence; device pixels must not leak into portable Prototype state.
- Keep semantic input/rule evaluation separate from style-only output. A prototype may select layout from an admitted fact; it must not query `window`, `matchMedia`, CSS selectors or private Host-cap variables. The Host-cap measures and invalidates facts; it does not choose AlertDialog breakpoints, commands or state owners.
- Preserve one topology/command owner across layout changes. Authored Cancel/Action order, focus ownership, controlled open state, labels and modality must not be reconstructed or duplicated by layout.
- Prove the generic contract across host profiles and retain diagnostics when unsupported. Test unknown-to-ready, 639-to-640 and back, root replacement, stale callbacks, available-region occlusion versus viewport, text scaling, real rendering, and source/compiled parity. A CSS media-query shortcut or component-name dispatch is not an acceptable substitute.
