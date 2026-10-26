// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locator, Page } from 'playwright-core';
import {
  createAccordionActivationObservation,
  installAccordionInputJournal,
} from './accordion-activation-observation';

const state = vi.hoisted(() => ({ observer: null as any, install: vi.fn() }));
vi.mock('./docs-query-timing.mjs', () => ({
  installDocsCallTimingObserver: (...args: unknown[]) => {
    state.install(...args);
    return state.observer;
  },
}));
let directory = '',
  previous: string | undefined;
beforeEach(async () => {
  previous = process.env.PROTO_UI_ACCORDION_ACTIVATION_PROBE_DIR;
  directory = await mkdtemp(path.join(tmpdir(), 'accordion-activation-'));
  process.env.PROTO_UI_ACCORDION_ACTIVATION_PROBE_DIR = directory;
  state.install.mockClear();
  state.observer = {
    runOriginalQuery: vi.fn((_query, read) => read()),
    freezeVerdict: vi.fn(),
    markContextCloseStart: vi.fn(),
    disposeAfterContextClosed: vi.fn(),
    snapshot: vi.fn(() => ({})),
  };
});
afterEach(async () => {
  if (previous === undefined) delete process.env.PROTO_UI_ACCORDION_ACTIVATION_PROBE_DIR;
  else process.env.PROTO_UI_ACCORDION_ACTIVATION_PROBE_DIR = previous;
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});
const button = { _selector: 'exact-original-selector' } as unknown as Locator;
const page = { evaluate: vi.fn(async () => ({ rows: [] })) } as unknown as Page;

describe('Accordion activation observation boundary', () => {
  it('does not install SDK taps without the explicit evidence environment', () => {
    delete process.env.PROTO_UI_ACCORDION_ACTIVATION_PROBE_DIR;
    expect(createAccordionActivationObservation(page, button)).toBeNull();
    expect(state.install).not.toHaveBeenCalled();
  });
  it('retains the original Promise once and immutable per-poll attribution', () => {
    const observation = createAccordionActivationObservation(page, button)!;
    observation.setPhase('space-close');
    const poll = observation.beginPoll(false);
    observation.setPhase('fresh-enter');
    const promise = Promise.resolve('false'),
      read = vi.fn(() => promise);
    expect(observation.read(poll, read)).toBe(promise);
    expect(read).toHaveBeenCalledTimes(1);
    expect(state.observer.runOriginalQuery.mock.calls[0][0]).toMatchObject({
      pollId: poll.pollId,
      phase: 'space-close',
      expected: false,
      query: 1,
    });
    expect(state.install.mock.calls[0][1]).toMatchObject({
      selector: 'exact-original-selector',
      attribute: 'aria-expanded',
    });
  });
  it('freezes only the first failure and does not let diagnostic throws replace the getter error', async () => {
    const observation = createAccordionActivationObservation(page, button)!;
    const sentinel = Object.create(null),
      read = vi.fn(() => {
        throw sentinel;
      });
    const poll = observation.beginPoll(true);
    state.observer.freezeVerdict.mockImplementation(() => {
      throw new Error('diagnostic-only');
    });
    let caught;
    try {
      observation.read(poll, read);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(sentinel);
    expect(() => observation.fail(poll)).not.toThrow();
    expect(() => observation.failCase()).not.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
    expect(state.observer.freezeVerdict).toHaveBeenCalledTimes(1);
    expect(state.observer.freezeVerdict).toHaveBeenCalledWith(false);
    await observation.afterClose(false);
    expect(state.observer.disposeAfterContextClosed).toHaveBeenCalledTimes(1);
    expect(state.observer.disposeAfterContextClosed).toHaveBeenCalledWith(false);
    expect(
      JSON.parse(await readFile(path.join(directory, 'activation-final.json'), 'utf8'))
    ).toMatchObject({ contextClosed: false, callerDiagnosticErrors: 1 });
  });
  it('keeps post-verdict capture failure separate from confirmed context closure', async () => {
    const badPage = {
      evaluate: vi.fn(async () => {
        throw new Error('capture');
      }),
    } as unknown as Page;
    const observation = createAccordionActivationObservation(badPage, button)!;
    await expect(observation.beforeClose()).resolves.toBeUndefined();
    await observation.afterClose(true);
    expect(state.observer.disposeAfterContextClosed).toHaveBeenCalledTimes(1);
    expect(state.observer.disposeAfterContextClosed).toHaveBeenCalledWith(true);
    expect(
      JSON.parse(await readFile(path.join(directory, 'activation-final.json'), 'utf8'))
    ).toMatchObject({ contextClosed: true, callerDiagnosticErrors: 1 });
  });
  it('bounds the synthetic journal control to Space, fresh Enter and the next original key', () => {
    const callbacks = new Map<string, ((event: any) => void)[]>();
    class ElementControl {
      localName = 'div';
      id = 'control';
      isConnected = true;
      parentElement = null;
      attributes = [];
      getAttribute(name: string) {
        return name === 'data-demo-ref' ? 'single-lifetime-trigger' : null;
      }
      closest(selector: string) {
        return selector === '[data-demo-ref]' ? this : null;
      }
    }
    const target = new ElementControl(),
      w: any = { addEventListener() {} };
    vi.stubGlobal('window', w);
    vi.stubGlobal('Element', ElementControl);
    vi.stubGlobal('document', {
      activeElement: target,
      addEventListener(type: string, callback: (event: any) => void) {
        callbacks.set(type, [...(callbacks.get(type) ?? []), callback]);
      },
    });
    vi.stubGlobal(
      'MutationObserver',
      class {
        observe() {}
      }
    );
    installAccordionInputJournal(true);
    const send = (key: string) => {
      for (const callback of callbacks.get('keydown')!)
        callback({ target, type: 'keydown', key, isTrusted: false, eventPhase: 1 });
    };
    send('Enter');
    expect(w.__accordionTrace.snapshot().rows).toEqual([]);
    send(' ');
    send('Enter');
    const retained = w.__accordionTrace.snapshot().rows.length;
    expect(retained).toBe(2);
    send('Tab');
    send('Enter');
    const snapshot = w.__accordionTrace.snapshot();
    expect(snapshot.rows).toHaveLength(retained);
    expect(snapshot.windowStop).toMatchObject({
      key: 'Tab',
      reason: 'next-original-key-after-reopen',
    });
    expect(snapshot.errors).toBe(0);
    expect(snapshot.dropped).toBe(0);
    expect(w.__accordionInputEvidence.map((event: any) => event.key)).toEqual([
      'Enter',
      ' ',
      'Enter',
      'Tab',
      'Enter',
    ]);
  });
});
