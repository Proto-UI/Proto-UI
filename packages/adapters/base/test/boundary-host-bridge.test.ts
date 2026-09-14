import { describe, expect, it } from 'vitest';
import { createWebBoundaryHostBridge } from '@proto.ui/module-boundary';

const PROTO_PARENT_INSTANCE_MARK = Symbol.for('@proto.ui/adapter-base/__proto_parent_instance');

describe('module-boundary: web host bridge', () => {
  it('BOUNDARY-ADAPTER-0100: classifies a descendant of a registered DOM region as inside', () => {
    const bridge = createWebBoundaryHostBridge();
    const region = document.createElement('div');
    const child = document.createElement('button');
    region.appendChild(child);

    expect(
      bridge.classify({
        regions: [{ target: region, role: 'content' }],
        sample: { target: child },
      })
    ).toBe('inside');
  });

  it('BOUNDARY-ADAPTER-0200: preserves inside across linked proto-parent ownership for relocated nodes', () => {
    const bridge = createWebBoundaryHostBridge();
    const logicalRegion = document.createElement('div');
    const relocatedLeaf = document.createElement('button') as unknown as HTMLElement &
      Record<symbol, unknown>;

    relocatedLeaf[PROTO_PARENT_INSTANCE_MARK] = logicalRegion;

    expect(
      bridge.classify({
        regions: [{ target: logicalRegion, role: 'content' }],
        sample: { target: relocatedLeaf },
      })
    ).toBe('inside');
  });

  it('BOUNDARY-ADAPTER-0300: classifies a separate DOM target as outside when all regions are host-resolvable nodes', () => {
    const bridge = createWebBoundaryHostBridge();
    const region = document.createElement('div');
    const outsider = document.createElement('button');

    expect(
      bridge.classify({
        regions: [{ target: region, role: 'content' }],
        sample: { target: outsider },
      })
    ).toBe('outside');
  });

  it('BOUNDARY-ADAPTER-0400: returns unknown when the sample target is not a host node', () => {
    const bridge = createWebBoundaryHostBridge();
    const region = document.createElement('div');

    expect(
      bridge.classify({
        regions: [{ target: region, role: 'content' }],
        sample: { target: { not: 'a-node' } },
      })
    ).toBe('unknown');
  });

  it('BOUNDARY-ADAPTER-0500: returns unknown when a region is not host-resolvable even if the sample is a node', () => {
    const bridge = createWebBoundaryHostBridge();
    const outsider = document.createElement('button');

    expect(
      bridge.classify({
        regions: [{ target: { opaque: true }, role: 'content' }],
        sample: { target: outsider },
      })
    ).toBe('unknown');
  });
  it('T-BOUNDARY-0002-CASE-WEB: crosses a shadow root and retains positive proof among opaque regions', () => {
    const bridge = createWebBoundaryHostBridge();
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const child = document.createElement('button');
    shadow.append(child);
    expect(
      bridge.classify({ regions: [{ target: {} }, { target: host }], sample: { target: child } })
    ).toBe('inside');
    expect(bridge.classify({ regions: [], sample: { target: child } })).toBe('unknown');
  });
});
