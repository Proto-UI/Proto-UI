import { describe, expect, it } from 'vitest';
import {
  codeSurfaceOwnershipIssues,
  nativeCodeSelectionScrollTarget,
  nativeCodeSelectionHasGutter,
  codeSurfaceSettled,
  type CodeSurfaceGenerationFacts,
} from './code-surface-evidence';

function ready(): CodeSurfaceGenerationFacts {
  return {
    view: 'ready',
    runtime: 'react',
    family: 'shadcn',
    surfaceCount: 1,
    hosts: [
      {
        generation: '2',
        state: 'active',
        family: 'shadcn',
        runtime: 'react',
        inert: false,
        ariaHidden: null,
        pointerEvents: 'none',
      },
    ],
  };
}
describe('passive code-frame settled evidence', () => {
  it('accepts the exact committed frame only after all other generations retire', () => {
    expect(codeSurfaceSettled(ready(), 'react', 'shadcn')).toBe(true);
    const staging = ready();
    staging.hosts.push({
      ...staging.hosts[0],
      generation: '3',
      state: 'staging',
      inert: true,
      ariaHidden: 'true',
    });
    staging.surfaceCount++;
    expect(codeSurfaceOwnershipIssues(staging)).toEqual([]);
    expect(codeSurfaceSettled(staging, 'react', 'shadcn')).toBe(false);
  });
  it('rejects missing, duplicated, wrong-coordinate and not-ready frames', () => {
    for (const change of [
      (f: CodeSurfaceGenerationFacts) => {
        f.hosts = [];
      },
      (f: CodeSurfaceGenerationFacts) => {
        f.hosts.push({ ...f.hosts[0] });
      },
      (f: CodeSurfaceGenerationFacts) => {
        f.surfaceCount = 0;
      },
      (f: CodeSurfaceGenerationFacts) => {
        f.surfaceCount = 2;
      },
      (f: CodeSurfaceGenerationFacts) => {
        f.view = 'unavailable';
      },
      (f: CodeSurfaceGenerationFacts) => {
        f.hosts[0].family = 'brutalist';
      },
      (f: CodeSurfaceGenerationFacts) => {
        f.hosts[0].runtime = 'wc';
      },
      (f: CodeSurfaceGenerationFacts) => {
        f.hosts[0].generation = null;
      },
    ]) {
      const f = ready();
      change(f);
      expect(codeSurfaceSettled(f, 'react', 'shadcn')).toBe(false);
    }
  });
  it('rejects interactive passive paint and exposed staging hosts during replacement', () => {
    const f = ready();
    f.hosts[0].pointerEvents = 'auto';
    expect(codeSurfaceOwnershipIssues(f)).toContain('Passive code paint has pointer authority');
    f.hosts[0] = { ...f.hosts[0], pointerEvents: 'none', state: 'staging', inert: false };
    expect(codeSurfaceOwnershipIssues(f)).toContain('Uncommitted code generation is exposed');
  });
});

describe('native code selection preparation', () => {
  const facts = {
    token: { x: 119.8125, y: 530, width: 140.4375, height: 18 },
    pre: { left: 48, width: 224, scrollLeft: 0, scrollWidth: 620 },
  };
  it('moves the original edge-adjacent word into the scroll viewport center', () => {
    const target = nativeCodeSelectionScrollTarget(facts);
    expect(target).toBe(30.03125);
    expect(nativeCodeSelectionHasGutter(facts)).toBe(false);
    expect(
      nativeCodeSelectionHasGutter({
        ...facts,
        token: { ...facts.token, x: facts.token.x - target },
        pre: { ...facts.pre, scrollLeft: target },
      })
    ).toBe(true);
  });
  it('clamps the single wheel target to the real scroll range', () => {
    expect(nativeCodeSelectionScrollTarget({ ...facts, token: { ...facts.token, x: -100 } })).toBe(
      0
    );
    expect(nativeCodeSelectionScrollTarget({ ...facts, token: { ...facts.token, x: 1000 } })).toBe(
      396
    );
  });
  it('rejects words too wide or crossing either scroll edge without normalizing text', () => {
    for (const token of [
      { ...facts.token, x: 40 },
      { ...facts.token, x: 70, width: 220 },
    ])
      expect(nativeCodeSelectionHasGutter({ ...facts, token })).toBe(false);
  });
});

it('keeps decorative line numbers in the same horizontal flow as selectable code', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('apps/www/src/styles/global.css', 'utf8');
  const rule = css.match(/\.proto-previewer__code \.line::before\s*\{([^}]*)\}/)?.[1];
  expect(rule).toBeDefined();
  expect(rule).toContain('content: counter(code-line)');
  expect(rule).toContain('width: calc(var(--spacing) * 16)');
  expect(rule).toContain('padding-right: calc(var(--spacing) * 6)');
  expect(rule).toContain('user-select: none');
  expect(rule).toContain('pointer-events: none');
  expect(rule).not.toMatch(/\bposition:\s*(sticky|fixed|absolute)|\bz-index:|\bbackground:/);
});
