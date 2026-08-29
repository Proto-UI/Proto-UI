# Message composition first slice — design decision packet

Date: 2026-08-29

Status: non-normative, unauthorized proposal. This record resolves the six authoring/rendering questions that #516 requires before a bounded first slice can be implemented. It authorizes nothing; the maintainer decides whether to accept the packet and open implementation. It supersedes nothing in `spec/**` and introduces no P/T entity.

Refs: #513 (tracking), #516 (this slice), #500 (composition-owner proposal), #501 (merged `compositions-chatui` decision), #341 (rejected shadow Base carriers).

## Boundary restated (already decided by #500/#501)

- Package `@proto.ui/compositions-chatui` is initially private: no CLI `add`, no public docs navigation, no stable release/BOM identity, no neutral Base Message export, no `P-BASE-MESSAGE` chain in any design language.
- App Maker owns message data, identity, sender, delivery/status, streaming, actions, and accessible role/name. The composition owns only layout slots, alignment/tone recipe, and bounded spacing.
- Message and Code Block are independent entries; this packet covers Message only (#517 is Code Block).

## Anatomy decision

`Message.Root` plus boundedly-named parts, each authored as its own anatomy part (the proven Select/Tabs multi-part model), not a new unnamed-slot-only surface:

```text
Message.Root
├─ Leading        (0..1)
├─ Header         (1)
├─ Content        (1)
├─ Footer         (0..1)
└─ Actions        (0..N)
```

Root owns the layout track and the family context; each part renders its App-authored content through its own `r.slot()`. Cardinality is structural guidance, not a new runtime collection: `Leading`/`Footer` optional, `Header`/`Content` required, `Actions` repeatable as ordinary authored children.

## Resolutions for the six authoring/rendering questions

1. **One unnamed slot vs multi-slot/part path.** Use the existing bounded multi-part anatomy (Root + named parts). Each part carries one unnamed `r.slot()` for App content; there is no new named-slot or compound-slot mechanism. This reuses Tabs/Select part authoring rather than inventing a composition-specific slot primitive.

2. **Composition representation without a Template outer node as Proto Root.** Message is authored with `definePrototype` as a normal multi-part Proto family (`def.anatomy.claim(MESSAGE_FAMILY, { role: 'root' })` for Root, sibling roles for parts). Root is a first-class Proto Root owning layout, not a wrapper Template node around the whole entry. #500's "falsify A" fallback (Prototype authoring as internal carrier, composition ownership at package level) is confirmed as the chosen path; the composition identity is the package + entry, never a Base semantic subject.

3. **Package-local vs new reusable composition-entity path.** First slice keeps part identity/anatomy package-local evidence. No new reusable composition-entity path, no new schema type, no catalog admission. **This is isolated as the one `needs semantic decision`:** if a second composition (Code Block, Composer) later cannot express itself package-locally and needs shared anatomy identity, a separately authorized reusable composition-entity path is the trigger; that decision is out of scope for this slice.

4. **App content projection without host instance values.** Content is authored children (`r.slot()`, text, or app-supplied Proto parts) rendered natively by WC/React/Vue. Protocol Props/State/Context/Expose never carry DOM nodes, host instances, or framework keys. Streaming updates arrive as App-driven content re-render, not as composition-owned state.

5. **alignment / tone: props vs recipe vs both.** Both are plain typed composition props (`alignment` enum, `tone` enum) that resolve a package-local style recipe key. They are presentation inputs only — they never declare a message role, name, or state owner. `tone` is a recipe selector (`default` | `user` | `assistant` | `system`), not an Agent-domain fact; the App maps its own kind to the key it chooses.

6. **Minimum a11y absence/positive evidence.** Root remains role-neutral (it must not invent `role=message`, `role=article`, `aria-live`, or an accessible name). Absence tests assert no message role/name/state owner is projected; positive tests assert App-authored text and links remain natively reachable. App-owned accessible naming is supplied by the App, never inferred by the composition.

## Acceptance mapping (from #516)

- Anatomy + cardinality: resolved above; the reusable-path question is isolated as `needs semantic decision` (Q3).
- Props carry only bounded layout/visual inputs (alignment/tone/compact spacing).
- App ownership of data/sender/status/streaming/actions/a11y stays explicit.
- Package/private/release/CLI negatives match #500/#501.
- No #341 wholesale copy; no `any`, placeholder criteria, TODO, or no-op entry.
- WC/React/Vue evidence uses one source entry with real App-authored content (user text, assistant + Code Block, streaming update without transcript remount, failed+retry action, optional system presentation).

## Non-goals (unchanged from #516)

Thread/runtime/history ownership; message persistence or streaming transport; tool/reasoning/approval/artifact semantics; editing/branching/retry/copy/feedback/speech; public package or stable API; Composer; a neutral Base Message subject.

## Human gate

Implementation begins only after the maintainer accepts this packet, especially Q3's `needs semantic decision`. This record is evidence, not authorization.
