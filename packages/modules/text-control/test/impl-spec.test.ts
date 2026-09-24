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
import { createWebTextControlHost } from '../src/web';

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

describe.each(['single', 'multiline'] as const)('text-control %s composition lease', (lineMode) => {
  for (const valueMode of ['controlled', 'uncontrolled'] as const) {
    it.each(['detach', 'provider reset', 'provider replacement'] as const)(
      `projects the retained ${valueMode} value after %s interrupts composition`,
      (boundary) => {
        const h = createHarness(false, lineMode);
        const createTarget = () =>
          document.createElement(lineMode === 'single' ? 'input' : 'textarea');
        let target = createTarget();
        const host = createWebTextControlHost(() => target);
        h.vault.attach([[TEXT_CONTROL_HOST_CAP, host]]);
        const control = h.module.facade.declare();
        const seen: TextControlEvent[] = [];
        for (const type of ['input', 'change', 'compositionstart', 'compositionend'] as const) {
          control.on(type, (_run, next) => seen.push(next));
        }
        h.module.hooks.onMountPhase?.('mounted', 1);
        h.sys.phase = 'callback';
        control.sync({ valueMode, value: 'owner', defaultValue: 'initial' });
        target.dispatchEvent(new CompositionEvent('compositionstart'));
        target.value = 'draft\r\nvalue';
        target.dispatchEvent(new InputEvent('input', { isComposing: true }));
        control.sync({ value: 'latest\r\nowner' });
        const expected = valueMode === 'controlled' ? 'latest\nowner' : 'draft\nvalue';
        const value = lineMode === 'single' ? expected.replace('\n', '') : expected;
        expect(control.snapshot()).toEqual({ value, composing: true });
        const old = target;
        const beforeRevocation = seen.slice();

        if (boundary === 'detach') {
          h.module.hooks.onMountPhase?.('unmounting', 1);
          h.module.hooks.onMountPhase?.('detached', 1);
        } else if (boundary === 'provider reset') {
          h.vault.resetAttached();
        }
        target = createTarget();
        if (boundary === 'detach') {
          h.module.hooks.onMountPhase?.('mounted', 2);
        } else {
          h.vault.attach([
            [
              TEXT_CONTROL_HOST_CAP,
              boundary === 'provider reset' ? host : createWebTextControlHost(() => target),
            ],
          ]);
        }

        expect(control.snapshot()).toEqual({ value, composing: false });
        expect(target.value).toBe(value);
        expect(seen).toEqual(beforeRevocation);
        control.sync({ value: 'next owner', placeholder: 'new lease' });
        expect(target.value).toBe(valueMode === 'controlled' ? 'next owner' : value);
        expect(target.placeholder).toBe('new lease');

        target.dispatchEvent(new CompositionEvent('compositionstart'));
        target.value = 'new candidate';
        old.dispatchEvent(new CompositionEvent('compositionend'));
        old.dispatchEvent(new InputEvent('input'));
        expect(control.snapshot()?.composing).toBe(true);
        expect(target.value).toBe('new candidate');
        expect(seen).toHaveLength(beforeRevocation.length + 1);
        h.module.hooks.dispose?.();
        target.dispatchEvent(new CompositionEvent('compositionend'));
        target.dispatchEvent(new InputEvent('input'));
        expect(control.snapshot()).toBeNull();
        expect(target.value).toBe('new candidate');
        expect(seen).toHaveLength(beforeRevocation.length + 1);
      }
    );
  }
});

it('keeps old composition callbacks and queued restoration out of a new lease', async () => {
  const h = createHarness();
  const control = h.module.facade.declare();
  h.module.hooks.onMountPhase?.('mounted', 1);
  h.sys.phase = 'callback';
  control.sync({ valueMode: 'controlled', value: 'owner' });
  const old = h.connectionBox.current!;
  old.onEvent(event('compositionstart', 'owner', true));
  old.onEvent(event('compositionend', 'old candidate'));
  h.module.hooks.onMountPhase?.('detached', 1);
  h.module.hooks.onMountPhase?.('mounted', 2);
  h.connectionBox.current!.onEvent(event('compositionstart', 'owner', true));
  h.setPatchValue('new candidate');
  const updates = h.getUpdateCount();

  old.onEvent(event('compositionend', 'stale'));
  old.onEvent(event('input', 'stale'));
  await Promise.resolve();
  expect(control.snapshot()).toEqual({ value: 'owner', composing: true });
  expect(h.getPatchValue()).toBe('new candidate');
  expect(h.getUpdateCount()).toBe(updates);
});

it.each(['input', 'compositionend'] as const)(
  'does not schedule old %s restoration into a lease replaced by its listener',
  async (type) => {
    const h = createHarness();
    const control = h.module.facade.declare();
    control.on(type, () => {
      h.module.hooks.onMountPhase?.('detached', 1);
      h.module.hooks.onMountPhase?.('mounted', 2);
      h.connectionBox.current!.onEvent(event('compositionstart', 'owner', true));
      h.setPatchValue('new candidate');
    });
    h.module.hooks.onMountPhase?.('mounted', 1);
    h.sys.phase = 'callback';
    control.sync({ valueMode: 'controlled', value: 'owner' });
    const old = h.connectionBox.current!;
    old.onEvent(event('compositionstart', 'owner', true));
    old.onEvent(event(type, 'old candidate'));
    const updates = h.getUpdateCount();
    await Promise.resolve();
    expect(control.snapshot()).toEqual({ value: 'owner', composing: true });
    expect(h.getPatchValue()).toBe('new candidate');
    expect(h.getUpdateCount()).toBe(updates);
  }
);

it('T-TEXT-CONTROL-0001-CASE-LIFETIME: stale lease events cannot change current value or invoke listeners', () => {
  const h = createHarness();
  const control = h.module.facade.declare();
  const values: string[] = [];
  control.on('input', (_run, event) => values.push(event.value));
  h.module.hooks.onMountPhase?.('mounted', 1);
  h.sys.phase = 'callback';
  control.sync({ defaultValue: 'initial' });
  const old = h.connectionBox.current!;
  h.module.hooks.onMountPhase?.('detached', 1);
  h.module.hooks.onMountPhase?.('mounted', 2);
  old.onEvent(event('input', 'stale'));
  expect(control.snapshot()?.value).toBe('initial');
  expect(values).toEqual([]);
  h.connectionBox.current!.onEvent(event('input', 'current'));
  expect(values).toEqual(['current']);
  h.module.hooks.dispose?.();
  h.connectionBox.current!.onEvent(event('input', 'disposed'));
  expect(values).toEqual(['current']);
});

it('T-TEXT-CONTROL-0001-CASE-CANCEL: listener cancellation is setup-only', () => {
  const h = createHarness();
  const control = h.module.facade.declare();
  const off = control.on('input', () => {});
  off();
  off();
  h.sys.phase = 'callback';
  expect(off).toThrow('illegal phase');
});
