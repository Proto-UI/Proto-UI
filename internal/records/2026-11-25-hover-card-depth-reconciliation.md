# Preserve the existing Brutalist Hover Card depth exception

## Decision and original evidence

This is a bounded reconciliation of an existing component criterion, not a new design decision or lifecycle promotion. The Hover Card Content's current `P-BRUTALIST-HOVER-CARD-CONTENT-VISUAL-GRAMMAR` explicitly requires no hard shadow. In the [maintainer's original #398 ruling](https://github.com/Proto-UI/Proto-UI/issues/398#issuecomment-5378973550), typed depth grammar was approved with component P entities remaining authoritative for exact criteria and finite, justified exceptions retaining executable coverage.

The admitted grammar commit `ec81ad9912f3498700e2e9a5b157ba034e48f87c` included Hover Card in its generic 3px category, but explicitly promised to preserve every existing P-governed behavior. At that same immutable commit, the Hover Card P criterion and implementation both remained flat. The omission of a typed exception/backlink did not supersede that criterion. The later [#1818](https://github.com/Proto-UI/Proto-UI/pull/1818) commit `c049606db4a93fa15e7e9a97708d2ea6364a0557` added the 3px shadow without changing the relevant P, D or Hover Card tests; its recorded discussion contains no authorization to replace the component criterion.

The evidence directory preserves the original maintainer text, #1818 discussion, immutable source/spec snapshots, hashes and the before-source diff. Current source's 3px value was treated as the regression to investigate, not as authority to select a new appearance.

## Reconciliation

The Content removes only the later hard-shadow token and retains its `z-50`, `text-start`, square border, focus treatment and governed 200ms lifecycle. The D catalog/exceptions/typed P projection now explicitly retain the inherited Hover Card exception, and the P has the missing typed decision backlink. The test entity and both language versions of the public design contract and Hover Card introduction agree with that existing criterion. Lifecycle status is unchanged.

The prototype regression checks the absence of every shadow utility while retaining the existing 199ms, entered and leave assertions. Against the original shadow source this test fails on the exact `shadow-[3px_3px_0_0_var(--pui-foreground)]` token; with the bounded repair, Hover Card and depth grammar suites pass **17/17**.

## Native evidence and consumer binding

The original native Hover Card test first reproduced the incorrect 3px paint. After the source repair, its global text locator matched the same authored prose in the React source-code panel, whose owner was `wc-site-code-scroll-viewport`. That separate stale observation was repaired by binding the actual portalled Content to the live Trigger's exact owner, runtime and generation. No paint or timing expectation changed.

The original pointer/focus test now passes **1/1**, executing all four Web runtimes in light and dark themes. It retains square trigger/panel surfaces, no hard panel shadow, native pointer and focus opening/closing, theme colors, visible geometry, outline treatment and 200ms transition/animation checks. The independently targeted Toggle case also passes after rebinding its current theme tokens. Failed before-source and before-owner runs remain failures in the receipt ledger.

Verification also passed the lifecycle authoring checker (four changed catalog inputs, including a parallel reviewed change), prototype catalog checker, public-doc checker (332 bilingual routes and 449 maintained documents), and workspace dataset generation (1337 entities). The local `tsx` command wrapper hit an IPC permission error; the same authoring/generation scripts passed through `node --import tsx`, with the original failure retained in the control logs. Browser observations used sandboxed Chromium on the isolated dirty `5f0844907895a4ae0db506fe6a5d0bf162318329` candidate; they do not substitute for the final integrated clean-head Actions gate.

Evidence: `evidence/2026-11-25-hover-card-depth-reconciliation/`.
