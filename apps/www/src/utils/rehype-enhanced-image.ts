import type { Element, Root } from 'hast';
import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

/** Enhance standalone Markdown images without changing authored HTML/MDX anatomy.
 * The runtime viewer discovers eligible rendered media independently of this layout pass.
 */
export const rehypeEnhancedImage: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node, index, parent) => {
    // These owners already define layout, navigation, interaction or caption semantics.
    if (['a', 'button', 'figure', 'picture'].includes(node.tagName)) return SKIP;
    if (!parent || typeof index !== 'number') return;
    const children = node.children.filter((child) => child.type !== 'text' || child.value.trim());
    const standaloneParagraph =
      node.tagName === 'p' &&
      children.length === 1 &&
      children[0].type === 'element' &&
      children[0].tagName === 'img';
    const standaloneRootImage = node.tagName === 'img' && parent.type === 'root';
    if (!standaloneParagraph && !standaloneRootImage) return;
    const img = standaloneRootImage ? node : (children[0] as Element);
    const src = String(img.properties.src ?? '');
    const svg = /\.svg(?:[?#]|$)/i.test(src) || /^data:image\/svg\+xml[;,]/i.test(src);
    const alt = String(img.properties.alt ?? '');
    const classes = img.properties.className;
    img.properties = {
      ...img.properties,
      loading: img.properties.loading ?? 'lazy',
      decoding: img.properties.decoding ?? 'async',
      className: [
        'enhanced-image',
        ...(svg ? ['enhanced-image-svg-element'] : []),
        ...(Array.isArray(classes) ? classes : classes ? [String(classes)] : []),
      ],
    };
    const caption: Element[] = alt.trim()
      ? [
          {
            type: 'element',
            tagName: 'figcaption',
            properties: { className: ['enhanced-image-caption'] },
            children: [{ type: 'text', value: alt }],
          },
        ]
      : [];
    parent.children[index] = {
      type: 'element',
      tagName: 'figure',
      properties: { className: ['enhanced-image-wrapper', ...(svg ? ['enhanced-image-svg'] : [])] },
      children: [
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['enhanced-image-container'] },
          children: [img],
        },
        ...caption,
      ],
    };
    return SKIP;
  });
};
