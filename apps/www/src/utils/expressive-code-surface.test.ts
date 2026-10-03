// @vitest-environment node
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { siteCopyPlugin } from './expressive-code-copy.mjs';

// Resolve the actual installed renderer used by Starlight, without inventing a
// second dependency/version or faking the frames plugin's HAST shape.
const starlightRequire = createRequire(
  realpathSync(process.cwd() + '/apps/www/node_modules/@astrojs/starlight/package.json')
);
const astroEcRequire = createRequire(starlightRequire.resolve('astro-expressive-code'));
const { ExpressiveCode } = await import(astroEcRequire.resolve('expressive-code'));
const engine = new ExpressiveCode({
  shiki: false,
  textMarkers: false,
  frames: { showCopyToClipboardButton: false },
  plugins: [siteCopyPlugin()],
});
type Node = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};
function find(node: Node, predicate: (node: Node) => boolean): Node[] {
  return [
    ...(predicate(node) ? [node] : []),
    ...(node.children ?? []).flatMap((child) => find(child, predicate)),
  ];
}
const text = (node: Node): string => node.value ?? (node.children ?? []).map(text).join('');

describe('real ExpressiveCode frame-to-passive-surface grammar', () => {
  it.each([
    { language: 'ts', meta: '', title: undefined, payload: '  const x = "<&";', toolbar: false },
    {
      language: 'ts',
      meta: 'title="example.ts"',
      title: 'example.ts',
      payload: '  const x = "<&";',
      toolbar: true,
    },
    { language: 'bash', meta: '', title: 'Terminal', payload: 'echo "<&"', toolbar: true },
    {
      language: 'bash',
      meta: 'title="Build"',
      title: 'Build',
      payload: 'echo "<&"',
      toolbar: true,
    },
    {
      language: 'bash',
      meta: 'frame="none"',
      title: undefined,
      payload: '# setup\n echo "<&"',
      toolbar: false,
    },
  ])(
    '$language $meta keeps meaningful metadata and one unchanged Copy payload',
    async ({ language, meta, title, payload, toolbar }) => {
      const code = language === 'ts' ? '  const x = "<&";\n' : '# setup\n echo "<&"\n';
      const result = await engine.render({ code, language, meta });
      const root = result.renderedGroupAst as Node;
      const frames = find(root, (node) => node.properties?.['data-site-code-surface'] === 'frame');
      expect(frames).toHaveLength(1);
      const headers = find(root, (node) => node.properties?.['data-code-toolbar'] !== undefined);
      expect(headers).toHaveLength(toolbar ? 1 : 0);
      const labels = find(root, (node) => node.properties?.['data-code-label'] !== undefined);
      expect(labels.map(text)).toEqual(title ? [title] : []);
      const copies = find(root, (node) => node.properties?.['data-site-copy'] !== undefined);
      expect(copies).toHaveLength(1);
      // EC normalizes a trailing newline before postprocessRenderedBlock.
      // These values bind the plugin to its processed source, not the raw fence.
      expect(copies[0]!.properties?.['data-site-copy-text']).toBe(payload);
      expect(find(root, (node) => node.tagName === 'pre')).toHaveLength(1);
      expect(find(root, (node) => node.tagName === 'code')).toHaveLength(1);
      expect(find(root, (node) => node.tagName === 'button')).toHaveLength(0);
      expect(
        find(
          root,
          (node) =>
            (node.properties?.className as string[] | undefined)?.includes('header') === true
        )
      ).toHaveLength(0);
      expect(
        find(
          root,
          (node) => (node.properties?.className as string[] | undefined)?.includes('title') === true
        )
      ).toHaveLength(0);
    }
  );
});
