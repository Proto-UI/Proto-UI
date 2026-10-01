# Tree first-slice decision packet

Date: 2026-09-21

Status: non-normative recommendation for #523. This record does not admit a Contract, Prototype, Module, Host Capability, Adapter relation, package export, implementation, or stable guarantee.

Refs: #513 (Harness tracker), #514/#563 (matrix carrier), #521 (windowing), #523 (Tree), #548/#549/#553 (heading and same-domain relationship work).

## Recommendation

Advance one later proposal checkpoint for an **explicitly authored, single-root, non-lazy Tree hierarchy** with expansion and visible-order focus navigation. Defer semantic selection, typeahead, lazy loading, windowing, editing, drag/drop, checkboxes, file operations and design-language projection.

The first slice has four semantic parts:

```text
Tree.Root
└─ Tree.Item (repeatable; stable value; may nest)
   ├─ exactly one Tree.ItemRow
   └─ zero or one Tree.Group
      └─ Tree.Item...
```

`ItemRow` is the focusable/activatable `treeitem` semantic object. `Item` is the per-item structural owner and item-local domain root. `Group` owns the child container relationship. Root/Item hierarchy is explicit authored structure, not a visually indented flat Collection.

Classification: **next proposal checkpoint**. No materially different owner remains unresolved, but implementation stays blocked on an accepted reusable same-domain relationship implementation under #549 and a separately reviewed C/P/M/T graph.

## Existing authority and proof boundary

All cited entities are draft unless stated otherwise:

- `M-COLLECTION-0001-A/C/D/F` and `C-AS-COLLECTION-0001-C/D/E` own explicit ordered item snapshots, current host-observable order, insert/remove/reorder and structural metadata. They explicitly do not own selection, focus movement, keyboard policy or A11y pattern.
- `D-COLLECTION-FOCUS-ROVING-RELATIONSHIP-0001-A/B/C` permits Focus Roving to consume Collection order but forbids either abstraction from absorbing the other or inferring semantic selection.
- `C-AS-FOCUS-ROVING-0001-F/G/H/I/J/K` owns sibling movement, one natural Tab participant, runtime orientation/loop, independent selected/active facts, focused-set keyboard ownership and deferred entry. Tree must supply a **visible hierarchy projection** rather than changing Focus membership into a hierarchy engine.
- `M-FOCUS-0001-B/C/E` retains physical focus facts, programmatic requests, logical ancestry and view-epoch retry/cleanup. Tree owns navigation interpretation and current logical item; Focus owns whether host focus actually applied.
- `C-ANATOMY-0005-A..D`, `C-ANATOMY-0008-B/C`, `C-ANATOMY-ORDER-0001-B..D` and `C-ANATOMY-ORDER-0003` provide nearest-domain actual parts, safe PartViews, host order and structural churn without raw targets.
- Merged #553 catalogs `C-A11Y-PART-RELATIONSHIP-0001`, but its required implementation remains planned under #549. Tree must not invent a family-specific IDREF registry while that shared prerequisite is incomplete.
- `C-A11Y-0001-DOMAIN-BOUNDARY/B/E/G/H/N/O/P` and `HC-A11Y-0001` keep role/name/state/relation projection in A11y, preserve opaque identity across view epochs and leave host projection/degradation to Adapter evidence. Tree owns hierarchy facts, not a second A11y path.
- Active `D-ADAPTER-PROFILE-0001` prevents Web evidence from becoming an automatic non-Web support claim.

The WAI-ARIA APG Tree View pattern is Web behavior evidence, not Proto UI authority. It supports the recommended distinction between focus and selection, visible-order Up/Down, Right/Left branch behavior, Home/End, one focusable item and `tree`/`treeitem`/`group` plus `level`/`posinset`/`setsize`/`expanded`. ARIA host structure is one projection; a non-Web Adapter may translate or degrade after profile-specific evidence.

### External source boundary

- [WAI-ARIA APG Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) supplies the Web interaction comparison: visible-order arrows, branch Right/Left behavior, Home/End, focus versus selection, one Tab participant, and `tree` / `treeitem` / `group` with expanded and positional facts. APG recommendations do not select Proto UI ownership or make typeahead/selection mandatory in the first slice.
- [WAI-ARIA `treeitem`](https://w3c.github.io/aria/#treeitem) confirms that a custom host projection needs explicit widget semantics and accessibility API mapping. DOM containment or `aria-owns` is Web projection evidence, not a portable hierarchy carrier.
- [AppKit `NSOutlineView`](https://developer.apple.com/documentation/appkit/nsoutlineview) provides a non-Web counterpoint: the host control retrieves hierarchical data through its data source, requires stable/equal item identity for expansion persistence, exposes parent/child/level/row conversion, and separately owns native editing, selection, columns, drag/drop and expansion notifications. Those wider native features remain App/host concerns and are not imported into the portable first slice.

Together these sources support stable item identity, hierarchy, expansion, current/focus navigation and positional accessibility facts across host classes; they do not establish common native materialization or cross-host conformance.

## Why two Anatomy domains are required

One root-scoped family with repeatable `item`, `row` and `group` roles cannot prove which row/group belongs to each repeated item. Registration order, DOM shape, CSS indentation and prototype names are forbidden inference sources.

The proposal should use two coordinated families:

1. **Tree family:** one Root plus repeatable nested Item roles. The Tree semantic owner derives parent/children from actual nearest-domain logical ancestry and current Anatomy order.
2. **Item-local family:** every Item establishes a nearest item domain containing exactly one ItemRow and zero or one Group. The Group contains nested Items in the Tree family without becoming a second Tree root.

This makes per-item row/group cardinality diagnostic and reusable without public host identity. ItemRow-to-Group accessibility relationships must use the shared #549 structured relationship path or generic opaque refs through an approved domain Module; protocol values never become host IDs.

## Owned facts and requests

### Root owns

- one non-empty unique `value` per actual Item;
- the current hierarchy graph and visible flattened order;
- uncontrolled `defaultExpandedValues` or controlled `expandedValues` ownership;
- `expandedChange` requests with item value and next expanded fact;
- one current logical item value used to interpret navigation and natural Tab participation;
- visible-order keyboard interpretation and deterministic recovery;
- bounded structural/controlled-value diagnostics.

### Item owns

- its stable value and disabled fact;
- derived parent, level, position-in-set, set-size, branch/leaf and expanded facts;
- explicit expand/collapse/toggle and App-owned activation requests;
- one item-local Row and optional Group structural relationship.

### Existing domains retain

- Collection: explicit full item snapshot/order and structural metadata only;
- Focus: physical focused/focusVisible/active facts, host requests and applied result;
- A11y: semantic object identity and host projection;
- Anatomy: structure/domain/order/PartView only;
- App: labels/icons/status/data/loading/persistence/navigation/file/session/plan/Agent actions.

No raw host node, host ID, framework key, filesystem object, Agent object or geometry enters portable Props/State/Context/Expose.

## Selection disposition

**Defer selection.** No current Tree-specific or generic Selection owner defines controlled ownership, request rejection, focus interaction, removal recovery and A11y `selected` projection together. Treating `current`, Focus `active`, App activation or expanded state as selected would fork ownership.

The first slice exposes no selected prop/state/event and no selection-follows-focus mode. A later selection checkpoint can compose a separately governed Selection owner. This is a resolved first-slice exclusion, not an unresolved direction.

## Keyboard and focus policy

For the vertical first slice:

- Down/Up move to next/previous eligible visible item without changing expansion.
- Home/End move to first/last eligible visible item.
- Right on a closed branch requests expansion and keeps current; Right on an open branch moves to its first eligible child; Right on a leaf does nothing.
- Left on an open branch requests collapse and keeps current; Left on a closed branch or leaf moves to the nearest eligible parent; a root item does nothing.
- Enter emits one App-owned activation request; it never guesses file/session/plan behavior.
- Space also emits activation in this non-select slice; it does not create selection or silently toggle expansion. Apps may render a separate authored disclosure control whose semantic event calls the Tree expand request.
- Tab is host sequential navigation, not Tree next/previous. Only the current eligible ItemRow participates naturally; every other eligible visible row remains programmatically focusable.
- Disabled items remain in hierarchy/A11y order but are skipped by movement and reject activation/expansion requests when policy says disabled.
- Typeahead, `*`, horizontal orientation and RTL remapping are deferred.

Only the Tree containing the actual focused member consumes a shared keyboard sample. Default-action cancellation follows existing Focus/Event authority.

## Expansion and controlled ownership

- Uncontrolled Root owns a set initialized once from `defaultExpandedValues`.
- Controlled Root reads `expandedValues`; interaction emits requests but cannot replace owner facts. Rejection leaves visible order unchanged.
- Unknown/duplicate/empty values are diagnosed and omitted from effective expansion; they are never materialized or guessed.
- Structure insertion/removal/reorder never emits a user expansion/activation request.
- A leaf never projects `expanded`; a branch derives `expanded` from current owner state.
- The first slice has no latent/unloaded child fact. A branch exists only when an actual authored Group contains at least one actual Item. Lazy children remain App/infrastructure work.

## Dynamic recovery

The transition oracle is current item value plus before/after visible order and parent graph:

1. If current remains visible and eligible, retain it across reorder/rematerialization.
2. If an ancestor collapses around current, recover to the nearest surviving eligible ancestor.
3. If current is removed, prefer the nearest surviving eligible ancestor; otherwise choose the item now at the old visible index, then previous eligible, then first eligible, else no current item.
4. Removing/replacing a physical view does not change logical identity; terminal removal does.
5. A pending Focus entry survives retained view detach under existing Focus authority and retries only current eligible intent.
6. Stale callbacks carry structure/version identity and cannot update a newer hierarchy generation.

A private data-only fake initially expected removal of nested `lib` to recover to the next root item `plan`; execution falsified that premise because parent `src` still survived. The corrected nearest-surviving-ancestor rule passed together with collapse recovery, duplicate rejection and no structure-change requests: **2 tests passed**. This is simulation evidence, not implementation or acceptance.

## Accessibility projection

- Root semantic role: `tree`, with App-authored accessible name/description.
- ItemRow semantic role: `treeitem`; Group: `group`.
- ItemRow projects `level`, `posinset`, `setsize`, disabled and current/focus facts. It projects `expanded` only for actual branches.
- ItemRow owns an opaque relation to its optional Group through the shared relationship path; no protocol value is a host ID.
- No `selected` state is projected in this slice.
- Host Adapter selects native, translated or diagnostic projection; WC/React/Vue evidence on one Web host does not prove non-Web conformance.
- A Group absent because a branch is collapsed may be view-detached while logical identity survives; IDREF withdrawal/restoration and stale cleanup depend on #549 executable evidence.

## Lifecycle and resource boundary

- Recompute hierarchy, visible order, position facts and relationships on insert/remove/reorder/current expanded changes.
- Preserve Root owner state and Item identities across L1 detach/rematerialization.
- Terminal disposal removes Collection/Focus/A11y/relationship registrations and pending keyboard/focus intents exactly once.
- Callback generations reject retired structure, relationship and focus results.
- No host observer, raw geometry or unbounded queue is required by the semantic owner.

## Windowing and loading

#521 windowing is explicitly deferred. The first Tree slice requires the authored hierarchy to be logically present; a later Windowing Module may reduce physical views without changing full Collection identity/order or Tree parentage. Lazy loading is also deferred: App-owned “children may exist” is metadata, not a branch until governed loading/materialization semantics exist.

## Luna adversarial pass (hypotheses, not evidence)

A no-tool Luna run received only the recommendation and returned eight HYPOTHESIS questions. Repository/source reconciliation resolves them as follows; this is not independent approval:

1. **Nesting versus Collection order:** authored nearest-domain Anatomy nesting and host-observable order are authoritative. Collection is derived from that structure; a conflicting App metadata order is not a second owner and becomes diagnostic rather than a reorder source.
2. **Multiple row presentations / Group before Row:** exactly one semantic ItemRow is deliberate. Visual variants and App controls compose inside or outside that row without creating another `treeitem`. A missing Row or an early Group is temporarily invalid and cannot publish valid Tree semantics.
3. **Controlled updates racing requests:** current owner props win; requests carry the observed owner version/value and do not speculate acceptance. Controlled unknown values are diagnosed and ignored until matching Items appear. Uncontrolled removal prunes terminally absent values; mode is fixed by initial ownership.
4. **Simultaneous collapse/removal:** recovery follows nearest surviving eligible ancestor, then old visible index, previous, first, none; each candidate is revalidated against the new generation before a host focus request.
5. **Eligibility:** first-slice eligibility is an actual visible Item with its single Row, not disabled and not terminally unavailable. Loading, inert and windowed partial views are not first-slice Tree facts; later capabilities must define them before affecting navigation.
6. **Nested native controls:** ItemRow is the single roving focus/activation target and must not contain independent sequential interactive descendants in this slice. App-authored actions sit outside the Row target or require a later composite-action policy; no key event is double-routed.
7. **Expansion across hidden/recreated descendants:** collapsing an ancestor retains descendant expansion values so reopening restores logical state. Terminal removal prunes uncontrolled descendant values. A controlled owner may retain unknown values, diagnosed and ineffective until matching Items reappear.
8. **Relationship prerequisite:** implementation is blocked. Host-neutral hierarchy/keyboard tests can be designed, but no implementation or Adapter conformance can be accepted until #549 supplies the shared relationship lifecycle or maintainers explicitly choose another governed carrier.

The pass changes no owner or slice recommendation. It makes ownership mode, ItemRow interaction containment, expansion pruning, generation revalidation and #549 blocking explicit.

## Evidence plan for a later implementation

### Host-neutral/fake

- exact dual-family cardinality and nearest-domain isolation;
- empty/duplicate values, malformed row/group relations and duplicate/missing relationship targets fail closed;
- controlled accept/reject, dynamic insert/remove/reorder, collapse/removal recovery and no user requests from structure churn;
- visible navigation matrix, disabled skipping, pending focus, detach/remount, stale callback rejection and terminal cleanup;
- no selection, lazy, windowing, filesystem, Agent or raw-host surface.

### Real Web profile

- same source semantics in WC/React/Vue 3/Vue 2 for a static file hierarchy and a plan/subagent hierarchy;
- native pointer plus Arrow/Home/End/Enter/Space/Tab journeys;
- accessibility tree inspection for tree/treeitem/group, level/position/set-size/expanded and stable relationships;
- focus recovery, zoom/reflow/high contrast and no narrow-layout clipping;
- explicit profile limits; no non-Web claim.

## #514 matrix consumption

PR #563 remains the single matrix carrier. After that exact head is accepted, update only the Tree rows: classify Tree semantic family as `research` pending admission/implementation; keep file/plan/session/Agent data and loading App-owned; link this record; trigger re-review on selection admission, lazy/windowing integration, relationship-prerequisite outcome, non-Web claim or ownership expansion. Do not copy the matrix into this record.

## Residual risks and exact human decision

Residual risks: #549 implementation is incomplete; Focus non-Web ordering remains open; Tree selection has no owner; windowing/lazy loading are deferred; native accessibility behavior is unverified.

Smallest human decision: **accept, revise or reject the proposed non-select Tree C/P/M/T checkpoint with dual Anatomy families and the exclusions above.** Acceptance authorizes a separate spec proposal only. It does not authorize implementation, Adapter support, CLI/public release, #521 windowing, #549 bypass, selection, filesystem/Agent ownership or design-language work.
