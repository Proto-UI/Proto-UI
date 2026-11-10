// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inputEvidenceSource } from './input-visual-evidence';

const roots: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pui-input-source-'));
  roots.push(root);
  execFileSync('git', ['init', '--quiet', root]);
  writeFileSync(join(root, 'editor.txt'), 'original source\n');
  execFileSync('git', ['add', 'editor.txt'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Input metadata fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Fixture source'], { cwd: root });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Input evidence source identity (metadata only; no native acceptance)', () => {
  it('distinguishes changed source bytes even when HEAD has not changed', () => {
    const root = fixture();
    const before = inputEvidenceSource(root);
    writeFileSync(join(root, 'editor.txt'), 'different source\n');
    const after = inputEvidenceSource(root);
    expect(after.sourceSha).toBe(before.sourceSha);
    expect(before.sourceDirty).toBe(false);
    expect(after.sourceDirty).toBe(true);
    expect(after.sourceTreeSha256).not.toBe(before.sourceTreeSha256);
  });

  it('includes a newly authored hidden source rather than assigning it to the old commit', () => {
    const root = fixture();
    const before = inputEvidenceSource(root);
    writeFileSync(join(root, '.new-editor.txt'), 'new source\n');
    const after = inputEvidenceSource(root);
    expect(after.sourceSha).toBe(before.sourceSha);
    expect(after.sourceDirty).toBe(true);
    expect(after.sourceTreeSha256).not.toBe(before.sourceTreeSha256);
  });

  it('rejects a missing tracked source instead of silently shrinking evidence membership', () => {
    const root = fixture();
    inputEvidenceSource(root);
    unlinkSync(join(root, 'editor.txt'));
    expect(() => inputEvidenceSource(root)).toThrow('ENOENT');
  });
});
