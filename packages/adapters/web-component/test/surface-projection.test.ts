import { describe, expect, it } from 'vitest';
import { createHostSurfaceProjection } from '@proto.ui/adapter-base';

import { bindElementSurfaceProjection, setElementProps } from '../src';

describe('adapter-web-component surface projection', () => {
  it('migrates owned surface class and style without clobbering external values', () => {
    const boundary = document.createElement('x-surface-boundary');
    const first = document.createElement('div');
    const second = document.createElement('div');
    first.className = 'external';
    first.style.color = 'green';
    second.className = 'external-next shared';

    const projection = createHostSurfaceProjection<HTMLElement>(boundary, first);
    const unbind = bindElementSurfaceProjection(boundary, projection);
    setElementProps(boundary, {
      surfaceClassName: 'shared surface-a',
      surfaceStyle: { color: 'red', width: '100%' },
    });

    expect(first.classList.contains('external')).toBe(true);
    expect(first.classList.contains('shared')).toBe(true);
    expect(first.classList.contains('surface-a')).toBe(true);
    expect(first.style.color).toBe('red');
    expect(first.style.width).toBe('100%');

    projection.setSurfaceTarget(second);

    expect(first.className).toBe('external');
    expect(first.style.color).toBe('green');
    expect(first.style.width).toBe('');
    expect(second.classList.contains('external-next')).toBe(true);
    expect(second.classList.contains('shared')).toBe(true);
    expect(second.classList.contains('surface-a')).toBe(true);
    expect(second.style.color).toBe('red');
    expect(second.style.width).toBe('100%');

    setElementProps(boundary, {});
    expect(second.className).toBe('external-next shared');
    expect(second.style.color).toBe('');
    expect(second.style.width).toBe('');

    unbind();
  });
});
