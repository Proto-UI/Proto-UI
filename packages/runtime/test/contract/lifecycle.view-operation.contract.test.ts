import { describe, expect, it, vi } from 'vitest';
import type { Prototype, RunHandle, ViewOperation } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost } from '../../src';

async function fixture(options: { supported?: boolean; admitted?: boolean } = {}) {
  let run!: RunHandle<any>;
  let generation = 0;
  let admitted = options.admitted ?? true;
  const provider = {
    capture: vi.fn(() => {
      if (!admitted) return null;
      const captured = generation;
      return { isCurrent: () => admitted && captured === generation };
    }),
  };
  const host: RuntimeHost<any> = {
    prototypeName: 'view-operation-contract',
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    ...(options.supported === false ? {} : { viewOperations: provider }),
  };
  const proto: Prototype = {
    name: host.prototypeName,
    setup(def) {
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      return (renderer) => renderer.el('div', 'source');
    },
  };
  const session = createRuntimeSession(proto, host);
  const capture = () => {
    let result: ViewOperation | null = null;
    session.invokeInCallbackScope(() => {
      result = run.lifecycle.captureViewOperation();
    });
    return result as ViewOperation | null;
  };
  return {
    session,
    host,
    provider,
    run,
    capture,
    withdraw() {
      generation += 1;
      admitted = false;
    },
    restore() {
      admitted = true;
    },
    present(value: boolean) {
      session.invokeInCallbackScope(() => run.lifecycle.setPresent(value));
    },
  };
}

describe('source-view operation validity (draft)', () => {
  it('distinguishes unsupported capability from supported but detached or unadmitted view', async () => {
    const absent = await fixture({ supported: false });
    await absent.session.mount();
    expect(absent.capture).toThrow(expect.objectContaining({ code: 'E_CAP_UNAVAILABLE' }));
    await absent.session.dispose();
    const present = await fixture();
    expect(present.capture()).toBeNull();
    expect(present.provider.capture).not.toHaveBeenCalled();
    await present.session.mount();
    expect(present.capture()?.isCurrent()).toBe(true);
    present.withdraw();
    expect(present.capture()).toBeNull();
    await present.session.dispose();
  });

  it('requires callback phase only for capture; checks do not reactivate the originating run', async () => {
    const f = await fixture();
    await f.session.mount();
    expect(() => f.run.lifecycle.captureViewOperation()).toThrow(
      expect.objectContaining({ code: 'E_ILLEGAL_PHASE' })
    );
    const operation = f.capture()!;
    expect(f.session.kernel.getPhase()).toBe('unknown');
    expect(operation.isCurrent()).toBe(true);
    expect(f.session.kernel.getPhase()).toBe('unknown');
    const other = await fixture();
    await other.session.mount();
    other.session.invokeInCallbackScope(() => expect(operation.isCurrent()).toBe(true));
    await f.session.dispose();
    expect(operation.isCurrent()).toBe(false);
    await other.session.dispose();
  });

  it('does not revive after source withdrawal and same-view reappearance', async () => {
    const f = await fixture();
    await f.session.mount();
    const operation = f.capture()!;
    f.withdraw();
    f.restore();
    expect(operation.isCurrent()).toBe(false);
    expect(f.capture()?.isCurrent()).toBe(true);
    await f.session.dispose();
  });

  it('does not revive after an accepted absent/present intent pair coalesces before host detach', async () => {
    const f = await fixture();
    await f.session.mount();
    const operation = f.capture()!;
    f.present(false);
    expect(f.capture()).toBeNull();
    f.present(true);
    expect(f.session.mountPhase).toBe('mounted');
    expect(operation.isCurrent()).toBe(false);
    expect(f.capture()?.isCurrent()).toBe(true);
    await f.session.dispose();
  });

  it('does not infer withdrawal from an unaccepted application request', async () => {
    const f = await fixture();
    await f.session.mount();
    const operation = f.capture()!;
    const requestAbsent = vi.fn();
    f.session.invokeInCallbackScope(() => requestAbsent(false));
    expect(requestAbsent).toHaveBeenCalledOnce();
    expect(f.session.viewIntent.getSnapshot()).toEqual({ present: true, version: 0 });
    expect(operation.isCurrent()).toBe(true);
    await f.session.dispose();
  });

  it('defensively rejects an observed illegal provider-property replacement without calling the old provider', async () => {
    const f = await fixture();
    await f.session.mount();
    const check = vi.fn(() => true);
    f.provider.capture.mockReturnValue({ isCurrent: check });
    const operation = f.capture()!;
    Object.assign(f.host, { viewOperations: { capture: () => null } });
    expect(operation.isCurrent()).toBe(false);
    expect(check).not.toHaveBeenCalled();
    Object.assign(f.host, { viewOperations: f.provider });
    expect(operation.isCurrent()).toBe(false);
    expect(check).not.toHaveBeenCalled();
    await f.session.dispose();
  });

  it('invalidates across repeatable epochs without requiring terminal disposal', async () => {
    const f = await fixture();
    await f.session.mount();
    const operation = f.capture()!;
    await f.session.unmount();
    await f.session.mount();
    expect(f.session.instancePhase).toBe('alive');
    expect(operation.isCurrent()).toBe(false);
    expect(f.capture()?.isCurrent()).toBe(true);
    await f.session.dispose();
  });

  it('preserves unexpected capture failures rather than hiding a broken producer', async () => {
    const f = await fixture();
    await f.session.mount();
    const failure = new Error('producer failure');
    f.provider.capture.mockImplementation(() => {
      throw failure;
    });
    expect(f.capture).toThrow(failure);
    await f.session.dispose();
  });
  it('preserves an unexpected live producer check failure but does not call it after disposal', async () => {
    const f = await fixture();
    await f.session.mount();
    const failure = new Error('producer check bug');
    const check = vi.fn(() => {
      throw failure;
    });
    f.provider.capture.mockReturnValue({ isCurrent: check });
    const operation = f.capture()!;
    expect(() => operation.isCurrent()).toThrow(failure);
    await f.session.dispose();
    expect(operation.isCurrent()).toBe(false);
    expect(check).toHaveBeenCalledOnce();
  });
});
