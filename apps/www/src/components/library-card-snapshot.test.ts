import { describe, it, expect } from 'vitest';
import { snapshotLibraryPart } from './library-card-snapshot';
import { librarySurfaceProps, libraryHeadingProps } from './library-card-prototypes';
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
