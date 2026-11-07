import { describe, expect, it } from 'vitest';
import type { DemoChild, DemoNode } from '../../../components/PrototypePreviewer/demo-types';
import transitionDemoDefinition from '../demo-brutalist-transition.demo';
import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const transitionDemo = transitionDemoDefinition as DemoSpec;

function collectNodes(node: DemoChild, result: DemoNode[] = []): DemoNode[] {
  if (typeof node === 'string') return result;
  result.push(node);
  if (node.kind === 'text') return result;
  for (const child of node.children ?? []) collectNodes(child, result);
  return result;
}

describe('Brutalist Transition demo contract', () => {
  it('drives the real phase machine through exposed controls with no invented motion', () => {
    const nodes = collectNodes(transitionDemo.root);
    const protos = nodes.filter((node) => node.kind === 'proto');
    const ids = [...new Set(protos.map((node) => (node as DemoNode).prototypeId))].sort();
    // Only the family Transition plus the Button command affordances.
    expect(ids).toEqual(['brutalist-button', 'brutalist-transition']);

    const transitions = protos.filter(
      (node) => (node as DemoNode).prototypeId === 'brutalist-transition'
    );
    expect(transitions).toHaveLength(1);
    const transition = transitions[0] as DemoNode;
    expect(transition.ref).toBe('transition');
    // Starts present with an initial entry; authored content stays inside.
    expect(transition.props?.defaultOpen).toBe(true);
    expect(transition.props?.appear).toBe(true);
    expect(transition.children?.length).toBeGreaterThan(0);

    const refs = new Set(
      protos.map((node) => (node as DemoNode).ref).filter((ref) => typeof ref === 'string')
    );
    // Enter/Leave/Complete are wired to the real controls, not styled stand-ins.
    for (const ref of ['enterBtn', 'leaveBtn', 'completeBtn']) {
      expect(refs.has(ref)).toBe(true);
    }
  });
});
