# Sprint 3 Dropdown pointer subjects and public destructive recipe

## Retained source 830 result

The original Brutalist popup archive belongs to candidate `830287f95959a4a1a4fb797df68b0bd6889e0bae`: 71,349,390 bytes, SHA-256 `d9016292b94476fdb9fa1cf064c63a5749e430009bcafc3dad82f3e4ad4eded3`. It contains 256 raw frame attempts and matched PNG/fact frames, 24 observed runtime/theme cases and eight unresolved Dropdown cases. Matched capture is not contrast or visual acceptance.

Every Dropdown case failed in the old `item-pointer-close:default` phase at the exact-name locator `getByRole('menuitem', {name: 'Profile', exact: true})`. That phase included closing, reopening and locating the next target; its name does not prove that a retired menu caused the timeout. The preceding real frames already contain the visible Item text `Profile⇧⌘P` and its visible Shortcut. Base Item uses accessible naming from content; `textValue: 'Profile'` is collection/typeahead metadata. The original archive did not capture that Item's native AX name. The new observer requires an independent Chromium AX read instead of inferring a name from either `textValue` or raw text.

The original shared public recipe had nine Items and no Delete or destructive Item. Its final Item was Log out with the default variant and a visible Shortcut. The captured last-focus frame confirms that Item, including its main accent paint. Therefore fixing the Profile locator alone cannot satisfy the four retained pointer targets.

## Real shared recipe and strict observer

Both English and Chinese pages still use `demo-brutalist-dropdown-menu`; the actual producer continues to resolve it for WC, React, Vue and Vue 2. The shared recipe now gives Profile the author ref `profileAction` and adds a final real Item with ref `deleteAction`, value `delete`, text `Delete` and `variant: 'destructive'`. Log out remains unchanged. Delete has no Shortcut; that absence is recorded explicitly. Both pages describe the added variant. No Core, Adapter, Shortcut semantics or global keyboard binding changes.

The observer resolves each target within the exact trigger-controlled popup using its current owner/generation, Item prototype, role and authored ref. It separately checks the current physical Item, unique ref, direct label, Shortcut count/text/ownership/visibility, trigger relationship and current subject lease. Authored value is identified as source metadata, not a DOM value inferred by the observer.

For each row, the runner reads `Accessibility.getPartialAXTree` from the unique actual Chromium object and checks its `backendDOMNodeId`, role, ignored state and name. Profile's accepted name includes its visible Shortcut; Delete's name is Delete. The exact physical Item is retained and checked again after the AX request, preventing a retired target from being substituted during observation. AX object groups and CDP sessions are released even when a read fails. These are browser AX facts, not physical assistive-technology acceptance.

The original native pointer baseline, End/Home handoff to the other authored row, target hover, held mouse button, same physical target, selection checks and theme pair assertions remain intact. All 12 planned Dropdown states remain, including **item-default-hover, item-default-pointer-held, item-destructive-hover and item-destructive-pointer-held**. Open, subject resolution, native name and baseline stages now have distinct diagnostic phases. The baseline record is retained before a new observation can fail.

## Regression scope and required native result

The focused suite completed with **14/14 checks passing and process exit zero**: eight actual-producer observer checks across the four hosts, and six explicitly simulated CDP transport contract checks. Actual-producer negative controls reject missing/ref-altered, wrong-part, wrong-role, duplicate, foreign-owner and stale-generation Items, incorrect labels, hidden/foreign Shortcuts and a different trigger-controlled popup. The CDP controls reject a textValue-only name, wrong role, ignored node, a different backend node and ambiguous AX results. They do not claim that Chromium has run.

An earlier local development run passed the six transport checks and failed eight producer checks. It exposed a non-serializable named callback in the new observer and a missing conditional-subtree readiness precondition in the DOM test bridge. Those failures remain separate. The callback is now serializable, and the bridge waits for actual materialization before executing the one-shot owner/identity negatives; native assertions and timing thresholds were not changed.

```sh
NODE_OPTIONS=--max-old-space-size=512 corepack pnpm@10.32.1 exec vitest run \
  apps/www/test/contrast-projection-identity.test.ts \
  -t 'dropdown pointer identity/|dropdown AX transport contract:' \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Fresh native acceptance is still required for **four hosts × two themes** using `PROTO_UI_CONTRAST_FAMILIES=dropdown-menu` against the integrated source-bound server. If all retained targets complete, there will be 96 Dropdown frames. Preserve every failed or unattempted target and the original eight failures. Neither the new recipe, the DOM checks nor the transport controls close the original visual, input, accessibility or full website journey conditions.
