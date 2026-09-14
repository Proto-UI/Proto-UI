import type { Root } from 'hast';
import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

/**
 * Rehype 插件：增强 Markdown 图片渲染
 * 为图片添加容器包装，支持主题变量和最佳实践
 */
export const rehypeEnhancedImage: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree as any, 'element', (node: any, index, parent: any) => {
      // Viewer buttons own their image layout and captions. Keep their entire
      // subtree as phrasing content, including images nested in inline elements.
      if (node.tagName === 'button' && Object.hasOwn(node.properties ?? {}, 'dataDiagramOpen')) {
        return SKIP;
      }

      if (node.tagName === 'img' && parent && typeof index === 'number') {
        const img = node;
        const src = img.properties?.src as string | undefined;
        const alt = (img.properties?.alt as string) || '';

        // 检测是否为 SVG
        const isSvg =
          src?.endsWith('.svg') || src?.includes('.svg#') || src?.includes('data:image/svg+xml');

        // 获取现有的 class，如果有的话
        const existingClass = (img.properties?.class as string) || '';
        const imageClass =
          `enhanced-image ${isSvg ? 'enhanced-image-svg-element' : ''} ${existingClass}`.trim();

        // 创建包装容器
        const wrapper = {
          type: 'element',
          tagName: 'figure',
          properties: {
            class: `enhanced-image-wrapper ${isSvg ? 'enhanced-image-svg' : ''}`,
          },
          children: [
            {
              type: 'element',
              tagName: 'div',
              properties: {
                class: 'enhanced-image-container',
              },
              children: [
                {
                  ...img,
                  properties: {
                    ...img.properties,
                    loading: img.properties?.loading || ('lazy' as const),
                    decoding: img.properties?.decoding || ('async' as const),
                    class: imageClass,
                  },
                },
              ],
            },
            // 如果有 alt 文本，添加 figcaption
            ...(alt && alt.trim()
              ? [
                  {
                    type: 'element',
                    tagName: 'figcaption',
                    properties: {
                      class: 'enhanced-image-caption',
                    },
                    children: [
                      {
                        type: 'text',
                        value: alt,
                      },
                    ],
                  },
                ]
              : []),
          ],
        };

        // 替换原图片节点
        parent.children[index] = wrapper;
      }
    });
  };
};
