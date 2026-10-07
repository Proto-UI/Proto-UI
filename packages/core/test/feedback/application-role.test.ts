import { describe, expect, it } from 'vitest';

import { classifyTwTokenApplicationRoleV0 } from '../../src/spec/feedback/application-role';

describe('feedback style application-role classification v0', () => {
  it.each([
    'bg-primary',
    'border-ring',
    'rounded-md',
    'shadow-sm',
    'px-3',
    'flex-row',
    'items-center',
    'justify-between',
    'gap-2',
    'opacity-50',
    'group/button',
    'peer',
    'resize-y',
    'underline-offset-4',
    'uppercase',
    'whitespace-nowrap',
  ])('classifies %s as a canonical surface token', (token) => {
    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role: 'surface',
      roleSource: 'canonical',
    });
  });

  it.each([
    'order-2',
    'self-start',
    'grow',
    'shrink-0',
    'basis-1/2',
    'flex-1',
    'mt-2',
    '-ml-1',
    'absolute',
    'fixed',
    'inset-0',
    '-left-1/2',
    'z-40',
    'w-full',
    'min-h-28',
    'size-5',
  ])('classifies %s as a canonical placement token', (token) => {
    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role: 'placement',
      roleSource: 'canonical',
    });
  });

  it.each(['flex', 'inline-flex', 'grid', 'inline-grid', 'block', 'inline-block'])(
    'classifies %s as a canonical composite token',
    (token) => {
      expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
        token,
        role: 'composite',
        roleSource: 'canonical',
      });
    }
  );

  it.each([
    'invisible',
    'visible',
    'overflow-auto',
    'pointer-events-auto',
    'translate-x-2',
    '-translate-x-1/3',
    'scale-[0.97]',
    'will-change-contents',
  ])('keeps %s unresolved instead of guessing a target', (token) => {
    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role: 'unresolved',
      roleSource: 'unresolved',
    });
  });

  it('falls an unknown extension token back to surface without claiming it is canonical', () => {
    expect(classifyTwTokenApplicationRoleV0('theme-accent-strong')).toEqual({
      token: 'theme-accent-strong',
      role: 'surface',
      roleSource: 'fallback',
    });
  });

  it('preserves the exact raw token and does not parse public role qualifiers', () => {
    const token = 'surface:translate-x-2';

    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role: 'surface',
      roleSource: 'fallback',
    });
  });
});
