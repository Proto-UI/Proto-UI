import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
