import { afterEach, describe, expect, it, vi } from 'vitest';
import { planMaterialStages, withMaterialStages } from './demo-material-stages';
import type { DemoNode, DemoSetupContext, DemoSpec } from './demo-types';

const stage = (ref: string): DemoNode => ({
  kind: 'box',
  ref,
  materialStage: { mountRef: `${ref}Flow`, overlayRef: `${ref}Overlay` },
  children: [
    { kind: 'box', ref: `${ref}Flow`, children: ['Content'] },
    { kind: 'box', ref: `${ref}Overlay` },
  ],
});
function demo(): DemoSpec {
  return { type: 'demo', root: { kind: 'box', children: [stage('one'), stage('two')] } };
}
function context(spec: DemoSpec): DemoSetupContext {
  const host = document.createElement('div');
  document.body.append(host);
  const refs: Record<string, HTMLElement> = {};
  function append(node: DemoNode, parent: HTMLElement) {
    if (node.kind === 'text') return;
    const el = document.createElement('div');
    parent.append(el);
    if (node.ref) refs[node.ref] = el;
    for (const child of node.children ?? []) if (typeof child !== 'string') append(child, el);
  }
  append(spec.root, host);
  return { host, refs, api: { call: vi.fn(), getExposes: vi.fn(), setProps: vi.fn() } };
}
afterEach(() => document.body.replaceChildren());
describe('single-tree static material stage admission and lifetime', () => {
  it('finds declarations under a cloned wrapper without a top-level flag', () => {
    const spec = demo();
    const wrapped: DemoNode = { kind: 'box', children: [{ ...spec.root }] };
    expect(planMaterialStages(wrapped)).toHaveLength(2);
    const missing: DemoNode = { kind: 'box', children: [] };
    expect(planMaterialStages(missing)).toHaveLength(0);
  });
  it('rejects duplicate refs, nested stages, invalid targets and dynamic mode before DOM effects', () => {
    for (const root of [
      { kind: 'box', children: [stage('same'), stage('same')] },
      { ...stage('one'), children: [stage('nested')] },
      { kind: 'box', ref: 'bad', materialStage: { mountRef: 'missing', overlayRef: 'missing' } },
      { kind: 'box', dynamicChildren: [], children: [stage('one')] },
    ] as DemoNode[]) {
      expect(() => planMaterialStages(root)).toThrow();
      expect(document.body.childNodes).toHaveLength(0);
    }
  });
  it('keeps one original setup and identical public API/refs, and disposes every attachment once', () => {
    const spec = demo(),
      ctx = context(spec),
      disposed = [vi.fn(), vi.fn()];
    spec.setup = vi.fn((received) => {
      expect(received).toBe(ctx);
      return vi.fn();
    });
    let next = 0;
    const attach = vi.fn(() => ({ dispose: disposed[next++] }));
    const cleanup = withMaterialStages(spec, planMaterialStages(spec.root), attach, () => true)
      .setup!(ctx);
    expect(attach).toHaveBeenCalledTimes(2);
    expect(spec.setup).toHaveBeenCalledTimes(1);
    if (typeof cleanup !== 'function') throw Error('Missing cleanup');
    cleanup();
    cleanup();
    for (const dispose of disposed) expect(dispose).toHaveBeenCalledTimes(1);
    expect(ctx.host.contains(ctx.refs.oneFlow)).toBe(true);
  });
  it('validates every actual DOM ref before the first attachment', () => {
    const spec = demo(),
      ctx = context(spec),
      attach = vi.fn();
    ctx.refs.twoOverlay = ctx.refs.oneOverlay;
    expect(() =>
      withMaterialStages(spec, planMaterialStages(spec.root), attach, () => true).setup!(ctx)
    ).toThrow();
    expect(attach).not.toHaveBeenCalled();
  });
  it('preserves a falsy primary and cleanup error after partial attachment failure', () => {
    const spec = demo(),
      ctx = context(spec),
      secondary = new Error('cleanup');
    let count = 0;
    const dispose = vi.fn(() => {
      throw secondary;
    });
    const attach = () => {
      if (count++) throw undefined;
      return { dispose };
    };
    let caught: unknown;
    try {
      withMaterialStages(spec, planMaterialStages(spec.root), attach, () => true).setup!(ctx);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors).toEqual([undefined, secondary]);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('retires every stage when setup throws, without replacing its original exception', () => {
    const spec = demo(),
      ctx = context(spec),
      dispose = vi.fn();
    spec.setup = () => {
      throw null;
    };
    let caught: unknown = 'not thrown';
    try {
      withMaterialStages(
        spec,
        planMaterialStages(spec.root),
        () => ({ dispose }),
        () => true
      ).setup!(ctx);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(2);
  });
  it('never delivers original setup after a reentrant attachment invalidates the generation', () => {
    const spec = demo(),
      ctx = context(spec),
      dispose = vi.fn();
    let current = true;
    spec.setup = vi.fn();
    withMaterialStages(
      spec,
      planMaterialStages(spec.root),
      () => {
        current = false;
        return { dispose };
      },
      () => current
    ).setup!(ctx);
    expect(spec.setup).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('cleans user setup once when that setup reclaims its own host', () => {
    const spec = demo(),
      ctx = context(spec),
      dispose = vi.fn(),
      userCleanup = vi.fn();
    let current = true;
    spec.setup = () => {
      current = false;
      return userCleanup;
    };
    withMaterialStages(
      spec,
      planMaterialStages(spec.root),
      () => ({ dispose }),
      () => current
    ).setup!(ctx);
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(userCleanup).toHaveBeenCalledTimes(1);
  });
});
