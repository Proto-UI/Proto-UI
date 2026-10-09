import { expect } from 'vitest';

export function assertChildStyleProjection(target: string, data: Record<string, unknown>) {
  // Issue #788 added the PUI carrier to ordinary Adapter Template nodes while
  // retaining their class compatibility output. Check both channels separately:
  // class-only paint must not conceal a missing production CSS carrier.
  expect(data.childProjection, `${target}: Template style carrier`).toBe('data-pui-style');
  expect(data.childTokens, `${target}: Template carrier tokens`).toEqual(['bg-yellow-500', 'p-2']);
  expect(data.childClassTokens, `${target}: Template compatibility classes`).toEqual(
    target === 'reference' || target === 'runtime' ? ['bg-yellow-500', 'p-2'] : []
  );
}
