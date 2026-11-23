import assert from 'node:assert/strict';

export type NativeCompositionEvent = {
  objectId: number;
  type: string;
  constructorName: string;
  isCompositionEvent: boolean;
  targetTag: string | null;
  targetIsEditor: boolean;
  originIsEditor: boolean;
  eventPhase: number;
  bubbles: boolean;
  composed: boolean;
  cancelable: boolean;
  data: string | null;
  isComposing: boolean | null;
  value: string;
  isTrusted: boolean;
  scriptDispatched: boolean;
  dispatchObserverActive: boolean;
};

type DispatchObservation = { scriptEvents: WeakSet<Event>; isActive(): boolean };
type ObservedWindow = Window & { __puiCompositionDispatch?: DispatchObservation };
type ObservedEditor = (HTMLInputElement | HTMLTextAreaElement) & {
  __puiNativeComposition?: NativeCompositionEvent[];
};

/** Install before fixture scripts. Observe JS dispatch without altering the
 * event or the original dispatch call; browser-generated dispatch bypasses it. */
export function installCompositionDispatchObservation(): () => void {
  const observedWindow = window as ObservedWindow;
  if (observedWindow.__puiCompositionDispatch)
    throw new Error('Composition dispatch observation already installed');
  const scriptEvents = new WeakSet<Event>();
  const original = EventTarget.prototype.dispatchEvent;
  const observer: typeof original = function (this: EventTarget, event: Event) {
    scriptEvents.add(event);
    return Reflect.apply(original, this, [event]);
  };
  EventTarget.prototype.dispatchEvent = observer;
  observedWindow.__puiCompositionDispatch = {
    scriptEvents,
    isActive: () => EventTarget.prototype.dispatchEvent === observer,
  };
  return () => {
    if (EventTarget.prototype.dispatchEvent !== observer)
      throw new Error('Composition dispatch observer was replaced');
    EventTarget.prototype.dispatchEvent = original;
    delete observedWindow.__puiCompositionDispatch;
  };
}

/** Standalone browser transport. Retain the actual event's flags and physical
 * target before TextControl's bubbling listener restores a controlled value. */
export function observeNativeComposition(element: Element): void {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement))
    throw new Error('Composition observation requires the physical editor');
  const observation = (window as ObservedWindow).__puiCompositionDispatch;
  if (!observation?.isActive()) throw new Error('Composition dispatch observation is inactive');
  const editor = element as ObservedEditor;
  if (editor.__puiNativeComposition) throw new Error('Composition editor already observed');
  const events: NativeCompositionEvent[] = [];
  const ids = new WeakMap<Event, number>();
  let nextId = 0;
  editor.__puiNativeComposition = events;
  for (const type of ['compositionstart', 'compositionupdate', 'compositionend']) {
    editor.addEventListener(
      type,
      (event) => {
        if (!ids.has(event)) ids.set(event, ++nextId);
        events.push({
          objectId: ids.get(event)!,
          type: event.type,
          constructorName: event.constructor.name,
          isCompositionEvent: event instanceof CompositionEvent,
          targetTag: event.target instanceof Element ? event.target.tagName : null,
          targetIsEditor: event.target === editor,
          originIsEditor: event.composedPath()[0] === editor,
          eventPhase: event.eventPhase,
          bubbles: event.bubbles,
          composed: event.composed,
          cancelable: event.cancelable,
          data: (event as CompositionEvent).data,
          isComposing:
            typeof (event as InputEvent).isComposing === 'boolean'
              ? (event as InputEvent).isComposing
              : null,
          value: editor.value,
          isTrusted: event.isTrusted,
          scriptDispatched: observation.scriptEvents.has(event),
          dispatchObserverActive: observation.isActive(),
        });
      },
      { capture: true }
    );
  }
}

export function readNativeComposition(element: Element): NativeCompositionEvent[] {
  if (!(window as ObservedWindow).__puiCompositionDispatch?.isActive())
    throw new Error('Composition dispatch observation is inactive');
  const events = (element as ObservedEditor).__puiNativeComposition;
  if (!events) throw new Error('Composition editor observation is missing');
  return events;
}

/** The same engine and CDP sequence supplies an independent plain-editor
 * control. Never coerce an untrusted end to trusted or accept a script dispatch. */
export function assertNativeCompositionSequence(
  actual: readonly NativeCompositionEvent[],
  control: readonly NativeCompositionEvent[],
  expected: {
    kind: 'input' | 'textarea';
    initial: string;
    candidates: readonly string[];
    committed: string;
  }
): void {
  for (const [label, events] of [
    ['native control', control],
    ['component', actual],
  ] as const) {
    assert.ok(events.length >= 3, `${label}: native composition lifecycle is missing`);
    assert.equal(new Set(events.map(({ objectId }) => objectId)).size, events.length);
    assert.equal(events[0].type, 'compositionstart');
    assert.equal(events[0].value, expected.initial);
    assert.equal(events.at(-1)!.type, 'compositionend');
    assert.equal(events.at(-1)!.value, expected.committed);
    assert.equal(events.at(-1)!.data, expected.committed);
    assert.ok(events.slice(1, -1).every(({ type }) => type === 'compositionupdate'));
    const updates = events.slice(1, -1);
    assert.deepEqual(
      updates
        .map(({ data }) => data)
        .filter((data, index, all) => index === 0 || data !== all[index - 1]),
      expected.candidates
    );
    let previous = expected.initial;
    for (const update of updates) {
      assert.equal(update.value, previous, `${label}: composition update value/order drift`);
      previous = update.data!;
    }
    for (const event of events) {
      assert.equal(
        event.dispatchObserverActive,
        true,
        `${label}: script-dispatch observer was replaced`
      );
      assert.equal(
        event.scriptDispatched,
        false,
        `${label}: script dispatch is not native evidence`
      );
      assert.equal(event.constructorName, 'CompositionEvent');
      assert.equal(event.isCompositionEvent, true);
      assert.equal(event.targetTag, expected.kind.toUpperCase());
      assert.equal(event.targetIsEditor, true);
      assert.equal(event.originIsEditor, true);
      assert.equal(event.eventPhase, 2);
      assert.equal(event.isComposing, null);
      assert.equal(typeof event.isTrusted, 'boolean');
      // Start/update and every native input retain the original trusted gate.
      // Only the end flag is compared to the independently executed control.
      if (event.type !== 'compositionend') assert.equal(event.isTrusted, true);
    }
  }
  assert.deepEqual(
    actual,
    control,
    'component composition must preserve the complete native event sequence and flags'
  );
}
