import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectLlvmToolchain, runCompilerCli } from '../src';

describe('Compiler CLI', () => {
  it('reports compiler and LLVM toolchain info', () => {
    const res = runCompilerCli(['info']);
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.compiler).toBe('@proto.ui/compiler');
    expect(parsed.irVersion).toBe(2);
  });

  it('checks, prints SSA IR, prints LLVM IR, and compiles base/button to disk', () => {
    const check = runCompilerCli(['check', 'packages/prototypes/base/src/button/button.proto.ts']);
    expect(check.exitCode).toBe(0);
    const info = JSON.parse(check.stdout);
    expect(info.ok).toBe(true);
    expect(info.prototypes[0].name).toBe('base-button');

    const ir = runCompilerCli(['ir', 'packages/prototypes/base/src/button/button.proto.ts']);
    expect(ir.exitCode).toBe(0);
    expect(ir.stdout).toContain('prototype @base-button');

    const ll = runCompilerCli([
      'llvm',
      'packages/prototypes/base/src/button/button.proto.ts',
      '--optimize',
    ]);
    expect(ll.exitCode).toBe(0);
    expect(ll.stdout).toMatch(/define\s+(?:noundef\s+)?i64\s+@base_button_capabilities\(\)/);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pui-cli-test-'));
    try {
      const tc = detectLlvmToolchain();
      const args = [
        'compile',
        'packages/prototypes/base/src/button/button.proto.ts',
        '--out',
        tmp,
        '--json',
      ];
      if (tc.opt && tc.llc && tc.wasmLd) args.push('--wasm');
      const compiled = runCompilerCli(args);
      expect(compiled.exitCode).toBe(0);
      const written = JSON.parse(compiled.stdout).written as string[];
      expect(written.some((f) => f.endsWith('BaseButton.tsx'))).toBe(true);
      expect(written.some((f) => f.endsWith('BaseButton.ll'))).toBe(true);
      if (tc.opt && tc.llc && tc.wasmLd) {
        expect(written.some((f) => f.endsWith('BaseButton.wasm'))).toBe(true);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
