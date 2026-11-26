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

4. **App content projection without host instance values.** Content is authored children (`r.slot()`, text, or app-supplied Proto parts) rendered natively by all three currently governed official web adapter profiles (Web Components, React 18-19, and Vue 3). Protocol Props/State/Context/Expose never carry DOM nodes, host instances, or framework keys. Streaming updates arrive as App-driven content re-render, not as composition-owned state.

5. **alignment / tone: props vs recipe vs both.** These are plain typed composition props that resolve a package-local style recipe key. The complete bounded prop schema for the first slice is: `alignment: 'start' | 'end' | 'stretch'` (anchor the block to the leading or trailing edge, or full available width), `tone: 'default' | 'user' | 'assistant' | 'system'` (style-recipe selector, not an Agent-domain fact; the App maps its own kind to its chosen key), and `spacing: 'default' | 'compact'` (internal density; this replaces the earlier untyped "compact spacing" wording and is the only spacing key). These three keys are the entire composition prop surface; no other key is admitted without a separately governed addition. They declare no message role, name, or state owner.

6. **Minimum a11y absence/positive evidence.** Root remains role-neutral (it must not invent `role=message`, `role=article`, `aria-live`, or an accessible name). App-owned role and accessible name are carried by an App-authored semantic wrapper — a native element or an App-owned Proto part — placed **outside** the composition and projected natively by each adapter; the composition must not strip, duplicate, or invent that wrapper. Positive evidence asserts the same App-authored wrapper reaches the accessibility tree with its role/name intact across all three governed profiles; absence evidence asserts the composition projects no message role/name/aria-live of its own.

## Acceptance mapping (from #516)

- Anatomy + cardinality: resolved above; the reusable-path question is isolated as `needs semantic decision` (Q3).
- Props carry only the bounded layout/visual inputs enumerated in Q5 (`alignment`/`tone`/`spacing`).
- App ownership of data/sender/status/streaming/actions/a11y stays explicit.
- Package/private/release/CLI negatives match #500/#501.
- No #341 wholesale copy; no `any`, placeholder criteria, TODO, or no-op entry.
- Three-profile evidence (Web Components / React 18-19 / Vue 3) uses one source entry with real App-authored content: user text, assistant plain-text, streaming update without transcript remount, failed + App-owned retry action, optional system presentation. The assistant + Code Block case required by #516 remains an explicit cross-entry acceptance dependency on separately governed #517; it is not a Message-only acceptance claim. This packet does not implement or decide Code Block; #517 must be accepted and evidenced separately before the combined scenario is considered complete.

## Non-goals (unchanged from #516)

Thread/runtime/history ownership; message persistence or streaming transport; tool/reasoning/approval/artifact semantics; editing/branching/retry/copy/feedback/speech; public package or stable API; Composer; a neutral Base Message subject.

## Human gate

Implementation begins only after the maintainer accepts this packet, especially Q3's `needs semantic decision`. This record is evidence, not authorization.
