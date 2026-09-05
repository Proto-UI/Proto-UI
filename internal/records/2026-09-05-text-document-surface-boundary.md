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
| Editor-engine infrastructure | Mutable text model; edit application; composition; selection/cursors; undo/redo; tokenization; decorations; folding; find; viewport rendering/physics/internal line windowing; view state; native text ranges/caret implementation. | Host-local target plus model/backend services injected outside portable authoring. | Engine/model/view/controller/worker, mutable ranges, DOM/native target, semantic role, logical Focus/Scroll ownership, framework component, host view-state object. |
| Proto UI Text Document semantic owner | One logical surface identity; composite document/model-session/source/content/mutation identity; lease epoch; attachment/read-only/input-enabled facts; commit-stamped transaction authorization context; revision-bound transaction observations; bounded composition/selection availability; engine-command correlation; stale UI rejection. It consumes Focus identity/view epoch and resolved Scroll facts/requests rather than owning them. | Immutable references, status facts, summaries, and requests. | Full document, raw changes/models, focus facts, Scroll support/geometry/physics, tokenizer/diagnostic objects, raw events, persistence authority, engine undo data. |
| Text Document Host Capability | Resolve model by composite `{ documentId, modelSessionId }`, underlying App document service by `documentId`, and current target/view from host configuration; attach engine; bridge IME/keyboard; stamp initiating view/policy context at commit; expose targets/controllers to Focus/Scroll/A11y integration; apply read-only policy; emit bounded view facts; preserve view state; clean up. | Static requirement and mutable patch plus adapter-injected resolvers keyed by opaque IDs. | No target/model/editor/range/selection/file/stream/worker/callback source returned to portable authoring; no semantic focus, role, or logical Scroll support ownership. |
| Adapter profile | Materialize boundary/surface/input/a11y targets; wire capability; translate lifecycle and Focus participation. | Governed Module requirement only after admission. | No semantic reinterpretation and no support/provision relation before profile evidence. |
| Composition/design language | Tabs/breadcrumbs, toolbar, filename/revision/status, dirty/conflict badge, explicit Save/Revert, find controls if later admitted, diagnostics list if later admitted. | App facts and ordinary Proto UI control events. | Document storage/model, edit transactions, undo stack, language/diagnostic truth, direct engine action during render. |
| Base Textarea | Small unrevisioned multiline plain-text value protocol. | Value/property facts and normalized input/IME. | Document identity/revision, transactions, engine model, multi-cursor, workbench. |
| Code Block | Structural presentation of App-authored code/log content. | Authored text/tokens and ordinary child controls. | Editing, selection, Clipboard, document history, language services. |
| Static Diff Review | App-local immutable change presentation and explicit review actions. | App-computed diff/revision labels. | Edit model, patch application, persistence, conflict resolution. |

The engine can remain completely outside Proto UI. Host configuration resolves the model by the composite opaque key `{ documentId, modelSessionId }` and the underlying App document service by `documentId`; neither member is assumed globally unique by itself, and no engine or document object crosses portable authoring.

## Portable facts, requests, and information paths

### Candidate first-slice values

Names below illustrate a proposal; they are not an admitted API:

- App input: immutable stable `surfaceId` plus `document: { documentId, modelSessionId }`; the composite pair is the model key, and the model-session service owns source/saved content. Mutable resolved `editingMode: interactive | read-only | disabled` and status policy crosses per view. Role/name/description remain A11y; help is composition/relation.
- Host facts: discriminated attachment; post-attachment policy/facts revisions; ready source/mutation plus `contentIdentity`/`savedContentIdentity`; independent composition/selection/input/keyboard/A11y/view support. Module derives dirty solely as identity inequality. Focus/Scroll remain owners.
- Transaction summary includes composite model key, Module-issued `deliveryEpoch`/strict `deliverySequence`, transaction ID, source/mutation/equality identity, Host-stamped origin, disposition/count, no observer freshness. Dispatcher retains a private exact engine edit batch or immutable snapshot locator under that delivery key until terminal acknowledgement; App never resolves current later model for an earlier transaction. One in-flight preserves order; retry retains same record; rejection reconciles.
- Engine commands have applied/no-op/rejected/unavailable. Pre-policy null. Save/Revert are model barriers: Save waits active IME to end and includes its commit; Revert cancels/epochs it so late commit cannot enter dispatcher.

`contentIdentity` is an opaque model-service equality token, not a monotonic engine version: within one composite model session, equal full document contents MUST yield the same token and unequal contents MUST yield different tokens. `savedContentIdentity` is the token of the current saved source. Mutation revision still increases on every edit/undo/replacement, so edit then undo to byte-for-byte saved text produces a newer mutation revision but restores `contentIdentity === savedContentIdentity` and dirty false. The engine/model service computes the token without copying full content through Proto UI.

The first slice's selection summary is intentionally bounded to `{ count, primaryCollapsed }` plus the current monotonic mutation revision. No raw range, selected text, mutable selection, pixel rectangle, or ungoverned line/column encoding crosses. A later line/column or range API needs an explicit Unicode position encoding and revision semantics.

This resolves the seam with `D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION` without closing it: plain Text Control selection remains that decision's open question. Revision-bound document selection is a different future contract and must not be retrofitted into `TextControlHandle`. Neither surface gains `selectAll`, `setSelection`, or `replaceSelection` in this first slice.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Document/model identity | App -> immutable Text Document requirement -> Host Capability resolver | Correct shared/private model and view appear even when different documents reuse a locally scoped session ID. | Resolve model by composite `{ documentId, modelSessionId }`; use `documentId` alone only for the underlying App document service. |
| Source content/revision | App model-session service -> engine/model dispatcher | Engine renders text and all attached views observe one current persisted base. | Composite document/model session owns source revision and changes once for all its views. |
| IME/text/key input | Host view bridge -> serial dispatcher/private record store | Bridge stamps origin and captures exact transaction payload/snapshot locator at commit before shared model advances; retained by key until accepted/rejected. Queue capacity is bounded; admission pauses before another commit when full. | Composition epoch, delivery epoch/sequence, exact private record, mutation/equality chain; none raw crosses Proto. |
| Edit details | Dispatcher -> App ack | Track current epoch + scalar acknowledgedThrough + sole in-flight; no growing completed ledger. Same/older sequence is duplicate ignored; retired epoch ignored; future/unknown current sequence or current sequence/wrong ID reconciles. Retryable retains exact record/key and explicit retry. | `{documentId, modelSessionId, deliveryEpoch, deliverySequence, transactionId}`; stored exact payload, summary head. |
| Save/Revert | Model barrier -> Host composition settlement -> dispatcher/App | Save closes new admission but lets current composition explicitly end; committed candidate is captured/enqueued before drain, canceled candidate contributes nothing. Revert cancels composition, advances composition epoch, waits cancellation ack, rejects late old commit, then replaces/rebases. | Save never drops/late-commits IME; Revert never resurrects it. Both wait retryable queue. |
| Undo/Redo | Host -> engine | Applied/no-op/rejected/unavailable. Reconciliation and Revert clear undo/redo; Save preserves it. | After rejection/reset `canUndo/canRedo=false`; attempts cannot reach discarded content. |
| Selection/caret | Engine | Native accessibility exposes ranges; when supported, Proto receives only count/collapsed summary; unsupported summary is explicit and carries no selection fact. | Monotonic facts and selection revisions within connection/policy; engine selection remains usable independently. |
| Focus/Tab escape | Host arbiter: active/conservative IME -> required Focus exit route -> ordinary Harness shortcut -> editor | Exactly one focus destination; at least one policy-verified exit key/chord cannot be captured by Harness/editor; facts return only through Focus. | `DocumentKeyboardRouteSupport.shortcutPolicyId` equals applied patch policy; route recomputed on every shortcut-policy update, plus Focus identity/view epoch. |
| Accessible role/naming | A11y semantic object -> HC-A11Y/Adapter -> editor target | One role/name/description projection; App help control uses existing relations. | A11y identity and target replacement; engine supplies native implementation, not role truth. |
| Viewport/scroll | Text Document registers one logical Scroll surface; M-SCROLL/HC-SCROLL-SURFACE map requests/facts to editor controller | Portable logical scroll facts/requests; engine retains physics/rendering/internal line windowing. | Scroll view epoch plus host-local geometry/controller; no raw view state. |
| Diagnostics/decorations | App language service -> later engine/composition slice | Deferred. | No first-slice channel. |

## Fake-engine / fake-host protocol sketch

Callbacks below are Module-to-Host internals, not Prototype props.

```ts
type DocumentRef = Readonly<{
  // Collision-free only as a pair; neither member is globally unique alone.
  documentId: string;
  modelSessionId: string;
}>;

type DocumentSurfaceRequirement = Readonly<{
  // Immutable for one connection; identity changes require reattachment.
  surfaceId: string;
  document: DocumentRef;
}>;

type DocumentAttachmentFailure =
  | 'engine-unavailable'
  | 'document-unavailable'
  | 'service-unavailable'
  | 'read-only-unenforced';
type DocumentCommandRejectReason = 'stale-policy' | 'stale-mutation' | 'policy-denied';
type DocumentCommandRuntimeUnavailableReason =
  | 'engine-unavailable'
  | 'document-unavailable'
  | 'service-unavailable';
type DocumentCommandUnavailableReason =
  | 'policy-not-applied'
  | DocumentCommandRuntimeUnavailableReason;

type DocumentSelectionSummary = Readonly<{
  selectionRevision: number;
  mutationRevision: number;
  count: number;
  primaryCollapsed: boolean;
}>;
type DocumentCompositionSupport =
  | Readonly<{
      reporting: 'available';
      compositionEpoch: number;
      composing: boolean;
      arbitration: 'ime-first';
      reason: null;
    }>
  | Readonly<{
      reporting: 'unavailable';
      compositionEpoch: number;
      composing: null;
      arbitration: 'conservative-ime-first';
      reason: 'composition-unavailable';
    }>;

type DocumentSelectionSupport =
  | Readonly<{ availability: 'available'; summary: DocumentSelectionSummary; reason: null }>
  | Readonly<{
      availability: 'unavailable';
      summary: null;
      reason: 'selection-unavailable';
    }>;

type DocumentTransactionOriginSupport =
  | Readonly<{ availability: 'commit-stamped'; reason: null }>
  | Readonly<{
      availability: 'unavailable';
      reason: 'transaction-origin-unavailable';
    }>;

type DocumentKeyboardRouteSupport =
  | Readonly<{
      availability: 'available';
      shortcutPolicyId: string;
      reservedExit: 'Tab' | 'F6' | 'Shift+F6';
      reason: null;
    }>
  | Readonly<{
      availability: 'unavailable';
      shortcutPolicyId: string;
      reservedExit: null;
      reason: 'keyboard-route-unavailable';
    }>;

type DocumentAccessibilitySupport =
  | Readonly<{ availability: 'host-text-provider' | 'bounded-range'; reason: null }>
  | Readonly<{
      availability: 'unavailable';
      reason: 'accessibility-unavailable';
    }>;

type DocumentViewStateSupport =
  | Readonly<{ availability: 'available'; reason: null }>
  | Readonly<{ availability: 'unavailable'; reason: 'view-state-unavailable' }>;

type DocumentSurfaceSupport = Readonly<{
  input: DocumentInputSupport;
  composition: DocumentCompositionSupport;
  selection: DocumentSelectionSupport;
  transactionOrigin: DocumentTransactionOriginSupport;
  keyboardRoute: DocumentKeyboardRouteSupport;
  accessibility: DocumentAccessibilitySupport;
  viewState: DocumentViewStateSupport;
}>;

type DocumentSurfacePatch = Readonly<{
  editingMode: 'interactive' | 'read-only' | 'disabled';
  // Every accepted update is strictly greater than the previous revision.
  policyRevision: number;
  conflicted: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  shortcutPolicyId: string;
}>;

type DocumentSurfaceFacts =
  | Readonly<{
      attachment: 'detached' | 'attaching';
      appliedPolicyRevision: null;
      factsRevision: number;
    }>
  | Readonly<{
      attachment: 'unavailable';
      appliedPolicyRevision: null;
      factsRevision: number;
      reason: 'engine-unavailable' | 'document-unavailable' | 'service-unavailable';
    }>
  | Readonly<{
      attachment: 'unavailable' | 'error';
      appliedPolicyRevision: number;
      factsRevision: number;
      support: DocumentSurfaceSupport;
      reason: DocumentAttachmentFailure;
    }>
  | Readonly<{
      attachment: 'ready';
      appliedPolicyRevision: number;
      factsRevision: number;
      support: DocumentSurfaceSupport;
      sourceRevision: string;
      savedContentIdentity: string;
      mutationRevision: number;
      contentIdentity: string;
      canUndo: boolean;
      canRedo: boolean;
    }>;

type DocumentDeliveryKey = DocumentRef &
  Readonly<{
    deliveryEpoch: number;
    deliverySequence: number;
    transactionId: string;
  }>;

type DocumentTransactionBase = DocumentDeliveryKey &
  Readonly<{
    sourceRevision: string;
    beforeMutationRevision: number;
    afterMutationRevision: number;
    contentIdentity: string;
    changeCount: number;
  }>;

type DocumentViewTransactionOrigin = Readonly<{
  kind: 'user' | 'undo' | 'redo';
  surfaceId: string;
  connectionId: string;
  committedPolicyRevision: number;
  editingMode: 'interactive';
}>;

type DocumentTransactionSummary =
  | (DocumentTransactionBase &
      Readonly<{
        origin: DocumentViewTransactionOrigin;
        disposition: 'persist';
      }>)
  | (DocumentTransactionBase &
      Readonly<{
        origin: Readonly<{ kind: 'app' }>;
        disposition: 'observe-only';
      }>);

type DocumentTransactionObservation = Readonly<{
  observerAppliedPolicyRevision: number;
  observerFactsRevision: number;
  summary: DocumentTransactionSummary;
}>;

// App-service acknowledgement consumed by the composite-key serial dispatcher;
// raw retained transaction content and reconciliation content never cross authoring.
type DocumentTransactionAck = DocumentDeliveryKey &
  (
    | Readonly<{
        status: 'accepted';
        reason: null;
      }>
    | Readonly<{
        status: 'retryable';
        reason: 'service-unavailable';
      }>
    | Readonly<{
        status: 'rejected';
        reason: 'authorization-revoked' | 'source-conflict';
        reconciliationId: string;
        authoritativeSourceRevision: string;
        authoritativeSavedContentIdentity: string;
      }>
  );

type DocumentCommandResult =
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'applied';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentIdentity: string;
      reason: null;
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'no-op';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentIdentity: string;
      reason: 'history-empty';
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'rejected';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentIdentity: string;
      reason: DocumentCommandRejectReason;
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'unavailable';
      appliedPolicyRevision: null;
      reason: 'policy-not-applied';
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      status: 'unavailable';
      appliedPolicyRevision: number;
      reason: DocumentCommandRuntimeUnavailableReason;
    }>;

type DocumentCommandRequest =
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      expectedPolicyRevision: null;
      expectedMutationRevision: null;
    }>
  | Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      expectedPolicyRevision: number;
      expectedMutationRevision: number;
    }>;

type DocumentSurfaceConnection = Readonly<{
  // Issued and retired by the Module; callback closures reject retired identities.
  connectionId: string;
  requirement: DocumentSurfaceRequirement;
  patch: DocumentSurfacePatch;
  onFacts(connectionId: string, facts: DocumentSurfaceFacts): void;
  // The initiating Host bridge supplies an already commit-stamped summary.
  onTransactionObserved(connectionId: string, observation: DocumentTransactionObservation): void;
  onCommandResult(connectionId: string, result: DocumentCommandResult): void;
}>;

type DocumentSurfaceLease = Readonly<{
  update(patch: DocumentSurfacePatch): void;
  requestCommand(request: DocumentCommandRequest): void;
  snapshot(): DocumentSurfaceFacts;
  dispose(options: Readonly<{ viewState: 'retain-for-surface' | 'evict-surface' }>): void;
}>;

type DocumentSurfaceHost = Readonly<{
  attach(connection: DocumentSurfaceConnection): DocumentSurfaceLease;
}>;
```

1. attach composite models; versioned pending facts/null command;
2. set deliveryEpoch 7, commit tx1 sequence1 then tx2 sequence2 while tx1 pending. Private store retains exact tx1 edit batch/snapshot locator and tx2 record, so App delivery of tx1 cannot accidentally include tx2 current-model state;
3. accept tx1 with exact key; release only tx1 private record, deliver tx2. Duplicate sequence1 after acknowledgedThrough=1 is ignored before mismatch without ID set. Ack old epoch6 ignored. Ack epoch7 future seq4 or seq2 with wrong ID triggers reconciliation;
4. tx2 retryable service failure retains exact key/private payload/head, blocks tx3/Save, explicit ready signal redelivers identical record; App idempotency handles ambiguity; accept then continue. Fill bounded private queue and prove input admission pauses before unretained commit, resumes after release;
5. reject authorization/source with tx2/dependents locally committed: all views noninteractive, dependent delivery/private records discarded, authoritative model replacement, delivery epoch rotates to8/sequence resets, mutation above discarded, undo/redo history fully cleared and facts false. Undo/redo returns history-empty and cannot resurrect rejected content;
6. active IME then Save: barrier closes new non-composition admission but defers full lock until composition end. Commit path captures candidate transaction before barrier drain/save; cancel path saves prior content. No composition callback crosses saved source after barrier;
7. active IME then Revert: Host cancels, increments composition epoch, waits ack, old epoch late commit rejected before transaction record; Revert replaces content, clears undo/redo, rebases delivery epoch/head, next edit chains;
8. content equality edit->undo saved clean/newer mutation; redo dirty;
9. Save with tx queue/retry drains exact records, persists identity, rebases source/saved head and immediate edit uses new source; rejected pending reconciles then retry;
10. sibling/detach UI no durable effect; support degradation, selection, modes, origin, IME->Focus->Harness route, empty commands;
11. view retain/evict; A11y/Focus/Scroll cleanup; stale UI cannot affect queue;
12. no raw content/edit batch/snapshot locator/engine/target/reconciliation crosses authoring.

This proves exact private payload retention, bounded queue admission, scalar epoch/high-watermark duplicate handling, retry, rejected-history clearing, Save composition deferral, Revert composition cancellation/epoch suppression, content equality, fact/order/barrier/head/lifecycle ownership. It does not prove real host behavior.

## Revision, input, shortcut, and permission policy

- **Delivery identity/order/storage:** each persistable tx gets Module-issued monotonic deliveryEpoch and contiguous sequence plus ID. Dispatcher stores exact private engine edit batch or immutable snapshot locator—not current model—until terminal ack. One in-flight; bounded queue pauses input before accepting an edit it cannot retain. Accepted releases record/advances; retryable retains/redelivers exact key/record only on signal; rejection drops dependent records and reconciles.
- **Bounded duplicate state:** dispatcher stores current epoch, scalar acknowledgedThrough, sole in-flight key—not every completed ID. Current sequence <= watermark is harmless duplicate; retired epoch ignored. Future current sequence or in-flight sequence with wrong ID is protocol mismatch. Reconciliation/Revert rotates monotonic epoch/resets sequence+watermark; Save retains epoch. Model-session disposal drops scalars/store after terminal settlement. App idempotency uses full delivery key.
- **Rejected history:** authoritative reconciliation clears engine undo/redo completely (not optional rebase), publishes canUndo/canRedo false at fresh revision, and verifies commands no-op; rejected/dependent content cannot re-enter via history. Revert also clears; Save preserves history.
- **Save/Revert + composition:** Save admission barrier lets already-active IME finish explicitly before full lock; committed candidate becomes retained transaction before drain, canceled contributes none. Revert explicitly cancels active composition, advances Host composition epoch, awaits cancellation, rejects late old-epoch commit, then replaces/clears history/rebases delivery. Both wait retryable delivery.
- **Equality/dirty:** stable content/saved identities; mutation monotonic; undo-to-saved clean.
- **Command/input order:** pre-policy null; empty no-op; IME->Focus exit->Harness->editor; exact support.
- **Lifecycle/system:** view freshness separate; Scroll/A11y/Focus owners; private transaction payload never Proto value.

## Accessibility boundary

- App supplies editor role/name/description through A11y semantic-object facts. Help is App composition through existing relations; no help fact. Adapter projects A11y IR; engine/Host Capability supplies native editable control, text ranges, caret behavior, wrapping, and screen-reader editing mechanics without second role ownership.
- `DocumentSelectionSummary` supports low-cost status only; native accessibility exposes ranges. Later line/column API needs encoding/replacement rules.
- Streaming edit/caret does not feed live region. Announcements are bounded to read-only/save/conflict/rejection. Diagnostics is option D.
- Web evidence covers A11y role/name/description/help relation, screen-reader mode, Tab-focus, composition, selection, read-only, Scroll integration, zoom/wrap/high contrast, focus entry/exit, and no duplicates.
- Native evidence may use UIA TextPattern or equivalent; sensitive content projection is App/Host privacy. Degradation explicit.
- Large-document accessibility and range-query performance are option E. Same-Web WC/React/Vue results cannot establish native-host conformance.

## Performance, viewport, windowing, and lifecycle

- Full document/model/token/private edit batch/snapshot locator never enters Proto; equality/delivery IDs bounded.
- Dispatcher state is bounded scalar epoch/high-watermark/in-flight plus configured private pending queue. Queue backpressure pauses edit admission. Duplicate old sequence/epoch ignored; retry same record; mismatch/rejection reconciles/drops exact records; no late persistence/history revival.
- Save/Revert composition-aware barriers: Save waits current IME settle and includes committed tx; Revert cancels/epochs late commit; Save source rebase, Revert all-head/history rebase.
- Scroll owned by M-SCROLL; view state host-private; surface identity immutable.
- Facts callbacks revisioned; support exact; composition epoch stamps settlement.
- Dispose retain/evict view cache; App model/dispatcher private store survives view and is released on terminal ack/session disposal.
- Dirty identity inequality; attachment/command/Scroll exact.

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
C-SCROLL-0001 / M-SCROLL-0001 / HC-SCROLL-SURFACE-0001
D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION (related seam, not replaced)

A-REACT-18-19-0001
  -> may later support/provide the new Module/Host Capability only after
     reviewed Web evidence
```

No new Adapter identity is justified: existing profiles receive reviewed relations only after evidence. No public Prototype is justified by this research alone. Prototype identity/anatomy and editor chrome require a later admitted authoring slice. Text Control remains unchanged; the document selection contract is related but separate.

### Bounded red-first plan

1. **Portable negatives:** raw model/content/edit batch/snapshot locator/engine/target/service/view-state absent; bounded IDs only.
2. **Lease/facts:** versioned facts; composition epoch; null command; policy/route/view lifecycle.
3. **Delivery:** delivery epoch/sequence + scalar high watermark; duplicates/old epoch ignored before mismatch; exact private payload retained across later commits/retry; bounded queue backpressure; accepted release; retry signal; rejection rotates epoch/drops records/clears history/no revival.
4. **Barriers/equality:** Save waits active IME commit/cancel then drains/rebases; Revert cancels+epochs late commit, clears history/rebases; edit/undo/redo equality dirty; immediate post-barrier edits.
5. **Commands/input:** history-empty after rejection, null/applied outcomes; IME->Focus->Harness route/gates.
6. **Selection/view/systems:** pre/post facts, retain/evict, A11y/Focus/Scroll one owner/cleanup.
7. **Real Web:** delayed tx1 exact payload while tx2 committed; duplicate/old/future/wrong-ID/retry acks; queue bound; rejection history; Save/Revert during IME; equality; view/system cleanup.
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
