// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createRuntimeSession } from '../../src';
import {
  SHADER_PRESENTATION_SINK_CAP,
  type ShaderPresentationFrame,
  type FeedbackPort,
} from '@proto.ui/module-feedback';
import prototype from '../fixtures/shader-presentation-owner.proto';
import staticPrototype from '../fixtures/shader-static-data-owner.proto';
import scenePrototype from '../fixtures/shader-scene-owner.proto';

function fixture(input = prototype, visible = true) {
  let props = { visible };
  const frames: ShaderPresentationFrame[] = [];
  const release = vi.fn();
  const session = createRuntimeSession(input, {
    prototypeName: input.name,
    presenceLifecycle: 'session',
    getRawProps: () => props,
    schedule: (task) => task(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      wiring.attach('feedback', [
        [
          SHADER_PRESENTATION_SINK_CAP,
          {
            commit: (frame: ShaderPresentationFrame) => {
              frames.push(frame);
            },
            release,
          },
        ],
      ]);
    },
  });
  return {
    session,
    frames,
    release,
    setVisible(next: boolean) {
      props = { visible: next };
      session.controller.applyRawProps(props);
    },
  };
}

it.each([prototype, staticPrototype, scenePrototype])(
  '$name authored input traverses real Runtime setup and repeatable view lifetimes without DOM',
  async (input) => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    const f = fixture(input);
    try {
      await f.session.mount();
      expect(f.session.mountPhase).toBe('mounted');
      const declaration = f.frames.at(-1)!.declaration;
      expect(declaration.passes.map((pass) => pass.kernel)).toEqual([
        'copy-rgba8-v1',
        'tint-rgba8-v1',
      ]);
      if (input === scenePrototype)
        expect(declaration.source).toEqual({ kind: 'owned-scene', slot: 'mainScene' });
      else {
        expect(declaration.source.kind).toBe('owned-pixels');
        if (declaration.source.kind !== 'owned-pixels') throw new Error('Expected owned pixels');
        expect(declaration.source.pixels).toEqual([
          255, 0, 0, 255, 0, 128, 0, 128, 0, 0, 64, 64, 64, 128, 192, 255,
        ]);
      }
      expect(f.frames.at(-1)!.style.tokens).toEqual(['block', 'p-4']);
      f.setVisible(false);
      expect(f.session.viewIntent.getSnapshot().present).toBe(false);
      await f.session.unmount();
      expect(f.session.mountPhase).toBe('detached');
      expect(f.release.mock.calls).toEqual([[1]]);
      const beforeRemount = f.frames.length;
      f.setVisible(true);
      expect(f.session.viewIntent.getSnapshot().present).toBe(true);
      await f.session.mount();
      expect(f.frames.length).toBeGreaterThan(beforeRemount);
      expect(f.frames.at(-1)!.view).toBe(2);
      expect(f.frames.at(-1)!.declaration).toBe(declaration);
      expect(f.session.caps.getPort<FeedbackPort>('feedback')!.shaderDiagnostics?.()).toEqual([]);
    } finally {
      await f.session.dispose();
    }
    expect(f.release.mock.calls).toEqual([[1], [2]]);
    expect(f.session.instancePhase).toBe('disposed');
  }
);

it.each([prototype, staticPrototype, scenePrototype])(
  '$name created-time absence acquires no physical shader resources before the first visible view',
  async (input) => {
    const f = fixture(input, false);
    try {
      // Runtime.mount is an explicit host command. As real Adapters do, honor
      // created-time view intent before issuing the first physical mount.
      expect(f.session.viewIntent.getSnapshot().present).toBe(false);
      expect(f.session.mountPhase).toBe('detached');
      expect(f.frames).toEqual([]);
      expect(f.release).not.toHaveBeenCalled();
      f.setVisible(true);
      await f.session.mount();
      expect(f.frames.at(-1)!.view).toBe(1);
    } finally {
      await f.session.dispose();
    }
    expect(f.release.mock.calls).toEqual([[1]]);
  }
);
