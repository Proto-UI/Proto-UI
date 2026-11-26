# Sprint 3 Radio Group audit primary recovery

## Retained native failure

The Brutalist binary evidence from candidate `830287f95959a4a1a4fb797df68b0bd6889e0bae`, GitHub job `137195197345`, remains unchanged. Its archive is 86,730,100 bytes with SHA-256 `d6ff9dbcefe1c00eaec9b3fcefe6f5bcae213b0b3bf38694887a8193150ab60c`. The archived `candidate/runner.source` is byte-identical to that candidate's `apps/www/scripts/audit-brutalist-contrast.mts`, SHA-256 `a81872ed92c964a52c147f34f396819672823f246f10762e1a626f6c34e79baa`.

The complete binary shard recorded 320 raw frame attempts, 312 matched PNG/fact frames, 32 observed runtime/theme cases and eight unresolved cases. Matched capture is not contrast or visual acceptance. All eight Radio Group cases failed at `capture:rest` with `Interactive anatomy has no current primary target.` The journal's `frame-000312-result.json` through `frame-000319-result.json` retain a successful current projection identity, a present Root and no invalid or misplaced Roots. Each frame still has `image: null` and `facts: null`: failure preceded the screenshot and fact collector.

The runner's `primary()` had no Radio Group branch. It returned `null` without querying a Radio Item, and `anatomyObservation()` then threw. These failures identify an observer prerequisite defect; they do not establish a Radio protocol defect or a successful Radio consumer.

## Bounded repair and selected subject

The selected subject is the original `Density preference` group's `density-comfortable` Item. The real recipe sets Root `defaultValue: 'comfortable'`; this Item is checked and is the selected roving Tab entry. The first Item is unselected, Compact is disabled, and the second group intentionally has no initial selection. None is an interchangeable primary.

The selector now requires the exact Root and Item prototype/ref identities, `role="radio"`, `aria-checked="true"` and `tabindex="0"`. It remains strict: no `first()` fallback. The existing whole-recipe anatomy, current owner, generation and selected Previewer boundaries still determine acceptance.

The original audit journey remains **rest → hover → keyboard-focus**. Its focus path seeds focus, issues native Tab and Shift+Tab, and requires focus plus focus-visible on this selected Item. This repair adds no pointer activation, arrow selection, Space, disabled-control or empty-group acceptance claims. No Radio protocol, Adapter, recipe or public host declaration changes.

## Discriminating regression evidence

The eight new observer checks use the actual documentation producer, actual recipe, all four installed Web runtimes and the serialized production probe. Geometry/style inputs are controlled, so their scope is observer identity and topology, not native paint.

- Against the unchanged original runner, all eight checks fail: four identify the missing primary branch and four reproduce the original anatomy error.
- Against the repaired runner, all eight checks pass. The negative controls retain rejection for missing/ref-altered, wrong-part, wrong-role, unselected, non-entry, duplicate, foreign-owner and stale-generation targets. The positive controls identify the selected Item rather than the first Radio and preserve current owner/generation attribution.
- Two earlier combined attempts ended with an unexpected Vitest worker exit, leaving respectively four and two completed checks. They are incomplete results, even though Vitest's JSON `success` field was true. An isolated Vue run passed both selected checks. The final unchanged eight-check run completed with a 512 MiB Node heap and exit-signal logging; the top-level process exited zero and all eight were terminal. The previous termination cause is not established and is not relabelled as OOM or a product failure.

The focused command is:

```sh
NODE_OPTIONS=--max-old-space-size=512 corepack pnpm@10.32.1 exec vitest run \
  apps/www/test/contrast-projection-identity.test.ts -t 'radio-group primary/' \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

The verified repaired runner SHA-256 is `8849bdf16a0996b67b07f26ae7d6846c61bfdda75915c87941a80b1f0a4825c7`; the test source SHA-256 is `9f7d1d145b1305d8c8ce101a3f7dde6d3cc2b9d9e8a3f402664be7209019c439`. The old-branch, incomplete, isolated and completed receipts remain separate in the implementation handoff.

## Outstanding native acceptance

Run the repaired audit against a separately supervised source-bound server with `PROTO_UI_CONTRAST_FAMILIES=radio-group`. All **four hosts × two themes** still require fresh terminal results on the integrated candidate, retaining every original planned state and any failed or unattempted state. There are 24 planned frames if all three states complete in each case. The old eight failures and the other families' original outcomes remain historical; neither the observer regressions nor a successful screenshot closes their original semantic, contrast, visual or accessibility conditions.
