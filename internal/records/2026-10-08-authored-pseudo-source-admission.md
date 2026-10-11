# Authored pseudo-element source admission

Date: 2026-10-08 UTC. Base: `1656d41d5bebd593f1082464ae38943228fde0bc`. Scope: [PR #872 review discussion](https://github.com/Proto-UI/Proto-UI/pull/872#discussion_r4217415392).

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Failure and authority

The draft `C-FEEDBACK-MATERIAL-0001-SAFETY` criterion requires affirmative source support before enhancement. `inspectCanvasBackdrop` scanned unrelated elements in the source scope using their border boxes and the registered private carrier footprint. An author `::before` or `::after` can paint outside its originating border box. A non-overlapping origin therefore did not prove the bare application canvas was the visible backdrop.

The source-admission fixture supplies a sibling border box at `(260,30,20,20)` and a generated fixed pseudo at `(40,30,100,40)`, matching the material host. It supplies computed styles and geometry explicitly; Happy DOM does not establish native pseudo layout or pixels. On the original two production files, the final source/sink test selection fails seven assertions while 54 controls pass. Both author pseudos, a hidden originating element with a visible pseudo, a forged carrier marker, and an owned carrier with an additional author `::after` are incorrectly admitted. The two sink failures retain the old self-optical receipt instead of withdrawing it.

## Bounded repair

Before unrelated-element border-box admission, reject a generated, visible, nonzero-opacity author `::before` or `::after` with `source-authored-pseudo-unavailable`. Native pseudo-elements provide no ordinary element DOMRect; the repair does not guess their paint extent. This intentionally rejects even a distant generated author pseudo when its paint cannot be bounded. Absent/non-generated, display-none, visibility-hidden/collapsed and zero-opacity pseudos remain eligible. The originating element's `display:none` or zero opacity still suppresses its whole painted group; `visibility:hidden` alone cannot suppress a pseudo that explicitly restores visibility.

Only a `::before` belonging to the private carrier's existing WeakSet is exempt from the author-pseudo test. It still goes through the existing computed carrier footprint overlap check. A copied DOM marker grants no exemption, and an owned carrier never exempts author `::after`. A complete valid private-carrier computed-style fixture passes its existing `valid()` check and retains source admission when disjoint; moving its footprint into the material still rejects overlap. The owned `outline:0`, exact carrier validation, safe sink, and document-adoption code remain unchanged.

## Verification and remaining evidence

- Original baseline with final source/sink tests: 7 failed, 54 passed. The first smaller red run (5 failed, 15 passed) remains historical evidence.
- Repaired material selection: 12 files, 126 tests passed. Source, private carrier, sink, document adoption, geometry, program, image transport, style, contact motion and paint mutations are included.
- Both new sink transitions preserve normal initial enhancement, withdraw into opaque fallback without another optical render after source invalidation, and resume enhancement after the author pseudo disappears.
- All nine existing whole-root package budget checks pass without changing a ceiling: React 105839/106000 (161 bytes remaining), Vue 105689/106000 (311), Web Component 131463/132000 (537). These root measurements do not independently measure the opt-in optical source subpath. Environment: Node 24.19.0, esbuild 0.25.12, zlib 1.3.2.1-motley-3246f1b, Linux x64, gzip level 9. Final integrated changes and canonical CI still require their own checks.
- Narrow TypeScript check for both production modules and their local imports passes with Node 24.19.0, TypeScript from the existing locked installation, DOM/DOM.Iterable libraries and bundler module resolution. Formatting and whitespace checks pass.

These are source, Happy DOM and spied-GPU results. Invalidation is explicitly delivered in the new sink cases; native CSS mutation timing, compositing, images and browser GPU output remain unverified. Existing local browser socket restrictions were respected and no alternate browser route was attempted. Full workspace/docs checks, any later combined package measurement, exact-head official browser evidence and independent review remain the integrator's separate gates. No budget threshold, spec lifecycle, remote branch or PR comment is changed by this local increment.
