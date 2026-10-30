import { describe, expect, it } from 'vitest';
import type { StyleHandle } from '@proto.ui/core';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import toggle from '../src/toggle';

function mount(initial: Record<string, unknown>) {
  let props = initial;
  let tokens: string[] = [];
  let exposes: Record<string, any> = {};
  const root = new EventTarget();
  const global = new EventTarget();
  const host: RuntimeHost<any> = {
    prototypeName: toggle.name,
    getRawProps: () => props,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [EVENT_GLOBAL_TARGET_CAP, () => global],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, root],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
      wiring.attach('expose-state', [
        [
          EXPOSE_STATE_SET_EXPOSES_CAP,
          (next: Record<string, any>) => {
            exposes = next;
          },
        ],
      ]);
      wiring.attach('feedback', [
        [
          EFFECTS_CAP,
          {
            queueStyle(style: StyleHandle) {
              tokens = [...style.tokens];
            },
            requestFlush() {},
          },
        ],
      ]);
    },
  };
  const runtime = executeWithHost(toggle, host);
  return {
    ...runtime,
    root,
    tokens: () => tokens,
    exposes: () => exposes,
    update(next: Record<string, unknown>) {
      props = next;
      runtime.controller.applyRawProps(next);
    },
  };
}

describe('Bootstrap 2.3.2 Toggle disabled paint (simulated feedback host)', () => {
  // Fixed upstream: twbs/bootstrap b4c4072679943773a7582daa63f545ba818fa627,
  // less/buttons.less:54-59: disabled removes image/shadow, retains 65% opacity.
  // This sink observes actual merged feedback; it is not browser paint evidence.
  for (const active of [false, true])
    for (const interaction of ['rest', 'hover', 'press'] as const)
      it(`flattens active=${active}/${interaction}, suppresses transient paint and restores`, async () => {
        const view = mount({ active });
        try {
          if (interaction !== 'rest') {
            view.root.dispatchEvent(new CustomEvent('pointer.enter'));
            expect(view.exposes().hovered.get()).toBe(true);
          }
          if (interaction === 'press') {
            view.root.dispatchEvent(new CustomEvent('pointer.down'));
            expect(view.exposes().pressed.get()).toBe(true);
          }
          view.update({ active, disabled: true });
          const assertDisabled = () => {
            const css = renderProtoStyleTokenCss(view.tokens());
            expect(css).toContain('background-color: #e6e6e6;');
            expect(css).toContain('background-image: none;');
            expect(css).toContain('--pui-shadow: 0 0 #0000;');
            expect(css).not.toContain('background-image: linear-gradient');
            expect(css).not.toContain('--pui-shadow: inset');
            expect(view.exposes().active.get()).toBe(active);
            expect(view.exposes().disabled.get()).toBe(true);
            expect(view.exposes().hovered.get()).toBe(false);
            expect(view.exposes().pressed.get()).toBe(false);
          };
          assertDisabled();
          for (const event of ['pointer.enter', 'pointer.down', 'pointer.up', 'press.commit']) {
            view.root.dispatchEvent(new CustomEvent(event));
            assertDisabled();
          }
          view.update({ active });
          expect(view.tokens()).not.toContain('opacity-65');
          expect(view.tokens()).not.toContain('shadow-none');
          const css = renderProtoStyleTokenCss(view.tokens());
          expect(css).toContain(
            active ? 'background-image: none;' : 'background-image: linear-gradient'
          );
          expect(css).toContain('--pui-shadow: inset');
          expect(view.exposes().disabled.get()).toBe(false);
        } finally {
          await view.invokeUnmounted();
        }
      });
});
