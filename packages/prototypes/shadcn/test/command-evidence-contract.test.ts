// @vitest-environment node
import { expect, it } from 'vitest';
import { renderPrefixedThemeCss } from '../../../cli/src/services/proto-style-css';
import {
  assertCommandEvidenceShell,
  type CommandEvidenceShellObservation,
} from '../../../../scripts/prototypes/shadcn-command-evidence-oracle';

const recipes = [
  { style: 'new-york-v4', type: 'command', radius: '0px', height: 40, border: '0px' },
  { style: 'new-york-v4', type: 'input', radius: '8px', height: 36, border: '1px' },
  { style: 'rhea', type: 'command', radius: '18px', height: 32, border: '1px' },
  { style: 'rhea', type: 'input', radius: '18px', height: 32, border: '1px' },
] as const;
const observation = (recipe: (typeof recipes)[number]): CommandEvidenceShellObservation => ({
  kind: 'wc',
  type: recipe.type,
  theme: {
    rootFontSize: '16px',
    rootRadiusToken: '0.625rem',
    mdRadiusToken: 'max(calc(0.625rem - 2px), 0px)',
  },
  input: { border: '0px', radius: '0px', font: '14px' },
  shell: { radius: recipe.radius, height: recipe.height, border: recipe.border },
});

it('binds both New York shell measurements to the fixed 10px fixture radius, not the old 8px theme', () => {
  const css = renderPrefixedThemeCss(':root{--radius:0.625rem;}');
  expect(css).toContain('--pui-radius:0.625rem;');
  expect(css).toContain('--pui-radius-md: max(calc(var(--pui-radius) - 2px), 0px);');
  expect(0.625 * 16 - 2).toBe(8);
  expect(0.5 * 16 - 2).toBe(6);
  for (const recipe of recipes.filter((r) => r.style === 'new-york-v4')) {
    const row = observation(recipe);
    expect(() => assertCommandEvidenceShell(row, recipe.style)).not.toThrow();
    expect(() =>
      assertCommandEvidenceShell({ ...row, shell: { ...row.shell, radius: '6px' } }, recipe.style)
    ).toThrow('passive shell radius');
    expect(() =>
      assertCommandEvidenceShell(
        { ...row, theme: { ...row.theme, rootRadiusToken: '0.5rem' } },
        recipe.style
      )
    ).toThrow('fixed radius token');
  }
});

// These are corrupt observation controls for the collector's actual oracle,
// not measurements of layout. The real four-runtime app/native journeys are
// separately required by T-SHADCN-INPUT-SHELL-0001-CASE-NATIVE.
it.each(recipes)('distinguishes $style/$type geometry and rejects the wrong owner recipe', (recipe) => {
  const row = observation(recipe);
  expect(() => assertCommandEvidenceShell(row, recipe.style)).not.toThrow();
  expect(() =>
    assertCommandEvidenceShell(
      { ...row, shell: { ...row.shell, radius: recipe.radius === '8px' ? '0px' : '8px' } },
      recipe.style
    )
  ).toThrow('passive shell radius');
  expect(() =>
    assertCommandEvidenceShell(
      { ...row, shell: { ...row.shell, height: recipe.height === 36 ? 40 : 36 } },
      recipe.style
    )
  ).toThrow('passive shell height');
  expect(() =>
    assertCommandEvidenceShell(
      { ...row, shell: { ...row.shell, border: recipe.border === '0px' ? '1px' : '0px' } },
      recipe.style
    )
  ).toThrow('passive shell border');
});
