// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  VIEW_OPERATION_CASES,
  assertViewOperationCase,
  assertViewOperationReceipt,
} from '../../../../scripts/feedback/view-operation-receipt.mjs';

let receipt: any;
let source: any;
let expected: { revision: string; tree: string };
beforeAll(() => {
  const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  expected = { revision: git(['rev-parse', 'HEAD']), tree: git(['rev-parse', 'HEAD^{tree}']) };
  const parent = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir();
  mkdirSync(parent, { recursive: true });
  const output = mkdtempSync(join(parent, 'view-operation-native-'));
  // A fresh directory and actual checkout identity exclude an older successful
  // diagnostic artifact. The standard runtime gate separately binds PR/merge.
  execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/feedback/view-operation-evidence.mjs', output],
    {
      cwd: resolve('.'),
      env: { ...process.env, EVIDENCE_HEAD_SHA: expected.revision },
      timeout: 120_000,
      stdio: 'pipe',
    }
  );
  receipt = JSON.parse(readFileSync(join(output, 'native-result.json'), 'utf8'));
  source = JSON.parse(readFileSync(join(output, 'source-receipt.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(output, 'capture-manifest.json'), 'utf8'));
  expect(manifest.revision).toBe(expected.revision);
  expect(manifest.tree).toBe(expected.tree);
  expect(manifest.pass).toBe(true);
  expect(manifest.artifacts.length).toBeGreaterThan(0);
  for (const artifact of manifest.artifacts) {
    expect(artifact.path).toMatch(/^[a-zA-Z0-9.-]+$/);
    expect(
      createHash('sha256')
        .update(readFileSync(join(output, artifact.path)))
        .digest('hex')
    ).toBe(artifact.sha256);
  }
  assertViewOperationReceipt(receipt, source, expected);
}, 150_000);

describe('required native WC source-view operation obligations', () => {
  for (const [index, name] of VIEW_OPERATION_CASES.entries()) {
    it(name, () => {
      assertViewOperationReceipt(receipt, source, expected);
      assertViewOperationCase(receipt.observation.results[index], name);
    });
  }
});
