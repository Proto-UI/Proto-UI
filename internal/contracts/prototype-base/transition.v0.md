> **Status**: Draft – v0 (contract-first) **Version**: v0
>
> This contract specifies the Proto UI v0 base `transition` protocol.
>
> The contract applies to the transition family:
>
> - `base-transition` / `asTransition`

## Purpose

`transition` is a **presence-state governance** protocol in the base prototype library.

It governs the perceptual lifecycle of elements: the discrete states an element passes through when becoming visible (`closed` → `entering` → `entered`) and invisible (`entered` → `leaving` → `closed`).

The protocol provides **state machine governance**; visual animation is delegated to host platforms via the `transitionState` exposed state.

## Positioning

The v0 `transition` protocol is intentionally focused on discrete state governance.

It is suitable for:

- Dialog/modal enter/leave presence
- Toast notification lifecycle
- Dropdown content visibility
- Any component needing controlled presence state

It is **not yet** a full definition of:

- Physics-based or gesture-driven animations (achieved via composition)
- Layout transition animations (FLIP, shared element)
- Coordinated stagger/sequence orchestration
- Cross-platform animation engine abstraction

## Information Flow

### User ↔ Component

**User → Component (Events)**:

- Implicit: user actions that trigger `open` prop changes via parent components

**Component → User (Feedback)**:

- `transitionState` drives `data-transition` attribute for CSS styling
- `isPresent` drives conditional rendering (element in DOM or not)

### Maker ↔ Component

**Maker → Component (Props)**:

- `open`: target presence state
- `appear`: animate on initial mount
- `enterDuration` / `leaveDuration`: timing hints
- `interrupt`: strategy for mid-transition changes

**Component → Maker (Expose)**:

- `transitionState`: current state for observation
- `isPresent`: derived presence for conditional rendering
- `enter()` / `leave()`: imperative state triggers
- `complete()`: signal animation completion

### Component ↔ Component

**Parent → Child (Context)**:

- Parent `transitionState` may influence child timing (if `dependsOnParentTransition`)
- Parent leaving → children should complete exit first

**Child → Parent (Context)**:

- Child completion signals allow parent to delay state advance

## State Machine

### Base States

| State      | Meaning                  | `isPresent` | Platform Mapping             |
| ---------- | ------------------------ | ----------- | ---------------------------- |
| `closed`   | Not perceptually present | `false`     | `display: none`, unmounted   |
| `entering` | Transitioning to present | `true`      | `data-transition="entering"` |
| `entered`  | Fully present and stable | `true`      | `data-transition="entered"`  |
| `leaving`  | Transitioning to absent  | `true`      | `data-transition="leaving"`  |

### Transitions

```
closed <---> entering <---> entered
   |                           |
   |<--------------------------|
   |                           |
leaving <----------------------+
```

**Flow**:

- `open=true`: `closed` → `entering` → `entered`
- `open=false`: `entered` → `leaving` → `closed`

**Interruption** (when `open` changes mid-transition):

| Strategy            | `entering` + `open=false`    | `leaving` + `open=true`       |
| ------------------- | ---------------------------- | ----------------------------- |
| `reverse` (default) | → `leaving` (restart)        | → `entering` (restart)        |
| `wait`              | Queue until complete         | Queue until complete          |
| `immediate`         | Jump to `closed`, then enter | Jump to `entered`, then leave |

## Surface

### Props (Maker → Component)

**Setup-only** (declared in `setup()`, read at runtime):

- `open?: boolean`
  - Target presence state
  - `true` → drive toward `entered`
  - `false` → drive toward `closed`
  - Default: `false`

- `appear?: boolean`
  - Animate on initial mount when `open=true`
  - `false` → immediately start at `entered`
  - Default: `false`

- `enterDuration?: number`
  - Expected enter duration (ms)
  - Used for timeout fallback and parent coordination
  - Default: `300`

- `leaveDuration?: number`
  - Expected leave duration (ms)
  - Default: `200`

- `interrupt?: 'reverse' | 'wait' | 'immediate'`
  - Mid-transition interruption strategy
  - Default: `'reverse'`

- `dependsOnParentTransition?: boolean`
  - Declare dependency on parent transition for coordination
  - Default: `false`

### Expose (Component → Maker)

**State** (subscribable at runtime):

- `transitionState: EnumState<'closed' | 'entering' | 'entered' | 'leaving'>`
  - Current presence state
  - **Extensible**: may include contributor-defined states

- `isPresent: BooleanState<boolean>`
  - Derived: `true` when not `closed`
  - Stable through entire enter flow

**Methods** (runtime invocation):

- `enter(): void`
  - Imperatively trigger enter
  - Equivalent to setting `open = true`

- `leave(): void`
  - Imperatively trigger leave
  - Equivalent to setting `open = false`

- `complete(): void`
  - Signal current transition phase complete
  - Advances: `entering` → `entered`, `leaving` → `closed`
  - **Called by platform adapter** (e.g., on `transitionend`)

### Events (User → Component)

None directly. Transition responds to `open` prop changes, not direct user events.

### Context (Component ↔ Component)

**Provided**:

- Current `transitionState` for child discovery
- Duration hints for coordination

**Consumed**:

- Parent transition state (if `dependsOnParentTransition`)

### Feedback (Component → User)

**Setup-only** (rule-based):

- `data-transition` attribute mapping
  - `when: transitionState.eq('entering')` → `intent: style.use({ attr: { 'data-transition': 'entering' } })`

## Behavioral Rules

### State Governance

- `transition` MUST expose `transitionState` for external subscription
- `transition` MUST transition through states in valid paths only
- `transition` MUST call `onBeforeEnter` before entering `entering` state
- `transition` MUST call `onAfterEnter` after reaching `entered` state
- `transition` MUST call `onBeforeLeave` before entering `leaving` state
- `transition` MUST call `onAfterLeave` after reaching `closed` state

### Interruption

- `transition` MUST handle rapid `open` changes according to `interrupt` strategy
- `transition` MUST NOT drop state updates (queue or resolve, never ignore)

### Uncontrolled Mode

- `transition` MUST support uncontrolled operation when `open` prop not provided
- In uncontrolled mode, internal state managed via `enter()` / `leave()` calls

### Lifecycle

- `transition` MUST complete ongoing transitions before unmount when possible
- `transition` MUST support `appear` for mount-time animation

### Parent-Child

- Child with `dependsOnParentTransition=true` MUST complete `leaving` before parent completes `leaving`
- Parent MAY delay `entering` → `entered` until dependent children signal ready
- Children are always independent for `interrupt` behavior

## Platform Mapping

### Web Platform

**State → Attribute**:

```
transitionState → data-transition="{state}"
```

**Completion Detection**:

- Adapter listens for `transitionend` / `animationend`
- Calls `complete()` when event fires
- Uses `enterDuration` / `leaveDuration` as timeout fallback

**CSS Targeting**:

```css
[data-transition='entering'] {
  opacity: 0;
}
[data-transition='entered'] {
  opacity: 1;
  transition: opacity 300ms;
}
```

### Future Platforms

| Platform | State Mapping                       | Completion Signal           |
| -------- | ----------------------------------- | --------------------------- |
| Flutter  | `AnimationController` state         | `AnimationStatus.completed` |
| iOS      | `UIView` animation block completion | Completion handler          |
| Android  | `Animator` state                    | `onAnimationEnd`            |

Contract remains identical; mapping changes per platform.

## Composition

### With Custom Drivers

Gesture-driven animation (e.g., Toast swipe) is achieved via **composition**, not built-in props:

```typescript
const asSwipeableDismiss = defineAsHook({
  setup(def) {
    const transition = asTransition();
    const progress = def.state.numberRange('dismissProgress', 0, { min: 0, max: 1 });

    def.expose.state('dismissProgress', progress);

    // Gesture logic updates progress
    // Calls transition.leave() when threshold reached

    return transition.render;
  },
});
```

**TODO**: Feedback module integration for interpolation (linear, spring).

### Higher-Order Components

- **Dialog**: consumes `asTransition` for modal presence
- **Toast**: consumes `asTransition` for notification lifecycle
- **Dropdown**: consumes `asTransition` for content presence

Components SHOULD expose their own timing hooks rather than exposing transition internals.

## Extensibility

### Source-Level Extension

Contributors modify `asTransition` source to:

1. **Add intermediate states**:

   ```typescript
   const transitionState = def.state.enum(
     'transitionState',
     ['closed', 'enter-preparing', 'entering', 'entered', 'leaving'],
     { default: 'closed' }
   );
   ```

2. **Update transition logic** to handle new state paths

3. **Update progress calculation** if using normalized (0-1) progress

### Naming Conventions

| Phase | Prefix              | Example           |
| ----- | ------------------- | ----------------- |
| Enter | `enter-*`           | `enter-preparing` |
| Leave | `leave-*`, `exit-*` | `leave-settling`  |

## Future Considerations (v1+)

Not in v0:

- `mode?: 'parallel' | 'sequence'` for child coordination
- `stagger?: number` for staggered animations
- `spring?: SpringConfig` for physics timing
- `layout?: boolean` for layout transitions
