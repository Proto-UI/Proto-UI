import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

import { TOGGLE_SIZE } from '../../prototypes/shadcn/src/toggle/profiles';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const itemFile = path.join(ROOT, 'packages/prototypes/shadcn/src/toggle-group/item.proto.ts');
// Frozen runtime outputs from item blob c2dcb7e92e0b79030ef66ec21e64d417e1468f18
// and profiles blob bf598b4fdb8875f85e9f65a36ca96168ffa11674. The three special
// branches and every fallback keep their exact token strings and ordering.
const expected = [
  ['vega', 'default', 'h-9 min-w-9 px-2.5'],
  ['vega', 'sm', 'h-8 min-w-8 px-2.5'],
  ['vega', 'lg', 'h-10 min-w-10 px-2.5'],
  ['nova', 'default', 'h-8 min-w-8 px-2.5'],
  ['nova', 'sm', 'h-7 min-w-7 rounded-[min(var(--pui-radius-md),12px)] px-2.5 text-[0.8rem]'],
  ['nova', 'lg', 'h-9 min-w-9 px-2.5'],
  ['maia', 'default', 'h-9 min-w-9 px-3'],
  ['maia', 'sm', 'h-8 min-w-8 px-3'],
  ['maia', 'lg', 'h-10 min-w-10 px-4'],
  ['lyra', 'default', 'h-8 min-w-8 px-2.5'],
  ['lyra', 'sm', 'h-7 min-w-7 px-2.5'],
  ['lyra', 'lg', 'h-9 min-w-9 px-2.5'],
  ['mira', 'default', 'h-7 min-w-7 px-2'],
  ['mira', 'sm', 'h-6 min-w-6 rounded-[min(var(--pui-radius-md),8px)] px-2 text-[0.625rem]'],
  ['mira', 'lg', 'h-8 min-w-8 px-2.5'],
  ['luma', 'default', 'h-9 min-w-9 px-3'],
  ['luma', 'sm', 'h-8 min-w-8 px-3'],
  ['luma', 'lg', 'h-10 min-w-10 px-4'],
  ['sera', 'default', 'h-10 min-w-10 px-6'],
  ['sera', 'sm', 'h-9 min-w-9 px-4'],
  ['sera', 'lg', 'h-11 min-w-11 px-8'],
  ['rhea', 'default', 'h-8 min-w-8 px-2.5'],
  ['rhea', 'sm', 'h-7 min-w-7 px-2.5'],
  ['rhea', 'lg', 'h-9 min-w-9 px-2.5'],
  ['new-york-v4', 'default', 'h-9 px-3'],
  ['new-york-v4', 'sm', 'h-8 min-w-8 px-1.5'],
  ['new-york-v4', 'lg', 'h-10 min-w-10 px-2.5'],
] as const;
const legacyHelper =
  "function resolveToggleGroupItemSize(profile               , size                         )         {\n  if (profile === 'new-york-v4' && size === 'default') return 'h-9 px-3';\n  if (profile === 'nova' && size === 'sm')\n    return 'h-7 min-w-7 rounded-[min(var(--pui-radius-md),12px)] px-2.5 text-[0.8rem]';\n  if (profile === 'mira' && size === 'sm')\n    return 'h-6 min-w-6 rounded-[min(var(--pui-radius-md),8px)] px-2 text-[0.625rem]';\n  return TOGGLE_SIZE[`${profile}-${size}`];\n}\n";

function tokenExpression(text: string): string {
  const source = ts.createSourceFile(itemFile, text, ts.ScriptTarget.Latest, true);
  const expressions: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'rule' &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const config = node.arguments[0];
      const properties = config.properties.filter(ts.isPropertyAssignment);
      const when = properties.find((property) => property.name.getText(source) === 'when');
      const intent = properties.find((property) => property.name.getText(source) === 'intent');
      if (when?.initializer.getText(source).includes('w.state(resolvedSize).eq(size)') && intent) {
        const findToken = (part: ts.Node): void => {
          if (
            ts.isCallExpression(part) &&
            ts.isIdentifier(part.expression) &&
            part.expression.text === 'tw' &&
            part.arguments.length === 1
          )
            expressions.push(part.arguments[0].getText(source));
          ts.forEachChild(part, findToken);
        };
        findToken(intent.initializer);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(expressions).toHaveLength(1);
  return expressions[0];
}

async function producedTokens(expression: string, helper = '') {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-toggle-size-tokens-')));
  try {
    await writeFile(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(ROOT, 'tsconfig.json') })
    );
    const relative = path.relative(
      directory,
      path.join(ROOT, 'packages/prototypes/shadcn/src/toggle/profiles.ts')
    );
    const specifier = relative.startsWith('.') ? relative : './' + relative;
    const profiles = [...new Set(expected.map(([profile]) => profile))];
    const source = `
      import { definePrototype, tw } from '@proto.ui/core';
      import { TOGGLE_SIZE } from ${JSON.stringify(specifier)};
      ${helper}
      export default definePrototype({ name: 'actual-toggle-size-expression', setup(def) {
        const style = def.state.enum('profile', 'nova', { options: ${JSON.stringify(profiles)} });
        const resolvedSize = def.state.enum('size', 'default', { options: ['default', 'sm', 'lg'] });
        def.expose.state('profile', style);
        def.expose.state('size', resolvedSize);
        for (const profile of ${JSON.stringify(profiles)}) {
          for (const size of ['default', 'sm', 'lg']) {
            def.rule({
              when: w => w.all(w.state(style).eq(profile), w.state(resolvedSize).eq(size)),
              intent: i => i.feedback.style.use(tw(${expression})),
            });
          }
        }
      } });
    `;
    const file = path.join(directory, 'consumer.proto.ts');
    await writeFile(file, source);
    return await collectProtoStyleTokensFromFiles([file]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('Shadcn ToggleGroup size recipes remain visible to preset collection', () => {
  let expression = '';
  beforeAll(async () => {
    expression = tokenExpression(await readFile(itemFile, 'utf8'));
  });

  it.each(expected)('preserves the original %s / %s output', (profile, size, tokens) => {
    // Execute only the actual finite expression, with the real literal table.
    // This does not load or run the prototype setup or fabricate a Def handle.
    const evaluate = new Function('profile', 'size', 'TOGGLE_SIZE', 'return (' + expression + ');');
    expect(evaluate(profile, size, TOGGLE_SIZE)).toBe(tokens);
  });

  it('collects every runtime size token under its real profile and size selector', async () => {
    const tokens = await producedTokens(expression);
    for (const [profile, size, output] of expected) {
      const prefix = `data-[profile=${profile}]:data-[size=${size}]:`;
      for (const token of output.split(/\s+/)) expect(tokens).toContain(prefix + token);
    }
  });

  it('demonstrates the previous opaque return gap through the same production collector', async () => {
    const tokens = await producedTokens('resolveToggleGroupItemSize(profile, size)', legacyHelper);
    expect(tokens.filter((token) => token.startsWith('data-[profile='))).toEqual([]);
  });
});
