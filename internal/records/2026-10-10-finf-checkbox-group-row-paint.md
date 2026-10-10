# CheckboxGroup ordinary-row projection

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This is a bounded successor to the family Field paint and nested-consumer fixes. It uses the same source/license packet; no Base behavior, public variant, extra prototype identity or interaction owner is introduced.

## Specific comparison

- Shadcn official base-nova Checkbox TSX snapshot from 2026-10-10 has SHA256 `0cc30ddee3fa93818799f48ad47a58a30652c956ce940373c3feb3559167f0af`. Ordinary Checkbox is a 16px visible box with adjacent label; the filled/bordered card label in Field is a separate composition. This patch removes the default whole-row primary fill, border, padding and shadow, placing the checkbox skin around the existing passive glyph instead.
- Neo fixed `3306a802724874a85f93079702b2795370a279d4`, Checkbox TSX `2b864431334ef4bcc47742deb03d5b8d0b8710d3c8d17cf5174ea73ad9cc0259`: unchecked is not a whole main-color button. Only checked/mixed box receives main color; text keeps foreground/heading weight. The passive 20px framed box reserves the upstream 16px square plus its two 2px outline edges, avoiding an unreserved outline overlap. It carries no elevated shadow and does not invert the entire label on selection.
- Bootstrap v2.3.2 `.checkbox` is a compact text row with a native input. Proto's existing custom Checkbox adaptation, already disclosed in its package notice, is the skin reference: 20px rounded box, inset shadow and primary checked color. This patch confines that custom skin to the passive box and uses a 4px text gap. All/mixed remains an independent extension, not a claimed upstream group API.

All three retain a 24px minimum row hit height, the full label as the same single action subject, wrapping text, and stronger keyboard/forced-colors focus. The 24px hit floor is an explicit accessibility adaptation; it is not a claim about the upstream box size. Liquid's independently designed material row is unchanged and still needs its own justified visual/material evidence.

## Ownership and rendering

The existing Base Item/All is still the only action, focus and checked-state owner. Existing borrowed checked/mixed facts choose the glyph and the passive box's style-only Template expression. `C-TEMPLATE-0002/0003` permits these structural style-bearing nodes; they introduce no Props, event, Expose, role or tabindex. The slot remains unique. The SVG stays aria-hidden and preserves the checked and mixed paths; checked color no longer belongs to the entire action Root.

This is a presentation-target correction, not a parser workaround or a card-variant API. It does not add an `asCheckboxRoot`/`asButton`, new Context, duplicated State, raw DOM selector, or Component-name Compiler/CLI exception. The previous deferred render refresh and unmount cancellation remain unchanged.

## Evidence and open gates

Three actual WebComponent regression cases fail on the prior whole-row styling and pass on the corrected templates. Each exercises Item and All, checked/unchecked/mixed, controlled rejection/acceptance, one click proposal, one keyboard-Space proposal, disabled suppression, preserved label text and passive glyph/box boundaries. Focus remains owned by the Base subject.

The four-file run reports 22 passed / 8 failed. All eight failures are the preserved Form/CheckboxGroup generated conditional-selector assertions; they are neither deleted nor relaxed. In particular, the new passive template paint is not proof of that old conditional-selector assertion or of end-to-end generated CSS. The normal public consumer type fixture passes; the real 16-package public dependency-closure build and Bootstrap draft build pass. No stale build result is substituted for the changed sources.

No new commit-bound screenshot was available here. Required captures remain those in `2026-10-10-finf-form-upstream-paint.md`, with special attention to the same ordinary-row versus card reference, light/dark box contrast, 320px/200% wrapping and min-hit geometry. Source tokens and happy-dom rendering do not establish pixel fidelity. Family CSS evidence, invalid-state protocol, complete definitions/host/native/packed gates and independent visual review remain open. No Full delivery item is checked.
