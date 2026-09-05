# Terminal Surface boundary for later Agent Harness work

Date: 2026-09-05

Status: non-normative research recommendation for #530. This record does not admit a Contract, Module, Host Capability, Prototype, Adapter relation, terminal engine, PTY backend, or implementation.

Refs: #513 (Agent Harness tracker), #514 (coverage matrix), #517 (Code Block), #521 (windowing), #530 (this research).

## Recommendation

Advance **option C: a narrow interactive Terminal Surface proposal checkpoint**. Keep the terminal emulator, mutable cell grid, escape parsing, alternate screen, scrollback, selection engine, mouse protocol, PTY/process lifecycle, transport, permissions, reconnection, and audit completely outside Proto UI portable state.

The next checkpoint should consider one semantic Module plus one lease-shaped Host Capability for low-cardinality status, focus entry/exit, committed text/key intent, character-cell resize negotiation, bounded attention/error facts, and host-owned accessibility projection. It should not admit an engine, public Prototype, or Adapter support claim yet.

This is smaller and more honest than option D, while unlike B it fulfills the first terminal-specific user job: interact with a full-screen or cursor-addressed process rather than merely read output. Option A remains the fallback for logs and static output.

Classification: **next proposal checkpoint**. The engine remains **infrastructure-exempt behind a narrow host surface**.

## Evidence and authority

### Repository authority

The following catalog entities are draft unless stated otherwise:

- `K-HOST-SURFACE-ROLES-0001-A..D` distinguishes `boundaryTarget`, `surfaceTarget`, and host-private targets/controllers. Splitting roles creates no second semantic owner or portable channel.
- `C-HOST-SURFACE-PROJECTION-0001-A/B/D/E` keeps lifecycle and logical identity at `boundaryTarget`, limits `surfaceTarget` to presentation, leaves focus/a11y/event/native targets to their domains, and requires replacement cleanup.
- `C-TEXT-CONTROL-0001-A/C/F/G/H`, `D-TEXT-CONTROL-PROJECTION-0001-A/C/D/E`, and `HC-TEXT-CONTROL-0001` are the worked precedent for portable requirements, a host-owned engine, normalized events, a bounded lease, editing-session preservation, and Web-only evidence limits. They do not authorize expanding Textarea into a terminal.
- `C-FOCUS-0001-B/C/D/G` distinguishes focus facts/requests/eligibility/topology/policy, keeps fact ownership in Focus, and lets entry regions delegate without creating Terminal-specific focused state.
- `C-A11Y-0001-B/D/E/G/H/I` and `HC-A11Y-0001` govern semantic-object name/description/state/relation facts, state-backed mode, updated name/description projection, and native/degraded host projection; Terminal patches do not form a second A11y channel.
- `C-SCROLL-0001-D/E`, `M-SCROLL-0001-D/E`, and `HC-SCROLL-SURFACE-0001-D` keep geometry and high-frequency host facts behind a lease, require released leases to stop delivery, and require stale-callback suppression and cleanup.
- Active `D-ADAPTER-PROFILE-0001-B/C/D/E` means an existing Adapter can claim Terminal Module support or Host Capability provision only after concrete reviewed evidence. Absence from an Adapter profile means uncataloged, not unsupported.

Current implementation and tests confirm those adjacent patterns:

- `packages/adapters/base/src/host/surface-projection.ts` keeps adapter-private boundary/surface mapping replaceable without owning a domain target.
- `packages/modules/text-control/src/caps.ts` expresses a data-only `attach`/`update`/`snapshot`/`dispose` lease.
- `packages/modules/text-control/test/impl-spec.test.ts` proves normalized fake-host callbacks and lease cleanup without leaking a host target.
- `T-HOST-SURFACE-PROJECTION-0001` and `T-TEXT-CONTROL-0001` bind those guarantees to executable evidence.
- Targeted searches found no Terminal Surface, PTY, or xterm implementation in `packages/**`. No `T-TERMINAL-*` evidence exists.

`apps/www/src/content/docs/en/build/host-caps.md` accurately projects the Module -> Host Capability -> Adapter split, lease lifetime, fake-host limits, and no-raw-target rule. `internal/records/2026-08-02-host-surface-projection.zh-CN.md` and `internal/records/2026-08-02-text-control-host-boundary.zh-CN.md` are context, not authority.

### External primary sources

Web evidence was inspected at xterm.js commit `c58ea3637f3968e0e6e79cd92cf9aace7ef89ee2`:

- [public typings](https://github.com/xtermjs/xterm.js/blob/c58ea3637f3968e0e6e79cd92cf9aace7ef89ee2/typings/xterm.d.ts) expose engine-owned DOM elements and input textarea, buffer/mode state, `onData`, binary mouse reports, key interception, resize, selection, title, bell, direct rendering, and disposal. `onWriteParsed` is already coalesced to at most once per frame, while resize documentation recommends debouncing before PTY propagation.
- [AccessibilityManager](https://github.com/xtermjs/xterm.js/blob/c58ea3637f3968e0e6e79cd92cf9aace7ef89ee2/src/browser/AccessibilityManager.ts) builds an engine-specific row list and live region, synchronizes rows with buffer/render/scroll, suppresses echoed input, stops normal announcement after 20 output rows, handles boundary focus, and disposes listeners and accessibility DOM.

Non-Web evidence was inspected in Microsoft Console and Windows Terminal sources at or before Microsoft Terminal commit `093e49e29a9f806ff83025c49be5d0c970673b00`:

- [Creating a Pseudoconsole session](https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session) assigns bidirectional handles, buffering, VT decoding, process creation, character-cell resize, final-frame draining, and close/deadlock hazards to the host/backend integration.
- [Window and Screen Buffer Size](https://learn.microsoft.com/en-us/windows/console/window-and-screen-buffer-size) states that VT window and screen-buffer sizes coincide and terminal scrollback belongs to the terminal rather than the addressable console area.
- [Windows Terminal selection](https://learn.microsoft.com/en-us/windows/terminal/selection) documents engine-specific mouse modes, keyboard mark mode, block selection, explicit copy, and input fallthrough.
- [Keyboard Selection spec](https://github.com/microsoft/terminal/blob/093e49e29a9f806ff83025c49be5d0c970673b00/doc/specs/%234993%20-%20Keyboard%20Selection/Keyboard-Selection.md) separates Terminal Control input policy from Terminal Core selection state and requires selection-change notification through UI Automation.
- [Search spec](https://github.com/microsoft/terminal/blob/093e49e29a9f806ff83025c49be5d0c970673b00/doc/specs/%23605%20-%20Search/spec.md) keeps terminal input and search-box input separate, defines focus transfer and Escape restoration in native XAML chrome, and lets the buffer/search engine own matching and selection.

These sources support a cross-host boundary, not cross-host conformance: engines own terminal protocol, buffers, selection, rendering, and platform accessibility mechanics; a narrow surface may coordinate portable facts and requests without copying those internals.

## User-job and slice comparison

| Option | User job | Benefit | Cost or failure | Disposition |
| --- | --- | --- | --- | --- |
| A. No Terminal domain | Read append-only output or a static code/log artifact. | Already has an honest path through App-authored content and the #517 Code Block composition boundary. | Cannot represent cursor addressing, alternate screen, terminal input modes, resize, or a mutable screen. | Keep as fallback; not a terminal. |
| B. Read-only terminal screen/scrollback | Inspect cursor-addressed or alternate-screen output without sending input. | Preserves visual terminal fidelity through an engine. | Pays nearly all emulator, accessibility, selection, rendering, and lifecycle cost while failing the primary interactive job. Static logs should use A. | Do not make the first Proto UI slice. A host may embed this privately as infrastructure. |
| C. Interactive input + resize | Focus a terminal, enter text/keys, observe status, and keep rows/columns synchronized. | Smallest terminal-specific end-to-end job; fakeable without raw engine values. | Requires explicit shortcut, IME, focus escape, accessibility, epoch, and cleanup policy. | **Recommended proposal checkpoint.** |
| D. Selection/search/clipboard/mouse | Operate full terminal workbench features. | Rich parity with mature terminal products. | Selection/core state, Clipboard, find UI, mouse reporting, and security policies widen several owners at once. | Defer. Preserve engine defaults where available; no portable API claim. |

## Responsibility and trust table

| Layer | Owns | Receives across the boundary | Must never expose to portable authoring |
| --- | --- | --- | --- |
| App/backend | Unique process-lifetime session ID; non-reused transport binding IDs; PTY/process lifecycle; input revoke; output EOF/drain; authorization/reconnect/audit/restart. | Data-only session/binding refs; bounded results/actions. | Raw PTY/stream/process/token/bytes/callbacks. |
| Engine infrastructure | Parser/grid/modes/scrollback/selection/render/A11y buffer; output subscription; attention run aggregation; created-vs-borrowed ownership. | Host-private resolvers/routes. | Engine/model/target/controller/raw I/O. |
| Proto UI Terminal owner | Module session-connection/instance identities; view policy/facts/resize/key; bounded attention batches/overflow facts. | Plain values + Focus. | Grid/raw I/O, host objects, engine ownership choice, Focus/process authority. |
| Terminal Host Capability | Resolve and idempotently bind session before backend activation with bounded failure; session-scoped binding replace; engine/output/attention lifetime; bounded batching/backpressure overflow; child owner/view cascade; created engine disposal vs borrowed detach. | Immutable IDs/policy, bounded callbacks/results, resolvers. | No raw host/I/O/epoch/lease authoring; owner/view cannot close session; borrowed engine never disposed. |
| Adapter profile | Materialize targets, wire capability/lifecycle/Focus. | Governed requirement after evidence. | No semantic reinterpretation/support claim early. |
| Composition | Chrome/status/controls/attention presentation. | App facts/events. | Terminal protocol/process/grid/selection. |

Engine remains infrastructure. `bindSession` resolves engine affinity/initial binding/output/attention before backend activation. Exact retry returns existing only while live; closing/closed tombstone rejects, preventing inert reactivation; session IDs never reuse. Same live session different connection conflicts. `replaceBinding` atomically reserves one transition; overlap rejects correlated pending. Session channel supports zero owner/view. Attention bounded. Close cascades children, drains, respects created/borrowed ownership. Restart new session.

## Portable facts, requests, and information paths

### Candidate first-slice values

The proposal may evaluate these plain values; names are illustrative and not an admitted API:

- App input: process session ID, initial unique binding ID, later session-scoped binding replacements, status/policy. Module mints connection/instance IDs. Host resolves engine ownership.
- View facts: attachment/composition/dimensions/support/resize. Session facts/results: binding transition and bounded attention event/overflow batches with contiguous sequences.
- Requests: session binding replace/close; owner/view/key/resize. Physical input/output private. Focus remains Focus.

Dimensions must be finite positive safe integers. Resize revision is Module-issued positive safe integer strictly increasing per `terminalInstanceId` across view/backend replacement; coordinator rejects zero/unsafe/duplicate/decreasing as `invalid-revision` before queue/backend and never rewinds last accepted revision. One owner per session, one active view, one in-flight resize; replacement/release waits settlement. Geometry/engine internals stay Host-private.

A current accessible text snapshot can be a plain diagnostic/test result, but should not be continuously copied into portable State. The first slice should expose `host-bridge | bounded-snapshot | unavailable` support and prefer a host-owned accessibility bridge. Any later author-facing snapshot request requires a separate privacy, size, cadence, and stale-revision decision.

Selection summaries and copy requests are technically expressible as plain values, but are not needed by option C. The engine keeps default selection/copy behavior. No selected text or Clipboard payload enters portable State. Programmatic selection, search, Clipboard, mouse reporting, and hyperlinks remain option D.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Session bind | Module session connection -> Host resolvers -> bind result -> App activates backend | Bound/existing exact lease or bounded engine/output/attention/session-conflict unavailable; failure allocates nothing and backend emits no first byte. | Session connection ID + process session ID + initial binding ID. |
| Binding reconnect | App -> `replaceBinding` request ID + expected/next IDs | Session atomically reserves one transition before drain/revoke; overlap rejects `binding-transition-pending` with no queue. Applied/rejected echoes request ID and releases reservation. Works without owner/view. | Current binding, unique next ID, one pending transition; input blocked until result. |
| Process exit/close | Revoke input -> mark output draining while ID remains accepted -> EOF/queued output + attention batches settle -> cascade view/owner -> retire binding/session | Final frame/attention retained; all descendant leases inert; created engine disposed, borrowed detached. | Awaitable idempotent session close; binding retirement occurs after drain. |
| Output | Session binding gate -> engine | Continues with no owner/view/between owners. | Session/binding epoch; zero portable bytes/grid. |
| Input | Active view -> Host/engine -> current binding | Private once; no view means none. | View policy + current session binding. |
| Geometry | Active owner/view -> coordinator | Exclusive valid serialized resize. | Owner/revision. |
| Focus/A11y | System domains -> active view over session engine | View-only projection, engine persists. | View epochs. |
| Attention | Session engine -> bounded consecutive runs -> `onAttentionBatch` | Normal batches preserve run order/count; fixed pending capacity. Overflow batch preserves sequence range and bell/error counts while explicitly losing interleaving; no unbounded callback/queue. | Contiguous session sequences; callback retired only after drain; presentation dedupe downstream. |

## Fake-engine / fake-host protocol sketch

The connection callbacks below are Module-to-Host internals. They are not Prototype props and do not make functions or engine values portable.

```ts
type TerminalDimensions = Readonly<{ columns: number; rows: number }>;
type TerminalSize = TerminalDimensions & Readonly<{ revision: number }>;
type TerminalResizeRejectReason =
  | 'invalid-dimensions'
  | 'invalid-revision'
  | 'resize-unavailable'
  | 'backend-rejected';

type TerminalUnavailableReason =
  | 'engine-unavailable'
  | 'engine-session-mismatch'
  | 'backend-unavailable'
  | 'backend-binding-unavailable'
  | 'input-unavailable'
  | 'keyboard-route-unavailable'
  | 'mouse-reporting-not-denied'
  | 'accessibility-unavailable'
  | 'resize-unavailable'
  | 'resize-owner-conflict'
  | 'owner-identity-mismatch'
  | 'view-already-attached'
  | 'owner-releasing'
  | 'backend-rejected';

type TerminalResizeResult =
  | Readonly<{
      revision: number;
      outcome: 'applied';
      requested: TerminalDimensions;
      effective: TerminalDimensions;
      reason: null;
    }>
  | Readonly<{
      revision: number | null;
      outcome: 'rejected';
      requested: TerminalDimensions;
      effective: null;
      reason: TerminalResizeRejectReason;
    }>;

type TerminalSurfaceSupport = Readonly<{
  input: 'available' | 'read-only' | 'unavailable';
  keyboardRoute: 'available' | 'unavailable';
  mouseReporting: 'denied' | 'unverified';
  resize: 'available' | 'unavailable';
  accessibility: 'host-bridge' | 'bounded-snapshot' | 'unavailable';
  reasons: readonly TerminalUnavailableReason[];
}>;

type TerminalSurfaceRequirement = Readonly<{
  // Module IDs are immutable; binding epoch comes from the parent session lease.
  terminalInstanceId: string;
  sessionId: string;
}>;

type TerminalSurfacePatch = Readonly<{
  inputMode: 'interactive' | 'read-only' | 'disabled';
  shortcutPolicyId: string;
}>;

type TerminalSurfaceUpdate = Readonly<{
  // Strictly increasing and issued by the Module.
  generation: number;
  patch: TerminalSurfacePatch;
}>;

type TerminalLetter = Lowercase<
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
>;

type TerminalKey =
  | TerminalLetter
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'Enter'
  | 'Escape'
  | 'Backspace'
  | 'Tab'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'
  | 'Insert'
  | 'Delete';

type TerminalKeyIntent = Readonly<{
  type: 'key';
  key: TerminalKey;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  repeat: boolean;
}>;

type TerminalSurfaceFacts = Readonly<{
  attachment: 'detached' | 'attaching' | 'ready' | 'unavailable' | 'error';
  composing: boolean;
  columns: number | null;
  rows: number | null;
  support: TerminalSurfaceSupport;
}>;

type TerminalSurfaceSnapshot = Readonly<{
  // Captured atomically with facts; a stale generation cannot satisfy current policy.
  generation: number;
  facts: TerminalSurfaceFacts;
}>;

type TerminalAttentionRun = Readonly<{
  firstSequence: number;
  count: number;
  kind: 'bell' | 'error';
}>;

type TerminalAttentionBatch =
  | Readonly<{
      outcome: 'events';
      firstSequence: number;
      lastSequence: number;
      // Fixed profile limit; adjacent same-kind events form one run.
      runs: readonly TerminalAttentionRun[];
    }>
  | Readonly<{
      outcome: 'overflow';
      firstSequence: number;
      lastSequence: number;
      bellCount: number;
      errorCount: number;
      reason: 'consumer-backpressure';
    }>;

type TerminalSessionConnection = Readonly<{
  // Module-issued; one per process session. Binding identity is session-scoped.
  sessionConnectionId: string;
  sessionId: string;
  initialBackendBindingId: string;
  onAttentionBatch(
    sessionConnectionId: string,
    sessionId: string,
    batch: TerminalAttentionBatch
  ): void;
}>;

type TerminalBindingResult =
  | Readonly<{
      requestId: string;
      status: 'applied';
      previousBackendBindingId: string;
      currentBackendBindingId: string;
      reason: null;
    }>
  | Readonly<{
      requestId: string;
      status: 'rejected';
      currentBackendBindingId: string;
      reason:
        | 'stale-binding'
        | 'binding-id-reused'
        | 'binding-transition-pending'
        | 'session-closing';
    }>;

type TerminalSurfaceConnection = Readonly<{
  // Issued and retired by the Module; callback closures reject any retired identity.
  connectionId: string;
  requirement: TerminalSurfaceRequirement;
  initial: TerminalSurfaceUpdate;
  // generation is the policy generation under which the event/probe began.
  onFacts(connectionId: string, generation: number, facts: TerminalSurfaceFacts): void;
  onResizeRequest(connectionId: string, generation: number, dimensions: TerminalDimensions): void;
  // Completion may be observed by a retired view but always settles the session coordinator.
  onResizeResult(connectionId: string, result: TerminalResizeResult): void;
}>;

type TerminalSurfaceLease = Readonly<{
  update(update: TerminalSurfaceUpdate): void;
  requestKey(generation: number, intent: TerminalKeyIntent): void;
  // The retained owner/session coordinator serializes across replacement views.
  requestResize(size: TerminalSize): void;
  snapshot(): TerminalSurfaceSnapshot;
  // View cleanup only; cannot release resize ownership.
  dispose(): void;
}>;

type TerminalViewAttachResult =
  | Readonly<{ status: 'attached'; lease: TerminalSurfaceLease; reason: null }>
  | Readonly<{
      status: 'unavailable';
      lease: null;
      reason: 'owner-identity-mismatch' | 'view-already-attached' | 'owner-releasing';
    }>;

type TerminalOwnerReleaseResult =
  | Readonly<{ status: 'released'; reason: null }>
  | Readonly<{ status: 'rejected'; reason: 'view-active' }>;

type TerminalResizeOwnerLease = Readonly<{
  // Exact identity match and one active view; caller disposes before reattach/release.
  attachView(connection: TerminalSurfaceConnection): TerminalViewAttachResult;
  // Active view rejects. Otherwise settles resize/releases owner; session stays alive.
  release(): Promise<TerminalOwnerReleaseResult>;
}>;

type TerminalResizeOwnerResult =
  | Readonly<{
      status: 'acquired' | 'existing';
      // `existing` returns the exact previously acquired lease; never a second lease.
      owner: TerminalResizeOwnerLease;
      reason: null;
    }>
  | Readonly<{
      status: 'unavailable';
      owner: null;
      reason: 'resize-unavailable' | 'resize-owner-conflict' | 'owner-releasing';
    }>;

type TerminalSessionCloseResult = Readonly<{
  status: 'closed';
  engineDisposition: 'disposed-created' | 'detached-borrowed';
}>;

type TerminalSessionLease = Readonly<{
  acquireResizeOwner(terminalInstanceId: string): TerminalResizeOwnerResult;
  replaceBinding(
    request: Readonly<{
      requestId: string;
      expectedBackendBindingId: string;
      nextBackendBindingId: string;
      oldOutput: 'drain-to-eof' | 'revoke-and-drop';
    }>
  ): Promise<TerminalBindingResult>;
  // Idempotent process-end cascade: view -> owner/resize -> output/attention -> engine.
  close(): Promise<TerminalSessionCloseResult>;
}>;

type TerminalSessionBindResult =
  | Readonly<{
      status: 'bound' | 'existing';
      // existing returns exact same lease; Host resolves ownership, not App input.
      session: TerminalSessionLease;
      engineOwnership: 'capability-created' | 'borrowed';
      reason: null;
    }>
  | Readonly<{
      status: 'unavailable';
      session: null;
      engineOwnership: null;
      reason:
        | 'engine-unavailable'
        | 'engine-session-mismatch'
        | 'backend-binding-unavailable'
        | 'binding-id-reused'
        | 'output-channel-unavailable'
        | 'attention-channel-unavailable'
        | 'session-identity-conflict'
        | 'session-closing'
        | 'session-closed';
    }>;

type TerminalSurfaceHost = Readonly<{
  bindSession(connection: TerminalSessionConnection): TerminalSessionBindResult;
}>;
```

A fake binds via result and tracks live/closing/closed tombstones, engine affinity, binding reservation, and resize-revision high watermark. Exercise:

1. resolver returns borrowed engine affine to another session: bind rejects engine-session-mismatch/no backend activation/subscriptions. Engine/initial-binding/output/attention failures likewise exact/no resources; valid bind works;
2. exact bind retry while live returns same lease/ownership. Start close then retry exact bind: session-closing. After close, same ID retry: session-closed. Neither permits backend first byte or new resources; session ID cannot be reused;
3. same live session changed connection/initial binding conflicts; binding ID reuse rejects;
4. with current binding2, request r1 replace ->3 and hold drain. Concurrent r2 expected2 ->4 rejects binding-transition-pending immediately/no Host work/queue; r1 applies and releases reservation. Later r3 expected2 stale rejects; request IDs/results correlate. Repeat revoke path and close-race session-closing;
5. attention normal/overflow bounds and invariants;
6. owner/view: active-view release rejects, then dispose and release pending resize; session I/O continues;
7. allocate resize revision 1, retain owner across view/reconnect, attempt revision1 duplicate, 0, unsafe, and decreasing after revision3; each invalid-revision/null effective/no coordinator/backend mutation. Revision2 then3 apply in strict order; replacement cannot reset high watermark;
8. session close unexpectedly cascades active children; output binding drains EOF before retirement; attention drains; handles inert;
9. created engine disposed once; borrowed same-session engine detached not disposed; external owner usable; close idempotent;
10. restart fresh session/engine/binding; private input/policy/Focus/mouse/F6/dimension/stale/support cases;
11. no raw host/I/O/engine/ownership/epoch/lease crosses authoring.

This makes bind affinity and closed retry, serialized binding replacement, monotonic resize revision, plus bounded attention/child close/ownership and core Terminal boundary executable. It does not prove real host behavior.

## Input, shortcut, and focus policy

- **IME/private input:** physical input never Module/event/log; active view checks policy/current session binding and writes once. No view/closing session rejects. App key request outbound only.
- **Mode/process:** exit revokes input immediately while output binding stays `drain-to-eof` until EOF/queued parse/attention settle. Reconnect uses `replaceBinding`; restart new session. Read-only/disabled and Focus eligibility explicit.
- **Key versus text:** committed Unicode uses text; bounded non-text/modifier keys use `TerminalKey`. Letter/digit key intents require Ctrl/Alt/Meta; unmodified/Shift-only printable input uses text. Unsupported keys defer; no host event/raw encoding crosses.
- **Shortcut order:** configured Harness command wins before engine; other accepted keys fall through once. Host reports whether required F6/Shift+F6 reservation is available.
- **Escape route ownership:** bare Escape is terminal input. Host reports `keyboardRoute`; composition owns/requires reachable enabled leave Button and Focus topology. Either failure blocks composed acceptance.
- **Ctrl/Meta/Alt:** no blanket interception; only registered Harness chords stay local.
- **Paste:** App/host owns Clipboard/policy; committed paste routes only in interactive mode. Paths are text, not authority.
- **Pointer/mouse:** first slice requires Host suppression of engine terminal mouse reports even if the process enables them; pointer events produce zero backend writes while engine-local selection may remain. Custom mouse reporting is option D.
- **Mobile/virtual keyboard:** tapping may request host IME in interactive/read-only as appropriate. App-composed special-key Button uses `requestKey`; engine encodes only in interactive mode. Otherwise zero backend writes or explicit unavailable.

## Accessibility boundary

- The A11y domain supplies accessible name/description/mode to the resolved terminal target; App/Module facts and composition report independent connection/process/display status, focus entry, and the reliable exit control. Terminal patches do not duplicate A11y naming.
- The engine/Host Capability owns the mutable screen representation, cursor/selection mapping, row navigation, terminal modes, and platform accessibility API. Proto UI does not set a generic `textbox`, `application`, or `log` role for every terminal host.
- Streaming grid stays engine-local. Attention delivery is bounded: profile limits runs per batch and pending batches; normal batches preserve contiguous ordered runs, overflow preserves first/last sequence plus bell/error totals and explicitly signals interleaving loss. App presentation may further dedupe effects; callback count/memory remain bounded.
- Engine-local keyboard selection and copy remain available when the host supports them. Any composition-provided Copy/Search control is a separately admitted ordinary Proto UI control invoking a host/App request; selected text and Clipboard contents stay outside portable state.
- Zoom, reflow, font metrics, glyph width, high contrast, cursor contrast, selection contrast, and screen-reader row geometry remain host/engine responsibilities. Resize results expose rows/columns plus acknowledged revision and applied/rejected outcome. Reduced-motion policy disables or reduces visual bell/cursor animation through host settings; the semantic attention fact is unchanged.
- A non-Web profile may use UI Automation or another native accessibility API and may degrade explicitly. Passing WC/React/Vue tests on the Web host cannot establish non-Web conformance.

## Performance, scrollback, and lifecycle

### High-frequency threshold

The portable content threshold is zero grid diffs. Lifecycle/support/binding/resize results are ordered. Attention is not one callback/event: bounded batches preserve ordered consecutive runs; overflow is an explicit bounded degradation with sequence range/counts. Only equivalent level facts coalesce. Physical input has no observation.

No portable Module receives `onRender`, `onWriteParsed`, buffer lines, dirty rectangles, glyph runs, or scroll positions. This avoids allocation/copy churn and prevents adapter profiles from re-litigating a grid schema.

Terminal scrollback is engine-owned. #521 windowed Collection applies to authored logical lists/logs, not a terminal buffer, cursor-addressed screen, alternate screen, or selection. A later App-exported immutable log snapshot may use Code Block/windowing after it leaves terminal semantics; that does not move live scrollback into Collection.

### Lifecycle rules

- Bind validates resolved engine session affinity before activation, including borrowed engine. Failure exact/no resources. Exact immutable retry returns existing only while live. Closing/closed tombstone returns session-closing/session-closed; session IDs never reuse. Changed live identity conflicts.
- Session owns current binding and atomically reserves at most one replacement. Request/result IDs correlate. Competing request rejects binding-transition-pending without queue/Host work; result/close releases reservation. Expected/non-reused IDs validate; input blocked; drain/revoke completes before switch.
- Owner/view below session. Release rejects active view; close cascade disposes view then settles owner resize.
- Output draining accepts old ID until EOF/queued bytes/attention settle, then retires. Attention fixed bounded batches/overflow.
- Session close idempotent; created engine disposed once; borrowed engine only detached. Descendants reject.
- Resize revision is Module-owned positive safe monotonic per terminal instance across view/reconnect. Coordinator tracks high watermark; invalid/duplicate/decreasing rejects before coordinator/backend and cannot reset on replacement. Dimensions validated separately; one in-flight.
- View systems scoped; session I/O scoped; restart new session; reconnect binding update.

## Proposed entity and evidence graph

If a maintainer accepts semantic admission in a later checkpoint, the smallest coherent graph is:

```text
C-TERMINAL-SURFACE-0001 (draft contract)
  <- satisfied by M-TERMINAL-SURFACE-0001
       -> requires HC-TERMINAL-SURFACE-0001
  <- verified by T-TERMINAL-SURFACE-0001

K-HOST-SURFACE-ROLES-0001
C-HOST-SURFACE-PROJECTION-0001
C-FOCUS-0001 / C-A11Y-0001
  <- referenced/depended on by the new contract as applicable

A-REACT-18-19-0001
  -> may later support M-TERMINAL-SURFACE-0001 and provide
     HC-TERMINAL-SURFACE-0001 only after reviewed Web evidence
```

No new Adapter identity is justified: React Web already has `A-REACT-18-19-0001`; a later non-Web implementation must bind to its own concrete profile. No public Prototype is justified by this research alone. Prototype identity/anatomy and composition chrome require a separate admitted authoring slice after the Module/Host Capability boundary is accepted.

### Bounded red-first plan

1. **Portable negatives:** no raw I/O/engine/ownership/epochs/leases/input observation.
2. **Session bind:** cross-session borrowed-engine mismatch and all resolver failures before activation; live exact existing; closing/closed retries reject; changed identity conflict; created/borrowed.
3. **Binding:** request correlation; atomic one-pending reservation; concurrent pending rejection/no queue; stale/reused/close results; no-owner drain/revoke; final EOF.
4. **Attention:** fixed normal/overflow invariants/bounds/gaps.
5. **Owner/view/close:** release active-view reject; cascade/await children; inert handles; idempotent close.
6. **Resize/input/systems:** positive safe strictly increasing per-instance revision across replacements; duplicate/decreasing/invalid rejects before backend; dimensions/serialization; private input/modes/mouse/Focus/A11y/restart.
7. **Real Web:** bind close race/affinity; overlapping binding replacements; resize revision high watermark; final drain/attention/borrowed ownership/owner-view cleanup.
8. **Cross-adapter Web only if claimed:** WC/React/Vue evidence from one authoring source remains Web evidence.
9. **Non-Web:** independent native profile proves session bind/ownership/binding/attention/close and native input/resize/A11y before multi-host language.

## #513/#514 matrix consumption

PR #563 currently carries the intended authoritative file `internal/agent-harness/dogfood-coverage-matrix.md`, but it is not on `main`, is conflicting, and has an active `CHANGES_REQUESTED` review. This record must not copy that full matrix or create a second source of truth.

When the matrix carrier lands, a follow-up #530 carrier must update exactly these rows:

- `harness.future.terminal-chrome`: replace the pending-owner text with the option-C recommendation; keep state `research` until semantic admission, link this record as current evidence, name the proposed Module/Host Capability checkpoint, and trigger re-review on admission outcome, input/selection/mouse scope expansion, or a non-Web claim.
- `harness.future.terminal-engine`: retain `infrastructure-exempt`; replace “pending #530 ruling” with the settled exemption for engine/PTY/grid/scrollback/selection internals; state that engine selection, executable backend binding, message/input scope expansion, or ownership leakage triggers re-review.
- Recompute only the matrix totals if a state changes. This record recommends no state-count change yet.

#513 should receive a link to the landed record and matrix carrier; #514 remains the owner of the single matrix document. Until that projection lands, #530 is advanced rather than closed.

## Acceptance mapping

- Responsibility table covers App/backend, engine, Proto UI semantic owner, Host Capability/Adapter, and composition/design language, including trust exclusions.
- Options A-D are compared; C is the smallest admissible proposal and D is explicitly deferred.
- Input/shortcut/IME, accessibility, resize, performance, scrollback/windowing, lifecycle, and cleanup are bounded above.
- Code Block remains an honest static/log fallback; Textarea remains a plain-text control. Neither is expanded.
- No raw terminal engine, PTY, transport, target, buffer, grid, or host object enters portable authoring.
- The conclusion is one `next proposal checkpoint`; no materially different viable owner remains unresolved in this packet.
- The exact #513/#514 matrix rows and re-review triggers are identified; landing them remains the next #530 carrier because their authoritative file is not yet on `main`.

## Residual risks and smallest human decision

Residual risks: accessible terminal behavior varies substantially by engine/platform; terminal keymaps conflict with Harness commands; resize and Unicode cell-width behavior are engine-specific; a future engine may not expose a clean injected backend sink; sensitive input and screen text may make diagnostic snapshots inappropriate.

Smallest later human decision: accept or reject admission of the proposed `C-*` / `M-*` / `HC-*` / `T-*` graph for option C with the exclusions above. Acceptance would authorize a separate spec proposal, not an engine choice or implementation. Rejection leaves option A plus private infrastructure embedding and ordinary Proto UI chrome.
