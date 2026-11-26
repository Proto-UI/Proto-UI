import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  applyDebtRatchet,
  lintMarkdownDocument,
  lintNonMarkdownFile,
  loadValeRules,
  runInternalDocsCheck,
} from '../check-internal-docs.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

test('human-authored benchmark records pass with zero blocking errors', async () => {
  const valeRules = await loadValeRules(REPO_ROOT);
  const goldStandards = [
    'internal/records/2026-04-06-dialog-design.md',
    'internal/records/2026-04-03-prototype-library-quality-audit.md',
    'internal/records/2026-06-29-focus-logical-tree-model.zh-CN.md',
    'internal/autonomous-maintenance/phase-0/AUDIT-2026-08-20.zh-CN.md',
    'internal/contracts/prototype-base/select.v0.md',
    'internal/contracts/prototype-base/dropdown.v0.md',
  ];
  for (const relPath of goldStandards) {
    const text = await fs.readFile(path.join(REPO_ROOT, relPath), 'utf8');
    const { diagnostics } = lintMarkdownDocument({ relPath, text, valeRules });
    assert.deepEqual(
      diagnostics,
      [],
      `Expected zero blocking errors for human benchmark ${relPath}, got: ${JSON.stringify(diagnostics, null, 2)}`
    );
  }
});

test('forbids binary archives, split bundles, logs, and oversized images/JSON under internal/', () => {
  const tar = lintNonMarkdownFile({
    relPath: 'internal/records/evidence/run/bundle.tar.gz',
    byteSize: 4096,
  });
  assert.equal(tar.length, 1);
  assert.equal(tar[0].rule, 'internal/no-binary-or-archive');

  const part = lintNonMarkdownFile({
    relPath: 'internal/records/evidence/run/original-commits.bundle.part-01',
    byteSize: 4 * 1024 * 1024,
  });
  assert.equal(part[0].rule, 'internal/no-binary-or-archive');

  const log = lintNonMarkdownFile({
    relPath: 'internal/records/evidence/run/output.log',
    byteSize: 120,
  });
  assert.equal(log[0].rule, 'internal/no-binary-or-archive');

  const bigPng = lintNonMarkdownFile({
    relPath: 'internal/records/capture.png',
    byteSize: 150 * 1024,
  });
  assert.equal(bigPng[0].rule, 'internal/no-binary-or-archive');

  const smallPng = lintNonMarkdownFile({
    relPath: 'internal/records/capture.png',
    byteSize: 40 * 1024,
  });
  assert.deepEqual(smallPng, []);

  const bigJson = lintNonMarkdownFile({
    relPath: 'internal/compiler/huge-dump.json',
    byteSize: 800 * 1024,
  });
  assert.equal(bigJson[0].rule, 'internal/size-budget');

  const smallJson = lintNonMarkdownFile({
    relPath: 'internal/compiler/small.json',
    byteSize: 12 * 1024,
  });
  assert.deepEqual(smallJson, []);
});

test('catches wall-of-text paragraphs, defensive disclaimers outside scope, inline forensics, and local paths', () => {
  const longPara =
    'This investigation begins by describing every single intermediate step without structure or brevity. '.repeat(
      6
    );
  const doc = [
    '# Bloated agent audit',
    '',
    '## Context',
    '',
    longPara,
    '',
    'Commit `52101cba9b8a1f2e3d4c5b6a7f8e9d0c1b2a3f4e`, `2e1ff0919b8a1f2e3d4c5b6a7f8e9d0c1b2a3f4e`, and `a75a8b149b8a1f2e3d4c5b6a7f8e9d0c1b2a3f4e` match SHA-256 `5428652a05cbc126512e490cc7f7e8a4cacfe8bf62cf5227b87b43fc75fb856f`. This does not prove full acceptance.',
    '',
    'See `/tmp/local-probe.log` and `/home/ezra/scratch/run.json` where socket EPERM happened on run 45383599762 (1699009 bytes). This does not claim parity, completion, or approval.',
    '',
    'Row height computes to2rem with prior44px fallback.',
    '',
    '# Second H1 pasted below',
    '',
    'Another section that does not establish runtime acceptance.',
  ].join('\n');

  const { diagnostics } = lintMarkdownDocument({
    relPath: 'internal/records/2026-11-26-sample-audit.md',
    text: doc,
  });
  const rules = new Set(diagnostics.map((d) => d.rule));
  assert.ok(rules.has('prose/max-paragraph-length'));
  assert.ok(rules.has('prose/single-slot-disclaimer'));
  assert.ok(rules.has('prose/no-stacked-negatives'));
  assert.ok(rules.has('internal/no-inline-forensics'));
  assert.ok(rules.has('internal/no-local-paths'));
  assert.ok(rules.has('internal/no-merged-tokens'));
  assert.ok(rules.has('internal/single-h1'));
});

test('allows centralized disclaimers inside ## Scope & Limits and receipts inside ## Receipts', () => {
  const doc = [
    '---',
    'kind: investigation',
    'status: active',
    'date: 2026-11-27',
    'baseline: 2f2398fcb',
    'receipts:',
    '  - https://github.com/Proto-UI/Proto-UI/pull/1955',
    '---',
    '',
    '# Popover wheel reset root cause',
    '',
    '## Conclusion',
    '',
    'An internal scroll event triggered `FloatingUI.position()`, which cleared the height cap before measuring natural size.',
    '',
    '## Fix',
    '',
    '- Scope captured-scroll listeners to strict ancestors of the reference or floating box.',
    '- Restore the owned height cap synchronously before awaiting layout work.',
    '',
    '## Scope & Limits',
    '',
    'This fix covers Web positioning hosts only; it does not establish GPUI parity or native assistive-technology acceptance.',
    '',
    '## Receipts',
    '',
    '- Verified on commit `2f2398fcbf65be5099901caa5649e39103b3a163` (run 45425876105).',
  ].join('\n');

  const { diagnostics } = lintMarkdownDocument({
    relPath: 'internal/records/2026-11-27-popover-wheel-fix.md',
    text: doc,
  });
  assert.deepEqual(diagnostics, []);
});

test('enforces YAML frontmatter on records dated on or after 2026-11-27', () => {
  const { diagnostics } = lintMarkdownDocument({
    relPath: 'internal/records/2026-11-27-missing-frontmatter.md',
    text: '# New record\n\n## Summary\n\nShort engineering summary.\n',
  });
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].rule, 'internal/record-frontmatter');
});

test('catches oversized tables, wide tables, and inline-code stuffing', () => {
  const bigCell = 'A'.repeat(260);
  const stuffedBullet = `- Delivered: ${Array.from({ length: 12 }, (_, i) => `\`packages/p-${i}/index.ts\``).join(', ')}`;
  const doc = [
    '# Compact structure test',
    '',
    '| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    `| a | b | c | d | e | f | g | ${bigCell} |`,
    '',
    stuffedBullet,
  ].join('\n');

  const { diagnostics } = lintMarkdownDocument({
    relPath: 'internal/governance/sample-matrix.md',
    text: doc,
  });
  const rules = new Set(diagnostics.map((d) => d.rule));
  assert.ok(rules.has('prose/compact-table'));
  assert.ok(rules.has('prose/no-inline-code-stuffing'));
});

test('loads .vale/styles/ProtoUI YAML rules and emits non-blocking English prose warnings', async () => {
  const valeRules = await loadValeRules(REPO_ROOT);
  assert.ok(valeRules.length >= 4, 'Expected at least 4 ProtoUI Vale rule files');

  const doc = [
    '# Sample engineering note',
    '',
    '## Summary',
    '',
    'Furthermore, the runner will perform reconciliation after checks finish. This result is not established by local logs alone.',
  ].join('\n');

  const { diagnostics, warnings } = lintMarkdownDocument({
    relPath: 'internal/governance/sample-note.md',
    text: doc,
    valeRules,
  });
  assert.deepEqual(diagnostics, []);
  const warningRules = new Set(warnings.map((w) => w.rule));
  assert.ok(warningRules.has('vale/ProtoUI.AiFillerOpeners'));
  assert.ok(warningRules.has('vale/ProtoUI.BureaucraticNominalization'));
  assert.ok(warningRules.has('vale/ProtoUI.PassiveBureaucracy'));
});

test('debt ratchet allows frozen legacy debt, rejects increases/new files, and detects stale debt', () => {
  const baseline = {
    files: {
      'internal/records/legacy.md': { 'prose/max-paragraph-length': 2 },
    },
  };

  // Same debt passes
  const same = applyDebtRatchet({
    diagnostics: [
      {
        file: 'internal/records/legacy.md',
        rule: 'prose/max-paragraph-length',
        line: 5,
        message: 'x',
      },
      {
        file: 'internal/records/legacy.md',
        rule: 'prose/max-paragraph-length',
        line: 9,
        message: 'x',
      },
    ],
    baseline,
    checkedFiles: ['internal/records/legacy.md'],
  });
  assert.deepEqual(same.failures, []);
  assert.deepEqual(same.staleEntries, []);

  // Debt increase or new file fails
  const worse = applyDebtRatchet({
    diagnostics: [
      {
        file: 'internal/records/legacy.md',
        rule: 'prose/max-paragraph-length',
        line: 5,
        message: 'x',
      },
      {
        file: 'internal/records/legacy.md',
        rule: 'prose/max-paragraph-length',
        line: 9,
        message: 'x',
      },
      {
        file: 'internal/records/legacy.md',
        rule: 'prose/max-paragraph-length',
        line: 12,
        message: 'x',
      },
      { file: 'internal/records/brand-new.md', rule: 'internal/single-h1', line: 1, message: 'x' },
    ],
    baseline,
    checkedFiles: ['internal/records/legacy.md', 'internal/records/brand-new.md'],
  });
  assert.equal(worse.failures.length, 2);

  // Reduced debt surfaces stale baseline entry so debt stays locked down
  const improved = applyDebtRatchet({
    diagnostics: [
      {
        file: 'internal/records/legacy.md',
        rule: 'prose/max-paragraph-length',
        line: 5,
        message: 'x',
      },
    ],
    baseline,
    checkedFiles: ['internal/records/legacy.md'],
  });
  assert.deepEqual(improved.failures, []);
  assert.equal(improved.staleEntries.length, 1);
  assert.equal(improved.staleEntries[0].actualCount, 1);
});

test('runInternalDocsCheck works end-to-end in an isolated workspace with baseline ratchet', async (t) => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pui-internal-docs-'));
  t.after(() => fs.rm(tmpRoot, { recursive: true, force: true }));

  await fs.mkdir(path.join(tmpRoot, 'internal/records'), { recursive: true });
  await fs.writeFile(
    path.join(tmpRoot, 'internal/records/2026-11-27-good.md'),
    [
      '---',
      'kind: design',
      'status: active',
      'date: 2026-11-27',
      '---',
      '',
      '# Clean design record',
      '',
      '## Decision',
      '',
      'Keep metadata in frontmatter and write concise engineering bullets.',
      '',
      '- Clear structure',
      '- Zero defensive boilerplate',
    ].join('\n')
  );

  const okRes = await runInternalDocsCheck({
    root: tmpRoot,
    files: ['internal/records/2026-11-27-good.md'],
    useBaseline: false,
  });
  assert.equal(okRes.ok, true);
  assert.deepEqual(okRes.failures, []);
});
