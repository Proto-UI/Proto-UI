import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { MATRIX_PATH, validateMatrixText } from '../check-dogfood-coverage-matrix.mjs';

const matrixText = await readFile(MATRIX_PATH, 'utf8');

function mutateRow(text, id, mutate) {
  return text
    .split(/\r?\n/u)
    .map((line) => {
      if (!line.startsWith(`| ${id} |`)) return line;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      mutate(cells);
      return `| ${cells.join(' | ')} |`;
    })
    .join('\n');
}

test('the authoritative Agent Harness coverage matrix is internally consistent', () => {
  const result = validateMatrixText(matrixText);

  assert.ok(result.surfaceCount >= 40);
  assert.equal(result.baselineCount, 11);
  assert.equal(result.errors.length, 0, result.errors.join('\n'));
});

test('duplicate stable surface IDs are rejected', () => {
  const firstRow = matrixText
    .split(/\r?\n/u)
    .find((line) => /^\| AH-[A-Z0-9]+-\d{3} \|/u.test(line));
  assert.ok(firstRow);

  const result = validateMatrixText(`${matrixText}\n${firstRow}`);

  assert.match(result.errors.join('\n'), /duplicate surface ID/u);
});

test('unknown reporting states are rejected', () => {
  const mutated = matrixText.replace(' | `research` | ', ' | `unknown` | ');
  const result = validateMatrixText(mutated);

  assert.match(result.errors.join('\n'), /unsupported state/u);
});

test('research and blocked rows require a linked dependency Issue', () => {
  const mutated = mutateRow(matrixText, 'AH-RUN-005', (cells) => {
    cells[7] = 'no dependency';
  });
  const result = validateMatrixText(mutated);

  assert.match(result.errors.join('\n'), /must link a dependency Issue/u);
});

test('published state totals cannot drift from the surface rows', () => {
  const mutated = matrixText.replace(
    /^(\|\s*`research`\s*\|\s*)(\d+)(\s*\|)/mu,
    (_match, prefix, count, suffix) => `${prefix}${Number(count) + 1}${suffix}`
  );
  const result = validateMatrixText(mutated);

  assert.match(result.errors.join('\n'), /published state total/u);
});

test('not-implemented baselines require a public evidence checkpoint', () => {
  const mutated = mutateRow(matrixText, 'BL-001', (cells) => {
    cells[5] = 'no checkpoint';
  });
  const result = validateMatrixText(mutated);

  assert.match(result.errors.join('\n'), /baseline BL-001.*must link/u);
});

test('local evidence links must resolve inside the checkout', () => {
  const mutated = matrixText.replace(
    '../../spec/prototypes/P-BASE-BUTTON.yaml',
    '../../spec/prototypes/P-BASE-NOT-REAL.yaml'
  );
  const result = validateMatrixText(mutated);

  assert.match(result.errors.join('\n'), /missing local evidence link target/u);
});

test('Issue link labels must match their URL target', () => {
  const mutated = matrixText.replace(
    '[#513](https://github.com/Proto-UI/Proto-UI/issues/513)',
    '[#513](https://github.com/Proto-UI/Proto-UI/issues/514)'
  );
  const result = validateMatrixText(mutated);

  assert.match(result.errors.join('\n'), /Issue link label #513 targets Issue #514/u);
});
