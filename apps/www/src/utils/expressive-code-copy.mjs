// Preserve plugin-frames 0.41.7's post-preprocessing payload policy. Highlighted
// DOM is never a source of truth, and no hidden inherited Copy handler survives.
export function expressiveCodeCopyText(code, terminal) {
  return terminal ? code.replace(/(?<=^|\n)\s*#.*($|\n+)/g, '').trim() : code;
}

export function siteCopyPlugin() {
  return {
    name: 'Website Copy command',
    hooks: {
      postprocessRenderedBlock({ codeBlock, renderData, locale }) {
        const frame = renderData.blockAst;
        if (frame.tagName !== 'figure')
          throw new Error('Website Copy requires the EC frames wrapper');
        const classes = frame.properties.className ?? [];
        const terminal = classes.includes('is-terminal');
        frame.properties['data-site-code-surface'] = 'frame';
        let header = frame.children.find(
          (node) => node.type === 'element' && node.tagName === 'figcaption'
        );
        if (header && (terminal || classes.includes('has-title'))) {
          // Replace only plugin-frames presentation, preserving the authored
          // title. Its sr-only fallback must not become a second visible label.
          const title = header.children.find((node) => {
            const names = node.properties?.className ?? [];
            return node.type === 'element' && names.includes('title');
          });
          const label = title?.children?.some((node) => node.type === 'text' && node.value.trim())
            ? title.children
            : [
                {
                  type: 'text',
                  value: locale.toLowerCase().startsWith('zh') ? '终端' : 'Terminal',
                },
              ];
          header.properties = { 'data-code-toolbar': '', 'data-site-code-surface': 'toolbar' };
          header.children = [
            {
              type: 'element',
              tagName: 'span',
              properties: { 'data-code-label': '' },
              children: label,
            },
          ];
        } else if (header) {
          // Plain fences have no metadata row. Keep Copy in the source corner.
          frame.children = frame.children.filter((node) => node !== header);
          header = undefined;
        }
        const label = locale.toLowerCase().startsWith('zh') ? '复制代码' : 'Copy code';
        (header ? header.children : frame.children).push({
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['site-ec-copy'],
            'data-site-copy': '',
            'data-copy-label': label,
            'data-site-copy-text': expressiveCodeCopyText(codeBlock.code, terminal),
          },
          children: [],
        });
      },
    },
  };
}
