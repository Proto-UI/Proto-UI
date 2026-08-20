import { buildSpecGraph } from '@proto.ui/spec-graph';
import { validateSpecEntity } from '@proto.ui/spec-schema';
import { describe, expect, it } from 'vitest';

describe('adapter profile graph', () => {
  it('projects Module support and host-capability provision as graph edges', () => {
    const adapter = validateSpecEntity({
      id: 'A-REACT-18-19-0001',
      type: 'adapter',
      title: 'React adapter profile',
      status: 'draft',
      since: '0.2.0-rc.7',
      adapterProfile: {
        package: '@proto.ui/adapter-react',
        target: {
          platform: 'web',
          runtime: { name: 'react', versionRange: '>=18.2.0 <20' },
        },
      },
      supports: {
        modules: [{ id: 'M-PROPS-0001', role: 'required-module' }],
      },
      provides: {
        hostCaps: [{ id: 'HC-PROPS-SOURCE-0001', role: 'translated-capability' }],
      },
    });
    const module = validateSpecEntity({
      id: 'M-PROPS-0001',
      type: 'module',
      title: 'Props module',
      status: 'active',
      since: '0.1.0',
    });
    const hostCap = validateSpecEntity({
      id: 'HC-PROPS-SOURCE-0001',
      type: 'host-cap',
      title: 'Props source',
      status: 'draft',
      since: '0.2.0-rc.7',
    });

    const graph = buildSpecGraph({
      version: '0.2.0-rc.7',
      generatedAt: '2026-08-14T00:00:00.000Z',
      entities: [adapter, module, hostCap],
    });

    expect(graph.edges).toEqual([
      expect.objectContaining({
        from: 'A-REACT-18-19-0001',
        to: 'M-PROPS-0001',
        kind: 'supports',
        relation: 'modules',
        role: 'required-module',
      }),
      expect.objectContaining({
        from: 'A-REACT-18-19-0001',
        to: 'HC-PROPS-SOURCE-0001',
        kind: 'provides',
        relation: 'hostCaps',
        role: 'translated-capability',
      }),
    ]);
  });
});
