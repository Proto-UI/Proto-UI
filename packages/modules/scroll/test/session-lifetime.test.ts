import { expect, it, vi } from 'vitest';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { StateModuleImpl } from '../../state/src/impl';
import { createSysCaps } from '../../context/test/utils/fake-caps';
import { ScrollModuleImpl } from '../src/impl';
import { SCROLL_SURFACE_HOST_CAP, type ScrollSurfaceHostAttachment } from '../src/caps';

it('T-SCROLL-0001-CASE-LIFETIME: replacement, detach and terminal disposal reject late facts', () => {
  const sys = createSysCaps();
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, sys]]);
  const state = new StateModuleImpl(sys);
  const module = new ScrollModuleImpl(
    caps,
    'scroll-session',
    state.port,
    state.facade,
    {} as any,
    {} as any
  );
  const surface = module.getSurface();
  const connections: ScrollSurfaceHostAttachment[] = [];
  const dispose = vi.fn();
  const install = () =>
    caps.attach([
      [
        SCROLL_SURFACE_HOST_CAP,
        {
          support: { system: true, composed: true },
          attach(c: ScrollSurfaceHostAttachment) {
            connections.push(c);
            return { update() {}, request() {}, dispose };
          },
        },
      ],
    ]);
  const facts = (position: number) => ({
    axes: 'vertical' as const,
    horizontal: { position: 0, visibleRatio: 1, canScrollBefore: false, canScrollAfter: false },
    vertical: { position, visibleRatio: 0.2, canScrollBefore: true, canScrollAfter: true },
    scrolling: true,
    projection: 'system' as const,
  });
  sys.__setExecPhase('callback');
  install();
  module.onMountPhase('mounted', 1);
  connections[0].onFacts(facts(0.3));
  expect(surface.vertical.position.get()).toBe(0.3);
  install();
  expect(dispose).toHaveBeenCalledTimes(1);
  connections[0].onFacts(facts(0.9));
  expect(surface.vertical.position.get()).toBe(0.3);
  connections[1].onFacts(facts(0.4));
  expect(surface.vertical.position.get()).toBe(0.4);
  module.onMountPhase('detached', 1);
  connections[1].onFacts(facts(0.8));
  expect(surface.vertical.position.get()).toBe(0.4);
  expect(surface.projection.get()).toBe('unresolved');
  module.onMountPhase('mounted', 2);
  expect(module.getSurface()).toBe(surface);
  module.onProtoPhase('unmounted');
  connections.at(-1)!.onFacts(facts(0.7));
  expect(surface.vertical.position.get()).toBe(0.4);
  expect(surface.projection.get()).toBe('unresolved');
  state.dispose();
});
