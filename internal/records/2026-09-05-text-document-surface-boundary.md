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
- Host facts: discriminated attachment; post-attachment facts/policy revisions; ready model/source/mutation/content; independent composition and bounded-selection availability/facts; input/keyboard-route/A11y/view-state support. Module derives dirty. Focus and resolved Scroll facts remain in their domains.
- Model transaction summary: `{ documentId, modelSessionId, transactionId }`, document/source/mutation/content identity, immutable commit-time origin authorization context, disposition/count, and no observer freshness. One serial durable dispatcher per composite model key preserves the mutation chain and reaches App once in commit order. Accepted acknowledgement advances; rejected acknowledgement pauses every view, discards the dependent queued chain, and completes authoritative private model reconciliation before editing resumes. A per-connection observation envelope adds recipient UI freshness only.
- Engine requests/results: mutation/policy-bound undo/redo with explicit applied, no-op, rejected, and unavailable outcomes; explicit snapshot/export by App service. Commands before applied policy return nullable-policy `policy-not-applied` without engine access. Line navigation is deferred. Focus/blur remain Focus. Save/Revert are App actions serialized as model-key barriers.

The first slice's selection summary is intentionally bounded to `{ count, primaryCollapsed }` plus the current monotonic mutation revision. No raw range, selected text, mutable selection, pixel rectangle, or ungoverned line/column encoding crosses. A later line/column or range API needs an explicit Unicode position encoding and revision semantics.

This resolves the seam with `D-TEXT-CONTROL-PROJECTION-0001-Q-SELECTION` without closing it: plain Text Control selection remains that decision's open question. Revision-bound document selection is a different future contract and must not be retrofitted into `TextControlHandle`. Neither surface gains `selectAll`, `setSelection`, or `replaceSelection` in this first slice.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Document/model identity | App -> immutable Text Document requirement -> Host Capability resolver | Correct shared/private model and view appear even when different documents reuse a locally scoped session ID. | Resolve model by composite `{ documentId, modelSessionId }`; use `documentId` alone only for the underlying App document service. |
| Source content/revision | App model-session service -> engine/model dispatcher | Engine renders text and all attached views observe one current persisted base. | Composite document/model session owns source revision and changes once for all its views. |
| IME/text/key input | Physical editor -> initiating Host view bridge -> composite-key serial model dispatcher | Bridge stamps origin before shared dispatch. One unacknowledged App delivery per model; views detach without reorder/loss. Negative acknowledgement pauses all views, drops dependent queued summaries, and reconciles engine privately to authoritative App content before any new edit. | Composition, composite key, contiguous mutation chain, commit authorization, reconciliation epoch; observer freshness never governs durability. |
| Edit details | Serial dispatcher -> App service -> accepted/rejected acknowledgement; views get optional envelopes | Accepted ack must name sole in-flight transaction; dispatcher advances only to that delivered summary's own afterMutationRevision/contentVersion, with no echoed revision fields to disagree. Unknown/mismatched ID triggers protocol rejection/reconciliation. Rejected ack stops queue/resets model; stale UI drops. | Before equals prior accepted after; accepted uses immutable in-flight summary as source of truth; reconciliation revision exceeds discarded revisions. |
| Save/Revert | Button -> model action barrier -> dispatcher/App | Barrier resolves earlier acks, blocks edits. Save persists drained version and atomically advances both published source/saved facts and dispatcher's accepted source baseline while retaining mutation/content head; next user tx uses new source. Revert replaces content then rebases all accepted heads. | One barrier/model; rejection reconciles then action retry; Save/Revert baseline update is barrier result, not transaction ack. |
| Undo/Redo | App/semantic command -> initiating Host view bridge -> engine | Applied mutation, no-op empty, policy/stale rejection, or unavailable. | Before applied policy both expected policy and mutation are null; Host returns policy-not-applied before any numeric check/engine. After attach both must be numeric/current and history rechecked; no-op changes nothing. |
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

type DocumentInputSupport =
  | Readonly<{ availability: 'available' | 'read-only'; reason: null }>
  | Readonly<{ availability: 'unavailable'; reason: 'input-unavailable' }>;

type DocumentCompositionSupport =
  | Readonly<{
      reporting: 'available';
      composing: boolean;
      arbitration: 'ime-first';
      reason: null;
    }>
  | Readonly<{
      reporting: 'unavailable';
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
      savedContentVersion: string;
      mutationRevision: number;
      contentVersion: string;
      canUndo: boolean;
      canRedo: boolean;
    }>;

type DocumentTransactionBase = DocumentRef &
  Readonly<{
    transactionId: string;
    sourceRevision: string;
    beforeMutationRevision: number;
    afterMutationRevision: number;
    contentVersion: string;
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
// neither acknowledgement nor reconciliation content is a portable authoring value.
type DocumentTransactionAck =
  | Readonly<{
      // Must equal the sole in-flight transactionId; dispatcher uses its stored summary head.
      transactionId: string;
      status: 'accepted';
      reason: null;
    }>
  | Readonly<{
      transactionId: string;
      status: 'rejected';
      reason: 'authorization-revoked' | 'source-conflict';
      reconciliationId: string;
      authoritativeSourceRevision: string;
      authoritativeSavedContentVersion: string;
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
      status: 'no-op';
      appliedPolicyRevision: number;
      mutationRevision: number;
      contentVersion: string;
      reason: 'history-empty';
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
  requestCommand(
    request: Readonly<{
      requestId: string;
      command: 'undo' | 'redo';
      expectedPolicyRevision: number | null;
      expectedMutationRevision: number | null;
    }>
  ): void;
  snapshot(): DocumentSurfaceFacts;
  dispose(options: Readonly<{ viewState: 'retain-for-surface' | 'evict-surface' }>): void;
}>;

type DocumentSurfaceHost = Readonly<{
  attach(connection: DocumentSurfaceConnection): DocumentSurfaceLease;
}>;
```

1. attach two surfaces to composite doc/model keys; distinct key pairs resolve independent models/view state;
2. snapshot detached/attaching null policy/no support with facts revisions 1/2; delay an earlier null-policy unavailable revision 3 until after ready revision 4 and prove stale suppression. Pre-policy undo with both expected revisions null returns policy-not-applied before engine; mixed pair invalid;
3. commit tx1 then tx2. Delay tx1 ack; withhold tx2. Send accepted ack containing only tx1 ID; dispatcher advances to stored tx1 summary head, then delivers contiguous tx2. Ack with unknown/tx2 ID while tx1 in flight triggers protocol rejection and authoritative reconciliation; no caller-supplied accepted revision/content can desynchronize head. Duplicate tx1 no advance;
4. App rejects tx1 authorization/source; all views non-interactive, tx2 never persists, queue reset, private authoritative replacement, undo/view facts reconcile above discarded revisions, old callbacks reject, resume fresh;
5. sibling observations cannot replace origin/order; detach before ack preserves durable/reconciliation queue;
6. recover unavailable->ready; delayed lower facts revision cannot regress;
7. composition/selection degradations independent;
8. selection revisions order; editing modes/origin gate;
9. IME -> reserved Focus exit -> Harness -> editor; shortcut collision route unavailable;
10. empty undo/redo current/race returns no-op unchanged; unrelated support does not make unavailable;
11. commit tx3/tx4, delay tx3 ack, invoke Save. Barrier blocks, waits both accepted, persists exact drained content, advances source r4->r5 and saved facts, atomically sets dispatcher source head r5 while mutation/content head stays drained value, resumes. Immediate tx-after-save carries source r5 and beforeMutation equal drained head; persists normally; no r4 summary follows;
12. Save/Revert with rejected pending reconciles first/superseded retry. Revert on reconciled baseline applies App-origin saved content and atomically sets dispatcher mutation/content/source heads; tx-after-revert chains and persists without replacement ack;
13. strict policy/envelopes; App-origin observe-only no echo;
14. unavailable/error/command shapes exact;
15. view key retain/restore/final evict;
16. A11y/Focus/Scroll owners; M-SCROLL disposes once;
17. stale UI cannot suppress/reorder/revive durable chain;
18. no raw engine/model/content/range/target/Scroll/file/view-state/reconciliation crosses.

This proves all fact callbacks versioned before and after attachment, accepted acknowledgement bound to stored in-flight summary, Save source-head and Revert full-head rebasing, null/no-op commands, positive/rejected ordered delivery, barriers, reconciliation, pending attach, identity/authorization/support/input arbitration/view lifecycle/system ownership. It does not prove real host behavior.

## Revision, input, shortcut, and permission policy

- **Revision, transaction, authorization, order, and acknowledgement:** initiating Host stamps origin. One dispatcher/model has one in-flight and contiguous chain. Accepted ack carries only transaction ID, must match sole in-flight ID, and advances exactly to stored delivered summary afterMutation/content; unknown/out-of-order ID is protocol rejection entering authoritative reconciliation. Rejected authorization/source does same pause/drop/private reset at revision above discarded, then fresh policy/facts. App validates/dedupes; recipient freshness independent.
- **Save/Revert barrier:** blocks views/actions and drains acks. Save persists exact drained mutation/content then atomically advances published source/saved facts and dispatcher accepted source head to new source while retaining drained mutation/content; first later tx uses new source. Revert App-origin replacement atomically resets all accepted heads; no replacement ack. Earlier rejection reconciles then action retry. Resume after result/facts/policy.
- **IME/exit/shortcut precedence:** Host IME, Focus exit, Harness, editor. Route policy collision blocks.
- **Command outcomes:** pre-policy both expected null -> policy-not-applied before revision/engine; mixed invalid. Attached numeric/current; empty -> no-op unchanged; noninteractive denied; engine/document/service unavailable.
- **Text versus command keys:** engine owns editing/cursor/undo/indent. App commands use host arbiter; no native key object crosses.
- **Tab and escape:** composition owns enabled leave Button and Focus topology plus policy-verified host route. Either failure blocks acceptance.
- **Clipboard/paste:** system/editor owns; only Host-stamped persistable transaction enters serial durable dispatcher.
- **Editing mode/mobile:** only interactive with commit-stamped origin may persist/command. Read-only preserves selection; disabled blocks entry. Host IME/touch and support branches degrade explicitly.

## Accessibility boundary

- App supplies editor role/name/description through A11y semantic-object facts. Help is App composition through existing relations; no help fact. Adapter projects A11y IR; engine/Host Capability supplies native editable control, text ranges, caret behavior, wrapping, and screen-reader editing mechanics without second role ownership.
- `DocumentSelectionSummary` supports low-cost status only; native accessibility exposes ranges. Later line/column API needs encoding/replacement rules.
- Streaming edit/caret does not feed live region. Announcements are bounded to read-only/save/conflict/rejection. Diagnostics is option D.
- Web evidence covers A11y role/name/description/help relation, screen-reader mode, Tab-focus, composition, selection, read-only, Scroll integration, zoom/wrap/high contrast, focus entry/exit, and no duplicates.
- Native evidence may use UIA TextPattern or equivalent; sensitive content projection is App/Host privacy. Degradation explicit.
- Large-document accessibility and range-query performance are option E. Same-Web WC/React/Vue results cannot establish native-host conformance.

## Performance, viewport, windowing, and lifecycle

- Full document/model/token/decorations/internal viewport lines do not enter generic Proto State.
- Durable transactions retain Host authorization. Serial dispatcher per model preserves contiguous order with one unacknowledged App delivery. Rejected ack pauses views, discards dependent queue, performs App-private authoritative reconciliation with monotonic fresh revision/content identity, then resumes only after fresh policy/facts. No rejected or discarded transaction later persists.
- Save/Revert use same barrier: block edits, drain/reconcile prior queue, operate exact baseline, publish facts, resume. Revert barrier atomically rebases dispatcher accepted head to App-origin replacement revision/content/source; next user edit chains normally despite no replacement transaction acknowledgement. View envelopes may stale-drop without changing order/barrier.
- Text Document registers logical Scroll; M-SCROLL exclusively owns identity/facts/requests/support/epoch and HC lease disposal. Text Document cleans only editor controller bridge, never Scroll lease/support.
- Raw geometry/view state host-private; restoration keys composite with surface.
- One surface holds immutable composite requirement; identity replacement reattaches; mutable update policy only. Loading only status discriminant.
- Every facts callback, including detached/attaching/null-policy unavailable, carries a monotonic connection `factsRevision`; support remains omitted before attachment. A delayed pre-attachment failure cannot replace higher ready facts. Post-attachment support exact; UI freshness never governs durability.
- Dispose retain releases view-owned resources/keeps keyed state; M-SCROLL owns lease. Evict purges. App models survive.
- Attachment failure exact; command unavailable exact; Scroll stays owned.

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

1. **Portable negatives:** reject raw engine/model/target/range/worker/stream/file/framework/native event/geometry/document/token/view-state/scroll-controller/service values; reject identity in mutable updates.
2. **Fake lease:** every pre/post-attach callback facts revision; delayed null failure after ready stale-drops; null command revisions; composite/policy/modes/route/view state/cleanup.
3. **Transactions/actions:** one in-flight; accepted ack contains matching ID only and advances from stored summary; unknown/out-of-order ID reconciles; rejection reconciliation; Save barrier atomically rebases source head then immediate edit; Revert rebases all heads then edit; no late persistence.
4. **Commands/input:** applied/no-op/rejected/unavailable; null inputs; empty race; exact support; IME->Focus exit->Harness->editor; collision/gates.
5. **Selection/view:** post-attach ready fields; pre-attach versioned null/no support; composite key retain/evict; loading; line deferred.
6. **A11y/Focus/Scroll:** owners; bridge drop, M-SCROLL dispose once; no duplicate.
7. **Real Web:** versioned pre-attach recovery; accepted-ack mismatch attempt; accepted/rejected chains/reconciliation; Save source-head and Revert full-head barriers with immediate edits; null/no-op commands; arbitration/selection/shared save/view/A11y/Scroll cleanup.
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
