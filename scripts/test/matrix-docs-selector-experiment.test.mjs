import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  columnsPath,
  directSelector,
  originalSelector,
  subjects,
  createSubjectDirectory,
  validateObservation,
} from './matrix-docs-selector-experiment.mjs';

const source = readFileSync(columnsPath, 'utf8');
test('both subjects preserve the current full declarations and differ only in two route conditions', () => {
  const { baseline, direct } = subjects(source);
  assert.equal(baseline.split(originalSelector).length - 1, 2);
  assert.equal(direct.split(directSelector).length - 1, 2);
  assert.equal(direct.replaceAll(directSelector, originalSelector), baseline);
  const blocks = (input) => input.slice(input.indexOf('<style is:global>')).match(/\{[^}]*\}/g);
  assert.deepEqual(blocks(baseline), blocks(source));
  assert.deepEqual(blocks(direct), blocks(source));
  assert(baseline.includes("layout: isSplash ? 'splash' : 'docs'"));
  assert(baseline.includes('data-astro-rerun'));
});

test('a used subject directory cannot replace its source label or old browser results', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'matrix-selector-'));
  try {
    const target = createSubjectDirectory(directory, 'baseline');
    writeFileSync(path.join(target, 'source.json'), 'original evidence');
    assert.throws(() => createSubjectDirectory(directory, 'baseline'), { code: 'EEXIST' });
    assert.equal(readFileSync(path.join(target, 'source.json'), 'utf8'), 'original evidence');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('summary binds the actual failed observation without turning it into acceptance', () => {
  const title = 'mounts every demo in every official Web adapter';
  const suite = 'Website Demo Matrix browser smoke';
  const source = { baseHead: 'a'.repeat(40) };
  const report = {
    testResults: [
      {
        assertionResults: [
          { title, ancestorTitles: [suite], fullName: `${suite} ${title}`, status: 'failed' },
        ],
      },
    ],
  };
  const phases = [
    {
      sourceSha: source.baseHead,
      caseName: `${suite} > ${title}`,
      phase: 'route-open',
      outcome: 'started',
    },
  ];
  assert.equal(validateObservation(source, report, '1\n', phases).exitCode, 1);
  for (const exit of ['', '\n', 'NaN', '0garbage', '-1', '256', '1\n0'])
    assert.throws(() => validateObservation(source, report, exit, phases));
  for (const changed of [
    [{ ...phases[0], sourceSha: 'b'.repeat(40) }],
    [{ ...phases[0], caseName: `${suite} > another test` }],
    [],
  ])
    assert.throws(() => validateObservation(source, report, '1', changed));
  const skipped = structuredClone(report);
  skipped.testResults[0].assertionResults[0].status = 'skipped';
  assert.throws(() => validateObservation(source, skipped, '0', phases));
});

test('source drift or an already instrumented source cannot silently broaden the intervention', () => {
  for (const changed of [
    source.replace(originalSelector, 'body'),
    source + `\n${originalSelector}`,
    source.replace('--docs-preview-header-height, 3.75rem', '--docs-preview-header-height, 4.5rem'),
    subjects(source).baseline,
  ])
    assert.throws(() => subjects(changed));
});
