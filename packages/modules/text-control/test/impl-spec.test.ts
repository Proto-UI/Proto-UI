import { describe, expect, it } from 'vitest';
import type { TextControlEvent, TextControlLineMode, TextControlPatch } from '@proto.ui/core';
import { CapsVault, SYS_CAP, type SystemCaps } from '@proto.ui/module-base';
import {
  TEXT_CONTROL_HOST_CAP,
  type TextControlHost,
  type TextControlHostConnection,
  type TextControlHostLease,
} from '../src/caps';
import { createTextControlModule } from '../src/create';
import { declareTextControl } from '../src/declaration';

type TestSystemCaps = SystemCaps & {
  phase: 'setup' | 'callback';
  flushDeferred(): void;
};

function createSystemCaps(): TestSystemCaps {
  let phase: 'setup' | 'callback' = 'setup';
  const deferred: Array<() => void> = [];
  const run = { update() {} };
  return {
    execPhase: () => phase,
    domain: () => (phase === 'setup' ? 'setup' : 'runtime'),
    protoPhase: () => 'mounted',
    instancePhase: () => 'alive',
    mountPhase: () => 'mounted',
    isDisposed: () => false,
    ensureNotDisposed() {},
    ensureExecPhase(_op, expected) {
      const values = Array.isArray(expected) ? expected : [expected];
      if (!values.includes(phase)) throw new Error('illegal phase');
    },
    ensureSetup() {
      if (phase !== 'setup') throw new Error('illegal phase');
    },
    ensureRuntime() {
      if (phase === 'setup') throw new Error('illegal phase');
    },
    ensureCallback() {
      if (phase !== 'callback') throw new Error('illegal phase');
    },
    getCallbackCtx: () => (phase === 'callback' ? run : undefined),
    deferAfterCallback: (task) => deferred.push(task),
    set phase(value: 'setup' | 'callback') {
      phase = value;
    },
    flushDeferred() {
      for (const task of deferred.splice(0)) task();
    },
  } as TestSystemCaps;
}

function event(type: TextControlEvent['type'], value: string, composing = false): TextControlEvent {
  return { type, value, composing, data: null, inputType: null };
}

function createHarness(withHost = true, lineMode: TextControlLineMode = 'multiline') {
  const sys = createSystemCaps();
  const vault = new CapsVault();
  const connectionBox: { current: TextControlHostConnection | null } = { current: null };
  let patchValue = '';
  let latestPatch: TextControlPatch = {};
  let disposed = 0;
  let updateCount = 0;
  vault.attachBase([[SYS_CAP, sys]]);
  const lease: TextControlHostLease = {
    update(patch) {
      updateCount += 1;
      latestPatch = patch;
      if (typeof patch.value === 'string') patchValue = patch.value;
    },
    snapshot: () => ({ value: patchValue, composing: false }),
    dispose() {
      disposed += 1;
    },
  };
  const host: TextControlHost = {
    attach(connection) {
      connectionBox.current = connection;
      latestPatch = connection.patch;
      patchValue = connection.patch.value ?? connection.patch.defaultValue ?? '';
      return lease;
    },
  };
  if (withHost) vault.attach([[TEXT_CONTROL_HOST_CAP, host]]);
  const module = createTextControlModule({
    init: {
      prototypeName: 'x-textarea',
      declarations: [declareTextControl({ content: 'plain-text', lineMode, engine: 'host' })],
    },
    caps: vault,
    deps: {
      requireFacade: () => {
        throw new Error('unused');
      },
      requirePort: () => {
        throw new Error('unused');
      },
      tryFacade: () => undefined,
      tryPort: () => undefined,
    },
  });
  return {
    sys,
    vault,
    module,
    connectionBox,
    getPatchValue: () => patchValue,
    getLatestPatch: () => latestPatch,
    setPatchValue: (value: string) => {
      patchValue = value;
    },
    getDisposed: () => disposed,
    getUpdateCount: () => updateCount,
  };
}

describe('module-text-control', () => {
  it('keeps uncontrolled ownership stable after edits and later prop changes', () => {
    const harness = createHarness();
    const control = harness.module.facade.declare();
    expect(() => harness.module.facade.declare()).toThrow(/one text control/);
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';
    control.sync({ valueMode: 'uncontrolled', defaultValue: 'initial' });
    const connection = harness.connectionBox.current;
    if (!connection) throw new Error('text-control host connection was not attached');

    const values: string[] = [];
    harness.sys.phase = 'setup';
    control.on('input', (_run, next) => values.push(next.value));
    harness.sys.phase = 'callback';
    connection.onEvent(event('input', 'dirty'));
    expect(control.snapshot()).toEqual({ value: 'dirty', composing: false });
    expect(values).toEqual(['dirty']);

    control.sync({ valueMode: 'uncontrolled', defaultValue: 'replacement' });
    control.sync({ valueMode: 'controlled', value: 'late control' });
    expect(control.snapshot()?.value).toBe('dirty');
    expect(harness.getPatchValue()).toBe('dirty');

    harness.module.hooks.onMountPhase?.('detached', 1);
    expect(harness.getDisposed()).toBeGreaterThan(0);
  });

  it('retains defaultValue across unrelated patches and a fresh host lease', () => {
    const harness = createHarness();
    const control = harness.module.facade.declare();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';
    control.sync({ valueMode: 'uncontrolled', defaultValue: 'initial' });
    control.sync({ disabled: true });

    expect(harness.getLatestPatch()).toMatchObject({
      valueMode: 'uncontrolled',
      defaultValue: 'initial',
      disabled: true,
    });

    harness.module.hooks.onMountPhase?.('detached', 1);
    harness.module.hooks.onMountPhase?.('mounted', 2);
    expect(harness.getLatestPatch()).toMatchObject({
      valueMode: 'uncontrolled',
      defaultValue: 'initial',
      disabled: true,
    });
  });

  it('retains the declaration and accepts common hints for both line modes', () => {
    const multiline = createHarness(true, 'multiline');
    const multilineControl = multiline.module.facade.declare();
    multiline.module.hooks.onMountPhase?.('mounted', 1);
    multiline.sys.phase = 'callback';
    expect(() => multilineControl.sync({ inputMode: 'search' })).not.toThrow();
    expect(() => multilineControl.sync({ enterKeyHint: 'search' })).not.toThrow();
    expect(() => multilineControl.sync({ rows: 4, wrap: 'hard' })).not.toThrow();

    const single = createHarness(true, 'single');
    const singleControl = single.module.facade.declare();
    single.module.hooks.onMountPhase?.('mounted', 1);
    single.sys.phase = 'callback';
    expect(() => singleControl.sync({ rows: 4 })).toThrow(/not compatible with single-line/);
    expect(() => singleControl.sync({ wrap: 'hard' })).toThrow(/not compatible with single-line/);
    expect(() => singleControl.sync({ inputMode: 'search', enterKeyHint: 'search' })).not.toThrow();
  });

  it('removes normalized line feeds from single-line patch, state, and event values', () => {
    const harness = createHarness(true, 'single');
    const control = harness.module.facade.declare();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    const seen: string[] = [];
    control.on('input', (_run, next) => seen.push(next.value));

    harness.sys.phase = 'callback';
    control.sync({ valueMode: 'uncontrolled', defaultValue: 'a\r\nb\nc' });
    expect(harness.getLatestPatch().defaultValue).toBe('abc');
    expect(control.snapshot()).toEqual({ value: 'abc', composing: false });

    const connection = harness.connectionBox.current;
    if (!connection) throw new Error('text-control host connection was not attached');
    connection.onEvent(event('input', 'x\r\ny\nz'));
    expect(control.snapshot()).toEqual({ value: 'xyz', composing: false });
    expect(seen).toEqual(['xyz']);
  });

  it('canonicalizes CR and CRLF in outward event data', () => {
    const harness = createHarness(true, 'multiline');
    const control = harness.module.facade.declare();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    const seen: Array<string | null> = [];
    control.on('compositionupdate', (_run, next) => seen.push(next.data));

    const connection = harness.connectionBox.current;
    if (!connection) throw new Error('text-control host connection was not attached');
    harness.sys.phase = 'callback';
    connection.onEvent({
      ...event('compositionupdate', 'value'),
      data: 'a\r\nb\rc',
      inputType: 'insertCompositionText',
    });

    expect(seen).toEqual(['a\nb\nc']);
  });

  it('preserves controlled composition and restores only after the IME boundary', async () => {
    const harness = createHarness();
    const control = harness.module.facade.declare();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';
    control.sync({ valueMode: 'controlled', value: 'fixed' });
    const connection = harness.connectionBox.current;
    if (!connection) throw new Error('text-control host connection was not attached');

    const beforeComposition = harness.getUpdateCount();
    connection.onEvent(event('compositionstart', 'fixed', true));
    harness.setPatchValue('編');
    connection.onEvent({
      ...event('input', '編', true),
      data: '編',
      inputType: 'insertCompositionText',
    });
    expect(harness.getPatchValue()).toBe('編');
    expect(control.snapshot()).toEqual({ value: 'fixed', composing: true });
    expect(harness.getUpdateCount()).toBe(beforeComposition);

    control.sync({ disabled: true });
    expect(harness.getPatchValue()).toBe('編');

    connection.onEvent(event('compositionend', '編'));
    expect(harness.getPatchValue()).toBe('編');
    await Promise.resolve();
    expect(harness.getPatchValue()).toBe('fixed');

    harness.setPatchValue('attempt');
    connection.onEvent(event('input', 'attempt'));
    await Promise.resolve();
    expect(harness.getPatchValue()).toBe('fixed');

    control.sync({ valueMode: 'controlled', value: 'accepted' });
    expect(control.snapshot()?.value).toBe('accepted');
    expect(harness.getPatchValue()).toBe('accepted');
  });

  it('disposes the active host lease when attached capabilities reset', () => {
    const harness = createHarness();
    const control = harness.module.facade.declare();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';
    control.sync({ valueMode: 'uncontrolled', defaultValue: 'initial' });

    expect(harness.getDisposed()).toBe(0);
    harness.vault.resetAttached();
    expect(harness.getDisposed()).toBe(1);
  });

  it('requires a declaration while tolerating a temporarily missing host', () => {
    const sys = createSystemCaps();
    const vault = new CapsVault();
    vault.attachBase([[SYS_CAP, sys]]);
    const withoutDeclaration = createTextControlModule({
      init: { prototypeName: 'x-missing-declaration', declarations: [] },
      caps: vault,
      deps: {
        requireFacade: () => {
          throw new Error('unused');
        },
        requirePort: () => {
          throw new Error('unused');
        },
        tryFacade: () => undefined,
        tryPort: () => undefined,
      },
    });
    expect(() => withoutDeclaration.facade.declare()).toThrow(/static text-control declaration/);

    const harness = createHarness(false);
    const control = harness.module.facade.declare();
    harness.module.hooks.onMountPhase?.('mounted', 1);
    harness.sys.phase = 'callback';
    expect(() =>
      control.sync({ valueMode: 'uncontrolled', defaultValue: 'retained' })
    ).not.toThrow();
    expect(control.snapshot()?.value).toBe('retained');
  });
});
