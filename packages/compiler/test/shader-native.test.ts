// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  snapshotShaderPresentation,
  type ShaderPresentationDeclaration,
} from '../../core/src/shader-presentation';
import { compilePrototype } from '../src/compile';
import { validateIR } from '../src/ir-validation';
import { shaderVariantSource } from './shader-source-variants';
import {
  nativeShaderHostSource,
  nativeShaderHostSha256,
  nativeShaderKernelSha256,
} from '../src/native-shader-host.generated';

const source = readFileSync(
  'packages/compiler/test/fixtures/shader-presentation-owner.proto.ts',
  'utf8'
);
const profiles = [
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const;
function graph(
  pixels = [20, 40, 60, 128],
  tint: [number, number, number, number] = [0.5, 0.75, 1, 0.5]
): ShaderPresentationDeclaration {
  return {
    version: 1,
    source: {
      kind: 'owned-pixels',
      width: 1,
      height: 1,
      pixels,
      colorSpace: 'linear-srgb',
      alpha: 'premultiplied',
      origin: 'top-left',
    },
    passes: [
      { id: 'copy', kernel: 'copy-rgba8-v1', input: '$source' },
      { id: 'tint', kernel: 'tint-rgba8-v1', input: 'copy', tint },
    ],
    output: 'tint',
    fallback: [0.1, 0.2, 0.3, 1],
  };
}
describe('finite shader data admission', () => {
  it('copies every mutable byte, uniform and resource declaration before freezing', () => {
    const pixels = [20, 40, 60, 128];
    const tint: [number, number, number, number] = [0.5, 0.75, 1, 0.5];
    const original = graph(pixels, tint),
      copied = snapshotShaderPresentation(original);
    pixels[0] = 128;
    tint[0] = 1;
    expect(copied.source.pixels).toEqual([20, 40, 60, 128]);
    expect(copied.passes[1].tint).toEqual([0.5, 0.75, 1, 0.5]);
    expect(
      [
        copied,
        copied.source,
        copied.source.pixels,
        copied.passes,
        copied.passes[1],
        copied.passes[1].tint,
        copied.fallback,
      ].every(Object.isFrozen)
    ).toBe(true);
  });
  it('rejects getter payloads without invocation, holes, unknown fields and alpha-invalid data', () => {
    const getter = vi.fn(() => [0, 0, 0, 255]),
      input = graph();
    expect(() =>
      snapshotShaderPresentation({
        ...input,
        source: {
          ...input.source,
          get pixels() {
            return getter();
          },
        },
      })
    ).toThrow(/data/);
    expect(getter).not.toHaveBeenCalled();
    expect(() =>
      snapshotShaderPresentation({
        ...input,
        source: { ...input.source, pixels: [0, , 0, 255] as number[] },
      })
    ).toThrow(/dense/);
    expect(() =>
      snapshotShaderPresentation({
        ...input,
        source: { ...input.source, pixels: [129, 0, 0, 128] },
      })
    ).toThrow(/premultiplied/);
    expect(() => snapshotShaderPresentation({ ...input, extra: 1 } as any)).toThrow(
      /unknown field/
    );
    expect(() => snapshotShaderPresentation({ ...input, fallback: [0, 0, 0, 0.5] as any })).toThrow(
      /opaque/
    );
  });
  it.each(['pixels', 'passes', 'tint', 'fallback'] as const)(
    'rejects a foreign %s array prototype',
    (field) => {
      const input = graph();
      const array =
        field === 'pixels'
          ? input.source.pixels
          : field === 'passes'
            ? input.passes
            : field === 'tint'
              ? input.passes[1].tint!
              : input.fallback;
      Object.setPrototypeOf(array, {});
      expect(() => snapshotShaderPresentation(input)).toThrow(/plain array required/);
    }
  );
  it('rejects forward reads, self reads, duplicate writers and undeclared kernels', () => {
    const input = graph();
    for (const passes of [
      [
        { id: 'one', kernel: 'copy-rgba8-v1', input: 'two' },
        { id: 'two', kernel: 'copy-rgba8-v1', input: 'one' },
      ],
      [{ id: 'one', kernel: 'copy-rgba8-v1', input: 'one' }],
      [
        { id: 'one', kernel: 'copy-rgba8-v1', input: '$source' },
        { id: 'one', kernel: 'copy-rgba8-v1', input: '$source' },
      ],
      [{ id: 'one', kernel: 'custom-shader', input: '$source' }],
    ])
      expect(() =>
        snapshotShaderPresentation({ ...input, passes, output: passes.at(-1)!.id } as any)
      ).toThrow();
  });
  it('rejects storage budgets before touching absent large pixel arrays', () => {
    const input = graph();
    expect(() =>
      snapshotShaderPresentation({ ...input, source: { ...input.source, width: 1025, pixels: [] } })
    ).toThrow(/budget/);
    const passes = Array.from({ length: 16 }, (_, i) => ({
      id: `p${i}`,
      kernel: 'copy-rgba8-v1',
      input: i === 0 ? '$source' : `p${i - 1}`,
    }));
    expect(() =>
      snapshotShaderPresentation({
        ...input,
        source: { ...input.source, width: 512, height: 512, pixels: [] },
        passes,
        output: 'p15',
      } as any)
    ).toThrow(/byte budget/);
  });
});

describe('actual Prototype shader lowering', () => {
  it.each(profiles)(
    '%s preserves cold IR and specializes a finite direct pass program',
    (profile) => {
      const compiled = compilePrototype(source, { profile });
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
      expect(validateIR(JSON.parse(JSON.stringify(compiled.value.ir)))).toMatchObject({ ok: true });
      const code = compiled.value.output.code;
      expect(code).toContain('__shaderDevice.upload(');
      expect(code).toContain('__shaderDevice.copy(__shaderSource)');
      expect(code).toContain('__shaderDevice.tint(__shaderPass0, [0.5,1,0.25,0.5])');
      expect(code).not.toMatch(/@proto\.ui\/(runtime|adapter|core)|\.passes\b/);
      const support = compiled.value.output.supportingFiles!;
      const host = support.find((file) => file.path.endsWith('webgl2-host-v1.ts'))!.contents;
      const identities = JSON.parse(
        support.find((file) => file.path.endsWith('kernel-identities-v1.json'))!.contents
      );
      expect(identities.kernels).toEqual(nativeShaderKernelSha256);
      expect(identities.hostSha256).toBe(nativeShaderHostSha256);
      expect(identities.emittedHostSha256).toBe(createHash('sha256').update(host).digest('hex'));
      expect(host).not.toContain('readPixels');
    }
  );
  it('diagnoses unsupported native targets and dynamic graphs instead of erasing them', () => {
    const unsupported = compilePrototype(source, { profile: 'gpui-source-v1' });
    expect(unsupported).toMatchObject({ ok: false });
    if (!unsupported.ok)
      expect(
        unsupported.diagnostics.some((item) => item.message.includes('feedback.material.shader'))
      ).toBe(true);
    const alias = source
      .replace('def.feedback.material.shader({', 'const graph = {')
      .replace(
        'fallback: [0.15, 0.2, 0.25, 1],\n    });',
        'fallback: [0.15, 0.2, 0.25, 1],\n    }; def.feedback.material.shader(graph);'
      );
    const dynamic = compilePrototype(alias, { profile: 'react-dom-source-v1' });
    expect(dynamic).toMatchObject({ ok: false });
  });
  it('keeps the canonical host atom and exact first-party kernel identities current', () => {
    const actual = readFileSync(
      'packages/adapters/base/src/material/shader-webgl2-host.ts',
      'utf8'
    );
    expect(nativeShaderHostSource).toBe(actual);
    expect(createHash('sha256').update(actual).digest('hex')).toBe(nativeShaderHostSha256);
    expect(nativeShaderHostSource).not.toMatch(/@proto\.ui|\.passes\b|eval\(|new Function/);
  });
  it.each(['copy', 'tint', 'both', 'none'] as const)(
    'emits only the reached %s host capability closure',
    (kind) => {
      for (const profile of profiles) {
        const result = compilePrototype(shaderVariantSource(kind), { profile });
        if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
        const files = result.value.output.supportingFiles ?? [];
        if (kind === 'none') {
          expect(files.filter((file) => file.path.includes('/shader/'))).toEqual([]);
          continue;
        }
        const host = files.find((file) => file.path.endsWith('webgl2-host-v1.ts'))!.contents;
        const metadata = JSON.parse(
          files.find((file) => file.path.endsWith('kernel-identities-v1.json'))!.contents
        );
        expect(metadata.hostSha256).toBe(nativeShaderHostSha256);
        expect(metadata.emittedHostSha256).toBe(createHash('sha256').update(host).digest('hex'));
        expect(host).toContain('SHADER_VERTEX_V1');
        expect(host).toContain('SHADER_PUBLISH_SRGB_V1');
        expect(host).not.toContain('readPixels');
        if (kind === 'copy') {
          expect(host).not.toMatch(/SHADER_TINT_RGBA8_V1|NativeShaderTint|uniform4fv|\btint\b/);
          expect(Object.keys(metadata.kernels)).not.toContain('SHADER_TINT_RGBA8_V1');
        }
        if (kind === 'tint') {
          expect(host).not.toMatch(/SHADER_COPY_RGBA8_V1|\bcopy\s*\(/);
          expect(Object.keys(metadata.kernels)).not.toContain('SHADER_COPY_RGBA8_V1');
        }
        for (const [name, sha] of Object.entries(metadata.kernels))
          expect(sha).toBe(nativeShaderKernelSha256[name as keyof typeof nativeShaderKernelSha256]);
      }
    }
  );
});
