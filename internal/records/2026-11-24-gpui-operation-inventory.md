# GPUI operation inventory after composed Scroll lowering

The inventory is a complete enumeration of the 199 shared operation IDs at the recorded source, with 192 admitted by the GPUI source profile. It is not a claim that all operations have actual native acceptance.

- Exact native-tested runtime tree: `14480b8f35bcadc55893bdebaf0b81d2aefd66cd`; parent `12af03bcdcdfc1f319c77e51950ae1a71abf6d25`.
- Final composed documentation/CI tree: `c01162214a113c813f8b3aadb1b0bdc40e97b300`.
- Producer receipt SHA-256: `bc6f8fa5dd0608bc9af7776ef240747e57ebf5b77c7135579b6e4e5267250ffd`.
- Inventory SHA-256: `0bc4f180648448d806bb2a9506635d3760aee45fd47e5417b05df35fb66af786`.
- The 39 generated modules reach 85 admitted operations; 107 admitted operations have no generated consumer in this batch. Every admitted operation has a named emitter case, which proves neither its semantics nor its native execution.
- All 27 expression kinds and six statement kinds occur in this batch. `math.floor` and `math.round` lack a generated consumer here.

## Concrete native increment

`composed_scroll` is bound to the four actual Linux GPUI tests in `2026-11-23-sprint5-gpui-composed-scroll-native-consumer.md`. They execute native geometry and thumb paint, no-jump Move, live resize, target replacement, unavailable axes, duplicate physical receipt revocation and final-view retirement. The native peer parts use the declared nominal Anatomy identity. These cases add evidence for `scroll.bindComposedChrome`; they do not certify every generated operation merely because its setup body or exposed method is in the same module.

The unchanged official Base Viewport remains rejected at the existing semantic-handle-array admission boundary (`PUI1006`). No prototype was rewritten to conceal that original source gap.

## Admitted operations without a generated consumer in this batch

| Operation family | Exact operation IDs |
| --- | --- |
| accessible | `accessible.id`, `accessible.description`, `accessible.relation`, `accessible.tree`, `accessible.level` |
| anatomy | `anatomy.subscribeParts`, `anatomy.has`, `anatomy.parts`, `anatomy.partsOf`, `anatomy.order.version`, `anatomy.order.parts`, `anatomy.order.partsOf`, `anatomy.order.indexOfSelf`, `anatomy.order.prevOfSelf`, `anatomy.order.nextOfSelf` |
| anatomyPart | `anatomyPart.hasExpose`, `anatomyPart.getExpose`, `anatomyPart.hasHook` |
| binding | `binding.release` |
| boundary | `boundary.configure`, `boundary.observe`, `boundary.setStackActive`, `boundary.registerRegion`, `boundary.unregisterRegion`, `boundary.classify`, `boundary.notify`, `boundary.subscribeOutside` |
| collection | `collection.configure`, `collection.getItems`, `collection.getCount` |
| collectionItem | `collectionItem.configure`, `collectionItem.getSnapshot` |
| context | `context.tryUpdate` |
| eventControl | `eventControl.requestDefaultActionPrevention` |
| feedback | `feedback.style.release`, `feedback.style.patch`, `feedback.style.suppress`, `feedback.style.clearPatch` |
| focus | `focus.blur`, `focus.setNavParticipation`, `focus.setRovingStatus`, `focus.focusLast`, `focus.focusNext`, `focus.focusPrev`, `focus.focusSelected`, `focus.restoreFocus`, `focus.activate`, `focus.deactivate`, `focus.setLoop`, `focus.setOrientation`, `focus.isActive`, `focus.isFocused` |
| focusRoving | `focusRoving.focusFirst`, `focusRoving.focusPrev`, `focusRoving.focusSelected` |
| focusScope | `focusScope.getRoving` |
| hitParticipation | `hitParticipation.configure`, `hitParticipation.registerRegion`, `hitParticipation.unregisterRegion` |
| hook | `hook.asOverlay`, `hook.asTextControl`, `hook.asImageView`, `hook.asTableStructure`, `hook.asBoundary`, `hook.asHitParticipation`, `hook.asCollection`, `hook.asCollectionItem` |
| host | `host.get` |
| imageView | `imageView.on`, `imageView.sync`, `imageView.snapshot` |
| overlay | `overlay.isOpen`, `overlay.openOverlay`, `overlay.close`, `overlay.toggle`, `overlay.configure`, `overlay.updatePosition`, `overlay.registerTrigger`, `overlay.registerAnchor`, `overlay.registerAnchorPart`, `overlay.registerContent`, `overlay.getPositionSnapshot`, `overlay.keepMounted`, `overlay.bindPresence` |
| positioning | `positioning.connect`, `positioning.update`, `positioning.requestUpdate`, `positioning.disconnect`, `positioning.getSnapshot` |
| props | `props.watchAll`, `props.watchRaw`, `props.watchRawAll`, `props.getRaw` |
| render | `render.read.props.get`, `render.read.props.getRaw`, `render.read.props.isProvided`, `render.read.context.read`, `render.read.context.tryRead` |
| rule | `rule.dispose` |
| subscription | `subscription.release` |
| tableStructure | `tableStructure.configure`, `tableStructure.getObjectRef`, `tableStructure.getSnapshot` |
| textControl | `textControl.on`, `textControl.sync`, `textControl.resetValue`, `textControl.snapshot` |

## Profile and representation boundaries

The seven non-admitted shared operations remain `feedback.material.shader`, `feedback.style.presence`, `hook.asFocusEntry`, `focusEntry.configure`, `focusEntry.focus`, `focusEntry.setDisabled`, `accessible.part`. This record does not change admission or declare missing operations N/A.

Known number/boolean locals and proven callables use typed Rust representations. Templates use native snapshots/factories. Identity-preserving `Value` storage still carries ordinary records/arrays, and complete per-field typed lowering remains unestablished. A shared source SDK and generated call-site demand do not alone prove full transitive helper source selection.

The separate three-tree cost fixture records raw source bytes/hashes, real native registration and thread-local allocation requests, and separately retained release links. Only its actual completed execution can provide those measurements. The inventory does not infer them from module counts or source bytes.

## Supplemental current-source audit

The separate `audit-additional-native-consumers.mjs` execution reads the current integration workspace without modifying it. It binds every Compiler/Core/Hook input before importing the compiler and verifies zero input drift afterward. It compiles 23 exact official or existing native-consumer sources: 14 generate successfully and nine retain their original diagnostics. This is source generation; no additional native test is claimed by this audit.

The 14 successful sources add 13 operation IDs absent from the 39-module ordinary inventory. The union of these explicitly source-bound receipts covers 98 of the 192 profile-listed IDs. The remaining 94 lack a generated consumer in these selected inputs. This is a coverage inventory, not 94 proven implementation bugs and not a replacement denominator for the original library/profile matrix.

| Additional generated operations | Existing source/consumer carrier |
| --- | --- |
| `hook.asTextControl`, `textControl.on`, `textControl.sync`, `textControl.resetValue`, `textControl.snapshot` | Official Input and input delegate; `gpui-control-label/consumer.rs`; text source under `gpui-a11y-value` |
| `eventControl.requestDefaultActionPrevention`, `focus.activate`, `focus.deactivate`, `focus.blur`, `focus.setNavParticipation`, `accessible.relation` | Exact `gpui-a11y-value` activation, text and sequential-focus sources |
| `hook.asTableStructure`, `tableStructure.getSnapshot` | Original Base Table Root, Row and Caption; new actual native consumption remains outstanding |

### Concrete source refusals

| Unchanged source | Actual diagnostic boundary | Next owner/action |
| --- | --- | --- |
| Table Cell | `PUI1006`, only primitive Props admitted | Compiler: trace declared finite Prop schema; do not rewrite legal source to omit header relationships |
| Table HeaderCell | `PUI1020`, imported `TableHeaderKind` lacks semantic declaration | Compiler: inspect public type alias/source binding against the actual module type |
| Image | `PUI1020`, imported `ImageViewA11yMode` lacks semantic declaration | Compiler: preserve informative/decorative definition while resolving its real type source |
| Textarea | `PUI1004`, `FIELD_LABEL_PAIR = Object.freeze(...)` | Compiler/shared declaration owner: preserve Anatomy family identity; do not classify semantic handles as unrestricted data |
| Dialog Root, Content and Trigger | `PUI1020`, explicit `AnyKeyword` | Compiler/source owner: establish the actual finite or semantic callable boundary; do not broadly admit `any` |
| ScrollArea Root | `PUI1006`, Context value/key type mismatch | Compiler/shared Context owner: retain key identity and source type proof |
| ScrollArea Viewport | `PUI1006`, semantic handles in array | Compiler/shared definition owner: prove the intended handle collection boundary; no general array relaxation |

### Reachable software evidence and physical acceptance

The 94 residual rows are classified individually in `native-operation-remaining-triage.json`. None needs physical hardware merely to generate its source or run a bounded headless native consumer.

- Props/raw watchers, render reads, Context updates, rule disposal, style patch/release, binding and subscription retirement can use ordinary generated components. Their independent oracle must verify first failure, ordering, restoration, repeated release, stale callbacks and cleanup, rather than only checking for emitted function names.
- Anatomy/Collection/Table topology, Focus navigation, Boundary/Hit Participation, Overlay/Positioning and ImageView need actual retained GPUI targets, layout and lifecycle consumers. The same-window/cross-window, duplicate or missing owner, removal/replacement, reentrancy and obsolete completion controls remain real software work. New fixtures should consume the shared contracts and native facts without copied component business logic.
- OS accessibility and assistive technology, platform text input/IME, physical touch/pen, and device performance are separate original acceptance conditions. Headless results do not satisfy them. Their absence does not excuse unimplemented source or native software coverage.
- Per-field typed record/array lowering and complete reached helper selection remain architecture work even after these source rows gain consumers. Neither a three-tree cost measurement nor an operation case count closes those criteria.
