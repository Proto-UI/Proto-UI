import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMatrixEntryCostDiagnostic } from './demo-matrix-entry-cost-diagnostic';

const original = Object.getOwnPropertyDescriptor(Element.prototype, 'checkVisibility');
const originalObserver = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver')!;
const originalQueue = Object.getOwnPropertyDescriptor(globalThis, 'queueMicrotask')!;
afterEach(() => {
  if (original) Object.defineProperty(Element.prototype, 'checkVisibility', original);
  else delete (Element.prototype as Partial<Element>).checkVisibility;
  Object.defineProperty(globalThis, 'MutationObserver', originalObserver);
  Object.defineProperty(globalThis, 'queueMicrotask', originalQueue);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function native(method: (this: Element, ...args: unknown[]) => unknown) {
  Object.defineProperty(Element.prototype, 'checkVisibility', {
    configurable: true,
    writable: true,
    value: method,
  });
}
function attribution() {
  let time = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => (time += 10_000));
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  return () => {
    const line = info.mock.calls.at(-1)?.[0] as string;
    return JSON.parse(line.slice('[matrix-entry-cost] '.length)).attribution;
  };
}
function entry() {
  return document.createElement('pui-s3-light-content-a-0');
}

describe('opt-in Matrix native call attribution', () => {
  it('serializes without module-private dependencies for a real page init script', () => {
    const method = vi.fn(() => true);
    native(method);
    const dispose = new Function(`return (${installMatrixEntryCostDiagnostic.toString()})()`)();
    expect(document.body.checkVisibility()).toBe(true);
    expect(method).toHaveBeenCalledTimes(1);
    dispose();
    expect(Element.prototype.checkVisibility).toBe(method);
  });

  it('forwards the exact native receiver, arguments and result', () => {
    const expected = { checkVisibilityCSS: true };
    const receiver = document.createElement('button');
    const method = vi.fn(function (this: Element, options: unknown) {
      expect(this).toBe(receiver);
      expect(options).toBe(expected);
      return false;
    });
    native(method);
    const dispose = installMatrixEntryCostDiagnostic();
    expect(receiver.checkVisibility(expected)).toBe(false);
    expect(method).toHaveBeenCalledTimes(1);
    dispose();
    expect(Element.prototype.checkVisibility).toBe(method);
  });

  it('preserves a native exception even if diagnostic output also throws', () => {
    const failure = new Error('native failure');
    native(() => {
      throw failure;
    });
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (time += 10_000));
    vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('sink unavailable');
    });
    installMatrixEntryCostDiagnostic();
    expect(() => document.body.checkVisibility()).toThrow(failure);
  });

  it('caps records without skipping later native calls or restoring over another owner', () => {
    const method = vi.fn(() => true);
    native(method);
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (time += 10_000));
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const dispose = installMatrixEntryCostDiagnostic();
    for (let i = 0; i < 40; i++) expect(document.body.checkVisibility()).toBe(true);
    expect(method).toHaveBeenCalledTimes(40);
    expect(info).toHaveBeenCalledTimes(18);
    const successor = () => false;
    native(successor);
    dispose();
    expect(Element.prototype.checkVisibility).toBe(successor);
  });

  it('attributes real MutationObserver delivery through two native microtask continuations', async () => {
    const target = entry();
    const changed = document.createElement('div');
    document.body.append(changed, target);
    const result = attribution();
    native(() => true);
    const dispose = installMatrixEntryCostDiagnostic();
    let delivered: MutationRecord[] | undefined;
    let finish!: () => void;
    const completed = new Promise<void>((resolve) => (finish = resolve));
    const observer = new MutationObserver(function originalMutationCallback(
      this: MutationObserver,
      records,
      receiver
    ) {
      expect(this).toBe(observer);
      expect(receiver).toBe(observer);
      delivered = records;
      queueMicrotask(function firstContinuation() {
        queueMicrotask(function sampleContinuation() {
          expect(target.checkVisibility()).toBe(true);
          finish();
        });
      });
    });
    observer.observe(changed, { attributes: true });
    changed.setAttribute('data-entry-cause', 'private-value-must-not-be-recorded');
    await completed;
    observer.disconnect();
    const cause = result().causes[0];
    expect(delivered).toHaveLength(1);
    expect(cause.frames.map((frame: { kind: string }) => frame.kind)).toEqual([
      'mutation',
      'microtask',
      'microtask',
    ]);
    expect(cause.frames.map((frame: { callback: string }) => frame.callback)).toEqual([
      'originalMutationCallback',
      'firstContinuation',
      'sampleContinuation',
    ]);
    expect(cause.recordInputs).toEqual([
      { type: 'attributes', attribute: 'data-entry-cause', target: 'div', visibilityCalls: 1 },
    ]);
    expect(cause.frames[0].source.length).toBeGreaterThan(0);
    expect(JSON.stringify(result())).not.toContain('private-value-must-not-be-recorded');
    dispose();
  });

  it('preserves queue receiver, extra arguments, return value and callback exception', () => {
    const receiver = {};
    const callbackReceiver = {};
    const extra = {};
    const returned = {};
    const callbackArgument = {};
    const failure = new Error('original callback failure');
    let queued!: Function;
    const enqueue = vi.fn(function (this: unknown, callback: Function, forwarded: unknown) {
      expect(this).toBe(receiver);
      expect(forwarded).toBe(extra);
      queued = callback;
      return returned;
    });
    Object.defineProperty(globalThis, 'queueMicrotask', { ...originalQueue, value: enqueue });
    native(() => true);
    const result = attribution();
    const dispose = installMatrixEntryCostDiagnostic();
    const callback = vi.fn(function (this: unknown, argument: unknown) {
      expect(this).toBe(callbackReceiver);
      expect(argument).toBe(callbackArgument);
      throw failure;
    });
    expect(Reflect.apply(globalThis.queueMicrotask, receiver, [callback, extra])).toBe(returned);
    expect(() => Reflect.apply(queued, callbackReceiver, [callbackArgument])).toThrow(failure);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    entry().checkVisibility();
    expect(result().causes[0].frames[0].kind).toBe('direct');
    dispose();
    expect(globalThis.queueMicrotask).toBe(enqueue);
  });

  it('preserves observer subclass identity, methods, native constructor validation and delivery values', () => {
    const invalid = new TypeError('native callback validation');
    const records: MutationRecord[] = [];
    class NativeObserver {
      callback: Function;
      constructor(callback: Function) {
        if (typeof callback !== 'function') throw invalid;
        this.callback = callback;
      }
      takeRecords() {
        return records;
      }
      deliver(...args: unknown[]) {
        return Reflect.apply(this.callback, this, args);
      }
    }
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: NativeObserver,
    });
    native(() => true);
    const dispose = installMatrixEntryCostDiagnostic();
    class SubObserver extends MutationObserver {
      marker = 'subclass';
    }
    const returned = {};
    const callback = vi.fn(function (this: unknown, items: unknown, deliveredObserver: unknown) {
      expect(this).toBe(observer);
      expect(items).toBe(records);
      expect(deliveredObserver).toBe(observer);
      return returned;
    });
    const observer = new SubObserver(callback) as SubObserver & NativeObserver;
    expect(observer).toBeInstanceOf(SubObserver);
    expect(observer).toBeInstanceOf(NativeObserver);
    expect(observer.marker).toBe('subclass');
    expect(observer.takeRecords()).toBe(records);
    expect(observer.deliver(records, observer)).toBe(returned);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(() => Reflect.construct(MutationObserver, [null])).toThrow(invalid);
    dispose();
    expect(globalThis.MutationObserver).toBe(NativeObserver);
  });

  it('records only the six requested hosts and bounds large real mutation deliveries', async () => {
    const result = attribution();
    native(() => true);
    const dispose = installMatrixEntryCostDiagnostic();
    document.body.checkVisibility();
    expect(result().causeGroups).toBe(0);
    const target = entry();
    const changed = document.createElement('section');
    document.body.append(changed, target);
    let finish!: () => void;
    const completed = new Promise<void>((resolve) => (finish = resolve));
    let delivered = 0;
    const observer = new MutationObserver((records) => {
      delivered = records.length;
      target.checkVisibility();
      finish();
    });
    observer.observe(changed, { attributes: true });
    for (let i = 0; i < 80; i++) changed.setAttribute(`data-origin-${i}`, String(i));
    await completed;
    observer.disconnect();
    expect(delivered).toBe(80);
    const frame = result().causes[0].frames[0];
    expect(frame.recordCount).toBe(80);
    expect(frame.recordsTruncated).toBe(true);
    expect(frame.records).toHaveLength(8);
    expect(result().targets).toHaveLength(6);
    dispose();
  });

  it('keeps two interleaved observer causes separate without changing native queue order', async () => {
    const result = attribution();
    native(() => true);
    const dispose = installMatrixEntryCostDiagnostic();
    const order: string[] = [];
    const a = document.createElement('div'),
      b = document.createElement('p');
    const target = entry();
    document.body.append(a, b, target);
    let finish!: () => void;
    const completed = new Promise<void>((resolve) => (finish = resolve));
    const observerA = new MutationObserver(function originA() {
      queueMicrotask(function continuationA() {
        order.push('a');
        target.checkVisibility();
      });
    });
    const observerB = new MutationObserver(function originB() {
      queueMicrotask(function continuationB() {
        order.push('b');
        target.checkVisibility();
        finish();
      });
    });
    observerA.observe(a, { attributes: true });
    observerB.observe(b, { attributes: true });
    a.setAttribute('data-alpha', '1');
    b.setAttribute('data-beta', '1');
    await completed;
    observerA.disconnect();
    observerB.disconnect();
    expect(order).toEqual(['a', 'b']);
    const causes = result().causes;
    expect(causes).toHaveLength(2);
    expect(
      causes.map((cause: { recordInputs: Array<{ attribute: string }> }) =>
        cause.recordInputs.map((input) => input.attribute)
      )
    ).toEqual([['data-alpha'], ['data-beta']]);
    dispose();
  });

  it('bounds deep continuation chains while retaining their first cause and every callback', async () => {
    const result = attribution();
    native(() => true);
    const dispose = installMatrixEntryCostDiagnostic();
    const target = entry();
    let remaining = 7;
    let callbacks = 0;
    await new Promise<void>((resolve) => {
      function continuation() {
        callbacks++;
        if (remaining-- > 0) queueMicrotask(continuation);
        else {
          target.checkVisibility();
          resolve();
        }
      }
      queueMicrotask(continuation);
    });
    expect(callbacks).toBe(8);
    expect(result().causes[0].frames).toHaveLength(4);
    expect(result().causes[0].droppedFrames).toBe(4);
    dispose();
  });

  it('retires queued attribution and does not overwrite newer observer or scheduler owners', () => {
    let queued!: Function;
    const enqueue = (callback: Function) => {
      queued = callback;
    };
    Object.defineProperty(globalThis, 'queueMicrotask', { ...originalQueue, value: enqueue });
    const method = vi.fn(() => true);
    native(method);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const dispose = installMatrixEntryCostDiagnostic();
    const callback = vi.fn(() => entry().checkVisibility());
    queueMicrotask(callback);
    const nextObserver = class {};
    const nextQueue = () => {};
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: nextObserver,
    });
    Object.defineProperty(globalThis, 'queueMicrotask', { ...originalQueue, value: nextQueue });
    dispose();
    queued();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(method).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
    expect(globalThis.MutationObserver).toBe(nextObserver);
    expect(globalThis.queueMicrotask).toBe(nextQueue);
  });
});
