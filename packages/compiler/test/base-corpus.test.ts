import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCompiler, detectLlvmToolchain, verifyLlvmIr } from '../src';

function listProtoFiles(rootDir: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.proto.ts')) files.push(p);
    }
  };
  walk(rootDir);
  return files.sort();
}

describe('Official Proto UI Base & Shadcn prototype corpus', () => {
  const compiler = createCompiler({ rootDir: process.cwd() });

  it('compiles 100% of all .proto.ts files in packages/prototypes/base cleanly, fast, and thin', () => {
    const baseDir = path.resolve(process.cwd(), 'packages/prototypes/base/src');
    const files = listProtoFiles(baseDir);
    expect(files.length).toBeGreaterThanOrEqual(180);

    // Warm the shared Program once, then measure per-file compile time across the entire Base corpus.
    compiler.session.ensureFiles(files);

    const t0 = performance.now();
    const res = compiler.compileProject(files, { allowHookOnly: true });
    const elapsedMs = performance.now() - t0;

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.files.length).toBe(files.length);
    expect(res.value.totalPrototypes).toBeGreaterThanOrEqual(180);

    // Warm average per-file compile time must stay well under 50ms!
    const avgMs = elapsedMs / files.length;
    expect(avgMs).toBeLessThan(50);

    // Every previously failing Base family MUST succeed now!
    for (const family of [
      'dialog',
      'select',
      'popover',
      'hover-card',
      'tooltip',
      'slider',
      'tabs',
      'switch',
      'checkbox',
      'accordion',
      'table',
      'button',
    ]) {
      const found = res.value.files.some((f) => f.sourceFile.includes(`/base/src/${family}/`));
      expect(found, `expected ${family} in Base corpus`).toBe(true);
    }

    // Every emitted React component must stay genuinely thin (< 35 lines; old compiler emitted 2,500–6,200+ lines).
    for (const file of res.value.files) {
      for (const proto of file.prototypes) {
        const lineCount = proto.react.code.split('\n').length;
        expect(lineCount, `${proto.name} should be thin`).toBeLessThan(35);
      }
    }

    // Verify real LLVM 22 IR acceptance across representative complex Base prototypes!
    if (detectLlvmToolchain().available) {
      const sampled = res.value.files.filter((f) =>
        /\/(button|dialog|select|popover|hover-card|tooltip|slider|tabs|scroll-area|table)\//.test(
          f.sourceFile
        )
      );
      expect(sampled.length).toBeGreaterThanOrEqual(20);
      for (const item of sampled) {
        const verified = verifyLlvmIr(item.llvm.ir);
        expect(verified.ok, `LLVM verify failed for ${item.sourceFile}`).toBe(true);
      }
    }
  });

  it('compiles real Shadcn Button with rules to thin React and verified LLVM IR', () => {
    const res = compiler.compileFile('packages/prototypes/shadcn/src/button/button.proto.ts', {
      llvm: { verify: true, optimize: 'O2' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const proto = res.value.ir.prototypes[0];
    expect(proto.name).toBe('shadcn-button');
    expect(proto.props.map((p) => p.name)).toContain('variant');
    expect(proto.props.map((p) => p.name)).toContain('size');
    expect(proto.rules.length).toBeGreaterThan(0);
    expect(proto.hooks.some((h) => h.name === 'asButton' && h.kind === 'authored')).toBe(true);
    expect(res.value.primary!.react.code.split('\n').length).toBeLessThan(70);
    if (detectLlvmToolchain().available) {
      expect(res.value.llvm.verified).toBe(true);
    }
  });
});
