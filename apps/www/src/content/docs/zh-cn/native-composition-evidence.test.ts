import { describe, expect, it } from 'vitest';
import {
  assertNativeCompositionSequence,
  installCompositionDispatchObservation,
  observeNativeComposition,
  readNativeComposition,
  type NativeCompositionEvent,
} from './native-composition-evidence';

const expected = {
  kind: 'input' as const,
  initial: 'Draft',
  candidates: ['ni', '你好'],
  committed: '你好',
};
const receipt = (endTrusted: boolean): NativeCompositionEvent[] =>
  [
    { type: 'compositionstart', data: 'Draft', value: 'Draft' },
    { type: 'compositionupdate', data: 'ni', value: 'Draft' },
    { type: 'compositionupdate', data: '你好', value: 'ni' },
    { type: 'compositionend', data: '你好', value: '你好' },
  ].map((event, index) => ({
    objectId: index + 1,
    constructorName: 'CompositionEvent',
    isCompositionEvent: true,
    targetTag: 'INPUT',
    targetIsEditor: true,
    originIsEditor: true,
    eventPhase: 2,
    bubbles: true,
    composed: true,
    cancelable: false,
    isComposing: null,
    scriptDispatched: false,
    dispatchObserverActive: true,
    isTrusted: event.type === 'compositionend' ? endTrusted : true,
    ...event,
  }));

describe('native composition attribution against a separately executed plain editor', () => {
  it.each([false, true])('preserves the actual native end trusted=%s flag', (endTrusted) => {
    const control = receipt(endTrusted);
    expect(() =>
      assertNativeCompositionSequence(structuredClone(control), control, expected)
    ).not.toThrow();
    const differentEnd = structuredClone(control);
    differentEnd.at(-1)!.isTrusted = !endTrusted;
    expect(() => assertNativeCompositionSequence(differentEnd, control, expected)).toThrow();
  });

  it.each([
    [
      'replaced dispatch observer',
      (events: NativeCompositionEvent[]) => {
        events.at(-1)!.dispatchObserverActive = false;
      },
    ],
    [
      'script end',
      (events: NativeCompositionEvent[]) => {
        events.at(-1)!.scriptDispatched = true;
      },
    ],
    [
      'untrusted start',
      (events: NativeCompositionEvent[]) => {
        events[0].isTrusted = false;
      },
    ],
    [
      'untrusted update',
      (events: NativeCompositionEvent[]) => {
        events[1].isTrusted = false;
      },
    ],
    [
      'wrong constructor',
      (events: NativeCompositionEvent[]) => {
        events.at(-1)!.constructorName = 'Event';
      },
    ],
    [
      'wrong event object',
      (events: NativeCompositionEvent[]) => {
        events.at(-1)!.isCompositionEvent = false;
      },
    ],
    [
      'wrong target',
      (events: NativeCompositionEvent[]) => {
        events.at(-1)!.targetIsEditor = false;
      },
    ],
    [
      'retargeted origin',
      (events: NativeCompositionEvent[]) => {
        events.at(-1)!.originIsEditor = false;
      },
    ],
    [
      'wrong editor kind',
      (events: NativeCompositionEvent[]) => {
        events[0].targetTag = 'TEXTAREA';
      },
    ],
    [
      'wrong initial value',
      (events: NativeCompositionEvent[]) => {
        events[0].value = 'Other';
      },
    ],
    [
      'wrong committed value',
      (events: NativeCompositionEvent[]) => {
        events.at(-1)!.value = 'Rejected';
      },
    ],
    [
      'wrong committed data',
      (events: NativeCompositionEvent[]) => {
        events.at(-1)!.data = 'Other';
      },
    ],
    [
      'reused object',
      (events: NativeCompositionEvent[]) => {
        events.at(-1)!.objectId = events[0].objectId;
      },
    ],
    [
      'missing end',
      (events: NativeCompositionEvent[]) => {
        events.pop();
      },
    ],
    [
      'duplicated end',
      (events: NativeCompositionEvent[]) => {
        events.push({ ...events.at(-1)!, objectId: 5 });
      },
    ],
    [
      'reordered update',
      (events: NativeCompositionEvent[]) => {
        [events[1], events[2]] = [events[2], events[1]];
      },
    ],
  ])('rejects %s even if both collectors would report the same corruption', (_name, corrupt) => {
    const control = receipt(false);
    const actual = structuredClone(control);
    corrupt(actual);
    expect(() => assertNativeCompositionSequence(actual, control, expected)).toThrow();
    // The plain control is independently subject to provenance and lifecycle
    // gates, so equal corrupted streams cannot pass by comparison alone.
    expect(() =>
      assertNativeCompositionSequence(actual, structuredClone(actual), expected)
    ).toThrow();
  });

  it('requires a complete independently recorded control', () => {
    expect(() => assertNativeCompositionSequence(receipt(false), [], expected)).toThrow();
  });

  it('observes JavaScript dispatch without changing its object, target or return value', () => {
    const restore = installCompositionDispatchObservation();
    const target = new EventTarget();
    try {
      // HappyDOM does not implement native CompositionEvent. This test checks
      // only dispatch forwarding; the browser suite executes the actual
      // CompositionEvent negative control on both physical editor kinds.
      const event = new Event('probe', { cancelable: true });
      target.addEventListener('probe', (received) => {
        expect(received).toBe(event);
        expect(received.target).toBe(target);
        received.preventDefault();
      });
      expect(target.dispatchEvent(event)).toBe(false);
      const observation = (
        window as unknown as Window & {
          __puiCompositionDispatch: { scriptEvents: WeakSet<Event> };
        }
      ).__puiCompositionDispatch;
      expect(observation.scriptEvents.has(event)).toBe(true);
      expect(observation.scriptEvents.has(new Event('untouched'))).toBe(false);
    } finally {
      restore();
    }
  });

  it('rejects an observer replaced after installation', () => {
    const restore = installCompositionDispatchObservation();
    const observer = EventTarget.prototype.dispatchEvent;
    try {
      EventTarget.prototype.dispatchEvent = function (event) {
        return Reflect.apply(observer, this, [event]);
      };
      expect(() => readNativeComposition(document.createElement('input'))).toThrow(
        'Composition dispatch observation is inactive'
      );
    } finally {
      EventTarget.prototype.dispatchEvent = observer;
      restore();
    }
  });

  it.each([installCompositionDispatchObservation, observeNativeComposition, readNativeComposition])(
    'has valid standalone browser transport syntax',
    (observe) => {
      expect(typeof Function(`return (${observe.toString()})`)()).toBe('function');
    }
  );
});
