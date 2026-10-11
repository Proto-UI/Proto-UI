# Form-family source comparison and bounded paint repair

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

Baseline: `c2cbb8d6fce71e949f84f0358189184783505989`. This is a successor source change, outside the frozen fifth snapshot. Source comparison is not pixel acceptance. The Field/Label definitions remain draft, and Fieldset/Form/CheckboxGroup definition and complete delivery gates remain open.

## Sources and licenses

- Shadcn official `base-nova` registry, fetched 2026-10-10: [Field](https://ui.shadcn.com/docs/components/base/field), [Label](https://ui.shadcn.com/docs/components/base/label), [Input](https://ui.shadcn.com/docs/components/base/input). These are content-hashed snapshots, not an invented Git revision. Field TSX SHA256 `d8a8444942021d020de9b5358a0a3d4f3a5ea572ceabaa38c318a9916903a5f8`; Label `b3b7b21d2877838fc73713df48a47248392de04a3b3fafa8961369f33ab14530`; Input `dab990dfefa0ba78854ab6602ad074270dba9d7d1262184d9bfbb62bd990903b`.
- Neo fixed [3306a802724874a85f93079702b2795370a279d4](https://github.com/ekmas/neobrutalism-components/tree/3306a802724874a85f93079702b2795370a279d4/src/components/ui): Field TSX `633b39696aac48faeda3e102fa29001295858757ab2c3d7bdb12f13ace03e001`; Label `61e96f4e2c9ee52ceb8c82427fd1414b3b0a4d574db2c60ff332a36844ba500e`; Input `cc801c472d4680dcce91b707aae161c903c97612dd61ef7eaca2cb1d19b5a59f`. Its global theme declares 5px radius, DM Sans, base weight 500 and heading weight 700.
- Bootstrap [v2.3.2 forms.less](https://github.com/twbs/bootstrap/blob/v2.3.2/less/forms.less), SHA256 `023f8f10a7c940ddd15ccc2cb8df0fae1f1f7bd9f6988001b64296062e9b2959`, and [actual form examples](https://getbootstrap.com/2.3.2/base-css.html#forms). The reference font size/line height are 14px/20px. Legend is 1.5 times the font size and twice the line height.
- The existing Shadcn/Neo MIT and Bootstrap Apache-2.0 package notices remain intact. All upstream files were read statically; no third-party source was installed or executed. No RHF, native DOM form implementation or second interaction owner was copied into Base.

The official Field/example pages were read during this comparison. No new official-page or changed-Proto screenshot was obtained in this worktree; visual equivalence is not claimed.

## Concrete family differences addressed

- Shadcn Fieldset: remove the unsupported card border/radius/padding, use the upstream default column gap 4. Legend uses medium weight and 1.5 spacing below. Description keeps normal-weight muted text and wrapping. The optional upstream legend label-size variant and checkbox/radio conditional group gaps are not public Proto features in this slice.
- Neo Fieldset: remove card framing and uppercase legend. Use the upstream gap, heading weight and foreground/base-weight description. Fonts are carried by the family rather than inferred from the page.
- Bootstrap Fieldset: zero margin/padding/border, block grouping. Legend uses scalable 21px/40px equivalents, 20px bottom margin and only the #e5e5e5 bottom border. Description uses the family 14px/20px help-text scale. This is portable grouping, not a claim of HTML first-Legend disabled exemption.
- Standalone Labels: Shadcn receives its flex/center/gap content layout; Neo receives heading weight 700 and family font; Bootstrap receives block layout, 5px bottom spacing and explicit 20px line height. Base naming/activation/default selection remain unchanged. Standalone Labels are distinct from FieldLabel, so this does not double the Field container gap.
- Neo FieldControl: 40px height, 5px radius, secondary background, 14px/500 DM Sans text, no elevated Button shadow. Error becomes plain 500-weight red-family text without a black left border. Existing theme `destructive-ink` deliberately replaces the upstream low-contrast red-500 text; its light/dark contrast policy is already documented in the family theme. Stronger forced-colors focus remains.
- Shadcn FieldControl: 32px height, rounded-lg, 10px horizontal inset, transparent base fill, no small shadow. Existing focus facts select a 3px 50% ring; disabled and color-scheme facts select the corresponding input fill. Authored invalid recipes use the base-nova border/ring opacity, subject to the inherited-handle gap below.
- Shadcn and Neo Field Root consume their existing direct invalid handles for inherited error ink. Their Labels do not create a validation owner; the editor keeps its own normal text ink.

## Explicit gaps, failures and evidence

`C-FEEDBACK-STYLE-0004` prohibits authored `md:text-sm` selector syntax. An initial candidate correctly failed synchronously on this invalid token. The candidate now retains the upstream 16px base text; the desktop 14px responsive step needs a governed viewport fact. No private media branch or Compiler rule was introduced.

The new real-WebComponent test initially failed all six source-difference assertions against the old styles. The final first slice passes five cases and retains one real failure: the nested Field binding owns invalid/pending, while the outer `asFieldTextControl` type falsely suggests flattened handles. Consequently the real editor receives `aria-invalid=true` but its incorrectly addressed invalid paint does not apply. This failure is kept in `form-upstream-paint.test.ts`, not rewritten as a bare token or skipped test. Correct public nested-handle consumption is a separate follow-through.

The eight independent-review regression files still report 67 passed / 8 failed. The same four Form and four CheckboxGroup generated conditional-selector assertions remain red. Source recipes and runtime token attributes do not establish generated consumer CSS coverage.

Actual CSS lowering also reports two new, valid Bootstrap source tokens as unsupported: `text-[1.3125rem]` and `border-[#e5e5e5]`. This is reported to the owning translator workstream. The prototype does not silently substitute the wrong metric/color or add a component-name whitelist.

The existing Form public consumer type fixture passes. The public package build is attempted using the repository builder and its real dependency closure. Initial concurrent builders collided on shared output; serial execution first exposed stale cross-worktree dependency links. Only private worktree links were repaired, reusing the same installed dependencies without downloads. The final serial public build passes for 16 dependency-closure packages, including Base, Shadcn and Neo. Bootstrap is private/draft and is not covered by that public build; its separate build:draft result is reported with the delivery SHA. No failed attempt is reclassified as a pass.

## Required new screenshots

Use existing public `apps/www/src/content/docs/demo-<family>-field.demo.ts`, `demo-<family>-fieldset.demo.ts`, `demo-<family>-form.demo.ts` and `demo-<family>-checkbox-group.demo.ts` entries as the initial composition. State fixtures must use real exported atoms and public Props/Exposes, not page-local replicas.

For each of Shadcn, Neo, Bootstrap and Liquid, bind the artifact manifest to the new integrated commit/tree and capture:

1. Default Fieldset with visible Legend/Description, one labeled editable Field and one unchecked item. Record the actual font, viewport, scale and light/dark theme.
2. Keyboard Tab focus on the real editor and CheckboxGroup item; visible focus must survive high contrast and no mouse activation may be substituted for keyboard evidence.
3. Disabled Root and locally disabled control/item; restore the parent and verify the local disabled choice survives.
4. Field invalid with visible error and the real editor's invalid relationship. Record the currently blocked FieldControl paint as a failure until the public nested handle is fixed.
5. Checkbox unchecked/checked/mixed with the same text and layout; controlled proposal remains visually unchanged until the owner accepts it. Reset before/after belongs to the same source revision.
6. Long translated labels, a 320px container and 200% text scale; check inner control/glyph spacing and wrapping separately from outer safe-area padding.

Compare each with the same official reference state. Shadcn Form is an official composition reference, not an empty registry's nonexistent form.tsx. Neo Field/Checkbox use the fixed revision; Bootstrap custom checkbox is a disclosed adaptation, not a pixel copy of native controls. Liquid has no matching public Apple component source: separately capture opaque fallback, source loss, increased contrast/reduced transparency/motion and genuine native output. No old 5d96 screenshot or Web screenshot can stand in for this changed-source or native evidence.

No Full delivery checkbox is warranted by this slice.
