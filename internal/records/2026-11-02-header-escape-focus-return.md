# Header Escape: retained but CSS-closed nested presentation

## Public observation, not deployment attribution

On 2026-11-02 a fresh ordinary cloud Chromium tab opened `https://www.proto-ui.com/en/start-here/what-you-saw/`. Native window resizing produced 500 by 761 CSS pixels at DPR 1, not mobile emulation. At 05:04:57.812 UTC the Navigation and settings button was expanded and the Docs link held focus. Native Escape at 05:05:04.327 left the button expanded and Docs focused. The public deployment SHA is unknown; this is not proof of current-main behavior or attribution to any merged PR.

Read-only DOM observation at 05:05:26.143 found a Search input under the Header with aria-expanded=true and aria-controls=pui-command-1-content. That role=listbox popup had no hidden/inert ancestor but lived below a display:none presentation; trigger and popup boxes were zero. The current source's captureEscapeOwner checks IDREF/expanded/listbox and hidden/inert only, so CSS-closed retained presentation is a testable explanation, not yet a source-executed root-cause verdict.

Native negative controls remained distinct: Page contents closed and returned focus to its own button at 05:06:24.443. A genuine Runtime Select opened at 05:06:50.097; its first Escape closed only the Select and returned to its trigger at 05:06:56.554, correctly retaining the Header. A second Escape at 05:07:02.753 still failed to close the Header. The public page was restored to Header closed; no runtime or theme selection was changed.

## Candidate boundary

The candidate only changes which expanded nested IDREF can reserve a Header Escape sample. Both trigger and popup must be connected and not hidden/inert, neither may have a display:none light-DOM presentation ancestor. This is a presentation ownership check, not a Search/Command/Select tag-name exception. Current Header ownership discovery uses light DOM; cross-shadow visibility and other CSS concealment policies are outside this bounded fix. It does not require a nonzero bounding box, preserving pending entry and DOM-only test hosts. The existing capture-before-nested-close sample, defaultPrevented check, owned popup/dialog check, and close(true) return-focus path remain intact.

Additive unit fixtures model CSS-closed popup ancestry, CSS-closed trigger ancestry and a CSS-closed popup with retained expanded state, without component-specific names or runtime internals. A positive available nested popup with a zero layout box retains the first Escape and permits the second Header Escape after closing. Existing delayed-entry and unrelated-portaled-listbox negatives remain.

## Evidence state

The candidate is statically prepared against `d850c28a40bfbc31f10d244b075d6f27038f46fa`, but all new source tests, types, spec and format checks are **UNRUN**. No local browser build or production deployment was performed. The existing public browser failure remains evidence, not a candidate screenshot. New fixed-source permission, failing-before/candidate/rollback results, real candidate-bound browser keyboard/focus/AX evidence, independent review and exact-head CI are pending. This limited fix cannot close the entire #856 program.

## Fixed-source execution addendum — 2026-11-02 05:28–05:35 UTC

The preceding UNRUN/pending-source-execution statements preserve the preparation snapshot; this addendum records the later authorized execution without erasing that history. The executed complete candidate tree was `971100155b0fc67b05e85f136c6399b51b8de921`, against main `d850c28a40bfbc31f10d244b075d6f27038f46fa`. Patch SHA256: `e4c288fb64b1665fc7e185f1e45a7b25aa5d8a7b9d750e7f400b4ddcd974df7b`. The publication revision only adds these evidence annotations; all six changed product/test TypeScript blobs remain byte-identical to the executed tree. A documentation head is not relabeled as the tested tree.

- Original d850: 101 collected, 100 passed, 1 failed, 0 skipped/pending.
- New tests with both original products: 123 collected, 117 passed, 6 failed, 0 skipped/pending.
- Both candidate repairs: 123 collected, 122 passed, 1 failed, 0 skipped/pending.
- Candidate with only original Root restored: 26 collected, 24 passed, 2 failed, 0 skipped/pending.
- Candidate with only original Header restored: 37 collected, 34 passed, 3 failed, 0 skipped/pending.

The original and candidate both fail the unchanged `site-header-select-lifecycle.test.ts:99` case, `restores desktop ghost after a complete compact-to-desktop reparent`: compact appearance still contains `border-transparent`. This failure is retained, not attributed to either repair, and prevents calling the aggregate green. Baseline and candidate each pass the same scoped TypeScript, full spec workspace schema/graph/active-mapping plus changed-entity authoring check (zero issues), and read-only pinned Prettier check. These are not full-repository or CI results.

All 12 authorized phases completed with unchanged source/config/dependency postchecks and no unsafe outputs. The fixed 105-package closure was reused without install, network, credentials or deployment. Raw collection identities, logs, result JSON and receipts are retained in the local execution archive; summary inventory SHA256 is `95e2240624c95ce53a72710fa54eaa4ef4c4ba92c28672a8f60f85b2c9112439`. Duplicate temporary tracked source/config files were reclaimed only after immediate no-follow regular-file/single-link/hash/mode/device/inode verification; per-run ledgers and all unknown/generated files, links, directories, results and external evidence remain.

### Header-specific result and remaining boundary

The disclosure suite passes 37/37. Its three new retained `display:none` popup-ancestor/trigger-ancestor/popup-itself cases fail against the original Header, pass with the repair, and all fail again when only Header is reverted. The available zero-box nested popup and existing nested first-Escape, Page contents, generation and lifecycle checks remain distinct. This source result supports the CSS-closed ownership explanation; it still does not identify the unknown public deployment revision.

Independent static review found no definite new product defect. Native keyboard/pointer and focus/AX/paint evidence on the final head is still pending, including the real public Header/Search composition; the earlier public screenshots must not be presented as candidate screenshots. The existing Header evidence workflow does not automatically trigger from `site-header-disclosure.ts`, and its broad development-server harness is outside the approved fixed source-test closure. Exact-head CI and the unchanged ghost-failure disposition remain pending. This remains a Draft-stage narrow repair, not closure of #856.

### Executed Header product/test blob binding (SHA256)

- `apps/www/src/components/site-header-disclosure.test.ts`: `85e3cfed774835b06d894ff0f450154d0c9e41b0dde2f87146a5fb6bbd4b987e`
- `apps/www/src/components/site-header-disclosure.ts`: `8bac00183922de04d25f8b3699adf4848c44226522fe66b4891611d4e8bf3801`

### Rhea style authority for the revised compact-to-desktop reparent case — 2026-11-04

The paragraph above records the compact-to-desktop reparent case as a retained red. That disposition described the tree before the expectation revision in `b27742508` ("test(www): align Header Select lifecycle fixture"), which is an ancestor of the current tree and renamed the case to `preserves the public Rhea default through a complete compact-to-desktop reparent`. The revised expectation is reconciled against authority outside the implementation, because the base expectation was itself red for the reason recorded above.

`packages/prototypes/shadcn/src/select/recipes.ts` gives the Rhea Select trigger `gap-1.5 rounded-[var(--pui-radius-2xl)] border border-transparent bg-input/50 px-3 py-2 text-sm transition-[color,box-shadow] duration-200`. `packages/prototypes/shadcn/src/select/trigger-visual.ts` defines the `appearance` variants (`default`/`ghost`) only under `w.state(style).eq('new-york-v4')`, so those variants never reach the Rhea profile. `apps/www/src/components/site-shadcn-controls.ts` pins `styleProfile: 'rhea'` on the Select root and `appearance: 'default'` on the trigger for every Select inside `[data-site-header]`, in the compact panel and in the desktop row alike, because the condition is `root.closest('[data-site-header]')` and not a placement.

The public Rhea style is therefore placement-invariant, and the base expectation "the compact placement drops `border-transparent`" contradicted the Rhea body that the same Header wiring selects. Verified on this tree: with the pre-revision expectation restored, the case fails with `expected 'flex w-fit items-center justify-betwe…' not to contain 'border-transparent'`; with the revised expectation it passes, and `apps/www/src/components/site-header-select-lifecycle.test.ts` passes 9/9.

This reconciliation changes no product byte: the Rhea recipe, the Header's own `styleProfile`/`appearance` wiring and the disclosure reparent are untouched. It records why the retained red case was a stale oracle rather than a product defect.
