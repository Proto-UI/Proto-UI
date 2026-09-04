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
- `C-FOCUS-0001-B/D/G` keeps focus facts, requests, eligibility, topology, policy, and entry-region delegation in the Focus domain.
- `C-A11Y-0001-G/H` and `HC-A11Y-0001` allow native, degraded, or diagnostic host accessibility projection without making one host representation portable.
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
| Proto UI Terminal semantic owner | One logical surface identity; attachment/display facts; read-only/input-enabled policy; focus requests/facts through Focus; committed text/key intent vocabulary; resize request/result correlation; bounded attention/error facts; lease epoch and stale-result rejection. | Plain immutable facts and request payloads only. | Cell/row diffs, scrollback, raw bytes/VT sequences, host events, raw geometry, engine modes/controllers, App credentials or process authority. |
| Terminal Surface Host Capability | Resolve the current physical target and engine through host configuration; attach the engine; bridge keyboard/IME/focus; compute character cells; apply resize; project native accessibility; route engine input to the App-owned backend sink; own listeners/observers/resources; dispose exactly. | Static portable requirement, latest plain patch, callbacks for normalized facts/results, and an adapter-injected engine/backend resolver keyed by session reference. | No raw target/engine/backend sink returned through Props, State, Event, Context, or Expose. |
| Adapter profile | Materialize `boundaryTarget` and actual presentation/input/a11y targets; wire the Host Capability; translate lifecycle and Focus participation. | Governed Module requirement and capability token after admission. | No semantic reinterpretation and no support/provision relation before profile-specific evidence. |
| Composition/design language | Tabs, toolbar, label, connection badge, reconnect/close, status, search/copy controls when separately admitted, visible leave-terminal control. | App facts and ordinary Proto UI control events. | Terminal protocol, key encoding, PTY/process control, buffer/selection state, engine-owned accessibility tree. |

The engine can remain completely outside Proto UI. The Host Capability resolves it from adapter/host configuration using an opaque session reference; the engine object never crosses the portable declaration or state boundary.

## Portable facts, requests, and information paths

### Candidate first-slice values

The proposal may evaluate these plain values; names are illustrative and not an admitted API:

- App input: opaque `sessionId: string`, `readOnly`, `inputEnabled`, App-authoritative connection/process status, accessible label/description, and a host-configured shortcut-policy identifier.
- Host facts: `attachment: detached | attaching | ready | unavailable | error`, `composing`, `columns`, `rows`, per-feature support plus bounded reason codes, and the latest revision-bound resize outcome. Focused state is reported only through the Focus domain, not through Terminal-specific facts. Terminal-controlled title strings remain host-local.
- Requests/results: committed `textInput`, normalized `keyInput`, an App-to-host special-key request, resize `{ columns, rows, revision }` with applied/rejected result, and bounded `attention`/`error` signal. Focus/blur requests remain in the Focus domain.

`columns` and `rows` are neutral positive integer character-cell counts. Pixels, rectangles, font metrics, device scale, observers, and layout objects remain host-local. A resize request is not a fact until the host/backend reports an applied/rejected result carrying the acknowledged revision and effective dimensions; older results cannot replace newer facts. Terminal-controlled title sequences do not enter portable facts: they are process-controlled, unbounded, and may change at render cadence. If chrome needs a title, the App/backend may observe it outside Proto UI, remove control characters, enforce its own length/cadence policy, and supply a bounded App-owned label through ordinary composition.

A current accessible text snapshot can be a plain diagnostic/test result, but should not be continuously copied into portable State. The first slice should expose `host-bridge | bounded-snapshot | unavailable` support and prefer a host-owned accessibility bridge. Any later author-facing snapshot request requires a separate privacy, size, cadence, and stale-revision decision.

Selection summaries and copy requests are technically expressible as plain values, but are not needed by option C. The engine keeps default selection/copy behavior. No selected text or Clipboard payload enters portable State. Programmatic selection, search, Clipboard, mouse reporting, and hyperlinks remain option D.

### Information paths

| Input | Owner path | Observable output | Synchronization boundary |
| --- | --- | --- | --- |
| App connection/process fact | App -> Terminal Module patch -> composition status | Label/badge/status only; no engine control implied. | Current logical instance revision. |
| Output bytes/VT data | App backend -> engine directly | Engine updates visible grid/cursor/scrollback. | Engine write/render queue; **zero portable grid updates**. |
| IME/text/key input | Physical input target -> host/engine -> App-owned backend sink | Terminal process receives engine-encoded input exactly once. Optional normalized intent is ephemeral, never retained State or a second backend path. | Module-owned connection identity and active input policy. |
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
  | 'backend-unavailable'
  | 'input-unavailable'
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
  resize: 'available' | 'unavailable';
  accessibility: 'host-bridge' | 'bounded-snapshot' | 'unavailable';
  reasons: readonly TerminalUnavailableReason[];
}>;

type TerminalSurfaceRequirement = Readonly<{
  // Immutable for one connection; changing sessions requires a fresh attach.
  sessionId: string;
}>;

type TerminalSurfacePatch = Readonly<{
  readOnly: boolean;
  inputEnabled: boolean;
  shortcutPolicyId: string;
  accessibleLabel: string;
  accessibleDescription?: string;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
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

A fake host is constructed with a private map from immutable `TerminalSurfaceRequirement.sessionId` to a scripted fake engine and fake backend sink; the map, engine, sink, and engine-encoded bytes never enter `TerminalSurfacePatch`. The Module issues a unique connection identity and retires its callback closure before replacement. The red-first exercise is:

1. attach `session-7`; receive `attaching`, then `ready` with 80x24, explicit input/resize/accessibility support, accessible label/description, and connected status;
2. emit committed text and one modified key as immutable intent values, while asserting the private fake backend receives each engine-encoded sequence exactly once and no normalized-intent callback becomes a second send path;
3. invoke `requestKey` for a visible mobile Escape control; assert the engine—not App code—encodes it and the private backend receives exactly one sequence;
4. issue resize revisions 1/2/3; report revision 2 as rejected with `backend-rejected` and no effective size, then revision 3 as applied at 120x40 with no reason; accept only revision 3 as current facts;
5. replace the target/engine, then switch sessions through a new immutable requirement and fresh attachment; retire the old Module connection and dispose its lease before issuing the new connection, even if host counters restart;
6. simulate missing engine, input, accessibility, and resize support and assert the bounded support/reason codes identify the failed requirement;
7. dispose, then make the old fake emit input, resize, bell, error, and focus; observe zero Terminal callbacks and zero backend writes, while focus state remains solely in the Focus domain;
8. recursively validate every captured patch/fact/request as data-only and prove that no fake-engine identity, target, buffer, stream, backend sink, callback source, process-controlled title, or cell grid appears.

This sketch proves the boundary can be data-only and makes resize/result, diagnostic, accessibility-input, connection-identity, backend-delivery, mobile-key, title, and Focus ownership testable. It does not prove browser layout, IME, screen-reader behavior, native focus, key routing, renderer performance, or an Adapter profile.

## Input, shortcut, and focus policy

- **IME:** candidate text and composition UI stay in the host engine's physical input target. Only committed text may leave the host bridge as `text` intent. `Enter`/other command keys during composition do not trigger Harness shortcuts or a duplicate terminal key.
- **Key versus text:** committed Unicode text uses `text`; non-text keys and modifier chords use the bounded `TerminalKey` vocabulary. Letter/digit keys are valid here only with Ctrl/Alt/Meta; unmodified or Shift-only printable input must use `text`. Unsupported punctuation/function keys remain deferred. A DOM `KeyboardEvent`, native key object, scan code, arbitrary string, or engine-encoded VT value never enters portable state/events.
- **Shortcut order:** the adapter-injected Harness keyboard arbiter checks the configured local command map before the terminal engine. An explicitly reserved Harness chord wins; every other chord falls through exactly once to the engine. The policy resolver is host configuration, not a portable callback.
- **Escape route:** bare `Escape` is terminal input. The Web Harness profile must reserve `F6`/`Shift+F6` for next/previous Harness focus regions and provide an adjacent, named Proto UI Button that leaves the terminal. A host that cannot provide both a keyboard route and reachable visible control reports the interactive slice unavailable.
- **Ctrl/Meta/Alt:** no blanket interception. Only registered Harness chords are local. The engine receives the rest and owns platform-specific encoding.
- **Paste:** Clipboard acquisition and paste confirmation/policy are App/host services. The first slice may forward committed pasted text through the engine, including bracketed-paste behavior; it does not receive Clipboard objects. File paths are plain pasted text only—no file access, drop, or path authority.
- **Pointer/mouse:** first-slice terminal mouse reporting is disabled. Engine-local pointer selection may remain available. Custom pointer reports, block-selection APIs, and selection gestures belong to option D.
- **Mobile/virtual keyboard:** tapping the surface may request the engine input target and host IME. A visible App-composed special-key Button emits a plain `TerminalKeyIntent` through `requestKey`; the host/engine performs mode-specific encoding and writes the private backend once. App code never manufactures VT bytes. If committed text/IME or this governed key route cannot be bridged without leaking a raw target, the host reports interactive input unavailable rather than claiming parity.

## Accessibility boundary

- The Terminal logical surface supplies an accessible label, description, mode (`interactive`/`read-only`), connection/display status, focus entry, and a reliable exit path.
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

- One logical instance holds one Module-owned connection identity and immutable session requirement for the current lease. Detach, target/engine/session/capability replacement, and disposal retire the callback closure and lease before a new attachment; `update()` cannot change `sessionId`, and host-authored counters never decide freshness.
- Every input, fact, resize result, accessibility callback, bell, and error is checked against the current connection identity and request revision. Process-controlled title updates remain host-local. Late callbacks are ignored.
- `dispose()` removes keyboard/composition/paste/pointer listeners, the Focus-domain target bridge, geometry/DPR observers, accessibility nodes/listeners, engine subscriptions, renderer resources owned by the lease, target references, and backend-sink references.
- Disposing a view lease does **not** terminate the process or PTY. The App/backend owns explicit process stop and decides whether detach preserves or closes a session.
- If the Host Capability created an engine for the lease, it disposes that engine after draining/revoking its callbacks. If the host injected a shared engine, the lease only detaches its owned bindings. Ownership must be explicit; double-disposal is an error.
- Resize bursts are latest-revision-wins. An applied result requires effective dimensions and null reason; a rejected result requires `resize-unavailable` or `backend-rejected` and has no effective size. Replacement/disposal cancels pending work.
- Unsupported engine attachment, backend sink, input bridge, accessibility route, or resize reports `unavailable`/read-only plus a bounded per-feature reason code; no fake success state.

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

1. **Portable negatives:** compile-time and runtime fixtures reject engine, target, buffer, stream, DOM/native event, mutable controller, raw pixels, cell grids, backend sink, arbitrary key strings, and functions in portable patch/fact/request values.
2. **Fake lease:** attach/update/snapshot/dispose, missing capability, target/engine replacement, session replacement through fresh immutable requirement, exactly-once cleanup, Module-owned connection retirement, and stale-callback suppression even when host counters collide.
3. **Input policy:** IME candidate stays host-local; printable input uses `text`; bounded named/modifier keys reach the private backend once; arbitrary keys reject; normalized intents cannot double-send; reserved Harness chord stays local; a mobile special-key request is engine-encoded once; bare Escape reaches the engine; F6 exits through Focus.
4. **Resize:** invalid/zero dimensions reject; bursts coalesce; the applied branch requires acknowledged revision/effective dimensions, the rejected branch requires revision/bounded reason, and late/older results do not change current facts.
5. **Performance:** replay rapid cursor/grid/alternate-screen updates and assert zero portable content publications/allocations; only deduplicated low-cardinality facts cross.
6. **Accessibility fake:** label/description/status inputs, per-feature support/reason negotiation, bounded attention, unavailable degradation, and no generic live-stream snapshot.
7. **Real Web:** engine double mounted behind React; real keyboard/IME/focus/F6/resize/target replacement/dispose; accessibility-tree inspection; high-frequency renderer path; no retained listeners/observers/targets.
8. **Cross-adapter Web only if claimed:** WC/React/Vue evidence for one admitted portable authoring source. This remains Web evidence.
9. **Non-Web:** independent native profile with native focus/input/resize/accessibility evidence before any multi-host statement.

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
