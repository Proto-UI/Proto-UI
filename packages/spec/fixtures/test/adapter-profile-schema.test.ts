import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import { validateSpecEntity } from '@proto.ui/spec-schema';
import { describe, expect, it } from 'vitest';

const baseAdapter = {
  id: 'A-REACT-18-19-0001',
  type: 'adapter' as const,
  title: 'React adapter profile',
  status: 'draft' as const,
  since: '0.2.0-rc.7',
  adapterProfile: {
    package: '@proto.ui/adapter-react',
    target: {
      platform: 'web',
      runtime: { name: 'react', versionRange: '>=18.2.0 <20' },
    },
  },
  supports: {
    modules: [{ id: 'M-PROPS-0001', role: 'required-module' as const }],
  },
  provides: {
    hostCaps: [{ id: 'HC-PROPS-SOURCE-0001', role: 'translated-capability' as const }],
  },
};

describe('adapter profile schema', () => {
  it('accepts an Adapter identity with target metadata and capability relations', () => {
    const entity = validateSpecEntity(baseAdapter);

    expect(entity.adapterProfile).toEqual(baseAdapter.adapterProfile);
    expect(entity.supports?.modules?.[0]?.role).toBe('required-module');
    expect(entity.provides?.hostCaps?.[0]?.role).toBe('translated-capability');
  });

  it('requires adapterProfile metadata on Adapter entities', () => {
    const { adapterProfile: _adapterProfile, ...withoutProfile } = baseAdapter;

    expect(() => validateSpecEntity(withoutProfile)).toThrow(
      'Adapter entities must declare adapterProfile metadata.'
    );
  });

  it('keeps supported and omitted Module decisions disjoint', () => {
    expect(() =>
      validateSpecEntity({
        ...baseAdapter,
        omits: {
          modules: [{ id: 'M-PROPS-0001', role: 'unsupported-module' }],
        },
      })
    ).toThrow('Adapter module M-PROPS-0001 cannot be both supported and omitted.');
  });

  it('requires relation roles that explain support and capability honesty', () => {
    expect(() =>
      validateSpecEntity({
        ...baseAdapter,
        supports: { modules: ['M-PROPS-0001'] },
      })
    ).toThrow('must declare one of: required-module');
  });

  it('validates adapters relation targets in a loaded workspace', async () => {
    const specDir = await mkdtemp(path.join(os.tmpdir(), 'proto-ui-adapter-relations-'));

    try {
      await writeFile(
        path.join(specDir, 'D-NOT-ADAPTER-0001.yaml'),
        [
          'id: D-NOT-ADAPTER-0001',
          'type: decision',
          'title: Not an Adapter',
          'status: draft',
          'since: 0.2.0-rc.7',
          '',
        ].join('\n')
      );
      await writeFile(
        path.join(specDir, 'T-ADAPTER-0001.yaml'),
        [
          'id: T-ADAPTER-0001',
          'type: test',
          'title: Adapter target validation',
          'status: draft',
          'since: 0.2.0-rc.7',
          'verifies:',
          '  adapters:',
          '    - D-NOT-ADAPTER-0001',
          '',
        ].join('\n')
      );

      const workspace = await loadSpecWorkspaceFromDirectory(specDir);

      expect(workspace.issues).toEqual([
        {
          filePath: path.join(specDir, 'T-ADAPTER-0001.yaml'),
          message:
            'T-ADAPTER-0001 verifies.adapters target D-NOT-ADAPTER-0001 is decision, expected adapter.',
        },
      ]);
    } finally {
      await rm(specDir, { recursive: true, force: true });
    }
  });

  it('keeps official profile targets aligned with package metadata and the Props/Event/State/Expose slices', async () => {
    const root = process.cwd();
    const workspace = await loadSpecWorkspaceFromDirectory(path.join(root, 'spec'));

    expect(workspace.issues).toEqual([]);

    const cases = [
      {
        id: 'A-REACT-18-19-0001',
        packagePath: 'packages/adapters/react/package.json',
        runtimeName: 'react',
        peerName: 'react',
      },
      {
        id: 'A-VUE-2-0001',
        packagePath: 'packages/adapters/vue2/package.json',
        runtimeName: 'vue',
        peerName: 'vue',
      },
      {
        id: 'A-VUE-3-0001',
        packagePath: 'packages/adapters/vue/package.json',
        runtimeName: 'vue',
        peerName: 'vue',
      },
      {
        id: 'A-WEB-COMPONENT-0001',
        packagePath: 'packages/adapters/web-component/package.json',
        runtimeName: 'custom-elements',
      },
    ] as const;

    for (const profileCase of cases) {
      const entity = workspace.entities.find((candidate) => candidate.id === profileCase.id);
      const packageJson = JSON.parse(
        await readFile(path.join(root, profileCase.packagePath), 'utf8')
      ) as {
        name: string;
        peerDependencies?: Record<string, string>;
      };

      expect(entity?.type).toBe('adapter');
      expect(entity?.adapterProfile?.package).toBe(packageJson.name);
      expect(entity?.adapterProfile?.target.platform).toBe('web');
      expect(entity?.adapterProfile?.target.runtime?.name).toBe(profileCase.runtimeName);
      if ('peerName' in profileCase) {
        expect(entity?.adapterProfile?.target.runtime?.versionRange).toBe(
          packageJson.peerDependencies?.[profileCase.peerName]
        );
      }
      expect(entity?.supports?.modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'M-PROPS-0001', role: 'required-module' }),
          expect.objectContaining({ id: 'M-EVENT-0001', role: 'required-module' }),
          expect.objectContaining({ id: 'M-STATE-0001', role: 'required-module' }),
          expect.objectContaining({ id: 'M-EXPOSE-0001', role: 'required-module' }),
          expect.objectContaining({ id: 'M-EXPOSE-STATE-0001', role: 'required-module' }),
          expect.objectContaining({ id: 'M-EXPOSE-EVENT-0001', role: 'required-module' }),
        ])
      );
      expect(entity?.provides?.hostCaps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'HC-PROPS-SOURCE-0001',
            role: 'translated-capability',
          }),
          expect.objectContaining({
            id: 'HC-EVENT-BINDING-0001',
            role: 'translated-capability',
          }),
          expect.objectContaining({
            id: 'HC-DEFAULT-ACTION-0001',
            role: 'translated-capability',
          }),
          expect.objectContaining({
            id: 'HC-EXPOSES-RECORD-SINK-0001',
            role: 'translated-capability',
          }),
          expect.objectContaining({
            id: 'HC-EXPOSE-EVENT-SINK-0001',
            role: 'translated-capability',
          }),
        ])
      );
    }
  });
});
