import { mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { tabsRoot, tabsList, tabsTrigger } from '@proto.ui/prototypes-shadcn/tabs';

import {
  createHookSourceSummaryContext,
  projectStandardRuntimeRootStyleTokens,
} from '../src/services/hook-source-summary';
import {
  collectProtoShadowStyleTokenUsage,
  collectProtoStyleTokensFromFiles,
} from '../src/services/prototype-style-tokens';

describe('native Props initialization before authored hook capture', () => {
  let directory = '';

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'pui-props-prefix-'));
    await writeFile(
      path.join(directory, 'facts.ts'),
      [
        "import { defineAsHook } from '@proto.ui/core';",
        "export const asFacts = defineAsHook({ name: 'props-prefix-facts',",
        "  setup(def) { def.state.bool('selected', false); } });",
        "export const asReplacement = defineAsHook({ name: 'props-prefix-facts',",
        "  setup(def) { def.state.bool('other', false); } });",
      ].join('\n')
    );
  });

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = '';
  });

  const sourceFor = (prefix: string) =>
    [
      "import { definePrototype, tw } from '@proto.ui/core';",
      "import { asFacts, asReplacement } from './facts';",
      "export default definePrototype({ name: 'props-prefix-consumer', setup(def) {",
      prefix,
      'const { selected } = asFacts().stateHandles!;',
      'def.rule({ when: w => w.state(selected).eq(true),',
      "  intent: i => i.feedback.style.use(tw('bg-accent')) });",
      '} });',
    ].join('\n');

  const collect = async (prefix: string) => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(entry, sourceFor(prefix));
    return collectProtoStyleTokensFromFiles([entry]);
  };

  it.each([
    ['empty schema', 'def.props.define({});'],
    ['empty defaults', 'def.props.setDefaults({});'],
    [
      'schema and defaults',
      "def.props.define({ appearance: { type: 'enum', options: ['default', 'underline'], empty: 'fallback' } }); def.props.setDefaults({ appearance: 'default' });",
    ],
  ])('retains the captured State after %s', async (_label, prefix) => {
    const tokens = await collect(prefix);
    expect(tokens).toContain('bg-accent');
    expect(tokens).toContain('data-[selected]:bg-accent');
  });

  it.each(['[]', 'asFacts.modules'])(
    'retains the captured State with empty static modules %s',
    async (modules) => {
      const entry = path.join(directory, 'entry.proto.ts');
      await writeFile(
        entry,
        sourceFor('def.props.define({}); def.props.setDefaults({});').replace(
          "name: 'props-prefix-consumer', setup(def)",
          `name: 'props-prefix-consumer', modules: ${modules}, setup(def)`
        )
      );
      const tokens = await collectProtoStyleTokensFromFiles([entry]);
      expect(tokens).toContain('bg-accent');
      expect(tokens).toContain('data-[selected]:bg-accent');
    }
  );

  it.each([
    ['unknown module list', 'modules: unknownModules,'],
    ['module factory', 'modules: createModules(),'],
    ['nonempty module list', "modules: [{ id: 'custom', config: {} }],"],
    ['module getter', 'get modules() { return []; },'],
    ['module spread', 'modules: [...unknownModules],'],
    ['lookalike metadata', 'modules: foreign.modules,'],
    ['config spread', '...extra, modules: [],'],
    ['duplicate metadata', 'modules: unknownModules, modules: [],'],
  ])('withholds the fresh Props proof for %s', async (_label, metadata) => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({});').replace(
        "name: 'props-prefix-consumer', setup(def)",
        `name: 'props-prefix-consumer', ${metadata} setup(def)`
      )
    );
    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens).toContain('bg-accent');
    expect(tokens).not.toContain('data-[selected]:bg-accent');
  });

  it.each([
    ['nonempty producer modules', "modules: [{ id: 'custom', config: {} }],"],
    ['producer module getter', 'get modules() { return []; },'],
    ['producer config spread', '...extra,'],
    ['producer prototype', '__proto__: inheritedConfig,'],
  ])('does not treat %s as an empty forwarded list', async (_label, metadata) => {
    await writeFile(
      path.join(directory, 'facts.ts'),
      [
        "import { defineAsHook } from '@proto.ui/core';",
        "export const asFacts = defineAsHook({ name: 'props-prefix-facts',",
        metadata,
        "  setup(def) { def.state.bool('selected', false); } });",
      ].join('\n')
    );
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({});').replace(
        "name: 'props-prefix-consumer', setup(def)",
        "name: 'props-prefix-consumer', modules: asFacts.modules, setup(def)"
      )
    );
    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens).toContain('bg-accent');
    expect(tokens).not.toContain('data-[selected]:bg-accent');
  });

  it.each(['increment', 'decrement'])(
    'retains disabled paint for the actual Liquid NumberField %s',
    async (part) => {
      const tokens = await collectProtoStyleTokensFromFiles([
        path.resolve(
          process.cwd(),
          `packages/prototypes/liquid-glass/src/number-field/${part}.proto.ts`
        ),
      ]);
      for (const token of [
        'cursor-not-allowed',
        'shadow-none',
        'bg-muted',
        'text-muted-foreground',
      ])
        expect(tokens).toContain(`data-[disabled]:${token}`);
    }
  );

  it.each([
    [
      'inherited modules',
      "Object.defineProperty(Object.prototype, 'modules', { configurable: true, value: [{ id: 'custom', config: {} }] });",
      'delete Object.prototype.modules;',
    ],
    ['unknown initializer', 'initializeMetadata();', ''],
    ['getter read', 'const metadata = foreign.value;', ''],
    ['class static initialization', 'class Metadata { static value = initializeMetadata(); }', ''],
  ])('withholds the empty snapshot proof after %s', async (_label, prefix, suffix) => {
    await writeFile(
      path.join(directory, 'facts.ts'),
      [
        "import { defineAsHook } from '@proto.ui/core';",
        prefix,
        "export const asFacts = defineAsHook({ name: 'props-prefix-facts',",
        "  setup(def) { def.state.bool('selected', false); } });",
        suffix,
      ].join('\n')
    );
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({});').replace(
        "name: 'props-prefix-consumer', setup(def)",
        "name: 'props-prefix-consumer', modules: asFacts.modules, setup(def)"
      )
    );
    expect(await collectProtoStyleTokensFromFiles([entry])).not.toContain(
      'data-[selected]:bg-accent'
    );
  });

  it('checks creation effects in sibling runtime re-exports', async () => {
    await writeFile(
      path.join(directory, 'barrel.ts'),
      "export { asFacts, asReplacement } from './facts';\nexport * from './metadata-effect';"
    );
    await writeFile(
      path.join(directory, 'metadata-effect.ts'),
      'export const metadata = mutatePrototype();'
    );
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({});')
        .replace("from './facts'", "from './barrel'")
        .replace(
          "name: 'props-prefix-consumer', setup(def)",
          "name: 'props-prefix-consumer', modules: asFacts.modules, setup(def)"
        )
    );
    expect(await collectProtoStyleTokensFromFiles([entry])).not.toContain(
      'data-[selected]:bg-accent'
    );
  });

  it('checks extra factory arguments before accepting a frozen snapshot', async () => {
    await writeFile(
      path.join(directory, 'facts.ts'),
      [
        "import { defineAsHook } from '@proto.ui/core';",
        "export const asFacts = defineAsHook({ name: 'props-prefix-facts',",
        "  setup(def) { def.state.bool('selected', false); } }, mutatePrototype());",
      ].join('\n')
    );
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({});').replace(
        "name: 'props-prefix-consumer', setup(def)",
        "name: 'props-prefix-consumer', modules: asFacts.modules, setup(def)"
      )
    );
    expect(await collectProtoStyleTokensFromFiles([entry])).not.toContain(
      'data-[selected]:bg-accent'
    );
  });

  it('does not assume an omitted root modules property is an own empty list', async () => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({});').replace(
        'export default definePrototype(',
        "Object.defineProperty(Object.prototype, 'modules', { value: [{ id: 'custom', config: {} }] });\nexport default definePrototype("
      )
    );
    expect(await collectProtoStyleTokensFromFiles([entry])).not.toContain(
      'data-[selected]:bg-accent'
    );
  });

  it('retains empty forwarding through closed metadata creation and source wrappers', async () => {
    await writeFile(
      path.join(directory, 'facts.ts'),
      [
        "import * as core from '@proto.ui/core';",
        "import { createContextKey as contextKey, defineAsHook } from '@proto.ui/core';",
        "const context = contextKey('metadata-context');",
        "const family = core.createAnatomyFamily('metadata-family', { roles: { root: {}, child: {} },",
        "  relations: ['child'].map(child => ({ kind: 'contains', parent: 'root', child })) });",
        'function identity(value) { return value; }',
        'function defer(value) { return () => value; }',
        'const metadata = identity(Object.freeze({ context, family }));',
        'const deferred = defer(metadata);',
        "export const asFacts = defineAsHook({ name: 'props-prefix-facts',",
        "  setup(def) { def.state.bool('selected', false); } });",
      ].join('\n')
    );
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({});').replace(
        "name: 'props-prefix-consumer', setup(def)",
        "name: 'props-prefix-consumer', modules: asFacts.modules, setup(def)"
      )
    );
    expect(await collectProtoStyleTokensFromFiles([entry])).toContain('data-[selected]:bg-accent');
  });

  it.each([
    ['creation effect', "Object.defineProperty(Object.prototype, 'modules', { value: [] });\n"],
    ['nonempty snapshot', ''],
  ])('rechecks a replaced dependency with %s before reusing fresh Props', async (label, prefix) => {
    const entry = path.join(directory, 'entry.proto.ts');
    const text = sourceFor('def.props.define({});').replace(
      "name: 'props-prefix-consumer', setup(def)",
      "name: 'props-prefix-consumer', modules: asFacts.modules, setup(def)"
    );
    const source = ts.createSourceFile(entry, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const factsPath = path.join(directory, 'facts.ts');
    const safeFacts = await readFile(factsPath, 'utf8');
    const changedFacts =
      prefix +
      (label === 'nonempty snapshot'
        ? safeFacts.replace(
            "name: 'props-prefix-facts',",
            "name: 'props-prefix-facts', modules: [{ id: 'custom', config: {} }],"
          )
        : safeFacts);
    let call: ts.CallExpression | undefined;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'asFacts'
      )
        call = node;
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(call).toBeDefined();
    const projected = await projectStandardRuntimeRootStyleTokens(source, async ({ summary }) => {
      expect(summary.resolveCall(call!, source).value.kind).toBe('result');
      summary.registerSource(
        ts.createSourceFile(factsPath, changedFacts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      );
      expect(summary.resolveCall(call!, source).value.kind).toBe('unknown');
      summary.registerSource(
        ts.createSourceFile(factsPath, safeFacts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      );
      expect(summary.resolveCall(call!, source).value.kind).toBe('result');
      return [];
    });
    expect(projected).not.toBeNull();
  });

  it.each([
    'producer modules',
    'named barrel',
    'star barrel',
    'local const alias',
    'creation-only effect',
  ])('rechecks a retargeted dependency with %s for the same Root source', async (kind) => {
    const safe = path.join(directory, 'safe-dependency.ts');
    const unsafe = path.join(directory, 'unsafe-dependency.ts');
    const linked = path.join(directory, 'linked-dependency.ts');
    const facts = await readFile(path.join(directory, 'facts.ts'), 'utf8');
    const producerDependency = kind !== 'creation-only effect';
    await writeFile(safe, producerDependency ? facts : 'export const marker = 0;');
    await writeFile(
      unsafe,
      producerDependency
        ? facts.replace(
            "name: 'props-prefix-facts',",
            "name: 'props-prefix-facts', modules: [{ id: 'custom', config: {} }],"
          )
        : "Object.defineProperty(Object.prototype, 'modules', { value: [{ id: 'custom', config: {} }], configurable: true }); export const marker = 0;"
    );
    await symlink(safe, linked);
    const throughBarrel = kind === 'named barrel' || kind === 'star barrel';
    if (throughBarrel)
      await writeFile(
        path.join(directory, 'barrel.ts'),
        kind === 'named barrel'
          ? "export { asFacts, asReplacement } from './linked-dependency';"
          : "export * from './linked-dependency';"
      );
    const entry = path.join(directory, 'entry.proto.ts');
    const text = producerDependency
      ? sourceFor('def.props.define({});')
          .replace(
            "import { asFacts, asReplacement } from './facts';",
            kind === 'local const alias'
              ? "import { asFacts as originalAsFacts, asReplacement } from './linked-dependency'; const asFacts = originalAsFacts;"
              : `import { asFacts, asReplacement } from '${throughBarrel ? './barrel' : './linked-dependency'}';`
          )
          .replace(
            "name: 'props-prefix-consumer', setup(def)",
            "name: 'props-prefix-consumer', modules: asFacts.modules, setup(def)"
          )
      : [
          "import { definePrototype, defineAsHook } from '@proto.ui/core';",
          "import { marker } from './linked-dependency';",
          'const dependency = { marker };',
          "const asFacts = defineAsHook({ name: 'local-facts', setup(def) { def.state.bool('selected', false); } });",
          "export default definePrototype({ name: 'local-consumer', modules: asFacts.modules, setup(def) {",
          'def.props.define({});',
          'const { selected } = asFacts().stateHandles;',
          '} });',
        ].join('\n');
    await writeFile(entry, text);
    const source = ts.createSourceFile(entry, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let call: ts.CallExpression | undefined;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'asFacts'
      )
        call = node;
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(call).toBeDefined();
    const projected = await projectStandardRuntimeRootStyleTokens(source, async ({ summary }) => {
      expect(summary.resolveCall(call!, source).value.kind).toBe('result');
      await unlink(linked);
      await symlink(unsafe, linked);
      const changed = summary.resolveCall(call!, source).value.kind;
      expect(await projectStandardRuntimeRootStyleTokens(source, async () => [])).toBeNull();
      expect(changed).toBe('unknown');
      await unlink(linked);
      await symlink(safe, linked);
      expect(summary.resolveCall(call!, source).value.kind).toBe('result');
      return [];
    });
    expect(projected).not.toBeNull();
  });

  it.each([
    ['unknown earlier call', 'unprovedPrefix(); def.props.define({});'],
    [
      'schema getter that can register a competing hook',
      "def.props.define({ get appearance() { asReplacement(); return { type: 'string' }; } });",
    ],
    ['unknown defaults record', 'def.props.setDefaults(defaults);'],
    ['schema spread', 'def.props.define({ ...schema });'],
    [
      'escaped setup capability',
      'const escaped = def; escaped.props.define = () => asReplacement(); def.props.define({});',
    ],
    [
      'lookalike receiver',
      'const foreign = { props: { define() { asReplacement(); } } }; foreign.props.define({});',
    ],
  ])('withholds the original capture after %s', async (_label, prefix) => {
    const tokens = await collect(prefix);
    expect(tokens).toContain('bg-accent');
    expect(tokens).not.toContain('data-[selected]:bg-accent');
  });

  it('withholds capture when a later setup parameter initializer registers a competing hook', async () => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({});').replace(
        'setup(def) {',
        'setup(def, unused = asReplacement()) {'
      )
    );
    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens).toContain('bg-accent');
    expect(tokens).not.toContain('data-[selected]:bg-accent');
  });

  it('withholds capture when shared Props defaults invoke an existing validator', async () => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      [
        "import { defineAsHook, definePrototype, tw } from '@proto.ui/core';",
        "import { asFacts, asReplacement } from './facts';",
        "const asConsumer = defineAsHook({ name: 'shared-props-consumer', setup(def) {",
        "  def.props.setDefaults({ gate: 'armed' });",
        '  const { selected } = asFacts().stateHandles!;',
        '  def.rule({ when: w => w.state(selected).eq(true),',
        "    intent: i => i.feedback.style.use(tw('bg-accent')) });",
        '} });',
        "export default definePrototype({ name: 'shared-props-owner', setup(def) {",
        "  def.props.define({ gate: { type: 'string', validator() { asReplacement(); return true; } } });",
        '  asConsumer();',
        '} });',
      ].join('\n')
    );
    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens).toContain('bg-accent');
    expect(tokens).not.toContain('data-[selected]:bg-accent');
  });

  it('withholds capture after a getter read following closed Props initialization', async () => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({}); effect.value;').replace(
        'export default definePrototype(',
        'const effect = { get value() { asReplacement(); return 1; } };\nexport default definePrototype('
      )
    );
    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens).toContain('bg-accent');
    expect(tokens).not.toContain('data-[selected]:bg-accent');
  });

  it('keeps same-path SourceFile snapshots independent', async () => {
    const file = path.join(directory, 'entry.proto.ts');
    const safe = 'def.props.define({});';
    const unsafe = 'unprovedPrefix();'.padEnd(safe.length, ' ');
    expect(unsafe.length).toBe(safe.length);
    await writeFile(file, sourceFor(safe));
    const parse = (prefix: string) =>
      ts.createSourceFile(file, sourceFor(prefix), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const first = parse(safe);
    const second = parse(unsafe);
    const callIn = (source: ts.SourceFile): ts.CallExpression => {
      let target: ts.CallExpression | undefined;
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'asFacts'
        )
          target = node;
        ts.forEachChild(node, visit);
      };
      visit(source);
      if (!target) throw new Error('Missing authored hook call');
      return target;
    };
    const ordinary = createHookSourceSummaryContext();
    ordinary.registerSource(first);
    expect(ordinary.resolveCall(callIn(first), first).value.kind).toBe('unknown');
    expect(callIn(first).getStart(first)).toBe(callIn(second).getStart(second));
    const projected = await projectStandardRuntimeRootStyleTokens(first, async ({ summary }) => {
      const resolve = (source: ts.SourceFile) => {
        summary.registerSource(source);
        return summary.resolveCall(callIn(source), source).value;
      };
      expect(resolve(first).kind).toBe('result');
      expect(resolve(second).kind).toBe('unknown');
      expect(resolve(first).kind).toBe('result');
      return [];
    });
    expect(projected?.kind).toBe('standard-runtime-root-style-tokens');
    expect(projected?.source).toBe(first);
    expect(ordinary.resolveCall(callIn(first), first).value.kind).toBe('unknown');
  });

  it('does not treat a named non-entry Prototype as a fresh Runtime Root', async () => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      sourceFor('def.props.define({});').replace(
        'export default definePrototype(',
        'export const namedPrototype = definePrototype('
      )
    );
    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens).toContain('bg-accent');
    expect(tokens).not.toContain('data-[selected]:bg-accent');
  });

  it('keeps ordinary queries unknown when Root projection happens first', async () => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(entry, sourceFor('def.props.define({});'));
    const source = ts.createSourceFile(
      entry,
      sourceFor('def.props.define({});'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    let target: ts.CallExpression | undefined;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'asFacts'
      )
        target = node;
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (!target) throw new Error('Missing authored hook call');
    const call = target;
    const project = () =>
      projectStandardRuntimeRootStyleTokens(source, async ({ kind, summary }) => {
        expect(kind).toBe('standard-runtime-root-style');
        expect(summary.resolveCall(call, source).value.kind).toBe('result');
        return [];
      });
    expect((await project())?.kind).toBe('standard-runtime-root-style-tokens');
    const ordinary = createHookSourceSummaryContext();
    ordinary.registerSource(source);
    expect(ordinary.resolveCall(call, source).value.kind).toBe('unknown');
    expect((await project())?.kind).toBe('standard-runtime-root-style-tokens');
    expect(ordinary.resolveCall(call, source).value.kind).toBe('unknown');
  });

  it('keeps shared-hook facts out of later entries in both file orders', async () => {
    const first = path.join(directory, 'first.proto.ts');
    const second = path.join(directory, 'second.proto.ts');
    await writeFile(first, sourceFor('def.props.define({});'));
    await writeFile(
      second,
      [
        "import { defineAsHook, definePrototype, tw } from '@proto.ui/core';",
        "import { asFacts, asReplacement } from './facts';",
        "const asConsumer = defineAsHook({ name: 'other-shared-consumer', setup(def) {",
        "  def.props.setDefaults({ gate: 'armed' });",
        '  const { selected } = asFacts().stateHandles!;',
        '  def.rule({ when: w => w.state(selected).eq(true),',
        "    intent: i => i.feedback.style.use(tw('bg-destructive')) });",
        '} });',
        "export default definePrototype({ name: 'other-shared-owner', setup(def) {",
        "  def.props.define({ gate: { type: 'string', validator() { asReplacement(); return true; } } });",
        '  asConsumer();',
        '} });',
      ].join('\n')
    );
    for (const files of [
      [first, second],
      [second, first],
    ]) {
      const tokens = await collectProtoStyleTokensFromFiles(files);
      expect(tokens).toContain('data-[selected]:bg-accent');
      expect(tokens).toContain('bg-destructive');
      expect(tokens).not.toContain('data-[selected]:bg-destructive');
    }
  });

  it('withholds capture in a Prototype setup borrowed by another Root', async () => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asFacts, asReplacement } from './facts';",
        "const borrowed = definePrototype({ name: 'borrowed-prototype', setup(def) {",
        "  def.props.setDefaults({ gate: 'armed' });",
        '  const { selected } = asFacts().stateHandles!;',
        '  def.rule({ when: w => w.state(selected).eq(true),',
        "    intent: i => i.feedback.style.use(tw('bg-accent')) });",
        '} });',
        "export default definePrototype({ name: 'borrowing-root', setup(def) {",
        "  def.props.define({ gate: { type: 'string', validator() { asReplacement(); return true; } } });",
        '  borrowed.setup(def);',
        '} });',
      ].join('\n')
    );
    const tokens = await collectProtoStyleTokensFromFiles([entry]);
    expect(tokens).toContain('bg-accent');
    expect(tokens).not.toContain('data-[selected]:bg-accent');
  });

  it('keeps a projected Rule token on both Root and Template targets', async () => {
    const entry = path.join(directory, 'entry.proto.ts');
    await writeFile(
      entry,
      [
        "import { definePrototype, tw } from '@proto.ui/core';",
        "import { asFacts } from './facts';",
        "export default definePrototype({ name: 'shared-style-token', setup(def) {",
        '  def.props.define({});',
        '  const { selected } = asFacts().stateHandles!;',
        '  def.rule({ when: w => w.state(selected).eq(true),',
        "    intent: i => i.feedback.style.use(tw('bg-accent')) });",
        "  return r => r.el('span', { style: tw('data-[selected]:bg-accent italic') }, 'content');",
        '} });',
      ].join('\n')
    );
    const usage = await collectProtoShadowStyleTokenUsage(directory);
    expect(usage.templateTokens).toContain('data-[selected]:bg-accent');
    expect(usage.rootTokens).toContain('data-[selected]:bg-accent');
    expect(usage.templateTokens).toContain('italic');
    expect(usage.rootTokens).not.toContain('italic');
  });

  it('retains the actual Shadcn Tabs selected and focus rule tokens', async () => {
    const tokens = await collectProtoStyleTokensFromFiles([
      path.resolve(process.cwd(), 'packages/prototypes/shadcn/src/tabs/trigger.proto.ts'),
    ]);
    // Appearance is mutable Props input, so these actual Rules remain in
    // Runtime evaluation. Their resources are raw paint, not the former
    // pure-State selector projection.
    const paint = [
      ['selected', 'bg-background'],
      ['selected', 'shadow-sm'],
      ['focus-visible', 'ring-3'],
      ['focus-visible', 'outline-1'],
    ] as const;
    for (const [state, token] of paint) {
      expect(tokens).toContain(token);
      expect(tokens).not.toContain(`data-[${state}]:${token}`);
    }

    const Root = AdaptToWebComponent(tabsRoot, { register: false });
    const List = AdaptToWebComponent(tabsList, { register: false });
    const Trigger = AdaptToWebComponent(tabsTrigger, { register: false });
    const tag = path.basename(directory).toLowerCase();
    customElements.define(`${tag}-root`, Root);
    customElements.define(`${tag}-list`, List);
    customElements.define(`${tag}-trigger`, Trigger);
    const root = new Root();
    const list = new List();
    const trigger = new Trigger();
    setElementProps(root, { value: 'a', activationMode: 'manual' });
    setElementProps(trigger, { value: 'a' });
    trigger.textContent = 'Alpha';
    list.append(trigger);
    root.append(list);
    const flush = async () => {
      for (let index = 0; index < 6; index++) await Promise.resolve();
    };
    const currentTokens = () =>
      (trigger.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean).sort();
    let restoreMatches: (() => void) | undefined;
    try {
      document.body.append(root);
      await vi.waitFor(() => expect(trigger.getExposes().selected.get()).toBe(true));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      const matches = vi.spyOn(trigger, 'matches').mockReturnValue(true);
      restoreMatches = () => matches.mockRestore();
      trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      await flush();
      const state = trigger.getExposes();
      expect(state.selected.get()).toBe(true);
      expect(state.focusVisible.get()).toBe(true);
      const before = currentTokens();
      for (const [, token] of paint) expect(before).toContain(token);
      for (const token of before) expect(tokens).toContain(token);

      setElementProps(trigger, { value: 'a', appearance: 'underline' });
      await flush();
      expect(trigger.getExposes().selected).toBe(state.selected);
      expect(trigger.getExposes().focusVisible).toBe(state.focusVisible);
      expect(state.selected.get()).toBe(true);
      expect(state.focusVisible.get()).toBe(true);
      const underline = currentTokens();
      for (const [, token] of paint) expect(underline).not.toContain(token);
      expect(underline).toContain('bg-transparent');
      expect(underline).toContain('outline-2');
      for (const token of underline) expect(tokens).toContain(token);

      setElementProps(trigger, { value: 'a', appearance: 'default' });
      await flush();
      expect(trigger.getExposes().selected).toBe(state.selected);
      expect(trigger.getExposes().focusVisible).toBe(state.focusVisible);
      expect(state.selected.get()).toBe(true);
      expect(state.focusVisible.get()).toBe(true);
      expect(currentTokens()).toEqual(before);
    } finally {
      restoreMatches?.();
      root.remove();
      await flush();
    }
  });

  it('retains the actual Brutalist Toggle active paint and pressed inset rules', async () => {
    const tokens = await collectProtoStyleTokensFromFiles([
      path.resolve(process.cwd(), 'packages/prototypes/brutalist/src/toggle/toggle.proto.ts'),
    ]);
    expect(tokens).toContain('data-[active]:bg-main');
    expect(tokens).toContain('data-[active]:text-main-foreground');
    expect(tokens).toContain('data-[active]:data-[pressed]:shadow-[inset_0_0_0_2px_#000]');
    expect(tokens).toContain('data-[active]:not-[data-pressed]:shadow-[inset_0_0_0_2px_#000]');
  });
});
