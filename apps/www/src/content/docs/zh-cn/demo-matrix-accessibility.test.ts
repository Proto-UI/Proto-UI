// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { matrixAccessibilityFromSnapshots } from './demo-matrix-accessibility';

const target = (role: string, name: string, position: number) => ({
  role,
  name,
  selector: `:root > :nth-child(1) > :nth-child(${position})`,
});
const dom = {
  nodeType: 9,
  nodeName: '#document',
  backendNodeId: 1,
  children: [
    {
      nodeType: 1,
      nodeName: 'HTML',
      backendNodeId: 2,
      children: [
        {
          nodeType: 1,
          nodeName: 'BODY',
          backendNodeId: 3,
          children: [
            { nodeType: 3, nodeName: '#text', backendNodeId: 99 },
            {
              nodeType: 1,
              nodeName: 'SELECT',
              backendNodeId: 4,
              attributes: ['multiple', '', 'size', '1'],
            },
            { nodeType: 1, nodeName: 'DIV', backendNodeId: 5, attributes: ['role', 'listbox'] },
          ],
        },
      ],
    },
  ],
};
const ax = [
  {
    backendDOMNodeId: 5,
    ignored: false,
    role: { value: 'listbox' },
    name: { value: 'Destination' },
  },
  {
    backendDOMNodeId: 4,
    ignored: false,
    role: { value: 'combobox' },
    name: { value: 'Destination' },
  },
];
const targets = {
  select: [[target('listbox', 'Destination', 1)], [target('listbox', 'Destination', 2)]],
};

describe('Demo Matrix browser snapshot identity', () => {
  it('rejects DOM false parity using actual AX identity, preserving row and control order', () => {
    const observed = matrixAccessibilityFromSnapshots(targets, dom, ax);
    expect(observed.facts.select).toEqual([
      [{ role: 'combobox', name: 'Destination' }],
      [{ role: 'listbox', name: 'Destination' }],
    ]);
    expect(observed.observations.map((fact) => fact.backendNodeId)).toEqual([4, 5]);
    expect(observed.observations[0]!.dom.approximation).toEqual({
      role: 'listbox',
      name: 'Destination',
    });
    expect(() => expect(observed.facts.select![0]).toEqual(observed.facts.select![1])).toThrow();
  });

  it('uses the actual complete name rather than a matching DOM approximation', () => {
    const native = structuredClone(ax);
    native[1]!.name.value = 'First Second Third';
    const observed = matrixAccessibilityFromSnapshots(targets, dom, native);
    expect(observed.facts.select![0]![0]!.name).toBe('First Second Third');
    expect(observed.facts.select![0]![0]!.name).not.toBe(targets.select[0]![0]!.name);
  });

  it('keeps ignored and absent candidates visible as failed name/role facts', () => {
    const ignored = structuredClone(ax);
    ignored[1]!.ignored = true;
    for (const nodes of [ignored, ax.slice(0, 1)]) {
      const observed = matrixAccessibilityFromSnapshots(targets, dom, nodes);
      expect(observed.facts.select![0]).toEqual([{ role: 'none', name: '' }]);
      expect(observed.observations[0]!.exposed).toBe(false);
      expect(observed.facts.select).toHaveLength(2);
    }
  });

  it('never accepts a disconnected selector or ambiguous exposed AX identity', () => {
    expect(() =>
      matrixAccessibilityFromSnapshots({ select: [[target('listbox', 'Destination', 7)]] }, dom, ax)
    ).toThrow('disappeared');
    expect(() => matrixAccessibilityFromSnapshots(targets, dom, [...ax, ax[1]!])).toThrow(
      'Ambiguous'
    );
    expect(() =>
      matrixAccessibilityFromSnapshots(
        { select: [[{ role: 'listbox', name: 'Destination' }]] },
        dom,
        ax
      )
    ).toThrow('selector');
  });
});
