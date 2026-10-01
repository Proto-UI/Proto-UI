// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { renderShadowStyleDelivery } from '../src/services/shadow-style-delivery';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';
import { BRUTALIST_STYLE_TOKENS } from '../src/generated/brutalist-style-tokens';
import { run } from '../src/index';

const require = createRequire(import.meta.url);
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function fixture(
  tokens = ['inline-flex', 'p-2', 'w-full', 'dark:p-4', 'bg-primary'],
  raw = false
) {
  const dir = await mkdtemp(path.join(tmpdir(), 'pui-shadow-delivery-'));
  directories.push(dir);
  await Promise.all([
    writeFile(path.join(dir, 'package.json'), '{"type":"module"}'),
    writeFile(
      path.join(dir, 'source.ts'),
      `const styles = tw(${tokens.map((token) => JSON.stringify(token)).join(',')});`
    ),
  ]);
  if (raw) {
    // Raw serialization must retain even whitespace-bearing data. The source scanner
    // intentionally splits that whitespace, so it cannot prove this lower-layer guarantee.
    const output = renderShadowStyleDelivery(tokens, 'protoShadowStyleArtifact');
    await Promise.all([
      writeFile(path.join(dir, 'shadow.js'), output.shadowModule),
      writeFile(path.join(dir, 'shadow.d.ts'), output.shadowDeclaration),
      writeFile(path.join(dir, 'tokens.css'), output.documentCss),
    ]);
  } else {
    await run([
      'tokens',
      '--input',
      dir,
      '--out',
      path.join(dir, 'tokens.css'),
      '--shadow-out',
      path.join(dir, 'shadow.js'),
    ]);
  }
  const delivery = {
    documentCss: await readFile(path.join(dir, 'tokens.css'), 'utf8'),
    shadowModule: await readFile(path.join(dir, 'shadow.js'), 'utf8'),
    shadowDeclaration: await readFile(path.join(dir, 'shadow.d.ts'), 'utf8'),
  };
  return { dir, delivery };
}

describe('same-closure Shadow ESM serialization and command-generated consumers', () => {
  it.each([
    ['shadcn', SHADCN_STYLE_TOKENS],
    ['brutalist', BRUTALIST_STYLE_TOKENS],
  ] as const)(
    'generates deterministic document/Shadow companions for the complete %s preset closure',
    (_name, tokens) => {
      const output = renderShadowStyleDelivery(tokens, 'pilotArtifact');
      expect(output).toEqual(renderShadowStyleDelivery([...tokens], 'pilotArtifact'));
      expect(output.documentCss).toBe(renderProtoStyleTokenCss(tokens));
      expect(output.shadowModule).not.toContain('import ');
      expect(Object.isFrozen(output)).toBe(true);
    }
  );

  it('imports in plain Node JS without DOM and preserves hostile string contents as inert data', async () => {
    const tokens = ['p-2', 'extension-</script>\u2028\u2029"`\\${globalThis.injected=true}'];
    const { dir, delivery } = await fixture(tokens, true);
    const entry = path.join(dir, 'consumer.mjs');
    await writeFile(
      entry,
      `import { protoShadowStyleArtifact as pilotArtifact } from './shadow.js';
      if (typeof document !== 'undefined' || globalThis.injected) throw new Error('side effect');
      if (!Object.isFrozen(pilotArtifact)) throw new Error('not frozen');
      console.log(JSON.stringify(pilotArtifact));`
    );
    const result = JSON.parse(execFileSync(process.execPath, [entry], { encoding: 'utf8' }));
    expect(result).toEqual(renderProtoShadowSplitStyleArtifact(tokens));
    expect(delivery.shadowModule).not.toContain('</script>');
    expect(delivery.shadowModule).not.toContain('\u2028');
  });

  it('resolves JS companion declarations under both NodeNext and Bundler without a CLI dependency', async () => {
    const { dir } = await fixture();
    const entry = path.join(dir, 'consumer.ts');
    await writeFile(
      entry,
      `import { protoShadowStyleArtifact as pilotArtifact } from './shadow.js';
      const version: 1 = pilotArtifact.version;
      const kind: 'proto-ui.shadow-style' = pilotArtifact.kind;
      const environment: 'host-color-scheme-v1' = pilotArtifact.environment;
      const css: string = pilotArtifact.cssText;
      // @ts-expect-error immutable artifact
      pilotArtifact.cssText = 'changed';
      // @ts-expect-error unknown artifact field
      pilotArtifact.nonce;`
    );
    const tsc = require.resolve('typescript/bin/tsc');
    for (const [module, resolution] of [
      ['NodeNext', 'NodeNext'],
      ['ESNext', 'Bundler'],
    ]) {
      execFileSync(
        process.execPath,
        [
          tsc,
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--module',
          module,
          '--moduleResolution',
          resolution,
          entry,
        ],
        { encoding: 'utf8' }
      );
    }
  });

  it('builds browser and SSR Vite consumers, retaining one shared immutable module', async () => {
    const { dir } = await fixture();
    const entry = path.join(dir, 'consumer.js');
    await writeFile(
      path.join(dir, 'second.js'),
      `export { protoShadowStyleArtifact as pilotArtifact } from './shadow.js';`
    );
    await writeFile(
      entry,
      `import { protoShadowStyleArtifact as pilotArtifact } from './shadow.js';
      import { pilotArtifact as second } from './second.js';
      if (pilotArtifact !== second || !Object.isFrozen(pilotArtifact)) throw new Error('identity');
      export const artifact = pilotArtifact;`
    );
    // Reuse the Vite already installed for Vitest; this adds no dependency.
    const vitePackage = createRequire(require.resolve('vitest/package.json')).resolve(
      'vite/package.json'
    );
    const vitePath = path.resolve(
      path.dirname(vitePackage),
      require(vitePackage).exports['.'].import.default
    );
    const { build } = await import(pathToFileURL(vitePath).href);
    for (const ssr of [false, true]) {
      const outDir = path.join(dir, ssr ? 'ssr' : 'browser');
      await build({
        configFile: false,
        root: dir,
        logLevel: 'silent',
        build: {
          outDir,
          minify: false,
          ssr: ssr ? entry : false,
          lib: ssr ? undefined : { entry, formats: ['es'], fileName: () => 'consumer.js' },
        },
      });
      const output = path.join(outDir, 'consumer.js');
      const text = await readFile(output, 'utf8');
      expect(text).not.toMatch(/\bfrom\s+['"]@proto\.ui\/cli/);
      expect(text).not.toContain('renderProtoShadow');
      expect(text.match(/Object\.freeze\(/g)).toHaveLength(1);
      const probe = `import {artifact} from ${JSON.stringify(pathToFileURL(output).href)}; console.log(JSON.stringify(artifact));`;
      const value = JSON.parse(
        execFileSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' })
      );
      expect(value.version).toBe(1);
      expect(value.cssText).toContain('data-pui-split-root-style');
    }
  });

  it('rejects invalid output names and unsupported recipes before producing a delivery', () => {
    expect(() => renderShadowStyleDelivery([], 'default')).toThrow(/identifier/);
    expect(() => renderShadowStyleDelivery([], 'x;alert(1)')).toThrow(/identifier/);
    expect(() => renderShadowStyleDelivery(['p-[10%]'], 'pilotArtifact')).toThrow(
      /verified length recipe/
    );
  });
});
