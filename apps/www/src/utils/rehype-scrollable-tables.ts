import type { Root } from 'hast';
import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

/** Keep native table sizing while containing wide Markdown tables on small screens. */
export const rehypeScrollableTables: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'table' || !parent || typeof index !== 'number') return;

    parent.children[index] = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['docs-table-scroll'] },
      children: [node],
    };
    return SKIP;
  });
};
