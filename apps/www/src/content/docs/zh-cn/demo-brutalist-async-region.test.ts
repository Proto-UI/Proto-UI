// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type {
  DemoChild,
  DemoNode,
  DemoRuntimeApi,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import asyncRegionDemoDefinition from './demo-brutalist-async-region.demo';

const asyncRegionDemo = asyncRegionDemoDefinition as DemoSpec;

function collectNodes(node: DemoChild, result: DemoNode[] = []): DemoNode[] {
  if (typeof node === 'string') return result;
  result.push(node);
  if (node.kind === 'text') return result;
  for (const child of node.children ?? []) collectNodes(child, result);
  return result;
}

// happy-dom does not implement MutationObserver; the shared async-region demo
// setup installs one only to reflect the real aria-busy projection, so a no-op
// stub keeps the contract test focused on the lawful public surface.
if (typeof globalThis.MutationObserver === 'undefined') {
  (globalThis as Record<string, unknown>).MutationObserver = class {
    observe() {}
    disconnect() {}
  };
}

describe('Brutalist Async Region demo contract', () => {
  it('binds one real family region with authored payload and two button controls', () => {
    // T-BRUTALIST-ASYNC-REGION-0001-CASE-5
    const nodes = collectNodes(asyncRegionDemo.root);
    const regions = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-async-region-root'
    );
    const buttons = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-button'
    );
    expect(regions).toHaveLength(1);
    expect(buttons).toHaveLength(2);

    const region = regions[0];
    if (region.kind !== 'proto') throw new Error('Expected Async Region Root');
    expect(region.ref).toBe('region');
    // The demo starts not-busy and keeps an authored payload child; nothing
    // simulates a loading widget, timer, or second state machine.
    expect(region.props?.busy).toBe(false);
    const payloads = (region.children ?? []).filter(
      (child) => typeof child !== 'string' && (child as DemoNode).ref === 'payload'
    );
    expect(payloads).toHaveLength(1);

    const buttonRefs = buttons.map((node) => (node as DemoNode).ref).sort();
    expect(buttonRefs).toEqual(['markBusy', 'markReady']);
  });

  it('drives busy only through the real region prop', () => {
    // T-BRUTALIST-ASYNC-REGION-0001-CASE-5: setup wires markBusy/markReady
    // clicks to api.setProps('region', {busy}) and reads exposes.busy; it never
    // touches region attributes or injects loading chrome.
    expect(asyncRegionDemo.setup).toBeTypeOf('function');
    const payload = document.createElement('div');
    const busyState = document.createElement('div');
    const host = document.createElement('div');
    const propWrites: Array<{ ref: string; next: Record<string, unknown> }> = [];
    const exposes: Record<string, unknown> = {
      region: { busy: { get: () => true } },
    };
    const api: DemoRuntimeApi = {
      call: () => undefined,
      getExposes: (ref) => exposes[ref],
      setProps: (ref, next) => {
        propWrites.push({ ref, next });
      },
    };
    asyncRegionDemo.setup?.({
      host,
      refs: { payload, busyState },
      api,
    });

    const regionWrites = () => propWrites.filter((write) => write.ref === 'region');
    const controlWrites = propWrites.filter((write) => write.ref !== 'region');
    expect(regionWrites()).toHaveLength(0);
    expect(controlWrites.map((write) => write.ref).sort()).toEqual(['markBusy', 'markReady']);

    // Clicking the real controls issues only a busy prop transition.
    for (const write of controlWrites) {
      expect(typeof write.next.onClick).toBe('function');
    }
    (controlWrites.find((write) => write.ref === 'markBusy')!.next.onClick as () => void)();
    expect(regionWrites()).toEqual([{ ref: 'region', next: { busy: true } }]);
    (controlWrites.find((write) => write.ref === 'markReady')!.next.onClick as () => void)();
    expect(regionWrites()).toEqual([
      { ref: 'region', next: { busy: true } },
      { ref: 'region', next: { busy: false } },
    ]);
    expect(busyState.textContent).toBe('true');
  });
});
