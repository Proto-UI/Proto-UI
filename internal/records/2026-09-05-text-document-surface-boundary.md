# Text Document / Editor Surface boundary for later Agent Harness work

Date: 2026-09-05

Status: non-normative research recommendation for #531. This record does not admit a Contract, Module, Host Capability, Prototype, Adapter relation, editor engine, document model, language service, persistence path, or implementation.

Refs: #389 (Text Control/Input), #513 (Agent Harness tracker), #514 (coverage matrix), #517 (Code Block), #521 (windowing), #529 (Artifact Workspace/static Diff Review), #531 (this research).

## Recommendation

Advance **option C: a narrow single-document plain-text Editor Surface proposal checkpoint**. Keep the document model, text storage, edit application, undo/redo stack, selection objects, tokenization, viewport rendering, decorations, language services, workers, and host accessibility implementation inside an infrastructure-exempt editor engine. Keep file identity, source revision, persistence, permissions, save/revert, conflicts, audit, and diagnostics truth App-owned.

The next checkpoint should consider one semantic Module plus one lease-shaped Host Capability for an opaque document/revision reference, attachment/read-only/status facts, revision-bound transaction summaries, bounded selection summaries, engine-command requests, Focus-domain integration, Module-owned connection identities, and stale-result suppression. It should not admit an editor engine, public Prototype, syntax/diagnostic semantics, multi-document workbench, or Adapter support claim.

Classification: **next proposal checkpoint**. The editor/document engine remains **infrastructure-exempt behind a narrow host surface**.

Option A remains the honest fallback for small unrevisioned plain text (`P-BASE-TEXTAREA`), structural code/log presentation (#517), and immutable diff review (#529). Option B pays editor/model/accessibility cost but adds little beyond those fallbacks. Option C is the first slice with an editor-specific user job: maintain one revisioned editing session with engine-owned selection and undo while the App remains persistence authority.

## Evidence and authority

### Repository authority

The following catalog entities are draft unless stated otherwise:

- `C-TEXT-CONTROL-0001-A/C/F/G/I`, `M-TEXT-CONTROL-0001`, and `HC-TEXT-CONTROL-0001` govern one host-selected single- or multiline plain-text control, normalized value/input/composition behavior, and a bounded host lease. They do not govern a revisioned document, editor transactions, model lifetime, undo, decorations, or language services.
- `D-TEXT-CONTROL-PROJECTION-0001-A/C/D/E` keeps selection, cursor, IME, software keyboard, edit menus, and system editing chrome host-owned and limits current conformance to Web hosts. `D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION` already owns the open question of when selection facts/requests enter the plain Text Control contract.
- `P-BASE-TEXTAREA-PHYSICAL-TARGET`, `P-BASE-TEXTAREA-EVENTS-AND-IME`, and `P-BASE-TEXTAREA-BOUNDARY` define a contentless multiline leaf and explicitly exclude rich text, system selection/edit-menu ownership, auto-resize, and a second editor.
- `P-BASE-INPUT-PHYSICAL-TARGET` and `P-BASE-INPUT-BOUNDARY` make the same negative boundary for single-line text entry. Merged PR #547 generalized the shared Text Control line-mode implementation without adding document semantics.
- `K-HOST-SURFACE-ROLES-0001-D` and `C-HOST-SURFACE-PROJECTION-0001-B/D/E` keep raw targets/controllers in translation and require logical-boundary stability plus replacement cleanup.
- `C-FOCUS-0001`, `C-A11Y-0001`, and `C-SCROLL-0001` retain focus, accessibility semantic projection, and logical scrolling ownership. An Editor Surface may consume these domains but may not copy their state machines.
- Active `D-ADAPTER-PROFILE-0001-B/C/D/E` prohibits inferring reviewed Module support or Host Capability provision from a package or same-Web evidence.

Current source and tests confirm the adjacent boundary:

- `packages/core/src/text-control.ts` exposes line-mode patches, normalized editing/composition events, and only value/composition snapshots.
- `packages/modules/text-control/src/caps.ts` uses a data-only `attach`/`update`/`snapshot`/`dispose` lease.
- `packages/modules/text-control/src/web.ts` keeps concrete Web targets, listeners, selection preservation, scroll offsets, and IME mechanics in the host bridge.
- `packages/modules/text-control/test/impl-spec.test.ts` proves value, IME, and lease behavior through a fake host.
- `T-TEXT-CONTROL-0001`, `T-BASE-TEXTAREA-0001`, and `T-BASE-INPUT-0001` bind the current leaf-control evidence. No `T-TEXT-DOCUMENT-*` or `T-EDITOR-SURFACE-*` evidence exists.
- Targeted searches found no Text Document/Editor Surface, CodeMirror, Monaco `ITextModel`, or comparable editor implementation in `packages/**` or `apps/www/src/**`.

`internal/records/2026-08-02-text-control-host-boundary.zh-CN.md` explains the host-owned plain-text boundary. `internal/records/2026-08-29-code-block-composition-first-slice-design.md` keeps code, highlighting, selection, and Clipboard outside Code Block. Issue #529 keeps immutable diff computation, revisions, patch semantics, and side effects App-owned. These are context or scoped work, not authority to admit an editor.

### External primary sources

Web evidence was inspected from Monaco Editor:

- [README at `d620ca0c03d24a51c05ae4dca8a9d5923a4aeb9c`](https://github.com/microsoft/monaco-editor/blob/d620ca0c03d24a51c05ae4dca8a9d5923a4aeb9c/README.md) separates file-like models, URI identity, text content/edit history, DOM editor views, language-feature providers, workers, and disposal.
- [public `monaco.d.ts` at gh-pages `b86a4f9e56a3228b067578205655e2307ae89d44`](https://github.com/microsoft/monaco-editor/blob/b86a4f9e56a3228b067578205655e2307ae89d44/node_modules/monaco-editor/monaco.d.ts) gives models distinct IDs/URIs and version IDs; exposes range-based change events, selections, composition, paste, focus, layout, scroll, hidden areas, serializable view state, multi-cursor behavior, decorations, accessibility page size, and `tabFocusMode`; and represents listeners as disposables.
- [Accessibility Guide for Integrators](https://github.com/microsoft/monaco-editor/wiki/Accessibility-Guide-for-Integrators) requires host-provided action keybindings, an accessible label, high-contrast decisions, screen-reader support configuration, and accessibility help. It records that wrapping may need host/engine adaptation for screen readers.

Non-Web evidence was inspected from current Microsoft native-editor documentation:

- [WinUI RichEditBox guidance](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/rich-edit-box), source revision `fd2cde64baabeded5e3cf17f33b8787c9e468691`, separates the editor control from surrounding toolbar/file controls and exposes an `ITextDocument` for content, ranges, selection, undo/redo, loading, and saving.
- [RichEditTextDocument](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.text.richedittextdocument), source revision `70ebf766b73dd46f874ded9cfcf5b01d4476048d`, owns selection, undo grouping/history, ranges, streams, text, formatting, and display-update batching.
- [UI Automation TextPattern](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-textpattern-overview), source revision `156931bb4ec1e81b028c76ea983553f2e9778bdd`, exposes document text as ranges with selection/change events and platform navigation. It warns that ranges may become invalid after replacement, accessibility text is broadly readable by clients, and range access has cross-process performance costs.

The Web and native engines differ, but both keep models, selections, rendering, input services, accessibility ranges, and resource lifetime behind engine/platform APIs. That supports a data-only host surface, not a generic portable document model or a multi-host conformance claim.

## User-job and slice comparison

| Option | User job | Benefit | Cost or failure | Disposition |
| --- | --- | --- | --- | --- |
| A. No editor domain | Edit a small plain-text value or read code/log/diff output. | Existing Textarea, Code Block, and static Diff boundaries remain honest and cheap. | No document revision, engine undo, durable selection, viewport restoration, or large-document session. | Keep as fallback. |
| B. Read-only document viewport with selection/copy | Navigate a document through an editor engine without editing. | Can preserve engine-native selection and accessibility ranges. | Pays model/view/a11y/lifecycle cost while overlapping Code Block/static document/diff paths; no first editor-specific editing job. | Do not make the first Proto UI slice. Private infrastructure may provide it. |
| C. Single-document plain-text Editor Surface | Maintain one revisioned editor session, apply engine-local edits/undo, and route explicit App actions. | Smallest end-to-end editor-specific job; fakeable through references and transaction summaries. | Requires revision, shortcut/IME, permission, selection-summary, view-state, and stale-callback rules. | **Recommended proposal checkpoint.** |
| D. Syntax/decorations/diagnostics | Inspect tokens, decorations, diagnostics, quick fixes, and navigation. | Useful developer experience. | Adds language-service truth, decoration identity, issue navigation, and accessibility policy. | Defer. |
| E. Multi-document/large-document workbench | Manage tabs, models, huge files, paging, branches, conflicts, and workspace commands. | Full workbench. | Conflates App workspace, persistence, windowing, editor, language, and conflict owners. | Defer. |

## Responsibility and trust table

| Layer or existing surface | Owns | Receives across the boundary | Must never expose or claim |
| --- | --- | --- | --- |
| App/backend | Opaque document/file identity; authoritative source revision; permissions; loading; persistence; save/revert; conflict and idempotency; language-service and diagnostics truth; audit. | Document/transaction references and explicit data-only action requests. | File handles, storage streams, credentials, VCS objects, language-server handles, authority inferred from rendered text. |
| Editor-engine infrastructure | Mutable text model; edit application; composition integration; selection/cursors; undo/redo; tokenization; decorations; folding; find algorithm; viewport rendering/windowing; engine view state; native accessibility text/ranges. | Host-local target plus document/backend services injected outside portable authoring. | Engine/model/view/controller/worker, mutable ranges/selections, DOM/native target, framework component, host view-state object. |
| Proto UI Text Document semantic owner | One logical surface identity; current document/reference revision; lease epoch; attachment/focus/read-only/input-enabled facts; revision-bound transaction summaries; bounded selection summary; engine-command request/result correlation; stale-result rejection. | Immutable references, status facts, summaries, and requests. | Full document content in generic State, raw changes/models, tokenizer/diagnostic objects, raw geometry/events, persistence authority, engine undo data. |
| Text Document Host Capability | Resolve current target/model/view from host configuration; attach engine; bridge IME/keyboard/focus; apply read-only policy; emit bounded facts/summaries; route engine service operations; preserve/restore host-private view state; project accessibility; clean up. | Static requirement and plain patch plus adapter-injected resolvers keyed by opaque IDs. | No target, model, editor, range, selection, file/stream, worker, or callback source returned to portable Props/State/Event/Context/Expose. |
| Adapter profile | Materialize boundary/surface/input/a11y targets; wire capability; translate lifecycle and Focus participation. | Governed Module requirement only after admission. | No semantic reinterpretation and no support/provision relation before profile evidence. |
| Composition/design language | Tabs/breadcrumbs, toolbar, filename/revision/status, dirty/conflict badge, explicit Save/Revert, find controls if later admitted, diagnostics list if later admitted. | App facts and ordinary Proto UI control events. | Document storage/model, edit transactions, undo stack, language/diagnostic truth, direct engine action during render. |
| Base Textarea | Small unrevisioned multiline plain-text value protocol. | Value/property facts and normalized input/IME. | Document identity/revision, transactions, engine model, multi-cursor, workbench. |
| Code Block | Structural presentation of App-authored code/log content. | Authored text/tokens and ordinary child controls. | Editing, selection, Clipboard, document history, language services. |
| Static Diff Review | App-local immutable change presentation and explicit review actions. | App-computed diff/revision labels. | Edit model, patch application, persistence, conflict resolution. |

The engine can remain completely outside Proto UI. The Host Capability obtains model/view/backend services from adapter/host configuration using `documentId`; no engine or document object crosses portable authoring.

## Portable facts, requests, and information paths

### Candidate first-slice values

Names below illustrate a proposal; they are not an admitted API:

- App input: immutable stable `surfaceId` plus `document: { id, sourceRevision, modelSessionId }`; mutable read-only/input/status policy revision; and App-acknowledged `savedContentVersion`. Accessible name/description remain A11y facts; help is App composition referenced through governed description/relation semantics.
- Host facts: discriminated attachment state; numeric applied policy on terminal/ready branches; and, only when ready, composition, monotonic mutation revision, content-equality version, undo/redo availability, and revision-bound selection summary. The Module derives `dirty` from current versus saved content version. Focus remains in Focus; connection freshness is Module-owned.
- Engine event summary: transaction ID scoped to opaque `modelSessionId`, document/source/policy/mutation revisions, resulting content version, origin, and change count. Lookup/deduplication uses `{ modelSessionId, transactionId }`; a model-level dispatcher prevents multiple view leases from persisting one edit twice.
- Engine requests/results: mutation/policy-bound undo/redo and explicit snapshot/export by the App-owned service. Line navigation remains deferred. Focus/blur remain in Focus. Save/revert remain App actions.

The first slice's selection summary is intentionally bounded to `{ count, primaryCollapsed }` plus the current monotonic mutation revision. No raw range, selected text, mutable selection, pixel rectangle, or ungoverned line/column encoding crosses. A later line/column or range API needs an explicit Unicode position encoding and revision semantics.

This resolves the seam with `D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION` without closing it: plain Text Control selection remains that decision's open question. Revision-bound document selection is a different future contract and must not be retrofitted into `TextControlHandle`. Neither surface gains `selectAll`, `setSelection`, or `replaceSelection` in this first slice.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Document identity/revision | App -> immutable Text Document requirement -> Host Capability resolver | Correct shared/private engine model and view appear for that reference. | Stable surface/document/model-session identity and Module-owned connection. |
| Source content | App-owned document service -> engine directly | Engine renders/editable text. | Service/model boundary; no full text copy through generic Proto State. |
| IME/text/key input | Physical editor target -> engine/model dispatcher | Engine applies one transaction; App service resolves its exact changes once across every attached view. | Applied policy, composition, model session, mutation revision. |
| Edit details | Model dispatcher -> App-owned editor service; view receives bounded summary | App validates/persists by `{ modelSessionId, transactionId }`. | Model-scoped transaction key; view connection only suppresses stale UI delivery. |
| Save/Revert | Proto UI Button -> App service -> saved-content-version patch | Module derives dirty from current versus acknowledged content version. | App idempotency plus document/source/content identity. |
| Undo/Redo | App/semantic command -> Module request -> Host Capability -> engine | Engine transaction and availability facts. | Expected mutation/policy revision validated before mutation; content version may return to an older value without reusing mutation revision. |
| Selection/caret | Engine | Native accessibility exposes ranges; Proto receives only count/collapsed summary. | Current mutation/policy revision and connection identity. |
| Focus/Tab escape | Focus domain / host keyboard arbiter -> editor or Harness region | Exactly one focus destination; facts return only through Focus. | Current Focus/view epoch and shortcut policy. |
| Accessible naming | A11y semantic object -> HC-A11Y/Adapter -> physical editor target | One name/description projection; App help control may be related/described through existing semantics. | A11y identity and target replacement; no Editor naming/help field. |
| Viewport/layout | Host geometry -> engine | Engine renders/reflows and stores host-private view state. | Immutable stable surface plus document identity; no raw geometry/view state. |
| Diagnostics/decorations | App language service -> later engine/composition slice | Deferred. | No first-slice channel. |

## Fake-engine / fake-host protocol sketch

Callbacks below are Module-to-Host internals, not Prototype props.

```ts
type DocumentRef = Readonly<{
  id: string;
  sourceRevision: string;
  modelSessionId: string;
}>;

type DocumentSurfaceRequirement = Readonly<{
  // Immutable for one connection; identity changes require reattachment.
  surfaceId: string;
  document: DocumentRef;
}>;

type DocumentUnavailableReason =
  | 'engine-unavailable'
  | 'document-unavailable'
  | 'service-unavailable'
  | 'input-unavailable'
  | 'accessibility-unavailable'
  | 'read-only-unenforced'
  | 'view-state-unavailable';

type DocumentCommandRejectReason = DocumentUnavailableReason | 'stale-policy' | 'stale-mutation';

type DocumentSurfaceSupport = Readonly<{
  input: 'available' | 'read-only' | 'unavailable';
  accessibility: 'host-text-provider' | 'bounded-range' | 'unavailable';
  viewState: 'available' | 'unavailable';
  reasons: readonly DocumentUnavailableReason[];
}>;

type DocumentSurfacePatch = Readonly<{
  readOnly: boolean;
  inputEnabled: boolean;
  policyRevision: number;
  savedContentVersion: string;
  loading: boolean;
  conflicted: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  shortcutPolicyId: string;
}>;

type DocumentSelectionSummary = Readonly<{
  mutationRevision: number;
  count: number;
  primaryCollapsed: boolean;
}>;

type DocumentSurfaceFacts =
  | Readonly<{
      attachment: 'detached' | 'attaching';
      appliedPolicyRevision: null;
      support: DocumentSurfaceSupport;
    }>
  | Readonly<{
      attachment: 'unavailable' | 'error';
      appliedPolicyRevision: number;
      support: DocumentSurfaceSupport;
      reason: DocumentUnavailableReason;
    }>
  | Readonly<{
      attachment: 'ready';
      appliedPolicyRevision: number;
      support: DocumentSurfaceSupport;
      composing: boolean;
      mutationRevision: number;
      contentVersion: string;
      canUndo: boolean;
      canRedo: boolean;
      selection: DocumentSelectionSummary;
    }>;

type DocumentTransactionSummary = Readonly<{
  transactionId: string;
  modelSessionId: string;
  documentId: string;
  sourceRevision: string;
  appliedPolicyRevision: number;
  beforeMutationRevision: number;
  afterMutationRevision: number;
  contentVersion: string;
  origin: 'user' | 'undo' | 'redo' | 'app';
  changeCount: number;
}>;

type DocumentCommandResult =
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'applied';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentVersion: string;
      reason: null;
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'rejected';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentVersion: string;
      reason: DocumentCommandRejectReason;
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'unavailable';
      appliedPolicyRevision: number;
      reason: DocumentUnavailableReason;
    }>;

type DocumentSurfaceConnection = Readonly<{
  // Issued and retired by the Module; callback closures reject retired identities.
  connectionId: string;
  requirement: DocumentSurfaceRequirement;
  patch: DocumentSurfacePatch;
  onFacts(connectionId: string, facts: DocumentSurfaceFacts): void;
  onTransaction(connectionId: string, summary: DocumentTransactionSummary): void;
  onCommandResult(connectionId: string, result: DocumentCommandResult): void;
}>;

type DocumentSurfaceLease = Readonly<{
  update(patch: DocumentSurfacePatch): void;
  requestCommand(
    request: Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      expectedPolicyRevision: number;
      expectedMutationRevision: number;
    }>
  ): void;
  snapshot(): DocumentSurfaceFacts;
  dispose(): void;
}>;

type DocumentSurfaceHost = Readonly<{
  attach(connection: DocumentSurfaceConnection): DocumentSurfaceLease;
}>;
```

A fake host receives private document/model services at construction. The immutable requirement carries only opaque IDs; `update()` accepts policy/status only. The Module issues a unique connection and retires its callback closure before replacement. A separate A11y fake projects name/description; a composed App control supplies help through existing description/relation semantics. The red-first exercise:

1. attach stable `surface-2` to `doc-7@r4/model-3`; receive attaching with null policy, then ready with numeric applied policy and explicit support;
2. emit `tx-1` once from the model dispatcher; two surface connections may observe it, but App lookup/persistence deduplicates `{ modelSessionId: 'model-3', transactionId: 'tx-1' }`;
3. update selection with count/collapsed/monotonic mutation revision; no raw range crosses;
4. request undo with expected policy/mutation revisions; reject after an intervening mutation, then accept a current request;
5. edit mutation 5 -> 6, save content version `v6`, edit to mutation 7/content `v7`, then undo to mutation 8/content `v6`; dirty becomes false while stale mutation-6 commands remain invalid;
6. revoke policy 9 and re-enable at 10; ready/unavailable/error facts and every transaction/result carry numeric applied revision; delayed revision-9 output rejects;
7. report unavailable with numeric applied policy and no engine-only fields; report detached/attaching with null policy only;
8. change surface/document/model identity only by retiring the connection and attaching a new immutable requirement; restore view state by `{ surfaceId, documentId }`;
9. return unavailable command result without mutation/content version; reject stale command with current mutation/content facts;
10. verify naming only through A11y, help through composition/relation, and keyboard escape through Focus/host behavior;
11. complete stale callbacks/colliding host counters; observe zero current state or App lookup;
12. prove no engine/model/range/target/worker/stream/file/full document/A11y duplicate/view state appears in portable values.

This proves a data-only boundary with monotonic mutation identity, content-equality identity, numeric terminal policy, model-scoped transaction deduplication, discriminated unavailability, immutable attachment identity, A11y/composition/Focus ownership, and service delivery. It does not prove browser/native behavior or an Adapter profile.

## Revision, input, shortcut, and permission policy

- **Revision and transaction ownership:** `sourceRevision` identifies persisted source; monotonic `mutationRevision` changes on every edit/undo/redo and prevents ABA command reuse; opaque `contentVersion` identifies content equality and may return to a saved value after undo. Model dispatcher IDs dedupe as `{ modelSessionId, transactionId }` across every view.
- **Save/conflict/dirty:** Save/Revert controls invoke App services with idempotency. A save patches `savedContentVersion`; the Module derives `dirty = currentContentVersion !== savedContentVersion`. Undo may make content clean without reusing mutation revision. Render/mount/sync/remount never saves.
- **IME:** candidate text/composition UI stays engine/host-owned. One committed composition produces an engine transaction summary. Enter, Tab, or local commands during composition must not emit a duplicate action.
- **Text versus command keys:** the engine owns text editing, cursor motion, undo/redo, indent/outdent, and editor-native commands. App/Harness commands run only through the host-configured command arbiter; no DOM/native key object or editor keybinding object enters portable authoring.
- **Shortcut order:** explicitly registered Harness commands such as Save or global navigation are checked before engine processing; all other keys reach the engine exactly once. The resolver is adapter configuration, not a portable callback.
- **Tab and escape ownership:** Tab indents/navigates in the editor by default. The Web host provides documented Tab-focus keyboard behavior (Monaco `tabFocusMode` is evidence, not API) and reserves `F6`/`Shift+F6` through Focus. Composition—not Adapter/Host Capability—supplies the adjacent named leave-editor Button and Focus topology. Host support reports only keyboard-route availability; composed acceptance fails if the Button/route is absent.
- **Clipboard/paste:** system/editor selection, copy/cut/paste, multi-line paste, and undo grouping remain engine/host behavior. The surface receives only resulting transaction summaries. Clipboard objects, selected text, and file paths gain no authority; pasted paths are plain text. Drop/file intake is separate.
- **Read-only/permission change:** App policy wins immediately before the next edit. Every host fact, transaction, and result carries `appliedPolicyRevision`; callbacks older than the current patch are rejected. On revocation, the host stops input, cancels active composition using host semantics, emits no user transaction at or after the newer revision, and preserves App source. If read-only cannot be enforced, the unavailable union branch reports it.
- **Mobile/virtual keyboard:** the physical editor may invoke host IME and touch editing chrome. If the host cannot preserve composition, selection, or an exit route, it reports interactive editing unavailable or read-only; it does not claim desktop parity.

## Accessibility boundary

- App supplies document name/description through A11y semantic-object facts. Help is an App-composed control related or described through existing A11y relations; this packet introduces no help fact. The Adapter projects A11y IR to the editor target; composition supplies status and Save/Revert. Editor patches duplicate none of these channels.
- The engine/Host Capability owns the editable text role/control type, caret and selection representation, line/word/document navigation, text ranges, wrapping, viewport mapping, and screen-reader editing mode. Proto UI does not mirror the whole document into an ARIA tree or generic State.
- `DocumentSelectionSummary` supports low-cost status/UI policy only; native accessibility APIs expose actual current ranges. A later portable line/column API requires position-encoding and replacement-validity rules.
- Streaming edit/caret events do not feed a live region. Announcements are bounded to App state transitions such as read-only enabled, save complete, conflict detected, or command rejected. Diagnostics/error navigation is option D and must not be smuggled into the first slice.
- Web evidence must cover accessible label/help, screen-reader mode, Tab-focus mode, composition, selection, read-only attempt, zoom/reflow, wrapping policy, high contrast, focus entry/exit, and no duplicate announcements.
- Native evidence may use UI Automation `TextPattern`/`TextPatternRange` or another platform equivalent. Sensitive document content exposed through accessibility is a Host/App privacy decision; unsupported/degraded projection is explicit.
- Large-document accessibility and range-query performance are option E. Same-Web WC/React/Vue results cannot establish native-host conformance.

## Performance, viewport, windowing, and lifecycle

- Full document text, model snapshots, token streams, syntax trees, decorations, and viewport lines do not enter generic Proto State. The engine/document service owns them.
- Transaction summaries cross once per view observation, while App lookup/persistence deduplicates the model-scoped `{ modelSessionId, transactionId }`; actual changes remain service-local.
- Editor viewport rendering/windowing is engine-owned. #521 applies to authored Collections, not editor internal lines/models. Exporting an immutable snapshot does not transfer live ownership.
- Raw geometry/view-state remains host-private. Restoration keys stable immutable `{ surfaceId, documentId }`; replaceable connection never keys restoration.
- One logical surface holds one immutable surface/document/model requirement plus one Module connection. Identity replacement retires the callback and lease before reattachment; `update()` cannot change identity.
- Pending edit/selection/command/save/validation/view-state completions carry current connection/model/document/source/mutation/content/policy/request identity. Old completions cannot update or trigger App lookup.
- Disposal removes input listeners, Focus bridge, layout observers, view subscriptions, A11y target projection, target refs, and callbacks. Shared model/dispatcher lifetime remains App service-owned.
- A view lease does not dispose an App/service-owned shared model unless it created that model and ownership is explicit. It never closes a file, stream, language server, or storage session. App/backend owns those lifetimes.
- Unsupported engine/document/service attachment, input, accessibility, view-state, or read-only enforcement fails closed to `unavailable`/read-only with a bounded per-feature reason; no fake ready state.

## Proposed entity and evidence graph

If a maintainer later accepts semantic admission, the smallest coherent graph is:

```text
C-TEXT-DOCUMENT-SURFACE-0001 (draft contract)
  <- satisfied by M-TEXT-DOCUMENT-SURFACE-0001
       -> requires HC-TEXT-DOCUMENT-SURFACE-0001
  <- verified by T-TEXT-DOCUMENT-SURFACE-0001

K-HOST-SURFACE-ROLES-0001
C-HOST-SURFACE-PROJECTION-0001
C-FOCUS-0001 / C-A11Y-0001
D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION (related seam, not replaced)
  <- referenced/depended on as applicable

A-REACT-18-19-0001
  -> may later support/provide the new Module/Host Capability only after
     reviewed Web evidence
```

No new Adapter identity is justified: existing profiles receive reviewed relations only after evidence. No public Prototype is justified by this research alone. Prototype identity/anatomy and editor chrome require a later admitted authoring slice. Text Control remains unchanged; the document selection contract is related but separate.

### Bounded red-first plan

1. **Portable negatives:** reject engine/model/target/range/worker/stream/file/framework/native event/raw geometry/full document/token/view-state/service values; reject identity fields from mutable updates.
2. **Fake lease:** immutable requirement attach, policy-only update, replacement reattach, exact cleanup, Module connection retirement, stale callback suppression.
3. **Revisions/transactions:** monotonic mutation versus content-equality version, model-scoped transaction dedupe across two views, exactly-once App persistence, save/undo dirty derivation, replay/source conflict, no save on lifecycle.
4. **Input/permissions/commands:** IME once, shortcut/editor routing, host keyboard route plus composition-owned Button/Focus topology, policy on terminal callbacks, revocation, expected mutation/policy preconditions, unavailable result without engine fields.
5. **Selection/availability/view identity:** ready-only engine fields, null policy only while detached/attaching, no selected text/range, coalescing, stable immutable view identity, line navigation deferred.
6. **Accessibility fake:** name/description only through A11y IR; help through App composition and existing relations; no duplicate help/name fields or live spam.
7. **Real Web:** engine double or selected engine only after separate approval; keyboard/IME/Tab/F6/focus, selection, undo/redo, read-only change, document/target replacement, accessibility tree/help, zoom/wrap/high contrast, and exact disposal.
8. **Performance:** rapid edits/caret movement and a bounded first-slice document prove no full-content/token/viewport copies through Proto UI and no retained listeners/models.
9. **Cross-adapter Web only if claimed:** WC/React/Vue from one authoring source remains Web evidence.
10. **Non-Web:** independent native profile with native input, selection, revision, accessibility, view replacement, and cleanup evidence before multi-host language.

## #513/#514 matrix consumption

PR #563 carries `internal/agent-harness/dogfood-coverage-matrix.md`, but it is not on `main`, is conflicting, and has an active `CHANGES_REQUESTED` review. This record must not copy that matrix or create a second source of truth.

After the matrix carrier lands, a follow-up #531 carrier must update exactly:

- `harness.future.editor-chrome`: replace pending ownership with the option-C recommendation; keep `research` until semantic admission, link this record, name the proposed `C-*` / `M-*` / `HC-*` / `T-*` checkpoint, distinguish Textarea/Code Block/static Diff fallbacks, and trigger re-review on admission outcome, selection position encoding, syntax/diagnostics, multi-document/large-document scope, or non-Web claims.
- `harness.future.editor-engine`: retain `infrastructure-exempt`; settle the exemption for model/content/edit/undo/selection/rendering/tokenization/view-state internals; state that engine selection, persistence/service binding, raw-model leakage, or capability expansion triggers re-review.
- Recompute totals only if a state changes. This recommendation keeps both current state counts unchanged.

#513 should receive the landed record/matrix-carrier link. #514 remains owner of the single matrix. Until that projection lands, #531 is advanced rather than closed.

## Acceptance mapping

- Textarea, Code Block, static Diff, App/backend, editor engine, Proto UI semantic owner, Host Capability/Adapter, and composition responsibilities are distinct.
- Options A-E are compared; C is the smallest proposed editor-specific slice and D/E are explicit deferrals.
- Document/source/engine revisions, transactions, input/shortcuts/IME/Tab, selection, accessibility, permission change, viewport/windowing, lifecycle, and cleanup are bounded.
- No raw editor, model, document/range/selection, host target, worker, stream, language service, or file object enters portable authoring.
- No third-party editor is treated as Proto UI-owned UI; its model/view/a11y implementation remains infrastructure.
- The conclusion is one `next proposal checkpoint`; no materially different viable owner remains unresolved in this packet.
- The exact #513/#514 rows and re-review triggers are identified; their authoritative projection remains the next carrier after PR #563.

## Residual risks and smallest human decision

Residual risks: transaction IDs require a robust App-owned service contract; revision and replacement races can lose or duplicate edits; Unicode position encoding is intentionally deferred; screen-reader editor behavior varies; permission revocation during composition can discard a candidate; view-state/model ownership differs across engines; sensitive document content may be exposed through platform accessibility; selected engines may not support the required separation.

Smallest later human decision: accept or reject admission of the proposed `C-TEXT-DOCUMENT-SURFACE-0001` / `M-TEXT-DOCUMENT-SURFACE-0001` / `HC-TEXT-DOCUMENT-SURFACE-0001` / `T-TEXT-DOCUMENT-SURFACE-0001` graph for option C with the exclusions above. Acceptance authorizes a separate spec proposal, not an engine choice, Prototype, or implementation. Rejection leaves option A plus private editor infrastructure and ordinary Proto UI chrome.
