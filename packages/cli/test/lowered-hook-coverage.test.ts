import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createExposeStateWebNameMap } from '../../modules/expose-state-web/src/utils';
import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import type { HookSourceState } from '../src/services/hook-source-summary';
import {
  collectProtoStyleTokens,
  collectProtoStyleTokensFromFiles,
  collectSourceFiles,
  loweredHookStates,
} from '../src/services/prototype-style-tokens';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PROTOTYPE_PACKAGES = path.join(REPO_ROOT, 'packages/prototypes');

/**
 * The same file set the extractor reads, taken from the extractor itself. A
 * private glob here would be free to be narrower than production, which is the
 * blind spot this gate exists to remove.
 */
async function prototypeSourceFiles(): Promise<string[]> {
  const packages = await readdir(PROTOTYPE_PACKAGES, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of packages) {
    if (!entry.isDirectory()) continue;
    const src = path.join(PROTOTYPE_PACKAGES, entry.name, 'src');
    try {
      files.push(...((await collectSourceFiles(src)) as string[]));
    } catch (error) {
      // A package without a src directory contributes nothing. Any other
      // traversal failure would silently drop a whole package from the gate.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return files;
}

/**
 * A `rule` call's callee is named `rule`, so a file whose text lacks that word
 * cannot contain one however the call is punctuated — `def.rule?.({})` and
 * `def.rule /* note *\/ ({})` both keep it. Matching the word rather than the
 * call shape keeps the scanned set identical to production while not building a
 * TypeScript AST for every type and index module under `src`.
 */
const RULE_CALL = /\brule\b/;

/** A real intent: the variant is a prefix on tokens, so a stub yields nothing. */
const rule = (condition: string) =>
  `def.rule({ when: (w) => ${condition}, intent: (i) => i.feedback.style.use(tw('bg-primary')) });`;

/**
 * What the normalized attribute has to satisfy: `data-<attribute>` is writable
 * and `[data-<attribute>]` selects it. A leading digit satisfies both, so an
 * identifier rule here would add a naming restriction no contract states.
 */
const SELECTABLE_ATTRIBUTE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('lowered hook coverage', () => {
  describe('PR925 source provenance regressions', () => {
    const expectSourceUsages = (
      scan: ReturnType<typeof scanRuleStateReads>,
      producerFile: string,
      expected: ReadonlyArray<{ hook: string; state: string }>
    ): void => {
      expect(
        scan.usages.map(({ hook, state, provenance }) => ({
          hook,
          state,
          declaredName: provenance?.declaredName,
        }))
      ).toEqual(expected.map(({ hook, state }) => ({ hook, state, declaredName: state })));
      expect(
        scan.usages.map(({ provenance }) => ({
          owner: provenance?.owner.file,
          declaration: provenance?.declaration.file,
        }))
      ).toEqual(expected.map(() => ({ owner: producerFile, declaration: producerFile })));
    };

    const scanWithFreshSummary = (source: string, file: string) =>
      scanRuleStateReads(source, file, createHookSourceSummaryContext());

    it('tracks identifier logical writes without executing skipped right sides', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-identifier-logical-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({name:'a', setup(d){d.state.bool('alpha',false)}, projectHandle:r=>({ready:r.stateHandles.alpha})});",
            "export const asB = defineAsHook({name:'b', setup(d){d.state.bool('beta',false)}, projectHandle:r=>({ready:r.stateHandles.beta})});",
          ].join('\n')
        );
        for (const operator of ['&&=', '||=', '??=']) {
          const file = path.join(dir, 'consumer.proto.ts');
          const source = [
            "import{asA,asB}from'./producer';",
            'let ready=asA().ready;',
            `ready ${operator} asB().ready;`,
            rule('w.state(ready).eq(true)'),
          ].join('\n');
          const expected = operator === '&&=' ? 'beta' : 'alpha';
          const scan = scanWithFreshSummary(source, file);
          expect(scan.usages.map((usage) => usage.state)).toEqual([expected]);
          expect(scan.unresolved).toEqual([]);
          await writeFile(file, source);
          const tokens = await collectProtoStyleTokensFromFiles([file]);
          expect(tokens).toContain(`data-[${expected}]:bg-primary`);
          expect(tokens).not.toContain(
            `data-[${expected === 'alpha' ? 'beta' : 'alpha'}]:bg-primary`
          );
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('tracks a mutating call on a source-backed container and keeps independent handles', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-mutation-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
            "export const asC = defineAsHook({ name: 'c', setup(d) { d.state.bool('gamma', false); }, projectHandle(r) { return { ready: r.stateHandles.gamma }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const consumer = [
          "import { asA, asB, asC } from './producer';",
          'const bag = asA();',
          'const alias = bag;',
          'const independent = asC();',
          'Object.assign(bag, asB());',
          rule('w.state(bag.ready).eq(true)'),
          "def.rule({ when: w => w.state(alias.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
          "def.rule({ when: w => w.state(independent.ready).eq(true), intent: i => i.feedback.style.use(tw('ring-2')) });",
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
          { hook: 'asB', state: 'beta' },
          { hook: 'asB', state: 'beta' },
          { hook: 'asC', state: 'gamma' },
        ]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[beta]:bg-primary');
        expect(tokens).not.toContain('data-[alpha]:bg-primary');
        expect(tokens).toContain('data-[beta]:underline');
        expect(tokens).toContain('data-[gamma]:ring-2');
        expect(tokens).not.toContain('data-[gamma]:underline');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('withholds a container proof after an unknown call receives it', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-escape-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const consumer = [
          "import { asA } from './producer';",
          'const bag = asA();',
          'const alias = bag;',
          'mutate(bag);',
          rule('w.state(bag.ready).eq(true)'),
          "def.rule({ when: w => w.state(alias.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved.map((read) => read.expression)).toEqual([
          'bag.ready',
          'alias.ready',
        ]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).not.toContain('data-[alpha]:bg-primary');
        expect(tokens).not.toContain('data-[alpha]:underline');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('reads a call argument as the object it was when the argument was evaluated', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-argument-identity-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // The call receives the object the first argument denoted while that
        // argument was evaluated, so the later argument that rebinds the name
        // does not move the mutation onto the container the name holds later.
        const consumer = [
          "import { asA, asB } from './producer';",
          'let bag = asA();',
          'const alias = bag;',
          'mutate(bag, (bag = asB()));',
          rule('w.state(alias.ready).eq(true)'),
          "def.rule({ when: w => w.state(bag.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved.map((read) => read.expression)).toEqual([
          'alias.ready',
          'bag.ready',
        ]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).not.toContain('data-[alpha]:bg-primary');
        expect(tokens).not.toContain('data-[alpha]:underline');
        expect(tokens).not.toContain('data-[beta]:underline');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('withholds a copy whose source has an unproved alternative', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-copy-alternative-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // The empty branch copies nothing, so the copy is only proven when
        // every alternative copies the same members.
        const consumer = [
          "import { asA, asB } from './producer';",
          'const bag = asA();',
          'const alias = bag;',
          'Object.assign(bag, flag ? asB() : {});',
          rule('w.state(alias.ready).eq(true)'),
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved.map((read) => read.expression)).toEqual(['alias.ready']);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).not.toContain('data-[alpha]:bg-primary');
        expect(tokens).not.toContain('data-[beta]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('keeps the original graph of a copy target the call may not have reached', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-ambiguous-target-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
            "export const asC = defineAsHook({ name: 'c', setup(d) { d.state.bool('gamma', false); }, projectHandle(r) { return { ready: r.stateHandles.gamma }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // Only one of the two targets is written, so the other keeps the
        // members it held.
        const consumer = [
          "import { asA, asB, asC } from './producer';",
          'const a = asA();',
          'const b = asB();',
          'Object.assign(flag ? a : b, asC());',
          rule('w.state(a.ready).eq(true)'),
          "def.rule({ when: w => w.state(b.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
          { hook: 'asC', state: 'gamma' },
          { hook: 'asA', state: 'alpha' },
          { hook: 'asC', state: 'gamma' },
          { hook: 'asB', state: 'beta' },
        ]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[gamma]:bg-primary');
        expect(tokens).toContain('data-[alpha]:bg-primary');
        expect(tokens).toContain('data-[gamma]:underline');
        expect(tokens).toContain('data-[beta]:underline');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('keeps the producer a copied state came from through a chained copy', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-chained-copy-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
            "export const asC = defineAsHook({ name: 'c', setup(d) { d.state.bool('gamma', false); }, projectHandle(r) { return { ready: r.stateHandles.gamma }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // The second copy moves B's state again, so the producer of that state
        // stays B rather than becoming the producer of the container it was
        // copied through.
        const consumer = [
          "import { asA, asB, asC } from './producer';",
          'const a = asA();',
          'const b = asB();',
          'const c = asC();',
          'Object.assign(a, b);',
          'Object.assign(c, a);',
          rule('w.state(b.ready).eq(true)'),
          "def.rule({ when: w => w.state(c.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
          { hook: 'asB', state: 'beta' },
          { hook: 'asB', state: 'beta' },
        ]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[beta]:bg-primary');
        expect(tokens).not.toContain('data-[alpha]:bg-primary');
        expect(tokens).toContain('data-[beta]:underline');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('copies into the container an argument still denotes after an argument wrote to it', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-stale-target-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // The member write replaces the container's graph before the call runs,
        // so the copy lands on the container the argument still denotes.
        const consumer = [
          "import { asA, asB } from './producer';",
          'const bag = asA();',
          'Object.assign(bag, (bag.extra = asB()));',
          rule('w.state(bag.ready).eq(true)'),
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
          { hook: 'asB', state: 'beta' },
        ]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[beta]:bg-primary');
        expect(tokens).not.toContain('data-[alpha]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('keeps the outer proof when only a deferred copy could have reached it', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-deferred-copy-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // The copy sits in a function that never runs, so the outer container
        // keeps the members it held and the copy stays a candidate.
        const consumer = [
          "import { asA, asB } from './producer';",
          'const bag = asA();',
          'function updateLater() { const alias = bag; Object.assign(alias, asB()); }',
          rule('w.state(bag.ready).eq(true)'),
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
          { hook: 'asB', state: 'beta' },
          { hook: 'asA', state: 'alpha' },
        ]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[beta]:bg-primary');
        expect(tokens).toContain('data-[alpha]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('withholds a copy whose members come from more than one producer', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-mixed-copy-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
            "export const asC = defineAsHook({ name: 'c', setup(d) { d.state.bool('gamma', false); }, projectHandle(r) { return { ready: r.stateHandles.gamma }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // The copied members belong to two producers, so no single label names
        // them and the copy is not proven.
        const consumer = [
          "import { asA, asB, asC } from './producer';",
          'const a = asA();',
          'const b = asB();',
          'const c = asC();',
          'const mixed = { first: b.ready, second: c.ready };',
          'Object.assign(a, { first: b.ready, second: c.ready });',
          'Object.assign(a, mixed);',
          rule('w.state(b.ready).eq(true)'),
          "def.rule({ when: w => w.state(c.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
          "def.rule({ when: w => w.state(a.first).eq(true), intent: i => i.feedback.style.use(tw('ring-2')) });",
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
          { hook: 'asB', state: 'beta' },
          { hook: 'asC', state: 'gamma' },
        ]);
        expect(scan.unresolved.map((read) => read.expression)).toEqual(['a.first']);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[beta]:bg-primary');
        expect(tokens).toContain('data-[gamma]:underline');
        expect(tokens).not.toContain('data-[beta]:underline');
        expect(tokens).not.toContain('data-[ring-2]');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('gives every candidate target of a copy its own latest container', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-target-identity-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
            "export const asC = defineAsHook({ name: 'c', setup(d) { d.state.bool('gamma', false); }, projectHandle(r) { return { ready: r.stateHandles.gamma }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // The copy reaches one of the two containers, so each keeps the
        // members it held as an alternative.
        const consumer = [
          "import { asA, asB, asC } from './producer';",
          'const a = asA();',
          'const b = asB();',
          'const chosen = flag ? a : b;',
          'Object.assign(chosen, asC());',
          rule('w.state(a.ready).eq(true)'),
          "def.rule({ when: w => w.state(b.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
          { hook: 'asC', state: 'gamma' },
          { hook: 'asA', state: 'alpha' },
          { hook: 'asC', state: 'gamma' },
          { hook: 'asB', state: 'beta' },
        ]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[gamma]:bg-primary');
        expect(tokens).toContain('data-[alpha]:bg-primary');
        expect(tokens).toContain('data-[gamma]:underline');
        expect(tokens).toContain('data-[beta]:underline');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('reads a copy source as it is when the call runs, not as it was captured', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-call-source-identity-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
            "export const asC = defineAsHook({ name: 'c', setup(d) { d.state.bool('gamma', false); }, projectHandle(r) { return { extra: r.stateHandles.gamma }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // The third argument writes C's container into the source before the
        // call runs, so the copy reads that object and not the old state, and
        // C contributes only its own member.
        const consumer = [
          "import { asA, asB, asC } from './producer';",
          'const a = asA();',
          'const b = asB();',
          'Object.assign(a, b, (b.ready = asC()));',
          rule('w.state(a.ready).eq(true)'),
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved.map((read) => read.expression)).toEqual(['a.ready']);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).not.toContain('data-[beta]:bg-primary');
        expect(tokens).not.toContain('data-[alpha]:bg-primary');
        expect(tokens).not.toContain('data-[gamma]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('reads a later handle of the same producer as the container the copy wrote to', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-shared-handle-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        // A producer hands the same container to every call, so the second
        // handle is the container the copy wrote to, and the call that may
        // write to it withdraws it.
        const consumer = [
          "import { asA, asB } from './producer';",
          'const bag = asA();',
          'Object.assign(bag, asB());',
          'const escaped = asA();',
          'mutate(escaped);',
          rule('w.state(escaped.ready).eq(true)'),
        ].join('\n');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved.map((read) => read.expression)).toEqual(['escaped.ready']);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).not.toContain('data-[alpha]:bg-primary');
        expect(tokens).not.toContain('data-[beta]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it("keeps one owner's copy out of another owner that reads the same producer", async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-owner-isolation-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
          ].join('\n')
        );
        const ownerA = path.join(dir, 'owner-a.proto.ts');
        const ownerB = path.join(dir, 'owner-b.proto.ts');
        await writeFile(
          ownerA,
          [
            "import { asA, asB } from './producer';",
            'const bag = asA();',
            'Object.assign(bag, asB());',
            "def.rule({ when: w => w.state(bag.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-primary')) });",
          ].join('\n')
        );
        await writeFile(
          ownerB,
          [
            "import { asA } from './producer';",
            'const own = asA();',
            "def.rule({ when: w => w.state(own.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
          ].join('\n')
        );
        // Each owner runs its own setup, so the copy owner A made is not what
        // owner B reads from the same producer declaration.
        const tokens = await collectProtoStyleTokensFromFiles([ownerA, ownerB]);
        expect(tokens).toContain('data-[beta]:bg-primary');
        expect(tokens).toContain('data-[alpha]:underline');
        expect(tokens).not.toContain('data-[beta]:underline');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it.each([
      ['direct', "import { definePrototype } from '@proto.ui/core';", 'definePrototype'],
      ['aliased', "import { definePrototype as define } from '@proto.ui/core';", 'define'],
      ['namespace', "import * as core from '@proto.ui/core';", 'core.definePrototype'],
      ['referenced', "import { definePrototype } from '@proto.ui/core';", 'definePrototype', true],
      ['re-exported', "import { make } from './factory';", 'make'],
      ['star re-exported', "import { definePrototype } from './factory';", 'definePrototype'],
      [
        'namespace re-exported',
        "import * as factory from './factory';",
        'factory.core.definePrototype',
      ],
    ])(
      "keeps one setup owner's copy out of another setup owner through a %s factory",
      async (_kind, factoryImport, factory, referenced = false) => {
        const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-owner-same-file-'));
        try {
          await writeFile(
            path.join(dir, 'factory.ts'),
            [
              "export { definePrototype as make } from '@proto.ui/core';",
              "export * from '@proto.ui/core';",
              "export * as core from '@proto.ui/core';",
            ].join('\n')
          );
          await writeFile(
            path.join(dir, 'producer.ts'),
            [
              "import { defineAsHook } from '@proto.ui/core';",
              "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
              "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
            ].join('\n')
          );
          const consumerFile = path.join(dir, 'consumer.proto.ts');
          // Two authored setups in one file are two owners: each runs its own
          // setup and therefore holds its own handle of the same producer.
          const consumer = [
            factoryImport,
            "import { asA, asB } from './producer';",
            referenced ? 'function setupA(def) {' : `${factory}({ name: 'owner-a', setup(def) {`,
            '  const bag = asA();',
            '  Object.assign(bag, asB());',
            "  def.rule({ when: w => w.state(bag.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-primary')) });",
            referenced ? '}' : '} });',
            referenced ? 'function setupB(def) {' : `${factory}({ name: 'owner-b', setup(def) {`,
            '  const own = asA();',
            "  def.rule({ when: w => w.state(own.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
            referenced ? '}' : '} });',
            ...(referenced
              ? [
                  `${factory}({ name: 'owner-a', setup: setupA });`,
                  `${factory}({ name: 'owner-b', setup: setupB });`,
                ]
              : []),
          ].join('\n');
          await writeFile(consumerFile, consumer);
          const tokens = await collectProtoStyleTokensFromFiles([consumerFile]);
          expect(tokens).toContain('data-[beta]:bg-primary');
          expect(tokens).toContain('data-[alpha]:underline');
          expect(tokens).not.toContain('data-[beta]:underline');
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
    );

    it('does not exempt legacy hook argument writes through a Core star re-export', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-legacy-factory-'));
      try {
        await writeFile(path.join(dir, 'factory.ts'), "export * from '@proto.ui/core';");
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "import { defineHook } from './factory';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const legacy = defineHook({ name: 'legacy', setup(d, options) { options.ready = null; } });",
          ].join('\n')
        );
        const file = path.join(dir, 'consumer.proto.ts');
        const source = [
          "import { asA, legacy } from './producer';",
          'const bag = asA();',
          'legacy(bag);',
          rule('w.state(bag.ready).eq(true)'),
        ].join('\n');
        const scan = scanWithFreshSummary(source, file);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved.map((read) => read.expression)).toEqual(['bag.ready']);
        await writeFile(file, source);
        expect(await collectProtoStyleTokensFromFiles([file])).not.toContain(
          'data-[alpha]:bg-primary'
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('withholds stale member proofs after recursive destructuring assignment targets', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-destructured-write-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import{defineAsHook}from'@proto.ui/core';",
            "export const asA=defineAsHook({name:'a',setup(d){d.state.bool('alpha',false)},projectHandle:r=>({ready:r.stateHandles.alpha})});",
            "export const asB=defineAsHook({name:'b',setup(d){d.state.bool('beta',false)},projectHandle:r=>({ready:r.stateHandles.beta})});",
          ].join('\n')
        );
        for (const write of [
          '({ready:bag.ready}=asB());',
          '[bag.ready]=[asB().ready];',
          '({nested:{ready:bag.ready}}={nested:asB()});',
        ]) {
          const file = path.join(dir, 'consumer.proto.ts');
          const source = [
            "import{asA,asB}from'./producer';",
            'const bag=asA();const alias=bag;',
            write,
            rule('w.state(bag.ready).eq(true)'),
            rule('w.state(alias.ready).eq(true)'),
          ].join('\n');
          const scan = scanWithFreshSummary(source, file);
          expect(scan.usages).toEqual([]);
          expect(scan.unresolved.map((read) => read.expression)).toEqual([
            'bag.ready',
            'alias.ready',
          ]);
          await writeFile(file, source);
          const tokens = await collectProtoStyleTokensFromFiles([file]);
          expect(tokens).not.toContain('data-[alpha]:bg-primary');
          expect(tokens).not.toContain('data-[beta]:bg-primary');
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('captures child producers through immutable local aliases without accepting mutable or shadowed bindings', async () => {
      const cases = [
        {
          name: 'immutable-local',
          setup: 'const localChild = asChild; localChild();',
          accepted: true,
        },
        {
          name: 'immutable-chain',
          setup: 'const first = asChild; const localChild = first; localChild();',
          accepted: true,
        },
        {
          name: 'unrelated-block-shadow',
          setup:
            'const localChild = asChild; { const localChild = () => {}; localChild(); } localChild();',
          accepted: true,
        },
        {
          name: 'wrong-producer',
          setup: 'const localChild = asOther; localChild();',
          accepted: false,
        },
        {
          name: 'mutable-local',
          setup: 'let localChild = asChild; localChild();',
          accepted: false,
        },
        {
          name: 'reassigned-local',
          setup: 'let localChild = asChild; localChild = asOther; localChild();',
          accepted: false,
        },
        {
          name: 'mutable-source-alias',
          setup: 'let source = asChild; const localChild = source; localChild();',
          accepted: false,
        },
        {
          name: 'shadowed-child',
          setup: 'const asChild = () => {}; const localChild = asChild; localChild();',
          accepted: false,
        },
        {
          name: 'shadowed-local',
          setup: 'const localChild = asChild; { const localChild = () => {}; localChild(); }',
          accepted: false,
        },
      ];
      for (const fixture of cases) {
        const dir = await mkdtemp(path.join(tmpdir(), `lowered-hook-child-alias-${fixture.name}-`));
        try {
          const producerFile = path.join(dir, 'producer.ts');
          await writeFile(
            producerFile,
            [
              "import { defineAsHook } from '@proto.ui/core';",
              "export const asChild = defineAsHook({ name: 'child', setup(def) { def.state.bool('ready', false); } });",
              "export const asOther = defineAsHook({ name: 'other', setup(def) { def.state.bool('wrong', false); } });",
              `export const asParent = defineAsHook({ name: 'parent', setup(def) { ${fixture.setup} } });`,
            ].join('\n')
          );
          const expression = "parent.getAsHookHandle('child').stateHandles.ready";
          const consumer = [
            "import { asParent } from './producer';",
            'const parent = asParent();',
            rule(`w.state(${expression}).eq(true)`),
          ].join('\n');
          const consumerFile = path.join(dir, 'consumer.proto.ts');
          const scan = scanWithFreshSummary(consumer, consumerFile);
          if (fixture.accepted) {
            expectSourceUsages(scan, producerFile, [{ hook: 'asParent', state: 'ready' }]);
            expect(scan.unresolved).toEqual([]);
          } else {
            expect(scan.usages).toEqual([]);
            expect(scan.unresolved).toEqual([{ expression, reason: 'subject' }]);
          }
          await writeFile(consumerFile, consumer);
          const tokens = await collectProtoStyleTokens(dir);
          if (fixture.accepted) expect(tokens).toContain('data-[ready]:bg-primary');
          else expect(tokens).not.toContain('data-[ready]:bg-primary');
          expect(tokens).not.toContain('data-[wrong]:bg-primary');
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
    });

    it('updates source-backed nested receivers and their existing aliases', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-nested-receiver-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'a', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { nested: { ready: r.stateHandles.alpha, stable: r.stateHandles.alpha } }; } });",
            "export const asB = defineAsHook({ name: 'b', setup(d) { d.state.bool('beta', false); } });",
            "export const asC = defineAsHook({ name: 'c', setup(d) { d.state.bool('gamma', false); }, projectHandle(r) { return { ready: r.stateHandles.gamma }; } });",
          ].join('\n')
        );
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const cases = [
          { write: 'bag.nested.ready = asB().stateHandles.beta;', states: ['beta', 'beta'] },
          { write: 'bag.nested["ready"] = asB().stateHandles.beta;', states: ['beta', 'beta'] },
          {
            write: 'function later() { bag.nested.ready = asB().stateHandles.beta; }',
            states: ['beta', 'alpha', 'beta', 'alpha'],
          },
          {
            write:
              'function later() { const inner = bag.nested; inner.ready = asB().stateHandles.beta; }',
            states: ['beta', 'alpha', 'beta', 'alpha'],
          },
          {
            write: 'bag.nested.ready = asB(bag.nested = asC()).stateHandles.beta;',
            states: ['gamma', 'beta'],
          },
          {
            write: 'bag.nested[unknownKey] = asB().stateHandles.beta;',
            states: ['beta', 'alpha', 'beta', 'alpha'],
          },
          { write: 'bag.nested[unknownKey] = unknownHandle;', states: null },
          {
            write: '(enabled ? bag.nested : asC()).ready = asB().stateHandles.beta;',
            states: ['beta', 'alpha', 'beta', 'alpha'],
          },
        ];
        for (const { write, states } of cases) {
          const consumer = [
            "import { asA, asB, asC } from './producer';",
            'const bag = asA();',
            'const alias = bag.nested;',
            write,
            rule('w.state(bag.nested.ready).eq(true)'),
            "def.rule({ when: w => w.state(alias.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
          ].join('\n');
          const scan = scanWithFreshSummary(consumer, consumerFile);
          if (states) {
            expect(
              scan.usages.map(({ state, provenance }) => ({
                state,
                declaredName: provenance?.declaredName,
                owner: provenance?.owner.file,
                declaration: provenance?.declaration.file,
              }))
            ).toEqual(
              states.map((state) => ({
                state,
                declaredName: state,
                owner: producerFile,
                declaration: producerFile,
              }))
            );
            expect(scan.unresolved).toEqual([]);
          } else {
            expect(scan.unresolved).toEqual([
              { expression: 'bag.nested.ready', reason: 'subject' },
              { expression: 'alias.ready', reason: 'subject' },
            ]);
          }
          await writeFile(consumerFile, consumer);
          const tokens = await collectProtoStyleTokens(dir);
          for (const [index, utility] of ['bg-primary', 'underline'].entries()) {
            const expected = states?.slice(
              (index * states.length) / 2,
              ((index + 1) * states.length) / 2
            );
            for (const state of ['alpha', 'beta', 'gamma']) {
              if (expected?.includes(state)) expect(tokens).toContain(`data-[${state}]:${utility}`);
              else expect(tokens).not.toContain(`data-[${state}]:${utility}`);
            }
          }
        }
        const localConsumer = [
          "import { asA, asB } from './producer';",
          'const bag = asA(); const alias = bag.nested;',
          "const local = def.state.bool('localFlag', false); def.expose.state('local', local);",
          'alias.ready = local; bag.nested.stable = asB().stateHandles.beta;',
          rule('w.state(bag.nested.ready).eq(true)'),
          "def.rule({ when: w => w.state(alias.ready).eq(true), intent: i => i.feedback.style.use(tw('underline')) });",
        ].join('\n');
        await writeFile(consumerFile, localConsumer);
        const localTokens = await collectProtoStyleTokens(dir);
        for (const utility of ['bg-primary', 'underline']) {
          expect(localTokens).toContain(`data-[local-flag]:${utility}`);
          expect(localTokens).not.toContain(`data-[alpha]:${utility}`);
          expect(localTokens).not.toContain(`data-[beta]:${utility}`);
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('withholds projector proof across effects in either return form', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-return-effect-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "function setup(d) { d.state.bool('alpha', false); d.state.bool('beta', false); }",
            "export const asBlock = defineAsHook({ name: 'block', setup, projectHandle(r) { let ready = r.stateHandles.alpha; return { ignored: (ready = r.stateHandles.beta), ready }; } });",
            "export const asExpression = defineAsHook({ name: 'expression', setup, projectHandle: r => ({ ignored: (r.stateHandles.alpha = r.stateHandles.beta), ready: r.stateHandles.alpha }) });",
            "export const asPure = defineAsHook({ name: 'pure', setup, projectHandle: r => ({ ready: r.getState('alpha'), later: () => unknownEffect() }) });",
            "export const asDetached = defineAsHook({ name: 'detached', setup, projectHandle(r) { const get = r.getState; return { ready: get('alpha') }; } });",
            "export const asTrue = defineAsHook({ name: 'true', setup, projectHandle: r => true ? { ready: r.getState('alpha') } : { ignored: Date.now() } });",
            "export const asFalse = defineAsHook({ name: 'false', setup, projectHandle: r => false ? { ignored: Date.now() } : { ready: r.getState('alpha') } });",
          ].join('\n')
        );
        const consumer = [
          "import { asBlock, asExpression, asPure, asDetached, asTrue, asFalse } from './producer';",
          'const block = asBlock();',
          'const expression = asExpression();',
          'const pure = asPure();',
          rule('w.state(block.ready).eq(true)'),
          rule('w.state(expression.ready).eq(true)'),
          "def.rule({ when: w => w.state(pure.ready).eq(true), intent: i => i.feedback.style.use(tw('italic')) });",
          "def.rule({ when: w => w.state(asDetached().ready).eq(true), intent: i => i.feedback.style.use(tw('italic')) });",
          "def.rule({ when: w => w.state(asTrue().ready).eq(true), intent: i => i.feedback.style.use(tw('italic')) });",
          "def.rule({ when: w => w.state(asFalse().ready).eq(true), intent: i => i.feedback.style.use(tw('italic')) });",
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
          { hook: 'asPure', state: 'alpha' },
          { hook: 'asDetached', state: 'alpha' },
          { hook: 'asTrue', state: 'alpha' },
          { hook: 'asFalse', state: 'alpha' },
        ]);
        expect(scan.unresolved).toEqual([
          { expression: 'block.ready', reason: 'subject' },
          { expression: 'expression.ready', reason: 'subject' },
        ]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[alpha]:italic');
        expect(tokens).not.toContain('data-[alpha]:bg-primary');
        expect(tokens).not.toContain('data-[beta]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('follows ordered applicable package conditions for NodeNext consumers', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-export-conditions-'));
      try {
        await writeFile(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
        await writeFile(
          path.join(dir, 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' } })
        );
        const packageDir = path.join(dir, 'node_modules', 'ordered-hook');
        await mkdir(packageDir, { recursive: true });
        await writeFile(
          path.join(packageDir, 'index.d.ts'),
          'export declare const asPackage: any;'
        );
        for (const branch of ['node', 'import', 'browser', 'require', 'default']) {
          await writeFile(
            path.join(packageDir, `${branch}.js`),
            `import { defineAsHook } from '@proto.ui/core';\nexport const asPackage = defineAsHook({ name: '${branch}', setup(d) { d.state.bool('${branch}Ready', false); } });`
          );
        }
        const cases: {
          conditions: Record<string, string>;
          branch: string;
          commonJS?: boolean;
          customConditions?: string[];
        }[] = [
          { conditions: { node: './node.js', import: './import.js' }, branch: 'node' },
          { conditions: { import: './import.js', node: './node.js' }, branch: 'import' },
          {
            conditions: {
              browser: './browser.js',
              require: './require.js',
              default: './default.js',
              node: './node.js',
              import: './import.js',
            },
            branch: 'default',
          },
          {
            conditions: { import: './import.js', require: './require.js', node: './node.js' },
            branch: 'require',
            commonJS: true,
          },
          {
            conditions: { browser: './browser.js', node: './node.js', import: './import.js' },
            branch: 'browser',
            customConditions: ['browser'],
          },
        ];
        for (const { conditions, branch, commonJS = false, customConditions = [] } of cases) {
          await writeFile(
            path.join(dir, 'tsconfig.json'),
            JSON.stringify({
              compilerOptions: {
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
                customConditions,
              },
            })
          );
          await writeFile(
            path.join(packageDir, 'package.json'),
            JSON.stringify({
              name: 'ordered-hook',
              type: 'module',
              exports: { '.': { types: './index.d.ts', ...conditions } },
            })
          );
          // Resolve the URL only. Never execute the authored hook or projector.
          const nativeResolution = execFileSync(
            process.execPath,
            commonJS
              ? ['--input-type=commonjs', '--eval', "console.log(require.resolve('ordered-hook'))"]
              : [
                  ...customConditions.map((condition) => `--conditions=${condition}`),
                  '--input-type=module',
                  '--eval',
                  "console.log(import.meta.resolve('ordered-hook'))",
                ],
            { cwd: dir, encoding: 'utf8' }
          ).trim();
          const nativeFile = commonJS ? nativeResolution : fileURLToPath(nativeResolution);
          expect(nativeFile).toBe(path.join(packageDir, `${branch}.js`));
          const consumer = [
            "import { asPackage } from 'ordered-hook';",
            'const result = asPackage();',
            rule(`w.state(result.stateHandles.${branch}Ready).eq(true)`),
          ].join('\n');
          const consumerFile = path.join(dir, `consumer.proto.${commonJS ? 'cts' : 'mts'}`);
          const scan = scanWithFreshSummary(consumer, consumerFile);
          expectSourceUsages(scan, nativeFile, [{ hook: 'asPackage', state: `${branch}Ready` }]);
          expect(scan.unresolved).toEqual([]);
          await rm(path.join(dir, 'consumer.proto.mts'), { force: true });
          await rm(path.join(dir, 'consumer.proto.cts'), { force: true });
          await writeFile(consumerFile, consumer);
          const tokens = await collectProtoStyleTokens(dir);
          expect(tokens).toContain(`data-[${branch.toLowerCase()}-ready]:bg-primary`);
          for (const other of ['node', 'import', 'browser', 'require', 'default']) {
            if (other !== branch) expect(tokens).not.toContain(`data-[${other}-ready]:bg-primary`);
          }
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('preserves shadowed lexical string constants in hook setup', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-shadowed-string-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asFacts = defineAsHook({ name: 'facts', setup(def) {",
            "  const key = 'ready';",
            '  {',
            "    const key = 'other';",
            '    def.state.bool(key, false);',
            '  }',
            '  def.state.bool(key, false);',
            '} });',
          ].join('\n')
        );
        const consumer = [
          "import { asFacts } from './producer';",
          'const facts = asFacts().stateHandles;',
          rule('w.state(facts.ready).eq(true)'),
          rule('w.state(facts.other).eq(true)'),
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);

        expectSourceUsages(scan, producerFile, [
          { hook: 'asFacts', state: 'ready' },
          { hook: 'asFacts', state: 'other' },
        ]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[ready]:bg-primary');
        expect(tokens).toContain('data-[other]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('resolves a shorthand-named child hook through its parent handle', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-shorthand-child-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "const name = 'facts';",
            "function setup(def) { def.state.bool('ready', false); }",
            'export const asFacts = defineAsHook({ name, setup });',
            "export const asParent = defineAsHook({ name: 'parent', setup(def) { asFacts(); } });",
          ].join('\n')
        );
        const consumer = [
          "import { asParent } from './producer';",
          'const parent = asParent();',
          rule("w.state(parent.getAsHookHandle('facts').stateHandles.ready).eq(true)"),
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);

        expectSourceUsages(scan, producerFile, [{ hook: 'asParent', state: 'ready' }]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        expect(await collectProtoStyleTokens(dir)).toContain('data-[ready]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('unwraps satisfies when recognizing an imported hook producer', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-satisfies-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asFacts = defineAsHook({ name: 'facts', setup(def) { def.state.bool('ready', false); } } satisfies unknown);",
          ].join('\n')
        );
        const consumer = [
          "import { asFacts } from './producer';",
          'const facts = asFacts().stateHandles;',
          rule('w.state(facts.ready).eq(true)'),
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);

        expectSourceUsages(scan, producerFile, [{ hook: 'asFacts', state: 'ready' }]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        expect(await collectProtoStyleTokens(dir)).toContain('data-[ready]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('binds recursively destructured projector parameters', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-projector-pattern-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asFacts = defineAsHook({ name: 'facts', setup(def) { def.state.bool('ready', false); }, projectHandle({ stateHandles: { ready } }) { return { ready }; } });",
          ].join('\n')
        );
        const consumer = [
          "import { asFacts } from './producer';",
          'const facts = asFacts();',
          rule('w.state(facts.ready).eq(true)'),
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);

        expectSourceUsages(scan, producerFile, [{ hook: 'asFacts', state: 'ready' }]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        expect(await collectProtoStyleTokens(dir)).toContain('data-[ready]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('reads numeric and string tuple keys while retaining index invalidation', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-numeric-tuple-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asFacts = defineAsHook({ name: 'facts', setup(def) { def.state.bool('ready', false); def.state.bool('other', false); }, projectHandle(result) { return [result.stateHandles.ready, result.stateHandles.other]; } });",
          ].join('\n')
        );
        const consumer = [
          "import { asFacts } from './producer';",
          'const stable = asFacts();',
          rule('w.state(stable[0]).eq(true)'),
          "def.rule({ when: (w) => w.state(stable['1']).eq(true), intent: (i) => i.feedback.style.use(tw('bg-secondary')) });",
          'const overwritten = asFacts();',
          'overwritten[0] = null;',
          "def.rule({ when: (w) => w.state(overwritten[0]).eq(true), intent: (i) => i.feedback.style.use(tw('bg-overwritten')) });",
          "def.rule({ when: (w) => w.state(overwritten['1']).eq(true), intent: (i) => i.feedback.style.use(tw('bg-surviving')) });",
          'const dynamic = asFacts();',
          'const index: number = getIndex();',
          'dynamic[index] = null;',
          "def.rule({ when: (w) => w.state(dynamic[index]).eq(true), intent: (i) => i.feedback.style.use(tw('bg-dynamic-index')) });",
          "def.rule({ when: (w) => w.state(dynamic[0]).eq(true), intent: (i) => i.feedback.style.use(tw('bg-dynamic-write')) });",
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);

        expectSourceUsages(scan, producerFile, [
          { hook: 'asFacts', state: 'ready' },
          { hook: 'asFacts', state: 'other' },
          { hook: 'asFacts', state: 'other' },
        ]);
        expect(scan.unresolved).toEqual([
          { expression: 'overwritten[0]', reason: 'subject' },
          { expression: 'dynamic[index]', reason: 'subject' },
          { expression: 'dynamic[0]', reason: 'subject' },
        ]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[ready]:bg-primary');
        expect(tokens).toContain('data-[other]:bg-secondary');
        expect(tokens).toContain('data-[other]:bg-surviving');
        expect(tokens).not.toContain('data-[ready]:bg-overwritten');
        expect(tokens).not.toContain('data-[ready]:bg-dynamic-index');
        expect(tokens).not.toContain('data-[ready]:bg-dynamic-write');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('certifies the first same-name producer registration and withholds a later different one', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-same-name-first-call-'));
      try {
        const producerFile = path.join(dir, 'producers.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asA = defineAsHook({ name: 'shared', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
            "export const asB = defineAsHook({ name: 'shared', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
          ].join('\n')
        );
        // A later call to a different producer with the same name inside the same
        // setup chain may observe the earlier registration, so the later result
        // is withheld rather than certified as its own producer.
        const withheld = [
          "import { asA, asB } from './producers';",
          'function setup(def) {',
          '  asA();',
          '  const bag = asB();',
          rule('w.state(bag.ready).eq(true)'),
          '}',
          'setup(def);',
        ].join('\n');
        const withheldFile = path.join(dir, 'consumer.proto.ts');
        const withheldScan = scanWithFreshSummary(withheld, withheldFile);
        expect(withheldScan.usages).toEqual([]);
        expect(withheldScan.unresolved.map((item) => item.expression)).toEqual(['bag.ready']);

        // A repeated call to the same producer keeps that producer's provenance.
        const repeated = [
          "import { asA } from './producers';",
          'function setup(def) {',
          '  asA();',
          '  const bag = asA();',
          rule('w.state(bag.ready).eq(true)'),
          '}',
          'setup(def);',
        ].join('\n');
        const repeatedFile = path.join(dir, 'consumer.proto.ts');
        const repeatedScan = scanWithFreshSummary(repeated, repeatedFile);
        expectSourceUsages(repeatedScan, producerFile, [{ hook: 'asA', state: 'alpha' }]);
        expect(repeatedScan.unresolved).toEqual([]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('summarizes same-name producers independently across setup boundaries and sources', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-same-name-boundaries-'));
      try {
        const producerFile = path.join(dir, 'producers.ts');
        const producerSource = [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const asA = defineAsHook({ name: 'shared', setup(d) { d.state.bool('alpha', false); }, projectHandle(r) { return { ready: r.stateHandles.alpha }; } });",
          "export const asB = defineAsHook({ name: 'shared', setup(d) { d.state.bool('beta', false); }, projectHandle(r) { return { ready: r.stateHandles.beta }; } });",
          'export const asParentA = defineAsHook({ name: "parent-a", setup() { asA(); } });',
          "export const asParentB = defineAsHook({ name: 'parent-b', setup(def) { const bag = asB(); " +
            rule('w.state(bag.ready).eq(true)') +
            ' } });',
        ].join('\n');
        await writeFile(producerFile, producerSource);
        // Each parent owns its own setup boundary, so the earlier asA call does not
        // contaminate the later parent's summary of asB.
        const scan = scanRuleStateReads(
          producerSource,
          producerFile,
          createHookSourceSummaryContext()
        );
        expectSourceUsages(scan, producerFile, [{ hook: 'asB', state: 'beta' }]);
        expect(scan.unresolved).toEqual([]);

        // Sharing one summary context across two sources keeps the producer registry
        // per source, so the second source still resolves its own producer.
        const context = createHookSourceSummaryContext();
        const firstFile = path.join(dir, 'first.proto.ts');
        const secondFile = path.join(dir, 'second.proto.ts');
        const firstSource = "import { asA } from './producers';\nfunction setup() { asA(); }";
        await writeFile(firstFile, firstSource);
        scanRuleStateReads(firstSource, firstFile, context);
        const secondSource = [
          "import { asB } from './producers';",
          'function setup(def) {',
          '  const bag = asB();',
          rule('w.state(bag.ready).eq(true)'),
          '}',
          'setup(def);',
        ].join('\n');
        await writeFile(secondFile, secondSource);
        const secondScan = scanRuleStateReads(secondSource, secondFile, context);
        expectSourceUsages(secondScan, producerFile, [{ hook: 'asB', state: 'beta' }]);
        expect(secondScan.unresolved).toEqual([]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('captures distinct forwarded literals from successive helper calls', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-helper-literals-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            'function add(d, key) { d.state.bool(key, false); }',
            "export const asFacts = defineAsHook({ name: 'facts', setup(d) { add(d, 'ready'); add(d, 'other'); } });",
          ].join('\n')
        );
        const consumer = [
          "import { asFacts } from './producer';",
          'const bag = asFacts().stateHandles;',
          rule('w.state(bag.ready).eq(true)'),
          `if (bag.other) { ${rule('w.state(bag.other).eq(true)')} }`,
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expectSourceUsages(scan, producerFile, [
          { hook: 'asFacts', state: 'ready' },
          { hook: 'asFacts', state: 'other' },
        ]);
        expect(scan.unresolved).toEqual([]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[ready]:bg-primary');
        expect(tokens).toContain('data-[other]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('invalidates forwarded literals written by loop binding targets', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-loop-literal-write-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "function add(d, key) { for (key of ['other']) {} d.state.bool(key, false); }",
            "export const asFacts = defineAsHook({ name: 'facts', setup(d) { add(d, 'ready'); } });",
          ].join('\n')
        );
        const consumer = [
          "import { asFacts } from './producer';",
          'const bag = asFacts().stateHandles;',
          rule('w.state(bag.ready).eq(true)'),
          `if (bag.other) { ${rule('w.state(bag.other).eq(true)')} }`,
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved).toEqual([
          { expression: 'bag.ready', reason: 'subject' },
          { expression: 'bag.other', reason: 'subject' },
        ]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).not.toContain('data-[ready]:bg-primary');
        expect(tokens).not.toContain('data-[other]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('keeps possibly overwritten hook names out of child lookup indexes', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-computed-name-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "const name = 'facts'; const slot: string = 'name';",
            "function setup(d) { d.state.bool('ready', false); }",
            "const asChild = defineAsHook({ name, [slot]: 'renamed', setup });",
            "export const asParent = defineAsHook({ name: 'parent', setup(d) { asChild(); } });",
          ].join('\n')
        );
        const consumer = [
          "import { asParent } from './producer';",
          'const parent = asParent();',
          rule("w.state(parent.getAsHookHandle('facts').stateHandles.ready).eq(true)"),
          rule("w.state(parent.getAsHookHandle('renamed').stateHandles.ready).eq(true)"),
          rule("w.state(parent.getAsHookHandle('<unknown-hook>').stateHandles.ready).eq(true)"),
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved).toEqual([
          { expression: "parent.getAsHookHandle('facts').stateHandles.ready", reason: 'subject' },
          { expression: "parent.getAsHookHandle('renamed').stateHandles.ready", reason: 'subject' },
          {
            expression: "parent.getAsHookHandle('<unknown-hook>').stateHandles.ready",
            reason: 'subject',
          },
        ]);
        await writeFile(consumerFile, consumer);
        expect(await collectProtoStyleTokens(dir)).not.toContain('data-[ready]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('withholds projector proof across effectful parameter initialization', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-projector-default-effect-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asFacts = defineAsHook({ name: 'facts', setup(d) { d.state.bool('ready', false); d.state.bool('other', false); }, projectHandle({ stateHandles: { ready, other } }: any, ignored = (ready = other)) { return { ready }; } });",
            "export const asLookalike = defineAsHook({ name: 'lookalike', setup(d) { d.state.bool('ready', false); d.state.bool('other', false); }, projectHandle({ stateHandles: { ready, other } }: any, helper = { getState: () => (ready = other) }, ignored = helper.getState()) { return { ready }; } });",
          ].join('\n')
        );
        const consumer = [
          "import { asFacts, asLookalike } from './producer';",
          'const facts = asFacts();',
          rule('w.state(facts.ready).eq(true)'),
          'const lookalike = asLookalike();',
          rule('w.state(lookalike.ready).eq(true)'),
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved).toEqual([
          { expression: 'facts.ready', reason: 'subject' },
          { expression: 'lookalike.ready', reason: 'subject' },
        ]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).not.toContain('data-[ready]:bg-primary');
        expect(tokens).not.toContain('data-[other]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('does not infer iterable projector parameters from numeric record keys', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-projector-record-iterator-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const asFacts = defineAsHook({ name: 'facts', setup(d) { d.state.bool('0', false); }, projectHandle({ stateHandles: [first] }: any) { return { first }; } });",
          ].join('\n')
        );
        const consumer = [
          "import { asFacts } from './producer';",
          'const facts = asFacts();',
          rule('w.state(facts.first).eq(true)'),
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expect(scan.usages).toEqual([]);
        expect(scan.unresolved).toEqual([{ expression: 'facts.first', reason: 'subject' }]);
        await writeFile(consumerFile, consumer);
        expect(await collectProtoStyleTokens(dir)).not.toContain('data-[0]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('invalidates var-redeclared parameters while preserving lexical loop shadows', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-var-parameter-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "function addVar(d: any, key: string) { for (var key of ['other']) {} d.state.bool(key, false); }",
            "function addShadow(d: any, key: string) { for (const key of ['other']) {} d.state.bool(key, false); }",
            "export const asVar = defineAsHook({ name: 'var', setup(d) { addVar(d, 'ready'); } });",
            "export const asShadow = defineAsHook({ name: 'shadow', setup(d) { addShadow(d, 'ready'); } });",
          ].join('\n')
        );
        const consumer = [
          "import { asVar, asShadow } from './producer';",
          'const uncertain = asVar().stateHandles;',
          "def.rule({ when: w => w.state(uncertain.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-unproved')) });",
          `if (uncertain.other) { ${rule('w.state(uncertain.other).eq(true)')} }`,
          'const stable = asShadow().stateHandles;',
          rule('w.state(stable.ready).eq(true)'),
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expectSourceUsages(scan, producerFile, [{ hook: 'asShadow', state: 'ready' }]);
        expect(scan.unresolved).toEqual([
          { expression: 'uncertain.ready', reason: 'subject' },
          { expression: 'uncertain.other', reason: 'subject' },
        ]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[ready]:bg-primary');
        expect(tokens).not.toContain('data-[ready]:bg-unproved');
        expect(tokens).not.toContain('data-[other]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('distinguishes uncertain projector presence from proven raw capture', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-projector-certainty-'));
      try {
        const producerFile = path.join(dir, 'producer.ts');
        await writeFile(
          producerFile,
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "const slot: string = 'projectHandle';",
            'const p = (r: any) => ({ stateHandles: { ready: r.stateHandles.other } });',
            "function setup(d: any) { d.state.bool('ready', false); d.state.bool('other', false); }",
            "export const asOpaque = defineAsHook({ projectHandle: p, [slot]: p, name: 'opaque', setup });",
            "export const asRestored = defineAsHook({ [slot]: p, name: 'restored', setup, projectHandle: p });",
          ].join('\n')
        );
        const consumer = [
          "import { asOpaque, asRestored } from './producer';",
          'const opaque = asOpaque();',
          rule('w.state(opaque.stateHandles.ready).eq(true)'),
          'const restored = asRestored();',
          rule('w.state(restored.stateHandles.ready).eq(true)'),
        ].join('\n');
        const consumerFile = path.join(dir, 'consumer.proto.ts');
        const scan = scanWithFreshSummary(consumer, consumerFile);
        expectSourceUsages(scan, producerFile, [{ hook: 'asRestored', state: 'other' }]);
        expect(scan.unresolved).toEqual([
          { expression: 'opaque.stateHandles.ready', reason: 'subject' },
        ]);
        await writeFile(consumerFile, consumer);
        const tokens = await collectProtoStyleTokens(dir);
        expect(tokens).toContain('data-[other]:bg-primary');
        expect(tokens).not.toContain('data-[ready]:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  it('follows every binding shape a prototype uses to reach a state handle', () => {
    const shapes = {
      destructured: `const { checked } = asCheckboxRoot().stateHandles;\n${rule('w.state(checked).eq(true)')}`,
      viaBag: `const s = asSelectTrigger().stateHandles;\nconst { placeholder } = s;\n${rule('w.state(placeholder).eq(true)')}`,
      viaHookResult: `const h = asTextareaRoot();\nconst s = h.stateHandles;\n${rule('w.state(s.focusVisible).eq(true)')}`,
      chained: `const checked = asCheckboxRoot().stateHandles.checked;\n${rule('w.state(checked).eq(true)')}`,
    };

    expect(scanRuleStateReads(shapes.destructured).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);
    expect(scanRuleStateReads(shapes.viaBag).usages).toEqual([
      { hook: 'asSelectTrigger', state: 'placeholder' },
    ]);
    expect(scanRuleStateReads(shapes.viaHookResult).usages).toEqual([
      { hook: 'asTextareaRoot', state: 'focusVisible' },
    ]);
    expect(scanRuleStateReads(shapes.chained).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);
  });

  it('follows imported generic helpers and literal child projections without flattening', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-provenance-'));
    try {
      await writeFile(
        path.join(dir, 'producers.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          'function setupGeneric(def) {',
          "  const genericFlag = def.state.bool('genericFlag', false);",
          '  void genericFlag;',
          '}',
          'const helperAlias = setupGeneric;',
          'const genericSetup = (def) => helperAlias(def);',
          "export const asGeneric = defineAsHook({ name: 'as-generic', setup: genericSetup });",
          'function setupChild(def) {',
          "  const childRequired = def.state.bool('childRequired', false);",
          '  void childRequired;',
          '}',
          "export const asChild = defineAsHook({ name: 'as-child', setup: setupChild, projectHandle(result) { return { state: result.stateHandles }; } });",
          "export const asParent = defineAsHook({ name: 'as-parent', setup(def) { asChild(); } });",
        ].join('\n')
      );
      const consumer = [
        "import { asGeneric, asParent } from './producers';",
        'const generic = asGeneric().stateHandles;',
        'const genericAlias = generic.genericFlag;',
        rule('w.state(genericAlias).eq(true)'),
        'const parentAlias = asParent;',
        'const parent = parentAlias();',
        "const child = parent.getAsHookHandle('as-child');",
        "def.rule({ when: (w) => w.state(child?.state.childRequired).eq(true), intent: (i) => i.feedback.style.use(tw('bg-child')) });",
        'function shadow(asGeneric) {',
        '  const shadowed = asGeneric().stateHandles;',
        rule('w.state(shadowed.genericFlag).eq(true)'),
        '}',
      ].join('\n');
      const scan = scanRuleStateReads(consumer, path.join(dir, 'consumer.proto.ts'));
      expect(scan.usages).toEqual([
        { hook: 'asGeneric', state: 'genericFlag' },
        { hook: 'asParent', state: 'childRequired' },
      ]);
      expect(scan.unresolved).toEqual([{ expression: 'shadowed.genericFlag', reason: 'subject' }]);
      await writeFile(path.join(dir, 'consumer.proto.ts'), consumer);
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[generic-flag]:bg-primary');
      expect(tokens).toContain('data-[child-required]:bg-child');
      expect(tokens).not.toContain('data-[generic-flag]:bg-child');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('retains declaration identity through literal state lookups and detached lookup aliases', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-state-lookup-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const useFacts = defineAsHook({ name: 'facts', setup(def) {",
          "  const flag = def.state.bool('internalFlag', false);",
          "  def.expose.state('publicAlias', flag);",
          '} });',
        ].join('\n')
      );
      const consumer = [
        "import { useFacts } from './producer';",
        'const facts = useFacts();',
        "const direct = facts.getState!('internalFlag')!;",
        'const lookup = facts.getState!;',
        "const detached = lookup('internalFlag')!;",
        rule('w.state(direct).eq(true)'),
        rule('w.state(detached).eq(true)'),
        "def.rule({ when: (w) => w.state(facts.getState!('internalFlag')!).eq(true), intent: (i) => i.feedback.style.use(tw('bg-secondary')) });",
        "def.rule({ when: (w) => w.state(lookup('internalFlag')!).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
        "const missing = facts.getState!('missing')!;",
        rule('w.state(missing).eq(true)'),
        "let mutableKey = 'internalFlag';",
        "mutableKey = 'missing';",
        'const mutable = facts.getState!(mutableKey)!;',
        rule('w.state(mutable).eq(true)'),
        "const key = 'internalFlag';",
        'function shadow(key) {',
        '  const shadowed = facts.getState!(key)!;',
        rule('w.state(shadowed).eq(true)'),
        '}',
      ].join('\n');
      const scan = scanRuleStateReads(consumer, path.join(dir, 'consumer.proto.ts'));
      expect(
        scan.usages.map(({ state, provenance }) => ({
          state,
          declaredName: provenance?.declaredName,
        }))
      ).toEqual([
        { state: 'internalFlag', declaredName: 'internalFlag' },
        { state: 'internalFlag', declaredName: 'internalFlag' },
        { state: 'internalFlag', declaredName: 'internalFlag' },
        { state: 'internalFlag', declaredName: 'internalFlag' },
      ]);
      expect(scan.unresolved).toEqual([
        { expression: 'missing', reason: 'subject' },
        { expression: 'mutable', reason: 'subject' },
        { expression: 'shadowed', reason: 'subject' },
      ]);
      expect(scan.usages[0].provenance?.declaration).toEqual(
        scan.usages[1].provenance?.declaration
      );
      await writeFile(path.join(dir, 'consumer.proto.ts'), consumer);
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[internal-flag]:bg-primary');
      expect(tokens).toContain('data-[internal-flag]:bg-secondary');
      expect(tokens).toContain('data-[internal-flag]:bg-accent');
      expect(tokens).not.toContain('data-[public-alias]:bg-primary');
      expect(tokens).not.toContain('data-[missing]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('ignores only source-proven absent optional Rule registrations', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-closed-state-guard-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const useFacts = defineAsHook({ name: 'facts', setup(def) { def.state.bool('present', false); } });",
        ].join('\n')
      );
      const consumer = [
        "import { useFacts } from './producer';",
        'const state = useFacts().stateHandles;',
        'if (state?.missing) {',
        rule('w.state(state.missing).eq(true)'),
        '}',
        'if (state?.present) {',
        rule('w.state(state.present).eq(true)'),
        '}',
      ].join('\n');
      const scan = scanRuleStateReads(consumer, path.join(dir, 'consumer.proto.ts'));
      expect(scan.usages.map(({ state }) => state)).toEqual(['present']);
      expect(scan.unresolved).toEqual([]);
      await writeFile(path.join(dir, 'consumer.proto.ts'), consumer);
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[present]:bg-primary');
      expect(tokens).not.toContain('data-[missing]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps optional Rules unresolved when setup capture may introduce an unknown state', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-open-state-guard-'));
    try {
      const setups = [
        "let key = 'other'; key = 'missing'; def.state.bool(key, false);",
        'unknownHelper(def);',
        "[1].forEach(() => def.state.bool('missing', false));",
      ];
      for (const [index, setup] of setups.entries()) {
        await writeFile(
          path.join(dir, `producer-${index}.ts`),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            `export const useFacts = defineAsHook({ name: 'facts', setup(def) { ${setup} } });`,
          ].join('\n')
        );
        const consumer = [
          `import { useFacts } from './producer-${index}';`,
          'const state = useFacts().stateHandles;',
          'if (state?.missing) {',
          rule('w.state(state.missing).eq(true)'),
          '}',
        ].join('\n');
        const scan = scanRuleStateReads(consumer, path.join(dir, `consumer-${index}.proto.ts`));
        expect(scan.unresolved, setup).toEqual([
          { expression: 'state.missing', reason: 'subject' },
        ]);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('captures conditional provider members only for the reached lexical helper argument', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-helper-role-'));
    try {
      await writeFile(
        path.join(dir, 'tsconfig.json'),
        JSON.stringify({
          extends: path.join(REPO_ROOT, 'tsconfig.json'),
        })
      );
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "import { asFocusable } from '@proto.ui/hooks';",
          "function part(def, role = 'thumb') {",
          "  const focus = role === 'thumb' ? asFocusable() : null;",
          "  if (focus) def.expose.state('visibleAlias', focus.focusVisible);",
          '}',
          'function shadowPart(def, role) { {',
          "  const role = 'label';",
          "  const focus = role === 'thumb' ? asFocusable() : null;",
          "  if (focus) def.expose.state('visibleAlias', focus.focusVisible);",
          '} }',
          "export const useThumb = defineAsHook({ name: 'thumb', setup(def) { part(def, 'thumb'); } });",
          "export const useDefault = defineAsHook({ name: 'default', setup(def) { part(def); } });",
          "export const useLabel = defineAsHook({ name: 'label', setup(def) { part(def, 'label'); } });",
          "export const useUnknown = defineAsHook({ name: 'unknown', setup(def) { part(def, externalRole); } });",
          "export const useShadow = defineAsHook({ name: 'shadow', setup(def) { shadowPart(def, 'thumb'); } });",
        ].join('\n')
      );
      for (const hook of ['useThumb', 'useDefault', 'useLabel', 'useUnknown', 'useShadow']) {
        const consumer = [
          `import { ${hook} } from './producer';`,
          `const state = ${hook}().stateHandles;`,
          rule('w.state(state.focusVisible).eq(true)'),
        ].join('\n');
        const scan = scanRuleStateReads(consumer, path.join(dir, `${hook}.proto.ts`));
        if (hook === 'useThumb' || hook === 'useDefault') {
          expect(
            scan.usages.map(({ state }) => state),
            hook
          ).toEqual(['focusVisible']);
          expect(scan.unresolved, hook).toEqual([]);
        } else {
          expect(scan.usages, hook).toEqual([]);
          expect(scan.unresolved, hook).toEqual([
            { expression: 'state.focusVisible', reason: 'subject' },
          ]);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('captures setup definition arguments beyond the first helper parameter', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-helper-arguments-'));
    try {
      const helpers = [
        "function init(_, d) { const s = d.state.bool('ready', false); d.expose.state('ready', s); }",
        "const init = (_, d) => { const s = d.state.bool('ready', false); d.expose.state('ready', s); };",
      ];
      for (const [index, helper] of helpers.entries()) {
        const folder = path.join(dir, String(index));
        await mkdir(folder);
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            helper,
            "export const useFacts = defineAsHook({ name: 'facts', setup(def) { init(0, def); } });",
          ].join('\n')
        );
        const source = [
          "import { useFacts } from './producer';",
          'const state = useFacts().stateHandles;',
          `if (state?.ready) { ${rule('w.state(state.ready).eq(true)')} }`,
        ].join('\n');
        const file = path.join(folder, 'consumer.proto.ts');
        await writeFile(file, source);
        const scan = scanRuleStateReads(source, file);
        expect(
          scan.usages.map(({ state }) => state),
          helper
        ).toEqual(['ready']);
        expect(scan.unresolved, helper).toEqual([]);
        expect(await collectProtoStyleTokens(folder), helper).toContain('data-[ready]:bg-primary');
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not certify stale provider members after direct writes or alias escapes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-provider-writes-'));
    try {
      const writes = [
        'focus.focusVisible = focus.focused;',
        "const alias = focus; alias['focusVisible'] = focus.focused;",
        'focus[key] = focus.focused;',
        'mutate(focus);',
        'mutate({ focus });',
        'mutate([focus]);',
        'const box = { focus }; mutate(box);',
        'const box = { focus }; const alias = box; mutate(alias);',
      ];
      for (const [index, mutation] of writes.entries()) {
        const folder = path.join(dir, String(index));
        await mkdir(folder);
        await writeFile(
          path.join(folder, 'tsconfig.json'),
          JSON.stringify({ extends: path.join(REPO_ROOT, 'tsconfig.json') })
        );
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "import { asFocusable } from '@proto.ui/hooks';",
            `export const useFacts = defineAsHook({ name: 'facts', setup(d) { const focus = asFocusable(); ${mutation} d.expose.state('visible', focus.focusVisible); } });`,
          ].join('\n')
        );
        const source = [
          "import { useFacts } from './producer';",
          'const state = useFacts().stateHandles;',
          `if (state?.focusVisible) { ${rule('w.state(state.focusVisible).eq(true)')} }`,
          `if (state?.focused) { ${rule('w.state(state.focused).eq(true)')} }`,
        ].join('\n');
        const file = path.join(folder, 'consumer.proto.ts');
        const scan = scanRuleStateReads(source, file);
        expect(scan.usages, mutation).toEqual([]);
        expect(scan.unresolved, mutation).toEqual([
          { expression: 'state.focusVisible', reason: 'subject' },
          { expression: 'state.focused', reason: 'subject' },
        ]);
        await writeFile(file, source);
        expect(await collectProtoStyleTokens(folder), mutation).not.toContain(
          'data-[focus-visible]:bg-primary'
        );
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps destructured setup capture open instead of suppressing optional rules', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-destructured-setup-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const useFacts = defineAsHook({ name: 'facts', setup({ state }) { state.bool('ready', false); } });",
        ].join('\n')
      );
      const source = [
        "import { useFacts } from './producer';",
        'const state = useFacts().stateHandles;',
        `if (state?.ready) { ${rule('w.state(state.ready).eq(true)')} }`,
      ].join('\n');
      const file = path.join(dir, 'consumer.proto.ts');
      const scan = scanRuleStateReads(source, file);
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([{ expression: 'state.ready', reason: 'subject' }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not treat rest helper arrays as direct setup definition bindings', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-rest-helper-'));
    try {
      const calls = [
        "function init(...defs) { defs[0].state.bool('ready', false); } export const useFacts = defineAsHook({ name: 'facts', setup(def) { init(def); } });",
        "export const useFacts = defineAsHook({ name: 'facts', setup(def) { ((...defs) => defs[0].state.bool('ready', false))(def); } });",
      ];
      for (const [index, definition] of calls.entries()) {
        await writeFile(
          path.join(dir, `producer-${index}.ts`),
          "import { defineAsHook } from '@proto.ui/core';\n" + definition
        );
        const source = [
          `import { useFacts } from './producer-${index}';`,
          'const state = useFacts().stateHandles;',
          `if (state?.ready) { ${rule('w.state(state.ready).eq(true)')} }`,
        ].join('\n');
        const scan = scanRuleStateReads(source, path.join(dir, `consumer-${index}.proto.ts`));
        expect(scan.usages, definition).toEqual([]);
        expect(scan.unresolved, definition).toEqual([
          { expression: 'state.ready', reason: 'subject' },
        ]);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('retains projected state siblings when creating a deferred callable', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-deferred-projector-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const useFacts = defineAsHook({ name: 'facts', setup(d) { const s = d.state.bool('ready', false); d.expose.state('ready', s); }, projectHandle(r) { const read = () => r.stateHandles.ready.get(); return { ready: r.stateHandles.ready, read }; } });",
        ].join('\n')
      );
      const source = [
        "import { useFacts } from './producer';",
        'const facts = useFacts();',
        rule('w.state(facts.ready).eq(true)'),
      ].join('\n');
      const file = path.join(dir, 'consumer.proto.ts');
      await writeFile(file, source);
      const scan = scanRuleStateReads(source, file);
      expect(scan.usages.map(({ state }) => state)).toEqual(['ready']);
      expect(scan.unresolved).toEqual([]);
      expect(await collectProtoStyleTokens(dir)).toContain('data-[ready]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps finite loop selector literals paired with their own prebound style handles', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-paired-loop-'));
    try {
      const consumer = [
        "import { tw } from '@proto.ui/core';",
        "const direction = def.state.string('direction', 'left');",
        "def.expose.state('direction', direction);",
        'for (const [value, paint] of [',
        "  ['left', tw('bg-primary')],",
        "  ['right', tw('bg-secondary')],",
        '] as const) {',
        '  def.rule({ when: (w) => w.state(direction).eq(value), intent: (i) => i.feedback.style.use(paint) });',
        '}',
      ].join('\n');
      const scan = scanRuleStateReads(consumer, path.join(dir, 'consumer.proto.ts'));
      expect(scan.unresolved).toEqual([]);
      await writeFile(path.join(dir, 'consumer.proto.ts'), consumer);
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[direction=left]:bg-primary');
      expect(tokens).toContain('data-[direction=right]:bg-secondary');
      expect(tokens).not.toContain('data-[direction=left]:bg-secondary');
      expect(tokens).not.toContain('data-[direction=right]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps loop rows bound to the token handles captured before iteration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-loop-snapshot-'));
    try {
      await writeFile(
        path.join(dir, 'consumer.proto.ts'),
        [
          "const direction = def.state.string('direction', 'left');",
          "def.expose.state('direction', direction);",
          "let paint = tw('bg-primary');",
          "for (const [value, captured] of [['left', paint], ['right', paint]]) {",
          "  paint = tw('bg-secondary');",
          '  def.rule({ when: w => w.state(direction).eq(value), intent: i => i.feedback.style.use(captured) });',
          '}',
        ].join('\n')
      );
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[direction=left]:bg-primary');
      expect(tokens).toContain('data-[direction=right]:bg-primary');
      expect(tokens).not.toContain('data-[direction=left]:bg-secondary');
      expect(tokens).not.toContain('data-[direction=right]:bg-secondary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('captures earlier iterable values before evaluating later assignment expressions', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-iterable-order-'));
    try {
      await writeFile(
        path.join(dir, 'consumer.proto.ts'),
        [
          "const direction = def.state.string('direction', 'left');",
          "def.expose.state('direction', direction);",
          "let paint = tw('bg-primary');",
          "for (const [value, captured] of [['left', paint], ['right', (paint = tw('bg-secondary'))]]) {",
          '  def.rule({ when: w => w.state(direction).eq(value), intent: i => i.feedback.style.use(captured) });',
          '}',
        ].join('\n')
      );
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[direction=left]:bg-primary');
      expect(tokens).toContain('data-[direction=right]:bg-secondary');
      expect(tokens).not.toContain('data-[direction=left]:bg-secondary');
      expect(tokens).not.toContain('data-[direction=right]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves consumed intent handles after sequential and conditional reassignments', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-intent-assignment-'));
    try {
      await writeFile(
        path.join(dir, 'consumer.proto.ts'),
        [
          "const ready = def.state.bool('ready', false);",
          "def.expose.state('ready', ready);",
          "const active = def.state.bool('active', false);",
          "def.expose.state('active', active);",
          "var paint = tw('border-primary');",
          'var paint;',
          'def.rule({ when: w => w.state(ready).eq(true), intent: i => {',
          "  let paint = tw('bg-primary');",
          "  paint = tw('bg-secondary');",
          '  i.feedback.style.use(paint);',
          '} });',
          'def.rule({ when: w => w.state(active).eq(true), intent: i => {',
          "  let paint = tw('text-primary');",
          "  if (enabled) paint = tw('text-secondary');",
          '  i.feedback.style.use(paint);',
          '} });',
          'def.rule({ when: w => w.state(ready).eq(true), intent: i => {',
          '  let paint;',
          "  paint = tw('border-secondary');",
          '  i.feedback.style.use(paint);',
          '} });',
          'def.rule({ when: w => w.state(active).eq(true), intent: i => i.feedback.style.use(paint) });',
        ].join('\n')
      );
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[ready]:bg-secondary');
      expect(tokens).not.toContain('data-[ready]:bg-primary');
      expect(tokens).toContain('data-[active]:text-primary');
      expect(tokens).toContain('data-[active]:text-secondary');
      expect(tokens).toContain('data-[ready]:border-secondary');
      expect(tokens).toContain('data-[active]:border-primary');
      expect(tokens).not.toContain('data-[active]:border-secondary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not prefix unused token expressions beside a consumed prebound style handle', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-consumed-handle-'));
    try {
      const consumer = [
        "import { tw } from '@proto.ui/core';",
        "const enabled = def.state.bool('enabled', false);",
        "def.expose.state('enabled', enabled);",
        "const chosen = tw('bg-primary');",
        "def.rule({ when: (w) => w.state(enabled).eq(true), intent: (i) => { tw('bg-secondary'); i.feedback.style.use(chosen); } });",
      ].join('\n');
      expect(scanRuleStateReads(consumer, path.join(dir, 'consumer.proto.ts')).unresolved).toEqual(
        []
      );
      await writeFile(path.join(dir, 'consumer.proto.ts'), consumer);
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[enabled]:bg-primary');
      expect(tokens).not.toContain('data-[enabled]:bg-secondary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('preserves known sibling selectors beside unknown object and array members', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-known-siblings-'));
    try {
      await writeFile(
        path.join(dir, 'consumer.proto.ts'),
        [
          "const known = def.state.bool('knownFlag', false);",
          "def.expose.state('known', known);",
          'const maybe = enabled ? known : externalState;',
          'const controls = { ready: known, unrelated: maybe };',
          'const entries = [known, maybe];',
          rule('w.state(controls.ready).eq(true)'),
          "def.rule({ when: (w) => w.state(entries[0]).eq(true), intent: (i) => i.feedback.style.use(tw('bg-secondary')) });",
          'function declareRule(unrelated) {',
          '  const handles = { ready: known, unrelated };',
          "  def.rule({ when: (w) => w.state(handles.ready).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
          '}',
          'declareRule(externalState);',
        ].join('\n')
      );
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[known-flag]:bg-primary');
      expect(tokens).toContain('data-[known-flag]:bg-secondary');
      expect(tokens).toContain('data-[known-flag]:bg-accent');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('replaces source members with local states without retaining stale selectors', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-local-member-write-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const useFacts = defineAsHook({ name: 'facts', setup(def) { def.state.bool('ready', false); } });",
        ].join('\n')
      );
      await writeFile(
        path.join(dir, 'consumer.proto.ts'),
        [
          "import { useFacts } from './producer';",
          'const bag = useFacts().stateHandles;',
          "const local = def.state.bool('localFlag', false);",
          "def.expose.state('local', local);",
          'bag.ready = local;',
          'const selected = (enabled ? bag : bag).ready;',
          rule('w.state(selected).eq(true)'),
        ].join('\n')
      );
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[local-flag]:bg-primary');
      expect(tokens).not.toContain('data-[ready]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not certify a lookalike privileged factory as an observed state declaration', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-fake-focus-'));
    try {
      await writeFile(
        path.join(dir, 'tsconfig.json'),
        JSON.stringify({
          extends: path.join(REPO_ROOT, 'tsconfig.json'),
        })
      );
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          'function asFocusable() { return { focusVisible: { get() { return false; } } }; }',
          "export const useFake = defineAsHook({ name: 'fake', setup(def) {",
          '  const focus = asFocusable();',
          '  const visible = focus.focusVisible;',
          "  def.expose.state('visible', visible);",
          '} });',
        ].join('\n')
      );
      const consumer = [
        "import { useFake } from './producer';",
        'const state = useFake().stateHandles;',
        rule('w.state(state.focusVisible).eq(true)'),
      ].join('\n');
      const scan = scanRuleStateReads(consumer, path.join(dir, 'consumer.proto.ts'));
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([{ expression: 'state.focusVisible', reason: 'subject' }]);
      await writeFile(path.join(dir, 'consumer.proto.ts'), consumer);
      expect(await collectProtoStyleTokens(dir)).not.toContain('data-[focus-visible]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not capture observed provider states through a lookalike recorder method', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-fake-state-recorder-'));
    try {
      await writeFile(
        path.join(dir, 'tsconfig.json'),
        JSON.stringify({
          extends: path.join(REPO_ROOT, 'tsconfig.json'),
        })
      );
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "import { asFocusable } from '@proto.ui/hooks';",
          "export const useFacts = defineAsHook({ name: 'facts', setup() {",
          '  const focus = asFocusable();',
          '  const recorder = { state() {} };',
          "  recorder.state('visible', focus.focusVisible);",
          '} });',
        ].join('\n')
      );
      const consumer = [
        "import { useFacts } from './producer';",
        'const state = useFacts().stateHandles;',
        rule('w.state(state.focusVisible).eq(true)'),
      ].join('\n');
      const scan = scanRuleStateReads(consumer, path.join(dir, 'consumer.proto.ts'));
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([{ expression: 'state.focusVisible', reason: 'subject' }]);
      await writeFile(path.join(dir, 'consumer.proto.ts'), consumer);
      expect(await collectProtoStyleTokens(dir)).not.toContain('data-[focus-visible]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('uses the final factory holder value and rejects mutations through aliases', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-factory-holder-'));
    try {
      const cases = [
        { holder: 'const holder = Core;', trusted: true },
        {
          holder: 'const holder = { defineAsHook: Core.defineAsHook, ["other"]: fake };',
          trusted: true,
        },
        {
          holder: 'const holder = { defineAsHook: Core.defineAsHook, ["defineAsHook"]: fake };',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; const alias = holder; alias.defineAsHook = fake;',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook, ["defineAsHook"]() { return fake; } };',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook, get defineAsHook() { return fake; } };',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; [holder.defineAsHook] = [fake];',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; ({ x: holder.defineAsHook } = { x: fake });',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; const edit = { holder() { holder.defineAsHook = fake; } }; edit.holder();',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; for (let alias = holder; ; ) { alias.defineAsHook = fake; break; }',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; for (holder.defineAsHook of [fake]) {}',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook, replace() { this.defineAsHook = fake; } }; holder.replace();',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; let read; read = holder.defineAsHook;',
          trusted: true,
        },
        {
          holder:
            'function factory() { return { defineAsHook: Core.defineAsHook }; } const holder = factory();',
          trusted: true,
        },
        {
          holder:
            'const factory = () => ({ defineAsHook: Core.defineAsHook }); const holder = factory();',
          trusted: true,
        },
        {
          holder:
            'const factory = async () => ({ defineAsHook: Core.defineAsHook }); const holder = factory();',
          trusted: false,
        },
        {
          holder:
            'const factory = async function () { return { defineAsHook: Core.defineAsHook }; }; const holder = factory();',
          trusted: false,
        },
        {
          holder:
            'const factory = function* () { return { defineAsHook: Core.defineAsHook }; }; const holder = factory();',
          trusted: false,
        },
        {
          holder:
            'function factory(enabled) { if (enabled) return { defineAsHook: Core.defineAsHook }; } const holder = factory(false);',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; class Other { clear() { this.defineAsHook = fake; } }',
          trusted: true,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; class Other { clear() { this.replace(); } }',
          trusted: true,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook, build() { class Other { static defineAsHook = null; static { this.defineAsHook = fake; } } } };',
          trusted: true,
        },
        {
          holder:
            'function factory() { return { defineAsHook: Core.defineAsHook, get trigger() { this.defineAsHook = fake; return 0; } }; } const holder = factory(); holder.trigger;',
          trusted: false,
        },
        {
          holder:
            'function factory() { return { defineAsHook: Core.defineAsHook, get trigger() { class Other { [this.defineAsHook = fake] = 0; } return 0; } }; } const holder = factory(); holder.trigger;',
          trusted: false,
        },
        {
          holder:
            'function factory() { return { defineAsHook: Core.defineAsHook, get trigger() { const other = { [this.defineAsHook = fake]() {} }; return other; } }; } const holder = factory(); holder.trigger;',
          trusted: false,
        },
        {
          holder:
            'function factory() { return { defineAsHook: Core.defineAsHook, get trigger() { mutate(this); return 0; } }; } const holder = factory(); holder.trigger;',
          trusted: false,
        },
        {
          holder:
            'function factory() { return { defineAsHook: Core.defineAsHook }; } factory = () => ({ defineAsHook: fake }); const holder = factory();',
          trusted: false,
        },
        {
          holder:
            'function factory(defineAsHook) { return { defineAsHook }; } const holder = factory(fake);',
          trusted: false,
        },
        {
          holder:
            'const holder = { defineAsHook: Core.defineAsHook }; const edit = function holder() { holder.defineAsHook = fake; }; edit();',
          trusted: true,
        },
      ];
      for (const [index, example] of cases.entries()) {
        const producerName = `producer-${index}`;
        await writeFile(
          path.join(dir, `${producerName}.ts`),
          [
            "import * as Core from '@proto.ui/core';",
            'const fake = () => ({});',
            example.holder,
            "export const useFacts = holder.defineAsHook({ name: 'facts', setup(def) { def.state.bool('ghost', false); } });",
          ].join('\n')
        );
        const consumer = [
          `import { useFacts } from './${producerName}';`,
          'const bag = useFacts().stateHandles;',
          rule('w.state(bag.ghost).eq(true)'),
        ].join('\n');
        const scan = scanRuleStateReads(consumer, path.join(dir, `consumer-${index}.proto.ts`));
        expect(
          scan.usages.map(({ state }) => state),
          example.holder
        ).toEqual(example.trusted ? ['ghost'] : []);
        expect(scan.unresolved, example.holder).toEqual(
          example.trusted ? [] : [{ expression: 'bag.ghost', reason: 'subject' }]
        );
        await writeFile(path.join(dir, `consumer-${index}.proto.ts`), consumer);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects declaration-based factory replacements without rejecting shadowed loop bindings', () => {
    for (const { replacement, trusted } of [
      { replacement: 'var make = () => ({ defineAsHook: fake });', trusted: false },
      { replacement: 'var [make] = [() => ({ defineAsHook: fake })];', trusted: false },
      {
        replacement: 'var { replacement: make } = { replacement: () => ({ defineAsHook: fake }) };',
        trusted: false,
      },
      { replacement: 'for (var make of [() => ({ defineAsHook: fake })]) {}', trusted: false },
      { replacement: 'for (var [make] of [[() => ({ defineAsHook: fake })]]) {}', trusted: false },
      { replacement: 'for (var make in { replacement: 0 }) {}', trusted: false },
      { replacement: 'function make() { return { defineAsHook: fake }; }', trusted: false },
      { replacement: 'for (let make of [() => ({ defineAsHook: fake })]) {}', trusted: true },
      { replacement: 'var make;', trusted: true },
    ]) {
      const source = [
        "import { defineAsHook } from '@proto.ui/core';",
        'function check() {',
        '  const fake = () => ({});',
        '  function make() { return { defineAsHook }; }',
        `  ${replacement}`,
        '  const holder = make();',
        "  const useFacts = holder.defineAsHook({ name: 'facts', setup(d) { d.state.bool('ghost', false); } });",
        '  const state = useFacts().stateHandles;',
        rule('w.state(state.ghost).eq(true)'),
        '}',
      ].join('\n');
      const scan = scanRuleStateReads(source);
      expect(
        scan.usages.map(({ state }) => state),
        replacement
      ).toEqual(trusted ? ['ghost'] : []);
      expect(scan.unresolved, replacement).toEqual(
        trusted ? [] : [{ expression: 'state.ghost', reason: 'subject' }]
      );
    }
  });

  it('rejects receiver writes inside an imported returned factory object', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-imported-holder-'));
    try {
      for (const [index, trigger] of [
        'this.defineAsHook = fake;',
        'mutate(this);',
        'class Other { [this.defineAsHook = fake] = 0; }',
      ].entries()) {
        await writeFile(
          path.join(dir, `factory-${index}.mjs`),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            'const fake = () => ({});',
            `export function make() { return { defineAsHook, get trigger() { ${trigger} return 0; } }; }`,
          ].join('\n')
        );
        await writeFile(
          path.join(dir, `producer-${index}.ts`),
          [
            `import { make } from './factory-${index}.mjs';`,
            'const holder = make(); holder.trigger;',
            "export const useFacts = holder.defineAsHook({ name: 'facts', setup(d) { d.state.bool('ghost', false); } });",
          ].join('\n')
        );
        const source = [
          `import { useFacts } from './producer-${index}';`,
          'const state = useFacts().stateHandles;',
          rule('w.state(state.ghost).eq(true)'),
        ].join('\n');
        const scan = scanRuleStateReads(source, path.join(dir, `consumer-${index}.proto.ts`));
        expect(scan.usages, trigger).toEqual([]);
        expect(scan.unresolved, trigger).toEqual([
          { expression: 'state.ghost', reason: 'subject' },
        ]);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps returned factory imports bound to their defining module', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-factory-module-'));
    try {
      await mkdir(path.join(dir, 'a'));
      await mkdir(path.join(dir, 'b'));
      await writeFile(path.join(dir, 'a/api.mjs'), 'export const defineAsHook = () => ({});');
      await writeFile(
        path.join(dir, 'a/make.mjs'),
        [
          "import * as api from './api.mjs';",
          'export function make() { return { defineAsHook: api.defineAsHook }; }',
        ].join('\n')
      );
      await writeFile(
        path.join(dir, 'b/api.mjs'),
        "export { defineAsHook } from '@proto.ui/core';"
      );
      await writeFile(
        path.join(dir, 'b/producer.ts'),
        [
          "import { make } from '../a/make.mjs';",
          'const alias = make;',
          'const holder = alias();',
          "export const useFacts = holder.defineAsHook({ name: 'facts', setup(d) { d.state.bool('ghost', false); } });",
        ].join('\n')
      );
      const source = [
        "import { useFacts } from './producer';",
        'const state = useFacts().stateHandles;',
        rule('w.state(state.ghost).eq(true)'),
      ].join('\n');
      const file = path.join(dir, 'b/consumer.proto.ts');
      await writeFile(file, source);
      const scan = scanRuleStateReads(source, file);
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([{ expression: 'state.ghost', reason: 'subject' }]);
      expect(await collectProtoStyleTokens(dir)).not.toContain('data-[ghost]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('distinguishes real synchronous captures from overwritten or shadowed setup declarations', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-capture-boundaries-'));
    try {
      const cases = [
        {
          definition:
            "export const useFacts = defineAsHook({ name: 'facts', setup(def) { def.state.bool('ready', false); } });",
          trusted: true,
        },
        {
          definition:
            "export const useFacts = defineAsHook({ name: 'facts', setup(def) { (() => def.state.bool('ready', false))(); } });",
          trusted: true,
        },
        {
          definition:
            "export default defineAsHook({ name: 'facts', setup(def) { def.state.bool('ready', false); } });",
          trusted: true,
          defaultExport: true,
        },
        {
          definition:
            "export const useFacts = defineAsHook({ name: 'facts', setup(def) { { const def = { state: { bool() {} } }; def.state.bool('ready', false); } } });",
          trusted: false,
        },
        {
          definition:
            "export const useFacts = defineAsHook({ name: 'facts', setup(def) { def.state.bool('ready', false); }, ...{ setup() {} } });",
          trusted: false,
        },
        {
          definition:
            "export let useFacts = defineAsHook({ name: 'facts', setup(def) { def.state.bool('ready', false); } }); useFacts = () => ({});",
          trusted: false,
        },
        {
          definition:
            "export const useFacts = defineAsHook({ name: 'facts', setup(def) { let key = 'ready'; key = 'other'; def.state.bool(key, false); } });",
          trusted: false,
        },
      ];
      for (const [index, example] of cases.entries()) {
        await writeFile(
          path.join(dir, `producer-${index}.ts`),
          ["import { defineAsHook } from '@proto.ui/core';", example.definition].join('\n')
        );
        const consumer = [
          example.defaultExport
            ? `import useFacts from './producer-${index}';`
            : `import { useFacts } from './producer-${index}';`,
          'const bag = useFacts().stateHandles;',
          rule('w.state(bag.ready).eq(true)'),
        ].join('\n');
        const scan = scanRuleStateReads(consumer, path.join(dir, `consumer-${index}.proto.ts`));
        expect(
          scan.usages.map(({ state }) => state),
          example.definition
        ).toEqual(example.trusted ? ['ready'] : []);
        expect(scan.unresolved).toEqual(
          example.trusted ? [] : [{ expression: 'bag.ready', reason: 'subject' }]
        );
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not certify stale members after logical or compound writes through aliases', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-compound-member-'));
    try {
      for (const [index, operator] of ['=', '&&=', '||=', '??=', '+='].entries()) {
        const folder = path.join(dir, String(index));
        await mkdir(folder);
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const useFirst = defineAsHook({ name: 'first', setup(d) { d.state.bool('first', false); d.state.bool('stable', false); }, projectHandle(r) { return { ready: r.stateHandles.first, stable: r.stateHandles.stable }; } });",
            "export const useSecond = defineAsHook({ name: 'second', setup(d) { d.state.bool('second', false); } });",
          ].join('\n')
        );
        const consumer = [
          "import { useFirst, useSecond } from './producer';",
          'const bag = useFirst();',
          'const alias = bag;',
          `alias.ready ${operator} ${operator === '||=' || operator === '??=' ? '(alias.stable = useSecond().stateHandles.second, useSecond().stateHandles.second)' : 'useSecond().stateHandles.second'};`,
          rule('w.state(bag.ready).eq(true)'),
          "def.rule({ when: w => w.state(bag.stable).eq(true), intent: i => i.feedback.style.use(tw('bg-secondary')) });",
        ].join('\n');
        const file = path.join(folder, 'consumer.proto.ts');
        await writeFile(file, consumer);
        const scan = scanRuleStateReads(consumer, file);
        expect(
          scan.usages.map(({ state }) => state),
          operator
        ).toEqual(
          operator === '+='
            ? ['stable']
            : [operator === '||=' || operator === '??=' ? 'first' : 'second', 'stable']
        );
        expect(scan.unresolved, operator).toEqual(
          operator === '+=' ? [{ expression: 'bag.ready', reason: 'subject' }] : []
        );
        const tokens = await collectProtoStyleTokens(folder);
        expect(
          tokens.filter((token) => typeof token === 'string' && token.includes(':')),
          operator
        ).toEqual(
          operator === '+='
            ? ['data-[stable]:bg-secondary']
            : [
                `data-[${operator === '||=' || operator === '??=' ? 'first' : 'second'}]:bg-primary`,
                'data-[stable]:bg-secondary',
              ]
        );
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps destructured conditional member selectors separate', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-destructured-alternatives-'));
    try {
      for (const shape of ['object', 'array']) {
        const folder = path.join(dir, shape);
        await mkdir(folder);
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            ...['alpha', 'beta'].map(
              (name) =>
                `export const use${name} = defineAsHook({ name: '${name}', setup(d) { d.state.bool('${name}', false); }, projectHandle(r) { return ${shape === 'object' ? `{ ready: r.stateHandles.${name} }` : `[r.stateHandles.${name}]`}; } });`
            ),
          ].join('\n')
        );
        const consumer = [
          "import { usealpha, usebeta } from './producer';",
          `const ${shape === 'object' ? '{ ready }' : '[ready]'} = enabled ? usealpha() : usebeta();`,
          rule('w.state(ready).eq(true)'),
        ].join('\n');
        const file = path.join(folder, 'consumer.proto.ts');
        await writeFile(file, consumer);
        const tokens = await collectProtoStyleTokens(folder);
        expect(
          tokens.filter((token) => typeof token === 'string' && token.includes(':')),
          shape
        ).toEqual(['data-[alpha]:bg-primary', 'data-[beta]:bg-primary']);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('withholds ambiguous conditional constructors without losing independent states', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-conditional-constructors-'));
    try {
      for (const constructors of [
        ['fromInteraction', 'bool'],
        ['bool', 'fromInteraction'],
        ['fromInteraction', 'bool', 'bool'],
        ['bool', 'bool'],
      ]) {
        const folder = path.join(dir, constructors.join('-'));
        await mkdir(folder);
        const declarations = constructors.map(
          (constructor) =>
            `d.state.${constructor}('hovered'${constructor === 'bool' ? ', false' : ''});`
        );
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            'declare const enabled: boolean;',
            'declare const alternate: boolean;',
            "export const useFacts = defineAsHook({ name: 'facts', setup(d) {",
            `  if (enabled) ${declarations[0]} else ${declarations.length === 3 ? `if (alternate) ${declarations[1]} else ${declarations[2]}` : declarations[1]}`,
            "  d.state.bool('stable', false);",
            '} });',
          ].join('\n')
        );
        const consumer = [
          "import { useFacts } from './producer';",
          'const bag = useFacts().stateHandles;',
          `if (bag?.hovered) { ${rule('w.state(bag.hovered).eq(true)')} }`,
          "def.rule({ when: w => w.state(bag.stable).eq(true), intent: i => i.feedback.style.use(tw('bg-secondary')) });",
        ].join('\n');
        const file = path.join(folder, 'consumer.proto.ts');
        await writeFile(file, consumer);
        const ambiguous = constructors.some((constructor) => constructor !== constructors[0]);
        const scan = scanRuleStateReads(consumer, file);
        expect(
          scan.usages.map(({ state }) => state),
          constructors.join('/')
        ).toEqual(ambiguous ? ['stable'] : ['hovered', 'stable']);
        expect(scan.unresolved, constructors.join('/')).toEqual(
          ambiguous ? [{ expression: 'bag.hovered', reason: 'subject' }] : []
        );
        const tokens = await collectProtoStyleTokens(folder);
        expect(
          tokens.filter((token) => typeof token === 'string' && token.includes(':')),
          constructors.join('/')
        ).toEqual(
          ambiguous
            ? ['data-[stable]:bg-secondary']
            : ['data-[hovered]:bg-primary', 'data-[stable]:bg-secondary']
        );
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('captures proven state facade aliases but rejects replaced or shadowed facades', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-state-facade-alias-'));
    try {
      const cases = [
        {
          body: "const state = d.state; const alias = state; alias.bool('ready', false);",
          trusted: true,
        },
        {
          body: "const owner = d; const state = owner.state; state.bool('ready', false);",
          trusted: true,
        },
        {
          body: "const state = d.state; function noop(owner, config) { void config; } noop(d, { d: 0, state: 0 }); state.bool('ready', false);",
          trusted: true,
        },
        {
          body: "const state = d.state; const noop = () => ({ d: 0, state: 0 }); state.bool('ready', false);",
          trusted: true,
        },
        {
          body: "const state = d.state; type Facade = typeof state; (state as Facade).bool('ready', false);",
          trusted: true,
        },
        {
          body: "let state = d.state; state = foreign; state.bool('ready', false);",
          trusted: false,
        },
        {
          body: "const state = d.state; { const state = foreign; state.bool('ready', false); }",
          trusted: false,
        },
      ];
      for (const [index, example] of cases.entries()) {
        const folder = path.join(dir, String(index));
        await mkdir(folder);
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            `export const useFacts = defineAsHook({ name: 'facts', setup(d) { ${example.body} } });`,
          ].join('\n')
        );
        const consumer = [
          "import { useFacts } from './producer';",
          'const bag = useFacts().stateHandles;',
          rule('w.state(bag.ready).eq(true)'),
        ].join('\n');
        const file = path.join(folder, 'consumer.proto.ts');
        await writeFile(file, consumer);
        const scan = scanRuleStateReads(consumer, file);
        expect(
          scan.usages.map(({ state }) => state),
          example.body
        ).toEqual(example.trusted ? ['ready'] : []);
        expect(scan.unresolved, example.body).toEqual(
          example.trusted ? [] : [{ expression: 'bag.ready', reason: 'subject' }]
        );
        const tokens = await collectProtoStyleTokens(folder);
        expect(
          tokens.filter((token) => typeof token === 'string' && token.includes(':')),
          example.body
        ).toEqual(example.trusted ? ['data-[ready]:bg-primary'] : []);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('evaluates member receivers before intercepting logical assignments', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-receiver-effect-'));
    try {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        "def.expose.state('first', first);",
        "def.expose.state('second', second);",
        'let bag = { ready: first, stable: first };',
        'const other = { ready: second, stable: second };',
        '(bag = other).ready ||= first;',
        rule('w.state(bag.stable).eq(true)'),
      ].join('\n');
      const file = path.join(dir, 'consumer.proto.ts');
      await writeFile(file, source);
      const scan = scanRuleStateReads(source, file);
      expect(scan.unresolved).toEqual([]);
      expect(scan.exposedLocals.map(({ attribute }) => attribute)).toEqual(['second-flag']);
      expect(
        (await collectProtoStyleTokens(dir)).filter(
          (token) => typeof token === 'string' && token.includes(':')
        )
      ).toEqual(['data-[second-flag]:bg-primary']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('applies logical RHS effects before resolving the replacement handle', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-logical-rhs-effect-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const useFirst = defineAsHook({ name: 'first', setup(d) { d.state.bool('first', false); d.state.bool('stable', false); }, projectHandle(r) { return { ready: r.stateHandles.first, stable: r.stateHandles.stable }; } });",
          "export const useSecond = defineAsHook({ name: 'second', setup(d) { d.state.bool('second', false); } });",
        ].join('\n')
      );
      const source = [
        "import { useFirst, useSecond } from './producer';",
        'const bag = useFirst();',
        'bag.ready &&= ((bag.stable = useSecond().stateHandles.second) ? bag.stable : bag.stable);',
        rule('w.state(bag.ready).eq(true)'),
      ].join('\n');
      const file = path.join(dir, 'consumer.proto.ts');
      await writeFile(file, source);
      const scan = scanRuleStateReads(source, file);
      expect(scan.usages.map(({ state }) => state)).toEqual(['second']);
      expect(scan.unresolved).toEqual([]);
      expect(
        (await collectProtoStyleTokens(dir)).filter(
          (token) => typeof token === 'string' && token.includes(':')
        )
      ).toEqual(['data-[second]:bg-primary']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the evaluated receiver when the RHS rebinds its source name', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-captured-receiver-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const useFirst = defineAsHook({ name: 'first', setup(d) { d.state.bool('first', false); }, projectHandle(r) { return { ready: r.stateHandles.first }; } });",
          "export const useSecond = defineAsHook({ name: 'second', setup(d) { d.state.bool('second', false); } });",
        ].join('\n')
      );
      const source = [
        "import { useFirst, useSecond } from './producer';",
        'let bag: ReturnType<typeof useFirst> | ReturnType<typeof useSecond> = useFirst();',
        'const original = bag;',
        'bag.ready &&= ((bag = useSecond()) ? bag.stateHandles!.second : bag.stateHandles!.second);',
        rule('w.state(original.ready).eq(true)'),
      ].join('\n');
      const file = path.join(dir, 'consumer.proto.ts');
      await writeFile(file, source);
      const scan = scanRuleStateReads(source, file);
      expect(scan.usages.map(({ state }) => state)).toEqual(['second']);
      expect(scan.unresolved).toEqual([]);
      expect(
        (await collectProtoStyleTokens(dir)).filter(
          (token) => typeof token === 'string' && token.includes(':')
        )
      ).toEqual(['data-[second]:bg-primary']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('requires every projected member candidate before skipping a logical RHS', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-logical-optional-member-'));
    try {
      for (const [index, operator] of ['||=', '??='].entries()) {
        const folder = path.join(dir, String(index));
        await mkdir(folder);
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "export const useFirst = defineAsHook({ name: 'first', setup(d) { d.state.bool('first', false); d.state.bool('stable', false); }, projectHandle(r) { return { ready: r.stateHandles.first, stable: r.stateHandles.stable }; } });",
            "export const useOptional = defineAsHook({ name: 'optional', setup(d) { d.state.bool('stable', false); }, projectHandle(r) { return { ready: undefined, stable: r.stateHandles.stable }; } });",
            "export const useSecond = defineAsHook({ name: 'second', setup(d) { d.state.bool('second', false); } });",
          ].join('\n')
        );
        const source = [
          "import { useFirst, useOptional, useSecond } from './producer';",
          'const bag = enabled ? useFirst() : useOptional();',
          `bag.ready ${operator} useSecond().stateHandles.second;`,
          rule('w.state(bag.ready).eq(true)'),
          "def.rule({ when: w => w.state(bag.stable).eq(true), intent: i => i.feedback.style.use(tw('bg-secondary')) });",
        ].join('\n');
        const file = path.join(folder, 'consumer.proto.ts');
        await writeFile(file, source);
        const scan = scanRuleStateReads(source, file);
        expect(scan.unresolved, operator).toEqual([{ expression: 'bag.ready', reason: 'subject' }]);
        expect(
          (await collectProtoStyleTokens(folder)).filter(
            (token) => typeof token === 'string' && token.includes(':')
          ),
          operator
        ).toEqual(['data-[stable]:bg-secondary']);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('visits a logical RHS when a local receiver branch has no state member', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-local-optional-member-'));
    try {
      for (const [index, operator] of ['||=', '??='].entries()) {
        const folder = path.join(dir, String(index));
        await mkdir(folder);
        const source = [
          "const first = def.state.bool('first', false);",
          "const second = def.state.bool('second', false);",
          "def.expose.state('first', first);",
          "def.expose.state('second', second);",
          'const bag = enabled ? { ready: first } : { ready: undefined };',
          `bag.ready ${operator} (def.rule({ when: w => w.state(second).eq(true), intent: i => i.feedback.style.use(tw('bg-secondary')) }), second);`,
        ].join('\n');
        await writeFile(path.join(folder, 'consumer.proto.ts'), source);
        expect(await collectProtoStyleTokens(folder), operator).toContain(
          'data-[second]:bg-secondary'
        );
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not use absent legacy members as logical truthiness proofs', () => {
    for (const operator of ['||=', '??=']) {
      const source = [
        "const visible = def.state.bool('visible', false);",
        "const hidden = def.state.bool('hidden'.trim(), false);",
        "def.expose.state('visible', visible);",
        "def.expose.state('hidden', hidden);",
        'let current = visible;',
        'const bag = asButton().stateHandles;',
        `bag.extra ${operator} (current = hidden);`,
        rule('w.state(current).eq(true)'),
      ].join('\n');
      const scan = scanRuleStateReads(source);
      expect(scan.unresolved, operator).toEqual([{ expression: 'current', reason: 'subject' }]);
      expect(scan.exposedLocals, operator).toEqual([]);
    }
  });

  it('preserves opaque exposure uncertainty instead of classifying its state as internal', () => {
    const source = [
      "const hidden = def.state.bool('hidden'.trim(), false);",
      'const bag = { ready: hidden };',
      'bag.ready ||= hidden;',
      "def.expose.state('visible', bag.ready);",
      rule('w.state(hidden).eq(true)'),
    ].join('\n');
    const scan = scanRuleStateReads(source);
    expect(scan.usages).toEqual([]);
    expect(scan.exposedLocals).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'hidden', reason: 'subject' }]);
  });

  it('preserves opaque exposure provenance through destructured aliases', () => {
    const source = [
      "const hidden = def.state.bool('hidden'.trim(), false);",
      'const bag = { ready: hidden };',
      'bag.ready ||= hidden;',
      'const { ready } = bag;',
      "def.expose.state('visible', ready);",
      rule('w.state(hidden).eq(true)'),
    ].join('\n');
    const scan = scanRuleStateReads(source);
    expect(scan.usages).toEqual([]);
    expect(scan.exposedLocals).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'hidden', reason: 'subject' }]);
  });

  it.each([
    { label: 'helper argument', body: 'add(state);' },
    {
      label: 'detached constructor',
      body: "const original = state.bool; original('ready', false);",
    },
    {
      label: 'aggregate alias',
      body: "const box = { state }; replace(box); state.bool('ready', false);",
    },
    {
      label: 'owning definition aggregate',
      body: "replaceDef({ d }); state.bool('ready', false);",
    },
    { label: 'opaque owning definition call', body: "external(d); state.bool('ready', false);" },
    {
      label: 'stored owning definition aggregate',
      body: "const box = { d }; replaceDef(box); state.bool('ready', false);",
    },
    {
      label: 'owning definition constructor argument',
      body: "new External(d); state.bool('ready', false);",
    },
    {
      label: 'owning definition assignment',
      body: "external.owner = d; state.bool('ready', false);",
    },
    {
      label: 'bodyless helper overload',
      body: "function update(owner: any): void; function update(owner: any) { const original = owner.state.bool; owner.state.bool = (_name: string, value: boolean) => original('actual', value); } update(d); state.bool('ready', false);",
    },
  ])(
    'keeps facade escapes open without discarding earlier proven states ($label)',
    async ({ body }) => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-facade-escape-'));
      try {
        await writeFile(
          path.join(dir, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            "function add(state) { state.bool('ready', false); }",
            "function replace(box) { const original = box.state.bool; box.state.bool = (_name, value) => original('actual', value); }",
            "function replaceDef(box) { const original = box.d.state.bool; box.d.state.bool = (_name, value) => original('actual', value); }",
            `export const useFacts = defineAsHook({ name: 'facts', setup(d) { const state = d.state; state.bool('stable', false); ${body} } });`,
          ].join('\n')
        );
        const source = [
          "import { useFacts } from './producer';",
          'const bag = useFacts().stateHandles;',
          `if (bag?.ready) { ${rule('w.state(bag.ready).eq(true)')} }`,
          "def.rule({ when: w => w.state(bag.stable).eq(true), intent: i => i.feedback.style.use(tw('bg-secondary')) });",
        ].join('\n');
        const file = path.join(dir, 'consumer.proto.ts');
        await writeFile(file, source);
        const scan = scanRuleStateReads(source, file);
        expect(scan.usages.map(({ state }) => state)).toEqual(['stable']);
        expect(scan.unresolved).toEqual([{ expression: 'bag.ready', reason: 'subject' }]);
        expect(
          (await collectProtoStyleTokens(dir)).filter(
            (token) => typeof token === 'string' && token.includes(':')
          )
        ).toEqual(['data-[stable]:bg-secondary']);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  );

  it('leaves bodyless setup signatures open instead of proving optional states absent', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-bodyless-setup-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          'function setup(d: any): void;',
          "function setup(d: any) { d.state.bool('ready', false); }",
          "export const useFacts = defineAsHook({ name: 'facts', setup });",
        ].join('\n')
      );
      const source = [
        "import { useFacts } from './producer';",
        'const state = useFacts().stateHandles;',
        `if (state?.ready) { ${rule('w.state(state.ready).eq(true)')} }`,
      ].join('\n');
      const scan = scanRuleStateReads(source, path.join(dir, 'consumer.proto.ts'));
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([{ expression: 'state.ready', reason: 'subject' }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('invalidates constructor replacement through state facade aliases', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-facade-constructor-write-'));
    try {
      for (const [index, write] of [
        "state.bool = (_name, value) => original('actual', value); state.bool('ready', false);",
        "const alias = state; alias.bool = (_name, value) => original('actual', value); state.bool('ready', false);",
        "state.bool = (_name, value) => original('actual', value); d.state.bool('ready', false);",
      ].entries()) {
        const folder = path.join(dir, String(index));
        await mkdir(folder);
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            `export const useFacts = defineAsHook({ name: 'facts', setup(d) { const state = d.state; state.bool('stable', false); const original = state.bool; ${write} } });`,
          ].join('\n')
        );
        const source = [
          "import { useFacts } from './producer';",
          'const bag = useFacts().stateHandles;',
          rule('w.state(bag.ready).eq(true)'),
          `if (bag?.actual) { ${rule('w.state(bag.actual).eq(true)')} }`,
          "def.rule({ when: w => w.state(bag.stable).eq(true), intent: i => i.feedback.style.use(tw('bg-secondary')) });",
        ].join('\n');
        const file = path.join(folder, 'consumer.proto.ts');
        await writeFile(file, source);
        const scan = scanRuleStateReads(source, file);
        expect(
          scan.usages.map(({ state }) => state),
          write
        ).toEqual(['stable']);
        expect(scan.unresolved, write).toEqual([
          { expression: 'bag.ready', reason: 'subject' },
          { expression: 'bag.actual', reason: 'subject' },
        ]);
        expect(
          (await collectProtoStyleTokens(folder)).filter(
            (token) => typeof token === 'string' && token.includes(':')
          ),
          write
        ).toEqual(['data-[stable]:bg-secondary']);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('propagates member replacements through parent paths and shared ancestor aliases', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-nested-alias-write-'));
    try {
      const cases = [
        {
          projection: 'return { box: { ready: r.stateHandles.first } };',
          alias: 'h.box',
          subject: 'h.box.ready',
        },
        {
          projection:
            'const inner = { ready: r.stateHandles.first }; const shared = { inner }; return { a: shared, b: shared };',
          alias: 'h.a.inner',
          subject: 'h.b.inner.ready',
        },
      ];
      for (const [index, example] of cases.entries()) {
        const folder = path.join(dir, String(index));
        await mkdir(folder);
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            `export const useFirst = defineAsHook({ name: 'first', setup(d) { const s = d.state.bool('first', false); d.expose.state('first', s); }, projectHandle(r) { ${example.projection} } });`,
            "export const useSecond = defineAsHook({ name: 'second', setup(d) { const s = d.state.bool('second', false); d.expose.state('second', s); } });",
          ].join('\n')
        );
        const consumer = [
          "import { useFirst, useSecond } from './producer';",
          'const h = useFirst();',
          `const box = ${example.alias};`,
          'box.ready = useSecond().stateHandles.second;',
          rule(`w.state(${example.subject}).eq(true)`),
        ].join('\n');
        const file = path.join(folder, 'consumer.proto.ts');
        await writeFile(file, consumer);
        const scan = scanRuleStateReads(consumer, file);
        expect(
          scan.usages.map(({ state }) => state),
          example.subject
        ).toEqual(['second']);
        expect(scan.unresolved, example.subject).toEqual([]);
        const tokens = await collectProtoStyleTokens(folder);
        expect(tokens, example.subject).toContain('data-[second]:bg-primary');
        expect(tokens, example.subject).not.toContain('data-[first]:bg-primary');
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps consumer member writes out of cached producer summaries', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-cache-isolation-'));
    try {
      await writeFile(
        path.join(dir, 'producer.ts'),
        [
          "import { defineAsHook } from '@proto.ui/core';",
          "export const useFirst = defineAsHook({ name: 'first', setup(def) { def.state.bool('first', false); }, projectHandle(result) { return { ready: result.stateHandles.first }; } });",
          "export const useSecond = defineAsHook({ name: 'second', setup(def) { def.state.bool('second', false); } });",
        ].join('\n')
      );
      const changed = path.join(dir, 'changed.proto.ts');
      const untouched = path.join(dir, 'untouched.proto.ts');
      await writeFile(
        changed,
        [
          "import { useFirst, useSecond } from './producer';",
          'const bag = useFirst();',
          'bag.ready = useSecond().stateHandles.second;',
          rule('w.state(bag.ready).eq(true)'),
        ].join('\n')
      );
      await writeFile(
        untouched,
        [
          "import { useFirst } from './producer';",
          'const bag = useFirst();',
          "def.rule({ when: w => w.state(bag.ready).eq(true), intent: i => i.feedback.style.use(tw('bg-secondary')) });",
        ].join('\n')
      );
      for (const files of [
        [changed, untouched],
        [untouched, changed],
      ]) {
        const tokens = await collectProtoStyleTokensFromFiles(files);
        expect(tokens).toContain('data-[second]:bg-primary');
        expect(tokens).toContain('data-[first]:bg-secondary');
        expect(tokens).not.toContain('data-[second]:bg-secondary');
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps FormField children separate and reads CheckboxGroup helper captures', async () => {
    const source = [
      "import { asFormField } from '@proto.ui/prototypes-base/form';",
      "import { asCheckboxGroupItem } from '@proto.ui/prototypes-base/checkbox-group';",
      "const fieldRoot = asFormField().getAsHookHandle('as-field-root');",
      'const item = asCheckboxGroupItem().stateHandles;',
      rule('w.state(fieldRoot?.stateHandles.required).eq(true)'),
      rule('w.state(item.mixed).eq(true)'),
      rule('w.state(item.required).eq(true)'),
    ].join('\n');
    const scan = scanRuleStateReads(
      source,
      path.join(REPO_ROOT, 'packages/cli/test/hook-provenance.proto.ts')
    );

    expect(scan.usages).toEqual([
      { hook: 'asFormField', state: 'required' },
      { hook: 'asCheckboxGroupItem', state: 'mixed' },
    ]);
    expect(scan.unresolved).toEqual([{ expression: 'item.required', reason: 'subject' }]);
    expect(scan.usages[0].provenance?.declaredName).toBe('required');
    expect(scan.usages[1].provenance?.declaredName).toBe('mixed');
    expect(scan.usages[0].provenance?.owner.file).toContain('field/root.proto.ts');
    expect(scan.usages[1].provenance?.owner.file).toContain('checkbox-group/item.proto.ts');
  });

  it('reports a lowerable read it cannot trace instead of dropping it', () => {
    // A shape the scanner does not model. Before this was first-class, the leaf
    // vanished from the results and the gate stayed green while both the
    // extractor and the scan were blind to the same rule.
    const source = `const handles = pickHandles();\n${rule('w.state(handles.checked).eq(true)')}`;
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([{ expression: 'handles.checked', reason: 'subject' }]);
  });

  it('reads a rule whose when key is quoted', () => {
    // The extractor resolves this key through `getPropertyName`, so a quoted
    // rule still lowers. A scanner that skipped it would leave the rule out of
    // both results and keep the gate green on a missing hook entry.
    const quoted = `const { checked } = asCheckboxRoot().stateHandles;\ndef.rule({ 'when': (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });`;

    expect(scanRuleStateReads(quoted).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);
    expect(scanRuleStateReads(quoted).unresolved).toEqual([]);
  });

  it('lowers a state reached through a non-null assertion end to end', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          "import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          // `stateHandles` is optional on the hook result, so this is how an
          // author reaches it without a guard.
          '    const state = asCheckboxRoot().stateHandles!;',
          '    def.rule({',
          '      when: (w) => w.state(state.checked).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-primary')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      expect(await collectProtoStyleTokens(dir)).toContain('data-[checked]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('lowers a non-null asserted state argument end to end', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          "import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          '    const { checked } = asCheckboxRoot().stateHandles;',
          '    def.rule({',
          // The scanner unwraps this; the resolver had to learn to as well.
          '      when: (w) => w.state(checked!).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-primary')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      expect(await collectProtoStyleTokens(dir)).toContain('data-[checked]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reports a comparison the extractor does not lower', () => {
    // `resolveStateEqVariant` lowers the two boolean keywords and a string
    // literal. A number or a bound identifier produces no variant, so counting
    // these as covered would hide exactly the rules that emit nothing.
    const identifierOnly = `const { checked } = asCheckboxRoot().stateHandles;\n${rule('w.state(checked).eq(ENABLED)')}`;

    const enumString = `const { orientation } = asSeparatorRoot().stateHandles;\n${rule("w.state(orientation).eq('vertical')")}`;

    expect(scanRuleStateReads(identifierOnly).usages).toEqual([]);
    expect(scanRuleStateReads(identifierOnly).unresolved).toEqual([
      { expression: 'w.state(checked).eq(ENABLED)', reason: 'comparison' },
    ]);

    // A numeric literal does lower, for `number.discrete` bindings.
    const numeric = `const { step } = asSelectItem().stateHandles;\n${rule('w.state(step).eq(1)')}`;
    expect(scanRuleStateReads(numeric).unresolved).toEqual([]);
    // The string form the extractor does lower stays covered.
    expect(scanRuleStateReads(enumString).usages).toEqual([
      { hook: 'asSeparatorRoot', state: 'orientation' },
    ]);
    expect(scanRuleStateReads(enumString).unresolved).toEqual([]);
  });

  it('keeps each scope its own hook identity when a name is shadowed', () => {
    // The outer rule must stay asCheckboxRoot even though an inner block binds
    // the same identifier to a different hook.
    const nested = [
      'const state = asCheckboxRoot().stateHandles;',
      '{',
      '  const state = asSelectTrigger().stateHandles;',
      `  ${rule('w.state(state.placeholder).eq(true)')}`,
      '}',
      rule('w.state(state.checked).eq(true)'),
    ].join('\n');

    expect(scanRuleStateReads(nested).usages).toEqual([
      { hook: 'asSelectTrigger', state: 'placeholder' },
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);

    // Sibling scopes must not leak into one another either.
    const siblings = [
      'function a() {',
      '  const state = asCheckboxRoot().stateHandles;',
      `  ${rule('w.state(state.checked).eq(true)')}`,
      '}',
      'function b() {',
      '  const state = asToggle().stateHandles;',
      `  ${rule('w.state(state.active).eq(true)')}`,
      '}',
    ].join('\n');

    expect(scanRuleStateReads(siblings).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
      { hook: 'asToggle', state: 'active' },
    ]);
  });

  it('reports an exposed prototype-owned state instead of skipping it', () => {
    // Exposing the state is what gives it a host attribute, so the Web runtime
    // lowers rules on it. Skipping the read would leave the gate green while
    // the extractor had no selector to emit.
    const source = [
      "const hidden = def.state.bool('hidden', true);",
      "def.expose.state('hidden', hidden);",
      "def.rule({ when: (w) => w.state(hidden).eq(true), intent: (i) => i.feedback.style.use(tw('hidden')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'hidden', exposedAs: 'hidden', attribute: 'hidden' },
    ]);
  });

  it('keeps sibling scopes from sharing an exposure', () => {
    // A file-wide map would attribute the first exposure to the second handle.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      'function first(def) {',
      "  const flag = def.state.bool('firstFlag', false);",
      '  const publicFlag = flag;',
      "  def.expose.state('a', publicFlag);",
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
      'function second(def) {',
      "  const other = def.state.bool('secondFlag', false);",
      '  const publicFlag = other;',
      "  def.expose.state('b', publicFlag);",
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'a', attribute: 'first-flag' },
    ]);
  });

  it('resolves each alias hop where that hop was created', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'var current = first;',
      'const publicFlag = current;',
      'var current = second;',
      "def.expose.state('visible', publicFlag);",
      `def.rule({ when: (w) => w.state(first).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('follows an alias reassigned before the exposure', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let publicFlag = first;',
      'publicFlag = second;',
      "def.expose.state('visible', publicFlag);",
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('sees an alias reassigned inside a nested block', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let publicFlag = first;',
      '{',
      '  publicFlag = second;',
      '}',
      "def.expose.state('visible', publicFlag);",
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it("does not let one prototype's exposure reach a sibling's same-named state", () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      'function exposedSetup(def) {',
      "  const flag = def.state.bool('firstFlag', false);",
      "  def.expose.state('visible', flag);",
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
      'function internalSetup(def) {',
      "  const flag = def.state.bool('secondFlag', false);",
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    // Only the exposed one; the sibling's rule stays on the runtime plan.
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('accepts a constant-backed declared name the extractor resolves', () => {
    // Production resolves this constant, so reporting it unresolved would fail
    // the gate on code the extractor handles correctly.
    const source = [
      "const name = 'hidden';",
      'const flag = def.state.bool(name, false);',
      "def.expose.state('visible', flag);",
      "def.rule({ when: (w) => w.state(flag).eq(true), intent: (i) => i.feedback.style.use(tw('hidden')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'hidden' },
    ]);
  });

  it('maps an official semantic before normalizing the name', () => {
    const source = [
      "const flag = def.state.bool('@accessibility/checked', false);",
      "def.expose.state('visible', flag);",
      "def.rule({ when: (w) => w.state(flag).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');

    expect(scanRuleStateReads(source).exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'checked' },
    ]);
  });

  it('follows a handle written into the container before the exposure', () => {
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'controls.ready = second;',
      "def.expose.state('visible', controls.ready);",
      "def.rule({ when: (w) => w.state(second).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('leaves a member write after the exposure out of it', () => {
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      "def.expose.state('visible', controls.ready);",
      'controls.ready = second;',
      "def.rule({ when: (w) => w.state(first).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('normalizes a state named after an inherited object key', () => {
    // The official-name table is a plain object literal, so `constructor` must
    // not resolve to the function it inherits.
    const source = [
      "const flag = def.state.bool('constructor', false);",
      "def.expose.state('visible', flag);",
      "def.rule({ when: (w) => w.state(flag).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');

    expect(scanRuleStateReads(source).exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'constructor' },
    ]);
  });

  it('keeps a plain alias of an exposed local resolvable', () => {
    // Production resolves the alias, so a token binding here would report a
    // blind spot the extractor does not have.
    const source = [
      "const hidden = def.state.bool('hidden', true);",
      "def.expose.state('hidden', hidden);",
      'const alias = hidden;',
      "def.rule({ when: (w) => w.state(alias).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'alias', exposedAs: 'hidden', attribute: 'hidden' },
    ]);
  });

  it('replaces the member table when a whole container is assigned', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let controls = { ready: first };',
      'controls = { ready: second };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('gives both branches of a conditional member write an attribute', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'controls.ready = enabled ? first : second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(first).eq(true), intent: ${use} });`,
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('reads a member at the position it was written', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let current = first;',
      'const controls = { ready: current };',
      'current = second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(first).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('keeps the earlier handle when a write may be skipped', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let current = first;',
      'if (enabled) current = second;',
      "def.expose.state('visible', current);",
      `def.rule({ when: (w) => w.state(first).eq(true), intent: ${use} });`,
      `def.rule({ when: (w) => w.state(second).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'first', exposedAs: 'visible', attribute: 'first-flag' },
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('hoists a nested var redeclaration the rule reads', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      'function setup(def) {',
      "  const first = def.state.bool('firstFlag', false);",
      "  const second = def.state.bool('secondFlag', false);",
      '  var current = first;',
      '  {',
      '    var current = second;',
      '  }',
      "  def.expose.state('visible', current);",
      `  def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'current', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('accepts an element-access state declaration the extractor reads', () => {
    // Production resolves `def.state['bool'](…)`, so reporting it unresolved
    // would fail the gate on code the extractor handles correctly.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state['bool']('internalFlag', false);",
      "def.expose.state('visible', flag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
    ]);
  });

  it('admits every attribute the Web projection can actually write', () => {
    // The repository tree carries no digit-leading state, so the gate's own
    // predicate is asserted here rather than only through the shipped scan.
    for (const attribute of ['1st', 'hidden', 'focus-visible', 'a1', '2-of-3']) {
      expect(SELECTABLE_ATTRIBUTE.test(attribute), attribute).toBe(true);
      expect(createExposeStateWebNameMap(attribute).dataAttr, attribute).toBe(`data-${attribute}`);
    }
    for (const attribute of ['', '-leading', 'trailing-', 'double--hyphen', 'Upper', 'has space']) {
      expect(SELECTABLE_ATTRIBUTE.test(attribute), attribute).toBe(false);
    }
  });

  it('accepts an attribute that starts with a digit', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state.bool('1st', false);",
      "def.expose.state('1st', flag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([{ state: 'flag', exposedAs: '1st', attribute: '1st' }]);
  });

  it('reports every state a skippable alias may reach', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let current = first;',
      'if (enabled) current = second;',
      "def.expose.state('visible', current);",
      `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'current', exposedAs: 'visible', attribute: 'second-flag' },
      { state: 'current', exposedAs: 'visible', attribute: 'first-flag' },
    ]);
  });

  it('reads a state handle held in a plain container', () => {
    // Production resolves the member, so reporting it unresolved would fail the
    // gate on code the extractor lowers correctly.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state.bool('internalFlag', false);",
      'const controls = { ready: flag };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
    ]);
  });

  it('reads a destructured handle the rule uses by its alias', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, container] of [
      ['object literal', 'const { ready: publicFlag } = { ready: flag };'],
      ['array literal', 'const [publicFlag] = [flag];'],
      [
        'container variable',
        'const controls = { ready: flag };\nconst { ready: publicFlag } = controls;',
      ],
    ] as const) {
      const source = [
        "const flag = def.state.bool('internalFlag', false);",
        container,
        "def.expose.state('visible', publicFlag);",
        `def.rule({ when: (w) => w.state(publicFlag).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals, label).toEqual([
        { state: 'publicFlag', exposedAs: 'visible', attribute: 'internal-flag' },
      ]);
    }
  });

  it('reports both branches of a conditional alias', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const current = enabled ? first : second;',
      "def.expose.state('visible', current);",
      `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'current', exposedAs: 'visible', attribute: 'first-flag' },
      { state: 'current', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('resolves an alias target where the alias was written', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      'function setup(def) {',
      "  const flag = def.state.bool('outerFlag', false);",
      '  const current = flag;',
      '  {',
      "    const flag = def.state.bool('innerFlag', false);",
      '    void flag;',
      "    def.expose.state('visible', current);",
      '  }',
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'outer-flag' },
    ]);
  });

  it('reads a container member the rule uses after a write', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, write, read] of [
      ['property access', 'controls.ready = second;', 'controls.ready'],
      ['element access', "controls['ready'] = second;", "controls['ready']"],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'const controls = { ready: first };',
        write,
        `def.expose.state('visible', ${read});`,
        `def.rule({ when: (w) => w.state(${read}).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals, label).toEqual([
        { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
      ]);
    }
  });

  it('keeps the earlier member when the write may be skipped', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'if (enabled) controls.ready = second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('follows a member written through an alias of the container', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'const alias = controls;',
      'alias.ready = second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'second', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('keeps both members when the alias write may be skipped', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'const controls = { ready: first };',
      'const alias = controls;',
      'if (enabled) alias.ready = second;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('keeps the earlier handle when the write is inside a callback', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let flag = first;',
      "def.on('refresh', () => { flag = second; });",
      "def.expose.state('visible', flag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('treats an immediately invoked write as ordered', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let flag = first;',
      '(() => { flag = second; })();',
      "def.expose.state('visible', flag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('accepts an intent reading a container that also holds a handle', () => {
    // The extractor emits `bg-red` and `data-[internal-flag]:bg-red` for this,
    // so reporting the intent unresolved reds the gate on working code.
    const source = [
      "const flag = def.state.bool('internalFlag', false);",
      "def.expose.state('visible', flag);",
      "const controls = { ready: flag, className: 'bg-red' };",
      'def.rule({',
      '  when: (w) => w.state(controls.ready).eq(true),',
      "  intent: (i) => i.feedback.style.use(tw(controls['className'])),",
      '});',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
    ]);
  });

  it('keeps the earlier handle across an async or generator IIFE', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, iife] of [
      ['async', '(async () => { await 0; current = second; })();'],
      ['generator', '(function* () { current = second; })();'],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'let current = first;',
        iife,
        "def.expose.state('visible', current);",
        `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        'first-flag',
        'second-flag',
      ]);
    }
  });

  it('keeps the earlier handle when an IIFE may not reach the write', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, iife] of [
      ['early return', '(() => { return; current = second; })();'],
      ['early throw', "(() => { throw new Error('x'); current = second; })();"],
      ['conditional return', '(() => { if (enabled) return; current = second; })();'],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'let current = first;',
        iife,
        "def.expose.state('visible', current);",
        `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        'first-flag',
        'second-flag',
      ]);
    }
  });

  it('keeps the earlier member across a callback, two objects, or an unreadable key', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, lines, read] of [
      [
        'callback write',
        [
          'const controls = { ready: first };',
          "def.on('refresh', () => { controls.ready = second; });",
        ],
        'controls.ready',
      ],
      [
        'either of two objects',
        [
          'const controlsA = { ready: first };',
          'const controlsB = { ready: first };',
          'const alias = enabled ? controlsA : controlsB;',
          'alias.ready = second;',
        ],
        'controlsA.ready',
      ],
      [
        'unreadable key',
        ['const controls = { ready: first };', "const key = 'ready';", 'controls[key] = second;'],
        'controls.ready',
      ],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        ...lines,
        `def.expose.state('visible', ${read});`,
        `def.rule({ when: (w) => w.state(${read}).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        'first-flag',
        'second-flag',
      ]);
    }
  });

  it('measures a member write against the container, not the alias', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, block, expected] of [
      [
        'alias inside a callback',
        "def.on('refresh', () => { const alias = controls; alias.ready = second; });",
        ['first-flag', 'second-flag'],
      ],
      [
        'alias in a plain block',
        '{ const alias = controls; alias.ready = second; }',
        ['second-flag'],
      ],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'const controls = { ready: first };',
        block,
        "def.expose.state('visible', controls.ready);",
        `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        ...expected,
      ]);
    }
  });

  it('keeps the replaced container when the replacement may be skipped', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let controls = { ready: first };',
      'if (enabled) controls = { ready: second };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('reads both containers a conditional replacement may install', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      "const third = def.state.bool('thirdFlag', false);",
      'let controls = { ready: first };',
      'controls = enabled ? { ready: second } : { ready: third };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'second-flag',
      'third-flag',
    ]);
  });

  it('reaches every leaf of a nested conditional replacement', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      "const third = def.state.bool('thirdFlag', false);",
      'let controls = a ? (b ? { ready: first } : { ready: second }) : { ready: third };',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
      'third-flag',
    ]);
  });

  it('keeps the literal branch of a mixed conditional replacement', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      "const third = def.state.bool('thirdFlag', false);",
      'const otherControls = { ready: third };',
      'let controls = { ready: first };',
      'controls = enabled ? { ready: second } : otherControls;',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'second-flag',
      'third-flag',
    ]);
  });

  it('records every candidate when a member write meets a skippable replacement', () => {
    // Whichever order they are written in, the gate has to record the same set
    // the extractor emits, or it certifies an incomplete one.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, lines, expected] of [
      [
        'write after replace',
        [
          'let controls = { ready: first };',
          'if (enabled) controls = { ready: second };',
          'if (other) controls.ready = third;',
        ],
        ['first-flag', 'second-flag', 'third-flag'],
      ],
      [
        'write before replace',
        [
          'let controls = { ready: first };',
          'controls.ready = third;',
          'if (enabled) controls = { ready: second };',
        ],
        ['second-flag', 'third-flag'],
      ],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        "const third = def.state.bool('thirdFlag', false);",
        ...lines,
        "def.expose.state('visible', controls.ready);",
        `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        ...expected,
      ]);
    }
  });

  it('refuses to certify a container with an unresolvable branch', () => {
    // `enabled ? { … } : makeControls()` can leave the member on a handle this
    // never sees. Certifying the branch it does see would vouch for a set the
    // runtime can step outside of, so the shape has to go unresolved instead.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const second = def.state.bool('secondFlag', false);",
      "const third = def.state.bool('thirdFlag', false);",
      'const makeControls = () => ({ ready: third });',
      'let controls = { ready: second };',
      'controls = enabled ? { ready: second } : makeControls();',
      "def.expose.state('visible', controls.ready);",
      `def.rule({ when: (w) => w.state(controls.ready).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.exposedLocals).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['subject']);
  });

  it('reports every leaf of a nested local-state conditional', () => {
    // The gate is the oracle for the extractor, so a blind spot here would let
    // a future extractor regression on this shape through unnoticed.
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    for (const [label, initializer] of [
      ['nested on the left', 'a ? (b ? first : second) : third'],
      ['nested on the right', 'a ? first : (b ? second : third)'],
    ] as const) {
      const source = [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        "const third = def.state.bool('thirdFlag', false);",
        `const current = ${initializer};`,
        "def.expose.state('visible', current);",
        `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      ].join('\n');
      const scan = scanRuleStateReads(source);

      expect(scan.unresolved, label).toEqual([]);
      expect(scan.exposedLocals.map((local) => local.attribute).sort(), label).toEqual([
        'first-flag',
        'second-flag',
        'third-flag',
      ]);
    }

    // The ordinary two-branch merge is unchanged.
    const flat = scanRuleStateReads(
      [
        "const first = def.state.bool('firstFlag', false);",
        "const second = def.state.bool('secondFlag', false);",
        'const current = a ? first : second;',
        "def.expose.state('visible', current);",
        `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
      ].join('\n')
    );
    expect(flat.unresolved).toEqual([]);
    expect(flat.exposedLocals.map((local) => local.attribute).sort()).toEqual([
      'first-flag',
      'second-flag',
    ]);
  });

  it('reports an exposed state whose declared name it cannot read', () => {
    // The extractor emits nothing for this, so certifying the expose key would
    // be the fail-closed mismatch this gate exists to prevent.
    const source = [
      'const flag = def.state.bool(makeStateName(), false);',
      "def.expose.state('visible', flag);",
      "def.rule({ when: (w) => w.state(flag).eq(true), intent: (i) => i.feedback.style.use(tw('bg-accent')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.exposedLocals).toEqual([]);
    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['subject']);
  });

  it('treats a prototype-owned state as neither a hook pair nor a blind spot', () => {
    // Base prototypes declare their own states and key rules on them. Those need
    // no resolver entry, so they must not be reported as a hook pair, and they
    // must not trip the fail-closed check either.
    const source = `const hidden = def.state.bool('hidden', true);\n${rule('w.state(hidden).eq(true)')}`;
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved).toEqual([]);
  });

  it('reports a rule handed a binding instead of an object literal', () => {
    // The runtime lowers this; the extractor reads object literals only. Before
    // it was reported, the invocation was skipped and left no trace either way.
    const source = [
      "const spec = { when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) };",
      'def.rule(spec);',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['spec']);
  });

  it('reports rule shapes neither analyzer reads', () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const body = '(w) => w.state(checked).eq(true)';
    const use = "(i) => i.feedback.style.use(tw('bg-primary'))";

    // Valid specs the runtime calls normally. Both the extractor and this
    // scanner read plain property assignments, so silence would be fail-open.
    const shorthand = `${handles}\nconst when = ${body};\nconst intent = ${use};\ndef.rule({ when, intent });`;
    const method = `${handles}\ndef.rule({ when: ${body}, intent(i) { return i.feedback.style.use(tw('bg-primary')); } });`;

    for (const source of [shorthand, method]) {
      expect(scanRuleStateReads(source).usages).toEqual([]);
      expect(scanRuleStateReads(source).unresolved.map((miss) => miss.reason)).toEqual(['spec']);
    }

    // An aliased builder member: the runtime records the dependency, the
    // extractor's selector analysis reads a property access and emits nothing.
    const aliased = `${handles}\ndef.rule({ when: ({ state }) => state(checked).eq(true), intent: ${use} });`;
    expect(scanRuleStateReads(aliased).usages).toEqual([]);
    expect(scanRuleStateReads(aliased).unresolved.map((miss) => miss.reason)).toEqual([
      'condition',
    ]);

    // A `tw(...)` the extractor cannot resolve yields no token for the variant
    // to prefix, so the rendered selector would have no CSS.
    const opaque = `${handles}\ndef.rule({ when: ${body}, intent: (i) => i.feedback.style.use(tw(getRuleTokens())) });`;
    expect(scanRuleStateReads(opaque).usages).toEqual([]);
    expect(scanRuleStateReads(opaque).unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('requires every intent token handle to be one the extractor can resolve', async () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const when = '(w) => w.state(checked).eq(true)';
    const usage = { hook: 'asCheckboxRoot', state: 'checked' };

    // Resolvable: a local constant.
    const local = `const TOKENS = 'bg-primary';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS)) });`;
    expect(scanRuleStateReads(local).usages).toEqual([usage]);
    expect(scanRuleStateReads(local).unresolved).toEqual([]);

    // A relative import is judged by the module's own initializer, the way the
    // extractor loads it — not by the fact that the specifier was relative.
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      const widget = path.join(dir, 'widget.proto.ts');
      const body = (name: string) =>
        `import { ${name} } from './style';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(${name})) });`;
      await writeFile(
        path.join(dir, 'style.ts'),
        [
          "export const LITERAL_TOKENS = 'bg-primary';",
          'export const COMPUTED_TOKENS = getTokens();',
        ].join('\n')
      );

      const literal = scanRuleStateReads(body('LITERAL_TOKENS'), widget);
      expect(literal.usages).toEqual([usage]);
      expect(literal.unresolved).toEqual([]);

      // The extractor loads this module and resolves the call to nothing, so
      // accepting it because the import was relative would be fail-open.
      const computed = scanRuleStateReads(body('COMPUTED_TOKENS'), widget);
      expect(computed.usages).toEqual([]);
      expect(computed.unresolved.map((miss) => miss.reason)).toEqual(['intent']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    // `applyImportBindings` skips non-relative specifiers entirely.
    const packaged = `import { TOKENS } from '@proto.ui/tokens';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS)) });`;
    expect(scanRuleStateReads(packaged).usages).toEqual([]);
    expect(scanRuleStateReads(packaged).unresolved.map((miss) => miss.reason)).toEqual(['intent']);

    // `tw` is variadic and the extractor reads every argument, so one
    // resolvable argument cannot vouch for the rest of the same call.
    const variadic = `${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw('bg-ok', getRuleTokens())) });`;
    expect(scanRuleStateReads(variadic).usages).toEqual([]);
    expect(scanRuleStateReads(variadic).unresolved.map((miss) => miss.reason)).toEqual(['intent']);

    // A mixed intent: the extractable handle must not vouch for the opaque one,
    // because the runtime prefixes both and only one gets CSS.
    const mixed = `${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw('bg-ok'), tw(getRuleTokens())) });`;
    expect(scanRuleStateReads(mixed).usages).toEqual([]);
    expect(scanRuleStateReads(mixed).unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('ignores an unrelated call in a block-bodied condition', () => {
    // The runtime dependency set holds the builder operations invoked, so an
    // unrelated call does not make the rule dynamic — and must not let the
    // state read escape the gate unchecked.
    const source = [
      'const { checked } = asCheckboxRoot().stateHandles;',
      'def.rule({',
      '  when: (w) => { metrics.record(); return w.state(checked).eq(true); },',
      "  intent: (i) => i.feedback.style.use(tw('bg-primary')),",
      '});',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.usages).toEqual([{ hook: 'asCheckboxRoot', state: 'checked' }]);
  });

  it('follows a handle bound by a loop initializer', () => {
    // Production registers a loop initializer in the loop's own scope, so
    // reporting this would be a blind spot the extractor does not have.
    const source = [
      'for (const state = asCheckboxRoot().stateHandles; once; )',
      "  def.rule({ when: (w) => w.state(state.checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.usages).toEqual([{ hook: 'asCheckboxRoot', state: 'checked' }]);
  });

  it('binds a loop initializer inside the loop, not over the outer name', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state.bool('outerFlag', false);",
      "for (let flag = def.state.bool('innerFlag', false); once; ) {",
      "  def.expose.state('visible', flag);",
      `  def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'inner-flag' },
    ]);
  });

  it('follows a reassigned alias the rule itself reads', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const first = def.state.bool('firstFlag', false);",
      "const second = def.state.bool('secondFlag', false);",
      'let current = first;',
      'current = second;',
      "def.expose.state('visible', current);",
      `def.rule({ when: (w) => w.state(current).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'current', exposedAs: 'visible', attribute: 'second-flag' },
    ]);
  });

  it('follows a handle aliased through a binding pattern', () => {
    const use = "(i) => i.feedback.style.use(tw('bg-accent'))";
    const source = [
      "const flag = def.state.bool('internalFlag', false);",
      'const { ready: publicFlag } = { ready: flag };',
      "def.expose.state('visible', publicFlag);",
      `def.rule({ when: (w) => w.state(flag).eq(true), intent: ${use} });`,
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.exposedLocals).toEqual([
      { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
    ]);
  });

  it('reports a condition only one branch of which reaches the runtime', () => {
    // The runtime lowers the selected branch; a source walk sees both and the
    // extractor combines them into a selector nothing matches.
    const source = [
      'const { checked, indeterminate } = asCheckboxRoot().stateHandles;',
      "def.rule({ when: (w) => (choose ? w.state(checked).eq(true) : w.state(indeterminate).eq(true)), intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['condition']);
  });

  it('keeps a name declared in two disjoint scopes resolvable in each', () => {
    // A file-wide map called this ambiguous and blocked both rules. The
    // extractor gives each scope its own binding.
    const source = [
      'function a() {',
      "  const TOKENS = 'bg-a';",
      '  const { checked } = asCheckboxRoot().stateHandles;',
      '  def.rule({ when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw(TOKENS)) });',
      '}',
      'function b() {',
      "  const TOKENS = 'bg-b';",
      '  const { indeterminate } = asCheckboxRoot().stateHandles;',
      '  def.rule({ when: (w) => w.state(indeterminate).eq(true), intent: (i) => i.feedback.style.use(tw(TOKENS)) });',
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.unresolved).toEqual([]);
    expect(scan.usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
      { hook: 'asCheckboxRoot', state: 'indeterminate' },
    ]);
  });

  it('follows a token through a chain of relative modules and stops at a bound separator', async () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const when = '(w) => w.state(checked).eq(true)';
    const usage = { hook: 'asCheckboxRoot', state: 'checked' };
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));

    try {
      const widget = path.join(dir, 'widget.proto.ts');
      // `loadModuleBindings` applies a module's own relative imports before
      // resolving its exports, so this chain is extractable in production.
      await writeFile(path.join(dir, 'base.ts'), "export const BASE = 'bg-primary';");
      await writeFile(
        path.join(dir, 'style.ts'),
        ["import { BASE } from './base';", 'export const TOKENS = BASE;'].join('\n')
      );

      const chained = `import { TOKENS } from './style';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS)) });`;
      const scan = scanRuleStateReads(chained, widget);
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages).toEqual([usage]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    // `resolveJoinCall` reads a literal separator and otherwise falls back to
    // `,`, while the runtime joins on the real value — so the two disagree.
    const literalSeparator = `${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(['bg-a', 'text-b'].join(' '))) });`;
    expect(scanRuleStateReads(literalSeparator).usages).toEqual([usage]);

    const boundSeparator = `const SEP = ' ';\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(['bg-a', 'text-b'].join(SEP))) });`;
    expect(scanRuleStateReads(boundSeparator).usages).toEqual([]);
    expect(scanRuleStateReads(boundSeparator).unresolved.map((miss) => miss.reason)).toEqual([
      'intent',
    ]);
  });

  it('reports a rule reached through element access', () => {
    // The production walk matches a property access, so this reaches the same
    // runtime API and emits no variant.
    const source = [
      'const { checked } = asCheckboxRoot().stateHandles;',
      "def['rule']({ when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['spec']);
  });

  it('lets a parameter shadow an outer state handle', () => {
    // Falling through to the outer binding would approve `data-[checked]` for a
    // rule the runtime compiles against something else entirely.
    const source = [
      'const { checked } = asCheckboxRoot().stateHandles;',
      'const { open } = asSelectContent().stateHandles;',
      'function add(checked = open) {',
      "  def.rule({ when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
      '}',
    ].join('\n');
    const scan = scanRuleStateReads(source);

    expect(scan.usages).toEqual([]);
    expect(scan.unresolved.map((miss) => miss.reason)).toEqual(['subject']);
  });

  it('reads a token map only the way the extractor can', () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const when = '(w) => w.state(checked).eq(true)';
    const map = "const TOKENS = { active: 'bg-primary' };";
    const usage = { hook: 'asCheckboxRoot', state: 'checked' };

    // `resolveExpression` reads a token object through element access; dot
    // access resolves through `semanticMap`, which holds state handles.
    const element = `${map}\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS['active'])) });`;
    expect(scanRuleStateReads(element).usages).toEqual([usage]);

    const dotted = `${map}\n${handles}\ndef.rule({ when: ${when}, intent: (i) => i.feedback.style.use(tw(TOKENS.active)) });`;
    expect(scanRuleStateReads(dotted).usages).toEqual([]);
    expect(scanRuleStateReads(dotted).unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('reports a condition whose operator picks one operand', () => {
    // `&&` returns the second expression, so the runtime lowers `data-[b]` while
    // a source walk sees both and the extractor combines them.
    const handles = 'const { checked, indeterminate } = asCheckboxRoot().stateHandles;';
    const use = "(i) => i.feedback.style.use(tw('bg-primary'))";
    for (const operator of ['&&', '||', '??']) {
      const source = `${handles}\ndef.rule({ when: (w) => w.state(checked).eq(true) ${operator} w.state(indeterminate).eq(true), intent: ${use} });`;
      const scan = scanRuleStateReads(source);
      expect(scan.usages, operator).toEqual([]);
      expect(
        scan.unresolved.map((miss) => miss.reason),
        operator
      ).toEqual(['condition']);
    }
  });

  it('reports a condition a helper call contributes to', () => {
    // The runtime executes `other(w)` and lowers whatever it returns; a source
    // walk sees only what is written here, and so does the extractor.
    const handles = 'const { checked, indeterminate } = asCheckboxRoot().stateHandles;';
    const use = "(i) => i.feedback.style.use(tw('bg-primary'))";
    const helper = `const other = (w) => w.state(indeterminate).eq(true);`;

    const nested = `${helper}\n${handles}\ndef.rule({ when: (w) => w.all(w.state(checked).eq(true), other(w)), intent: ${use} });`;
    expect(scanRuleStateReads(nested).usages).toEqual([]);
    expect(scanRuleStateReads(nested).unresolved.map((miss) => miss.reason)).toEqual(['condition']);

    const whole = `${helper}\n${handles}\ndef.rule({ when: (w) => other(w), intent: ${use} });`;
    expect(scanRuleStateReads(whole).usages).toEqual([]);
    expect(scanRuleStateReads(whole).unresolved.map((miss) => miss.reason)).toEqual(['condition']);
  });

  it('requires each template substitution to carry one value', () => {
    const handles = 'const { checked } = asCheckboxRoot().stateHandles;';
    const when = '(w) => w.state(checked).eq(true)';
    const use = (arg: string) => `(i) => i.feedback.style.use(tw(${arg}))`;

    // `resolveExpression` needs a single value per substitution.
    const single = `const shade = 'primary';\n${handles}\ndef.rule({ when: ${when}, intent: ${use('`bg-${shade}`')} });`;
    expect(scanRuleStateReads(single).usages).toEqual([
      { hook: 'asCheckboxRoot', state: 'checked' },
    ]);

    // A conditional resolves to several strings, so the extractor drops the
    // template while the runtime receives one concrete token.
    const branched = `const shade = flag ? 'primary' : 'secondary';\n${handles}\ndef.rule({ when: ${when}, intent: ${use('`bg-${shade}`')} });`;
    expect(scanRuleStateReads(branched).usages).toEqual([]);
    expect(scanRuleStateReads(branched).unresolved.map((miss) => miss.reason)).toEqual(['intent']);
  });

  it('skips rules the runtime keeps on the runtime plan', () => {
    const withProp = `const s = asSelectContent().stateHandles;\n${rule("w.all(w.state(s.open).eq(true), w.prop('side').eq('top'))")}`;
    // `isStateMetaDeps` refuses every dependency kind but state and meta, so a
    // context dependency keeps the rule on the runtime plan exactly like a prop.
    const withContext = `const s = asSelectContent().stateHandles;\n${rule("w.all(w.state(s.open).eq(true), w.ctx(SIDE).eq('top'))")}`;
    // `extractConditions` lowers `colorScheme === 'dark'` and no other meta
    // pair, so this one stays on the runtime plan and needs no mapping.
    const otherMeta = `const s = asSelectContent().stateHandles;\n${rule("w.all(w.state(s.open).eq(true), w.meta('colorScheme').eq('light'))")}`;
    // The runtime abandons lowering at the first op that is not a style use.
    const mixedIntent = `const s = asSelectContent().stateHandles;\nconst local = def.state.bool('local', false);\ndef.rule({ when: (w) => w.state(s.open).eq(true), intent: (i) => { i.feedback.style.use(tw('bg-primary')); i.state(local).be(true); } });`;
    const allNegative = `const s = asSelectContent().stateHandles;\n${rule('w.state(s.open).eq(false)')}`;
    const anyCondition = `const s = asSelectItem().stateHandles;\n${rule('w.any(w.state(s.active).eq(true), w.state(s.hovered).eq(true))')}`;

    for (const source of [
      withProp,
      withContext,
      otherMeta,
      mixedIntent,
      allNegative,
      anyCondition,
    ]) {
      const scan = scanRuleStateReads(source);
      expect(scan.usages).toEqual([]);
      expect(scan.unresolved).toEqual([]);
    }
  });

  it('scans every source extension the extractor accepts', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      // Not `.proto.ts`, and not `.ts` at all. The old glob saw neither.
      await writeFile(
        path.join(dir, 'widget.proto.mts'),
        "const { checked } = asCheckboxRoot().stateHandles;\ndef.rule({ when: (w) => w.state(checked).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });\n"
      );
      await writeFile(path.join(dir, 'notes.md'), 'not a source file');

      const files = await collectSourceFiles(dir);
      expect(files.map((file: string) => path.basename(file))).toEqual(['widget.proto.mts']);
      expect(scanRuleStateReads(await readFile(files[0], 'utf8'), files[0]).usages).toEqual([
        { hook: 'asCheckboxRoot', state: 'checked' },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('lowers a state bound as a terminal handle leaf end to end', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-coverage-'));
    try {
      await writeFile(
        path.join(dir, 'widget.proto.ts'),
        [
          "import { definePrototype, tw } from '@proto.ui/core';",
          "import { asCheckboxRoot } from '@proto.ui/prototypes-base/checkbox';",
          '',
          'const widget = definePrototype({',
          "  name: 'widget',",
          '  setup(def) {',
          '    const checked = asCheckboxRoot().stateHandles.checked;',
          '    def.rule({',
          '      when: (w) => w.state(checked).eq(true),',
          "      intent: (i) => i.feedback.style.use(tw('bg-primary')),",
          '    });',
          '  },',
          '});',
          '',
          'export default widget;',
        ].join('\n')
      );

      // The gate calls this shape covered; the extractor has to agree.
      expect(await collectProtoStyleTokens(dir)).toContain('data-[checked]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('lowers declared disclosure and Field state identities through the real extractor', async () => {
    const expected = {
      asCollapsibleTrigger: {
        expanded: 'expanded',
        hovered: 'hovered',
        focusVisible: 'focus-visible',
        pressed: 'pressed',
        disabled: 'disabled',
      },
      asAccordionTrigger: {
        expanded: 'expanded',
        collapseBlocked: 'collapse-blocked',
        hovered: 'hovered',
        focusVisible: 'focus-visible',
        pressed: 'pressed',
        disabled: 'disabled',
      },
      asFieldLabel: { disabled: 'disabled', required: 'required' },
      asFieldTextControl: {
        value: 'value',
        disabled: 'disabled',
        readOnly: 'read-only',
        focusVisible: 'focus-visible',
        focused: 'focused',
        composing: 'composing',
      },
    };
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-disclosure-field-'));
    try {
      for (const [hook, states] of Object.entries(expected)) {
        const source = [
          `const state = ${hook}().stateHandles;`,
          ...Object.keys(states).map((state) => rule(`w.state(state.${state}).eq(true)`)),
        ].join('\n');
        await writeFile(path.join(dir, `${hook}.proto.ts`), source);
        const scan = scanRuleStateReads(source);
        expect(scan.unresolved).toEqual([]);
        expect(scan.usages).toEqual(Object.keys(states).map((state) => ({ hook, state })));
        for (const [state, attribute] of Object.entries(states)) {
          expect(loweredHookStates(hook)?.get(state)).toBe(`data-[${attribute}]`);
        }
      }
      const tokens = await collectProtoStyleTokens(dir);
      for (const states of Object.values(expected)) {
        for (const attribute of Object.values(states))
          expect(tokens).toContain(`data-[${attribute}]:bg-primary`);
      }
      expect(loweredHookStates('asFieldTextControl')?.has('madeUpState')).toBe(false);
      expect(loweredHookStates('asUnknownField')).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('preserves native constructors without promoting ordinary authored state names', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-hook-native-state-'));
    try {
      const cases = [
        ['fromInteraction', 'hovered', 'hover', 'data-[hovered]'],
        ['fromInteraction', 'pressed', 'active', 'data-[pressed]'],
        ['fromInteraction', 'disabled', 'data-[disabled]', 'disabled'],
        ['fromInteraction', 'focused', 'data-[focused]', 'focus'],
        ['fromInteraction', 'focusVisible', 'data-[focus-visible]', 'data-[focusVisible]'],
        ['fromAccessibility', 'expanded', 'data-[expanded]', 'expanded'],
        ['fromAccessibility', 'invalid', 'data-[invalid]', 'invalid'],
        ['fromAccessibility', 'selected', 'data-[selected]', 'selected'],
        ['fromAccessibility', 'checked', 'data-[checked]', 'checked'],
        ['fromAccessibility', 'current', 'data-[current]', 'current'],
        ['bool', 'hovered', 'data-[hovered]', 'hover'],
        ['bool', 'pressed', 'data-[pressed]', 'active'],
      ];
      for (const [index, [method, name, expected, forbidden]] of cases.entries()) {
        const folder = path.join(dir, String(index));
        await mkdir(folder);
        await writeFile(
          path.join(folder, 'producer.ts'),
          [
            "import { defineAsHook } from '@proto.ui/core';",
            `export const useFacts = defineAsHook({ name: 'facts', setup(def) { def.state.${method}('${name}'${method === 'bool' ? ', false' : ''}); } });`,
          ].join('\n')
        );
        await writeFile(
          path.join(folder, 'consumer.proto.ts'),
          [
            "import { useFacts } from './producer';",
            'const state = useFacts().stateHandles;',
            rule(`w.state(state.${name}).eq(true)`),
          ].join('\n')
        );
        const tokens = await collectProtoStyleTokens(folder);
        expect(tokens, `${method}(${name})`).toContain(`${expected}:bg-primary`);
        expect(tokens, `${method}(${name})`).not.toContain(`${forbidden}:bg-primary`);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it.each(['asFormSubmit', 'asFormReset'])(
    'lowers only the five declared command states for %s',
    async (hook) => {
      const expected = new Map([
        ['disabled', 'data-[disabled]'],
        ['hovered', 'data-[hovered]'],
        ['focused', 'data-[focused]'],
        ['focusVisible', 'data-[focus-visible]'],
        ['pressed', 'data-[pressed]'],
      ]);
      expect(loweredHookStates(hook)).toEqual(expected);
      expect(loweredHookStates(hook)?.has('pending')).toBe(false);
      expect(loweredHookStates(hook)?.has('submitted')).toBe(false);
      expect(loweredHookStates(hook)?.has('madeUpState')).toBe(false);

      const dir = await mkdtemp(path.join(tmpdir(), 'lowered-form-command-'));
      try {
        // Match the real family binding, including its optional-bag assertion.
        const source = [
          `const inherited = ${hook}();`,
          'const state = inherited.stateHandles!;',
          ...Array.from(expected.keys(), (state) => rule(`w.state(state.${state}).eq(true)`)),
          rule(
            'w.all(w.state(state.hovered).eq(true), w.state(state.pressed).eq(false), w.state(state.disabled).eq(false), w.state(state.focusVisible).eq(false))'
          ),
        ].join('\n');
        await writeFile(path.join(dir, 'action.proto.ts'), source);
        expect(scanRuleStateReads(source).unresolved).toEqual([]);
        const tokens = await collectProtoStyleTokens(dir);
        for (const variant of expected.values()) {
          expect(tokens).toContain(`${variant}:bg-primary`);
        }
        expect(tokens).toContain(
          'data-[hovered]:not-[data-disabled]:not-[data-focus-visible]:not-[data-pressed]:bg-primary'
        );
        expect(tokens).not.toContain('hover:bg-primary');
        expect(tokens).not.toContain('active:bg-primary');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  );

  it('does not infer command states for unknown Form hooks or unknown state members', async () => {
    expect(loweredHookStates('asUnknownFormAction')).toBeNull();
    const dir = await mkdtemp(path.join(tmpdir(), 'lowered-form-negative-'));
    try {
      await writeFile(
        path.join(dir, 'unknown.proto.ts'),
        [
          'const unknown = asUnknownFormAction().stateHandles;',
          'const submit = asFormSubmit().stateHandles;',
          'const reset = asFormReset().stateHandles;',
          rule('w.state(unknown.hovered).eq(true)'),
          rule('w.state(submit.madeUpState).eq(true)'),
          rule('w.state(reset.madeUpState).eq(true)'),
        ].join('\n')
      );
      const tokens = (await collectProtoStyleTokens(dir)) as string[];
      expect(tokens.filter((token) => token.includes(':'))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects flattened Field aliases and follows the child projection instead', async () => {
    // Keep the fixture under the repository so package imports resolve through
    // the workspace's real node_modules graph; a /tmp root has no package
    // association and silently turns this into an unrelated unresolved case.
    const dir = await mkdtemp(path.join(REPO_ROOT, 'node_modules/lowered-field-required-'));
    try {
      await writeFile(
        path.join(dir, 'control.proto.ts'),
        [
          "import { asFieldTextControl } from '@proto.ui/prototypes-base/field';",
          "const child = asFieldTextControl().getAsHookHandle('as-field-control');",
          "def.rule({ when: (w) => w.state(child?.state.fieldRequired).eq(true), intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
          'const flattened = asFieldTextControl().stateHandles;',
          "def.rule({ when: (w) => w.state(flattened.required).eq(true), intent: (i) => i.feedback.style.use(tw('bg-invalid')) });",
        ].join('\n')
      );
      const tokens = await collectProtoStyleTokens(dir);
      expect(tokens).toContain('data-[field-required]:bg-primary');
      expect(tokens).not.toContain('data-[required]:bg-primary');
      expect(tokens).not.toContain('data-[required]:bg-invalid');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves every hook state a shipped rule condition reads', async () => {
    const found: Array<{
      file: string;
      hook: string;
      state: string;
      provenance?: HookSourceState;
    }> = [];
    const blind: string[] = [];
    const exposed: Array<{ file: string; state: string; exposedAs: string; attribute: string }> =
      [];

    const sourceSummary = createHookSourceSummaryContext();
    for (const absolute of await prototypeSourceFiles()) {
      const file = path.relative(REPO_ROOT, absolute).split(path.sep).join('/');
      const text = await readFile(absolute, 'utf8');
      if (!RULE_CALL.test(text)) continue;
      const scan = scanRuleStateReads(text, absolute, sourceSummary);
      for (const usage of scan.usages)
        found.push({ file, hook: usage.hook, state: usage.state, provenance: usage.provenance });
      for (const miss of scan.unresolved) blind.push(`${file}: ${miss.reason} ${miss.expression}`);
      for (const local of scan.exposedLocals) exposed.push({ file, ...local });
    }

    // Every exposed prototype-owned state a rule reads has to name an attribute
    // the extractor can emit, or the runtime lowers a variant with no CSS.
    // `C-EXPOSE-0004-A` admits any non-empty key, and both analyzers normalize
    // it, so the normalized attribute is what has to be usable — not the key.
    expect(
      exposed.filter(({ attribute }) => !SELECTABLE_ATTRIBUTE.test(attribute)),
      'exposed states whose attribute cannot be written as a data selector'
    ).toEqual([]);
    // The two-step shape must be reached in the shipped tree, not just fixtures.
    expect(found).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'packages/prototypes/brutalist/src/textarea/root.proto.ts',
          hook: 'asTextareaRoot',
          state: 'focusVisible',
        }),
      ])
    );

    // Fail closed: a shape the scanner cannot trace is a gate failure. In
    // particular, a privileged Focus fact remains visible as a failure until
    // its producer supplies bounded declaration metadata.

    expect(blind, 'lowerable rule states the scanner could not trace').toEqual([]);

    const missing = found.filter(({ provenance }) => !provenance);

    expect(
      missing.map(({ file, hook, state }) => `${file}: ${hook}().${state}`),
      'rule conditions whose imported producer state has no declaration provenance'
    ).toEqual([]);

    // A string comparison only lowers against a `data-[x]` variant. Every table
    // entry is one today; if that stops being true, the scanner's string form
    // would start counting rules the extractor drops.
    const unshaped = found.filter(({ provenance }) => {
      const declared = provenance?.declaredName ?? '';
      return !/^[-a-zA-Z0-9]+$/.test(
        declared
          .trim()
          .replace(/\s+/g, '-')
          .replace(/\./g, '-')
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .replace(/[^a-zA-Z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase()
      );
    });

    expect(
      unshaped.map(({ hook, state }) => `${hook}().${state}`),
      'hook states whose declared source name cannot lower to a data selector'
    ).toEqual([]);
  }, 60_000);
});
