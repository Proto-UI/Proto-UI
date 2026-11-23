import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

export type PropsPolicyMode = 'adapter-default' | 'adapter-explicit' | 'compiled-explicit';
export type PropsPolicyPhase = { phase: string; text: string | null };
type Handle = { update(): void; getExposes(): { touch(): void } };

/** Ordinary React import/props/children/ref consumer shared by DOM and browser evidence. */
export function mountPropsPolicyProbe(component: React.ElementType, host: HTMLElement) {
  const root = createRoot(host);
  const ref = React.createRef<Handle>();
  const phases: PropsPolicyPhase[] = [];
  let label = 'first';
  let tone = 'offline';
  let disposed = false;
  const text = () => host.querySelector('strong')?.textContent ?? null;
  const onPhase = (phase: unknown) => phases.push({ phase: String(phase), text: text() });
  const render = () =>
    flushSync(() => {
      root.render(
        React.createElement(
          component,
          { ref, label, tone, onPhase },
          React.createElement('b', null, 'native-child')
        )
      );
    });
  render();
  let initialHandle: Handle | null = null;
  let heldTouch: (() => void) | null = null;
  let initialRoot: Element | null = null;
  let initialLabel: Element | null = null;
  let initialChild: Element | null = null;

  return {
    ready() {
      if (initialHandle) return true;
      const root = host.querySelector('[data-pui-root]');
      const label = host.querySelector('strong');
      const child = host.querySelector('b');
      if (!ref.current || !root || !label || !child) return false;
      initialHandle = ref.current;
      heldTouch = initialHandle.getExposes().touch;
      initialRoot = root;
      initialLabel = label;
      initialChild = child;
      return true;
    },
    write(nextLabel: string, nextTone: string) {
      label = nextLabel;
      tone = nextTone;
      render();
    },
    synchronize() {
      flushSync(() => heldTouch!());
    },
    update(count = 1) {
      flushSync(() => {
        for (let i = 0; i < count; ++i) initialHandle!.update();
      });
    },
    read() {
      // Observation must not call a public getter/method: those enter Runtime
      // scope and would hide the host invalidation vs Props delivery boundary.
      if (!initialRoot) throw new Error('Props-policy initial consumer is not ready.');
      return {
        text: text(),
        online: (initialRoot.getAttribute('data-pui-style') ?? '')
          .split(/\s+/)
          .includes('props-policy-online'),
        sameRoot: host.querySelector('[data-pui-root]') === initialRoot,
        sameLabel: host.querySelector('strong') === initialLabel,
        sameChild: host.querySelector('b') === initialChild,
        sameHandle: ref.current === initialHandle,
        childText: host.querySelector('b')?.textContent ?? null,
        phases: phases.map((entry) => ({ ...entry })),
        disposed,
      };
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      flushSync(() => root.unmount());
      // Runtime's terminal owner release intentionally follows StrictMode's
      // synchronous retain opportunity. This does not fabricate a view commit.
      for (let i = 0; i < 8; ++i) await Promise.resolve();
    },
    retainedTouchRejects() {
      try {
        heldTouch!();
        return false;
      } catch {
        return true;
      }
    },
  };
}

export type PropsPolicyProbe = ReturnType<typeof mountPropsPolicyProbe>;
export type PropsPolicySnapshot = ReturnType<PropsPolicyProbe['read']>;
