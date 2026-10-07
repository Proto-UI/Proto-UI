import { describe, expect, it, vi } from 'vitest';
import type { StyleHandle } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  EFFECTS_CAP,
  VISUAL_FEEDBACK_SINK_CAP,
  type VisualFeedbackFrame,
} from '@proto.ui/module-feedback';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import button from '../src/button';
async function fixture(props: Record<string, unknown> = {}, visual = true) {
  const frames: VisualFeedbackFrame[] = [],
    styles: StyleHandle[] = [],
    root = new EventTarget(),
    release = vi.fn();
  const session = createRuntimeSession(button, {
    prototypeName: button.name,
    getRawProps: () => props,
    schedule: (fn) => fn(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [EVENT_GLOBAL_TARGET_CAP, () => new EventTarget()],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, root],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
      wiring.attach('feedback', [
        [
          EFFECTS_CAP,
          { queueStyle: (style: StyleHandle) => styles.push(style), requestFlush() {} },
        ],
      ]);
      if (visual)
        wiring.attach('feedback', [
          [
            VISUAL_FEEDBACK_SINK_CAP,
            { commit: (frame: VisualFeedbackFrame) => frames.push(frame), release },
          ],
        ]);
    },
  });
  await session.mount();
  return {
    frames,
    styles,
    root,
    session,
    release,
    setProps(next: Record<string, unknown>) {
      props = next;
      session.controller.applyRawProps(next);
    },
  };
}
describe('Liquid Glass Button V2 portable intent, not an optical paint claim', () => {
  it('submits one Base-driven optical candidate and complete opaque fallback style', async () => {
    const f = await fixture();
    expect(f.frames.at(-1)?.material.slot?.source).toEqual({ kind: 'in-app-backdrop' });
    expect(f.frames.at(-1)?.style.tokens).toContain('bg-secondary');
    expect(f.frames.at(-1)?.material.candidates).toEqual([
      { intent: 'liquid-glass', variant: 'regular', deformation: { kind: 'press', phase: 'rest' } },
    ]);
    f.root.dispatchEvent(new Event('pointer.down'));
    expect(f.frames.at(-1)?.material.candidates).toEqual([
      {
        intent: 'liquid-glass',
        variant: 'regular',
        deformation: { kind: 'press', phase: 'pressed' },
      },
    ]);
    f.root.dispatchEvent(new Event('pointer.up'));
    expect(f.frames.at(-1)?.material.candidates[0]).toMatchObject({
      deformation: { phase: 'rest' },
    });
    expect(
      f.frames
        .flatMap((frame) => frame.style.tokens)
        .some((token) => token.startsWith('backdrop-') || token === 'bg-secondary/80')
    ).toBe(false);
    await f.session.dispose();
    expect(f.release).toHaveBeenCalled();
  });
  it.each([{ material: 'opaque' }, { variant: 'prominent' }])(
    'keeps deliberate safe presentation for %j',
    async (props) => {
      const f = await fixture(props);
      expect(f.frames.at(-1)?.material.candidates).toEqual([]);
      expect(f.frames.at(-1)?.style.tokens).toContain(
        'variant' in props ? 'bg-primary' : 'bg-secondary'
      );
      await f.session.dispose();
    }
  );
  it('an ordinary Adapter without a provider retains source-owned opaque style', async () => {
    const f = await fixture({}, false);
    expect(f.styles.at(-1)?.tokens).toContain('bg-secondary');
    expect(f.styles.at(-1)?.tokens).toContain('text-secondary-foreground');
    await f.session.dispose();
  });
  it('disabled Base state resets press and remount obtains a fresh visual lease', async () => {
    const f = await fixture();
    f.root.dispatchEvent(new Event('pointer.down'));
    f.setProps({ disabled: true });
    expect(f.frames.at(-1)?.material.candidates[0]).toMatchObject({
      deformation: { phase: 'rest' },
    });
    await f.session.unmount();
    expect(f.release).toHaveBeenCalledOnce();
    await f.session.mount();
    expect(f.frames.at(-1)?.material.candidates).toHaveLength(1);
    await f.session.dispose();
  });
});
