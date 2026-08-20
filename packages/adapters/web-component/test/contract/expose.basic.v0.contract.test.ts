import { describe, it, expect } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';

describe('expose contract (adapter-web-component)', () => {
  it('getExposes returns a record snapshot', () => {
    const P: Prototype = {
      name: 'x-expose-basic',
      setup(def) {
        def.expose('api', { ping: () => 'pong' });
        def.expose('num', 1);
        return (r) => [r.el('div', 'ok')];
      },
    };

    AdaptToWebComponent(P);

    const el = document.createElement('x-expose-basic') as any;
    document.body.appendChild(el);

    const snapshot = el.getExposes();
    expect(snapshot).toEqual({
      api: { ping: expect.any(Function) },
      num: 1,
    });

    // snapshot should be detached from internal storage
    snapshot.extra = 123;
    const again = el.getExposes();
    expect(again.extra).toBeUndefined();
  });

  it('getExposes includes classified value and method entries', () => {
    const P: Prototype = {
      name: 'x-expose-classified',
      setup(def) {
        def.expose.value('version', '1.0.0');
        def.expose.method('ping', () => 'pong');
        return (r) => [r.el('div', 'ok')];
      },
    };

    AdaptToWebComponent(P);

    const el = document.createElement('x-expose-classified') as any;
    document.body.appendChild(el);

    const snapshot = el.getExposes();
    expect(snapshot.version).toBe('1.0.0');
    expect(snapshot.ping()).toBe('pong');
  });

  it('dispose clears exposes snapshot', () => {
    const P: Prototype = {
      name: 'x-expose-dispose',
      setup(def) {
        def.expose('api', { version: 1 });
        return (r) => [r.el('div', 'ok')];
      },
    };

    AdaptToWebComponent(P);

    const el = document.createElement('x-expose-dispose') as any;
    document.body.appendChild(el);

    expect(el.getExposes()).toEqual({ api: { version: 1 } });

    document.body.removeChild(el);

    expect(el.getExposes()).toEqual({});
  });

  it('invalidates an App Maker-held expose method after terminal disposal', async () => {
    let calls = 0;
    const P: Prototype = {
      name: 'x-expose-terminal-invalidation',
      setup(def) {
        def.expose.method('ping', () => ++calls);
        return (r) => [r.el('div', 'ok')];
      },
    };

    AdaptToWebComponent(P);

    const el = document.createElement('x-expose-terminal-invalidation') as any;
    document.body.appendChild(el);
    const ping = el.getExposes().ping as () => number;

    expect(ping()).toBe(1);
    document.body.removeChild(el);
    await Promise.resolve();

    expect(() => ping()).toThrow(/terminal disposal/);
    expect(calls).toBe(1);
  });

  it('exposed state is projected to external handle with spec and subscribe', async () => {
    const events: any[] = [];

    const P: Prototype = {
      name: 'x-expose-state-basic',
      setup(def) {
        const s = def.state.bool('ready', false);
        def.expose('ready', s);
        def.expose.method('activate', () => s.set(true));
        return (r) => [r.el('div', 'ok')];
      },
    };

    AdaptToWebComponent(P);

    const el = document.createElement('x-expose-state-basic') as any;
    document.body.appendChild(el);

    const exposes = el.getExposes();
    const ready = exposes.ready;
    expect(ready).toBeTruthy();
    expect(typeof ready.get).toBe('function');
    expect(typeof ready.subscribe).toBe('function');
    expect(typeof ready.unsubscribe).toBe('function');
    expect(ready.spec).toBeTruthy();
    expect(ready.spec.kind).toBe('bool');
    expect((ready as any).set).toBeUndefined();

    const off = ready.subscribe((e: any) => events.push(e));
    exposes.activate();

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('next');
    expect(events[0].next).toBe(true);
    expect(ready.get()).toBe(true);
    expect(el.getExposes().ready).toBe(ready);

    off();
  });
});
