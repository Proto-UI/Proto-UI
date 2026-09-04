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
| App/backend | Unique `sessionId` per process lifetime; unique non-reused transport `backendBindingId`; process/PTY/input/output epoch lifecycle; authorization; reconnect; audit; explicit stop/restart. Restart creates a new session identity. | Data-only session/binding reference; resize result; bounded actions. | PTY/streams/process/tokens/raw callbacks/bytes. |
| Terminal engine infrastructure | VT/escape parsing; mutable cell grid; cursor and alternate screen; scrollback; reflow; glyph measurement; selection; terminal mouse modes; paste encoding; renderer; engine accessibility buffer; direct high-frequency diffs; session-scoped engine/parser/buffer lifetime. | Host-local target and backend byte/data channels supplied outside Proto UI authoring. | Engine instance, buffer, parser, renderer, DOM/canvas/native view, controller, mutable selection, raw output/input stream. |
| Proto UI Terminal semantic owner | Module-issued instance identity; attachment/display facts; resolved input mode; App-composed bounded key requests; resize correlation; lossless attention callbacks; view identity, policy generation, stale rejection. | Plain immutable facts/requests plus Focus identity/epoch/eligibility; Focus sole fact owner. | Grid/scrollback/raw bytes or input text/keys, host events/geometry, engine/controller, App owner identity, Focus facts, credentials/process authority. |
| Terminal Surface Host Capability | Acquire/idempotently return one owner; maintain one view; reject mismatches/repeat/releasing; keep output epoch subscription session/owner-scoped across target-view gaps; keep input view-scoped; gate both by binding; private input write; resize/attention/A11y/cleanup; await release. | Immutable IDs/policy/non-input callbacks/resolvers. | No raw host/backend/input/epoch; no second owner lease; no view cleanup of output route; no output loss/mix. |
| Adapter profile | Materialize `boundaryTarget` and actual presentation/input/a11y targets; wire the Host Capability; translate lifecycle and Focus participation. | Governed Module requirement and capability token after admission. | No semantic reinterpretation and no support/provision relation before profile-specific evidence. |
| Composition/design language | Tabs, toolbar, label, connection badge, reconnect/close, status, search/copy controls when separately admitted, visible leave-terminal control. | App facts and ordinary Proto UI control events. | Terminal protocol, key encoding, PTY/process control, buffer/selection state, engine-owned accessibility tree. |

Engine remains outside Proto UI. Host resolves session engine/coordinator and one owner-scoped output epoch subscription by process-lifetime `sessionId`; view leases own only target/input/Focus/A11y/geometry bindings. Target-only view disposal/replacement leaves output subscription active so bytes continue into preserved engine during gap. Transport reconnect changes unique `backendBindingId` through drain-or-revoke epoch barrier. Repeated owner acquisition for same `{sessionId, terminalInstanceId}` returns exact existing owner lease object without allocation; different instance conflicts; releasing identity rejects. Restart uses new session/engine/coordinator/binding. Nothing crosses portable authoring.

## Portable facts, requests, and information paths

### Candidate first-slice values

The proposal may evaluate these plain values; names are illustrative and not an admitted API:

- App input: process-lifetime `sessionId`, per-transport unique `backendBindingId`, resolved input mode, statuses, shortcut policy. Module mints instance ID. Restart must use new session ID; reconnect alone may preserve it. Name/description remain A11y.
- Host facts: attachment, composition, dimensions, input/resize/A11y/keyboard/mouse support and resize outcome. Focus/App status/title stay their owners.
- Requests/results: App-composed bounded key request, serialized resize result, and every attention/error callback. Physical committed text/key input stays Host/engine-private and goes only to backend. Focus remains Focus.

`columns` and `rows` must be finite positive safe integers. The Module/Host rejects `0`, negatives, fractions, `NaN`, `Infinity`, and values above the safe-integer range as `invalid-dimensions` before allocating a resize revision, mutating the coordinator, or calling engine/backend; pixels, rectangles, font metrics, device scale, observers, and layout objects remain host-local. The first slice admits exactly one active Module-issued `terminalInstanceId` resize owner per `sessionId`. A Host session coordinator atomically grants a separate owner lease before any view can become ready and rejects a different live instance with `resize-owner-conflict`. Disposing/replacing a view cannot release the owner; same-instance replacement attaches through the retained owner lease. Explicit final instance release waits for pending resize settlement, then permits another instance to acquire. The coordinator permits at most one unresolved resize across the owner's old/replacement views and retains only newest valid geometry while pending. A resize becomes fact only after Host completion with Module revision/effective dimensions; only then may retained newest size dispatch. Replacement must cancel+await, or await completion and reapply newest size, before ready. Thus old work cannot execute after new, duplicate App IDs cannot alias ownership, and differently sized instances cannot fight over one PTY. Terminal-controlled title stays outside portable facts.

A current accessible text snapshot can be a plain diagnostic/test result, but should not be continuously copied into portable State. The first slice should expose `host-bridge | bounded-snapshot | unavailable` support and prefer a host-owned accessibility bridge. Any later author-facing snapshot request requires a separate privacy, size, cadence, and stale-revision decision.

Selection summaries and copy requests are technically expressible as plain values, but are not needed by option C. The engine keeps default selection/copy behavior. No selected text or Clipboard payload enters portable State. Programmatic selection, search, Clipboard, mouse reporting, and hyperlinks remain option D.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| App connection/process facts | App/backend closes input/output before exit; Module disabled+Focus-ineligible | Target-view replacement does not close session output. Reconnect uses epoch barrier. Restart new session/engine/binding. | Process session vs transport epoch vs view lifetime remain distinct. |
| Output bytes/VT data | Active owner-scoped backend subscription -> epoch gate -> session engine parser | Continues while no view is attached; target replacement loses zero bytes. Reconnect drains old before new or revokes/drops+awaits; only current binding parses. | Owner/session lifetime; non-reused binding barrier; zero portable bytes/grid. |
| IME/text/key input | Active view target -> Host/engine -> binding | View-scoped; generation/mode/process/binding checked; private write once; no observation. View gap/read-only/disabled/revoked zero. | Connection/policy + binding epoch; raw input never Module. |
| Harness shortcut | Host arbiter -> App command | Command, no terminal forwarding. | Before engine. |
| Terminal key | Host fallthrough -> engine -> backend | Encoded once, no semantic callback. | Same event under accepted policy/live epoch. |
| Host geometry | Active Module-issued instance -> target/font/DPR observers -> owner lease/session coordinator -> engine/backend resize | Coordinator rejects another instance for same session; owner keeps engine/process rows/columns converged with one mutation across old/replacement views; result carries Module revision/effective dimensions. | Atomic owner grant by `{ sessionId, terminalInstanceId }`; valid dimensions only; old operation completes/cancels before owner release, replacement ready, or newest retained dispatch. |
| Focus request or user entry | Focus domain eligibility/topology/request -> Host Capability's focus bridge -> physical engine input target | One focused logical terminal surface; `disabled` rejects entry, while focus facts return only through Focus. | The runtime commits resolved input mode and Focus eligibility together; current Focus/view epoch; Terminal facts do not duplicate focused state. |
| Accessible terminal content | Engine buffer -> host accessibility bridge | Platform screen reader navigates bounded/current content. | Host accessibility lifecycle; not generic Proto State. |
| Bell/error | Engine/host -> lossless ordered `onAttention` callbacks -> App/composition presentation policy | Every occurrence is delivered/countable; audible/visual/status presentation may rate-limit or deduplicate identical signals for user comfort without deleting protocol/audit occurrences. | Connection/generation and callback order; presentation dedupe is downstream, not callback coalescing. |

## Fake-engine / fake-host protocol sketch

The connection callbacks below are Module-to-Host internals. They are not Prototype props and do not make functions or engine values portable.

```ts
type TerminalDimensions = Readonly<{ columns: number; rows: number }>;
type TerminalSize = TerminalDimensions & Readonly<{ revision: number }>;
type TerminalResizeRejectReason = 'invalid-dimensions' | 'resize-unavailable' | 'backend-rejected';

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
  // Module IDs are immutable; backendBindingId is unique and never reused per epoch.
  terminalInstanceId: string;
  sessionId: string;
  backendBindingId: string;
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
  onAttention(connectionId: string, generation: number, kind: 'bell' | 'error'): void;
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

type TerminalResizeOwnerLease = Readonly<{
  // Exact identity match and exactly one active view; caller disposes before reattach.
  attachView(connection: TerminalSurfaceConnection): TerminalViewAttachResult;
  // Resolves only after pending resize settles and grant releases.
  release(): Promise<'released'>;
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
        | 'engine-unavailable'
        | 'engine-session-mismatch'
        | 'resize-unavailable'
        | 'resize-owner-conflict'
        | 'owner-releasing';
    }>;

type TerminalSurfaceHost = Readonly<{
  acquireResizeOwner(identity: {
    terminalInstanceId: string;
    sessionId: string;
  }): TerminalResizeOwnerResult;
}>;
```

A fake Module mints ID. Host registry atomically keys owner by `{sessionId, terminalInstanceId}`: first valid acquire returns acquired; repeated same identity returns existing with strict same lease object and no resolver/listener/allocation; different ID conflicts; releasing identity returns owner-releasing. Owner holds engine/coordinator/output epoch independent of view; exactly one view owns target/input/geometry. Target-only disposal leaves output subscription alive. Attach validates identity/repeat. Release awaits resize and output epoch close. Restart new session. Attention lossless; input unobserved. Exercise:

1. owner failures exact/no grant; later valid works;
2. acquire instance7/session7, immediately repeat identical acquire; get status existing and object identity equality with first owner, resolver/resource counts unchanged. Attempts to attach via either reference share one active-view guard; second attach rejects view-already-attached;
3. attach matching backend2 gen1; ordered facts/snapshot; mismatched identity rejects;
4. dispose target view while backend2 outputs A/B/C during gap; no input accepted, but owner-scoped output parses all bytes into engine in order. Attach replacement view with same binding and prove grid/modes include gap output, exactly one input/geometry bridge;
5. during owner release attach/acquire same identity returns owner-releasing; distinct instance conflicts; view dispose never releases;
6. unresolved resize then release promise pending/blocks; settles then next owner; late result no overwrite;
7. backend2 -> backend3 reconnect: drain and revoke/drop paths; late old rejects before parser; owner output subscription switches atomically and view replacement loses none;
8. exit closes owner output + view input, disabled Focus. Binding-only restart on session7 rejects; await release/engine cleanup; new session8/engine/coordinator/owner/backend4 reset grid/parser/modes;
9. stale generations ignored; Focus modes correct;
10. sensitive private input zero Module/log callbacks; mobile key outbound once;
11. mouse/F6; invalid dimensions; serialized resize/reconnect; target state; engine/session affinity/support failures;
12. same-turn lifecycle/support ordered; two bells+two errors four callbacks while presentation may dedupe effects;
13. leave Button/Focus topology failure/success;
14. dispose view zero effects while output can continue; await final release closes output, then another acquires;
15. no raw host/backend/input/epoch/grid/owner portable.

This makes idempotent owner acquisition, output continuity across view gaps, one active view, restart reset, private input, attention ordering, await release, identity/epoch/resize/Focus/A11y cleanup testable. It does not prove real host behavior or Adapter conformance.

## Input, shortcut, and focus policy

- **IME/private input:** candidate UI Host-owned. Physical committed text/key never enters Terminal Module, event, fact, callback, log, or diagnostic; Host checks policy/process/binding then engine encodes/writes private sink exactly once. Sensitive password/token input produces zero semantic observation. App-composed `requestKey` stays a bounded outbound request and is not an input echo.
- **Resolved input/process:** interactive only live process/binding; read-only selection no input; disabled Focus-ineligible. Exit closes both routes before status, then disabled. Reconnect same process uses fresh binding after barrier. Restart requires new process-lifetime `sessionId`, fresh owner/engine/coordinator/binding, and reset state before interactive; old session cannot reactivate.
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
- Streaming screen diffs never feed Proto live region. Host bridge may announce bounded output per engine/platform policy. Every bell/error callback remains lossless/countable; App presentation alone may rate-limit/deduplicate audible, visual, or announced effects while preserving semantic callback/audit count.
- Engine-local keyboard selection and copy remain available when the host supports them. Any composition-provided Copy/Search control is a separately admitted ordinary Proto UI control invoking a host/App request; selected text and Clipboard contents stay outside portable state.
- Zoom, reflow, font metrics, glyph width, high contrast, cursor contrast, selection contrast, and screen-reader row geometry remain host/engine responsibilities. Resize results expose rows/columns plus acknowledged revision and applied/rejected outcome. Reduced-motion policy disables or reduces visual bell/cursor animation through host settings; the semantic attention fact is unchanged.
- A non-Web profile may use UI Automation or another native accessibility API and may degrade explicitly. Passing WC/React/Vue tests on the Web host cannot establish non-Web conformance.

## Performance, scrollback, and lifecycle

### High-frequency threshold

The portable threshold for terminal content is zero cell/row/grid diffs. Attachment/lifecycle/status/support transitions, every attention callback, and resize/request results are lossless/ordered and bypass frame coalescing. Only equivalent same-generation level facts may dedupe per frame. Two same-turn bells therefore invoke `onAttention` twice; presentation may coalesce effects downstream. Physical input has no Module observation channel.

No portable Module receives `onRender`, `onWriteParsed`, buffer lines, dirty rectangles, glyph runs, or scroll positions. This avoids allocation/copy churn and prevents adapter profiles from re-litigating a grid schema.

Terminal scrollback is engine-owned. #521 windowed Collection applies to authored logical lists/logs, not a terminal buffer, cursor-addressed screen, alternate screen, or selection. A later App-exported immutable log snapshot may use Code Block/windowing after it leaves terminal semantics; that does not move live scrollback into Collection.

### Lifecycle rules

- Host owner registry keys Module ID/session. First valid acquire returns acquired; repeated same identity returns exact existing lease without resource allocation; releasing returns owner-releasing; other instance conflicts. Owner engine/coordinator/output subscription is unique.
- Owner permits exactly one view. Attach rejects mismatch, repeated active view, or releasing. Dispose old view before replacement avoids duplicate input/geometry.
- View dispose never releases owner or owner-scoped output subscription. Await release blocks work/attach/acquire, closes output epoch and settles resize before grant; late completion cannot affect next owner.
- Callbacks connection/generation; no input callback; snapshots versioned; attention each occurrence; presentation dedupe only.
- Output subscription is owner/session-scoped and remains active during target-only view gaps; input/Focus/A11y/geometry are view-scoped. Gap bytes continue into engine in order. Reconnect changes binding via drain or revoke/drop+await; queued callbacks recheck. Exit/final release closes output.
- View dispose removes target input/listeners/Focus/geometry/A11y/renderer refs only; not backend output subscription, engine/coordinator/owner/parser/grid/process.
- Session process-lifetime; reconnect preserve engine/output subscription with new binding. Restart awaits release/cleanup then new session/engine/binding reset.
- Session teardown closes view input and owner output, disposes view, awaits owner, releases engine. Borrowed affine.
- Backend reconnect validates owner/view, atomically switches owner output epoch, fresh binding, preserves engine, waits resize settle/reapply.
- Coordinator validates dimensions/one resize. Lifecycle/support/attention ordered.

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

1. **Portable negatives:** reject raw host/input/output/epoch/owner; no input observation/identity mutation.
2. **Owner/views:** acquisition failures; repeated same identity returns exact existing lease/no allocation; releasing/different conflict; mismatch/repeated view reject; one view; await release; cleanup.
3. **Input/output/restart:** owner-scoped output survives target-view gap and proves bytes preserved; view-scoped input absent in gap; reconnect epoch paths/late reject; exit close; restart new reset session; sensitive input private.
4. **Mouse exclusion:** block reports/backend; selection local.
5. **Resize:** invalid/boundary; owner conflict; one in-flight; replacement/newest/release exact.
6. **Performance/order:** zero content; only levels coalesce; lifecycle/support/results/attention ordered and counted.
7. **A11y/composition/Focus:** A11y/Focus view-scoped; App status; keyboard/Button/topology; attention effects.
8. **Real Web:** same-owner reacquire object/resource identity; output during target gap; repeated view/await release; output reconnect/restart reset; private input; dimensions/lifecycle/attention/modes/A11y/cleanup.
9. **Cross-adapter Web only if claimed:** WC/React/Vue evidence for one admitted portable authoring source. This remains Web evidence.
10. **Non-Web:** independent native profile with native focus/input/resize/accessibility evidence before any multi-host statement.

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
