import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { asAccessible } from '@proto.ui/hooks';
import { describe, expect, it } from 'vitest';
import {
  definePrototype,
  isA11ySemanticObjectRef,
  type A11ySemanticObjectRef,
} from '@proto.ui/core';
import { definePrivilegedAsHook } from '../../../hooks/src/privileged';
import { createReactAdapter } from '../src/adapt';
import { createMountedReactAdapter } from './utils/fake-react';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// Host-level fixture transports the portable opaque ref, never a DOM node or ID.
const semanticReference = definePrivilegedAsHook({
  name: 'react-a11y-reference-fixture',
  setup({ ports }) {
    const port = ports.a11y;
    if (
      !port ||
      typeof port !== 'object' ||
      !('getObjectRef' in port) ||
      typeof port.getObjectRef !== 'function'
    ) {
      throw new Error('A11y port is unavailable.');
    }
    const reference: unknown = port.getObjectRef();
    if (!isA11ySemanticObjectRef(reference)) throw new Error('Not an owned semantic object ref.');
    return reference;
  },
});

const headingPrototype = definePrototype({
  name: 'react-a11y-heading-level',
  setup(def) {
    const role = def.state.string('heading.role', 'heading');
    const level = def.state.numberDiscrete('heading.level', 2);
    asAccessible().role(role);
    asAccessible().level(level);
    def.expose.method('setRole', (value: string) => role.set(value, 'reason: update heading role'));
    def.expose.method('setLevel', (value: number) =>
      level.set(value, 'reason: update heading level')
    );
    def.expose.method('getLevel', () => level.get());
    return (r) => r.el('div', 'Heading');
  },
});

describe('adapter-react: portable heading level', () => {
  it('projects valid levels, omits invalid updates, and clears aria-level after a role change', () => {
    const mounted = createMountedReactAdapter(headingPrototype);
    const exposes = mounted.ref.current.getExposes() as {
      setRole(value: string): void;
      setLevel(value: number): void;
      getLevel(): number;
    };

    try {
      expect(mounted.root?.getAttribute('role')).toBe('heading');
      expect(mounted.root?.getAttribute('aria-level')).toBe('2');
      exposes.setLevel(6);
      expect(mounted.root?.getAttribute('aria-level')).toBe('6');
      exposes.setLevel(0);
      expect(exposes.getLevel()).toBe(0);
      expect(mounted.root?.getAttribute('role')).toBe('heading');
      expect(mounted.root?.hasAttribute('aria-level')).toBe(false);
      exposes.setLevel(4);
      expect(exposes.getLevel()).toBe(4);
      expect(mounted.root?.getAttribute('aria-level')).toBe('4');
      exposes.setRole('button');
      expect(mounted.root?.getAttribute('role')).toBe('button');
      expect(mounted.root?.hasAttribute('aria-level')).toBe(false);
      exposes.setRole('heading');
      expect(mounted.root?.getAttribute('role')).toBe('heading');
      expect(mounted.root?.getAttribute('aria-level')).toBe('4');
    } finally {
      mounted.unmount();
    }
  });

  it('retains a referenced heading identity across same-turn Activity view replay', async () => {
    let targetRef!: A11ySemanticObjectRef;
    const target = definePrototype({
      name: 'react-a11y-replay-target',
      setup() {
        asAccessible().role('heading');
        targetRef = semanticReference();
        return (renderer) => renderer.el('span', 'Heading');
      },
    });
    const source = definePrototype({
      name: 'react-a11y-replay-source',
      setup() {
        asAccessible().role('button');
        asAccessible().relation('labelledBy', { target: targetRef });
        return (renderer) => renderer.el('span', 'Source');
      },
    });
    const adapt = createReactAdapter(React);
    const Target = adapt(target);
    const Source = adapt(source);
    let setMode!: (mode: 'visible' | 'hidden') => void;
    function App() {
      const [mode, changeMode] = React.useState<'visible' | 'hidden'>('visible');
      setMode = changeMode;
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(React.Activity, { mode, children: React.createElement(Target) }),
        React.createElement(Source)
      );
    }
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(React.createElement(App)));
      const id = host.querySelector<HTMLElement>('[role="heading"]')!.id;
      const sourceRoot = host.querySelector<HTMLElement>('[role="button"]')!;
      expect(id).not.toBe('');
      expect(sourceRoot.getAttribute('aria-labelledby')).toBe(id);

      await act(async () => {
        flushSync(() => setMode('hidden'));
        flushSync(() => setMode('visible'));
      });

      expect(host.querySelector<HTMLElement>('[role="heading"]')!.id).toBe(id);
      expect(sourceRoot.getAttribute('aria-labelledby')).toBe(id);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
