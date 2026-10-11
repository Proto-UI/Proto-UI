import { describe, expect, it, vi } from 'vitest';
import { createHostSurfaceProjection } from '../src/host/surface-projection';
import { EFFECTS_CAP, VISUAL_FEEDBACK_SINK_CAP } from '@proto.ui/module-feedback';
import { createReactModules } from '../../react/src/runtime/modules';
import { createVueModules } from '../../vue/src/runtime/modules';
import { createVue2Modules } from '../../vue2/src/runtime/modules';
import { createWebComponentModules } from '../../web-component/src/runtime/modules';

// This tests real Adapter capability construction, not optical paint or native GPU output.
describe('typed material sink wiring on all Web Adapters', () => {
  for (const [name, create] of [
    ['react', createReactModules],
    ['vue', createVueModules],
    ['vue2', createVue2Modules],
    ['wc', createWebComponentModules],
  ] as const) {
    it(`${name} forwards the exact current visual provider without invoking it early`, () => {
      const el = document.createElement('div');
      const visualFeedbackSink = { commit: vi.fn(), release: vi.fn() };
      const effectsPort = { queueStyle: vi.fn(), requestFlush: vi.fn() };
      const args: any = {
        el,
        instanceToken: {},
        router: { rootTarget: el, globalTarget: window },
        surfaceProjection: createHostSurfaceProjection(el),
        rawPropsSource: { get: () => ({}), subscribe: () => () => {} },
        effectsPort,
        visualFeedbackSink,
        getMeta: () => undefined,
        emit() {},
        setExposes() {},
        runInCallbackScope: (fn: () => void) => fn(),
        isViewReady: () => true,
        isEntryAcquisitionReady: () => true,
        getCurrentElement: () => el,
        subscribeTargetReady: () => () => {},
        retryTargetReady() {},
        textControlTarget: null,
        imageViewTarget: null,
      };
      const modules = create(args);
      const caps = new Map(modules.feedback({ prototypeName: 'material-wire-test' }));
      expect(caps.get(VISUAL_FEEDBACK_SINK_CAP)).toBe(visualFeedbackSink);
      expect(caps.get(EFFECTS_CAP)).toBe(effectsPort);
      expect(visualFeedbackSink.commit).not.toHaveBeenCalled();
      expect(visualFeedbackSink.release).not.toHaveBeenCalled();
      const ordinary = new Map(
        create({ ...args, visualFeedbackSink: undefined }).feedback({
          prototypeName: 'ordinary-wire-test',
        })
      );
      expect(ordinary.has(VISUAL_FEEDBACK_SINK_CAP)).toBe(false);
      expect(ordinary.get(EFFECTS_CAP)).toBe(effectsPort);
    });
  }
});
