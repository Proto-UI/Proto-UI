# Code Block composition first slice — design decision packet

Date: 2026-08-29

Status: non-normative, unauthorized proposal. Resolves the six authoring/rendering questions #517 requires before its bounded first slice. It authorizes nothing; the maintainer decides acceptance and whether implementation opens. It admits no P/T entity and supersedes nothing in `spec/**`.

Refs: #513 (tracking), #517 (this slice), #516 (Message sibling), #500/#501 (`compositions-chatui` decision), #341 (rejected shadow Base carriers).

## Boundary restated (already decided)

- Private `@proto.ui/compositions-chatui`; no CLI `add`, no public docs navigation, no stable release/BOM identity, no neutral Base CodeBlock export, no P/T entity.
- App Maker or existing capabilities own code string/revision, language/filename labels and their truth, tokenization/highlighting, copy/download commands and results, Clipboard, async highlight lifecycle, selection, and artifact/file identity.
- The composition owns only Root/Header/Content structure, a design-language recipe, layout slots, and bounded overflow/wrapping presentation.

## Anatomy decision

```text
CodeBlock.Root
├─ Header        (0..1)   one part, one anonymous r.slot()
└─ Content       (1)
```

Root/Header/Content are ordinary anatomy parts (`def.anatomy.claim`), each rendering App-authored content through its own `r.slot()`. Header is one part with one anonymous slot; `Label/Metadata` and `Actions` are not separate named slots, and there is no second insertion point on Header. Content is the single required child part under Root.

## Resolutions for the six authoring/rendering questions

1. **Named slots vs authored compound entries vs another mechanism.** Use the existing bounded multi-part anatomy (Root + Header + Content). `r.slot()` is anonymous and singular (C-TEMPLATE-0005-B through E), so Header carries exactly one insertion point: App-authored label/metadata and any action controls are composed together as children inside that single slot, with the recipe supplying only the row layout. There is no new named-slot or compound-slot primitive. This is the same model as Message (#516/#569) and Tabs/Select.

2. **`pre`/`code` projection without a neutral Base Code Block subject.** Content is DOM-agnostic structural layout; App-authored code text is projected as plain authored children. The composition never claims `<pre>`/`<code>` semantics, never declares a `code` role, and never declares a language fact. Non-Web semantic projection is deferred until an independently admitted domain exists; the first slice renders honest, natively-readable text.

3. **Wrapping/overflow: style recipe vs host/profile decision.** The first-slice recipe is `wrap` only: long lines wrap inside Content, and the composition creates no scroll surface, no scrollbar, and performs no host measurement. Horizontal `nowrap` + scroll is **not** composition-owned — it is an App-owned Scroll Area capability that hosts or wraps Content, consistent with K-SCROLL-0001 and HC-SCROLL-SURFACE-0001. The composition does not specify how Content composes with an App-owned Scroll Area beyond rendering wrap-able content.

4. **Serializable highlighted token trees.** The composition owns no token serialization. App-owned highlighting output is injected as authored children/text; the App owns the tokenizer and its data. The composition must render the resulting text without a second ownership claim, and must never carry a highlighted token tree in portable Props/State/Context/Expose.

5. **A11y: structural vs App-owned.** Root remains role-neutral and name-free; the composition invents no `region`/`code`/`status` role and no accessible name. App supplies the language/filename label and any accessible naming. Absence tests reject any auto-projected code-specific role or name.

6. **Prove Header/Content are real mounted parts, not prop mirrors.** Header and Content are anatomy parts with real slots that mount App content, verified by positive tests that assert distinct mounted nodes; absence tests assert no fused single-node prop mirror. When Header is absent, both `CodeBlock.Root` and `Content` remain mounted — Content is the sole **child** part under Root, not the sole node — and the absence test asserts both Root and Content nodes are mounted (neither dropped nor fused).

## Copy/highlight boundary (from #517)

First slice stays useful without built-in copy or highlighting. A copy control, if present in a demo, is an App-authored Proto UI Button authored as a child inside the Header slot (the App owns the action); the App invokes the platform service after the semantic Button event; success/failure uses existing Proto UI feedback surfaces. The composition claims no Clipboard ownership. Built-in copy/highlight promotion requires a separately governed Clipboard/async capability and is out of scope.

## Acceptance mapping (from #517)

- Anatomy + authoring mechanism: resolved above; the reusable-path question mirrors #516 Q3 and is isolated as `needs semantic decision` there, not re-opened here.
- Private/unreleased/no-CLI/no-docs negatives match #500/#501.
- No Base Code Block export or P/T entity.
- Code/language/highlight/copy/clipboard/async ownership stays outside the composition.
- One source renders real App-authored code content in all four official web adapters (WC/React/Vue/Vue 2).
- Long-line overflow/wrapping evidence is bounded and host-geometry-free.
- Optional actions are authored Proto controls; re-render never executes them.
- Positive tests mount every approved part; absence tests reject shadow state/event/a11y ownership.
- No #341 wholesale copy, `any`, placeholder criteria, TODO, or no-op entry.

## Non-goals (unchanged from #517)

Syntax highlighter or Markdown renderer; Clipboard or download capability; Diff viewer, terminal, editor, or artifact store; code execution; language detection; public/stable package promotion; a neutral Base Code Block family.

## Human gate

Implementation begins only after the maintainer accepts this packet (and the shared #516 Q3 `needs semantic decision`). This record is evidence, not authorization.
