import { describe, expect, it } from 'vitest';

import {
  createSpecWorkspace,
  diffSpecSnapshots,
  getSpecReleases,
  getSpecSnapshot,
} from '@proto.ui/spec-engine';
import {
  compareSpecVersions,
  isSpecEntityActiveAt,
  validateSpecEntity,
} from '@proto.ui/spec-schema';

const draftRelease = {
  id: 'V-PROTO-UI-0001',
  type: 'version',
  title: 'Proto UI 0.2.0-rc.0',
  status: 'draft',
  since: '0.2.0-rc.0',
  release: {
    version: '0.2.0-rc.0',
    channel: 'prerelease',
    gitTag: 'v0.2.0-rc.0',
    npmDistTag: 'next',
    packageVersionPolicy: 'exact',
    packageScope: 'public-@proto.ui',
  },
};

describe('version release entities', () => {
  it('catalogs a draft prerelease as the workspace release source', () => {
    const entity = validateSpecEntity(draftRelease);
    const releases = getSpecReleases(createSpecWorkspace([entity]));

    expect(releases).toEqual([
      {
        entityId: 'V-PROTO-UI-0001',
        status: 'draft',
        version: '0.2.0-rc.0',
        channel: 'prerelease',
        gitTag: 'v0.2.0-rc.0',
        npmDistTag: 'next',
        packageVersionPolicy: 'exact',
        packageScope: 'public-@proto.ui',
        publishedAt: undefined,
        commit: undefined,
        specSnapshotDigest: undefined,
      },
    ]);
  });

  it('rejects release metadata on non-version entities', () => {
    expect(() =>
      validateSpecEntity({
        ...draftRelease,
        id: 'D-RELEASE-VERSION-0001',
        type: 'decision',
      })
    ).toThrow(/Only version entities may declare release metadata/);
  });

  it('requires publication evidence before a version becomes active', () => {
    expect(() => validateSpecEntity({ ...draftRelease, status: 'active' })).toThrow(
      /Active version entities must declare/
    );
  });

  it('requires the channel dist-tag declared by version governance', () => {
    expect(() =>
      validateSpecEntity({
        ...draftRelease,
        release: { ...draftRelease.release, npmDistTag: 'latest' },
      })
    ).toThrow(/npmDistTag must be next/);
  });

  it('keeps activation history separate from catalog introduction', () => {
    const entity = validateSpecEntity({
      id: 'P-LIFECYCLE-0001',
      type: 'prototype',
      title: 'Lifecycle fixture',
      status: 'active',
      since: '0.2.0',
      activeSince: '0.3.0',
    });

    expect(isSpecEntityActiveAt(entity, '0.2.0')).toBe(false);
    expect(isSpecEntityActiveAt(entity, '0.3.0')).toBe(true);
    expect(getSpecSnapshot(createSpecWorkspace([entity]), '0.2.0').entities).toHaveLength(1);
  });

  it('rejects activation history before catalog introduction', () => {
    expect(() =>
      validateSpecEntity({
        ...draftRelease,
        id: 'D-LIFECYCLE-0001',
        type: 'decision',
        activeSince: '0.1.0',
      })
    ).toThrow(/activeSince must not be earlier than since/);
  });

  it('preserves activation history through deprecation', () => {
    const entity = validateSpecEntity({
      id: 'D-LIFECYCLE-0003',
      type: 'decision',
      title: 'Deprecated lifecycle fixture',
      status: 'deprecated',
      since: '0.2.0',
      activeSince: '0.3.0',
      deprecatedSince: '0.4.0',
    });

    expect(isSpecEntityActiveAt(entity, '0.3.0')).toBe(true);
    expect(isSpecEntityActiveAt(entity, '0.4.0')).toBe(false);
  });

  it('rejects activation after a terminal lifecycle boundary', () => {
    expect(() =>
      validateSpecEntity({
        id: 'D-LIFECYCLE-0005',
        type: 'decision',
        title: 'Invalid lifecycle fixture',
        status: 'deprecated',
        since: '0.2.0',
        activeSince: '0.4.0',
        deprecatedSince: '0.3.0',
      })
    ).toThrow(/activeSince must precede terminal lifecycle boundaries/);
  });

  it('uses release publication evidence for Version active-at queries', () => {
    const entity = validateSpecEntity({
      ...draftRelease,
      status: 'active',
      release: {
        ...draftRelease.release,
        publishedAt: '2026-09-02T00:00:00Z',
        commit: 'a'.repeat(40),
        specSnapshotDigest: `sha256:${'a'.repeat(64)}`,
      },
    });

    expect(isSpecEntityActiveAt(entity, '0.2.0-rc.0')).toBe(true);
  });

  it('rejects activation history on Version entities', () => {
    expect(() =>
      validateSpecEntity({
        ...draftRelease,
        status: 'active',
        activeSince: '0.3.0',
        release: {
          ...draftRelease.release,
          publishedAt: '2026-09-02T00:00:00Z',
          commit: 'a'.repeat(40),
          specSnapshotDigest: 'a'.repeat(64),
        },
      })
    ).toThrow(/Version entities use release publication evidence/);
  });

  it('rejects activation history on a draft entity', () => {
    expect(() =>
      validateSpecEntity({
        ...draftRelease,
        id: 'D-LIFECYCLE-0002',
        type: 'decision',
        activeSince: '0.3.0',
      })
    ).toThrow(/Only lifecycle-complete entities may declare activeSince/);
  });

  it('reports activation-boundary crossings in snapshot diffs', () => {
    const active = validateSpecEntity({
      id: 'P-LIFECYCLE-0004',
      type: 'prototype',
      title: 'Diff lifecycle fixture',
      status: 'active',
      since: '0.2.0',
      activeSince: '0.3.0',
    });
    const before = getSpecSnapshot(createSpecWorkspace([active]), '0.2.0');
    const after = getSpecSnapshot(createSpecWorkspace([active]), '0.3.0');

    expect(diffSpecSnapshots(before, after).revised).toHaveLength(1);
  });

  it('sorts prerelease identifiers with semver precedence', () => {
    expect(compareSpecVersions('0.2.0-rc.10', '0.2.0-rc.2')).toBeGreaterThan(0);
    expect(compareSpecVersions('0.2.0-rc.1', '0.2.0-rc.1.1')).toBeLessThan(0);
    expect(compareSpecVersions('0.2.0-1', '0.2.0-rc.0')).toBeLessThan(0);
    expect(compareSpecVersions('0.2.0', '0.2.0-rc.10')).toBeGreaterThan(0);
  });
});
