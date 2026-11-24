// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';
import { compileProject } from '../src/project';
import { projectCompilationArtifacts } from '../src/project-output';
import { nativeShaderArtifacts } from '../src/native-shader';
import { shaderVariantSource } from './shader-source-variants';

it.each([
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const)(
  '%s: project unifies only canonical reached shader support and rejects tampering',
  async (profile) => {
    const base = path.join(process.cwd(), 'packages/compiler/test/generated-modules');
    await mkdir(base, { recursive: true });
    const root = await mkdtemp(path.join(base, 'shader-project-'));
    try {
      for (const kind of ['copy', 'tint'] as const)
        await writeFile(path.join(root, kind + '.proto.ts'), shaderVariantSource(kind));
      const compiled = await compileProject({
        root,
        entries: ['copy.proto.ts', 'tint.proto.ts'],
        profile,
      });
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
      const generation = compiled.value;
      const cloneOutputs = () => ({
        ...generation,
        entries: generation.entries.map((entry) => ({
          ...entry,
          compilation: {
            ...entry.compilation,
            output: {
              ...entry.compilation.output,
              supportingFiles: entry.compilation.output.supportingFiles?.map((file) => ({
                ...file,
              })),
            },
          },
        })),
      });
      const extension =
        profile === 'react-dom-source-v1' ? '.tsx' : profile === 'vue2-source-v1' ? '.js' : '.ts';
      const options = {
        sourcePaths: { 'copy.proto.ts': 'Copy' + extension, 'tint.proto.ts': 'Tint' + extension },
      };
      const planned = projectCompilationArtifacts(compiled.value, options);
      if (!planned.ok) throw new Error(JSON.stringify(planned.diagnostics));
      for (const expected of nativeShaderArtifacts(['copy-rgba8-v1', 'tint-rgba8-v1']))
        expect(planned.value.find((file) => file.path === expected.path)).toEqual(expected);
      expect(planned.value.find((file) => file.path === 'Copy' + extension)!.contents).toContain(
        '__shaderDevice.copy('
      );
      expect(
        planned.value.find((file) => file.path === 'Copy' + extension)!.contents
      ).not.toContain('__shaderDevice.tint(');
      expect(planned.value.find((file) => file.path === 'Tint' + extension)!.contents).toContain(
        '__shaderDevice.tint('
      );
      expect(
        planned.value.find((file) => file.path === 'Tint' + extension)!.contents
      ).not.toContain('__shaderDevice.copy(');
      for (const suffix of ['webgl2-host-v1.ts', 'kernel-identities-v1.json', 'owner-web-v1.ts']) {
        const changed = cloneOutputs();
        const support = changed.entries[0].compilation.output.supportingFiles!;
        support.find((file) => file.path.endsWith(suffix))!.contents += '\n/* altered */';
        expect(projectCompilationArtifacts(changed, options)).toMatchObject({
          ok: false,
          diagnostics: [
            { code: 'PUI3002', message: expect.stringContaining('modified shader support') },
          ],
        });
      }
      const missing = cloneOutputs();
      missing.entries[0].compilation.output.supportingFiles =
        missing.entries[0].compilation.output.supportingFiles!.filter(
          (file) => !file.path.endsWith('webgl2-host-v1.ts')
        );
      expect(projectCompilationArtifacts(missing, options)).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI3002' }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  30_000
);

it.each([
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
] as const)(
  '%s: mixed pixel/scene project unifies the reached source capability and rejects its replacement',
  async (profile) => {
    const base = path.join(process.cwd(), 'packages/compiler/test/generated-modules');
    await mkdir(base, { recursive: true });
    const root = await mkdtemp(path.join(base, 'shader-scene-project-'));
    try {
      await writeFile(path.join(root, 'copy.proto.ts'), shaderVariantSource('copy'));
      await writeFile(
        path.join(root, 'scene.proto.ts'),
        await readFile('packages/compiler/test/fixtures/shader-scene-owner.proto.ts', 'utf8')
      );
      const compiled = await compileProject({
        root,
        entries: ['copy.proto.ts', 'scene.proto.ts'],
        profile,
      });
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
      const ext =
        profile === 'react-dom-source-v1' ? '.tsx' : profile === 'vue2-source-v1' ? '.js' : '.ts';
      const options = {
        sourcePaths: { 'copy.proto.ts': 'Copy' + ext, 'scene.proto.ts': 'Scene' + ext },
      };
      const artifacts = projectCompilationArtifacts(compiled.value, options);
      if (!artifacts.ok) throw new Error(JSON.stringify(artifacts.diagnostics));
      for (const expected of nativeShaderArtifacts(['copy-rgba8-v1', 'tint-rgba8-v1'], true))
        expect(artifacts.value.filter((file) => file.path === expected.path)).toEqual([expected]);
      const entry = compiled.value.entries.find((entry) => entry.entry === 'scene.proto.ts')!;
      const support = entry.compilation.output.supportingFiles!.find((file) =>
        file.path.endsWith('scene-web-v1.ts')
      )!;
      support.contents += '\n/* unreviewed replacement */';
      expect(projectCompilationArtifacts(compiled.value, options)).toMatchObject({
        ok: false,
        diagnostics: [
          { code: 'PUI3002', message: expect.stringContaining('modified shader support') },
        ],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  30_000
);
