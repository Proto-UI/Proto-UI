import { describe, expect, it, vi } from 'vitest';
import {
  tw,
  type DefHandle,
  type MaterialSlot,
  type MaterialCandidate,
  type StyleHandle,
  type State,
} from '@proto.ui/core';
import {
  EFFECTS_CAP,
  VISUAL_FEEDBACK_SINK_CAP,
  type VisualFeedbackFrame,
  type FeedbackPort,
} from '@proto.ui/module-feedback';
import { createRuntimeSession } from '../../src';
import type { RulePort } from '@proto.ui/module-rule';

const slot: MaterialSlot = {
  version: 2,
  shape: { kind: 'rounded-rect', geometry: 'style' },
  source: { kind: 'in-app-backdrop' },
  fallback: { fill: 'style', foreground: 'style' },
};

function fixture(
  options: {
    sink?: boolean;
    static?: boolean;
    onFrame?: (frame: VisualFeedbackFrame) => void;
    setup?: (def: DefHandle<any>, active: State<boolean>) => void;
  } = {}
) {
  let props = { active: false, visible: true };
  let def!: DefHandle<any>;
  const frames: VisualFeedbackFrame[] = [];
  const styles: StyleHandle[] = [];
  const release = vi.fn();
  const session = createRuntimeSession(
    {
      name: 'shared-material-runtime',
      setup(current) {
        def = current;
        current.props.define({
          active: { type: 'boolean', empty: 'fallback' },
          visible: { type: 'boolean', empty: 'fallback' },
        });
        current.feedback.style.use(tw('bg-white text-black'));
        current.feedback.material.declare(slot);
        // The fixture's semantic owner publishes these state handles. Material
        // consumes them explicitly; no expose-name or button profile lookup.
        const activeState = current.state.bool('fixture-active', false);
        const visibleState = current.state.bool('fixture-visible', true);
        current.props.watch(['active', 'visible'], (_run, next) => {
          activeState.set(next.active === true);
          visibleState.set(next.visible !== false);
        });
        if (options.static) current.feedback.material.use({ intent: 'liquid-glass' });
        else {
          for (const active of [false, true])
            current.rule({
              when: (w) => w.all(w.state(activeState).eq(active), w.state(visibleState).eq(true)),
              intent: (i) => {
                i.feedback.style.use(tw(active ? 'rounded-xl' : 'rounded-lg'));
                i.feedback.material.use({
                  intent: 'liquid-glass',
                  deformation: { kind: 'press', phase: active ? 'pressed' : 'rest' },
                });
              },
            });
        }
        options.setup?.(current, activeState);
        return (r) => r.el('span', 'owned content');
      },
    },
    {
      prototypeName: 'shared-material-runtime',
      getRawProps: () => props,
      schedule: (fn) => fn(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('feedback', [
          [
            EFFECTS_CAP,
            { queueStyle: (value: StyleHandle) => styles.push(value), requestFlush() {} },
          ],
        ]);
        if (options.sink !== false)
          wiring.attach('feedback', [
            [
              VISUAL_FEEDBACK_SINK_CAP,
              {
                commit: (frame: VisualFeedbackFrame) => {
                  frames.push(frame);
                  options.onFrame?.(frame);
                },
                release,
              },
            ],
          ]);
      },
    }
  );
  const port = session.caps.getPort<FeedbackPort>('feedback')!;
  return {
    session,
    def,
    frames,
    styles,
    release,
    port,
    set(next: Partial<typeof props>) {
      props = { ...props, ...next };
      session.controller.applyRawProps(props);
    },
  };
}

describe('shared material author and Rule runtime (no paint claim)', () => {
  it('serializes a reentrant host invalidation before replacing the Rule contribution again', async () => {
    let enabled = false;
    const f = fixture({
      onFrame(frame) {
        if (
          enabled &&
          frame.material.candidates.some(
            (candidate) =>
              candidate.intent === 'liquid-glass' && candidate.deformation?.phase === 'pressed'
          )
        ) {
          enabled = false;
          f.session.caps.getPort<RulePort<any>>('rule')!.requestStyleReevaluation();
        }
      },
    });
    await f.session.mount();
    enabled = true;
    f.set({ active: true });
    expect(f.frames.at(-1)?.material.candidates).toEqual([
      { intent: 'liquid-glass', deformation: { kind: 'press', phase: 'pressed' } },
    ]);
    expect(f.frames.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
    expect(f.port.exportMaterialFrame?.().candidates).toHaveLength(1);
    await f.session.dispose();
  });

  it('releases a replaced sink and replays only the current complete intent', async () => {
    const f = fixture();
    await f.session.mount();
    f.set({ active: true });
    const old = f.frames.length;
    const currentView = f.frames.at(-1)!.view;
    const replacement: VisualFeedbackFrame[] = [];
    f.session.caps.getWiring().reset('feedback');
    expect(f.release).toHaveBeenCalledWith(currentView);
    f.session.caps
      .getWiring()
      .attach('feedback', [
        [
          VISUAL_FEEDBACK_SINK_CAP,
          { commit: (frame: VisualFeedbackFrame) => replacement.push(frame), release() {} },
        ],
      ]);
    expect(f.frames).toHaveLength(old);
    expect(replacement.at(-1)?.material.candidates[0]).toMatchObject({
      deformation: { phase: 'pressed' },
    });
    expect(replacement.at(-1)?.style.tokens).toContain('rounded-xl');
    await f.session.dispose();
  });
  it('runs a static non-button declaration and only one host sink', async () => {
    const f = fixture({ static: true });
    await f.session.mount();
    expect(f.frames.at(-1)?.material.candidates).toEqual([{ intent: 'liquid-glass' }]);
    expect(f.styles).toEqual([]);
    expect(f.port.materialDiagnostics?.()).toEqual([]);
    expect(f.frames.at(-1)?.style.tokens).toEqual(['bg-white', 'text-black']);
    await f.session.dispose();
  });
  it('replaces style and whole candidates together without transient conflict or stale phase', async () => {
    const f = fixture();
    await f.session.mount();
    const before = f.frames.length;
    f.set({ active: true });
    const next = f.frames.slice(before);
    expect(next.length).toBeGreaterThan(0);
    for (const frame of next) {
      expect(frame.style.tokens).toContain('rounded-xl');
      expect(frame.style.tokens).not.toContain('rounded-lg');
      expect(frame.material.candidates).toEqual([
        { intent: 'liquid-glass', deformation: { kind: 'press', phase: 'pressed' } },
      ]);
    }
    f.set({ visible: false });
    expect(f.frames.at(-1)?.material).toEqual({ slot, candidates: [] });
    await f.session.dispose();
  });
  it('supports material-only Rules even when their style token plan is empty', async () => {
    const f = fixture({
      static: true,
      setup(def, active) {
        def.rule({
          when: (w) => w.state(active).eq(true),
          intent: (i) => i.feedback.material.use({ intent: 'adaptive-blur' }),
        });
      },
    });
    await f.session.mount();
    f.set({ active: true });
    expect(f.frames.at(-1)?.material.candidates).toEqual([
      { intent: 'liquid-glass' },
      { intent: 'adaptive-blur' },
    ]);
    f.set({ active: false });
    expect(f.frames.at(-1)?.material.candidates).toEqual([{ intent: 'liquid-glass' }]);
    await f.session.dispose();
  });
  it('retains intent while detached, replays a new view, and rejects captured setup operations', async () => {
    const f = fixture();
    await f.session.mount();
    const first = f.frames.at(-1)!.view;
    await f.session.unmount();
    const count = f.frames.length;
    f.set({ active: true });
    expect(f.frames).toHaveLength(count);
    expect(f.release).toHaveBeenCalledWith(first);
    await f.session.mount();
    expect(f.frames.at(-1)!.view).toBeGreaterThan(first);
    expect(f.frames.at(-1)?.material.candidates[0]).toMatchObject({
      deformation: { phase: 'pressed' },
    });
    expect(() => f.def.feedback.material.use({ intent: 'liquid-glass' })).toThrow();
    await f.session.dispose();
    const retired = f.frames.length;
    expect(f.port.exportMaterialFrame?.()).toEqual({ slot: null, candidates: [] });
    expect(() => f.port.replaceVisualRuntime?.(null, [], [{ intent: 'liquid-glass' }])).toThrow();
    expect(f.frames).toHaveLength(retired);
  });
  it('preserves ordinary style and diagnoses a missing host capability without pretending to paint glass', async () => {
    const f = fixture({ static: true, sink: false });
    await f.session.mount();
    expect(f.frames).toEqual([]);
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-white', 'text-black']);
    expect(f.port.materialDiagnostics?.()).toEqual(['material-host-unavailable']);
    expect(f.port.exportMaterialFrame?.().candidates).toEqual([{ intent: 'liquid-glass' }]);
    await f.session.dispose();
  });
  it('retains all style rules for complete shared material provenance', async () => {
    const f = fixture({ static: true });
    expect(f.port.shouldRetainStyleRule?.(['w-4', 'opacity-50', 'translate-x-1'])).toBe(true);
    await f.session.dispose();
  });
  it('rejects duplicate slots and malformed inactive candidates before mounting', () => {
    expect(() => fixture({ setup: (def) => def.feedback.material.declare(slot) })).toThrow(
      /One material slot/
    );
    expect(() =>
      fixture({
        setup: (def) =>
          def.rule({
            when: (w) => w.f(),
            intent: (i) =>
              i.feedback.material.use({ intent: 'liquid-glass', shader: 'x' } as MaterialCandidate),
          }),
      })
    ).toThrow();
  });
});
