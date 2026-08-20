import { describe, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import liveRegionRoot from '../src/live-region';
import type { State } from '@proto.ui/core';
import type {
  LiveRegionPoliteness,
  LiveRegionRootExposes,
  LiveRegionRootStateHandles,
} from '../src/live-region';

type StateValue<T> =
  T extends State<infer V> ? V : T extends { kind: 'state'; state: State<infer V> } ? V : never;

AdaptToWebComponent(liveRegionRoot);

describe('prototypes/base: live-region', () => {
  it('preserves the politeness literal union across public type surfaces', () => {
    // T-BASE-LIVE-REGION-0001-CASE-TYPED-POLITENESS
    expectTypeOf<LiveRegionPoliteness>().toEqualTypeOf<'polite' | 'assertive'>();
    expectTypeOf<LiveRegionRootStateHandles>().toEqualTypeOf<{}>();
    expectTypeOf<LiveRegionRootExposes>().toEqualTypeOf<{}>();
  });

  it('defaults to polite status semantics with atomic true and no interaction', async () => {
    // T-BASE-LIVE-REGION-0001-CASE-DEFAULTS
    const el = document.createElement('base-live-region-root') as HTMLElement & {
      getExposes(): Record<string, unknown>;
    };
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    expect(el.tabIndex).toBe(-1);
    expect(el.hasAttribute('aria-label')).toBe(false);
    expect(Object.keys(el.getExposes())).toEqual([]);
    expect(el.hasAttribute('data-pui-a11y-actions')).toBe(false);
    el.remove();
  });

  it('projects alert role and assertive aria-live for assertive politeness', async () => {
    // T-BASE-LIVE-REGION-0001-CASE-ASSERTIVE
    const el = document.createElement('base-live-region-root');
    setElementProps(el, { politeness: 'assertive' });
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    el.remove();
  });

  it('projects aria-atomic false when atomic prop is false', async () => {
    // T-BASE-LIVE-REGION-0001-CASE-ATOMIC-FALSE
    const el = document.createElement('base-live-region-root');
    setElementProps(el, { atomic: false });
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.getAttribute('aria-atomic')).toBe('false');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    el.remove();
  });

  it('updates role, aria-live, and aria-atomic synchronously on mounted prop transitions', async () => {
    // T-BASE-LIVE-REGION-0001-CASE-DYNAMIC-SEMANTICS
    const el = document.createElement('base-live-region-root');
    document.body.appendChild(el);
    await Promise.resolve();

    setElementProps(el, { politeness: 'assertive', atomic: false });
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.getAttribute('aria-atomic')).toBe('false');

    setElementProps(el, { politeness: 'polite', atomic: true });
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    el.remove();
  });

  it('preserves authored child content as the announcement payload across prop transitions', async () => {
    // T-BASE-LIVE-REGION-0001-CASE-CONTENT-PRESERVATION
    const el = document.createElement('base-live-region-root');
    const text = document.createTextNode('3 new notifications');
    el.appendChild(text);
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.textContent).toBe('3 new notifications');

    setElementProps(el, { politeness: 'assertive' });
    await Promise.resolve();
    await Promise.resolve();
    expect(el.textContent).toBe('3 new notifications');
    expect(el.getAttribute('role')).toBe('alert');

    setElementProps(el, { politeness: 'polite', atomic: false });
    await Promise.resolve();
    await Promise.resolve();
    expect(el.textContent).toBe('3 new notifications');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-atomic')).toBe('false');
    el.remove();
  });
});
