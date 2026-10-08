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

it('negative control: replacing the public source removes its projected paint', async () => {
  const { libraryCardPrototypes } = await import('./library-card-prototypes');
  const source = libraryCardPrototypes['shadcn-surface'];
  try {
    libraryCardPrototypes['shadcn-surface'] = libraryCardPrototypes['base-surface'];
    expect(await snapshotLibraryPart('shadcn-surface', librarySurfaceProps)).toEqual([]);
  } finally {
    libraryCardPrototypes['shadcn-surface'] = source;
  }
  expect(await snapshotLibraryPart('shadcn-surface', librarySurfaceProps)).toContain('rounded-xl');
});
