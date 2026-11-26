# WC Focus Entry: bound unrelated native input sampling

This non-normative continuation of Sprint 5 starts from `1709cd31b1d44775cd9e441e8f217e37a40a526c`. It addresses an independently reproduced WC observer cost exposed while investigating the canonical browser Compiler's original 250 ms preview-retirement failure. It does not establish that this observer was the sole cause of that browser failure or replace its original acceptance journey.

The applicable direction remains draft `HC-FOCUS-ENTRY-0001-A/B`, `C-AS-FOCUS-ENTRY-0001-D/G` and `D-FOCUS-ENTRY-DELEGATION-0001`: project self fallback from the actual current descendant eligibility without inventing target facts. No contract lifecycle, public entry policy, focus request, Compiler target or preview deadline changes.

## Reproduction and bounded change

With eight ordinary entry regions and a separate textarea, one modeled trusted `input` caused two computed-style reads of **each** entry root. A `change` caused three per root. The first two came through the common ancestors in each entry's projection listeners; the extra `change` path came from registering both `resize` and `change` on Window as well as on media-query objects. A form change bubbles through Window and is not a media change.

The existing live-origin relation check now also applies to native `input` and `change` when the stylesheet graph proves no input-state dependency. It retains the entry's current tree, composed ancestors, slotted regions and active logical Portal chain, including newly projected nested Portals before the observation graph refreshes. Existing external radio/image dependencies remain conservative. Synthetic events retain their prior explicit notification behavior, and missing or unfamiliar origin facts do not establish unrelatedness.

Stylesheet traversal conservatively records value-sensitive or unknown pseudo states. It scans inside functional selectors, preserves external sibling and `:has` conditions, aggregate form validity and form-associated controls outside the form subtree, escaped/unknown pseudo syntax, unresolved nesting and opaque/imported stylesheets. Attribute/tree, focus/modality and URL predicates continue to use their existing invalidators. Unknown state is not interpreted as a proof of independence. Stylesheet invalidation rebuilds this dependency alongside the existing media, relational and positional dependencies.

Window retains its resize listener; media-query objects retain their change listeners. The separate radio change/reset and form-reset observers are unchanged. The 250 ms preview retirement, iframe token/revision/source checks, real disposal acknowledgement and compiler-panel source-input guard are unchanged.

## Executed evidence

The [manifest](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-focus-entry-input-origin/manifest.json) binds the source preimage, candidate, exact final controls, commands and raw results. Its archive includes the failing attempts and diagnosis, not only the final passes.

| Evidence | Result and boundary |
| --- | --- |
| Exact final 16 controls against the unchanged baseline module | 12 passed, 4 failed, zero skipped; unrelated input/change, static-style locality and empty dependency graph are the four red controls |
| Candidate input-origin controls | 16/16 passed; unrelated native input/change produce zero entry-root style reads |
| Existing motion-origin controls | 8/8 passed |
| Existing live observer controls | 55/55 passed |
| Existing refresh-coalescing controls | 15/15 passed |
| Complete four-file selection | 94/94 passed, zero failed/skipped |
| Strict TypeScript dependency closure for the changed module and new controls | TypeScript 5.9.3, 639 source files, zero diagnostics |

All source tests used Node 24.22.3, pnpm 10.32.1, the frozen new worktree dependency installation and one Vitest worker. The fixture explicitly marks modeled native events trusted because Happy DOM cannot generate real user input. It documents its controlled computed-visibility, assigned-slot and opaque-stylesheet facts. Those are host-model controls, not physical input or a Chromium timing result.

The first fixture attempts had distinct harness defects, retained in the archive: Happy DOM's `tabIndex` property did not provide the intended reflected attribute; spying on a document stylesheet getter left a recursive accessor; its HTML style sheets use a different constructor from `window.CSSStyleSheet`; and `deleteRule` leaves an undefined array slot. The latter is correctly treated by the product as an opaque graph. The final CSSOM control uses a real constructed stylesheet and `replaceSync` to add and remove its input-state rule through the observed API. It never manually refreshes the entry or changes a test deadline. The initial candidate's 92/93 result remains a failed attempt.

## Remaining acceptance

The exact integrated candidate still requires the original canonical production browser journey, including the real module Worker, bilingual pages, four generated targets, edit/reject/recover, cancel/reopen, source/asset identities and disposal within the unchanged 250 ms requirement. The source controls do not establish those outcomes, React/Vue observer parity, a whole-site cost budget or assistive-technology acceptance. The existing failed browser receipts remain failures until their own successful, source-bound successors are obtained.
