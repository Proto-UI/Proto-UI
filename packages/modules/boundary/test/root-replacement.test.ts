import { describe, expect, it } from 'vitest';
import { HOST_ELEMENT_CAP } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { BoundaryModuleImpl } from '../src/impl';
import { BOUNDARY_HOST_BRIDGE_CAP } from '../src/caps';

function fixture() {
  const frame = document.createElement('div');
  const surface = document.createElement('div');
  const trigger = document.createElement('button');
  frame.append(surface);
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, { ensureSetup() {} } as any]]);
  caps.attach([
    [HOST_ELEMENT_CAP, frame],
    [
      BOUNDARY_HOST_BRIDGE_CAP,
      {
        classify: ({ regions, sample }: any) =>
          regions.some((region: any) => region.target.contains(sample.target))
            ? 'inside'
            : 'outside',
      },
    ],
  ]);
  const boundary = new BoundaryModuleImpl(caps, 'root-replacement', {
    getGlobalInputScope: () => null,
  } as any);
  boundary.registerRegion(trigger, { role: 'anchor' });
  return { boundary, frame, surface, trigger };
}

describe('painted implicit-root replacement', () => {
  it('replaces frame in both exact and descendant classification while preserving explicit anchor', () => {
    const { boundary, frame, surface, trigger } = fixture();
    expect(boundary.classify({ target: frame })).toBe('inside');
    const release = boundary.replaceImplicitRoot(surface);
    expect(boundary.getRegions().map((region) => region.target)).toEqual([surface, trigger]);
    expect(boundary.classify({ target: frame })).toBe('outside');
    const child = document.createElement('span');
    surface.append(child);
    expect(boundary.classify({ target: surface })).toBe('inside');
    expect(boundary.classify({ target: child })).toBe('inside');
    expect(boundary.classify({ target: trigger })).toBe('inside');
    release();
    expect(boundary.classify({ target: frame })).toBe('inside');
  });
  it('old releases cannot revoke a replacement; null explicitly suppresses the implicit region', () => {
    const { boundary, frame, surface, trigger } = fixture();
    const previous = boundary.replaceImplicitRoot(surface);
    const current = boundary.replaceImplicitRoot(null);
    previous();
    expect(boundary.getRegions().map((region) => region.target)).toEqual([trigger]);
    expect(boundary.classify({ target: frame })).toBe('outside');
    current();
    current();
    expect(boundary.classify({ target: frame })).toBe('inside');
  });
  it.each(['unmounting', 'detached'] as const)(
    'clears view-owned substitution on %s, without retaining old disposer authority',
    (phase) => {
      const { boundary, frame, surface } = fixture();
      const old = boundary.replaceImplicitRoot(surface);
      boundary.onMountPhase(phase, 1);
      expect(boundary.getRegions()[0]?.target).toBe(frame);
      boundary.replaceImplicitRoot(null);
      old();
      expect(boundary.getRegions().some((region) => region.target === frame)).toBe(false);
    }
  );
});
