import { createRequire } from 'node:module';
import path from 'node:path';
import { URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { compileFile, writeCompilation } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import { IR_VERSION, type PrototypeIR } from '../src/ir';
import {
  actualCompilation,
  cleanupOutputs,
  CONTROL_LABEL_ENTRIES,
  CONTROL_LABEL_PROFILES,
  REPOSITORY,
  temporaryOutput,
  type ComponentKind,
  type WebTarget,
} from './control-label-consumer-fixture';

afterAll(cleanupOutputs);
const targets = Object.keys(CONTROL_LABEL_PROFILES) as WebTarget[];
const kinds = Object.keys(CONTROL_LABEL_ENTRIES) as ComponentKind[];
const unsupportedGroupEntries = [
  {
    entry: 'packages/prototypes/base/src/toggle-group/root.proto.ts',
    code: 'PUI1020',
    message: 'Array elements must be data values.',
  },
  {
    entry: 'packages/prototypes/base/src/toggle-group/item.proto.ts',
    code: 'PUI1006',
    message: 'Read of undeclared prop value.',
  },
];

describe.each(targets)('actual Control Label source admission: %s', (target) => {
  it.each(kinds)(
    'compiles the complete official %s definition without component substitutions',
    async (kind) => {
      const compilation = await actualCompilation(target, kind);
      expect(
        compilation.ir.sourceFiles.some((source) => source.file === CONTROL_LABEL_ENTRIES[kind])
      ).toBe(true);
      expect(compilation.output.profile).toBe(CONTROL_LABEL_PROFILES[target]);
      const graph = [
        compilation.output.code,
        ...(compilation.output.supportingFiles ?? []).map((file) => file.contents),
      ].join('\n');
      // The consumer imports an ordinary native component. Runtime/prototype source
      // and an IR interpreter are not shipped to rescue the compiler's missing op.
      expect(graph).not.toMatch(
        /from\s+['"]@proto\.ui\/(?:runtime|hooks|module-|prototypes-|adapter-)/
      );
      expect(
        compilation.output.dependencies?.some((dependency) =>
          /^@proto\.ui\/(?:runtime|hooks|module-|prototypes-|adapter-)/.test(dependency.name)
        )
      ).not.toBe(true);
    }
  );

  it.each(unsupportedGroupEntries)(
    'retains a located diagnostic for the existing unsupported $entry language boundary',
    async ({ entry, code, message }) => {
      // Same-compiler comparison with the 7d30 source baseline established that
      // Toggle Group already lacked compiler admission before Control Label.
      // Its typed collection/reflection/queue language is a separate workstream;
      // explicit rejection is not counted as successful Group lowering.
      const result = await compileFile(entry, {
        root: REPOSITORY,
        profile: CONTROL_LABEL_PROFILES[target],
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Toggle Group support requires its independent acceptance');
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code,
          category: 'unsupported-input',
          message,
          span: expect.objectContaining({ file: entry }),
        }),
      ]);
    }
  );

  it('strict-checks all reached generated source files against the real host declarations', async () => {
    const parent = await temporaryOutput(`control-label-strict-${target}-`);
    const files: string[] = [];
    for (const kind of kinds) {
      const compiled = await actualCompilation(target, kind);
      const written = await writeCompilation(compiled, path.join(parent, kind));
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      files.push(...written.value.files.filter((file) => /\.(?:tsx?|js)$/.test(file)));
    }
    const config = ts.readConfigFile(path.join(REPOSITORY, 'tsconfig.json'), ts.sys.readFile);
    if (config.error)
      throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, REPOSITORY);
    const positioning = createRequire(
      new NodeURL('../../modules/positioning/package.json', import.meta.url)
    );
    const paths: Record<string, string[]> = {
      ...parsed.options.paths,
      '@floating-ui/dom': [path.dirname(positioning.resolve('@floating-ui/dom/package.json'))],
    };
    if (target === 'vue2') {
      const vue2 = createRequire(new NodeURL('../../adapters/vue2/package.json', import.meta.url));
      paths.vue = [path.dirname(vue2.resolve('vue/package.json'))];
    } else if (target === 'vue') {
      const rootRequire = createRequire(new NodeURL('../../../package.json', import.meta.url));
      const compilerDom = createRequire(rootRequire.resolve('@vue/compiler-dom'));
      const compilerCore = createRequire(compilerDom.resolve('@vue/compiler-core'));
      const babelParser = createRequire(compilerCore.resolve('@babel/parser'));
      paths['@babel/types'] = [path.dirname(babelParser.resolve('@babel/types/package.json'))];
    }
    expect(files.length).toBeGreaterThan(kinds.length);
    const program = ts.createProgram(files, {
      ...parsed.options,
      paths,
      noEmit: true,
      strict: true,
      skipLibCheck: false,
      allowJs: target === 'vue2',
      checkJs: target === 'vue2',
      types: [],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
      code: diagnostic.code,
      file: diagnostic.file?.fileName,
      start: diagnostic.start,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    }));
    // Never filter helper or dependency diagnostics: transpilation is not this check.
    expect(diagnostics, JSON.stringify(diagnostics, null, 2)).toEqual([]);
  }, 30_000);
});

describe('checked callback IR compatibility boundary', () => {
  it('advances the private compiler IR schema for checked ordinary values and captures', () => {
    expect(IR_VERSION).toBe(7);
  });

  it.each([emitReactSource, emitVueSource, emitVue2Source, emitWebComponentSource])(
    'rejects an old schema 5 input instead of interpreting it as the new callback ABI',
    (emit) => {
      const parsed = parsePrototype(
        "import {definePrototype} from '@proto.ui/core'; export default definePrototype({name:'old-ir',setup(){return r=>r.el('span','old');}});"
      );
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const result = emit({ ...parsed.value, schemaVersion: 5 } as unknown as PrototypeIR);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Old IR schema was accepted');
      expect(
        result.diagnostics.some((diagnostic) => /schema|version/i.test(diagnostic.message))
      ).toBe(true);
    }
  );
});
