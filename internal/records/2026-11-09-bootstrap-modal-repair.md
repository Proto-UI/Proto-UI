# Bootstrap modal presentation repair

## Scope and authority

The current user rejected the Bootstrap homepage Dialog's compressed title/body, faded actions and unusable appearance. This repair is human-assisted and limited to the Bootstrap 2.3.2 family and its real website consumers. Base dismissal, focus, controlled state and presence remain unchanged. These family entities remain draft.

Reference: twbs/bootstrap `b4c4072679943773a7582daa63f545ba818fa627`, `less/modals.less`, the official 2.3.2 modal: 560px entered surface at top 10%, title bar (9px 15px), body (15px), separated footer (14px 15px 15px). The upstream code was read, not executed. Existing attribution remains in THIRD_PARTY_NOTICES.md.

## Diagnosis and repair

- The homepage put Title and Description into a horizontal Header, omitting the modal-body region. The Bootstrap composition now separates Header, Description/body and Footer. Other families retain their own composition.
- Dialog Close wrapped family Buttons but applied the icon-only `.close` opacity of .2 to their entire subtree. Close is now an unstyled command wrapper, consistent with the distinct public CloseIcon. The icon owns its glyph, hover and visible keyboard focus; an opaque 32px target is an accessibility adaptation, not a claim of pixel-identical legacy `.close`.
- An initial fixed-light modal candidate was rejected during independent review: nested Field/Form/Text still resolve the dark semantic foreground and would become unreadable on that fixed light surface. Dialog, AlertDialog and Drawer now use paired semantic background/foreground colors. Their title/body, borders and secondary action bars follow the same palette, so nested public components compose consistently. Light mode preserves the white/#333/#f5f5f5 vocabulary; dark mode is explicitly a Proto adaptation, not a historical Bootstrap dark theme. The fixed white inset footer highlight is omitted.
- AlertDialog now exposes a passive family Footer using the already-declared Base footer anatomy role. It adds no interaction or Base semantic part. The shared English/Chinese documentation demo groups its existing Cancel and Action commands inside it.

## Evidence and limits

Focused Vitest run: four files, 32 tests passed, including public Dialog ownership, AlertDialog controlled refusal/cancel focus and the two real consumer structures. Existing diagnostic warnings about AlertDialog primary-message registration appear during fixture setup. The catalog check initially detected the missing Footer test relation; after adding it, the catalog check passes. These are DOM/contract checks, not native visual or assistive-technology acceptance.

Final source-derived style generation, exact-head browser images (both themes, narrow and wide viewports), hover/focus/disabled states, repeated opening/closing and independent review remain the integrating task's obligations. Existing upstream top-motion and native acceptance gaps are not closed by this repair.
