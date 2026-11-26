// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createRuntimeSession } from '@proto.ui/runtime';
import type { Prototype } from '@proto.ui/core';
import type { FeedbackFacade } from '@proto.ui/module-feedback';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { fieldRoot as shadcnField } from '@proto.ui/prototypes-shadcn/field';
import { fieldRoot as brutalistField } from '@proto.ui/prototypes-brutalist/field';
import { fieldRoot as bootstrapField } from '@proto.ui/prototypes-bootstrap-2-3-2/field';
import { fieldRoot as liquidField } from '@proto.ui/prototypes-liquid-glass/field';
import type { DemoNode } from '../../components/PrototypePreviewer/demo-types';
import { createFieldDemo } from './field-demo.shared';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { compile } = require('tailwindcss') as typeof import('tailwindcss');
const families = ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];
const fieldPrototypes: Record<string, Prototype<any>> = {
  shadcn: shadcnField,
  brutalist: brutalistField,
  'bootstrap-2-3-2': bootstrapField,
  'liquid-glass': liquidField,
};
const children = (node: DemoNode): DemoNode[] =>
  'children' in node
    ? (node.children ?? []).filter((child): child is DemoNode => typeof child !== 'string')
    : [];
const ref = (node: DemoNode) => ('ref' in node ? node.ref : undefined);
function formContent(root: DemoNode): DemoNode | undefined {
  if (children(root).some((node) => ref(node) === 'handleRoot')) return root;
  return children(root).map(formContent).find(Boolean);
}
function formActionFlow(root: DemoNode) {
  const form = formContent(root);
  if (!form) return false;
  const top = children(form);
  const field = top.find((node) => ref(node) === 'handleRoot');
  const footer = top.find((node) => children(node).some((part) => ref(part) === 'reset'));
  if (!field || !footer) return false;
  return (
    children(field).map(ref).join(',') ===
      'handleLabel,handleControl,handleDescription,handleError' &&
    top.findIndex((node) => ref(node) === 'handleStatus') === top.indexOf(field) + 1 &&
    footer.kind === 'box' &&
    top.at(-1) === footer &&
    children(footer).map(ref).join(',') === 'validate,reset'
  );
}

async function fieldUtilities(family: string, field: DemoNode): Promise<string[]> {
  if (family === 'base') return 'className' in field ? (field.className ?? '').split(/\s+/) : [];
  const prototype = fieldPrototypes[family];
  const target = new EventTarget();
  const session = createRuntimeSession(prototype, {
    prototypeName: prototype.name,
    getRawProps: () => (field.kind === 'proto' ? (field.props ?? {}) : {}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, target],
        [CONTEXT_PARENT_CAP, () => null],
      ]);
      wiring.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, target],
        [ANATOMY_PARENT_CAP, () => null],
        [ANATOMY_GET_PROTO_CAP, () => prototype],
      ]);
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => target],
        [EVENT_GLOBAL_TARGET_CAP, () => target],
      ]);
    },
  });
  try {
    await session.mount();
    return [...(session.caps.getFacades().feedback as FeedbackFacade).style.exportMerged().tokens];
  } finally {
    await session.dispose();
  }
}

describe.each(families)(
  'Field %s demo feedback/action flow (source and compiled CSS)',
  (family) => {
    it('keeps local Field feedback in normal flow and shared form commands in their own footer', async () => {
      const root = createFieldDemo(family).root;
      expect(formActionFlow(root)).toBe(true);
      const form = formContent(root)!;
      const field = children(form).find((node) => ref(node) === 'handleRoot')!;
      const parts = children(field);
      expect(parts.map(ref)).toEqual([
        'handleLabel',
        'handleControl',
        'handleDescription',
        'handleError',
      ]);
      expect(parts.find((node) => ref(node) === 'handleError')).toMatchObject({ props: {} });
      const status = children(form).find((node) => ref(node) === 'handleStatus');
      expect(status).toMatchObject({ attrs: { 'aria-live': 'polite' } });
      // The current shared Reset validation command resets both username and
      // handle. It is not the old asynchronous Field's local Cancel command.
      // This source/CSS oracle does not claim native footer hit stability.
      const footer = children(form).at(-1)!;
      expect(children(footer)).toMatchObject([
        { prototypeId: `${family}-button`, ref: 'validate', children: ['Save changes'] },
        { prototypeId: `${family}-button`, ref: 'reset', children: ['Reset validation'] },
      ]);

      // Read the complete real default projection, including orientation Rules
      // and shared recipes. The first tw() literal alone omits those owners.
      const utilities = await fieldUtilities(family, field);
      const theme = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
      const compiler = await compile(`${theme}\n@tailwind utilities;`);
      const css = compiler.build(utilities);
      expect(css).toContain(
        family === 'base'
          ? 'display: grid'
          : family === 'bootstrap-2-3-2'
            ? 'display: block'
            : 'flex-direction: column'
      );
      expect(utilities).not.toContain('flex-row');
      expect(css).not.toMatch(
        /column-reverse|row-reverse|(?:^|[;{])\s*(?:height|block-size|order|position)\s*:/
      );
      expect(utilities).not.toContain('grid-flow-dense');
      for (const [container, display] of [
        [form, 'display: grid'],
        [footer, 'display: flex'],
      ] as const) {
        const containerUtilities =
          'className' in container ? container.className!.split(/\s+/) : [];
        const containerCss = compiler.build(containerUtilities);
        expect(containerCss).toContain(display);
        expect(containerCss).not.toMatch(
          /column-reverse|row-reverse|(?:^|[;{])\s*(?:height|block-size|order|position)\s*:/
        );
        expect(containerUtilities).not.toContain('grid-flow-dense');
      }
      expect('className' in footer && footer.className?.split(/\s+/)).toContain('flex-wrap');
    });

    it('rejects a shared footer nested in one Field and feedback moved before its editor', () => {
      const nested = structuredClone(createFieldDemo(family).root);
      const form = formContent(nested)!;
      const field = children(form).find((node) => ref(node) === 'handleRoot')!;
      const footer = children(form).at(-1)!;
      if (!('children' in field) || !('children' in form))
        throw new Error('Expected demo containers');
      form.children = children(form).filter((node) => node !== footer);
      field.children!.push(footer);
      expect(formActionFlow(nested)).toBe(false);

      const reordered = structuredClone(createFieldDemo(family).root);
      const reorderedField = children(formContent(reordered)!).find(
        (node) => ref(node) === 'handleRoot'
      )!;
      if (!('children' in reorderedField)) throw new Error('Expected Field container');
      const error = children(reorderedField).find((node) => ref(node) === 'handleError')!;
      reorderedField.children = children(reorderedField).filter((node) => node !== error);
      reorderedField.children.splice(1, 0, error);
      expect(formActionFlow(reordered)).toBe(false);
    });
  }
);
