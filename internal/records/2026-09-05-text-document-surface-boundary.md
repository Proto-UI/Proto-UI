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

- App input: `document: { id: string; sourceRevision: string }`, `readOnly`, `inputEnabled`, monotonic policy revision, loading/conflicted/error status, accessible label/description/help, and a host-configured shortcut-policy identifier.
- Host/Module facts: `attachment`, `composing`, `editRevision`, `savedSourceRevision`, `dirty`, `canUndo`, `canRedo`, bounded per-feature support/reasons, and a revision-bound selection summary. Focused state is reported only through the Focus domain. Connection freshness is owned by the Module, not reported as a host epoch.
- Engine event summary: opaque `transactionId`, `documentId`, `sourceRevision`, prior/new engine revision, origin (`user | undo | redo | app`), and change count. The actual change set remains in the App-owned editor service addressed exactly once by that transaction ID.
- Engine requests/results: undo/redo, reveal line, replace document reference, and explicit snapshot/export by the App-owned service. Focus/blur requests remain in Focus. Save/revert remain App actions, not editor-engine authority.

The first slice's selection summary is intentionally bounded to `{ count, primaryCollapsed }` plus the current engine revision. No raw range, selected text, mutable selection, pixel rectangle, or ungoverned line/column encoding crosses. A later line/column or range API needs an explicit Unicode position encoding and revision semantics.

This resolves the seam with `D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION` without closing it: plain Text Control selection remains that decision's open question. Revision-bound document selection is a different future contract and must not be retrofitted into `TextControlHandle`. Neither surface gains `selectAll`, `setSelection`, or `replaceSelection` in this first slice.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Document identity/revision | App -> Text Document Module patch -> Host Capability resolver | Correct engine model/view appears for that reference. | Current document ID, source revision, and Module-owned connection identity. |
| Source content | App-owned document service -> engine directly | Engine renders/editable text. | Service/model boundary; no full text copy through generic Proto State. |
| IME/text/key input | Physical editor target -> engine | Engine applies one transaction; host emits a bounded summary and the App service resolves its exact changes once. | Current policy revision, composition boundary, document ID, and connection identity. |
| Edit details | Engine -> App-owned editor service | App may validate/persist the exact change set by `transactionId`. | Document, source/engine revision, connection identity, and exactly-once transaction ID; stale/replayed IDs reject. |
| Save/Revert | Proto UI Button -> App service | Saved/conflicted/reverted App state; surface receives a new source revision or replacement reference. | App idempotency key plus document/source revision. |
| Undo/Redo | App/semantic command -> Module request -> Host Capability -> engine | Engine transaction and updated availability facts. | Current engine revision and connection identity. |
| Selection/caret | Engine | Engine/native accessibility exposes ranges; Proto receives only count/collapsed summary. | Current engine revision and connection identity; stale selection facts ignore. |
| Focus/Tab escape | Focus domain / host keyboard arbiter -> physical editor or Harness region | Exactly one focus destination; facts return only through Focus and mode is announced/helped. | Current Focus/view epoch and configured local shortcut policy. |
| Viewport/layout | Host geometry -> engine | Engine renders/reflows and stores host-private view state. | Current target/model; no raw pixels or view state in portable values. |
| Diagnostics/decorations | App language service -> engine/composition in a later slice | Deferred. | No first-slice channel. |

## Fake-engine / fake-host protocol sketch

Callbacks below are Module-to-Host internals, not Prototype props.

```ts
type DocumentRef = Readonly<{ id: string; sourceRevision: string }>;

type DocumentUnavailableReason =
  | 'engine-unavailable'
  | 'document-unavailable'
  | 'service-unavailable'
  | 'input-unavailable'
  | 'accessibility-unavailable'
  | 'read-only-unenforced'
  | 'view-state-unavailable';

type DocumentSurfaceSupport = Readonly<{
  input: 'available' | 'read-only' | 'unavailable';
  accessibility: 'host-text-provider' | 'bounded-range' | 'unavailable';
  viewState: 'available' | 'unavailable';
  reasons: readonly DocumentUnavailableReason[];
}>;

type DocumentSurfacePatch = Readonly<{
  document: DocumentRef;
  readOnly: boolean;
  inputEnabled: boolean;
  policyRevision: number;
  loading: boolean;
  conflicted: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  shortcutPolicyId: string;
  accessibleLabel: string;
  accessibleDescription?: string;
  accessibilityHelpId: string;
}>;

type DocumentSelectionSummary = Readonly<{
  engineRevision: number;
  count: number;
  primaryCollapsed: boolean;
}>;

type DocumentSurfaceFacts = Readonly<{
  attachment: 'detached' | 'attaching' | 'ready' | 'unavailable' | 'error';
  composing: boolean;
  engineRevision: number;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  support: DocumentSurfaceSupport;
  selection: DocumentSelectionSummary;
}>;

type DocumentTransactionSummary = Readonly<{
  transactionId: string;
  documentId: string;
  sourceRevision: string;
  beforeEngineRevision: number;
  afterEngineRevision: number;
  origin: 'user' | 'undo' | 'redo' | 'app';
  changeCount: number;
}>;

type DocumentSurfaceConnection = Readonly<{
  // Issued and retired by the Module; callback closures reject retired identities.
  connectionId: string;
  patch: DocumentSurfacePatch;
  onFacts(connectionId: string, facts: DocumentSurfaceFacts): void;
  onTransaction(connectionId: string, summary: DocumentTransactionSummary): void;
  onCommandResult(
    connectionId: string,
    result: Readonly<{
      requestId: string;
      command: 'undo' | 'redo' | 'reveal-line';
      status: 'applied' | 'rejected' | 'unavailable';
      engineRevision: number;
      reason: DocumentUnavailableReason | null;
    }>
  ): void;
}>;

type DocumentSurfaceLease = Readonly<{
  update(patch: DocumentSurfacePatch): void;
  requestCommand(
    request: Readonly<{
      requestId: string;
      command: 'undo' | 'redo' | 'reveal-line';
      line?: number;
    }>
  ): void;
  snapshot(): DocumentSurfaceFacts;
  dispose(): void;
}>;

type DocumentSurfaceHost = Readonly<{
  attach(connection: DocumentSurfaceConnection): DocumentSurfaceLease;
}>;
```

A fake host receives a private document-service/engine map at construction. `DocumentSurfacePatch` contains only IDs and status/policy values. The Module issues a unique connection identity and retires its callback closure before replacement. The red-first exercise:

1. attach `{ id: 'doc-7', sourceRevision: 'r4' }`; receive `attaching`, then clean `ready` facts with explicit input/accessibility/view-state support and accessible label/description/help;
2. simulate one IME-committed engine transaction and expose only `tx-1`, document/source/engine revisions, origin, and count; verify the App service resolves the transaction's inserted text/ranges exactly once and portable State retains none of them;
3. update selection from collapsed to one range; receive only count/collapsed/revision;
4. request undo and observe a connection- and revision-bound transaction plus command result;
5. revoke write permission at policy revision 9 during composition; cancel host composition, suppress all post-revocation user transactions, and report read-only facts without mutating App source;
6. simulate unavailable engine/document/service/input/accessibility/read-only enforcement/view state and assert the bounded support/reason codes identify each failed requirement;
7. replace the document and target; retire the Module-owned connection identity and dispose old bindings before issuing the new connection; restore only host-private view state keyed by document/view identity;
8. complete stale edit/save/selection callbacks from the old document or a colliding host counter; observe zero current-state updates and zero App-service transaction lookups;
9. recursively validate all captured patch/fact/request/summary values and prove no engine, model, range, selection, target, worker, stream, file handle, full document, or view-state object appears.

This proves a data-only boundary with testable revision, accessibility-input, unavailability, connection-identity, and service-delivery rules. It does not prove browser/native IME, model correctness, accessibility, layout, large-document performance, or an Adapter profile.

## Revision, input, shortcut, and permission policy

- **Revision ownership:** App `sourceRevision` identifies the persisted/authoritative source. Engine `engineRevision` is a monotonic view/model fact scoped to one document lease. They are never compared as interchangeable values. Transactions carry both identity context and are accepted once by opaque `transactionId`.
- **Save/conflict:** Save/Revert controls are ordinary Proto UI controls invoking App services. The App checks document/source/engine revision and idempotency, then patches saved/conflicted state. Render, mount, prop sync, or engine remount never saves.
- **IME:** candidate text/composition UI stays engine/host-owned. One committed composition produces an engine transaction summary. Enter, Tab, or local commands during composition must not emit a duplicate action.
- **Text versus command keys:** the engine owns text editing, cursor motion, undo/redo, indent/outdent, and editor-native commands. App/Harness commands run only through the host-configured command arbiter; no DOM/native key object or editor keybinding object enters portable authoring.
- **Shortcut order:** explicitly registered Harness commands such as Save or global navigation are checked before engine processing; all other keys reach the engine exactly once. The resolver is adapter configuration, not a portable callback.
- **Tab:** Tab indents/navigates within the editor by default. The Web profile must provide a documented Tab-focus mode (Monaco's `tabFocusMode` is evidence, not the portable API), reserve `F6`/`Shift+F6` for next/previous Harness regions, and place an adjacent named Button that leaves the editor. A host without a keyboard escape plus reachable visible control reports the interactive slice unavailable.
- **Clipboard/paste:** system/editor selection, copy/cut/paste, multi-line paste, and undo grouping remain engine/host behavior. The surface receives only resulting transaction summaries. Clipboard objects, selected text, and file paths gain no authority; pasted paths are plain text. Drop/file intake is separate.
- **Read-only/permission change:** App policy wins immediately before the next edit. On revocation, the host stops input, cancels active composition using host semantics, emits no user transaction at or after the newer `policyRevision`, and preserves App source. Re-enabling creates no implicit edit. A stale save or edit result cannot clear `conflicted` or `readOnly`. If read-only cannot be enforced, the surface fails closed as unavailable.
- **Mobile/virtual keyboard:** the physical editor may invoke host IME and touch editing chrome. If the host cannot preserve composition, selection, or an exit route, it reports interactive editing unavailable or read-only; it does not claim desktop parity.

## Accessibility boundary

- App supplies the document label/description, read-only/dirty/conflict/loading status, and help route. The composition supplies reachable status and explicit Save/Revert controls.
- The engine/Host Capability owns the editable text role/control type, caret and selection representation, line/word/document navigation, text ranges, wrapping, viewport mapping, and screen-reader editing mode. Proto UI does not mirror the whole document into an ARIA tree or generic State.
- `DocumentSelectionSummary` supports low-cost status/UI policy only; native accessibility APIs expose actual current ranges. A later portable line/column API requires position-encoding and replacement-validity rules.
- Streaming edit/caret events do not feed a live region. Announcements are bounded to App state transitions such as read-only enabled, save complete, conflict detected, or command rejected. Diagnostics/error navigation is option D and must not be smuggled into the first slice.
- Web evidence must cover accessible label/help, screen-reader mode, Tab-focus mode, composition, selection, read-only attempt, zoom/reflow, wrapping policy, high contrast, focus entry/exit, and no duplicate announcements.
- Native evidence may use UI Automation `TextPattern`/`TextPatternRange` or another platform equivalent. Sensitive document content exposed through accessibility is a Host/App privacy decision; unsupported/degraded projection is explicit.
- Large-document accessibility and range-query performance are option E. Same-Web WC/React/Vue results cannot establish native-host conformance.

## Performance, viewport, windowing, and lifecycle

- Full document text, model snapshots, token streams, syntax trees, decorations, and viewport lines do not enter generic Proto State. The engine/document service owns them.
- Transaction summaries cross once per engine transaction; cursor/selection facts are deduplicated and coalesced while preserving the newest engine revision. The actual changes remain service-local by transaction ID.
- Editor viewport rendering/windowing is engine-owned. #521 applies to authored logical Collections such as a file tree, diagnostics list, or static diff rows, not the editor's internal line renderer/model. Exporting an immutable snapshot to Code Block/static Diff does not transfer live editor ownership.
- Raw layout geometry and serializable engine view-state structures remain host-private. The host may persist view state in its injected service keyed by App-provided document/view IDs; portable state receives only success/unavailable and current revision facts.
- One logical surface holds one Module-owned connection identity for the current document lease. Document/reference replacement, model replacement, target replacement, Adapter capability replacement, detach, remount, and disposal retire the callback closure before another attachment reports facts; host counters never decide freshness.
- Pending edit, selection, undo/redo, snapshot, save, validation, language-service, and view-state completions carry the current connection identity plus document ID, source/engine/policy revision, and request ID as applicable. Old completions cannot update current state or trigger an App-service lookup.
- `dispose()` removes key/composition/paste listeners, the Focus-domain target bridge, layout observers, engine/model subscriptions owned by the view, accessibility bridge resources, target/controller references, and service callbacks.
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

1. **Portable negatives:** type/runtime fixtures reject engine, model, target, range/selection, worker, stream, file handle, framework component, DOM/native event, raw geometry, complete document, token/decorations, engine view-state, and service values.
2. **Fake lease:** attach/update/snapshot/dispose, missing capability, document/model/target replacement, remount, exact cleanup, Module-owned connection retirement, and stale-callback suppression even when host counters collide.
3. **Revision/transactions:** opaque IDs, document/source/engine/policy revisions, exactly-once App-service transaction lookup, undo/redo origin, replay rejection, source-revision conflict, and no save on render/remount.
4. **Input/permissions:** IME commits once, local shortcut versus editor command routes once, Tab mode/F6 exits through Focus, multiline paste groups correctly, permission revocation suppresses later input, failed enforcement reports unavailable, and re-enable is inert.
5. **Selection:** only count/collapsed/revision crosses; high-frequency cursor motion coalesces; no selected text/range; stale selection ignored.
6. **Accessibility fake:** label/description/help/status inputs, read-only/conflict transitions, per-feature support/reason negotiation, no document mirror/live spam, and explicit unavailable degradation.
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
