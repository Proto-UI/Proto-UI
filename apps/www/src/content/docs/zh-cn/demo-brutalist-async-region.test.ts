// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type {
  DemoChild,
  DemoNode,
  DemoRuntimeApi,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import asyncRegionDemoDefinition from './demo-brutalist-async-region.demo';

type DemoRefNode = Extract<DemoNode, { kind: 'box' }> | Extract<DemoNode, { kind: 'proto' }>;

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
  it('binds one real family region with authored payload and two busy controls and an independent inspect action', () => {
    // T-BRUTALIST-ASYNC-REGION-0001-CASE-5
    const nodes = collectNodes(asyncRegionDemo.root);
    const regions = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-async-region-root'
    );
    const buttons = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-button'
    );
    expect(regions).toHaveLength(1);
    expect(buttons).toHaveLength(3);

    const region = regions[0];
    if (region.kind !== 'proto') throw new Error('Expected Async Region Root');
    expect(region.ref).toBe('region');
    // The demo starts not-busy and keeps an authored payload child; nothing
    // simulates a loading widget, timer, or second state machine.
    expect(region.props?.busy).toBe(false);
    const payloads = collectNodes(region).filter(
      (child): child is DemoRefNode =>
        typeof child !== 'string' && child.kind !== 'text' && child.ref === 'payload'
    );
    expect(payloads).toHaveLength(1);

    const buttonRefs = buttons
      .map((node) => (node.kind === 'proto' ? node.ref : undefined))
      .filter((ref): ref is string => typeof ref === 'string')
      .sort();
    expect(buttonRefs).toEqual(['finishRefresh', 'inspectBtn', 'startRefresh']);
  });

  it('drives busy only through the real region prop', async () => {
    // T-BRUTALIST-ASYNC-REGION-0001-CASE-5: setup wires startRefresh/finishRefresh
    // clicks to api.setProps('region', {busy}) and reads exposes.busy; it never
    // touches region attributes or injects loading chrome.
    expect(asyncRegionDemo.setup).toBeTypeOf('function');
    const payload = document.createElement('div');
    const statusBadge = document.createElement('div');
    const metaNote = document.createElement('div');
    let busy = false;
    const host = document.createElement('div');
    const propWrites: Array<{ ref: string; next: Record<string, unknown> }> = [];
    const exposes: Record<string, Record<string, unknown> | undefined> = {
      region: { busy: { get: () => busy } },
    };
    const api: DemoRuntimeApi = {
      call: () => undefined,
      getExposes: (ref) => exposes[ref],
      setProps: (ref, next) => {
        propWrites.push({ ref, next });
        if (ref === 'region' && typeof next.busy === 'boolean') busy = next.busy;
      },
    };
    const cleanup = asyncRegionDemo.setup?.({
      host,
      refs: { payload, statusBadge, metaNote },
      api,
    });

    const regionWrites = () => propWrites.filter((write) => write.ref === 'region');
    const controlWrites = propWrites.filter((write) => write.ref !== 'region');
    expect(regionWrites()).toHaveLength(0);
    expect(controlWrites.map((write) => write.ref).sort()).toEqual([
      'finishRefresh',
      'inspectBtn',
      'startRefresh',
    ]);

    // Clicking the real controls issues only a busy prop transition.
    for (const write of controlWrites) {
      expect(typeof write.next.onClick).toBe('function');
    }
    (controlWrites.find((write) => write.ref === 'startRefresh')!.next.onClick as () => void)();
    expect(regionWrites()).toEqual([{ ref: 'region', next: { busy: true } }]);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(statusBadge.textContent).toBe('Syncing…');
    expect(payload.style.opacity).toBe('0.65');
    (controlWrites.find((write) => write.ref === 'inspectBtn')!.next.onClick as () => void)();
    expect(metaNote.textContent).toBe('Log viewer focused while aria-busy="true"');
    expect(regionWrites()).toHaveLength(1);
    (controlWrites.find((write) => write.ref === 'finishRefresh')!.next.onClick as () => void)();
    expect(regionWrites()).toEqual([
      { ref: 'region', next: { busy: true } },
      { ref: 'region', next: { busy: false } },
    ]);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(statusBadge.textContent).toBe('Up to date');
    expect(metaNote.textContent).toBe('Synced revision #2 · aria-busy="false"');
    expect(payload.style.opacity).toBe('1');
    if (typeof cleanup === 'function') cleanup();
  });
});
