import { describe, expect, it } from 'vitest';

import { classifyTwTokenApplicationRoleV0 } from '../../src/spec/feedback/application-role';

describe('feedback style application-role classification v0', () => {
  it.each(['field-sizing-auto', '-field-sizing-content', 'field-sizing-[content]'])(
    'does not claim canonical role support for %s',
    (token) => {
      expect(classifyTwTokenApplicationRoleV0(token).roleSource).toBe('fallback');
    }
  );
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
    'resize-none',
    'field-sizing-content',
    'field-sizing-fixed',
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
    'float-right',
    'align-top',
    'align-middle',
    'align-bottom',
  ])('classifies %s as a canonical placement token', (token) => {
    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role: 'placement',
      roleSource: 'canonical',
    });
  });

  it.each([
    'flex',
    'inline-flex',
    'grid',
    'inline-grid',
    'block',
    'inline-block',
    'table',
    'table-row',
    'table-cell',
    'table-caption',
  ])('classifies %s as a canonical composite token', (token) => {
    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role: 'composite',
      roleSource: 'canonical',
    });
  });

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

it('admits only the source-bound fractional and affine Root geometry additions', () => {
  for (const token of [
    'translate-x-0.25',
    'translate-x-[calc(100%_+_2px)]',
    'translate-x-[calc(100%_-_8px)]',
  ]) {
    expect(classifyTwTokenApplicationRoleV0(token)).toEqual({
      token,
      role: 'root-geometry',
      roleSource: 'canonical',
    });
  }
  for (const token of [
    'translate-x-0.5',
    '-translate-x-0.25',
    'translate-y-0.25',
    'translate-x-[calc(100%_+_3px)]',
    'translate-y-[calc(100%_-_8px)]',
  ]) {
    expect(classifyTwTokenApplicationRoleV0(token).role).toBe('unresolved');
  }
});

it('admits only the exact font-relative resident spacing token, independently of component identity', () => {
  expect(classifyTwTokenApplicationRoleV0('translate-x-5')).toEqual({
    token: 'translate-x-5',
    role: 'root-geometry',
    roleSource: 'canonical',
  });
  for (const token of [
    'translate-x-4',
    'translate-x-6',
    '-translate-x-5',
    'translate-y-5',
    'translate-x-[1.25rem]',
    'translate-y-[-50%]',
    'translate-x-5/0',
    'translate-x-5oops',
  ]) {
    expect(classifyTwTokenApplicationRoleV0(token).role).toBe('unresolved');
  }
});
