// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { createFiniteRowLifetimeProof } from '../src/services/finite-row-lifetime';

it.each([false, true])(
  'does not authorize a fabricated trusted-ABI row export, write=%s',
  (write) => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'pui-row-reader-cone-')));
    try {
      writeFileSync(
        path.join(directory, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: { baseUrl: '.', paths: { '@proto.ui/core': ['./core.ts'] } },
        })
      );
      writeFileSync(
        path.join(directory, 'core.ts'),
        "export const ROWS = ['left', 'right'] as const;"
      );
      const file = path.join(directory, 'entry.ts');
      const text = `import { ROWS } from '@proto.ui/core';
        ${write ? "ROWS[0] = 'foreign';" : ''}
        for (const row of ROWS) { void row; }`;
      writeFileSync(file, text);
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const loop = source.statements.find(ts.isForOfStatement);
      expect(loop).toBeDefined();
      // Skipping Core's trusted runtime edge does not authorize arbitrary
      // exports, even when the importing source contains no visible write.
      expect(createFiniteRowLifetimeProof(source)(loop!.expression)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
);

it.each([
  "eval('sideEffect()');",
  "require('./foreign');",
  "import('./foreign');",
  'with (foreign) { void value; }',
])('rechecks opaque syntax in a fresh parse at the same path: %s', (opaque) => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'pui-row-opaque-')));
  try {
    const file = path.join(directory, 'entry.ts');
    const text = "const ROWS = ['left', 'right'] as const; for (const row of ROWS) { void row; }";
    writeFileSync(file, text);
    const original = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const changed = ts.createSourceFile(file, `${text}\n${opaque}`, ts.ScriptTarget.Latest, true);
    const originalLoop = original.statements.find(ts.isForOfStatement)!;
    const changedLoop = changed.statements.find(ts.isForOfStatement)!;
    const proof = createFiniteRowLifetimeProof(original);

    expect(proof(originalLoop.expression)).toBe(true);
    expect(proof(changedLoop.expression)).toBe(false);
    expect(proof(originalLoop.expression)).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.each([
  ['a', 'b'],
  ['b', 'a'],
])('keeps later row queries sound after an import retargets from %s to %s', (from, to) => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'pui-row-retarget-')));
  try {
    writeFileSync(path.join(directory, 'a.ts'), "export const ROWS = ['a1', 'a2'] as const;");
    writeFileSync(path.join(directory, 'b.ts'), "export const ROWS = ['b1', 'b2'] as const;");
    writeFileSync(
      path.join(directory, 'mut.ts'),
      "import { ROWS } from './link'; export function poke() { ROWS[0] = 'foreign'; }"
    );
    const file = path.join(directory, 'entry.ts');
    const text = `import { ROWS as A } from './a';
      import { ROWS as B } from './b';
      import { poke } from './mut';
      for (const row of ${from.toUpperCase()}) { void row; }
      for (const row of ${to.toUpperCase()}) { void row; }`;
    writeFileSync(file, text);
    const link = path.join(directory, 'link.ts');
    symlinkSync(`${from}.ts`, link);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const [first, later] = source.statements.filter(ts.isForOfStatement);
    const proof = createFiniteRowLifetimeProof(source);

    expect(proof(first.expression)).toBe(false);
    unlinkSync(link);
    symlinkSync(`${to}.ts`, link);
    expect(proof(later.expression)).toBe(false);
    expect(createFiniteRowLifetimeProof(source)(later.expression)).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
