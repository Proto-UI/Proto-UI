import { describe, expect, it } from 'vitest';
import { createWebA11yProjector } from '../src/web';

describe('module-a11y web projector', () => {
  it('rebinds heading role and level without leaving stale attributes', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    let target: HTMLElement | null = first;
    const project = createWebA11yProjector(() => target);

    project({
      role: 'heading',
      id: undefined,
      name: undefined,
      description: undefined,
      states: {},
      actions: {},
      relations: {},
      tree: undefined,
      level: 2,
    });
    expect(first.getAttribute('role')).toBe('heading');
    expect(first.getAttribute('aria-level')).toBe('2');

    target = null;
    project({
      role: 'heading',
      id: undefined,
      name: undefined,
      description: undefined,
      states: {},
      actions: {},
      relations: {},
      tree: undefined,
      level: 4,
    });
    expect(first.hasAttribute('role')).toBe(false);
    expect(first.hasAttribute('aria-level')).toBe(false);

    target = second;
    project({
      role: 'heading',
      id: undefined,
      name: undefined,
      description: undefined,
      states: {},
      actions: {},
      relations: {},
      tree: undefined,
      level: 4,
    });
    expect(second.getAttribute('role')).toBe('heading');
    expect(second.getAttribute('aria-level')).toBe('4');

    project({
      role: 'button',
      id: undefined,
      name: undefined,
      description: undefined,
      states: {},
      actions: {},
      relations: {},
      tree: undefined,
      level: 2,
    });
    expect(second.getAttribute('role')).toBe('button');
    expect(second.hasAttribute('aria-level')).toBe(false);

    project({
      role: 'heading',
      id: undefined,
      name: undefined,
      description: undefined,
      states: {},
      actions: {},
      relations: {},
      tree: undefined,
      level: 0,
    });
    expect(second.hasAttribute('aria-level')).toBe(false);

    project({
      role: 'heading',
      id: undefined,
      name: undefined,
      description: undefined,
      states: {},
      actions: {},
      relations: {},
      tree: undefined,
      level: 4,
    });
    expect(second.getAttribute('aria-level')).toBe('4');
  });

  it('preserves a host-owned aria-level when no coherent level was projected', () => {
    const target = document.createElement('div');
    target.setAttribute('aria-level', '7');
    const project = createWebA11yProjector(target);

    project({
      role: 'button',
      id: undefined,
      name: undefined,
      description: undefined,
      states: {},
      actions: {},
      relations: {},
      tree: undefined,
      level: undefined,
    });
    project.clearHeadingLevel?.();

    expect(target.getAttribute('aria-level')).toBe('7');
  });
});
