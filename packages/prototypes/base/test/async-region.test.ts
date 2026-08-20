import { describe, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import asyncRegionRoot from '../src/async-region';
import type { State } from '@proto.ui/core';
import type { AsyncRegionRootExposes, AsyncRegionRootStateHandles } from '../src/async-region';

type StateValue<T> =
  T extends State<infer V> ? V : T extends { kind: 'state'; state: State<infer V> } ? V : never;

AdaptToWebComponent(asyncRegionRoot);

describe('prototypes/base: async-region', () => {
  it('preserves the boolean busy type across public state handles', () => {
    // T-BASE-ASYNC-REGION-0001-CASE-TYPED-BUSY
    expectTypeOf<StateValue<AsyncRegionRootExposes['busy']>>().toEqualTypeOf<boolean>();
    expectTypeOf<StateValue<AsyncRegionRootStateHandles['busy']>>().toEqualTypeOf<boolean>();
  });

  it('defaults to not-busy semantics with governed busy expose and no interaction', async () => {
    // T-BASE-ASYNC-REGION-0001-CASE-DEFAULTS
    const el = document.createElement('base-async-region-root') as HTMLElement & {
      getExposes(): Record<string, unknown>;
    };
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(el.hasAttribute('data-busy')).toBe(false);
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('aria-label')).toBe(false);
    expect(el.tabIndex).toBe(-1);
    expect(Object.keys(el.getExposes()).sort()).toEqual(['busy']);
    expect(el.hasAttribute('data-pui-a11y-actions')).toBe(false);
    el.remove();
  });

  it('projects aria-busy true when busy prop is set', async () => {
    // T-BASE-ASYNC-REGION-0001-CASE-BUSY-TRUE
    const el = document.createElement('base-async-region-root');
    setElementProps(el, { busy: true });
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.hasAttribute('data-busy')).toBe(true);
    el.remove();
  });

  it('updates aria-busy and the busy expose handle on mounted prop transitions', async () => {
    // T-BASE-ASYNC-REGION-0001-CASE-DYNAMIC-BUSY
    const el = document.createElement('base-async-region-root') as HTMLElement & {
      getExposes(): { busy: { get(): boolean } };
    };
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.getExposes().busy.get()).toBe(false);

    setElementProps(el, { busy: true });
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(el.hasAttribute('data-busy')).toBe(true);
    expect(el.getExposes().busy.get()).toBe(true);

    setElementProps(el, { busy: false });
    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(el.hasAttribute('data-busy')).toBe(false);
    expect(el.getExposes().busy.get()).toBe(false);
    el.remove();
  });

  it('preserves authored descendants and focus on prop-only transitions', async () => {
    // T-BASE-ASYNC-REGION-0001-CASE-CONTENT-PRESERVATION
    const el = document.createElement('base-async-region-root');
    const button = document.createElement('button');
    button.textContent = 'Retry';
    el.appendChild(button);
    document.body.appendChild(el);
    await Promise.resolve();
    button.focus();
    expect(document.activeElement).toBe(button);

    expect(el.textContent).toBe('Retry');

    setElementProps(el, { busy: true });
    expect(el.textContent).toBe('Retry');
    expect(el.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(button);

    setElementProps(el, { busy: false });
    expect(el.textContent).toBe('Retry');
    expect(el.getAttribute('aria-busy')).toBe('false');
    expect(document.activeElement).toBe(button);
    el.remove();
  });
});
