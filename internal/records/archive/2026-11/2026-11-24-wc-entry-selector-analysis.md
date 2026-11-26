# Reuse lexical Focus Entry selector analysis

This record is diagnostic and implementation evidence, not a lifecycle promotion or a completed Demo Matrix acceptance.

The current user asked to verify and repair release blockers. On clean union `24dfb9f112b11c2f0c6789dfab3aa86b528656ee`, the unchanged native Matrix mount case failed its original 60,000 ms initialization phase. Node 24.22.3, pnpm 10.32.1 and sandboxed Chromium 156.0.8078.79 were used. A separate, explicitly diagnostic CDP pause/profile run found repeated Web Component stylesheet dependency scans during startup. Its first 17,644 ms profile attributed approximately 1,806 ms of sampled self time to `collectEntryStyleDependencies`' rule visitor. Later chunks were dominated by Anatomy work and remain a separate investigation. Debugger pauses and sampling affect timing; these numbers are not a performance acceptance or a proof that selector parsing alone caused the timeout.

## Ownership and bounded change

`A-WEB-COMPONENT-0001` is active; `HC-FOCUS-ENTRY-0001`, `C-AS-FOCUS-ENTRY-0001` and `D-FOCUS-ENTRY-DELEGATION-0001` remain draft. Their existing direction requires the host to resolve the current entry target and project a self fallback only when needed. This change preserves that behavior, live CSSOM/DOM discovery, selector matching, callbacks, invalidation and teardown.

The rule visitor repeatedly classifies the same immutable selector string for native input-state dependencies. The private reuse table has weak CSS rule keys and retains one current selector string and boolean classification per rule. Every graph rebuild still reads the current selector, expands its current nesting parent and compares that string before reuse. A changed selector is classified again. No host target, applicability result, eligibility fact or stylesheet revision is cached.

## Discriminating controls

The new control uses the real Focus capability and its dependency graph. It counts the existing lexical classifier, independently of elapsed time or private table contents. A stable CSS rule required two classifications initially; eight more entry owners plus an observed DOM rebuild increased this to twenty on the unchanged source. The candidate keeps two. All nine entries still select their real button descendants without a projected fallback.

The companion control changes the selector on the same CSS rule identity to add and then remove an external native input-state dependency. The real entry sampling follows both changes. Happy DOM lacks that native CSS rule setter notification, so a disclosed observed class mutation requests a fresh graph; a disclosed trusted-event branch injection checks eligibility sampling, not native input timing.

- Baseline: one intended lexical-work failure and one passing live-selector control.
- Candidate: 149/149 tests passed across the new file and unchanged observer, refresh-coalescing, input-origin and form-origin suites.
- Focused TypeScript with the repository configuration: exit 0.
- Prettier and `git diff --check`: pass.

Raw red/green output, the focused type configuration and validation metadata are preserved under `internal/records/evidence/2026-11-24-wc-entry-selector-analysis/`.

The original full native Matrix remains failed. The next gate is a native comparison on the integrated candidate, preserving both 60-second phases, all registered demos and all four official Web hosts. Public package size and broader release gates must also be measured on the final union.
