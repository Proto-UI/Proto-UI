import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCompiler } from '../src';

function listProtoFiles(root: string): string[] {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(root, entry.name);
      return entry.isDirectory()
        ? listProtoFiles(file)
        : entry.name.endsWith('.proto.ts')
          ? [file]
          : [];
    })
    .sort();
}

describe('Official Base native compilation coverage accounting', () => {
  it('accounts for every input while preserving unsupported declarations and zero execution claims', () => {
    const compiler = createCompiler({ rootDir: process.cwd() });
    const entries = listProtoFiles(path.resolve('packages/prototypes/base/src'));
    expect(entries.length).toBeGreaterThanOrEqual(180);
    const report = compiler.inventoryProject(entries, { target: 'react' });
    expect(report.ok, JSON.stringify(report.diagnostics)).toBe(true);
    if (!report.ok) return;
    const { files, totals } = report.value;
    expect(files).toHaveLength(entries.length);
    expect(totals.inputFiles).toBe(entries.length);
    expect(totals.analyzedFiles + totals.sourceErrorFiles).toBe(entries.length);
    expect(totals.prototypeDeclarations).toBeGreaterThanOrEqual(180);
    expect(totals.nativeEmittedPrototypes).toBe(
      files.reduce((sum, file) => sum + file.nativeEmittedPrototypes, 0)
    );
    expect(totals.executionVerifiedPrototypes).toBe(0);
    expect(report.value.completeNativeCoverage).toBe(false);
    for (const file of files.filter(
      (file) => file.status === 'unsupported' || file.status === 'source-error'
    )) {
      expect(
        file.diagnostics.some((issue) => issue.severity === 'error'),
        file.sourceFile
      ).toBe(true);
      expect(file.nativeEmittedPrototypes).toBe(0);
    }
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
      expect(files.some((file) => file.sourceFile.includes('/base/src/' + family + '/'))).toBe(
        true
      );
    }
    // Full Base native behavior remains required in T-COMPILER-PIPELINE-0001.
    // This test validates the coverage report, not that unimplemented components pass.
  }, 60000);
});
