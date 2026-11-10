import { describe, expect, it } from 'vitest';
import { createHomepageShowcase } from './homepage-showcase';
import type { DemoChild, DemoNode } from '../PrototypePreviewer/demo-types';

function nodes(child: DemoChild): DemoNode[] {
  if (typeof child === 'string') return [];
  return [child, ...('children' in child ? (child.children ?? []) : []).flatMap(nodes)];
}

describe('Bootstrap homepage modal composition', () => {
  for (const locale of ['en', 'zh-cn']) {
    it(`${locale}: separates title bar, body and action bar`, () => {
      const tree = createHomepageShowcase('bootstrap-2-3-2', 'wc', locale, () => true).demo.root;
      const content = nodes(tree).find(
        (node) => node.kind === 'proto' && node.prototypeId === 'bootstrap-2-3-2-dialog-content'
      );
      expect(content?.kind).toBe('proto');
      if (!content || content.kind !== 'proto') throw new Error('Missing Dialog Content');
      const children = (content.children ?? []).filter(
        (node): node is Extract<DemoNode, { kind: 'proto' }> =>
          typeof node !== 'string' && node.kind === 'proto'
      );
      expect(children.map((node) => node.prototypeId)).toEqual([
        'bootstrap-2-3-2-dialog-header',
        'bootstrap-2-3-2-dialog-description',
        'bootstrap-2-3-2-dialog-footer',
        'bootstrap-2-3-2-dialog-close-icon',
      ]);
      expect(
        nodes(children[0])
          .filter((node) => node.kind === 'proto')
          .map((node) => node.kind === 'proto' && node.prototypeId)
      ).not.toContain('bootstrap-2-3-2-dialog-description');
      expect(
        nodes(children[2]).filter(
          (node) => node.kind === 'proto' && node.prototypeId === 'bootstrap-2-3-2-button'
        )
      ).toHaveLength(2);
    });
  }
});
