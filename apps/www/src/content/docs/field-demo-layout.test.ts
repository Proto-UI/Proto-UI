// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import type { DemoNode } from '../../components/PrototypePreviewer/demo-types';
import { createFieldDemo } from './field-demo.shared';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { compile } = require('tailwindcss') as typeof import('tailwindcss');
const families = ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];
const children = (node: DemoNode): DemoNode[] =>
  'children' in node
    ? (node.children ?? []).filter((child): child is DemoNode => typeof child !== 'string')
    : [];
const ref = (node: DemoNode) => ('ref' in node ? node.ref : undefined);
function stableActionOrder(root: DemoNode) {
  const top = children(root);
  const field = top.find((node) => ref(node) === 'asyncRoot');
  if (!field) return false;
  const refs = children(field).map(ref);
  const cancel = refs.indexOf('cancel');
  return (
    cancel > refs.indexOf('asyncDescription') &&
    cancel < refs.indexOf('asyncError') &&
    cancel < refs.indexOf('asyncValidity') &&
    top.findIndex((node) => ref(node) === 'asyncStatus') > top.indexOf(field)
  );
}

describe.each(families)(
  'Field %s demo feedback/action flow (source and compiled CSS)',
  (family) => {
    it('places the command after its editor/help and before changing feedback without reserving fixed-height rows', async () => {
      const root = createFieldDemo(family).root;
      expect(stableActionOrder(root)).toBe(true);
      const asyncRoot = children(root).find((node) => ref(node) === 'asyncRoot')!;
      const parts = children(asyncRoot);
      expect(parts.map(ref)).toEqual([
        'asyncLabel',
        'asyncControl',
        'asyncDescription',
        'cancel',
        'asyncError',
        'asyncValidity',
      ]);
      expect(parts.find((node) => ref(node) === 'asyncError')).toMatchObject({ props: {} });
      const status = children(root).find((node) => ref(node) === 'asyncStatus');
      expect(status).toMatchObject({ attrs: { 'aria-live': 'polite' } });

      const className =
        family === 'base'
          ? 'className' in asyncRoot
            ? asyncRoot.className!
            : ''
          : readFileSync(
              new URL(
                `../../../../../packages/prototypes/${family}/src/field/root.proto.ts`,
                import.meta.url
              ),
              'utf8'
            ).match(/tw\('([^']+)'\)/)![1];
      const utilities = className.split(/\s+/);
      const theme = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
      const compiler = await compile(`${theme}\n@tailwind utilities;`);
      const css = compiler.build(utilities);
      expect(css).toContain(family === 'base' ? 'display: grid' : 'flex-direction: column');
      expect(css).not.toMatch(
        /column-reverse|row-reverse|(?:^|[;{])\s*(?:height|block-size|order|position)\s*:/
      );
      expect(utilities).not.toContain('grid-flow-dense');
    });

    it('rejects both the prior after-feedback placement and a same-parent error-before-command mutation', () => {
      const prior = structuredClone(createFieldDemo(family).root);
      const top = children(prior);
      const asyncRoot = top.find((node) => ref(node) === 'asyncRoot')!;
      if (!('children' in asyncRoot) || !('children' in prior))
        throw new Error('Expected demo containers');
      const button =
        children(asyncRoot).find((node) => ref(node) === 'cancel') ??
        top.find((node) => ref(node) === 'cancel')!;
      expect(button).toBeDefined();
      asyncRoot.children = children(asyncRoot).filter((node) => node !== button);
      prior.children = children(prior).filter((node) => node !== button);
      prior.children.push(button);
      expect(stableActionOrder(prior)).toBe(false);
      prior.children = children(prior).filter((node) => node !== button);
      asyncRoot.children.splice(4, 0, button);
      expect(stableActionOrder(prior)).toBe(false);
    });
  }
);
