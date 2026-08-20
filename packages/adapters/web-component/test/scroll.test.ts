import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype, type ScrollSurfaceHandle } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { AdaptToWebComponent } from '../src';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

afterEach(() => document.body.replaceChildren());

describe('adapter-web-component: privileged scroll surface', () => {
  it('installs once, resolves adapter projection, and updates facts after host requests', async () => {
    let first: ScrollSurfaceHandle | undefined;
    let second: ScrollSurfaceHandle | undefined;
    const proto = definePrototype<any, any>({
      name: 'x-scroll-module-contract-20260729',
      setup(def) {
        first = asScrollSurface();
        second = asScrollSurface();
        first.configure({ axes: 'vertical', projection: 'auto' });
        def.expose.state('position', first.vertical.position);
        def.expose.state('visibleRatio', first.vertical.visibleRatio);
        def.expose.state('projection', first.projection);
        def.expose.method('scrollTo', (position: number) =>
          first?.request({ kind: 'to', axis: 'vertical', position })
        );
        return (renderer) => renderer.slot();
      },
    });

    const name = proto.name;
    const Ctor = AdaptToWebComponent(proto, {
      register: false,
      registerAs: name,
      scrollProjection: 'composed',
    });
    if (!customElements.get(name)) customElements.define(name, Ctor);
    const element = document.createElement(name) as InstanceType<typeof Ctor>;
    Object.defineProperties(element, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 100 },
      scrollTop: { configurable: true, value: 0, writable: true },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });
    document.body.append(element);
    await flush();

    expect(first).toBe(second);
    expect(element.dataset.puiScrollProjection).toBe('composed');
    const exposes = element.getExposes() as any;
    expect(exposes.projection.get()).toBe('composed');
    expect(exposes.visibleRatio.get()).toBe(0.2);

    exposes.scrollTo(0.5);
    expect(element.scrollTop).toBe(400);
    expect(exposes.position.get()).toBe(0.5);

    element.remove();
    await flush();
    expect(element.hasAttribute('data-pui-scroll-projection')).toBe(false);
  });
});
