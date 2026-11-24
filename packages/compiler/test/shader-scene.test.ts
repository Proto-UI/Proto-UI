// @vitest-environment node
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import { expect, it, vi } from 'vitest';
import {
  snapshotShaderPresentation,
  type ShaderPresentationDeclaration,
} from '../../core/src/shader-presentation';
import { compilePrototype } from '../src/compile';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import { validateIR } from '../src/ir-validation';

const source = readFileSync('packages/compiler/test/fixtures/shader-scene-owner.proto.ts', 'utf8');
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
const graph: ShaderPresentationDeclaration = {
  version: 1,
  source: { kind: 'owned-scene', slot: 'mainScene' },
  passes: [{ id: 'copy', kernel: 'copy-rgba8-v1', input: '$source' }],
  output: 'copy',
  fallback: [0, 0, 0, 1],
};
it('snapshots only a finite owned-scene slot and never invokes portable source accessors', () => {
  const input = { ...graph, source: { kind: 'owned-scene' as const, slot: 'mainScene' } };
  const accepted = snapshotShaderPresentation(input);
  input.source.slot = 'changed';
  expect(accepted.source).toEqual({ kind: 'owned-scene', slot: 'mainScene' });
  expect(Object.isFrozen(accepted.source)).toBe(true);
  const getter = vi.fn(() => 'mainScene');
  expect(() =>
    snapshotShaderPresentation({
      ...graph,
      source: {
        kind: 'owned-scene',
        get slot() {
          return getter();
        },
      },
    })
  ).toThrow(/data/);
  expect(getter).not.toHaveBeenCalled();
  for (const invalid of [
    { kind: 'owned-scene', slot: '' },
    { kind: 'owned-scene', slot: 'https://example.test' },
    { kind: 'owned-scene', slot: 'a'.repeat(65) },
    { kind: 'owned-scene', slot: 'mainScene', width: 1 },
    { kind: 'in-app-backdrop' },
    { kind: 'behind-window' },
  ])
    expect(() => snapshotShaderPresentation({ ...graph, source: invalid } as any)).toThrow();
});
for (const profile of profiles) {
  it(`${profile}: cold IR preserves the logical scene source and emits a direct configured consumer`, async () => {
    const compiled = compilePrototype(source, { profile });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    const ir = validateIR(JSON.parse(JSON.stringify(compiled.value.ir)));
    if (!ir.ok) throw new Error(JSON.stringify(ir.diagnostics));
    const emitted = emitters[profile](ir.value);
    if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
    expect(emitted.value.code).toBe(compiled.value.output.code);
    expect(compiled.value.output.code).toContain('Shader.declareScene("mainScene", 3,');
    expect(compiled.value.output.code).toContain('export function createComponent(');
    expect(compiled.value.output.code).not.toMatch(/@proto\.ui\/(?:runtime|adapter|core)/);
    await transform(compiled.value.output.code, {
      loader: profile === 'react-dom-source-v1' ? 'tsx' : 'ts',
      target: 'es2022',
    });
    const support = compiled.value.output.supportingFiles!;
    expect(support.filter((file) => file.path.endsWith('scene-web-v1.ts'))).toHaveLength(1);
    expect(
      JSON.parse(support.find((file) => file.path.endsWith('kernel-identities-v1.json'))!.contents)
    ).toMatchObject({ sceneHostSha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });
  it(`${profile}: configuration exports reserve names only when their capability is reached`, async () => {
    const ordinary = source.replace(
      "{ kind: 'owned-scene', slot: 'mainScene' }",
      "{ kind: 'owned-pixels', width: 1, height: 1, pixels: [0,0,0,255], colorSpace: 'linear-srgb', alpha: 'premultiplied', origin: 'top-left' }"
    );
    for (const name of ['createComponent', 'createShaderHost', 'WebShaderHostOptions']) {
      const options = { profile, componentName: name, className: name };
      expect(compilePrototype(source, options)).toMatchObject({
        ok: false,
        diagnostics: [
          expect.objectContaining({ message: expect.stringContaining('non-reserved') }),
        ],
      });
      const control = compilePrototype(ordinary, options);
      if (!control.ok) throw new Error(JSON.stringify(control.diagnostics));
      await transform(control.value.output.code, {
        loader: profile === 'react-dom-source-v1' ? 'tsx' : 'ts',
      });
    }
  });
}
