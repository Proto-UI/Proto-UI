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
  it('reserves logical end clearance for CloseIcon outside the optional Header', () => {
    // The current edit-profile recipe reserves the logical end of the Header
    // for CloseIcon without taking ownership of Content padding or semantics.
    const content = part(demo.root, 'brutalist-dialog-content');
    expect(content.kind).toBe('proto');
    if (content.kind !== 'proto') throw new Error('Expected Content');
    const wrapper = content.children?.[0];
    expect(wrapper).toMatchObject({ kind: 'box', className: 'min-w-0 pe-12' });
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

  it('preserves title, description and both footer dismissal controls and the independent CloseIcon', () => {
    expect(part(demo.root, 'brutalist-dialog-title')).toEqual({
      kind: 'proto',
      prototypeId: 'brutalist-dialog-title',
      children: ['Edit profile'],
    });
    expect(part(demo.root, 'brutalist-dialog-description')).toEqual({
      kind: 'proto',
      prototypeId: 'brutalist-dialog-description',
      children: ["Make changes to your profile here. Click save when you're done."],
    });
    expect(part(demo.root, 'brutalist-dialog-close')).toEqual({
      kind: 'proto',
      prototypeId: 'brutalist-dialog-close',
      children: [
        {
          kind: 'proto',
          prototypeId: 'brutalist-button',
          props: { wrap: true },
          children: ['Save changes'],
        },
      ],
    });
    const footer = part(demo.root, 'brutalist-dialog-footer');
    if (footer.kind !== 'proto') throw new Error('Expected Footer');
    expect(footer.children).toEqual([
      {
        kind: 'box',
        className: 'min-w-0 max-w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-dialog-close',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-button',
                props: { variant: 'surface', wrap: true },
                children: ['Cancel'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'min-w-0 max-w-full',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-dialog-close',
            children: [
              {
                kind: 'proto',
                prototypeId: 'brutalist-button',
                props: { wrap: true },
                children: ['Save changes'],
              },
            ],
          },
        ],
      },
    ]);
    expect(part(demo.root, 'brutalist-dialog-close-icon')).toEqual({
      kind: 'proto',
      prototypeId: 'brutalist-dialog-close-icon',
    });
    const content = part(demo.root, 'brutalist-dialog-content');
    if (content.kind !== 'proto') throw new Error('Expected Content');
    expect(
      content.children
        ?.slice(2)
        .map((node) =>
          typeof node !== 'string' && node.kind === 'proto' ? node.prototypeId : null
        )
    ).toEqual(['brutalist-dialog-footer', 'brutalist-dialog-close-icon']);
  });
});
