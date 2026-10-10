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

  it.each([NaN, Infinity, -Infinity, 'ten', true, {}, []])(
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

describe('nullable range readout string representation', () => {
  it.each(['0', '-0', '-2.5', '1.25', '1e-7', '1E+3'])(
    'projects finite decimal numeric text %s',
    (value) => {
      const target = document.createElement('div');
      const project = createWebA11yProjector(target);
      project(snapshot({ valueNow: value }));
      expect(target.getAttribute('aria-valuenow')).toBe(value);
      project.dispose?.();
    }
  );
  it.each([
    '',
    ' ',
    ' 0',
    '0 ',
    'NaN',
    'Infinity',
    '-Infinity',
    '1e309',
    '0x10',
    '01',
    '+1',
    'text',
  ])('withdraws non-decimal or indeterminate numeric text %j', (value) => {
    const target = document.createElement('div');
    const project = createWebA11yProjector(target);
    const state = snapshot({ valueNow: '10' });
    project(state);
    project({ ...state, states: { valueNow: value } });
    expect(target.hasAttribute('aria-valuenow')).toBe(false);
    project.dispose?.();
  });
});

describe('collection position accessibility facts', () => {
  it('projects tree depth and set position while retaining explicit heading-level ownership', () => {
    const target = document.createElement('div');
    const project = createWebA11yProjector(target);
    const state = snapshot({ level: 2, posInSet: 3, setSize: -1 });
    project({ ...state, role: 'treeitem' });
    expect(target.getAttribute('aria-level')).toBe('2');
    expect(target.getAttribute('aria-posinset')).toBe('3');
    expect(target.getAttribute('aria-setsize')).toBe('-1');
    project({ ...state, role: 'heading', level: 4 });
    expect(target.getAttribute('aria-level')).toBe('4');
    project.dispose?.();
  });
  it.each([0, -2, 1.5, Infinity, '2'])('rejects invalid positive set/depth fact %j', (value) => {
    const target = document.createElement('div');
    const project = createWebA11yProjector(target);
    project({ ...snapshot({ level: value, posInSet: value, setSize: value }), role: 'treeitem' });
    for (const attribute of ['aria-level', 'aria-posinset', 'aria-setsize'])
      expect(target.hasAttribute(attribute)).toBe(false);
    project.dispose?.();
  });
});
