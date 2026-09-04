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
- `C-FOCUS-0001-B/C/D/G` distinguishes focus facts/requests/topology/policy, keeps fact ownership in Focus, and lets entry regions delegate without creating Terminal-specific focused state.
- `C-A11Y-0001-B/D/E/G/H/I` and `HC-A11Y-0001` govern semantic-object name/description/state/relation facts, state-backed mode, updated name/description projection, and native/degraded host projection; Terminal patches do not form a second A11y channel.
- `C-SCROLL-0001-D/E`, `M-SCROLL-0001-E`, and `HC-SCROLL-SURFACE-0001-D/E` keep geometry and high-frequency host facts behind a lease and require stale-callback suppression and cleanup.
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
| App/backend | Session identity; process/PTY lifecycle; command authorization; transport; reconnection; permissions; audit; authoritative connection/process state; explicit stop/restart. | Data-only terminal session reference; normalized resize request/result; bounded action requests. | PTY handles, pipes, sockets, streams, process handles, authorization tokens, raw transport callbacks. |
| Terminal engine infrastructure | VT/escape parsing; mutable cell grid; cursor and alternate screen; scrollback; reflow; glyph measurement; selection; terminal mouse modes; paste encoding; renderer; engine accessibility buffer; direct high-frequency diffs. | Host-local target and backend byte/data channels supplied outside Proto UI authoring. | Engine instance, buffer, parser, renderer, DOM/canvas/native view, controller, mutable selection, raw output/input stream. |
| Proto UI Terminal semantic owner | One logical surface identity; attachment/display facts; resolved input mode; focus requests/facts through Focus; committed text/key intent; resize correlation; bounded attention/error; lease identity and stale-result rejection. | Plain immutable facts and requests only. | Cell/grid/scrollback, raw bytes, host events/geometry, engine modes/controllers, App credentials or process authority. |
| Terminal Surface Host Capability | Resolve target plus session-affine engine and immutable backend binding; attach; bridge keyboard/IME/focus; report keyboard-route support; suppress terminal mouse reports while preserving local selection; compute/apply resize; expose native accessibility; route input once; own/clean resources. | Immutable session/backend requirement, mutable plain patch, callbacks, and adapter-injected resolver. | No raw target/engine/backend sink in portable authoring; no cross-session engine reuse without complete recreation/reset evidence. |
| Adapter profile | Materialize `boundaryTarget` and actual presentation/input/a11y targets; wire the Host Capability; translate lifecycle and Focus participation. | Governed Module requirement and capability token after admission. | No semantic reinterpretation and no support/provision relation before profile-specific evidence. |
| Composition/design language | Tabs, toolbar, label, connection badge, reconnect/close, status, search/copy controls when separately admitted, visible leave-terminal control. | App facts and ordinary Proto UI control events. | Terminal protocol, key encoding, PTY/process control, buffer/selection state, engine-owned accessibility tree. |

The engine can remain completely outside Proto UI. Host configuration resolves one session-affine engine and backend sink from opaque `sessionId` plus `backendBindingId`; neither object crosses portable authoring.

## Portable facts, requests, and information paths

### Candidate first-slice values

The proposal may evaluate these plain values; names are illustrative and not an admitted API:

- App input: opaque `sessionId` and `backendBindingId`, resolved `inputMode: interactive | read-only | disabled`, independent connection/process status, and shortcut-policy ID. Name/description remain A11y facts.
- Host facts: attachment, composition, dimensions, input/resize/accessibility/keyboard-route/mouse-reporting support with bounded reasons, and revision-bound resize outcome. Focus remains in Focus; title stays host-local.
- Requests/results: committed text, bounded key intent/special-key request, resize with applied/rejected result, and attention/error. Focus/blur remain Focus requests.

`columns` and `rows` are neutral positive integer character-cell counts. Pixels, rectangles, font metrics, device scale, observers, and layout objects remain host-local. A resize request is not a fact until the host/backend reports an applied/rejected result carrying the acknowledged revision and effective dimensions; older results cannot replace newer facts. Terminal-controlled title sequences do not enter portable facts: they are process-controlled, unbounded, and may change at render cadence. If chrome needs a title, the App/backend may observe it outside Proto UI, remove control characters, enforce its own length/cadence policy, and supply a bounded App-owned label through ordinary composition.

A current accessible text snapshot can be a plain diagnostic/test result, but should not be continuously copied into portable State. The first slice should expose `host-bridge | bounded-snapshot | unavailable` support and prefer a host-owned accessibility bridge. Any later author-facing snapshot request requires a separate privacy, size, cadence, and stale-revision decision.

Selection summaries and copy requests are technically expressible as plain values, but are not needed by option C. The engine keeps default selection/copy behavior. No selected text or Clipboard payload enters portable State. Programmatic selection, search, Clipboard, mouse reporting, and hyperlinks remain option D.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| App connection/process facts | App -> Terminal Module patch -> composition status | Independent transport and process labels/badges; neither dimension falsifies the other. | Current logical instance revision. |
| Output bytes/VT data | App backend -> engine directly | Engine updates visible grid/cursor/scrollback. | Engine write/render queue; **zero portable grid updates**. |
| IME/text/key input | Physical target -> host/engine -> immutable backend binding | `interactive` forwards exactly once; `read-only`/`disabled` produce zero backend writes. | Module connection, resolved input mode, session/backend binding identity. |
| Harness shortcut | Host keyboard arbiter -> App command owner | Harness action, with no duplicate terminal forwarding. | Keydown decision before engine processing. |
| Terminal key | Host keyboard arbiter fallthrough -> engine | Engine emits encoded input to backend. | Same key event, once. |
| Host geometry | Target/font/DPR observers -> Host Capability -> character-cell resize request -> App backend/PTY | Engine and process converge on rows/columns; applied/rejected result carries the acknowledged revision and effective dimensions. | Monotonic resize revision within the Module-owned connection identity; stale results ignored. |
| Focus request or user entry | Focus domain -> Host Capability's focus bridge -> physical engine input target | One focused logical terminal surface; focus facts return only through Focus. | Current Focus/view epoch; Terminal facts do not duplicate focused state. |
| Accessible terminal content | Engine buffer -> host accessibility bridge | Platform screen reader navigates bounded/current content. | Host accessibility lifecycle; not generic Proto State. |
| Bell/error | Engine/host -> normalized attention fact -> App/composition policy | Bounded visual/audible/status response respecting user settings. | Deduplicated semantic signal, not per-cell output. |

## Fake-engine / fake-host protocol sketch

The connection callbacks below are Module-to-Host internals. They are not Prototype props and do not make functions or engine values portable.

```ts
type TerminalDimensions = Readonly<{ columns: number; rows: number }>;
type TerminalSize = TerminalDimensions & Readonly<{ revision: number }>;

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
      revision: number;
      outcome: 'rejected';
      requested: TerminalDimensions;
      effective: null;
      reason: 'resize-unavailable' | 'backend-rejected';
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
  // Immutable: session/backend replacement requires a fresh attach.
  sessionId: string;
  backendBindingId: string;
}>;

type TerminalSurfacePatch = Readonly<{
  inputMode: 'interactive' | 'read-only' | 'disabled';
  shortcutPolicyId: string;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  processStatus: 'unknown' | 'starting' | 'running' | 'exited' | 'failed';
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

type TerminalInputIntent =
  | Readonly<{ type: 'text'; text: string; composing: false }>
  | TerminalKeyIntent;

type TerminalSurfaceFacts = Readonly<{
  attachment: 'detached' | 'attaching' | 'ready' | 'unavailable' | 'error';
  composing: boolean;
  columns: number | null;
  rows: number | null;
  support: TerminalSurfaceSupport;
  lastResize: TerminalResizeResult | null;
}>;

type TerminalSurfaceConnection = Readonly<{
  // Issued and retired by the Module; callback closures reject any retired identity.
  connectionId: string;
  requirement: TerminalSurfaceRequirement;
  patch: TerminalSurfacePatch;
  onFacts(connectionId: string, facts: TerminalSurfaceFacts): void;
  onInput(connectionId: string, intent: TerminalInputIntent): void;
  onResizeRequest(connectionId: string, size: TerminalSize): void;
  onAttention(connectionId: string, kind: 'bell' | 'error'): void;
}>;

type TerminalSurfaceLease = Readonly<{
  update(patch: TerminalSurfacePatch): void;
  requestKey(intent: TerminalKeyIntent): void;
  requestResize(size: TerminalSize): void;
  snapshot(): TerminalSurfaceFacts;
  dispose(): void;
}>;

type TerminalSurfaceHost = Readonly<{
  attach(connection: TerminalSurfaceConnection): TerminalSurfaceLease;
}>;
```

A fake host resolves a session-affine engine and backend sink from immutable `{ sessionId, backendBindingId }`; the objects/bytes never enter patches. The Module owns connection identity; A11y/Focus/composition remain separate. The red-first exercise:

1. attach `session-7/backend-2`; receive ready with input/resize/accessibility, `keyboardRoute: available`, `mouseReporting: denied`, independent transport/process status, and A11y projection;
2. transition process to exited while transport remains connected; report both accurately;
3. exercise `interactive`, `read-only`, and `disabled`: only interactive text/key reaches backend once; other modes produce zero writes regardless of host events;
4. request mobile Escape; engine encodes once. Arbitrary keys reject;
5. enable terminal mouse protocol in fake engine; pointer reports produce zero backend writes while local text selection changes;
6. make F6 reservation unavailable; report `keyboard-route-unavailable` and reject composed acceptance independently of Button check;
7. issue resize 1/2/3; reject 2 with reason/no effective size and apply 3 at 120x40;
8. reconnect same session through `backend-3`; retire/dispose old connection before new attach; old sink receives zero later input/resize;
9. reuse borrowed engine for another session; reject `engine-session-mismatch` unless host recreates or proves complete reset before attach;
10. replace target/engine/session/capability with fresh connection; colliding host counters cannot revive old delivery;
11. simulate each missing/unverified support and assert bounded reason;
12. omit/disable leave Button and reject at composition; then provide Button plus Focus topology;
13. dispose and emit input/resize/bell/error/focus/pointer; observe zero callbacks/writes;
14. prove no engine/target/buffer/stream/sink/title/A11y duplicate/cell grid appears in portable values.

This makes input precedence, keyboard escape support, mouse suppression, engine session affinity, backend rebinding, independent status, resize, A11y/Focus/composition ownership, and cleanup testable. It does not prove real host behavior or Adapter conformance.

## Input, shortcut, and focus policy

- **IME:** candidate/composition UI stays host-owned. Only committed text may use text intent; composition command keys do not duplicate.
- **Resolved input mode:** one enum replaces conflicting booleans. `interactive` permits committed text/key routing; `read-only` preserves focus/selection but suppresses all backend input; `disabled` suppresses input and entry. No combination/precedence ambiguity remains.
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
- Streaming screen diffs never feed a generic Proto UI live region. The host bridge may announce bounded output according to engine/platform policy; App-level announcements are limited to state transitions such as connected, disconnected, input disabled, or a deduplicated bell/error.
- Engine-local keyboard selection and copy remain available when the host supports them. Any composition-provided Copy/Search control is a separately admitted ordinary Proto UI control invoking a host/App request; selected text and Clipboard contents stay outside portable state.
- Zoom, reflow, font metrics, glyph width, high contrast, cursor contrast, selection contrast, and screen-reader row geometry remain host/engine responsibilities. Resize results expose rows/columns plus acknowledged revision and applied/rejected outcome. Reduced-motion policy disables or reduces visual bell/cursor animation through host settings; the semantic attention fact is unchanged.
- A non-Web profile may use UI Automation or another native accessibility API and may degrade explicitly. Passing WC/React/Vue tests on the Web host cannot establish non-Web conformance.

## Performance, scrollback, and lifecycle

### High-frequency threshold

The portable threshold for terminal content is **zero cell/row/grid diffs**. The first cell mutation is engine-internal regardless of whether updates arrive once a second or once a frame; update rate is not a portable semantic. Low-cardinality facts may be deduplicated and coalesced to at most one publication per animation/frame scheduling turn, while status transitions and input/resize results remain lossless and ordered.

No portable Module receives `onRender`, `onWriteParsed`, buffer lines, dirty rectangles, glyph runs, or scroll positions. This avoids allocation/copy churn and prevents adapter profiles from re-litigating a grid schema.

Terminal scrollback is engine-owned. #521 windowed Collection applies to authored logical lists/logs, not a terminal buffer, cursor-addressed screen, alternate screen, or selection. A later App-exported immutable log snapshot may use Code Block/windowing after it leaves terminal semantics; that does not move live scrollback into Collection.

### Lifecycle rules

- One instance holds Module connection plus immutable session/backend requirement. Detach or target/engine/session/backend/capability replacement retires callback/lease before fresh attach; update cannot change requirement.
- Every callback/result is checked against connection/request revision; title stays host-local. Late delivery ignored.
- Disposal removes input/paste/pointer listeners, Focus bridge, geometry observers, A11y nodes, engine subscriptions, renderer resources, target and backend references.
- View disposal does not terminate process/PTY; App owns stop and session lifetime.
- Created engines dispose with lease; borrowed engines are session-affine and cannot bind another session unless host proves complete reset/recreation. Shared ownership and reset evidence are explicit.
- Backend binding replacement, including reconnect of same session, always creates a fresh connection/lease before input or resize; old sink references are revoked.
- Resize applied/rejected union remains exact; replacement cancels pending work.
- Unsupported engine/session/backend/input/keyboard-route/mouse-denial/A11y/resize fails closed with bounded reason.

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

1. **Portable negatives:** reject engine/target/buffer/stream/event/controller/geometry/grid/sink/arbitrary key/functions; reject session/backend identity in mutable patch.
2. **Fake lease:** session/backend immutable attach, backend reconnect reattach, target/engine/session replacement, session-affine borrowed engine, cleanup, connection stale suppression.
3. **Input policy:** all resolved modes; IME; printable/key split; bounded key; shortcut precedence; keyboard-route support; mobile key; zero duplicate/stale backend sends.
4. **Mouse exclusion:** process enables mouse mode; Host blocks reports and backend writes while local selection works.
5. **Resize:** invalid size, coalescing, exact applied/rejected branches, stale result suppression.
6. **Performance:** rapid grid updates create zero portable content allocation/publication.
7. **A11y/composition/Focus:** only A11y name/mode; independent statuses; Host keyboard support plus composition Button/topology; bounded attention.
8. **Real Web:** engine double; modes/IME/keyboard/F6/mouse suppression/resize/backend reconnect/engine affinity/target replacement/A11y/cleanup.
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
