import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import { describe, expect, it } from 'vitest';

describe('spec workspace relations', () => {
  it('validates implementation exercise targets even for required planned evidence', async () => {
    const specDir = await mkdtemp(path.join(os.tmpdir(), 'proto-ui-spec-exercise-targets-'));

    try {
      await writeFile(
        path.join(specDir, 'P-FUTURE.yaml'),
        JSON.stringify({
          id: 'P-FUTURE',
          type: 'prototype',
          title: 'Future prototype',
          status: 'draft',
          since: '0.3.0',
        })
      );
      await writeFile(
        path.join(specDir, 'V-TARGET-0001.yaml'),
        JSON.stringify({
          id: 'V-TARGET-0001',
          type: 'version',
          title: 'Future release',
          status: 'draft',
          since: '0.3.0',
          release: {
            version: '0.3.0',
            channel: 'stable',
            gitTag: 'v0.3.0',
            npmDistTag: 'latest',
            packageVersionPolicy: 'exact',
            packageScope: 'public-@proto.ui',
          },
        })
      );
      const sourcePath = path.join(specDir, 'T-SOURCE-0001.yaml');
      const source = {
        id: 'T-SOURCE-0001',
        type: 'test',
        title: 'Planned evidence',
        status: 'draft',
        since: '0.1.0',
        implementations: [
          {
            id: 'runtime',
            kind: 'runtime-test',
            status: 'planned',
            required: true,
            exercises: ['P-FUTURE'],
          },
        ],
      };
      await writeFile(sourcePath, JSON.stringify(source));
      expect((await loadSpecWorkspaceFromDirectory(specDir)).issues).toEqual([]);

      source.implementations[0].exercises.push('P-MISSING', 'P-FUTUER', 'V-TARGET-0001');
      await writeFile(sourcePath, JSON.stringify(source));
      expect((await loadSpecWorkspaceFromDirectory(specDir)).issues).toEqual([
        {
          filePath: sourcePath,
          message:
            'T-SOURCE-0001 implementation runtime exercises target does not exist: P-MISSING.',
        },
        {
          filePath: sourcePath,
          message:
            'T-SOURCE-0001 implementation runtime exercises target does not exist: P-FUTUER.',
        },
        {
          filePath: sourcePath,
          message:
            'T-SOURCE-0001 implementation runtime exercises target V-TARGET-0001 is version, expected ordinary entity.',
        },
      ]);
    } finally {
      await rm(specDir, { recursive: true, force: true });
    }
  });

  it('validates criterion-level dependency target types', async () => {
    const specDir = await mkdtemp(path.join(os.tmpdir(), 'proto-ui-spec-relations-'));

    try {
      await writeFile(
        path.join(specDir, 'D-VALID-0001.yaml'),
        [
          'id: D-VALID-0001',
          'type: decision',
          'title: Valid decision',
          'status: active',
          'since: 0.1.0',
          'criteria: []',
          '',
        ].join('\n')
      );
      await writeFile(
        path.join(specDir, 'P-VALID.yaml'),
        [
          'id: P-VALID',
          'type: prototype',
          'title: Valid prototype',
          'status: draft',
          'since: 0.1.0',
          'criteria:',
          '  - id: P-VALID-CRITERION',
          '    text: Criterion with wrong relation type.',
          '    dependsOn:',
          '      contracts:',
          '        - D-VALID-0001',
          '',
        ].join('\n')
      );

      const workspace = await loadSpecWorkspaceFromDirectory(specDir);

      expect(workspace.issues).toEqual([
        {
          filePath: path.join(specDir, 'P-VALID.yaml'),
          message:
            'P-VALID-CRITERION dependsOn.contracts target D-VALID-0001 is decision, expected contract.',
        },
      ]);
    } finally {
      await rm(specDir, { recursive: true, force: true });
    }
  });

  it('validates criterion-level reference target types', async () => {
    const specDir = await mkdtemp(path.join(os.tmpdir(), 'proto-ui-spec-references-'));

    try {
      await writeFile(
        path.join(specDir, 'D-VALID-0001.yaml'),
        [
          'id: D-VALID-0001',
          'type: decision',
          'title: Valid decision',
          'status: active',
          'since: 0.1.0',
          'criteria: []',
          '',
        ].join('\n')
      );
      await writeFile(
        path.join(specDir, 'P-VALID.yaml'),
        [
          'id: P-VALID',
          'type: prototype',
          'title: Valid prototype',
          'status: draft',
          'since: 0.1.0',
          'criteria:',
          '  - id: P-VALID-CRITERION',
          '    text: Criterion with wrong reference type.',
          '    references:',
          '      prototypes:',
          '        - D-VALID-0001',
          '',
        ].join('\n')
      );

      const workspace = await loadSpecWorkspaceFromDirectory(specDir);

      expect(workspace.issues).toEqual([
        {
          filePath: path.join(specDir, 'P-VALID.yaml'),
          message:
            'P-VALID-CRITERION references.prototypes target D-VALID-0001 is decision, expected prototype.',
        },
      ]);
    } finally {
      await rm(specDir, { recursive: true, force: true });
    }
  });

  it('validates criterion-level relation anchors against target criteria', async () => {
    const specDir = await mkdtemp(path.join(os.tmpdir(), 'proto-ui-spec-anchor-relations-'));

    try {
      await writeFile(
        path.join(specDir, 'P-TARGET.yaml'),
        [
          'id: P-TARGET',
          'type: prototype',
          'title: Target prototype',
          'status: draft',
          'since: 0.1.0',
          'criteria:',
          '  - id: P-TARGET-KNOWN',
          '    text: Known target criterion.',
          '',
        ].join('\n')
      );
      await writeFile(
        path.join(specDir, 'P-SOURCE.yaml'),
        [
          'id: P-SOURCE',
          'type: prototype',
          'title: Source prototype',
          'status: draft',
          'since: 0.1.0',
          'criteria:',
          '  - id: P-SOURCE-CRITERION',
          '    text: Criterion with one valid and one invalid reference anchor.',
          '    references:',
          '      prototypes:',
          '        - id: P-TARGET',
          '          anchors:',
          '            - P-TARGET-KNOWN',
          '            - P-TARGET-MISSING',
          '',
        ].join('\n')
      );

      const workspace = await loadSpecWorkspaceFromDirectory(specDir);

      expect(workspace.issues).toEqual([
        {
          filePath: path.join(specDir, 'P-SOURCE.yaml'),
          message:
            'P-SOURCE-CRITERION references.prototypes relation to P-TARGET anchors unknown criterion P-TARGET-MISSING.',
        },
      ]);
    } finally {
      await rm(specDir, { recursive: true, force: true });
    }
  });
});
