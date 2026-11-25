import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCompiler, detectLlvmToolchain, runCompilerCli } from '../src';

const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'cli-label',setup(){return r=>r.el('div','compiled');}});`;
function fixture(action: (directory: string, entry: string) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pui-native-cli-'));
  const entry = path.join(directory, 'input.proto.ts');
  fs.writeFileSync(entry, source);
  try {
    action(directory, entry);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe('Native compiler CLI', () => {
  it('rejects an unknown API target instead of treating it as semantic IR output', () => {
    const result = createCompiler({ rootDir: process.cwd() }).compilePrototype(source, {
      target: 'retired-profile' as never,
    });
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((issue) => issue.code === 'PUI_TARGET_INVALID' && issue.span)
    ).toBe(true);
  });
  it('reports target and toolchain identity', () => {
    const result = runCompilerCli(['info']);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      compiler: '@proto.ui/compiler',
      irVersion: 2,
      targets: ['react', 'gpui', 'kernel', 'ir'],
    });
  });

  it('parses option values independently of entry position and rejects malformed options', () => {
    expect(runCompilerCli(['unknown', 'missing.ts']).exitCode).toBe(2);
    expect(runCompilerCli(['compile', '--out']).exitCode).toBe(2);
    expect(runCompilerCli(['compile', 'entry.ts', '--target', 'unknown']).exitCode).toBe(2);
    expect(runCompilerCli(['compile', 'entry.ts', '--wasm']).exitCode).toBe(2);
    expect(runCompilerCli(['llvm', 'entry.ts', '--wasm', '--out', 'out']).exitCode).toBe(2);
    expect(runCompilerCli(['ir', 'entry.ts', '--out', 'out']).exitCode).toBe(2);
    expect(runCompilerCli(['check', 'entry.ts', '--out', 'out']).exitCode).toBe(2);
    expect(runCompilerCli(['compile', 'entry.ts', '--pir']).exitCode).toBe(2);
    fixture((directory, entry) => {
      const checked = runCompilerCli([
        'check',
        '--root',
        process.cwd(),
        '--target',
        'react',
        entry,
        '--json',
      ]);
      expect(checked.exitCode, checked.stderr || checked.stdout).toBe(0);
      expect(JSON.parse(checked.stdout)).toMatchObject({
        artifactKind: 'react-components',
        nativeEmittedPrototypes: 1,
        llvmEmitted: false,
        llvmVerified: false,
      });
      const ir = runCompilerCli(['ir', entry]);
      expect(ir.exitCode, ir.stderr).toBe(0);
      expect(JSON.parse(ir.stdout).irVersion).toBe(2);
      const output = path.join(directory, 'out');
      const compiled = runCompilerCli(['compile', entry, '--out', output, '--pir', '--json']);
      expect(compiled.exitCode, compiled.stderr || compiled.stdout).toBe(0);
      const paths = JSON.parse(compiled.stdout).written as string[];
      expect(paths.map((file) => path.extname(file)).sort()).toEqual(['.json', '.tsx']);
      expect(fs.readFileSync(paths.find((file) => file.endsWith('.tsx'))!, 'utf8')).not.toContain(
        '@proto.ui/'
      );
      expect(runCompilerCli(['compile', entry, '--out', output]).exitCode).toBe(2);
      expect(fs.readFileSync(entry, 'utf8')).toBe(source);
    });
  });

  it('does not require LLVM for React and reports a requested missing native toolchain as failure', () => {
    fixture((_directory, entry) => {
      const previousPath = process.env.PATH;
      process.env.PATH = '';
      try {
        const react = runCompilerCli(['check', entry, '--target', 'react']);
        expect(react.exitCode, react.stderr).toBe(0);
        const kernel = runCompilerCli(['llvm', entry, '--json']);
        expect(kernel.exitCode).toBe(1);
        expect(
          JSON.parse(kernel.stdout).diagnostics.some((issue: { code: string }) =>
            issue.code.startsWith('PUI_LLVM_')
          )
        ).toBe(true);
      } finally {
        process.env.PATH = previousPath;
      }
    });
  });

  it('writes no artifacts after an unsupported source failure', () => {
    fixture((directory, entry) => {
      fs.writeFileSync(
        entry,
        `import {definePrototype} from '@proto.ui/core'; export default definePrototype({name:'unsupported',setup(){console.log('effect');return r=>r.el('div','x');}});`
      );
      const output = path.join(directory, 'no-partial-output');
      const result = runCompilerCli(['compile', entry, '--out', output, '--json']);
      expect(result.exitCode).toBe(1);
      expect(fs.existsSync(output)).toBe(false);
    });
  });

  it.skipIf(!detectLlvmToolchain().available)(
    'emits a real explicitly selected LLVM kernel',
    () => {
      fixture((_directory, entry) => {
        const result = runCompilerCli(['llvm', entry, '--optimize']);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain('@__pui_abi_version');
      });
    }
  );
});
