// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type {
  DemoChild,
  DemoNode,
  DemoRuntimeApi,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import liveRegionDemoDefinition from './demo-brutalist-live-region.demo';

type DemoRefNode = Extract<DemoNode, { kind: 'box' }> | Extract<DemoNode, { kind: 'proto' }>;

const liveRegionDemo = liveRegionDemoDefinition as DemoSpec;

function collectNodes(node: DemoChild, result: DemoNode[] = []): DemoNode[] {
  if (typeof node === 'string') return result;
  result.push(node);
  if (node.kind === 'text') return result;
  for (const child of node.children ?? []) collectNodes(child, result);
  return result;
}

describe('Brutalist Live Region demo contract', () => {
  it('keeps two real family regions with authored payloads and no simulated announcements', () => {
    // T-BRUTALIST-LIVE-REGION-0001-CASE-5
    const nodes = collectNodes(liveRegionDemo.root);
    const regions = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-live-region-root'
    );
    const buttons = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-button'
    );
    expect(regions).toHaveLength(2);
    expect(buttons).toHaveLength(2);

    const politeness = regions.map((region) =>
      region.kind === 'proto' ? (region.props?.politeness as string | undefined) : null
    );
    expect(politeness).toEqual(['polite', 'assertive']);
    for (const region of regions) {
      if (region.kind !== 'proto') throw new Error('Expected Live Region Root');
      // Each region carries a real authored payload box as its announcement
      // content; nothing simulates an announcement engine or event channel.
      expect(region.props?.atomic).toBe(true);
      const payloads = (region.children ?? []).filter(
        (child): child is DemoRefNode =>
          typeof child !== 'string' && child.kind !== 'text' && child.ref === `${region.ref}Payload`
      );
      expect(payloads).toHaveLength(1);
    }
  });

  it('updates only authored child text through the demo refs', () => {
    // T-BRUTALIST-LIVE-REGION-0001-CASE-5: setup mutates payload textContent and
    // binds button clicks; it never touches live-region props or attributes.
    expect(liveRegionDemo.setup).toBeTypeOf('function');
    const politePayload = document.createElement('div');
    const assertivePayload = document.createElement('div');
    const clicks = new Map<string, Record<string, unknown>>();
    const api: DemoRuntimeApi = {
      call: () => undefined,
      getExposes: () => undefined,
      setProps: (ref, next) => {
        clicks.set(ref, next);
      },
    };
    liveRegionDemo.setup?.({
      host: document.createElement('div'),
      refs: { politePayload, assertivePayload },
      api,
    });

    expect([...clicks.keys()].sort()).toEqual(['announceAssertive', 'announcePolite']);
    (clicks.get('announcePolite')!.onClick as () => void)();
    expect(politePayload.textContent).toContain('1 new notification');
    (clicks.get('announceAssertive')!.onClick as () => void)();
    expect(assertivePayload.textContent).toContain('Service degraded');
    (clicks.get('announceAssertive')!.onClick as () => void)();
    expect(assertivePayload.textContent).toContain('Service normal');
  });
});
