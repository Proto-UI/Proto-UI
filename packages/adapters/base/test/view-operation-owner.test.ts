import { describe, expect, it, vi } from 'vitest';
import { createViewEpochOwner } from '../src';

function fixture() {
  const owner = createViewEpochOwner<any>({ prototypeName: 'operation-owner' });
  const session = {
    viewIntent: { getSnapshot: () => ({ present: true, version: 0 }), subscribe: () => () => {} },
    mount: vi.fn(),
    unmount: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
  } as any;
  const attach = (disposeView = vi.fn()) =>
    owner.attachView({
      modules: {},
      disposeView,
      isViewAdmitted: () => true,
      createSession: () => session,
    });
  return { owner, session, attach };
}

describe('view owner source-operation generations', () => {
  it('separates synchronous withdrawal from deferred lifecycle retirement', async () => {
    const f = fixture();
    expect(f.owner.captureViewOperation()).toBeNull();
    f.attach();
    const old = f.owner.captureViewOperation()!;
    f.owner.withdrawViewOperations();
    expect(old.isCurrent()).toBe(false);
    expect(f.owner.hasView).toBe(true);
    expect(f.session.unmount).not.toHaveBeenCalled();
    expect(f.session.dispose).not.toHaveBeenCalled();
    expect(f.owner.captureViewOperation()?.isCurrent()).toBe(true);
    await f.owner.dispose();
  });
  it('invalidates replaced views and terminal owners even when the disposer is reused', async () => {
    const f = fixture();
    const disposer = vi.fn();
    f.attach(disposer);
    const first = f.owner.captureViewOperation()!;
    f.attach(disposer);
    expect(first.isCurrent()).toBe(false);
    const second = f.owner.captureViewOperation()!;
    await f.owner.dispose();
    expect(second.isCurrent()).toBe(false);
    expect(disposer).toHaveBeenCalledTimes(2);
  });
  it('does not treat an attached but unadmitted view as a usable source', async () => {
    const f = fixture();
    f.owner.attachView({ modules: {}, disposeView: vi.fn(), createSession: () => f.session });
    expect(f.owner.captureViewOperation()).toBeNull();
    await f.owner.dispose();
  });
  it('does not revive after supported A-to-B-to-A view rebinding without intermediate queries', async () => {
    const f = fixture();
    const admittedA = () => true;
    const admittedB = () => true;
    const rebind = (isViewAdmitted: () => boolean) =>
      f.owner.attachView({
        modules: {},
        disposeView: vi.fn(),
        isViewAdmitted,
        createSession: () => f.session,
      });
    rebind(admittedA);
    const first = f.owner.captureViewOperation()!;
    rebind(admittedB);
    rebind(admittedA);
    expect(first.isCurrent()).toBe(false);
    expect(f.owner.captureViewOperation()?.isCurrent()).toBe(true);
    await f.owner.dispose();
  });
});
