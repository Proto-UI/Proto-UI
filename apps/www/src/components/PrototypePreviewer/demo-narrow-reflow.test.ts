import { describe, expect, it } from 'vitest';
import buttonDemo from '../../content/docs/zh-cn/demo-brutalist-button.demo';
import transitionDemo from '../../content/docs/zh-cn/demo-base-transition.demo';
import { assertDemoSpec, type DemoNode, type DemoSpec } from './demo-types';

function children(node: DemoNode): DemoNode[] {
  return node.kind === 'text'
    ? []
    : (node.children ?? []).filter((child): child is DemoNode => typeof child !== 'string');
}

// These are source/recipe constraints, not a simulated browser geometry pass.
// demo-matrix.browser and demo-brutalist-button.browser own real reflow evidence.
describe('Demo consumer narrow-layout constraints', () => {
  it('bounds the Brutalist button recipe and lets text grow above the default touch height', () => {
    assertDemoSpec(buttonDemo);
    expect(buttonDemo.root.className).toContain('min-w-0');
    expect(buttonDemo.root.className).toContain('max-w-full');
    const buttons = children(buttonDemo.root as DemoSpec['root']);
    expect(buttons).toHaveLength(10);
    for (const button of buttons) {
      expect(button.kind).toBe('proto');
      if (button.kind !== 'proto') continue;
      expect(button.prototypeId).toBe('brutalist-button');
      if (button.props?.size === 'icon') {
        expect(button.surfaceStyle).toBeUndefined();
      } else {
        expect(button.surfaceStyle).toEqual({
          minWidth: '0',
          maxWidth: '100%',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          height: 'auto',
          minHeight: '2.5rem',
        });
      }
    }
    const disabled = buttons.find(
      (node) => node.kind === 'proto' && node.ref === 'disabledSurface'
    );
    expect(disabled).toMatchObject({
      props: { variant: 'surface', disabled: true },
      children: ['Disabled surface'],
    });
  });

  it('reflows the passive Transition demo without reducing its desktop box or removing states', () => {
    assertDemoSpec(transitionDemo as DemoSpec);
    const root = transitionDemo.root as DemoSpec['root'];
    expect(root.kind).toBe('box');
    if (root.kind !== 'box') return;
    for (const token of ['w-full', 'min-w-0', 'max-w-full', 'p-4', 'sm:p-8']) {
      expect(root.className?.split(/\s+/)).toContain(token);
    }
    const transition = children(root).find((node) => node.kind === 'proto');
    expect(transition).toMatchObject({
      prototypeId: 'base-transition',
      props: { open: true, appear: true },
    });
    if (!transition || transition.kind !== 'proto') return;
    expect(transition.className).toContain('max-w-full');
    expect(transition.className).toContain('min-w-0');
    const box = children(transition)[0];
    expect(box?.kind !== 'text' && box?.className).toContain('w-64');
    expect(box?.kind !== 'text' && box?.className).toContain('max-w-full');
    const states = children(root).at(-1)!;
    expect(states.kind !== 'text' && states.className).toContain('flex-wrap');
    expect(children(states).flatMap((node) => (node.kind === 'text' ? [] : node.children))).toEqual(
      ['closed', 'entering', 'entered', 'leaving']
    );
  });
});
