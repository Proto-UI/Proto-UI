import { describe, expect, it } from 'vitest';
import { rehypeEnhancedImage } from './rehype-enhanced-image';

const element = (tagName: string, children: any[] = [], properties = {}) => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const img = () => element('img', [], { src: '/test.png', alt: 'Diagram' });
function run(node: any) {
  const tree: any = { type: 'root', children: [node] };
  (rehypeEnhancedImage as any)()(tree);
  return tree;
}

describe('Markdown image structure', () => {
  it.each(['a', 'figure', 'picture', 'button'])('preserves authored %s and its image', (tag) => {
    const source = img();
    const parent = element(tag, [source], tag === 'a' ? { href: '/source' } : {});
    run(parent);
    expect(parent.children[0]).toBe(source);
  });
  it('replaces a standalone paragraph rather than nesting figure inside p', () => {
    const tree = run(element('p', [img()]));
    expect(tree.children[0].tagName).toBe('figure');
    expect(tree.children[0].children[1].tagName).toBe('figcaption');
  });
  it('leaves an inline prose image as phrasing content', () => {
    const source = img();
    const p = element('p', [{ type: 'text', value: 'Before ' }, source]);
    run(p);
    expect(p.children[1]).toBe(source);
  });
});
