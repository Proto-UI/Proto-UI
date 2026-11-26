import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { createHookSourceModuleContext } from '../src/services/hook-source-module';

function fixture() {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'pui-summary-scope-')));
  const fileName = path.join(directory, 'source.ts');
  const dependency = path.join(directory, 'dependency.ts');
  const text = `import { value } from './dependency'; export const result = value;`;
  writeFileSync(fileName, text);
  writeFileSync(dependency, 'export const value = 1;');
  writeFileSync(path.join(directory, 'tsconfig.json'), '{}');
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  return { directory, fileName, dependency, source, context: createHookSourceModuleContext() };
}

describe('synchronous summary query lifetime', () => {
  it('isolates a public query reentered during filesystem resolution and restores the outer observations', () => {
    const { directory, fileName, dependency, context } = fixture();
    const native = vi.spyOn(realpathSync, 'native');
    const originalExists = ts.sys.fileExists;
    const exists = vi.spyOn(ts.sys, 'fileExists');
    let nested = false;
    try {
      exists.mockImplementation((file) => {
        if (!nested) {
          nested = true;
          expect(context.resolveModule(fileName, './dependency')?.file).toBe(dependency);
        }
        return originalExists(file);
      });
      context.withSynchronousIdentityQuery(() => {
        expect(context.resolveModule(fileName, './dependency')?.file).toBe(dependency);
        expect(nested).toBe(true);
        expect(native.mock.calls.filter(([file]) => String(file) === fileName)).toHaveLength(2);
        expect(context.resolveModule(fileName, './dependency')?.file).toBe(dependency);
        expect(native.mock.calls.filter(([file]) => String(file) === fileName)).toHaveLength(2);
      });
      expect(context.resolveModule(fileName, './dependency')?.file).toBe(dependency);
      expect(native.mock.calls.filter(([file]) => String(file) === fileName)).toHaveLength(3);
    } finally {
      exists.mockRestore();
      native.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('restores the observation boundary after an exception', () => {
    const { directory, fileName, source, context } = fixture();
    const native = vi.spyOn(realpathSync, 'native');
    try {
      expect(() =>
        context.withSynchronousIdentityQuery(() => {
          expect(context.moduleForSource(source).file).toBe(fileName);
          throw new Error('summary failed');
        })
      ).toThrow('summary failed');
      expect(context.moduleForSource(source).file).toBe(fileName);
      expect(native.mock.calls.filter(([file]) => String(file) === fileName)).toHaveLength(2);
    } finally {
      native.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('gives a nested summary its own observations without clearing the resumed outer query', () => {
    const { directory, fileName, source, context } = fixture();
    const native = vi.spyOn(realpathSync, 'native');
    try {
      context.withSynchronousIdentityQuery(() => {
        expect(context.moduleForSource(source).file).toBe(fileName);
        context.withSynchronousIdentityQuery(() => {
          expect(context.moduleForSource(source).file).toBe(fileName);
          expect(context.moduleForSource(source).file).toBe(fileName);
        });
        expect(context.moduleForSource(source).file).toBe(fileName);
      });
      expect(native.mock.calls.filter(([file]) => String(file) === fileName)).toHaveLength(2);
      expect(context.moduleForSource(source).file).toBe(fileName);
      expect(native.mock.calls.filter(([file]) => String(file) === fileName)).toHaveLength(3);
    } finally {
      native.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('ends the synchronous scope before a returned promise continues', async () => {
    const { directory, fileName, source, context } = fixture();
    const native = vi.spyOn(realpathSync, 'native');
    try {
      await context.withSynchronousIdentityQuery(async () => {
        expect(context.moduleForSource(source).file).toBe(fileName);
        await Promise.resolve();
        expect(context.moduleForSource(source).file).toBe(fileName);
      });
      expect(native.mock.calls.filter(([file]) => String(file) === fileName)).toHaveLength(2);
    } finally {
      native.mockRestore();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('never caches a failed physical lookup, even inside the same summary', () => {
    const { directory, context } = fixture();
    const physical = path.join(directory, 'physical');
    const alias = path.join(directory, 'alias');
    mkdirSync(physical);
    symlinkSync(physical, alias);
    const logicalFile = path.join(alias, 'new.ts');
    const physicalFile = path.join(physical, 'new.ts');
    const source = ts.createSourceFile(
      logicalFile,
      'export const value=1;',
      ts.ScriptTarget.Latest,
      true
    );
    try {
      context.withSynchronousIdentityQuery(() => {
        expect(context.moduleForSource(source).file).toBe(logicalFile);
        writeFileSync(physicalFile, source.text);
        expect(context.moduleForSource(source).file).toBe(physicalFile);
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not share declaration or symbol facts between replacement source nodes', () => {
    const { directory, fileName, context } = fixture();
    const before = ts.createSourceFile(
      fileName,
      'export const value=1;',
      ts.ScriptTarget.Latest,
      true
    );
    const after = ts.createSourceFile(
      fileName,
      'export const value=2;',
      ts.ScriptTarget.Latest,
      true
    );
    try {
      context.withSynchronousIdentityQuery(() => {
        const first = context.moduleForSource(before);
        const firstValue = context.resolveExport(first, 'value');
        const second = context.moduleForSource(after);
        const secondValue = context.resolveExport(second, 'value');
        expect(firstValue?.declaration.getSourceFile()).toBe(before);
        expect(secondValue?.declaration.getSourceFile()).toBe(after);
        expect(context.resolveExport(first, 'value')?.declaration).toBe(firstValue?.declaration);
        expect(context.resolveExport(second, 'value')?.declaration).toBe(secondValue?.declaration);
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
