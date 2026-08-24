import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SPEC_DIR = path.join(process.cwd(), 'spec');
const RADIO_GROUP_ENTITIES = [
  'P-BASE-RADIO-GROUP',
  'P-BASE-RADIO-GROUP-ITEM',
  'P-BASE-RADIO-GROUP-INDICATOR',
  'T-BASE-RADIO-GROUP-0001',
  'T-BASE-RADIO-GROUP-ITEM-0001',
  'T-BASE-RADIO-GROUP-INDICATOR-0001',
] as const;

describe('Radio Group release-history boundary', () => {
  it('keeps the active rc.7 snapshot identity immutable and introduces Radio Group in 0.3', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(SPEC_DIR);
    expect(workspace.issues).toEqual([]);

    const rc7 = workspace.entities.find((entity) => entity.id === 'V-PROTO-UI-0007');
    expect(rc7?.status).toBe('active');
    expect(rc7?.release?.commit).toBe('692a6cfa30eae3049017d3c2b9e86d7f216e2176');
    expect(rc7?.release?.specSnapshotDigest).toBe(
      'sha256:0f8c6f66092ce92b064ef828f37ba121aad7a89909e7aee1c3b8c2a3267681d7'
    );

    for (const id of RADIO_GROUP_ENTITIES) {
      const entity = workspace.entities.find((candidate) => candidate.id === id);
      expect(entity, id).toBeDefined();
      expect(entity?.since, id).toBe('0.3.0-alpha.0');
      expect(
        entity?.revisions?.map((revision) => revision.version),
        id
      ).toEqual(['0.3.0-alpha.0']);
    }
  });
});
