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
function stableFeedbackOrder(root: DemoNode) {
  const form = children(root)[0];
  if (!form) return false;
  const top = children(form);
  const field = top.find((node) => ref(node) === 'handleRoot');
  if (!field) return false;
  const refs = children(field).map(ref);
  const errorIndex = refs.indexOf('handleError');
  const statusIndex = top.findIndex((node) => ref(node) === 'handleStatus');
  const actionsIndex = top.findIndex((node) =>
    children(node).some((child) => ref(child) === 'validate')
  );
  return (
    refs.indexOf('handleControl') > refs.indexOf('handleLabel') &&
    refs.indexOf('handleDescription') > refs.indexOf('handleControl') &&
    errorIndex > refs.indexOf('handleDescription') &&
    statusIndex > top.indexOf(field) &&
    actionsIndex > statusIndex
  );
}

describe.each(families)(
  'Field %s demo feedback/action flow (source and compiled CSS)',
  (family) => {
    it('places handle feedback after its editor/help and before form actions without reserving fixed-height rows', async () => {
      const root = createFieldDemo(family).root;
      expect(stableFeedbackOrder(root)).toBe(true);
      const top = children(children(root)[0]!);
      const handleRoot = top.find((node) => ref(node) === 'handleRoot')!;
      const parts = children(handleRoot);
      expect(parts.map(ref)).toEqual([
        'handleLabel',
        'handleControl',
        'handleDescription',
        'handleError',
      ]);
      expect(parts.find((node) => ref(node) === 'handleError')).toMatchObject({ props: {} });
      const status = top.find((node) => ref(node) === 'handleStatus');
      expect(status).toMatchObject({ attrs: { 'aria-live': 'polite' } });

      const className =
        family === 'base'
          ? 'className' in handleRoot
            ? handleRoot.className!
            : ''
          : [
              ...readFileSync(
                new URL(
                  `../../../../../packages/prototypes/${family}/src/field/root.proto.ts`,
                  import.meta.url
                ),
                'utf8'
              ).matchAll(/tw\('([^']+)'\)/g),
            ]
              .map((match) => match[1])
              .join(' ');
      const utilities = className.split(/\s+/);
      const theme = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
      const compiler = await compile(`${theme}\n@tailwind utilities;`);
      const css = compiler.build(utilities);
      const expectedFlow =
        family === 'base'
          ? 'display: grid'
          : family === 'bootstrap-2-3-2'
            ? 'display: block'
            : 'flex-direction: column';
      expect(css).toContain(expectedFlow);
      expect(css).not.toMatch(
        /column-reverse|row-reverse|(?:^|[;{])\s*(?:height|block-size|order|position)\s*:/
      );
      expect(utilities).not.toContain('grid-flow-dense');
    });

    it('rejects both status-before-field and error-before-description mutations', () => {
      const prior = structuredClone(createFieldDemo(family).root);
      const form = children(prior)[0]!;
      const top = children(form);
      const handleRoot = top.find((node) => ref(node) === 'handleRoot')!;
      const status = top.find((node) => ref(node) === 'handleStatus')!;
      if (!('children' in handleRoot) || !('children' in form))
        throw new Error('Expected demo containers');
      expect(status).toBeDefined();
      form.children = [status, ...top.filter((node) => node !== status)];
      expect(stableFeedbackOrder(prior)).toBe(false);

      const errorBeforeDesc = structuredClone(createFieldDemo(family).root);
      const rootNode = children(children(errorBeforeDesc)[0]!).find(
        (node) => ref(node) === 'handleRoot'
      )!;
      if (!('children' in rootNode)) throw new Error('Expected handleRoot container');
      const handleError = children(rootNode).find((node) => ref(node) === 'handleError')!;
      rootNode.children = [
        handleError,
        ...children(rootNode).filter((node) => node !== handleError),
      ];
      expect(stableFeedbackOrder(errorBeforeDesc)).toBe(false);
    });
  }
);
