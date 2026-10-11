import { expect, it, vi } from 'vitest';
import { tw } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createFeedbackModule } from '../src/create';
import { EFFECTS_CAP } from '../src/caps';
import { FINAL_STYLE_SINK_CAP, type FinalStyleFrame } from '../src/material/final-style-sink';
import { VISUAL_FEEDBACK_SINK_CAP, type VisualFeedbackFrame } from '../src/material/shared-sink';
import type { FeedbackInternalHooks } from '../src/types';

function fixture() {
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, undefined]]);
  const module = createFeedbackModule({
    init: { prototypeName: 'sink-kind-control', declarations: [] },
    caps,
    deps: {
      requireFacade() {
        throw Error('unused');
      },
      requirePort() {
        throw Error('unused');
      },
      tryFacade: () => undefined,
      tryPort: () => undefined,
    },
  });
  const hooks = module.hooks as FeedbackInternalHooks;
  const log: string[] = [];
  const sink = {
    commit: vi.fn((frame: FinalStyleFrame | VisualFeedbackFrame) => {
      log.push(frame.material === null ? 'final' : 'visual');
    }),
    release: vi.fn((view: number) => {
      log.push(`release:${view}`);
    }),
  };
  const mount = () => {
    module.facade.style.use(tw('rounded-lg'));
    hooks.onMountPhase?.('mounting', 1);
    hooks.onProtoPhase?.('mounted');
    hooks.onMountPhase?.('mounted', 1);
    log.length = 0;
    sink.commit.mockClear();
    sink.release.mockClear();
  };
  return { caps, hooks, sink, log, mount };
}

it('retires final-style output before the same object gains the visual capability', () => {
  const f = fixture();
  f.caps.attachBase([[FINAL_STYLE_SINK_CAP, f.sink]]);
  f.mount();
  f.caps.attach([[VISUAL_FEEDBACK_SINK_CAP, f.sink]]);
  expect(f.log).toEqual(['release:1', 'visual']);
});

it('retires visual output before the same object falls back to final-style capability', () => {
  const f = fixture();
  f.caps.attachBase([[FINAL_STYLE_SINK_CAP, f.sink]]);
  f.caps.attach([[VISUAL_FEEDBACK_SINK_CAP, f.sink]]);
  f.mount();
  f.caps.resetAttached();
  expect(f.log).toEqual(['release:1', 'final']);
});

it('does not retire an unchanged selected kind on an unrelated capability update', () => {
  const f = fixture();
  f.caps.attachBase([[FINAL_STYLE_SINK_CAP, f.sink]]);
  f.mount();
  f.caps.attach([[EFFECTS_CAP, { queueStyle() {}, requestFlush() {} }]]);
  expect(f.sink.release).not.toHaveBeenCalled();
  expect(f.log.at(-1)).toBe('final');
});

it('does not retire the selected visual kind when an unselected final-style object changes', () => {
  const f = fixture();
  f.caps.attachBase([[FINAL_STYLE_SINK_CAP, f.sink]]);
  f.caps.attach([[VISUAL_FEEDBACK_SINK_CAP, f.sink]]);
  f.mount();
  f.caps.attachBase([[FINAL_STYLE_SINK_CAP, { commit: vi.fn(), release: vi.fn() }]]);
  expect(f.sink.release).not.toHaveBeenCalled();
  expect(f.log.at(-1)).toBe('visual');
});

it('retains replay after a kind-transition release throws and never releases that owner twice', () => {
  const f = fixture();
  f.caps.attachBase([[FINAL_STYLE_SINK_CAP, f.sink]]);
  f.caps.attach([[VISUAL_FEEDBACK_SINK_CAP, f.sink]]);
  f.mount();
  f.sink.release.mockImplementationOnce(() => {
    throw Error('retire-kind');
  });
  expect(() => f.caps.resetAttached()).toThrow('retire-kind');
  f.hooks.flushIfPossible();
  expect(f.sink.release).toHaveBeenCalledTimes(1);
  expect(f.log.at(-1)).toBe('final');
});

it('a newer reentrant capability owner wins during kind retirement', () => {
  const f = fixture();
  f.caps.attachBase([[FINAL_STYLE_SINK_CAP, f.sink]]);
  f.caps.attach([[VISUAL_FEEDBACK_SINK_CAP, f.sink]]);
  f.mount();
  const next = { commit: vi.fn(), release: vi.fn() };
  f.sink.release.mockImplementationOnce(() => f.caps.attach([[VISUAL_FEEDBACK_SINK_CAP, next]]));
  f.caps.resetAttached();
  expect(f.sink.release).toHaveBeenCalledTimes(1);
  expect(f.sink.commit).not.toHaveBeenCalled();
  expect(next.commit).toHaveBeenCalledTimes(1);
  f.hooks.dispose?.();
  expect(next.release).toHaveBeenCalledWith(1);
});

it('commit-time kind migration leaves terminal cleanup with the new owner', () => {
  const f = fixture();
  f.caps.attachBase([[FINAL_STYLE_SINK_CAP, f.sink]]);
  f.mount();
  f.sink.commit.mockImplementationOnce((frame) => {
    expect(frame.material).not.toBeNull();
    f.caps.resetAttached();
  });
  f.caps.attach([[VISUAL_FEEDBACK_SINK_CAP, f.sink]]);
  expect(f.sink.release).toHaveBeenCalledTimes(2);
  expect(f.log.at(-1)).toBe('final');
  f.hooks.dispose?.();
  expect(f.sink.release).toHaveBeenCalledTimes(3);
});

it('kind-aware ownership still retires a different object of the same kind', () => {
  const f = fixture();
  f.caps.attach([[VISUAL_FEEDBACK_SINK_CAP, f.sink]]);
  f.mount();
  const next = { commit: vi.fn(), release: vi.fn() };
  f.caps.attach([[VISUAL_FEEDBACK_SINK_CAP, next]]);
  expect(f.sink.release).toHaveBeenCalledWith(1);
  expect(next.commit).toHaveBeenCalledTimes(1);
});
