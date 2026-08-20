import { visit } from 'unist-util-visit';

/**
 * Markdown 用法（行内）：
 *   :concept[host]
 *   :concept[Host]{slug="host"}
 *   :concept[host]{summary="..."}  // 可选覆盖
 */
export function remarkConceptDirective() {
  return (tree) => {
    visit(tree, (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type !== 'textDirective') return;
      if (node.name !== 'concept') return;

      const attributes =
        node.attributes && typeof node.attributes === 'object' ? node.attributes : {};
      const labelText =
        Array.isArray(node.children) && node.children.length
          ? node.children.map((c) => (c && c.type === 'text' ? c.value : '')).join('')
          : '';

      const slug = (attributes.slug || labelText || '').toString().trim();
      if (!slug) return;

      const summary = (attributes.summary || '').toString().trim();
      const href = (attributes.href || '').toString().trim();

      node.data ||= {};
      node.data.hName = 'proto-concept';
      node.data.hProperties = {
        slug,
        ...(summary ? { summary } : null),
        ...(href ? { href } : null),
      };
    });
  };
}
