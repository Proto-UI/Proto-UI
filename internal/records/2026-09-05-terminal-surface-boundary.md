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
| App/backend | Runtime registry epoch + monotonic session sequence; per-session monotonic binding sequence; process/PTY/input/output lifecycle; authorization/reconnect/audit/restart. | Bounded IDs/results/actions. | Raw I/O/process/token. |
| Engine infrastructure | Parser/grid/modes/scrollback/render/A11y; atomic parser-ground reset for drop/forced close; created-vs-borrowed ownership. | Host-private routes. | Engine/target/controller/raw I/O. |
| Proto UI Terminal owner | Module session/owner/view identities; view policy/facts; bounded resize/attention results. | Plain bounded values + Focus. | Grid/raw I/O/host objects/engine ownership/process authority. |
| Terminal Host Capability | Bounded registry; bind/replace/close; channel preflight/fail-closed; parser reset; owner exact identity; one view; resize latest slot/high watermark/facts; bounded attention; child cleanup/borrowed detach. | Immutable structured IDs, requests/results/callbacks/resolvers. | No raw I/O/leases authoring; no unbounded tombstones/queues/allocations. |
| Adapter profile | Materialize targets, wire capability/lifecycle/Focus. | Governed requirement after evidence. | No semantic reinterpretation/support claim early. |
| Composition | Chrome/status/controls/attention presentation. | App facts/events. | Terminal protocol/process/grid/selection. |

Engine remains infrastructure. Session ID is `{registryEpoch, sequence}`; Host accepts one current registry epoch, caps concurrent sessions at 64, tracks scalar contiguous closed-through plus at most 64 active/out-of-order-close entries, and rotates epoch only when none active, then drops old state. Binding ID is per-session positive monotonic sequence; one high watermark rejects reuse without tombstones. Bind exact retry succeeds only live. Replacement preflights next input/output and parser-reset capability before touching old route; revoke-reset-drop grounds parser before next activation, unexpected post-revoke failure closes session fail-safe. Close has 30s drain deadline then parser-safe forced revoke. Owner retry includes ownerConnectionId. Resize caps 1024 columns, 512 rows, and 262,144 cells before allocation.

## Portable facts, requests, and information paths

### Candidate first-slice values

The proposal may evaluate these plain values; names are illustrative and not an admitted API:

- App input: current registry epoch/monotonic process session sequence; monotonic per-session binding sequence; status/policy. Module mints connection/instance IDs.
- View facts: attachment/composition/applied effective dimensions/support. Session/binding/attention and owner resize results bounded/correlated.
- Requests: bind/replace/close, owner/view/key/resize. Physical I/O private. Focus remains Focus.

Dimensions must be positive integers within first-slice profile: columns 1..1024, rows 1..512, product <=262144. Reject invalid/out-of-range before engine/backend allocation; never clamp by allocating first. Module resize revision is positive safe strictly increasing per instance. Owner holds one in-flight + one latest slot; replacement emits superseded. During release retained slot immediately rejects owner-released and in-flight settles before grant. Facts expose only last applied effective dimensions/revision.

A current accessible text snapshot can be a plain diagnostic/test result, but should not be continuously copied into portable State. The first slice should expose `host-bridge | bounded-snapshot | unavailable` support and prefer a host-owned accessibility bridge. Any later author-facing snapshot request requires a separate privacy, size, cadence, and stale-revision decision.

Selection summaries and copy requests are technically expressible as plain values, but are not needed by option C. The engine keeps default selection/copy behavior. No selected text or Clipboard payload enters portable State. Programmatic selection, search, Clipboard, mouse reporting, and hyperlinks remain option D.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| Session bind | structured session+initial binding -> Host preflight | Exact live existing or bounded failure. Registry memory bounded by 64 concurrent entries + scalar watermark; old epoch stale. | Current registry epoch/session sequence/binding sequence. |
| Binding replace | correlated expected/next monotonic IDs | One pending. Preflight channels/parser reset before old mutation; preflight failure leaves old current. Revoke path grounds parser before new. Unexpected activation/reset failure returns failed-closed/null current and cascades close. | Binding high watermark, request ID, reservation. |
| Process close | revoke input; drain output up to 30s; on deadline revoke/drop and parser-ground reset; cascade children; attention; engine disposition | Never hangs. Final drain or explicit forced disposition. | Close request ID/deadline; created dispose/borrowed detach. |
| Output/input | Session output gate; active-view input | Reconnect safe; no raw portable. | Binding sequence. |
| Geometry/resize | View geometry -> Module validated capped dimensions/revision -> owner | One in-flight+latest; owner result survives view. Release rejects retained slot owner-released and waits in-flight terminal. Facts only applied effective. | OwnerConnection ID + monotonic revision + 1024x512/product cap. |
| Focus/A11y | System domains -> active view over session engine | View-only projection, engine persists. | View epochs. |
| Attention | Session engine -> bounded consecutive runs -> `onAttentionBatch` | Normal batches preserve run order/count; fixed pending capacity. Overflow batch preserves sequence range and bell/error counts while explicitly losing interleaving; no unbounded callback/queue. | Contiguous session sequences; callback retired only after drain; presentation dedupe downstream. |

## Fake-engine / fake-host protocol sketch

The connection callbacks below are Module-to-Host internals. They are not Prototype props and do not make functions or engine values portable.

```ts
type TerminalSessionId = Readonly<{
  registryEpoch: number;
  sequence: number;
}>;
type TerminalBindingId = Readonly<{ sequence: number }>;

type TerminalDimensions = Readonly<{ columns: number; rows: number }>;
type TerminalSize = TerminalDimensions & Readonly<{ revision: number }>;
type TerminalResizeRejectReason =
  | 'invalid-dimensions'
  | 'dimensions-out-of-range'
  | 'invalid-revision'
  | 'resize-unavailable'
  | 'backend-rejected'
  | 'owner-released';

type TerminalResizeSubmission =
  | Readonly<{
      status: 'dispatched' | 'retained-latest';
      revision: number;
      reason: null;
    }>
  | Readonly<{
      status: 'rejected';
      revision: null;
      reason:
        | 'invalid-dimensions'
        | 'dimensions-out-of-range'
        | 'invalid-revision'
        | 'owner-released';
    }>;

type TerminalResizeResult =
  | Readonly<{
      revision: number;
      outcome: 'applied';
      requested: TerminalDimensions;
      effective: TerminalDimensions;
      reason: null;
    }>
  | Readonly<{
      revision: number;
      outcome: 'superseded';
      requested: TerminalDimensions;
      effective: null;
      reason: 'newer-resize';
    }>
  | Readonly<{
      revision: number | null;
      outcome: 'rejected';
      requested: TerminalDimensions;
      effective: null;
      reason: TerminalResizeRejectReason;
    }>;

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
  sessionId: TerminalSessionId;
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
  // Only the last applied result's effective dimensions; never raw target geometry.
  appliedResizeRevision: number | null;
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
  sessionId: TerminalSessionId;
  initialBackendBindingId: TerminalBindingId;
  onAttentionBatch(
    sessionConnectionId: string,
    sessionId: TerminalSessionId,
    batch: TerminalAttentionBatch
  ): void;
}>;

type TerminalBindingResult =
  | Readonly<{
      requestId: string;
      status: 'applied';
      previousBackendBindingId: TerminalBindingId;
      currentBackendBindingId: TerminalBindingId;
      reason: null;
    }>
  | Readonly<{
      requestId: string;
      status: 'rejected';
      currentBackendBindingId: TerminalBindingId;
      reason:
        | 'stale-binding'
        | 'binding-id-reused'
        | 'binding-transition-pending'
        | 'input-channel-unavailable'
        | 'output-channel-unavailable'
        | 'parser-reset-unavailable'
        | 'session-closing';
    }>
  | Readonly<{
      requestId: string;
      status: 'failed-closed';
      currentBackendBindingId: null;
      reason: 'parser-reset-failed' | 'channel-activation-failed';
    }>;

type TerminalSurfaceConnection = Readonly<{
  // Issued and retired by the Module; callback closures reject any retired identity.
  connectionId: string;
  requirement: TerminalSurfaceRequirement;
  initial: TerminalSurfaceUpdate;
  // generation is the policy generation under which the event/probe began.
  onFacts(connectionId: string, generation: number, facts: TerminalSurfaceFacts): void;
  onResizeRequest(connectionId: string, generation: number, dimensions: TerminalDimensions): void;
}>;

type TerminalSurfaceLease = Readonly<{
  update(update: TerminalSurfaceUpdate): void;
  requestKey(generation: number, intent: TerminalKeyIntent): void;
  snapshot(): TerminalSurfaceSnapshot;
  // View cleanup only; owner-scoped resize completion survives.
  dispose(): void;
}>;

type TerminalViewAttachResult =
  | Readonly<{ status: 'attached'; lease: TerminalSurfaceLease; reason: null }>
  | Readonly<{
      status: 'unavailable';
      lease: null;
      reason: 'owner-identity-mismatch' | 'view-already-attached' | 'owner-releasing';
    }>;

type TerminalResizeOwnerConnection = Readonly<{
  ownerConnectionId: string;
  terminalInstanceId: string;
  // Owner-scoped: remains valid across view disposal/replacement.
  onResizeResult(ownerConnectionId: string, result: TerminalResizeResult): void;
}>;

type TerminalOwnerReleaseResult =
  | Readonly<{ status: 'released'; reason: null }>
  | Readonly<{ status: 'rejected'; reason: 'view-active' }>;

type TerminalResizeOwnerLease = Readonly<{
  // Exact identity match and one active view; caller disposes before reattach/release.
  attachView(connection: TerminalSurfaceConnection): TerminalViewAttachResult;
  // One in-flight plus one latest-valid retained slot. Every accepted revision gets a result.
  requestResize(size: TerminalSize): TerminalResizeSubmission;
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
      reason:
        | 'resize-unavailable'
        | 'resize-owner-conflict'
        | 'owner-connection-conflict'
        | 'owner-releasing';
    }>;

type TerminalSessionCloseResult = Readonly<{
  requestId: string;
  status: 'closed';
  outputDisposition: 'drained-to-eof' | 'forced-revoke-reset';
  engineDisposition: 'disposed-created' | 'detached-borrowed';
}>;

type TerminalSessionLease = Readonly<{
  acquireResizeOwner(connection: TerminalResizeOwnerConnection): TerminalResizeOwnerResult;
  replaceBinding(
    request: Readonly<{
      requestId: string;
      expectedBackendBindingId: TerminalBindingId;
      nextBackendBindingId: TerminalBindingId;
      oldOutput: 'drain-to-eof' | 'revoke-reset-and-drop';
    }>
  ): Promise<TerminalBindingResult>;
  // Idempotent cascade; deadline forces parser-safe revoke when EOF/work stalls.
  close(
    request: Readonly<{
      requestId: string;
      outputDeadlineMs: 30_000;
    }>
  ): Promise<TerminalSessionCloseResult>;
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
        | 'parser-reset-unavailable'
        | 'session-identity-conflict'
        | 'session-sequence-reused'
        | 'stale-registry-epoch'
        | 'session-closing'
        | 'session-closed';
    }>;

type TerminalSurfaceHost = Readonly<{
  bindSession(connection: TerminalSessionConnection): TerminalSessionBindResult;
}>;
```

A fake fixes registry/session/binding/dimension bounds and injects channel/parser/EOF failures. Exercise:

1. registry epoch9 accepts positive sessions up to 64. Close sequences out of order and prove scalar closed-through + <=64 bounded entries; after all close rotate epoch10/drop old table. Epoch9 retry stale-registry-epoch; non-increasing sequence session-sequence-reused. Binding high watermark rejects old sequence without tombstones;
2. cross-session borrowed engine and initial resolver/preflight failures reject before activation. Exact bind retry live succeeds; close/closed/identity failures exact;
3. owner acquire exact `{terminalInstanceId, ownerConnectionId}` returns existing. Same terminalInstanceId with new ownerConnectionId returns owner-connection-conflict/no callback rebind/resource. Different instance conflict;
4. binding r1 expected2->3: preflight next input/output/reset. Inject input/output/parser-reset unavailable before drain; reject, release reservation, binding2 remains usable, binding3 never current. Concurrent replacement pending rejects. Successful drain applies;
5. revoke-reset-drop with parser holding partial CSI/OSC prefix: revoke/drop old, atomically reset parser to ground, then activate next; new bytes parse independently. Inject unexpected reset/activation failure after revoke: failed-closed/current null, new backend never activates, session close cascades;
6. close with output EOF: drain. Close with transport never EOF/queued callback stuck: at 30s revoke/drop, reset parser ground, emit forced-revoke-reset disposition, drain bounded attention, finish child/engine cleanup. Borrowed detach preserves externally usable ground-state engine; created disposes once;
7. attention normal/overflow bounds;
8. owner resize A in-flight and B retained; dispose view then call release. Mark owner releasing, immediately emit B rejected owner-released/clear slot/no dispatch, then cancel+await or complete A and deliver its terminal owner result; only then release resolves. Late A cannot affect next owner;
9. resize dimension validation: 1025 columns, 513 rows, or product >262144 rejects dimensions-out-of-range before engine/backend allocation; safe numeric but huge rejects. Boundary limits and smaller product proceed. Invalid/reused revisions reject;
10. A/B/C coalescing, view replacement owner result, clamped applied dimension facts, rejected/superseded preserve prior;
11. private input/Focus/mouse/F6/support/restart; no raw host values.

If implemented as specified, this plan would verify bounded identity retention, replacement preflight/parser grounding/fail-closed, forced close, exact owner retry/release, allocation-safe dimensions, and prior Terminal invariants. This record supplies no executable `T-TERMINAL-*` evidence.

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
- Zoom/reflow/font metrics/glyph width/contrast/screen-reader row geometry remain host/engine. `columns`, `rows`, and `appliedResizeRevision` expose only last applied effective result; clamped effective becomes fact, rejected/superseded/observed geometry preserves prior fact. Reduced-motion presentation does not alter attention batch.
- A non-Web profile may use UI Automation or another native accessibility API and may degrade explicitly. Passing WC/React/Vue tests on the Web host cannot establish non-Web conformance.

## Performance, scrollback, and lifecycle

### High-frequency threshold

The portable content threshold is zero grid diffs. Lifecycle/support/binding/resize results are ordered. Attention is not one callback/event: bounded batches preserve ordered consecutive runs; overflow is an explicit bounded degradation with sequence range/counts. Only equivalent level facts coalesce. Physical input has no observation.

No portable Module receives `onRender`, `onWriteParsed`, buffer lines, dirty rectangles, glyph runs, or scroll positions. This avoids allocation/copy churn and prevents adapter profiles from re-litigating a grid schema.

Terminal scrollback is engine-owned. #521 windowed Collection applies to authored logical lists/logs, not a terminal buffer, cursor-addressed screen, alternate screen, or selection. A later App-exported immutable log snapshot may use Code Block/windowing after it leaves terminal semantics; that does not move live scrollback into Collection.

### Lifecycle rules

- Registry uses structured monotonic IDs, max 64 concurrent sessions, scalar contiguous closed watermark + bounded active/out-of-order entries; epoch rotates only empty and old epoch rejects. Binding high watermark scalar per session. No indefinite tombstone set.
- Bind validates affinity/parser-reset/channel capability before activation. Exact live retry includes all immutable fields. Closing/closed/stale epoch/reuse failures exact.
- Binding replacement reserves one; preflights next input/output/reset before old change. Failure leaves old current/releases. Revoke path resets parser ground before next activate. Unexpected post-revoke failure returns failed-closed/null and closes session; no unusable new current.
- Owner exact retry requires terminalInstanceId + ownerConnectionId; different owner connection conflicts without callback replacement. One view. Owner release rejects active view, rejects/clears retained resize as owner-released, settles in-flight owner result, then releases.
- Close cascades descendants. Output drains while accepted; fixed 30s deadline forces revoke/drop/parser reset so close cannot hang. Created disposed; borrowed unsubscribed and returned ground-state, never disposed.
- Dimensions capped at columns<=1024, rows<=512, product<=262144 before allocation. Resize revision monotonic; one in-flight/latest; owner-scoped results; only applied effective dimensions become facts.
- View systems/session I/O/attention ownership and restart/reconnect remain explicit.

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

1. **Portable negatives:** no raw I/O/engine/leases/input observation; bounded structured IDs.
2. **Identity/session:** registry epoch/sequence and binding high watermarks, 64 bound, epoch rotation; exact live/closing/closed/stale/reuse/affinity bind; ownerConnection exact retry/conflict.
3. **Binding/close:** one pending; channel/reset preflight failure preserves old/releases; revoke parser-ground before activate; unexpected failure closed/null; EOF and never-EOF 30s forced close; created/borrowed.
4. **Attention:** bounded normal/overflow.
5. **Owner/resize:** active view release reject; retained slot owner-released then in-flight settle; result across view; monotonic revision/coalescing/clamp/reject facts; dimension per-axis/product caps before allocation.
6. **Input/systems:** private input, modes/mouse/Focus/A11y/restart.
7. **Real Web evidence to implement:** identity bounds, channel failures, partial escape reset, stuck EOF close, owner connection/release, large dimensions, resize facts, attention/cleanup.
8. **Cross-adapter Web only if claimed:** one authoring source remains Web evidence.
9. **Non-Web:** independent native evidence for session/binding/parser/close/resize/input/A11y.

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
