import { describe, expect, it } from 'vitest';
import { createAnatomyFamily, createContextKey, type AnatomyPartView } from '@proto.ui/core';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { createContextModule, type ContextPort } from '@proto.ui/module-context';
import { StateModuleImpl } from '../../state/src/impl';
import { createSysCaps, makeCaps } from '../../context/test/utils/fake-caps';
import { ScrollModuleImpl } from '../src/impl';
import {
  SCROLL_SURFACE_HOST_CAP,
  type ScrollSurfaceHost,
  type ScrollSurfaceHostAttachment,
} from '../src/caps';

// HC-CONTEXT-IDENTITY-0001-B; C-CONTEXT-0004-E. Anatomy supplies opaque
// domain/target facts; real Context, State and Scroll produce the host binding.
describe('composed Scroll Context scope identity', () => {
  it.each([0, false, '', undefined, NaN, {}])(
    'binds opaque scope %s and rejects absent or mismatched domains',
    (token) => {
      const key = createContextKey<{ value: number }>('scroll-scope');
      const owner = {},
        foreign = {};
      const getParent = (instance: unknown) => (instance === foreign ? token : null);
      const sys = createSysCaps();
      const deps = {
        requireFacade() {
          throw new Error('unexpected');
        },
        requirePort() {
          throw new Error('unexpected');
        },
        tryFacade: () => undefined,
        tryPort: () => undefined,
      };
      const makeContext = (instanceToken: unknown) =>
        createContextModule({
          init: { prototypeName: 'scroll-scope', declarations: [] },
          caps: makeCaps({ instanceToken, getParent }),
          deps,
        });
      const provider = makeContext(token),
        context = makeContext(owner);
      provider.facade.provide(key, { value: 1 });
      // A distinct port-owner scope makes undefined-to-owner fallback observable.
      context.facade.provide(key, { value: 2 });
      const state = new StateModuleImpl(sys);
      const trackTarget = {},
        thumbTarget = {};
      const scrollbar = {
        getExpose: () => ({ get: () => 'vertical' }),
      } as unknown as AnatomyPartView;
      const thumb = {} as AnatomyPartView;
      let domain: unknown = token;
      let refresh = () => {};
      const anatomy = {
        resolveDomainScope: () => domain,
        order: { partsOf: () => [scrollbar] },
        descendantsOf: () => [thumb],
        resolvePartTarget: (part: AnatomyPartView) =>
          part === scrollbar ? trackTarget : thumbTarget,
        subscribeOrder: (_family: unknown, callback: () => void) => {
          refresh = callback;
          return () => {};
        },
        subscribeTargets: () => () => {},
      } as unknown as AnatomyPort;
      const attachments: ScrollSurfaceHostAttachment[] = [];
      const host: ScrollSurfaceHost = {
        support: { system: true, composed: true },
        attach(connection) {
          attachments.push(connection);
          return {
            update(next) {
              attachments.push(next);
            },
            request() {},
            dispose() {},
          };
        },
      };
      const base = makeCaps({ sys, instanceToken: owner, getParent });
      const caps = {
        ...base,
        has: (cap: { id: string }) => cap.id === SCROLL_SURFACE_HOST_CAP.id || base.has(cap),
        get: (cap: { id: string }) =>
          cap.id === SCROLL_SURFACE_HOST_CAP.id ? host : base.get(cap),
      };
      const scroll = new ScrollModuleImpl(
        caps,
        'scroll-scope',
        state.port,
        state.facade,
        anatomy,
        (context as typeof context & { port: ContextPort }).port
      );
      const family = createAnatomyFamily('scroll-scope', {
        roles: { root: { cardinality: { min: 1, max: 1 } } },
      });
      try {
        scroll.getSurface();
        scroll.configure({ projection: 'composed' });
        scroll.bindComposedChrome({
          scope: key,
          anatomy: family,
          scrollbarRole: 'scrollbar',
          thumbRole: 'thumb',
          orientationExpose: 'orientation',
        });
        sys.__setExecPhase('callback');
        scroll.onMountPhase('mounted', 1);
        const chrome = attachments.at(-1)?.composedChrome;
        expect(chrome).toBeDefined();
        expect(chrome!.scope).toBe(token);
        expect(chrome!.controls).toHaveLength(1);
        expect(chrome!.controls[0].trackTarget).toBe(trackTarget);
        expect(chrome!.controls[0].thumbTarget).toBe(thumbTarget);
        expect(chrome!.controls[0].getAxis()).toBe('vertical');
        domain = null;
        refresh();
        expect(attachments.at(-1)?.composedChrome).toBeUndefined();
        domain = foreign;
        refresh();
        expect(attachments.at(-1)?.composedChrome).toBeUndefined();
        domain = token;
        refresh();
        expect(attachments.at(-1)?.composedChrome?.scope).toBe(token);
      } finally {
        scroll.onProtoPhase('unmounted');
        state.dispose();
        context.hooks.dispose?.();
        provider.hooks.dispose?.();
      }
    }
  );
});
