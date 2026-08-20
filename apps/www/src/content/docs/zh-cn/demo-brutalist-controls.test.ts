import { describe, expect, it } from 'vitest';
import type {
  DemoChild,
  DemoNode,
  DemoSpec,
} from '../../../components/PrototypePreviewer/demo-types';
import scrollAreaDemoDefinition from './demo-brutalist-scroll-area.demo';
import switchDemoDefinition from './demo-brutalist-switch.demo';
import tabsDemoDefinition from './demo-brutalist-tabs.demo';

const scrollAreaDemo = scrollAreaDemoDefinition as DemoSpec;
const switchDemo = switchDemoDefinition as DemoSpec;
const tabsDemo = tabsDemoDefinition as DemoSpec;

const SWITCH_EXAMPLES = [
  {
    switchRef: 'emailAlertsSwitch',
    label: 'Email alerts',
  },
  {
    switchRef: 'releaseAlertsSwitch',
    label: 'Release alerts',
  },
  {
    switchRef: 'archivedAlertsSwitch',
    label: 'Archived alerts',
  },
] as const;

function collectNodes(node: DemoChild, result: DemoNode[] = []): DemoNode[] {
  if (typeof node === 'string') return result;
  result.push(node);
  if (node.kind === 'text') return result;
  for (const child of node.children ?? []) collectNodes(child, result);
  return result;
}

function textContent(node: DemoChild): string {
  if (typeof node === 'string') return node;
  if (node.kind === 'text') return node.text;
  return (node.children ?? []).map(textContent).join('');
}

describe('Brutalist documentation demo state contracts', () => {
  it('keeps each visible Switch label inside its naming content', () => {
    const nodes = collectNodes(switchDemo.root);

    for (const example of SWITCH_EXAMPLES) {
      const switchNode = nodes.find(
        (node) => node.kind === 'proto' && node.ref === example.switchRef
      );

      expect(switchNode).toMatchObject({
        kind: 'proto',
        prototypeId: 'brutalist-switch-root',
        ref: example.switchRef,
      });
      if (!switchNode || switchNode.kind !== 'proto') {
        throw new Error(`Missing Switch demo node: ${example.switchRef}`);
      }

      expect((switchNode.className ?? '').split(/\s+/)).toContain('relative');
      const thumb = switchNode.children?.find(
        (child) =>
          typeof child !== 'string' &&
          child.kind === 'proto' &&
          child.prototypeId === 'brutalist-switch-thumb'
      );
      const visibleLabel = switchNode.children?.find(
        (child) =>
          typeof child !== 'string' &&
          child.kind === 'box' &&
          (child.className ?? '').split(/\s+/).includes('absolute')
      );

      expect(thumb).toBeDefined();
      if (!thumb || typeof thumb === 'string' || thumb.kind !== 'proto') {
        throw new Error(`Missing Switch Thumb: ${example.switchRef}`);
      }
      expect(textContent(thumb)).toBe('');

      expect(visibleLabel).toBeDefined();
      if (!visibleLabel || typeof visibleLabel === 'string' || visibleLabel.kind !== 'box') {
        throw new Error(`Missing visible Switch label: ${example.switchRef}`);
      }
      expect(textContent(visibleLabel)).toBe(example.label);
      expect(visibleLabel.className).not.toContain('sr-only');
    }
  });

  it('constrains the Scroll Area root to its responsive demo wrapper', () => {
    expect(scrollAreaDemo.root.kind).toBe('box');
    if (scrollAreaDemo.root.kind !== 'box') {
      throw new Error('Expected a Scroll Area demo wrapper.');
    }

    const wrapperTokens = new Set(
      (scrollAreaDemo.root.className ?? '').split(/\s+/).filter(Boolean)
    );
    expect(wrapperTokens.has('w-full')).toBe(true);
    expect(wrapperTokens.has('max-w-80')).toBe(true);

    const scrollRoot = collectNodes(scrollAreaDemo.root).find(
      (node) => node.kind === 'proto' && node.prototypeId === 'brutalist-scroll-area-root'
    );
    expect(scrollRoot).toBeDefined();
    if (!scrollRoot || scrollRoot.kind !== 'proto') {
      throw new Error('Expected a Scroll Area prototype root.');
    }
    const rootTokens = new Set((scrollRoot.className ?? '').split(/\s+/).filter(Boolean));
    expect(rootTokens.has('h-48')).toBe(true);
    expect(rootTokens.has('w-full')).toBe(true);
    expect(rootTokens.has('w-80')).toBe(false);
  });

  it('gives the Tabs reference widget a responsive stable width', () => {
    expect(tabsDemo.root).toMatchObject({
      kind: 'proto',
      prototypeId: 'brutalist-tabs-root',
    });
    if (tabsDemo.root.kind !== 'proto') throw new Error('Expected a Tabs prototype root.');

    const tokens = new Set((tabsDemo.root.className ?? '').split(/\s+/).filter(Boolean));
    expect(tokens.has('w-full')).toBe(true);
    expect(tokens.has('max-w-sm')).toBe(true);
    expect([...tokens].some((token) => token.startsWith('w-['))).toBe(false);
  });
});
