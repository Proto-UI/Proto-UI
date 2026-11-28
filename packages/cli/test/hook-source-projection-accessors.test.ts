import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';

async function projectedTokens(
  projection: string,
  options: { name?: string; setup?: string; child?: string; parameters?: string } = {}
) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hook-source-result-spread-'));
  try {
    const name = options.name ?? 'asFacts';
    await writeFile(
      path.join(dir, 'producer.ts'),
      `import { defineAsHook } from '@proto.ui/core';
${options.child ?? ''}
export const ${name} = defineAsHook({ name: 'facts',
  setup(d) { ${options.setup ?? "d.state.bool('alpha', false); d.state.bool('beta', false);"} },
  projectHandle(${options.parameters ?? 'r'}) { ${projection} }
});`
    );
    const file = path.join(dir, 'consumer.proto.ts');
    await writeFile(
      file,
      `import { ${name} } from './producer';
const facts = ${name}();
def.rule({ when: w => w.state(facts.stateHandles.alpha).eq(true),
  intent: i => i.feedback.style.use(tw('ring-black')) });`
    );
    return await collectProtoStyleTokensFromFiles([file]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('hook source projection accessors', () => {
  it.each(['asFacts', 'asRenamedSource'])(
    'retains captured states through a %s result spread',
    async (name) => {
      expect(await projectedTokens('return { ...r };', { name })).toEqual([
        'data-[alpha]:ring-black',
        'ring-black',
      ]);
    }
  );

  it.each([
    [
      'later explicit state bag',
      'return { ...r, stateHandles: { alpha: r.stateHandles.beta } };',
      'beta',
    ],
    [
      'later captured state bag',
      'return { stateHandles: { alpha: r.stateHandles.beta }, ...r };',
      'alpha',
    ],
    [
      'captured accessor alias',
      'return { ...r, stateHandles: { alpha: r.getState("beta") } };',
      'beta',
    ],
  ])('preserves %s overwrite order', async (_label, projection, state) => {
    expect(await projectedTokens(projection)).toEqual([`data-[${state}]:ring-black`, 'ring-black']);
  });

  it('re-exports a proven child state after spreading the parent capture', async () => {
    expect(
      await projectedTokens(
        `const child = r.getAsHookHandle('child');
if (!child) throw new Error('missing child');
return { ...r, stateHandles: child.stateHandles };`,
        {
          child: `const asChild = defineAsHook({ name: 'child',
  setup(d) { d.state.bool('alpha', false); } });`,
          setup: "d.state.bool('outer', false); asChild();",
        }
      )
    ).toEqual(['data-[alpha]:ring-black', 'ring-black']);
  });

  it('does not invent absent parent states that overwrite a selected child bag', async () => {
    expect(
      await projectedTokens(
        "return { stateHandles: r.getAsHookHandle('child').stateHandles, ...r };",
        {
          child: `const asChild = defineAsHook({ name: 'child',
  setup(d) { d.state.bool('alpha', false); } });`,
          setup: 'asChild();',
        }
      )
    ).toEqual(['data-[alpha]:ring-black', 'ring-black']);
  });

  it.each([
    ['unknown spread first', 'return { ...unknownValue, ...r };'],
    ['unknown spread last', 'return { ...r, ...unknownValue };'],
    ['unknown computed key', 'return { ...r, [unknownKey]: r.stateHandles };'],
    ['unknown later state bag', 'return { ...r, stateHandles: unknownValue };'],
    ['prototype setter', 'return { ...r, __proto__: unknownValue };'],
    ['accessor', 'return { ...r, get other() { return r.stateHandles.alpha; } };'],
  ])('withholds Result spread proof for %s', async (_label, projection) => {
    expect(await projectedTokens(projection)).toEqual(['ring-black']);
  });

  it('does not replace an unproved child public projection with its raw states', async () => {
    expect(
      await projectedTokens(
        "return { ...r, stateHandles: r.getAsHookHandle('child').stateHandles };",
        {
          child: `const asChild = defineAsHook({ name: 'child',
  setup(d) { d.state.bool('alpha', false); },
  projectHandle(r) { return { get stateHandles() { return r.stateHandles; } }; } });`,
          setup: 'asChild();',
        }
      )
    ).toEqual(['ring-black']);
  });

  it.each([
    ['Result spread', 'side.read', '{ ...r }'],
    ['explicit state bag', 'side.read', '{ stateHandles: r.stateHandles }'],
    ['Result spread', '{ ...side }', '{ ...r }'],
    ['explicit state bag', '{ ...side }', '{ stateHandles: r.stateHandles }'],
  ])(
    'withholds %s after evaluating %s with an unproved getter',
    async (_label, read, projection) => {
      expect(
        await projectedTokens(`const side = {
  get read() { r.stateHandles = { alpha: r.stateHandles.beta }; return 0; }
};
const ignored = ${read};
return ${projection};`)
      ).toEqual(['ring-black']);
    }
  );

  it.each([
    ['numeric conversion', '+side'],
    ['relational conversion', 'side < 1'],
    ['loose equality', 'side == 0'],
    ['template conversion', '`${side}`'],
    ['computed data key', '{ [side]: 1 }'],
    ['computed method key', '{ [side]() {} }'],
    ['element access key', 'r.stateHandles[side]'],
    ['indexed accessor key', 'r.getState(side)'],
  ])('withholds Result spread after an unproved %s', async (_label, expression) => {
    expect(
      await projectedTokens(`const side = {
  valueOf() { r.stateHandles = { alpha: r.stateHandles.beta }; return 0; },
  toString() { r.stateHandles = { alpha: r.stateHandles.beta }; return 'key'; }
};
const ignored = ${expression};
return { ...r };`)
    ).toEqual(['ring-black']);
  });

  it('withholds Result spread after coercing a detached accessor key', async () => {
    expect(
      await projectedTokens(`const key = {
  toString() { r.stateHandles = { alpha: r.stateHandles.beta }; return 'alpha'; }
};
const get = r.getState;
const ignored = get(key);
return { ...r };`)
    ).toEqual(['ring-black']);
  });

  it('withholds Result spread after an unproved tagged template invocation', async () => {
    expect(
      await projectedTokens(
        'const side = () => { r.stateHandles = { alpha: r.stateHandles.beta }; };' +
          'const ignored = side``; return { ...r };'
      )
    ).toEqual(['ring-black']);
  });

  it('withholds Result spread after an unproved iterator invocation', async () => {
    expect(await projectedTokens('const ignored = [...unknownIterable]; return { ...r };')).toEqual(
      ['ring-black']
    );
  });

  it('retains pure primitive operations and deferred computed methods', async () => {
    expect(
      await projectedTokens(
        'const numeric = 1 + 2; const text = `value:${1}`;' +
          "const deferred = { ['later']() { unknownEffect(); } }; return { ...r };"
      )
    ).toEqual(['data-[alpha]:ring-black', 'ring-black']);
  });

  it.each([
    ['named read', '{ ignored }', 'ignored'],
    ['rest copy', '{ ...ignored }', 'flip'],
  ])('withholds Result spread after an unproved parameter %s', async (_label, binding, key) => {
    expect(
      await projectedTokens('return { ...r };', {
        parameters: `r, ${binding} = {
  get ${key}() { r.stateHandles = { alpha: r.stateHandles.beta }; return 0; }
}`,
      })
    ).toEqual(['ring-black']);
  });

  it('retains a proven first-parameter capture field binding', async () => {
    expect(
      await projectedTokens('return { stateHandles };', { parameters: '{ stateHandles }' })
    ).toEqual(['data-[alpha]:ring-black', 'ring-black']);
  });

  it('closes the actual Brutalist Input focus ring through its authored Input handle', async () => {
    const input = path.resolve('packages/prototypes/brutalist/src/input/root.proto.ts');
    const tokens = await collectProtoStyleTokensFromFiles([input]);
    expect(tokens).toEqual(
      expect.arrayContaining([
        'data-[focus-visible]:outline-none',
        'data-[focus-visible]:ring-2',
        'data-[focus-visible]:ring-offset-2',
        'ring-black',
        'ring-ring',
        'data-[disabled]:cursor-not-allowed',
        'data-[disabled]:opacity-50',
      ])
    );
    const css = renderProtoStyleTokenCss(['data-[focus-visible]:ring-2', 'ring-black']);
    expect(css).toContain('[data-pui-style~="data-[focus-visible]:ring-2"]');
    expect(css).toContain('--pui-ring-color: #000000;');
  });

  it('uses the authored projection state instead of a built-in state table', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-source-rejected-name-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        `import { defineAsHook } from '@proto.ui/core';
export const asFormSubmit = defineAsHook({ name: 'custom',
  setup(d) { d.state.bool('alpha', false); },
  projectHandle: r => ({ noop() {}, stateHandles: { disabled: r.stateHandles.alpha } })
});`
      );
      const file = path.join(dir, 'consumer.proto.ts');
      await writeFile(
        file,
        `import { asFormSubmit } from './producer';
const bag = asFormSubmit().stateHandles;
def.rule({ when: w => w.state(bag.disabled).eq(true),
  intent: i => i.feedback.style.use(tw('bg-primary')) });`
      );
      // The authored projection publishes the author's own state, so the rule
      // lowers against that state. A built-in spelling table for the same
      // hook name would answer `data-[disabled]` instead, so the token also
      // proves that no table substituted the authored handle.
      expect(await collectProtoStyleTokensFromFiles([file])).toEqual([
        'bg-primary',
        'data-[alpha]:bg-primary',
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the members a partly observed projection proved', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'hook-source-partial-projection-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        `import { defineAsHook } from '@proto.ui/core';
export const asParent = defineAsHook({ name: 'parent',
  setup(d) { d.state.bool('alpha', false); },
  projectHandle(r) { return { ...r, stateHandles: { alpha: r.stateHandles.alpha } }; }
});`
      );
      const file = path.join(dir, 'consumer.proto.ts');
      await writeFile(
        file,
        `import { asParent } from './producer';
const bag = asParent().stateHandles;
def.rule({ when: w => w.state(bag.alpha).eq(true),
  intent: i => i.feedback.style.use(tw('bg-primary')) });`
      );
      // A projection that republishes another hook's handles next to a spread
      // of its own result cannot enumerate every key it publishes, but the
      // member it assigns is proven and stays readable.
      expect(await collectProtoStyleTokensFromFiles([file])).toEqual([
        'bg-primary',
        'data-[alpha]:bg-primary',
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ['getter', '{ get ready() { return r.stateHandles.ready; } }'],
    ['setter', '{ set ready(value) { void value; } }'],
    ['method', '{ ready() { return r.stateHandles.ready; } }'],
    ['mixed', '{ ready: r.stateHandles.ready, get other() { return r.stateHandles.ready; } }'],
    ['local', 'local'],
    ['spread', '{ ...{ get ready() { return r.stateHandles.ready; } } }'],
  ])('withholds the public member-set proof for a %s projection', async (label, projection) => {
    const dir = await mkdtemp(path.join(tmpdir(), `hook-source-projection-${label}-`));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const asFacts = defineAsHook({ name: 'facts', setup(d) { d.state.bool('ready', false); },",
          `projectHandle(r) { ${label === 'local' ? 'const local = { get ready() { return r.stateHandles.ready; } };' : ''} return ${projection}; } });`,
          "export const asPlain = defineAsHook({ name: 'plain', setup(d) { d.state.bool('ready', false); }, projectHandle(r) { return { ready: r.stateHandles.ready, later: () => unknownEffect() }; } });",
        ].join('\n')
      );
      const file = path.join(dir, 'consumer.proto.ts');
      const text = [
        "import { asFacts, asPlain } from './producer';",
        'const facts = asFacts();',
        'const plain = asPlain();',
        "def.rule({ when: w => w.state(facts.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-primary')) });",
        "def.rule({ when: w => w.state(plain.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-primary')) });",
      ].join('\n');
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const summary = createHookSourceSummaryContext();
      summary.registerSource(source);
      const calls: ts.CallExpression[] = [];
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'asFacts'
        )
          calls.push(node);
        ts.forEachChild(node, visit);
      };
      visit(source);
      expect(calls).toHaveLength(1);
      const resolved = summary.resolveCall(calls[0]!, source);
      expect(resolved.matched).toBe(true);
      const retained = resolved.value;
      if (label === 'spread') {
        // Object spread invokes this getter during projection. Its body has
        // not been proved effect-free, so completion itself remains unknown.
        // Merely publishing an accessor below does not invoke that accessor.
        expect(retained.kind).toBe('unknown');
      } else {
        if (retained.kind !== 'object')
          throw new Error(`expected a retained projection, received ${retained.kind}`);
        // Retain a deferred member set without claiming it was fully observed.
        expect(retained.uncertainKeys).toBe(true);
        // A member the projection did not prove is never presented as proven.
        for (const member of retained.members.values()) expect(member.kind).toBe('unknown');
      }

      const scan = scanRuleStateReads(text, file, createHookSourceSummaryContext());
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asPlain', state: 'ready' },
      ]);
      expect(scan.unresolved).toEqual([{ expression: 'facts.ready', reason: 'subject' }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
