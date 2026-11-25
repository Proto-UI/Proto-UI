// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DOCS_ROOT = path.resolve(import.meta.dirname);
const STATIC_GRADIENT_BACKDROP =
  /bg-gradient-to-br\s+(?:from-sky-500\/(?:20|25)|from-rose-500\/20)/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

describe('Liquid Glass demo backdrop admission hygiene', () => {
  it('avoids static gradient painted ancestors in non-materialStage Liquid Glass demos and shared builders', () => {
    const offenders: string[] = [];
    for (const file of walk(DOCS_ROOT)) {
      const source = readFileSync(file, 'utf8');
      const base = path.basename(file);
      const isLiquidDemo = base.includes('liquid-glass') && base.endsWith('.demo.ts');
      const isLiquidShared = base.endsWith('.shared.ts') && source.includes('liquid-glass');
      if (!isLiquidDemo && !isLiquidShared) continue;
      if (source.includes('materialStage')) continue;
      if (STATIC_GRADIENT_BACKDROP.test(source)) {
        offenders.push(path.relative(DOCS_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
