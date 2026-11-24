// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { resolveCompilerNativeAsset } from '../src/native-assets';

const compilerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Compiler native assets', () => {
  it('locates the real builder source and lock when executed from source', () => {
    const native = path.join(compilerRoot, 'native');
    expect(resolveCompilerNativeAsset('llvm-builder.cpp')).toBe(
      path.join(native, 'llvm-builder.cpp')
    );
    expect(resolveCompilerNativeAsset('rust-builder')).toBe(path.join(native, 'rust-builder'));
    expect(readFileSync(resolveCompilerNativeAsset('llvm-builder.cpp'), 'utf8')).toContain(
      'IRBuilder'
    );
    expect(
      readFileSync(path.join(resolveCompilerNativeAsset('rust-builder'), 'Cargo.lock'), 'utf8')
    ).toContain('prettyplease');
  });

  it('uses only the relocated package native directory after a Node bundle', async () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), 'proto-native-assets-'));
    try {
      const output = path.join(temporary, 'relocated', 'index.mjs');
      mkdirSync(path.dirname(output));
      await build({
        entryPoints: [path.join(compilerRoot, 'src/native-assets.ts')],
        outfile: output,
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'node24',
        define: { __PUI_COMPILER_NATIVE_ASSET_BASE__: JSON.stringify('./native/') },
      });
      const native = path.join(path.dirname(output), 'native');
      mkdirSync(path.join(native, 'rust-builder'), { recursive: true });
      const original = readFileSync(resolveCompilerNativeAsset('llvm-builder.cpp'));
      writeFileSync(path.join(native, 'llvm-builder.cpp'), original);
      const installed = (await import(
        pathToFileURL(output).href
      )) as typeof import('../src/native-assets');
      expect(installed.resolveCompilerNativeAsset('llvm-builder.cpp')).toBe(
        path.join(native, 'llvm-builder.cpp')
      );
      expect(installed.resolveCompilerNativeAsset('rust-builder')).toBe(
        path.join(native, 'rust-builder')
      );
      expect(readFileSync(installed.resolveCompilerNativeAsset('llvm-builder.cpp'))).toEqual(
        original
      );
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});
