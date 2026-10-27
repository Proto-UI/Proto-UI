import { describe, it, expect } from 'vitest';
import { snapshotLibraryPart } from './library-card-snapshot';
import { librarySurfaceProps, libraryHeadingProps } from './library-card-prototypes';
import { libraryActionAppearanceForFamily } from './library-card-prototypes';
import { renderSnapshotTokenCss } from './snapshot-prototype-style';

// Independent declaration expectations: public Rhea action profile, based on
// shadcn-ui/ui 96da9cc7 style-rhea.css (rounded-2xl, primary/80 hover,
// focus ring-3, active translate-y-px), realized by the passive Surface contract.
// This consumes actual projected CSS; it does not compare the helper to itself
// or claim browser cascade/geometry from HappyDOM.
it.each([
  ['rest', {}, 'background-color: var(--pui-primary);'],
  ['hover', { hovered: true }, 'color-mix(in oklab, var(--pui-primary) 80%, transparent)'],
  ['focus', { focusVisible: true }, '--pui-ring-width: 3px;'],
  ['press', { pressed: true }, '--pui-translate-y: 1px;'],
] as const)('projects independently expected Rhea %s CSS', async (_name, facts, declaration) => {
  const action = libraryActionAppearanceForFamily('shadcn');
  const tokens = await snapshotLibraryPart('shadcn-surface', { ...action.surface, ...facts });
  const css = renderSnapshotTokenCss(tokens);
  expect(css).toContain('border-radius: var(--pui-radius-2xl);');
  expect(css).toContain('color: var(--pui-primary-foreground);');
  if (!('focusVisible' in facts)) expect(css).toContain('border-color: transparent;');
  expect(css).not.toContain('0 1px 2px');
  expect(css).toContain(declaration);
  if ('focusVisible' in facts) {
    expect(css).toContain('border-color: var(--pui-ring);');
    expect(css).toContain('outline: 2px solid transparent;');
    expect(css).toContain('outline-color: Highlight');
  }
  if (!('pressed' in facts)) expect(css).not.toContain('--pui-translate-y: 1px;');
  if (!('focusVisible' in facts)) expect(css).not.toContain('--pui-ring-width: 3px;');
});
it('projects the consumer action label typography as independent Rhea CSS', async () => {
  const action = libraryActionAppearanceForFamily('shadcn');
  const css = renderSnapshotTokenCss(await snapshotLibraryPart('shadcn-text', { ...action.text }));
  // Public text-sm / leading-5 / font-medium: 14px / 20px at a 16px root.
  expect(css).toContain('font-size: 0.875rem;');
  expect(css).toContain('line-height: 1.25rem;');
  expect(css).toContain('font-weight: 500;');
  expect(css).toContain('color: inherit;');
});

it('retains observable non-Shadcn action Surface outputs', async () => {
  for (const [family, radius] of [
    ['base', null],
    ['brutalist', 'var(--pui-radius)'],
    ['bootstrap-2-3-2', '4px'],
    ['liquid-glass', '0'],
  ] as const) {
    const action = libraryActionAppearanceForFamily(family);
    const tokens = await snapshotLibraryPart(`${family}-surface`, { ...action.surface });
    const css = renderSnapshotTokenCss(tokens);
    if (radius === null) expect(tokens).toEqual([]);
    else expect(css).toContain(`border-radius: ${radius};`);
    expect(css).not.toContain('border-radius: var(--pui-radius-2xl);');
  }
});

describe('library entry real Prototype first-frame projection', () => {
  it('keeps Base truly unstyled and renders the governed Brutalist Card', async () => {
    expect(await snapshotLibraryPart('base-surface', librarySurfaceProps)).toEqual([]);
    expect(await snapshotLibraryPart('brutalist-card', {})).toContain('shadow-[4px_4px_0_0_#000]');
  });
  it('evaluates public inputs rather than hand-copying a skin', async () => {
    expect(await snapshotLibraryPart('shadcn-surface', librarySurfaceProps)).toContain(
      'rounded-xl'
    );
    expect(
      await snapshotLibraryPart('shadcn-surface', { ...librarySurfaceProps, radius: 'none' })
    ).toContain('rounded-none');
    expect(await snapshotLibraryPart('bootstrap-2-3-2-surface', librarySurfaceProps)).toContain(
      'rounded-[4px]'
    );
    expect(await snapshotLibraryPart('shadcn-text', libraryHeadingProps)).toContain('text-2xl');
  });
});

it('negative control: a source registry without Shadcn cannot retain its paint', async () => {
  const { libraryCardPrototypes } = await import('./library-card-prototypes');
  const { createStyleSnapshotter, renderSnapshotTokenCss } =
    await import('./snapshot-prototype-style');
  const altered = createStyleSnapshotter({
    ...libraryCardPrototypes,
    'shadcn-surface': libraryCardPrototypes['base-surface'],
  });
  expect(await altered('shadcn-surface', librarySurfaceProps)).toEqual([]);
  expect(await snapshotLibraryPart('shadcn-surface', librarySurfaceProps)).toContain('rounded-xl');
  // A later part must not reset earlier Surface shadow/transform/ring state.
  const css = renderSnapshotTokenCss(await snapshotLibraryPart('brutalist-card', {}));
  expect(css).not.toContain('--pui-shadow: initial');
  expect(css).not.toContain('--pui-translate-x: initial');
  expect(css).toContain('4px');
});

// P-BRUTALIST-CARD-ROOT-VISUAL (draft), neobrutalism-components 3306a802:
// nested Text must preserve the selected Card's medium body weight.
it('keeps body and caption weights family-specific without normalizing typography', async () => {
  const { libraryBodyPropsForFamily, libraryCaptionPropsForFamily } =
    await import('./library-card-prototypes');
  for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const) {
    for (const props of [libraryBodyPropsForFamily(family), libraryCaptionPropsForFamily(family)]) {
      const tokens = await snapshotLibraryPart(`${family}-text`, props);
      expect(tokens.filter((token) => /^font-(normal|medium|semibold|bold)$/.test(token))).toEqual([
        family === 'brutalist' ? 'font-medium' : 'font-normal',
      ]);
    }
  }
  expect(libraryBodyPropsForFamily('base')).toEqual({ size: 'base', leading: 'relaxed' });
  expect(libraryBodyPropsForFamily('bootstrap-2-3-2')).toEqual({ size: 'sm', leading: 'normal' });
});

// T-SHADCN-CARD-0001-CASE-4
it('dogfoods Card-specific SSR tokens and retains inherited title/body ink', async () => {
  const { libraryBodyPropsForFamily, libraryCaptionPropsForFamily, shadcnLibraryHeadingProps } =
    await import('./library-card-prototypes');
  const { renderSnapshotTokenCss, createStyleSnapshotter } =
    await import('./snapshot-prototype-style');
  const { libraryCardPrototypes } = await import('./library-card-prototypes');
  const tokens = await snapshotLibraryPart('shadcn-card', {});
  expect(tokens).toContain('bg-card');
  expect(tokens).toContain('text-card-foreground');
  expect(tokens).not.toContain('bg-background');
  expect(tokens).not.toContain('text-foreground');
  const css = renderSnapshotTokenCss(tokens);
  expect(css).toContain('background-color: var(--pui-card)');
  expect(css).toContain('color: var(--pui-card-foreground)');
  for (const props of [shadcnLibraryHeadingProps, libraryBodyPropsForFamily('shadcn')]) {
    const text = await snapshotLibraryPart('shadcn-text', props);
    expect(text).toContain('text-inherit');
    expect(text).not.toContain('text-foreground');
  }
  expect(
    await snapshotLibraryPart('shadcn-text', libraryCaptionPropsForFamily('shadcn'))
  ).toContain('text-muted-foreground');
  const removed = createStyleSnapshotter({
    ...libraryCardPrototypes,
    'shadcn-card': libraryCardPrototypes['base-surface'],
  });
  expect(await removed('shadcn-card', {})).toEqual([]);
  // Neutral Surface remains distinct from the Card contract.
  expect(await snapshotLibraryPart('shadcn-surface', librarySurfaceProps)).not.toContain('bg-card');
});

it('projects explicit Card style per isolated snapshot without retaining the prior choice', async () => {
  const rhea = await snapshotLibraryPart('shadcn-card', { styleProfile: 'rhea' });
  expect(rhea).toContain('ring-1');
  expect(rhea).toContain('py-5');
  expect(rhea).not.toContain('py-6');
  const inherited = await snapshotLibraryPart('shadcn-card', {});
  expect(inherited).toContain('py-6');
  expect(inherited).not.toContain('ring-1');
  await expect(snapshotLibraryPart('shadcn-card', { styleProfile: 'nova' })).rejects.toThrow(
    'Unsupported style'
  );
});
