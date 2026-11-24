// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/memory';
import { validateIR } from '../src/ir-validation';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';

const inline = readFileSync(
  'packages/compiler/test/fixtures/shader-presentation-owner.proto.ts',
  'utf8'
);
const helper = readFileSync(
  'packages/compiler/test/fixtures/shader-static-data-owner.proto.ts',
  'utf8'
);
const typed = inline.replace(
  'definePrototype, tw }',
  'definePrototype, tw, type ShaderPresentationDeclaration }'
);
const begin = typed.indexOf('def.feedback.material.shader(');
const end = typed.indexOf('\n    def.lifecycle', begin);
const graph = typed.slice(begin + 'def.feedback.material.shader('.length, end - 2);
const local = (body: string) => typed.slice(0, begin) + body + typed.slice(end);
const alias = local(
  `const graph: ShaderPresentationDeclaration = ${graph}; const alias = graph; def.feedback.material.shader(alias);`
);
const functionStart = helper.indexOf('function makeGraph');
const prototypeStart = helper.indexOf('/** One exact');
const localFactory = (helper.slice(0, functionStart) + helper.slice(prototypeStart)).replace(
  'setup(def) {',
  `setup(def) {
    const pixels = [255, 0, 0, 255, 0, 128, 0, 128, 0, 0, 64, 64, 64, 128, 192, 255];
    ${helper.slice(functionStart, prototypeStart)}`
);
const profiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const;
const emitters = {
  'react-dom-source-v1': emitReactSource,
  'vue-source-v1': emitVueSource,
  'vue2-source-v1': emitVue2Source,
  'web-component-source-v1': emitWebComponentSource,
};
const key = (code: string) => code.match(/Shader\.declare\("([a-f0-9]{64})"/)?.[1];

describe('definition-bound static shader construction', () => {
  it.each(profiles)(
    '%s specializes aliases and a pure factory identically to authored inline data, including cold IR',
    (profile) => {
      const original = compilePrototype(inline, { profile });
      if (!original.ok) throw new Error(JSON.stringify(original.diagnostics));
      expect(key(original.value.output.code)).toMatch(/^[a-f0-9]{64}$/);
      for (const source of [alias, helper, localFactory]) {
        const compiled = compilePrototype(source, { profile });
        if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
        expect(key(compiled.value.output.code)).toBe(key(original.value.output.code));
        expect(compiled.value.output.code).toContain(
          '__shaderDevice.tint(__shaderPass0, [0.5,1,0.25,0.5])'
        );
        expect(compiled.value.output.code).not.toMatch(
          /@proto\.ui\/(runtime|adapter|core)|shaderStaticData|\.passes\b/
        );
        const cold = JSON.parse(JSON.stringify(compiled.value.ir));
        expect(validateIR(cold)).toMatchObject({ ok: true });
        const emitted = emitters[profile](cold);
        if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
        expect(emitted.value.code).toBe(compiled.value.output.code);
        expect(emitted.value.supportingFiles).toEqual(original.value.output.supportingFiles);
      }
    }
  );

  it.each(profiles)(
    '%s follows renamed and re-exported factories without source-name dispatch',
    (profile) => {
      const split = helper.indexOf('/** One exact');
      const factory = helper
        .slice(0, split)
        .replace('function makeGraph', 'export function makeGraph');
      const entry =
        "import {definePrototype,tw} from '@proto.ui/core';\nimport {renamed} from './bridge';\n" +
        helper.slice(split).replace('makeGraph()', 'renamed()');
      const result = compilePrototype(entry, {
        profile,
        fileName: 'consumer.proto.ts',
        files: {
          'factory.ts': factory,
          'bridge.ts': "export {makeGraph as renamed} from './factory';",
        },
      });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.ir.sourceFiles.map((file) => file.file).sort()).toEqual([
        'bridge.ts',
        'consumer.proto.ts',
        'factory.ts',
      ]);
      expect(result.value.output.code).toContain(
        '__shaderDevice.tint(__shaderPass0, [0.5,1,0.25,0.5])'
      );
    }
  );

  it.each([
    [
      'direct escape',
      alias.replace(
        'const alias = graph;',
        "def.expose.value('graph', graph); const alias = graph;"
      ),
    ],
    [
      'nested alias escape',
      alias.replace(
        'const alias = graph;',
        "const escaped = {graph}; def.expose.value('escaped', escaped); const alias = graph;"
      ),
    ],
    [
      'mutable source',
      local(
        `const dimensions = {width: 2}; dimensions.width = 3; const graph: ShaderPresentationDeclaration = ${graph.replace('width: 2', 'width: dimensions.width')}; def.feedback.material.shader(graph);`
      ),
    ],
    [
      'effectful factory',
      helper.replace(
        '  const graph: ShaderPresentationDeclaration',
        "  if (multiplier < 0) throw new Error('factory failure');\n  const graph: ShaderPresentationDeclaration"
      ),
    ],
    ['unproved intrinsic argument', helper.replace('makeGraph();', "makeGraph(Number('0.5'));")],
    [
      'captured data escaped through a direct factory call',
      localFactory.replace(
        'const graph = makeGraph();',
        "def.expose.value('leaked', makeGraph()); const graph = makeGraph();"
      ),
    ],
    [
      'captured data escaped through a returned alias',
      localFactory.replace(
        'const graph = makeGraph();',
        "const leaked = makeGraph(); def.expose.value('leaked', leaked); const graph = makeGraph();"
      ),
    ],
    [
      'captured data escaped through an exposed factory',
      localFactory.replace(
        'const graph = makeGraph();',
        "def.expose.method('leak', makeGraph); const graph = makeGraph();"
      ),
    ],
  ])('keeps %s unsupported rather than freezing stale or unproved data', (_name, source) => {
    for (const profile of profiles) {
      const result = compilePrototype(source, { profile });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.diagnostics.some((item) => item.code === 'PUI4009')).toBe(true);
    }
  });

  it('does not count an uncalled local escape as reached work', () => {
    const source = alias.replace(
      'const alias = graph;',
      'function dormant() { return graph; } const alias = graph;'
    );
    expect(compilePrototype(source, { profile: 'react-dom-source-v1' })).toMatchObject({
      ok: true,
    });
  });

  it.each(profiles)(
    '%s preserves an abrupt factory without reaching its following shader site',
    (profile) => {
      const source = helper.replace(
        '  const graph: ShaderPresentationDeclaration',
        "  throw new Error('factory failure');\n  const graph: ShaderPresentationDeclaration"
      );
      const result = compilePrototype(source, { profile });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.output.code).toContain('factory failure');
      expect(result.value.output.code).not.toContain('Shader.declare');
      expect(
        result.value.output.supportingFiles?.some((file) => file.path.includes('shader'))
      ).toBe(false);
    }
  );
});
