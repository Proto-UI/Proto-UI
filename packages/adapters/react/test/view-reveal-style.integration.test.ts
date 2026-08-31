import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { PUI_VIEW_PENDING_ATTR, PUI_VIEW_REVEALING_ATTR } from '@proto.ui/adapter-base';

import { createReactAdapter } from '../src';
import { createMountedReactAdapter } from './utils/fake-react';

const mountedRoots: Array<{ unmount(): void }> = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of mountedRoots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.replaceChildren();
});

describe('adapter-react: first-view reveal coherence', () => {
  it('projects rule-complete style tokens before revealing a newly attached root', async () => {
    const proto = definePrototype<{ active?: boolean }>({
      name: 'react-view-reveal-style',
      setup(def) {
        def.props.define({
          active: { type: 'boolean', default: false },
        });
        def.feedback.style.use(tw('rounded-lg border transition-all'));
        def.rule({
          when: (when) => when.meta('colorScheme').eq('dark'),
          intent: (intent) => intent.feedback.style.use(tw('bg-input/30')),
        });
        def.rule({
          when: (when) => when.prop('active').eq(true),
          intent: (intent) =>
            intent.feedback.style.use(tw('border-transparent bg-primary h-8 px-2.5')),
        });
        return (renderer) => renderer.el('span', 'ready');
      },
    });

    const revealSamples: Array<{
      animation: string;
      revealing: boolean;
      style: string | null;
      transition: string;
      visibility: string;
    }> = [];
    const removeAttribute = Element.prototype.removeAttribute;
    vi.spyOn(Element.prototype, 'removeAttribute').mockImplementation(function (
      this: Element,
      name
    ) {
      const samplesReveal =
        name === PUI_VIEW_PENDING_ATTR &&
        this instanceof HTMLElement &&
        this.hasAttribute('data-pui-root') &&
        this.hasAttribute(PUI_VIEW_PENDING_ATTR);
      const result = removeAttribute.call(this, name);
      if (samplesReveal) {
        const computedStyle = getComputedStyle(this);
        revealSamples.push({
          animation: computedStyle.animation,
          revealing: this.hasAttribute(PUI_VIEW_REVEALING_ATTR),
          style: this.getAttribute('data-pui-style'),
          transition: computedStyle.transition,
          visibility: computedStyle.visibility,
        });
      }
      return result;
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    const Component = createReactAdapter(React)(proto, {
      getMeta: (key) => (key === 'colorScheme' ? 'dark' : undefined),
    });

    await act(async () => {
      root.render(React.createElement(Component, { active: true }));
      await Promise.resolve();
    });

    expect(revealSamples).toHaveLength(1);
    expect(revealSamples[0]).toMatchObject({
      animation: 'none',
      revealing: true,
      transition: 'none',
    });
    expect(revealSamples[0]?.visibility).not.toBe('hidden');
    expect(revealSamples[0]?.style?.split(/\s+/)).toEqual([
      'rounded-lg',
      'border',
      'transition-all',
      'dark:bg-input/30',
      'border-transparent',
      'bg-primary',
      'h-8',
      'px-2.5',
    ]);
    expect(host.querySelector('[data-pui-root]')?.hasAttribute(PUI_VIEW_PENDING_ATTR)).toBe(false);
  });

  it('does not let an older layout replay clear the current reveal guard', async () => {
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    let frameId = 0;
    const frames = new Map<number, FrameRequestCallback>();
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const id = ++frameId;
      frames.set(id, callback);
      return id;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      frames.delete(id)) as typeof cancelAnimationFrame;
    const runNextFrame = () => {
      const next = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
      expect(next).toBeDefined();
      frames.delete(next![0]);
      next![1](frameId * 16.7);
    };

    const proto = definePrototype({
      name: 'react-view-reveal-generation',
      setup(def) {
        def.feedback.style.use(tw('transition-all'));
        return (renderer) => renderer.el('span', 'ready');
      },
    });
    const mounted = createMountedReactAdapter(proto);

    try {
      const root = mounted.root;
      expect(root?.hasAttribute(PUI_VIEW_REVEALING_ATTR)).toBe(true);
      expect(frames.size).toBe(1);

      runNextFrame();
      mounted.replayLayoutEffects();
      await Promise.resolve();
      mounted.update();

      expect(mounted.root).toBe(root);
      expect(root?.hasAttribute(PUI_VIEW_PENDING_ATTR)).toBe(false);
      expect(root?.hasAttribute(PUI_VIEW_REVEALING_ATTR)).toBe(true);
      expect(frames.size).toBe(2);

      runNextFrame();
      expect(root?.hasAttribute(PUI_VIEW_REVEALING_ATTR)).toBe(true);

      runNextFrame();
      expect(root?.hasAttribute(PUI_VIEW_REVEALING_ATTR)).toBe(true);
      runNextFrame();
      expect(root?.hasAttribute(PUI_VIEW_REVEALING_ATTR)).toBe(false);
    } finally {
      mounted.unmount();
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
  });
});
