import { describe, expect, it } from 'vitest';
import { createA11ySemanticObjectRef, type A11ySemanticObjectSnapshot } from '@proto.ui/core';
import { createWebA11yProjector } from '../src/web';

function snapshot(states: Record<string, unknown>): A11ySemanticObjectSnapshot {
  return {
    objectRef: createA11ySemanticObjectRef(),
    role: 'slider',
    states,
    actions: {},
    relations: {},
  };
}

describe('portable range accessibility projection', () => {
  it('projects zero, negative and fractional range facts and restores the host on release', () => {
    const target = document.createElement('div');
    target.setAttribute('aria-valuenow', 'host-owned');
    const project = createWebA11yProjector(target);
    const state = snapshot({ valueMin: -10.5, valueMax: 10.5, valueNow: 0, valueText: 'Zero' });
    project(state);
    expect(target.getAttribute('aria-valuemin')).toBe('-10.5');
    expect(target.getAttribute('aria-valuemax')).toBe('10.5');
    expect(target.getAttribute('aria-valuenow')).toBe('0');
    expect(target.getAttribute('aria-valuetext')).toBe('Zero');
    project({ ...state, states: { valueMin: -10.5, valueMax: 10.5, valueNow: 2.25 } });
    expect(target.getAttribute('aria-valuenow')).toBe('2.25');
    expect(target.hasAttribute('aria-valuetext')).toBe(false);
    project.dispose?.();
    expect(target.getAttribute('aria-valuenow')).toBe('host-owned');
    expect(target.hasAttribute('aria-valuemin')).toBe(false);
    expect(target.hasAttribute('aria-valuemax')).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity, '10', true, {}, []])(
    'withdraws malformed numeric range fact %j',
    (value) => {
      const target = document.createElement('div');
      const project = createWebA11yProjector(target);
      const state = snapshot({ valueMin: 0, valueMax: 100, valueNow: 25, valueText: '25 percent' });
      project(state);
      project({
        ...state,
        states: { valueMin: value, valueMax: value, valueNow: value, valueText: 25 },
      });
      for (const key of ['min', 'max', 'now', 'text'])
        expect(target.hasAttribute(`aria-value${key}`)).toBe(false);
      project.dispose?.();
    }
  );

  it('withdraws indeterminate values and transfers only current facts to a replacement target', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    let target: HTMLElement | null = first;
    const project = createWebA11yProjector(() => target);
    const state = snapshot({ valueMin: 0, valueMax: 100, valueNow: 30 });
    project(state);
    target = second;
    project({ ...state, role: 'progressbar', states: { valueMin: 0, valueMax: 100 } });
    expect(first.hasAttribute('aria-valuenow')).toBe(false);
    expect(second.getAttribute('aria-valuemax')).toBe('100');
    expect(second.hasAttribute('aria-valuenow')).toBe(false);
    project.dispose?.();
  });
});
