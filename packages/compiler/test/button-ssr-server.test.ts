// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeButtonSsrEvidenceArtifacts } from './button-ssr-evidence';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { compilationArtifacts } from '../src/compile';
import { emitWebComponentSource } from '../src/web-component-source';
import { nativeStyleArtifact } from '../src/native-style';
import {
  compileButtonSsrFixture,
  buildButtonSsrFixture,
  buttonSsrStyleEnvironment,
  loadGeneratedModule,
  type FixtureServer,
} from './button-ssr-fixture';

describe('Button SSR generated server artifact', () => {
  it('renders real Button source in a process environment with no browser globals and emits deterministic artifacts', async () => {
    expect(typeof HTMLElement).toBe('undefined');
    expect(typeof document).toBe('undefined');
    const first = compilationArtifacts(await compileButtonSsrFixture());
    const second = compilationArtifacts(await compileButtonSsrFixture());
    expect(first).toEqual(second);
    const server = loadGeneratedModule(first, 'Component.ts') as unknown as FixtureServer;
    const enabled = server.renderToString(
      { disabled: false },
      { slotHtml: 'Enabled without JavaScript' }
    );
    const disabled = server.renderToString(
      { disabled: true },
      { slotHtml: 'Disabled without JavaScript' }
    );
    expect(enabled.html).toContain('Enabled without JavaScript');
    expect(disabled.html).toContain('aria-disabled="true"');
    expect(disabled.html).toContain('tabindex="-1"');
    expect(enabled.carrier.instanceId).not.toBe(disabled.carrier.instanceId);
  });

  it('refuses accessor/cyclic initial data before authored setup can observe it', async () => {
    const generated = compilationArtifacts(await compileButtonSsrFixture());
    const server = loadGeneratedModule(generated, 'Component.ts') as unknown as FixtureServer;
    let getterReads = 0;
    const accessor = {
      get disabled() {
        getterReads++;
        return false;
      },
    };
    expect(() => server.renderToString(accessor)).toThrow(/accessor/);
    expect(getterReads).toBe(0);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => server.renderToString(cycle)).toThrow(/portable/);
  });

  it('changes compatibility binding when generated helper bytes change without changing Button source', async () => {
    const compilation = await compileButtonSsrFixture();
    const original = nativeStyleArtifact.contents;
    const before = loadGeneratedModule(
      compilationArtifacts(compilation),
      'Component.ts'
    ) as unknown as FixtureServer;
    try {
      nativeStyleArtifact.contents = original + '\n// Explicit negative-control helper revision.\n';
      const output = emitWebComponentSource(compilation.ir, {
        ssr: true,
        tagName: 'pui-ssr-button',
        className: 'CompiledButton',
        styleEnvironment: buttonSsrStyleEnvironment,
      });
      if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
      const after = loadGeneratedModule(
        compilationArtifacts({ ir: compilation.ir, output: output.value }),
        'Component.ts'
      ) as unknown as FixtureServer;
      expect(after.hydrationArtifacts.source).toBe(before.hydrationArtifacts.source);
      expect(after.hydrationArtifacts.helpers).not.toBe(before.hydrationArtifacts.helpers);
      expect(after.hydrationBinding).not.toBe(before.hydrationBinding);
    } finally {
      nativeStyleArtifact.contents = original;
    }
  });

  it('binds consumer environment identity and bytes separately from unchanged Button source and token CSS', async () => {
    const compilation = await compileButtonSsrFixture();
    const before = loadGeneratedModule(
      compilationArtifacts(compilation),
      'Component.ts'
    ) as unknown as FixtureServer;
    for (const styleEnvironment of [
      { ...buttonSsrStyleEnvironment, id: 'other-consumer-theme' },
      {
        ...buttonSsrStyleEnvironment,
        cssText: buttonSsrStyleEnvironment.cssText.replace('0.625rem', '0.75rem'),
      },
    ]) {
      const result = emitWebComponentSource(compilation.ir, {
        ssr: true,
        tagName: 'pui-ssr-button',
        className: 'CompiledButton',
        styleEnvironment,
      });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      const after = loadGeneratedModule(
        compilationArtifacts({ ir: compilation.ir, output: result.value }),
        'Component.ts'
      ) as unknown as FixtureServer;
      expect(after.hydrationArtifacts.source).toBe(before.hydrationArtifacts.source);
      expect(after.hydrationArtifacts.css).toBe(before.hydrationArtifacts.css);
      expect(after.hydrationBinding).not.toBe(before.hydrationBinding);
      if (styleEnvironment.cssText !== buttonSsrStyleEnvironment.cssText)
        expect(after.hydrationArtifacts.environment).not.toBe(
          before.hydrationArtifacts.environment
        );
    }
  });

  it('exports every generated byte under a non-hidden allowlist with reconstructable logical paths', async () => {
    const fixture = await buildButtonSsrFixture();
    const directory = await mkdtemp(path.join(tmpdir(), 'button-ssr-evidence-'));
    try {
      const index = await writeButtonSsrEvidenceArtifacts(fixture, directory);
      expect(index).toHaveLength(10);
      expect(index.filter((file) => file.path.startsWith('.proto-ui/'))).toHaveLength(5);
      const reconstructed = [];
      for (const entry of index) {
        expect(entry.exportPath.split('/').every((segment) => !segment.startsWith('.'))).toBe(true);
        const contents = await readFile(path.join(directory, entry.exportPath), 'utf8');
        expect(createHash('sha256').update(contents).digest('hex')).toBe(entry.sha256);
        reconstructed.push({ path: entry.path, contents });
      }
      const server = loadGeneratedModule(reconstructed, 'Component.ts') as unknown as FixtureServer;
      expect(
        server.renderToString({ disabled: true }, { slotHtml: 'Reconstructed generated Button' })
          .html
      ).toContain('aria-disabled="true"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects traversal, non-generated paths, duplicate paths and foreign bytes before any evidence write', async () => {
    const fixture = await buildButtonSsrFixture();
    const directory = await mkdtemp(path.join(tmpdir(), 'button-ssr-evidence-negative-'));
    try {
      for (const name of [
        '../secret',
        '.env',
        '.proto-ui/../secret',
        'unrelated.ts',
        'Component.ts',
      ]) {
        const extra = { path: name, kind: 'source' as const, contents: 'not a generated artifact' };
        const provenance = {
          ...fixture.provenance,
          generatedFiles: [
            ...fixture.provenance.generatedFiles,
            { path: name, sha256: createHash('sha256').update(extra.contents).digest('hex') },
          ],
        };
        await expect(
          writeButtonSsrEvidenceArtifacts(
            { ...fixture, generatedFiles: [...fixture.generatedFiles, extra], provenance },
            directory
          )
        ).rejects.toThrow(/inventory|Unadmitted/);
      }
      await expect(
        writeButtonSsrEvidenceArtifacts(
          {
            ...fixture,
            generatedFiles: fixture.generatedFiles.map((file, index) =>
              index ? file : { ...file, contents: 'foreign bytes' }
            ),
          },
          directory
        )
      ).rejects.toThrow(/bytes differ/);
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('typechecks the generated server/client/helper artifact closure without Proto UI packages', async () => {
    const generated = compilationArtifacts(await compileButtonSsrFixture());
    const directory = await mkdtemp(path.join(tmpdir(), 'button-ssr-types-'));
    try {
      // Only the declared external host geometry dependency, no authored source/Runtime/Adapter imports.
      await symlink(
        fileURLToPath(new URL('../../modules/positioning/node_modules', import.meta.url)),
        path.join(directory, 'node_modules')
      );
      for (const file of generated) {
        const target = path.join(directory, file.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.contents);
      }
      const program = ts.createProgram(
        generated
          .filter((file) => file.path.endsWith('.ts'))
          .map((file) => path.join(directory, file.path)),
        {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
        }
      );
      expect(
        ts
          .getPreEmitDiagnostics(program)
          .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      ).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
