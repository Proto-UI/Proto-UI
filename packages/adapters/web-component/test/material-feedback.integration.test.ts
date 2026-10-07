import { declareTextControl } from '@proto.ui/module-text-control';
import { describe, it, expect, vi } from 'vitest';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { asButton } from '@proto.ui/prototypes-base/button';
import { AdaptToWebComponent, setElementProps } from '../src';
import { installExperimentalVisualConsumer } from '../src/runtime/experimental-visual-consumer';
import type { FinalStyleFrame } from '../../../modules/feedback/src/material/final-style-sink';
import button from '../../../../experiments/material-specializer/button.proto';
import {
  createOpaqueMaterialVisualSink,
  createOwnedTextureVisualSink,
} from '../src/material/owned-texture-sink';
import { createOwnedTwTokenApplier } from '../src/feedback-style';
import { createIntentBuilder } from '../../../modules/rule/src/intent-builder';
import { finalStyleFrame } from '../../../modules/feedback/src/material/final-style-sink';
import type { OwnedMaterialConfig } from '../../../modules/feedback/src/material/owned-slot';
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
let id = 0;

describe('private material through real WC and Feedback', () => {
  it('preserves authored positioning and restores a whole ordinary style on a slot tombstone', () => {
    const host = document.createElement('div');
    Object.assign(host.style, {
      position: 'absolute',
      color: 'rgb(0, 0, 0)',
      background: 'rgb(20, 40, 60)',
      isolation: 'auto',
    });
    document.body.append(host);
    const sink = createOpaqueMaterialVisualSink(host, createOwnedTwTokenApplier(host));
    const material = {
      config: button.modules![0].config as OwnedMaterialConfig,
      pressed: false,
      disabled: false,
      bindingsReady: true,
    };
    sink.commit(finalStyleFrame(tw('rounded-full'), 1, 1, material));
    expect(host.style.position).toBe('absolute');
    expect(host.dataset.materialQuality).toBe('opaque-fallback');
    sink.commit(finalStyleFrame(tw('bg-blue-500 text-white'), 1, 2, null));
    expect(host.style.position).toBe('absolute');
    expect(host.style.background).toBe('rgb(20, 40, 60)');
    expect(host.style.color).toBe('rgb(0, 0, 0)');
    expect(host.style.isolation).toBe('auto');
    expect(host.dataset.materialQuality).toBeUndefined();
    expect(host.getAttribute('data-pui-style')).toContain('bg-blue-500');
    sink.release(1);
    host.remove();
  });
  it('preserves shadow feedback without adding enhancement stacking to fallback', () => {
    const host = document.createElement('div');
    host.style.color = 'rgb(0, 0, 0)';
    document.body.append(host);
    const sink = createOpaqueMaterialVisualSink(host, createOwnedTwTokenApplier(host));
    sink.commit(
      finalStyleFrame(tw('shadow-md'), 1, 1, {
        config: button.modules![0].config as OwnedMaterialConfig,
        pressed: false,
        disabled: false,
        bindingsReady: true,
      })
    );
    expect(host.getAttribute('data-pui-style')).toContain('shadow-md');
    expect(host.dataset.materialReason).toBe('material-support-unavailable');
    expect(host.style.position).toBe('');
    expect(host.style.isolation).toBe('');
    expect(host.querySelector('canvas')).toBeNull();
    sink.release(1);
    host.remove();
  });
  for (const token of ['selection:bg-primary', 'selection:text-primary-foreground'])
    it(`preserves static pseudo-element ${token} outside material host paint`, () => {
      const host = document.createElement('div');
      host.style.color = 'rgb(0, 0, 0)';
      document.body.append(host);
      const sink = createOpaqueMaterialVisualSink(host, createOwnedTwTokenApplier(host));
      try {
        sink.commit(
          finalStyleFrame(tw(token), 1, 1, {
            config: button.modules![0].config as OwnedMaterialConfig,
            pressed: false,
            disabled: false,
            bindingsReady: true,
          })
        );
        expect(host.getAttribute('data-pui-style')).toContain(token);
        expect(host.dataset.materialReason).toBe('material-support-unavailable');
      } finally {
        sink.release(1);
        host.remove();
      }
    });

  it('returns only owned inline values and preserves later external values and priorities', () => {
    const host = document.createElement('div');
    Object.assign(host.style, { color: 'rgb(0, 0, 0)', background: 'rgb(20, 40, 60)' });
    document.body.append(host);
    const sink = createOpaqueMaterialVisualSink(host, createOwnedTwTokenApplier(host));
    const material = {
      config: button.modules![0].config as OwnedMaterialConfig,
      pressed: false,
      disabled: false,
      bindingsReady: true,
    };
    sink.commit(finalStyleFrame(tw('rounded-full'), 1, 1, material));
    host.style.setProperty('background', 'rgb(10, 30, 50)', 'important');
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('isolation', 'auto', 'important');
    host.style.color = 'rgb(255, 255, 255)';
    sink.commit(finalStyleFrame(tw('rounded-full'), 1, 2, material));
    expect(host.dataset.materialQuality).toBe('unavailable');
    expect(host.style.background).toBe('rgb(10, 30, 50)');
    expect(host.style.color).toBe('rgb(255, 255, 255)');
    sink.release(1);
    expect(host.style.background).toBe('rgb(10, 30, 50)');
    expect(host.style.getPropertyPriority('background')).toBe('important');
    expect(host.style.position).toBe('fixed');
    expect(host.style.getPropertyPriority('position')).toBe('important');
    expect(host.style.isolation).toBe('auto');
    host.remove();
  });
  for (const unsafe of ['color', 'opacity'] as const)
    it(`recovers from resolved ${unsafe} changes without repainting unchanged fallback`, () => {
      const host = document.createElement('div');
      document.body.append(host);
      const css = {
        color: unsafe === 'color' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)',
        opacity: unsafe === 'opacity' ? '0.5' : '1',
        transform: 'none',
        position: 'static',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
      };
      const frames = new Map<number, FrameRequestCallback>();
      let sequence = 0;
      const computed = vi
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue(css as CSSStyleDeclaration);
      const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
        frames.set(++sequence, fn);
        return sequence;
      });
      const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        frames.delete(id);
      });
      const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 180, 48));
      const tick = () => {
        const tasks = [...frames.values()];
        frames.clear();
        tasks.forEach((fn) => fn(0));
      };
      const apply = vi.fn();
      const sink = createOwnedTextureVisualSink(
        host,
        { apply, clear() {} } as any,
        { vertex: '', fragment: '', uniforms: [], writeFrame() {} },
        {
          current: () => ({
            generation: 1,
            width: 1,
            height: 1,
            pixels: new Uint8Array([255, 255, 255, 255]),
            bounds: () => [0, 0, 1, 1],
          }),
          subscribe: () => () => {},
        },
        {
          current: () => ({
            reducedMotion: 'no-preference',
            reducedTransparency: 'no-preference',
            contrast: 'no-preference',
            forcedColors: 'none',
          }),
          subscribe: () => () => {},
        }
      );
      try {
        sink.commit(
          finalStyleFrame(tw('rounded-full'), 1, 1, {
            config: button.modules![0].config as OwnedMaterialConfig,
            pressed: false,
            disabled: false,
            bindingsReady: true,
          })
        );
        expect(host.dataset.materialQuality).toBe('unavailable');
        tick();
        tick();
        const unchanged = apply.mock.calls.length;
        tick();
        expect(apply).toHaveBeenCalledTimes(unchanged);
        css.color = 'rgb(0, 0, 0)';
        css.opacity = '1';
        tick();
        expect(context).toHaveBeenCalledOnce();
        expect(host.dataset.materialReason).toBe('webgl-unavailable');
      } finally {
        sink.release(1);
        expect(frames.size).toBe(0);
        computed.mockRestore();
        request.mockRestore();
        cancel.mockRestore();
        context.mockRestore();
        host.remove();
      }
    });

  for (const boundary of [
    'opacity',
    'transform',
    'rotate',
    'scale',
    'translate',
    'filter',
    'mixBlendMode',
  ] as const)
    for (const placement of ['host', 'light', 'shadow', 'slot'] as const)
      it(`rejects unsupported composed ancestor ${boundary} and recovers (placement=${placement})`, () => {
        const container = document.createElement('div');
        const host = document.createElement('div');
        const ancestor =
          placement === 'host'
            ? host
            : placement === 'slot'
              ? document.createElement('slot')
              : container;
        if (placement === 'slot') {
          container.attachShadow({ mode: 'open' }).append(ancestor);
          container.append(host);
        } else if (placement === 'host') container.append(host);
        else
          (placement === 'shadow' ? ancestor.attachShadow({ mode: 'open' }) : ancestor).append(
            host
          );
        document.body.append(container);
        // happy-dom does not implement assignedSlot; inject the native composed-tree
        // relationship, while exercising the actual sink admission and recovery.
        if (placement === 'slot') Object.defineProperty(host, 'assignedSlot', { value: ancestor });
        const safe = {
          color: 'rgb(0, 0, 0)',
          opacity: '1',
          transform: 'none',
          rotate: 'none',
          scale: 'none',
          translate: 'none',
          filter: 'none',
          mixBlendMode: 'normal',
          position: 'static',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
        };
        const ancestorCss = {
          ...safe,
          [boundary]: {
            opacity: '0.2',
            transform: 'matrix(0, 1, -1, 0, 0, 0)',
            rotate: '8deg',
            scale: '1.2',
            translate: '4px',
            filter: 'opacity(0.2)',
            mixBlendMode: 'difference',
          }[boundary],
        };
        const computed = vi
          .spyOn(window, 'getComputedStyle')
          .mockImplementation(
            (element) => (element === ancestor ? ancestorCss : safe) as CSSStyleDeclaration
          );
        const frames = new Map<number, FrameRequestCallback>();
        let nextFrame = 0;
        const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
          frames.set(++nextFrame, fn);
          return nextFrame;
        });
        const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
          frames.delete(id);
        });
        const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 180, 48));
        const sink = createOwnedTextureVisualSink(
          host,
          createOwnedTwTokenApplier(host),
          { vertex: '', fragment: '', uniforms: [], writeFrame() {} },
          {
            current: () => ({
              generation: 1,
              width: 1,
              height: 1,
              pixels: new Uint8Array([255, 255, 255, 255]),
              bounds: () => [0, 0, 1, 1],
            }),
            subscribe: () => () => {},
          },
          {
            current: () => ({
              reducedMotion: 'no-preference',
              reducedTransparency: 'no-preference',
              contrast: 'no-preference',
              forcedColors: 'none',
            }),
            subscribe: () => () => {},
          }
        );
        const tick = () => {
          const tasks = [...frames.values()];
          frames.clear();
          tasks.forEach((fn) => fn(0));
        };
        try {
          sink.commit(
            finalStyleFrame(tw('rounded-full'), 1, 1, {
              config: button.modules![0].config as OwnedMaterialConfig,
              pressed: false,
              disabled: false,
              bindingsReady: true,
            })
          );
          expect(context).not.toHaveBeenCalled();
          expect(host.dataset.materialReason).toBe(
            boundary === 'opacity' || boundary === 'filter' || boundary === 'mixBlendMode'
              ? 'complete-readable-fallback-unavailable'
              : 'geometry-unavailable'
          );
          tick();
          ancestorCss[boundary] =
            boundary === 'opacity' ? '1' : boundary === 'mixBlendMode' ? 'normal' : 'none';
          tick();
          expect(context).toHaveBeenCalledOnce();
          expect(host.dataset.materialReason).toBe('webgl-unavailable');
        } finally {
          sink.release(1);
          expect(frames.size).toBe(0);
          computed.mockRestore();
          request.mockRestore();
          cancel.mockRestore();
          context.mockRestore();
          container.remove();
        }
      });

  it('retires adapter and owner resources when the visual consumer fails before attachment', async () => {
    const beforeDispose = vi.fn();
    const states: Array<{ get(): boolean }> = [];
    const prototype = definePrototype({
      name: `material-construction-failure-${++id}`,
      modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
      setup(def) {
        states.push(def.state.bool('alive', true));
        def.lifecycle.onBeforeDispose(beforeDispose);
        return () => null;
      },
    });
    const failure = new Error('consumer setup failed');
    const off = installExperimentalVisualConsumer(prototype, (_host, style) => {
      style.apply(['rounded-full']);
      throw failure;
    });
    const add = vi.spyOn(HTMLInputElement.prototype, 'addEventListener');
    const remove = vi.spyOn(HTMLInputElement.prototype, 'removeEventListener');
    const Constructor = AdaptToWebComponent(prototype);
    const host = new Constructor();
    try {
      expect(() => document.body.append(host)).toThrow(failure);
      await settle();
      expect(beforeDispose).toHaveBeenCalledOnce();
      expect(() => states[0].get()).toThrow(/disposed/);
      expect(host.querySelector('[data-pui-style]')).toBeNull();
      const focusAdds = add.mock.calls
        .map((args, i) => ({ args, target: add.mock.contexts[i] }))
        .filter(
          ({ args, target }) =>
            ['focus', 'blur'].includes(String(args[0])) && target instanceof HTMLInputElement
        );
      expect(focusAdds).toHaveLength(2);
      for (const { args, target } of focusAdds)
        expect(
          remove.mock.calls.some(
            (call, i) =>
              remove.mock.contexts[i] === target && call[0] === args[0] && call[1] === args[1]
          )
        ).toBe(true);
      host.remove();
      await settle();
      expect(beforeDispose).toHaveBeenCalledOnce();
      off();
      document.body.append(host);
      await settle();
      expect(states).toHaveLength(2);
      expect(states[1].get()).toBe(true);
    } finally {
      off();
      host.remove();
      await settle();
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it('releases a failed remount sink before retry while preserving the logical owner', async () => {
    let run!: RunHandle<any>;
    let alive!: { get(): boolean };
    const failure = new Error('remount material replay failed');
    const releases: ReturnType<typeof vi.fn>[] = [];
    let created = 0;
    const prototype = definePrototype({
      name: `material-remount-failure-${++id}`,
      setup(def) {
        alive = def.state.bool('alive', true);
        def.lifecycle.onCreated((value) => {
          run = value;
        });
        def.expose('view', {
          show: () => run.lifecycle.setPresent(true),
          hide: () => run.lifecycle.setPresent(false),
        });
        def.feedback.style.use(tw('rounded-full'));
        return (renderer) => renderer.el('span', 'owned view');
      },
    });
    const off = installExperimentalVisualConsumer(prototype, () => {
      const number = ++created;
      const release = vi.fn();
      releases.push(release);
      return {
        commit() {
          if (number === 2) throw failure;
        },
        release,
      };
    });
    const errors: unknown[] = [];
    const scheduleMicrotask = globalThis.queueMicrotask;
    const microtask = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
      scheduleMicrotask(() => {
        try {
          callback();
        } catch (error) {
          errors.push(error);
        }
      });
    });
    const Constructor = AdaptToWebComponent(prototype, { schedule: (task) => task() });
    const host = new Constructor();
    try {
      document.body.append(host);
      await settle();
      (host as any).getExposes().view.hide();
      await settle();
      expect(releases[0]).toHaveBeenCalledOnce();
      (host as any).getExposes().view.show();
      await settle();
      expect(errors).toEqual([failure]);
      expect(releases[1]).toHaveBeenCalledOnce();
      expect(alive.get()).toBe(true);
      (host as any).getExposes().view.hide();
      await settle();
      (host as any).getExposes().view.show();
      await settle();
      expect(created).toBe(3);
      expect(host.textContent).toContain('owned view');
      expect(releases[2]).not.toHaveBeenCalled();
      expect(errors).toEqual([failure]);
    } finally {
      host.remove();
      await settle();
      off();
      microtask.mockRestore();
    }
    expect(releases[2]).toHaveBeenCalledOnce();
  });

  it('restores application diagnostics and preserves a later external metadata write', () => {
    const host = document.createElement('div');
    host.style.color = 'rgb(0, 0, 0)';
    Object.assign(host.dataset, {
      materialQuality: 'app-quality',
      materialReason: 'app-reason',
      materialPhase: 'app-phase',
      materialFrame: 'app-frame',
      materialRadius: 'app-radius',
    });
    document.body.append(host);
    const sink = createOpaqueMaterialVisualSink(host, createOwnedTwTokenApplier(host));
    sink.commit(
      finalStyleFrame(tw('rounded-full'), 1, 1, {
        config: button.modules![0].config as OwnedMaterialConfig,
        pressed: false,
        disabled: false,
        bindingsReady: true,
      })
    );
    host.dataset.materialReason = 'new-app-reason';
    sink.release(1);
    expect({ ...host.dataset }).toEqual({
      materialQuality: 'app-quality',
      materialReason: 'new-app-reason',
      materialPhase: 'app-phase',
      materialFrame: 'app-frame',
      materialRadius: 'app-radius',
    });
    host.remove();
  });

  it('reads styles from the new document after adopting a retained host', () => {
    const host = document.createElement('div');
    host.style.color = 'rgb(0, 0, 0)';
    document.body.append(host);
    const sink = createOpaqueMaterialVisualSink(host, createOwnedTwTokenApplier(host));
    const material = {
      config: button.modules![0].config as OwnedMaterialConfig,
      pressed: false,
      disabled: false,
      bindingsReady: true,
    };
    sink.commit(finalStyleFrame(tw('rounded-full'), 1, 1, material));
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const target = frame.contentWindow!;
    const readStyle = vi.spyOn(target, 'getComputedStyle');
    target.document.body.append(target.document.adoptNode(host));
    sink.commit(finalStyleFrame(tw('rounded-full'), 1, 2, material));
    expect(readStyle).toHaveBeenCalledWith(host);
    expect(host.dataset.materialQuality).toBe('opaque-fallback');
    sink.release(1);
    readStyle.mockRestore();
    frame.remove();
  });

  it('unwinds acquired resources when preference subscription fails', () => {
    const host = document.createElement('div');
    const off = vi.fn(() => {
      throw new Error('cleanup failure');
    });
    const release = vi.fn();
    const remove = vi.spyOn(HTMLCanvasElement.prototype, 'removeEventListener');
    const failure = new Error('preference setup failed');
    expect(() =>
      createOwnedTextureVisualSink(
        host,
        createOwnedTwTokenApplier(host),
        null,
        { current: () => null, subscribe: () => off },
        {
          current: () => ({
            reducedMotion: 'reduce',
            reducedTransparency: 'reduce',
            contrast: 'more',
            forcedColors: 'active',
          }),
          subscribe: () => {
            throw failure;
          },
        },
        { mount() {}, release }
      )
    ).toThrow(failure);
    expect(off).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(remove.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining(['webglcontextlost', 'webglcontextrestored'])
    );
    remove.mockRestore();
  });

  it('completes all teardown actions and preserves the first unsubscribe failure', () => {
    const host = document.createElement('div');
    host.style.color = 'rgb(0, 0, 0)';
    host.style.background = 'rgb(20, 40, 60)';
    document.body.append(host);
    const first = new Error('source unsubscribe failed');
    const offSource = vi.fn(() => {
      throw first;
    });
    const offPreferences = vi.fn(() => {
      throw new Error('preference unsubscribe failed');
    });
    const releaseSurface = vi.fn((node: HTMLElement) => node.remove());
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect = disconnect;
      }
    );
    try {
      const sink = createOwnedTextureVisualSink(
        host,
        createOwnedTwTokenApplier(host),
        null,
        { current: () => null, subscribe: () => offSource },
        {
          current: () => ({
            reducedMotion: 'unknown',
            reducedTransparency: 'unknown',
            contrast: 'unknown',
            forcedColors: 'unknown',
          }),
          subscribe: () => offPreferences,
        },
        { mount() {}, release: releaseSurface }
      );
      sink.commit(
        finalStyleFrame(tw('rounded-full'), 1, 1, {
          config: button.modules![0].config as OwnedMaterialConfig,
          pressed: false,
          disabled: false,
          bindingsReady: true,
        })
      );
      expect(() => sink.release(1)).toThrow(first);
      expect(offSource).toHaveBeenCalledOnce();
      expect(offPreferences).toHaveBeenCalledOnce();
      expect(disconnect).toHaveBeenCalledOnce();
      expect(releaseSurface).toHaveBeenCalledOnce();
      expect(host.style.background).toBe('rgb(20, 40, 60)');
      expect(host.getAttribute('data-pui-style')).toBeNull();
      expect(host.dataset.materialQuality).toBeUndefined();
      expect(() => sink.release(1)).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
      host.remove();
    }
  });
  for (const shadow of [false, true])
    it(`owns its visual surface across nested slot commits (shadow=${shadow})`, async () => {
      const probe = definePrototype({
        name: `material-surface-${++id}`,
        modules: button.modules,
        setup() {
          asButton();
          return (r) => r.el('div', [r.slot()]);
        },
      });
      let canvas: HTMLCanvasElement;
      const off = installExperimentalVisualConsumer(probe, (_host, _style, surface) => {
        canvas = document.createElement('canvas');
        return {
          commit() {
            surface.mount(canvas);
          },
          release() {
            surface.release(canvas);
          },
        };
      });
      const C = AdaptToWebComponent(probe, { shadow });
      const el = new C();
      const label = document.createElement('span');
      label.textContent = 'Continue';
      el.append(label);
      document.body.append(el);
      await settle();
      const root = el.shadowRoot ?? el;
      expect(canvas!.parentNode).toBe(root);
      expect(root.querySelector('div canvas')).toBeNull();
      el.update();
      await settle();
      expect(canvas!.parentNode).toBe(root);
      expect(root.querySelector('div canvas')).toBeNull();
      expect(el.contains(label)).toBe(true);
      el.remove();
      await settle();
      expect(canvas!.parentNode).toBeNull();
      off();
    });
  it('rejects an unreadable fallback as a whole and preserves text, focus and disabled semantics', async () => {
    const C = AdaptToWebComponent(button, { registerAs: `material-button-${++id}` });
    const el = new C();
    el.textContent = 'Continue';
    Object.assign(el.style, {
      color: 'rgb(255, 255, 255)',
      background: 'rgb(20, 40, 60)',
      position: 'fixed',
    });
    document.body.append(el);
    await settle();
    expect(el.dataset.materialQuality).toBe('unavailable');
    expect(el.dataset.materialReason).toBe('complete-readable-fallback-unavailable');
    expect(el.style.background).toBe('rgb(20, 40, 60)');
    expect(el.style.color).toBe('rgb(255, 255, 255)');
    expect(el.style.position).toBe('fixed');
    expect(el.textContent).toBe('Continue');
    el.getExposes().focusSelf();
    await settle();
    expect(document.activeElement).toBe(el);
    setElementProps(el, { disabled: true });
    await settle();
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1 }));
    expect(el.getExposes().disabled.get()).toBe(true);
    expect(el.getExposes().pressed.get()).toBe(false);
    el.remove();
    await settle();
  });
  it('delivers Base pointer/disabled state through Feedback and releases its view', async () => {
    const frames: FinalStyleFrame[] = [];
    let released = 0;
    const off = installExperimentalVisualConsumer(button, () => ({
      commit(frame) {
        frames.push(frame);
      },
      release() {
        released++;
      },
    }));
    const C = AdaptToWebComponent(button, { registerAs: `material-button-${++id}` });
    const el = new C();
    el.textContent = 'Continue';
    el.style.color = 'rgb(0, 0, 0)';
    document.body.append(el);
    await settle();
    expect(frames.at(-1)?.material?.bindingsReady).toBe(true);
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1 }));
    expect(frames.at(-1)?.material?.pressed).toBe(true);
    setElementProps(el, { disabled: true });
    await settle();
    expect(frames.at(-1)?.material?.disabled).toBe(true);
    expect(frames.at(-1)?.material?.pressed).toBe(false);
    el.remove();
    await settle();
    expect(released).toBe(1);
    off();
  });
  it('installs explicit opaque fallback on generic WC without pretending GPU support', async () => {
    const C = AdaptToWebComponent(button, { registerAs: `material-button-${++id}` });
    const el = new C();
    el.textContent = 'Continue';
    el.style.color = 'rgb(0, 0, 0)';
    document.body.append(el);
    await settle();
    expect(el.dataset.materialQuality).toBe('opaque-fallback');
    expect(el.dataset.materialReason).toBe('material-support-unavailable');
    expect(el.style.background).toContain('239.7');
    expect(el.textContent).toBe('Continue');
    el.remove();
    await settle();
    expect(el.querySelector('canvas')).toBeNull();
  });
  it('rejects authored variant syntax before material Rule lowering', () => {
    for (const token of ['dark:bg-red-500', 'hover:text-blue-500', 'focus:rounded-lg']) {
      const { builder } = createIntentBuilder();
      expect(() => builder.feedback.style.use(tw(token))).toThrow('forbidden character ":"');
    }
  });
  it('retains material-relevant Rule evaluation while unrelated selectors can still lower', async () => {
    const probe = definePrototype({
      name: `material-rule-${++id}`,
      modules: button.modules,
      setup(def) {
        const state = asButton().stateHandles!;
        def.feedback.style.use(tw('rounded-full text-foreground'));
        def.rule({
          when: (w) => w.state(state.pressed).eq(true),
          intent: (i) => i.feedback.style.use(tw('bg-red-500')),
        });
        def.rule({
          when: (w) => w.state(state.hovered).eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });
      },
    });
    const frames: FinalStyleFrame[] = [];
    const off = installExperimentalVisualConsumer(probe, () => ({
      commit(frame) {
        frames.push(frame);
      },
      release() {},
    }));
    const C = AdaptToWebComponent(probe);
    const el = new C();
    document.body.append(el);
    await settle();
    expect(frames.at(-1)?.style.tokens.some((t) => t.includes(':bg-red-500'))).toBe(false);
    expect(
      frames
        .at(-1)
        ?.style.tokens.some((t) => t.includes('text-blue-500') || t.includes('rounded-lg'))
    ).toBe(false);
    expect(frames.at(-1)?.style.tokens.some((t) => t.includes(':opacity-50'))).toBe(true);
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1 }));
    await settle();
    expect(frames.at(-1)?.style.tokens).toContain('bg-red-500');
    el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    await settle();
    expect(frames.at(-1)?.style.tokens).not.toContain('bg-red-500');
    el.remove();
    await settle();
    off();
  });
});
