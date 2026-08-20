// packages/modules/expose/test/impl-spec.test.ts
import { describe, it, expect } from 'vitest';
import { ExposeModuleImpl } from '../src/impl';
import { createExposeEventDeclaration, isExposeEventDeclaration } from '../src/types';
import { makeCaps, createSysCaps } from './utils/fake-caps';

describe('ExposeModuleImpl (contract-ish)', () => {
  it('brands runtime-created outward signal declarations without matching author values', () => {
    const declaration = createExposeEventDeclaration({ payload: 'json' });

    expect(isExposeEventDeclaration(declaration)).toBe(true);
    expect(isExposeEventDeclaration({ __pui_expose: 'event', spec: { payload: 'json' } })).toBe(
      false
    );
    expect(declaration).toMatchObject({
      __pui_expose: 'event',
      spec: { payload: 'json' },
    });
  });

  it('setup-only: def.expose throws after setup', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });
    const impl = new ExposeModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    expect(() => impl.expose('a', 1)).not.toThrow();

    sys.__setExecPhase('callback');
    expect(() => impl.expose('b', 2)).toThrow();
  });

  it('rejects invalid or duplicate keys', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });
    const impl = new ExposeModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    expect(() => impl.expose('', 1)).toThrow();
    expect(() => impl.expose(Symbol('x') as any as string, 1)).toThrow();

    impl.expose('x', 1);
    expect(() => impl.expose('x', 2)).toThrow();
  });

  it('getAll returns record with exposed values', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });
    const impl = new ExposeModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.expose('a', 1);
    impl.expose('b', { x: true });

    const all = impl.port.getAll();
    expect(all).toEqual({ a: 1, b: { x: true } });
  });

  it('preserves special property names as own snapshot entries', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });
    const impl = new ExposeModuleImpl(caps, 'p-x');
    const value = { safe: true };

    sys.__setExecPhase('setup');
    impl.expose('__proto__', value);

    const all = impl.port.getAll();
    expect(Object.getPrototypeOf(all)).toBe(Object.prototype);
    expect(Object.hasOwn(all, '__proto__')).toBe(true);
    expect(all.__proto__).toBe(value);
  });

  it('port helpers: get/has/keys work', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });
    const impl = new ExposeModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.expose('a', 1);
    impl.expose('b', 'x');

    expect(impl.port.get('a')).toBe(1);
    expect(impl.port.has('a')).toBe(true);
    expect(impl.port.has('c')).toBe(false);
    expect([...impl.port.keys()].sort()).toEqual(['a', 'b']);
  });

  it('getDiagnostics returns basic shape', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });
    const impl = new ExposeModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.expose('fn', () => 'ok');
    impl.expose('obj', { a: 1 });

    const diags = impl.port.getDiagnostics?.() ?? [];
    const map = new Map(diags.map((d) => [d.key, d]));

    expect(map.get('fn')?.isFunction).toBe(true);
    expect(map.get('fn')?.valueType).toBe('function');
    expect(map.get('obj')?.isObject).toBe(true);
    expect(map.get('obj')?.valueType).toBe('object');
  });

  it('dispose makes port unusable', () => {
    const sys = createSysCaps();
    const caps = makeCaps({ sys });
    const impl = new ExposeModuleImpl(caps, 'p-x');

    sys.__setExecPhase('setup');
    impl.expose('a', 1);

    impl.dispose();
    expect(() => impl.port.getAll()).toThrow();
  });
});
