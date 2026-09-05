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
- Host facts: attachment/policy/facts revisions; source/mutation/equality; structurally coupled edit input+origin support; delivery capacity; composition/selection/keyboard/A11y/view support. Module dirty from identity. Interactive mode is admissible only with `support.edit` available+commit-stamped and delivery available.
- Persist summary alone carries delivery epoch/sequence/transaction ID, exact private record, Host origin. App-origin observe-only summary carries observation ID but consumes no delivery coordinate/acknowledgement. One in-flight; retry/rejection/handoff explicit.
- Commands include applied/no-op/busy/rejected/unavailable. Before any input/undo/redo mutation, Host reserves private queue capacity; otherwise text pauses and command returns bounded delivery-backpressure without engine execution. Save/Revert composition-aware barriers.

`contentIdentity` is an opaque model-service equality token, not a monotonic engine version: within one composite model session, equal full document contents MUST yield the same token and unequal contents MUST yield different tokens. `savedContentIdentity` is the token of the current saved source. Mutation revision still increases on every edit/undo/replacement, so edit then undo to byte-for-byte saved text produces a newer mutation revision but restores `contentIdentity === savedContentIdentity` and dirty false. The engine/model service computes the token without copying full content through Proto UI.

The first slice's selection summary is intentionally bounded to `{ count, primaryCollapsed }` plus the current monotonic mutation revision. No raw range, selected text, mutable selection, pixel rectangle, or ungoverned line/column encoding crosses. A later line/column or range API needs an explicit Unicode position encoding and revision semantics.

This resolves the seam with `D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION` without closing it: plain Text Control selection remains that decision's open question. Revision-bound document selection is a different future contract and must not be retrofitted into `TextControlHandle`. Neither surface gains `selectAll`, `setSelection`, or `replaceSelection` in this first slice.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Document/model identity | App -> immutable Text Document requirement -> Host Capability resolver | Correct shared/private model and view appear even when different documents reuse a locally scoped session ID. | Resolve model by composite `{ documentId, modelSessionId }`; use `documentId` alone only for the underlying App document service. |
| Source content/revision | App model-session service -> engine/model dispatcher | Engine renders text and all attached views observe one current persisted base. | Composite document/model session owns source revision and changes once for all its views. |
| Input/commit | Host bridge -> edit/origin+delivery gate -> private store/dispatcher | Interactive only when `support.edit.input=available`, origin=commit-stamped, delivery=available. Capacity reserved before engine mutation. Origin loss first blocks input/resolves read-only; no edit without provenance. | Structural edit support + policy + queue slot + composition/delivery epochs. |
| Persist delivery | Dispatcher -> App ack/outbox | Only persist summaries consume delivery key/sequence and retain payload. Observe-only App replacement uses observationId, updates model baseline as specified, and never changes sequence/watermark or awaits ack. | Full delivery key only for persist; scalar epoch/watermark. |
| Undo/Redo | Host -> same edit/origin/delivery gate -> engine | Queue slot reserved before mutation; full queue returns `busy: delivery-backpressure`, no command queue/engine change. Other outcomes exact. | Caller explicitly retries after higher facts revision reports delivery available. |
| Final model-session disposal | App-owned dispatcher lease -> terminal ack or durable outbox handoff | Retryable in-flight and queued exact records transfer atomically with same delivery keys/payloads; durable receipt permits local close. Outbox-unavailable returns blocked and retains model/records. | Idempotent handoff receipt; never drop locally committed durable intent. |
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

type DocumentInputAvailableSupport = Readonly<{
  availability: 'available';
  reason: null;
}>;
type DocumentInputNonInteractiveSupport =
  | Readonly<{ availability: 'read-only'; reason: null }>
  | Readonly<{ availability: 'unavailable'; reason: 'input-unavailable' }>;
type DocumentInputSupport = DocumentInputAvailableSupport | DocumentInputNonInteractiveSupport;

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

type DocumentTransactionOriginAvailableSupport = Readonly<{
  availability: 'commit-stamped';
  reason: null;
}>;
type DocumentTransactionOriginSupport =
  | DocumentTransactionOriginAvailableSupport
  | Readonly<{
      availability: 'unavailable';
      reason: 'transaction-origin-unavailable';
    }>;

type DocumentEditSupport =
  | Readonly<{
      input: DocumentInputAvailableSupport;
      transactionOrigin: DocumentTransactionOriginAvailableSupport;
    }>
  | Readonly<{
      input: DocumentInputNonInteractiveSupport;
      transactionOrigin: DocumentTransactionOriginSupport;
    }>;

type DocumentDeliverySupport =
  | Readonly<{ availability: 'available'; reason: null }>
  | Readonly<{
      availability: 'backpressured';
      reason: 'delivery-backpressure';
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
  // Interactive input is structurally coupled to commit-stamped origin support.
  edit: DocumentEditSupport;
  delivery: DocumentDeliverySupport;
  composition: DocumentCompositionSupport;
  selection: DocumentSelectionSupport;
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

type DocumentTransactionCommon = DocumentRef &
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

type DocumentPersistTransactionSummary = DocumentTransactionCommon &
  DocumentDeliveryKey &
  Readonly<{
    origin: DocumentViewTransactionOrigin;
    disposition: 'persist';
  }>;

type DocumentObserveOnlySummary = DocumentTransactionCommon &
  Readonly<{
    // Observation-only correlation; consumes no delivery epoch or sequence.
    observationId: string;
    origin: Readonly<{ kind: 'app' }>;
    disposition: 'observe-only';
  }>;

type DocumentTransactionSummary = DocumentPersistTransactionSummary | DocumentObserveOnlySummary;

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

// Final App-owned model-session dispatcher close; not a view-lease operation.
type DocumentDispatcherCloseResult =
  | Readonly<{ status: 'closed'; outboxReceiptId: null; reason: null }>
  | Readonly<{
      status: 'handed-off';
      outboxReceiptId: string;
      deliveryEpoch: number;
      firstDeliverySequence: number;
      lastDeliverySequence: number;
      reason: null;
    }>
  | Readonly<{
      status: 'blocked';
      outboxReceiptId: null;
      reason: 'outbox-unavailable';
    }>;

type DocumentModelSessionDispatcherLease = Readonly<{
  // Final model-session close; view disposal never calls this.
  close(): Promise<DocumentDispatcherCloseResult>;
}>;

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
      status: 'busy';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentIdentity: string;
      reason: 'delivery-backpressure';
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
2. prove `DocumentInputSupport` exact available/read-only/unavailable reasons. Attempt interactive patch with unavailable origin: structural `DocumentEditSupport` cannot represent input-available+origin-unavailable; Module resolves read-only/unavailable and zero edit. While interactive, lose origin support: block input first, publish newer noninteractive policy/facts, zero committed edit;
3. delivery epoch7 tx1/tx2: exact payload retained; accepted/dedup/old/future/wrong key behaviors; observe-only App replacement carries observationId only, consumes no sequence/watermark, and next persist uses next contiguous sequence;
4. retryable tx retains exact record and blocks. Explicit retry. Fill bounded queue: delivery support becomes backpressured before next mutation; physical input pauses. Concurrent undo/redo returns busy delivery-backpressure synchronously, with unchanged engine/history/revision and no queued command. After slot release/new facts, explicit retry executes;
5. reject authorization/source: noninteractive, drop dependents, rotate epoch, private reconcile, clear history/no revival;
6. active IME Save waits settle; Revert cancels/epochs late commit; equality edit/undo/redo dirty;
7. Save/Revert queues/retries/head rebases; view/systems cleanup;
8. final App model-session close while tx retryable: atomically hand exact in-flight/queued records and epoch/watermark to durable App outbox using same keys; receive handoff receipt, then dispose model/dispatcher. Outbox retries idempotently; later rejection becomes App conflict and next attach loads authoritative source;
9. make outbox unavailable: close returns blocked/outbox-unavailable, retains model/private records and can be retried; it never reports closed or drops content. Repeated successful close returns same receipt/no duplicate handoff;
10. no raw content/edit/snapshot/outbox payload/engine/target crosses authoring.

This proves restored input support and origin coupling, persist-only sequencing, command backpressure, retryable disposal handoff/block, exact payload/order/equality/composition/barrier/view/system ownership. It does not prove real host behavior.

## Revision, input, shortcut, and permission policy

- **Edit/origin gate:** `DocumentInputSupport` is exact. `DocumentEditSupport` structurally allows input available only with commit-stamped origin; noninteractive input may pair with unavailable origin. Module/runtime accepts `editingMode: interactive` only on first branch plus delivery available. Origin/capacity loss blocks host input before fact/policy publication and resolves read-only/unavailable; no committed edit is dropped or provenance fabricated.
- **Delivery identity/storage:** only `DocumentPersistTransactionSummary` has delivery key/ack/private payload. `DocumentObserveOnlySummary` has observationId, consumes no sequence, and barrier/reconciliation explicitly rebase heads. One in-flight/contiguous; exact payload; bounded queue reserves slot before all input/undo/redo mutations.
- **Duplicate/retry/backpressure:** scalar epoch/watermark. Duplicate/retired ignore; mismatch reconciles. Retry retains exact record. Full queue publishes delivery backpressure, pauses text before engine, returns command busy without queue/mutation; explicit retry only after available facts.
- **Rejected history/composition/barriers/equality:** rejection/Revert clear history; Save waits IME, Revert cancels epoch; Save/Revert drain/rebase; equality IDs derive dirty.
- **Final dispatcher disposal:** view dispose never closes model dispatcher. Final close first seeks terminal ack; if retryable remains, atomically hands exact keyed records plus epoch/watermark to App durable outbox. Receipt makes local state handed-off and disposable; repeated close same receipt. Outbox failure returns blocked and retains all state. Eventual outbox rejection records App conflict; next attach uses authoritative source.
- **Command/input order:** pre-policy null; no-op/busy/reject/unavailable exact; IME->Focus->Harness; support exact.
- **Systems:** view freshness separate; Scroll/A11y/Focus own; no raw private/outbox payload portable.

## Accessibility boundary

- App supplies editor role/name/description through A11y semantic-object facts. Help is App composition through existing relations; no help fact. Adapter projects A11y IR; engine/Host Capability supplies native editable control, text ranges, caret behavior, wrapping, and screen-reader editing mechanics without second role ownership.
- `DocumentSelectionSummary` supports low-cost status only; native accessibility exposes ranges. Later line/column API needs encoding/replacement rules.
- Streaming edit/caret does not feed live region. Announcements are bounded to read-only/save/conflict/rejection. Diagnostics is option D.
- Web evidence covers A11y role/name/description/help relation, screen-reader mode, Tab-focus, composition, selection, read-only, Scroll integration, zoom/wrap/high contrast, focus entry/exit, and no duplicates.
- Native evidence may use UIA TextPattern or equivalent; sensitive content projection is App/Host privacy. Degradation explicit.
- Large-document accessibility and range-query performance are option E. Same-Web WC/React/Vue results cannot establish native-host conformance.

## Performance, viewport, windowing, and lifecycle

- Full model/content/private transaction/outbox payload stays infrastructure; bounded IDs only.
- Persist dispatcher uses epoch/watermark/in-flight/bounded queue; observe-only never consumes coordinate. Queue slot reserved before text/undo/redo mutation; busy no engine/command queue. Duplicates/retry/rejection exact.
- Final model close settles or durable-handoffs same keyed records; outbox receipt permits disposal; unavailable blocks and retains; view disposal never drops dispatcher.
- Save/Revert composition/equality/head/history rules; Scroll/view state/identity owners unchanged.
- Facts revisions/support exact; edit input structurally coupled to origin; origin/backpressure loss blocks before mutation.
- Dispose retain/evict view resources only; App model/dispatcher/outbox lifetimes explicit.
- Dirty equality; attachment/command/Scroll exact.

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

1. **Portable negatives:** raw model/content/edit/snapshot/outbox/engine/target/service/view state absent; bounded IDs only.
2. **Support/lease:** restored exact input union; edit-origin structural coupling; interactive acceptance/loss transition; versioned composition/policy/view facts.
3. **Delivery:** persist-only epoch/sequence; observe-only no coordinate; exact payload; scalar duplicate handling; retry; queue slot before text/undo/redo; command busy/no mutation; rejection/history.
4. **Disposal/barriers/equality:** retryable close durable handoff same keys/receipt/idempotency; outbox failure blocked-retained; Save/Revert IME/head/history; equality dirty.
5. **Systems:** selection/view retain/evict; A11y/Focus/Scroll owner cleanup.
6. **Real Web:** input/origin loss; observe-only sequence; backpressured undo/redo; retryable close handoff/failure; delivery ack/reconciliation; IME barriers/equality/view cleanup.
7. **Performance:** rapid edits/caret movement and a bounded first-slice document prove no full-content/token/viewport copies through Proto UI and no retained listeners/models.
8. **Cross-adapter Web only if claimed:** WC/React/Vue from one authoring source remains Web evidence.
9. **Non-Web:** independent native profile with native input, selection, revision, accessibility, view replacement, and cleanup evidence before multi-host language.

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
