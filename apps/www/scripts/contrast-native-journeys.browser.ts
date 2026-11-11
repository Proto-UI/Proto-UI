// Issue #852 audit observers, self-contained for the esbuild IIFE bundle.
// Retained objects identify physical targets; IDs describe those targets and
// never authorize borrowing a replacement.
import type {
  ButtonCommandBinding,
  ButtonCommandSession,
  ButtonKeyboardBinding,
  ButtonKeyStep,
  DialogOutsideBinding,
  HoverBridgeBinding,
  InputRecord,
  NativeJourneyBinding,
  NativeJourneyObservation,
  NativeJourneySubject,
  NativePoint,
  PointerJournalRecord,
  bindContrastButtonKeyboard as BindContrastButtonKeyboard,
  bindContrastDialogOutside as BindContrastDialogOutside,
  bindContrastHoverBridge as BindContrastHoverBridge,
} from './contrast-native-journeys.mjs';

export const CONTRAST_NATIVE_JOURNEY_STATES = {
  dialog: ['outside-pointer-before', 'outside-pointer-closed'],
  button: [
    'space-before', 'space-activation', 'enter-before', 'enter-activation',
    'unrelated-key', 'disabled-pointer', 'disabled-tab-exclusion',
  ],
  'hover-card': ['pointer-bridge-before', 'pointer-bridge-retained', 'pointer-bridge-closed'],
};


const commandRegistryKey = Symbol.for('proto-ui.contrast-button-commands.v1');
type JourneyGlobal = typeof globalThis & {
  puiContrastProbe?: Pick<
    typeof import('./contrast-probe.browser'),
    'readContrastAuditSubject' | 'readContrastPaintedVisibility'
  >;
  [commandRegistryKey]?: Set<ButtonCommandSession>;
};
type JourneyLease = Omit<NativeJourneyBinding, 'dispose'>;
type JournalPointerEvent = 'pointerdown' | 'pointerup' | 'pointerenter' | 'pointerleave';

function probe() {
  const { puiContrastProbe } = globalThis as JourneyGlobal;
  if (!puiContrastProbe) throw new Error('Native journey needs the canonical probe.');
  return puiContrastProbe;
}
function owned(element: Element | null | undefined, owner: string, generation: string, prototype: string) {
  return !!element && element.hasAttribute('data-pui-root') &&
    element.getAttribute('data-projection-owner') === owner &&
    element.getAttribute('data-projection-generation') === generation &&
    element.getAttribute('data-projection-prototype') === prototype;
}
function matches(owner: string, generation: string, prototype: string) {
  return [...document.querySelectorAll('[data-pui-root]')].filter((element) =>
    owned(element, owner, generation, prototype));
}
function unique(element: Element, binding: JourneyLease, prototype: string) {
  const candidates = matches(binding.owner, binding.generation, prototype);
  return element?.isConnected && owned(element, binding.owner, binding.generation, prototype) &&
    candidates.length === 1 && candidates[0] === element;
}
function targetCurrent(element: Element, binding: JourneyLease, prototype: string) {
  return element?.isConnected && owned(element, binding.owner, binding.generation, prototype) &&
    !element.hasAttribute('data-pui-view-detached') &&
    !element.hasAttribute('data-pui-view-pending');
}
function leaseCurrent(binding: JourneyLease) {
  const current = probe().readContrastAuditSubject(binding.subject);
  return current.observation.achieved && current.owner === binding.owner &&
    current.generation === binding.generation;
}
function visibility(element: Element) {
  return probe().readContrastPaintedVisibility(element);
}
function rootTargetCurrent(element: Element, binding: JourneyLease, prototype: string) {
  return element?.isConnected && owned(element, binding.owner, binding.generation, prototype);
}
function painted(element: Element) {
  const result = visibility(element);
  return result.visible && result.classification === 'source-model-visible';
}
function withdrawn(element: Element) {
  return !element.isConnected ||
    (element.hasAttribute('data-pui-view-detached') && !visibility(element).visible);
}
function noReplacement(element: Element, binding: JourneyLease, prototype: string) {
  return matches(binding.owner, binding.generation, prototype).every((value) => value === element) &&
    (!element.isConnected || owned(element, binding.owner, binding.generation, prototype));
}
function relationship(trigger: Element, content: Element, id: string) {
  return !!id && content.id === id && trigger.getAttribute('aria-controls') === id &&
    [...document.querySelectorAll('[id]')].filter((element) => element.id === id).length === 1;
}
function lease(subject: NativeJourneySubject): JourneyLease {
  const current = probe().readContrastAuditSubject(subject);
  if (!current.observation.achieved || !current.owner || !current.generation)
    throw new Error('Native journey selected subject is unavailable.');
  return { subject, owner: current.owner, generation: current.generation };
}
function inputFact<T extends InputRecord>(record: T) {
  const { event, ...fact } = record;
  return { ...fact, trusted: event.isTrusted, defaultPrevented: event.defaultPrevented };
}
function pointerJournal(targets: [name: string, target: HTMLElement | Document, types: JournalPointerEvent[]][]) {
  const records: PointerJournalRecord[] = [];
  const bindings: (() => void)[] = [];
  for (const [name, target, types] of targets) {
    for (const type of types) {
      const listener: EventListener = (input) => {
        const event = input as PointerEvent;
        const hit = document.elementFromPoint(event.clientX, event.clientY);
        records.push({ event, target: name, type, button: event.button,
          x: event.clientX, y: event.clientY, at: performance.now(),
          exactTarget: event.composedPath()[0] === target,
          hitIsTarget: hit === target || (!!hit && target.contains(hit)),
        });
      };
      target.addEventListener(type, listener, true);
      bindings.push(() => target.removeEventListener(type, listener, true));
    }
  }
  return { records, dispose() { for (const off of bindings) off(); } };
}
function eventAt(record: NativePoint, point: NativePoint) {
  // Native device coordinates may round a fractional CSS location.
  return Math.abs(record.x - point.x) <= 1 && Math.abs(record.y - point.y) <= 1;
}
function outsidePoint(content: Element, mask: Element) {
  const rect = content.getBoundingClientRect();
  const points = [0.25, 0.5, 0.75].flatMap((fraction) => [
    { side: 'top', x: rect.left + rect.width * fraction, y: rect.top - 1 },
    { side: 'left', x: rect.left - 1, y: rect.top + rect.height * fraction },
    { side: 'bottom', x: rect.left + rect.width * fraction, y: rect.bottom + 1 },
    { side: 'right', x: rect.right + 1, y: rect.top + rect.height * fraction },
  ]);
  return points.find((point) => point.x >= 0 && point.y >= 0 && point.x < innerWidth &&
    point.y < innerHeight && document.elementFromPoint(point.x, point.y) === mask) ?? null;
}

export function bindContrastDialogOutside({ subject, root, trigger, content, mask }: Parameters<typeof BindContrastDialogOutside>[0]): DialogOutsideBinding {
  const binding: DialogOutsideBinding = { ...lease(subject), root, trigger, content, mask, contentId: content.id,
    beforeAccepted: false,
    point: outsidePoint(content, mask),
    inputs: pointerJournal([
      ['mask', mask, ['pointerdown']], ['document', document, ['pointerup']],
    ]),
    dispose: () => binding.inputs.dispose(),
  };
  return binding;
}
export function readContrastDialogOutside(binding: DialogOutsideBinding, phase: string): NativeJourneyObservation {
  const { root, trigger, content, mask, point, owner, generation } = binding;
  const identity = leaseCurrent(binding) && rootTargetCurrent(root, binding, 'brutalist-dialog-root') &&
    unique(trigger, binding, 'brutalist-dialog-trigger') &&
    binding.subject.previewer.contains(trigger) &&
    targetCurrent(trigger, binding, 'brutalist-dialog-trigger');
  const before = identity && root.hasAttribute('data-open') &&
    unique(content, binding, 'brutalist-dialog-content') &&
    unique(mask, binding, 'brutalist-dialog-mask') &&
    content.getAttribute('role') === 'dialog' && content.getAttribute('aria-modal') === 'true' &&
    relationship(trigger, content, binding.contentId) && painted(content) && painted(mask) &&
    point !== null && document.elementFromPoint(point.x, point.y) === mask &&
    !content.contains(document.elementFromPoint(point.x, point.y));
  const inputs = binding.inputs.records.map(inputFact);
  const downs = inputs.filter((input) => input.type === 'pointerdown');
  const ups = inputs.filter((input) => input.type === 'pointerup');
  const nativePress = downs.length === 1 && ups.length === 1 &&
    downs[0].trusted && ups[0].trusted && downs[0].exactTarget && downs[0].hitIsTarget &&
    downs[0].button === 0 && ups[0].button === 0 &&
    !!point && eventAt(downs[0], point) && eventAt(ups[0], point) &&
    downs[0].at <= ups[0].at && downs[0].defaultPrevented;
  const closed = identity && !root.hasAttribute('data-open') &&
    noReplacement(content, binding, 'brutalist-dialog-content') &&
    noReplacement(mask, binding, 'brutalist-dialog-mask') && withdrawn(content) && withdrawn(mask);
  return {
    achieved: phase === 'before' ? before && inputs.length === 0 :
      phase === 'closed' && binding.beforeAccepted === true && nativePress && closed &&
      document.activeElement === trigger,
    phase, owner, generation, exactIdentity: identity, point, inputs, nativePress, closed,
    triggerFocused: document.activeElement === trigger,
    contentWithdrawn: withdrawn(content), maskWithdrawn: withdrawn(mask),
    criterion: 'P-BASE-DIALOG-CONTENT-DISMISS / FOCUS / PRESENCE; P-BASE-DIALOG-MASK-DEFAULT-ACTION (draft)',
    basis: 'One native left press on a hit-tested exact owned Mask exterior; complete original view withdrawal and exact Trigger focus return before corrective input.',
  };
}

export function bindContrastHoverBridge({ subject, root, trigger, content }: Parameters<typeof BindContrastHoverBridge>[0]): HoverBridgeBinding {
  const rect = content.getBoundingClientRect();
  const binding: HoverBridgeBinding = { ...lease(subject), root, trigger, content,
    activeElement: document.activeElement,
    point: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    beforeAccepted: false, retainedAccepted: false,
    inputs: pointerJournal([
      ['trigger', trigger, ['pointerleave']],
      ['content', content, ['pointerenter', 'pointerleave']],
    ]),
    dispose: () => binding.inputs.dispose(),
  };
  return binding;
}
export function readContrastHoverBridge(binding: HoverBridgeBinding, phase: string): NativeJourneyObservation {
  const { root, trigger, content, owner, generation, point } = binding;
  const identity = leaseCurrent(binding) && rootTargetCurrent(root, binding, 'brutalist-hover-card-root') &&
    unique(trigger, binding, 'brutalist-hover-card-trigger') &&
    binding.subject.previewer.contains(trigger) &&
    targetCurrent(trigger, binding, 'brutalist-hover-card-trigger') &&
    noReplacement(content, binding, 'brutalist-hover-card-content');
  const sameContent = unique(content, binding, 'brutalist-hover-card-content') && painted(content);
  const inputs = binding.inputs.records.map(inputFact);
  const triggerLeaves = inputs.filter((input) => input.target === 'trigger');
  const enters = inputs.filter((input) => input.target === 'content' && input.type === 'pointerenter');
  const leaves = inputs.filter((input) => input.target === 'content' && input.type === 'pointerleave');
  const bridge = triggerLeaves.length === 1 && enters.length === 1 &&
    [triggerLeaves[0], enters[0]].every((input) => input.trusted && input.exactTarget) &&
    enters[0].hitIsTarget && eventAt(enters[0], point) && triggerLeaves[0].at <= enters[0].at;
  const focusPreserved = document.activeElement === binding.activeElement &&
    document.activeElement !== trigger && !content.contains(document.activeElement);
  const hit = document.elementFromPoint(point.x, point.y);
  const pointOwned = hit === content || (!!hit && content.contains(hit) &&
    hit.getAttribute('data-projection-prototype') !== 'brutalist-hover-card-trigger');
  const retained = identity && sameContent && root.hasAttribute('data-open') && bridge &&
    leaves.length === 0 && content.matches(':hover') && !trigger.matches(':hover') && pointOwned;
  const closed = identity && !root.hasAttribute('data-open') && withdrawn(content) &&
    !trigger.matches(':hover') && !content.matches(':hover') && bridge && leaves.length === 1 &&
    leaves[0].trusted && leaves[0].exactTarget && enters[0].at <= leaves[0].at;
  return {
    achieved: focusPreserved && (phase === 'before' ? identity && sameContent && pointOwned &&
      root.hasAttribute('data-open') && trigger.matches(':hover') && !content.matches(':hover') &&
      inputs.length === 0 : phase === 'retained' ? binding.beforeAccepted === true && retained :
      phase === 'closed' && binding.retainedAccepted === true && closed),
    phase, owner, generation, exactIdentity: identity, sameContent, point, inputs,
    nativeBridge: bridge, retained, closed, focusPreserved,
    criterion: 'P-BASE-HOVER-CARD-CONTENT-HOVER-BRIDGE / OVERLAY / PRESENCE (draft)',
    basis: 'Current one-Root zero-delay recipe: one native Trigger-to-Content move, exact owned painted Content retention, then native leave and complete original view withdrawal. No focus or Escape substitute.',
  };
}
export function contrastHoverLeavePoint(binding: HoverBridgeBinding) {
  return [
    { x: 0, y: 0 }, { x: innerWidth - 1, y: 0 },
    { x: 0, y: innerHeight - 1 }, { x: innerWidth - 1, y: innerHeight - 1 },
  ].find((point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return hit && !binding.trigger.contains(hit) && !binding.content.contains(hit);
  }) ?? null;
}

function bindCommands(element: HTMLElement): ButtonCommandBinding {
  const sessions = [...((globalThis as JourneyGlobal)[commandRegistryKey] ?? [])].filter((session) =>
    session.active && session.ctx.refs[session.ref] === element);
  if (sessions.length !== 1) throw new Error('Exact Button has no unique public command observer.');
  const session = sessions[0];
  const instance = session.ctx.api.getPublicInstance(session.ref);
  if (!instance) throw new Error('Button public instance is unavailable.');
  return { session, instance, element };
}
function commandsCurrent(binding: ButtonCommandBinding) {
  const { session, instance, element } = binding;
  return session.active && session.ctx.refs[session.ref] === element &&
    session.ctx.api.getPublicInstance(session.ref) === instance;
}
function scrollSnapshot(element: HTMLElement) {
  const elements = new Set([document.scrollingElement]);
  for (let current: HTMLElement | null = element; current; current = current.parentElement) elements.add(current);
  return [...elements].filter((element): element is Element => !!element).map((element) => ({
    element, left: element.scrollLeft, top: element.scrollTop,
  }));
}
export function bindContrastButtonKeyboard({ subject, button, disabled }: Parameters<typeof BindContrastButtonKeyboard>[0]): ButtonKeyboardBinding {
  const binding: ButtonKeyboardBinding = { ...lease(subject), button, disabled,
    commands: bindCommands(button), disabledCommands: disabled.map(bindCommands), inputs: [],
    tabVisits: [], disabledPointer: [], disabledPoint: null, tabExited: false,
    dispose: () => {
      document.removeEventListener('keydown', listener, true);
      document.removeEventListener('keyup', listener, true);
      document.removeEventListener('focusin', focus, true);
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('pointerup', pointer, true);
    },
  };
  const listener = (event: KeyboardEvent) => binding.inputs.push({
    event, type: event.type, key: event.key, at: performance.now(),
    exactTarget: event.composedPath()[0] === button,
  });
  document.addEventListener('keydown', listener, true);
  document.addEventListener('keyup', listener, true);
  const disabledTargets: readonly (Element | null)[] = disabled;
  const focus = () => binding.tabVisits.push({
    disabledFocused: disabledTargets.includes(document.activeElement),
    buttonFocused: document.activeElement === button,
  });
  document.addEventListener('focusin', focus, true);
  const pointer = (event: PointerEvent) => binding.disabledPointer.push({
    event, type: event.type, button: event.button, x: event.clientX, y: event.clientY,
    hitDisabled: disabled.some((element) => element.contains(document.elementFromPoint(event.clientX, event.clientY))),
  });
  document.addEventListener('pointerdown', pointer, true);
  document.addEventListener('pointerup', pointer, true);
  return binding;
}
function buttonIdentity(binding: ButtonKeyboardBinding) {
  const { button, disabled } = binding;
  const physical = [button, ...disabled];
  return leaseCurrent(binding) && physical.every((element) =>
    targetCurrent(element, binding, 'brutalist-button') &&
    [...document.querySelectorAll('[data-pui-root][data-demo-ref]')].filter((candidate) =>
      candidate.getAttribute('data-demo-ref') === element.getAttribute('data-demo-ref') &&
      owned(candidate, binding.owner, binding.generation, 'brutalist-button')).length === 1) &&
    commandsCurrent(binding.commands) && binding.disabledCommands.every(commandsCurrent) &&
    button.getAttribute('aria-disabled') !== 'true' && !button.hasAttribute('disabled') &&
    disabled.every((element) => element.getAttribute('aria-disabled') === 'true' ||
      element.hasAttribute('disabled'));
}
export function beginContrastButtonKey(binding: ButtonKeyboardBinding, key: string): ButtonKeyStep {
  const step = { key, inputIndex: binding.inputs.length,
    count: binding.commands.session.count,
    disabledCounts: binding.disabledCommands.map(({ session }) => session.count),
    scroll: scrollSnapshot(binding.button),
  };
  return {
    ...step,
    before: {
      achieved: buttonIdentity(binding) && document.activeElement === binding.button &&
        painted(binding.button) && binding.disabled.every(painted),
      owner: binding.owner, generation: binding.generation, key,
      commandCount: step.count, disabledCounts: step.disabledCounts,
      criterion: 'P-BASE-BUTTON-KEYBOARD-ACTIVATION / CLICK-SIGNAL (draft)',
    },
  };
}
export function readContrastButtonKey({ binding, step }: { binding: ButtonKeyboardBinding; step: ButtonKeyStep }): NativeJourneyObservation {
  const inputs = binding.inputs.slice(step.inputIndex).map(inputFact);
  const delta = binding.commands.session.count - step.count;
  const nativeKeys = inputs.length === 2 && inputs[0].type === 'keydown' &&
    inputs[1].type === 'keyup' && inputs.every((input) => input.key === step.key &&
      input.trusted && input.exactTarget) && inputs[0].at <= inputs[1].at;
  const scrollUnchanged = step.scroll.every(({ element, left, top }) =>
    element.scrollLeft === left && element.scrollTop === top);
  const disabledUnchanged = binding.disabledCommands.every(({ session }, index) =>
    session.count === step.disabledCounts[index]);
  const activated = step.key === ' ' || step.key === 'Enter';
  const defaultAction = step.key === ' ' ? inputs[0]?.defaultPrevented === true && scrollUnchanged :
    step.key === 'a' ? inputs.every((input) => !input.defaultPrevented) : true;
  return {
    achieved: step.before.achieved && buttonIdentity(binding) && nativeKeys &&
      document.activeElement === binding.button && delta === (activated ? 1 : 0) &&
      disabledUnchanged && defaultAction,
    owner: binding.owner, generation: binding.generation, key: step.key, inputs,
    commandDelta: delta, commandCount: binding.commands.session.count,
    commandSource: binding.commands.session.sourceBinding,
    disabledUnchanged, scrollUnchanged, defaultAction,
    criterion: 'P-BASE-BUTTON-KEYBOARD-ACTIVATION / KEYBOARD-SPACE-PREVENT-DEFAULT / DISABLED-SUPPRESS-ACTIVATION; C-EXPOSE-EVENT-0001 (draft)',
    basis: 'Exactly one outward public consumer onClick per native key on the retained physical Button; DOM clicks are not counted as commands. Space must prevent its own host default and preserve real scroll offsets; unrelated a must not be cancelled.',
  };
}
export function readContrastDisabledButton(binding: ButtonKeyboardBinding, phase: string): NativeJourneyObservation {
  const pointer = binding.disabledPointer.map(inputFact);
  const point = binding.disabledPoint;
  const nativePointer = pointer.length === 2 && pointer[0].type === 'pointerdown' &&
    pointer[1].type === 'pointerup' && !!point &&
    pointer.every((input) => input.trusted && input.button === 0 && eventAt(input, point));
  const tabInputs = binding.inputs.map(inputFact);
  const nativeTabs = tabInputs.length >= 2 && tabInputs.length % 2 === 0 &&
    tabInputs.every((input, index) => input.key === 'Tab' && input.trusted &&
      input.type === (index % 2 === 0 ? 'keydown' : 'keyup'));
  const disabledTargets: readonly (Element | null)[] = binding.disabled;
  return {
    achieved: buttonIdentity(binding) && binding.disabledCommands.every(({ session }) => session.count === 0) &&
      !disabledTargets.includes(document.activeElement) &&
      (phase === 'pointer' ? nativePointer : phase === 'tab' && nativeTabs &&
        binding.tabVisits.length > 0 && binding.tabVisits.every((visit) => !visit.disabledFocused) &&
        binding.tabExited === true),
    owner: binding.owner, generation: binding.generation, phase,
    disabledCommands: binding.disabledCommands.map(({ session }) => session.count),
    pointer, tabInputs, tabVisits: binding.tabVisits,
    criterion: 'P-BASE-BUTTON-DISABLED-SUPPRESS-ACTIVATION / DISABLED-REJECT-FOCUS (draft)',
    boundary: 'Authored disabled Buttons receive a native pointer attempt at their actual bounds and are skipped by a bounded native Tab traversal. If the host makes them unreachable, no targeted native disabled key delivery is claimed; independent semantic disabled press.commit rejection remains required.',
  };
}
export function resetContrastButtonControlInputs(binding: ButtonKeyboardBinding) {
  binding.inputs.length = 0;
  binding.disabledPointer.length = 0;
  binding.tabVisits.length = 0;
}
