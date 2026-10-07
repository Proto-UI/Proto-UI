import { describe, expect, it } from 'vitest';
import type { DemoNode, DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
import definition from './demo-brutalist-dialog.demo';

const demo = definition as DemoSpec;

function part(node: DemoNode, prototypeId: string): DemoNode {
  const pending = [node];
  while (pending.length) {
    const current = pending.pop()!;
    if (current.kind === 'proto' && current.prototypeId === prototypeId) return current;
    if (current.kind === 'text') continue;
    for (const child of current.children ?? []) {
      if (typeof child !== 'string') pending.push(child);
    }
  }
  throw new Error(`Missing ${prototypeId}`);
}

describe('Brutalist Dialog consumer composition', () => {
  it('reserves a scalable close-control row outside the optional Header', () => {
    // P-BRUTALIST-DIALOG-CONTENT keeps p-6; CloseIcon keeps top-4 / size-9.
    // The explicitly composed consumer reserves the difference plus clearance:
    // 1.5rem panel inset + 2.5rem wrapper inset = 4rem header start, below 3.25rem.
    const content = part(demo.root, 'brutalist-dialog-content');
    expect(content.kind).toBe('proto');
    if (content.kind !== 'proto') throw new Error('Expected Content');
    const wrapper = content.children?.[0];
    expect(wrapper).toMatchObject({ kind: 'box', className: 'min-w-0 pt-10' });
    if (!wrapper || typeof wrapper === 'string' || wrapper.kind !== 'box') {
      throw new Error('Expected passive close-clearance wrapper');
    }
    expect(wrapper.attrs).toBeUndefined();
    expect(wrapper.children).toHaveLength(1);
    expect(wrapper.children?.[0]).toMatchObject({
      kind: 'proto',
      prototypeId: 'brutalist-dialog-header',
    });
  });

  it('preserves title, description and both semantic dismissal controls', () => {
    expect(part(demo.root, 'brutalist-dialog-title')).toEqual({
      kind: 'proto',
      prototypeId: 'brutalist-dialog-title',
      children: ['Neo-Brutalist modal'],
    });
    expect(part(demo.root, 'brutalist-dialog-description')).toEqual({
      kind: 'proto',
      prototypeId: 'brutalist-dialog-description',
      children: ['Flat overlay, hard panel shadow, 5px rounded corners.'],
    });
    expect(part(demo.root, 'brutalist-dialog-close')).toEqual({
      kind: 'proto',
      prototypeId: 'brutalist-dialog-close',
      children: [{ kind: 'proto', prototypeId: 'brutalist-button', children: ['Close'] }],
    });
    expect(part(demo.root, 'brutalist-dialog-close-icon')).toEqual({
      kind: 'proto',
      prototypeId: 'brutalist-dialog-close-icon',
    });
    const content = part(demo.root, 'brutalist-dialog-content');
    if (content.kind !== 'proto') throw new Error('Expected Content');
    expect(
      content.children
        ?.slice(1)
        .map((node) =>
          typeof node !== 'string' && node.kind === 'proto' ? node.prototypeId : null
        )
    ).toEqual(['brutalist-dialog-footer', 'brutalist-dialog-close-icon']);
  });
});
