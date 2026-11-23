# Owned Canvas2D transport feasibility

## Question and boundary

Can a separately owned Canvas2D copy preserve the actual checked optical output while avoiding a future PNG/decode transport stage? This experiment first measures copied-pixel readiness and lifetime against the PNG generated from the **same actual production render**. It does not replace the production carrier, publish a new Adapter capability, or establish product input latency.

The source base is `24e553961e7a898b74b959792d35f49364f35efc`, the candidate measured in Actions `45249737653`. `C-FEEDBACK-MATERIAL-0001` and `C-VISUAL-TRANSACTION-0001` remain draft. Their owner, source/geometry, stale-completion, fallback and retirement requirements govern any later promotion. They do not require PNG specifically. Current `contact-v1` is a paint-only `::before` carrier with no content child; this experiment does not alter that boundary.

The current user asked to complete Sprint 6. The parent explicitly authorized this isolated experiment, independent review, unchanged optical quality and work denominators, and real native execution through an identified entry point. It did not authorize changing the production default before acceptance.

## Exact observation point

The native probe imports the actual `createWebOpticalProgram` and `prepareOpticalImage` from the bound checkout. It uses the original CPU/default renderer, shaders, source validation, every-pixel contrast scan, output bounds and PNG encoder.

For one owned WebGL canvas, a scoped observer wraps that instance's real `toDataURL` method. It copies the checked output into a separate owned Canvas2D resource immediately before or immediately after the **actual native encoder call**, alternating the order. It always invokes the original encoder exactly once with unchanged arguments and returns its exact string. It never supplies a placeholder PNG, bypasses encoding, changes shader source, or takes an output before the program's checks. The method is restored in `finally`.

The PNG then goes through actual production `prepareOpticalImage`. Its callback establishes the measured decode-readiness boundary. An independent native Image decode and Canvas2D readback supplies the pixel oracle after timing; that extra oracle decode is recorded separately. This does not infer production paint from a resource counter or from the copied canvas alone.

This explicitly exercises the cold production decode interface. It does not reproduce the runtime's held-image cache policy: static application frames may already hit that cache. Browser-internal reuse may still affect a new `Image.decode` call. Neither this sample nor its wall time is a decoder CPU measurement. The dynamic samples require sixty distinct actual PNG outputs.

Two boundaries are timed for the copy: completion of the owned capture submission, and completion of a full snapshot `getImageData` readback. `ownedCaptureSubmitMs` includes canvas allocation, ownership/geometry guards, the native copy and any old-resource cleanup; it is not a pure `drawImage` timing. The optional raw `nativeDraw` timestamps surround the native port call, including its context setup and checks. The readback boundary is a conservative copied-pixel readiness barrier, not compositor presentation. Reference PNG encoding, decode wall time and publication callback are retained separately. Alternating capture order exposes observer/order effects. The two branches share one render and execute observation work serially; adding their means or subtracting measured stages from the old application's latency cannot establish a product speedup.

## Experimental owner interface

The owner lives only under this experiment and is not imported by packages or public routes.

```ts
type SnapshotIdentity = Readonly<{
  sourceRevision: number;
  geometryRevision: number;
  producerEpoch: number;
  logicalWidth: number;
  logicalHeight: number;
  paintOutset: number;
  dpr: number;
}>;

type SnapshotTicket = Readonly<{
  current(): boolean;
  readPixels(): Uint8ClampedArray | null;
  release(): void;
}>;

// The target binds the Document and owner lifetime. No child is inserted.
createCanvasSnapshotOwner(target, nativeCanvasPort): {
  capture(checkedCanvas, identity, {
    ownerCurrent,
    producerCurrent,
  }): SnapshotTicket | null;
  invalidate(): void;
  dispose(): void;
  inspect(): ResourceCounters;
};
```

`logicalWidth`, `logicalHeight` and `paintOutset` are CSS-pixel geometry. Physical width/height are independently derived as `ceil((logical size + 2 × outset) × dpr)` and must exactly equal the actual producer canvas dimensions. The real port reads `devicePixelRatio` from the owner's actual Document window, and the probe requires equality with the configured browser context and frame geometry. A self-reported DPR field alone is insufficient. The real port creates an alpha-enabled sRGB 2D canvas and copies the complete image at those exact physical dimensions. Each `readPixels` call returns a separate copied byte array; mutating the returned array cannot mutate retained pixels or another ticket. It never exposes the mutable storage canvas. A controlled port is available only to ownership tests.

`producerCurrent` binds the exact checked frame object and a producer epoch that advances **before every render attempt, including failed attempts**. It is checked around all capture host calls; synchronous reentry that renders B cannot cause B pixels to be labeled A, even if source revisions match. `ownerCurrent` separately binds the target's ongoing source/geometry/lifetime and is also checked for ticket reads. After capture completes, later producer reuse by another consumer does not revoke the immutable owned copy: producer freshness gates the copy transaction, while owner freshness gates the retained ticket. These two predicates are never merged.

One owner retains at most one current snapshot plus one synchronous staging snapshot, each within the existing 4 MiB RGBA output bound. Two experimental owners deliberately share one producer canvas. Accounting describes logical owned canvases and estimated RGBA bytes, not total browser/GPU memory. Capturing a new frame advances the owner's operation generation before any host call. Each potentially reentrant host boundary rechecks the operation and both capture predicates. Detach, adoption, invalidation and disposal revoke reads. A retired ticket cannot observe a later successor, and another consumer's render cannot change retained copied pixels.

An in-flight capture on the same owner refuses a recursive capture and invalidates the outer attempt; it cannot allocate an unbounded nested staging chain. Cleanup after commitment may create a successor, which is outside the detached cohort. Identity stores only the seven declared scalar fields, even when a structurally compatible caller carries extra frame or resource fields. Construction rolls back both dimensions after width, height or context failure. Readback validation and copying are followed by a final current-owner check before bytes can escape.

Retirement first detaches the entire selected cohort from logical ownership, then invokes host cleanup. Reentrant successor work is not part of the old cohort. Disposal closes the owner before cleanup. A cleanup exception must not strand the other resource or erase a successor. The independent review must check these invariants before native execution.

## Frozen native observations

The experiment has its own inventory; it does not replace or relabel any original frame-budget trial.

- **72 pixel cases:** three actual context DPR values (1, 1.5, 2), light/dark foreground-source pairs, neutral regular/clear plus regular style-tint, rest/contact, and two capture orders. Each case compares dimensions, raw RGBA, and complete black/white composites with the same-render PNG reference. All original renderer checks remain active. Equality is exact; an observed conversion difference is a failure to investigate, not permission to add a tolerance.
- **120 stage samples at DPR 1:** sixty static and sixty changing-source samples, in six blocks of twenty ordered static/dynamic/dynamic/static/static/dynamic. These use the 143.25 × 38 logical target and 416 × 172 opaque source sizes from the measured fixture. The samples are primitive transport measurements without injected product input. Every planned, attempted, failed, unresolved and unattempted sample is retained with actual stage timestamps and operation counters. They are not the original 120 application presses.
- **20 native lifetime cases:** shared producer A → B → A; actual source supersession; actual geometry change; alternating sizes; wrong-context-DPR refusal followed by correct-DPR recovery; stale owner before copy; invalidation; disposal; detach/reattach; adoption; same-source-revision producer reentry; failed newer render attempt; returned-buffer isolation; actual reference decode cancellation; allocation-time disposal; same-owner capture reentry; original invalid-source refusal; original unsafe-contrast refusal; foreign-document producer refusal; and actual producer WebGL context loss. The three actual browser context DPR values cover separate contexts, not a live physical-display DPI transition. Retained A/B readbacks are archived for the independent reader, as are all nontrivial pixel controls.
- **Negative controls:** changed pixels, changed alpha, wrong source output, wrong physical dimensions/context DPR, an opaque substitute and a retained shared mutable producer must fail the independent comparison or owner boundary. Producer reentry with the same source revision, a failed newer render attempt, and caller mutation of returned bytes must respectively invalidate the capture or preserve the independent retained copy. Missing cases and malformed receipts fail the reader. Original invalid-source/contrast rejection must occur before the copy observer; a failed production render is never admitted as valid copied output.
- **Cleanup:** both experimental owners, staging/current copied canvases, independent oracle canvases/images, production image leases and shared program are retired, then inspected immediately and after two actual rAF callbacks. Every counter and cleanup exception is retained.

The independent pixel comparator does not call the copy implementation or reuse its storage. It compares full native readbacks and source-bound identities. Transparent edges are required in the shape matrix; empty/fully opaque substitutes cannot establish equivalent material.

## Native execution and receipt

The native entry is:

```sh
node --import tsx scripts/analysis/liquid-canvas-transport.mjs OUTPUT --expected-sha EXACT_HEAD
```

`EXACT_HEAD` is a full forty-character commit SHA containing this experiment and the measured source. The checkout must be clean, use Node 24 and the installed locked dependencies, and `OUTPUT` must be outside the source checkout. The entry verifies every browser bundle input against that actual commit, records the dependency closure and original bundle, then checks the source again at the end. There is no dirty-tree bypass or implicit default switch.

To re-read the receipt independently without launching a browser:

```sh
node --import tsx scripts/analysis/liquid-canvas-transport.mjs --analyze OUTPUT/report.json
```

The report keeps the original PNG for each completed render, full raw RGBA and black/white native composite planes for the 72 pixel cases, raw comparison planes for every stage sample, and all failed or unattempted rows. Every artifact has a byte count and SHA-256 digest. The reader checks artifacts, original denominators and ordering, actual encoder work, physical dimensions, alpha coverage, exact byte equality, stage timing order, dynamic output progress, negative-control rejection and immediate/two-rAF retirement. It reports every >10 ms stage observation without turning that threshold into an experiment or product pass condition.

The small ownership and reader controls run without a browser:

```sh
node --import tsx --test --test-concurrency=1 experiments/liquid-canvas-transport/owner.test.mjs experiments/liquid-canvas-transport/protocol.test.mjs
```

It uses the existing browser harness on an owned intercepted origin, with no external image or page fetch. It records the real browser, platform, renderer, DPR and context color attributes, all bundle-input hashes, source start/end snapshots, exact workload inventory and actual console/page errors. It never sets or forges `GITHUB_ACTIONS`, changes browser sandbox settings, or silently substitutes a simulated renderer. Missing browser access remains an unexecuted native result.

The first receipt can accept or reject owned-copy fidelity and show measured stage cost on its actual renderer. It cannot establish a new production default, whole-family compatibility, four-Adapter presentation, hardware 120 Hz, input-to-photon, or the original product's 10 ms target. A later real carrier would still need independent private-paint mutation, slot/content/focus/accessibility, CSS geometry, source completeness, fallback and presentation evidence.

Status: **isolated native probe implemented; native execution and fidelity/performance observations are pending.** The independent design and controlled host-fault reviews do not establish native acceptance. Source archives retain their original red probes and later corrections in the dated evidence record.
