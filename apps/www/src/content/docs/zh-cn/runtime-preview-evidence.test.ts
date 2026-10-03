import { describe, expect, it } from 'vitest';
import { runtimePreviewEvidenceIssues, type RuntimePreviewPaint } from './runtime-preview-evidence';

function valid(family: 'shadcn' | 'brutalist' = 'shadcn'): RuntimePreviewPaint {
  return {
    family,
    surfaceCount: 1,
    surfaceWidth: 320,
    surfaceHeight: 192,
    tokens: [family === 'shadcn' ? 'rounded-xl' : 'rounded-base'],
    radius: Array(4).fill(family === 'shadcn' ? 12 : 5),
    expectedRadius: family === 'shadcn' ? 12 : 5,
    border: Array(4).fill(family === 'shadcn' ? 1 : 2),
    padding: [16, 16, 16, 16],
    expectedPadding: [16, 16, 16, 16],
    background: 'rgb(255, 255, 255)',
    shadow: 'none',
    ancestorPaint: [],
    hasRole: false,
    hasTabStop: false,
    pointerEvents: 'auto',
    contentContained: true,
    pageOverflow: 0,
  };
}
describe('RuntimeBox actual-paint evidence acceptance', () => {
  it.each(['shadcn', 'brutalist'] as const)('accepts one correct %s surface', (family) => {
    expect(runtimePreviewEvidenceIssues(valid(family))).toEqual([]);
  });
  const mutations: Array<[string, Partial<RuntimePreviewPaint>, string]> = [
    ['zero-size canvas', { surfaceWidth: 0 }, 'invalid canvas geometry'],
    ['unresolved CSS length', { radius: [NaN, NaN, NaN, NaN] }, 'wrong computed family radius'],
    ['nested surface', { surfaceCount: 2 }, 'one canvas surface required'],
    [
      'unsupported token despite apparent radius',
      { tokens: ['rounded-2xl'] },
      'wrong family radius token',
    ],
    [
      'token without computed translation',
      { radius: [0, 0, 0, 0] },
      'wrong computed family radius',
    ],
    ['wrong border paint', { border: [0, 0, 0, 0] }, 'wrong computed family border'],
    ['old hard ancestor frame', { ancestorPaint: ['prototype-card'] }, 'duplicate ancestor paint'],
    ['zeroed padding', { padding: [0, 0, 0, 0] }, 'wrong canvas padding'],
    ['transparent canvas', { background: 'rgba(0, 0, 0, 0)' }, 'missing canvas fill'],
    [
      'card elevation on canvas',
      { shadow: 'rgb(0, 0, 0) 4px 4px 0px 0px' },
      'canvas must remain flat',
    ],
    ['role theft', { hasRole: true }, 'surface took semantic ownership'],
    ['second tab stop', { hasTabStop: true }, 'surface took semantic ownership'],
    ['disabled subtree hit', { pointerEvents: 'none' }, 'surface blocks interactive slot'],
    ['content leak', { contentContained: false }, 'slot content exceeds canvas'],
    ['narrow page spill', { pageOverflow: 20 }, 'page horizontal overflow'],
  ];
  it.each(mutations)('rejects %s', (_name, patch, expected) => {
    expect(runtimePreviewEvidenceIssues({ ...valid(), ...patch })).toContain(expected);
  });
});
