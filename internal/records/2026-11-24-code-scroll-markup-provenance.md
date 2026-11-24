# Code-scroll focus handover in the markup observation

This is a bounded author repair for Issue 834's Website observation, based on product union `24dfb9f112b11c2f0c6789dfab3aa86b528656ee`. It does not admit a Website coverage row, promote a lifecycle, or certify served source.

## Observed failure and owner

The release validation runner executed the unchanged 17-case Website markup suite in Chromium 156. Its eight generic/projected runtime journeys failed at the native-output comparison; the nine no-JavaScript, real-producer and install-Copy cases passed. The retained first `generic-light-390` sample has only `native output differs from recorded producer output`. Its revision, receiver owner, connected `div`, runtime, original response digest and navigation receipt agree.

The sample's parser-normalized producer digest is `6c2388d8ad544f8b557df84c5198e7776e92a8b5b8c079ed435f7605d5e5f264`; the observed digest is `3b4511db8ffe623d438018810cde351b5c09ac39ad242715318ebe4a5ceaa751`. Removing only the producer root `pre`'s `tabindex="0"` yields that exact observed digest. The original producer repeats this attribute; the existing HTML parser normalization retains one attribute before this comparison. Character-reference and attribute spelling normalization is not original-byte equality.

`code-scroll-area-client.ts` deliberately retains the original highlighted node, moves its receiver below the public Shadcn ScrollArea Viewport, and withdraws the native `pre` tab stop. `CodePanel.astro` leaves the original native surface readable and focusable before enhancement; early reader focus or selection prevents enhancement. The existing `code-scroll-area-client.test.ts` requires the same node and the removed `tabindex`, including after runtime replacement.

This agrees with the current **draft** direction in `P-BASE-SCROLL-AREA-VIEWPORT-SURFACE-OWNER`, `P-BASE-SCROLL-AREA-VIEWPORT-KEYBOARD-FOCUS`, `P-BASE-SCROLL-AREA-VIEWPORT-NAV-PARTICIPATION` and `P-SHADCN-SCROLL-AREA-VIEWPORT-BASE-INHERITANCE`. The observer's earlier exact producer comparison omitted the consumer's later focus handover. Reintroducing a second native tab stop would contradict that direction and the existing consumer behavior.

## Bounded correction

The observer now retains three separate facts: the unchanged recorded producer comparison, the named `code-scroll-viewport-focus-handover`, and the comparison against its exact expected native output. A successful handover leaves `matchesRecordedProducer: false` and sets the separate `matchesExpectedNativeOutput: true`; it is never labelled unchanged producer output.

The transformation requires the existing direct wrapper, enhancement client and code-panel client in the bound source inventory. The native sampler records a ready container, one exact public root and viewport, their direct parent/child relationships to the receiver, the same connected previewer owner, the viewport's `0` or `-1` tabindex, its consumer-supplied region/name, and a resolved public `composed` or `system` projection. Missing, ambiguous, detached, foreign or unresolved ownership stays rejected. A marker alone cannot justify a transform.

Only the identified root `pre`'s original `tabindex="0"` is removed from the parsed expected tree. Every other class, style, attribute, raw-code byte, text node and descendant remains part of the comparison. The original response must still equal the original initial-runtime producer; the highlighter's finite shape restrictions remain unchanged. Both sides are parsed once, preserving character-reference-carried carriage returns instead of losing them through a second parse.

No production source or any of the 33 current direct-source inventory members changes. The browser suite samples the actual focus relationship, keeps the original response and native output, asserts both comparison meanings, and additionally requires the no-JavaScript `pre` to retain `tabindex="0"`. Its 17 cases, runtime selections, copy checks, remount receipt controls and timeouts remain intact.

## Evidence and remaining acceptance

- The original 36 supplied receipt/parser controls pass on the base. The repaired observer passes all 67 controls, with 31 added discriminating focus/markup/source cases. These are supplied receipt tests, not a native execution claim.
- The first candidate double-parsed serialized attributes. Three positive controls rejected that candidate because a preserved carriage return changed; the final implementation compares separately serialized once-parsed trees and the same controls pass. The failed attempt remains retained.
- A focused TypeScript program extending the real Website config type-checks the changed browser suite and its dependencies successfully under Node 24.22.3 / pnpm 10.32.1. The first setup attempt lacked the Website's existing dependency link and used the root-only aliases; its failure is retained separately from the corrected check.
- All 33 current direct-source digests still match. No reference hash or source-admission value is renewed by this patch.
- `git diff --check` passes. Whole-file Prettier checks reject all four touched files on both the exact base and candidate; this patch retains their existing layout rather than adding unrelated formatting changes.

The evidence directory retains the actual first native sample, its independent normalized-difference analysis, the original and repaired controls, and local check receipts. The parent release workstream must execute the complete native 17-case suite on the integrated candidate and inspect the new focus observations. The earlier sample did not record viewport relationship facts and cannot be retrospectively turned into a passing transformed observation. Real viewport keyboard interaction, complete browser compatibility/AT, Astro in-document swaps, transitive/served-source proof and release acceptance remain their separate criteria. No independent approval or external write is claimed here.
