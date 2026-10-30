import { describe, expect, it } from 'vitest';
import type { DemoChild, DemoNode, DemoSetupContext } from '../../../components/PrototypePreviewer/demo-types';
import { loadPrototype } from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import demo, { SWITCH_COMPOSITION_CASES } from './demo-shadcn-switch-compositions.demo';

function nodes(node: DemoChild): DemoNode[] {
  if (typeof node === 'string') return [];
  return [node, ...('children' in node ? (node.children ?? []).flatMap(nodes) : [])];
}
const all = nodes(demo.root);
const proto = (ref: string) => {
  const result = all.find((node) => 'ref' in node && node.ref === ref);
  if (!result || result.kind !== 'proto') throw new Error(`Missing prototype ${ref}`);
  return result;
};

describe('public Switch compositions, source inventory and real loaders', () => {
  it('loads every actual public composition prototype, including FieldSwitch', async () => {
    const ids = [...new Set(all.flatMap((node) => node.kind === 'proto' ? [node.prototypeId] : []))];
    expect(ids).toContain('shadcn-field-switch');
    for (const id of ids) {
      await loadPrototype(id);
      expect(getPrototype(id)?.name).toBe(id);
    }
  });
  it('keeps default non-dragging and makes two directional enhancements explicit', () => {
    expect(SWITCH_COMPOSITION_CASES).toHaveLength(9);
    expect(SWITCH_COMPOSITION_CASES.filter((entry) => entry.draggable).map((entry) => entry.id))
      .toEqual(['drag', 'drag-rtl']);
    for (const entry of SWITCH_COMPOSITION_CASES) {
      expect(proto(`${entry.id}-control`).prototypeId).toBe('shadcn-field-switch');
      expect(proto(`${entry.id}-control`).props?.draggable).toBe(entry.draggable ?? false);
      expect(proto(`${entry.id}-control`).props?.direction).toBe(entry.direction ?? 'ltr');
      expect(proto(`${entry.id}-thumb`).prototypeId).toBe('shadcn-switch-thumb');
    }
  });

  it('keeps name, description, policy and control in one Field without a wrapper button', () => {
    for (const entry of SWITCH_COMPOSITION_CASES) {
      const field = proto(`${entry.id}-card`);
      const descendants = nodes(field);
      expect(descendants.filter((node) => node.kind === 'proto' && node.prototypeId === 'shadcn-field-switch')).toHaveLength(1);
      expect(proto(`${entry.id}-label`).children).toEqual([entry.title]);
      expect(proto(`${entry.id}-description`).prototypeId).toBe('shadcn-field-description');
      expect(field.props).toEqual({ disabled: entry.disabled ?? false, readOnly: entry.readOnly ?? false });
    }
    expect(all.some((node) => node.kind === 'proto' && /button/.test(node.prototypeId))).toBe(false);
    const link = all.find((node) => 'ref' in node && node.ref === 'choice-link');
    expect(link).toMatchObject({ kind: 'box', tag: 'a', className: 'relative z-20 underline' });
    expect(proto('choice-control').className).toContain('z-10');
    expect(proto('choice-card').className).toContain('[aria-checked=true]');
    expect(proto('controlled-control').props).toMatchObject({ checked: false, draggable: false });
  });

  it('observes requests without forwarding clicks or accepting controlled changes', () => {
    const callbacks = new Map<string, Record<string, unknown>>();
    const refs = Object.fromEntries(SWITCH_COMPOSITION_CASES.map(({ id }) => [
      `${id}-requests`, { textContent: 'Requests: 0', dataset: { requestCount: '0' } },
    ]));
    demo.setup!({ refs, api: { setProps: (ref: string, next: Record<string, unknown>) => callbacks.set(ref, next) } } as unknown as DemoSetupContext);
    expect(callbacks.size).toBe(9);
    for (const callback of callbacks.values()) expect(Object.keys(callback)).toEqual(['onCheckedChange']);
    (callbacks.get('controlled-control')!.onCheckedChange as () => void)();
    expect(refs['controlled-requests'].dataset.requestCount).toBe('1');
    expect(refs['choice-requests'].dataset.requestCount).toBe('0');
    expect(proto('controlled-control').props?.checked).toBe(false);
  });
});
