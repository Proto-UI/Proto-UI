import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Private-copy tampering and after-read replacement are intentional injections.
// Synthetic context and sanitized child environment carry no actual measurement or credentials.
const moduleRoot = fileURLToPath(new URL('../', import.meta.url));

function probeScorer(mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'modeltrace-scorer-load-'));
  try {
    const vendor = path.join(root, 'vendor/modeltrace');
    fs.mkdirSync(vendor, { recursive: true });
    fs.copyFileSync(path.join(moduleRoot, 'modeltrace.mjs'), path.join(root, 'modeltrace.mjs'));
    for (const name of ['fingerprint-core.mjs', 'unified_bank.json']) {
      fs.copyFileSync(path.join(moduleRoot, 'vendor/modeltrace', name), path.join(vendor, name));
    }
    const marker = path.join(root, 'unverified-executable-ran');
    const trap = path.join(root, 'replacement-fired');
    const malicious = `import fs from 'node:fs';fs.writeFileSync(process.env.TEST_SCORER_MARKER,'executed',{flag:'wx'});export function analyzeGlobalOutputs(){throw new Error('unverified executable ran');}\n`;
    if (mode === 'tampered') fs.writeFileSync(path.join(vendor, 'fingerprint-core.mjs'), malicious);
    const context = {
      schemaVersion: 1,
      kind: 'proto-ui.modeltrace-context',
      repositoryId: 'github.com:synthetic/scorer-load-control',
      sessionId: randomBytes(32).toString('hex'),
      contextDigest: 'a'.repeat(64),
      routeDigest: 'b'.repeat(64),
      declared: { systemModel: null, harnessModel: null },
    };
    fs.writeFileSync(
      path.join(root, 'entry.mjs'),
      `import {createModelTraceChallenge} from './modeltrace.mjs';const challenge=createModelTraceChallenge(${JSON.stringify(context)});console.log(JSON.stringify({kind:challenge.kind,ids:challenge.probes.map(probe=>probe.id)}));\n`
    );
    const args = [];
    if (mode === 'retarget-after-read') {
      fs.writeFileSync(
        path.join(root, 'bootstrap.mjs'),
        `import fs from 'node:fs';const original=fs.readFileSync;let fired=false;fs.readFileSync=function(file,...rest){const bytes=original.call(this,file,...rest);if(!fired&&String(file).endsWith('/fingerprint-core.mjs')){fired=true;fs.writeFileSync(file,${JSON.stringify(malicious)});fs.writeFileSync(process.env.TEST_SCORER_TRAP,'replaced',{flag:'wx'});}return bytes;};\n`
      );
      args.push('--import', path.join(root, 'bootstrap.mjs'));
    }
    args.push(path.join(root, 'entry.mjs'));
    const result = spawnSync(process.execPath, args, {
      cwd: root,
      env: { PATH: process.env.PATH, TEST_SCORER_MARKER: marker, TEST_SCORER_TRAP: trap },
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    return {
      status: result.status,
      error: result.error,
      signal: result.signal,
      output: result.stdout,
      unverifiedExecuted: fs.existsSync(marker),
      replacementFired: fs.existsSync(trap),
    };
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}

test('pinned scorer creates a usable challenge without executable tampering', () => {
  const result = probeScorer('original');
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.unverifiedExecuted, false);
  assert.deepEqual(JSON.parse(result.output), {
    kind: 'proto-ui.modeltrace-challenge',
    ids: ['query-01', 'query-02', 'query-03'],
  });
});

test('unverified scorer bytes cannot execute before checksum rejection', () => {
  const result = probeScorer('tampered');
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.notEqual(result.status, 0);
  assert.equal(result.unverifiedExecuted, false);
});

test('replacing the scorer after its verified read cannot select replacement code', () => {
  const result = probeScorer('retarget-after-read');
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.replacementFired, true);
  assert.notEqual(result.status, 0);
  assert.equal(result.unverifiedExecuted, false);
});
