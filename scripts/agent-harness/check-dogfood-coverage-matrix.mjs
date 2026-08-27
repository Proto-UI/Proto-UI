import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');

export const MATRIX_PATH = resolve(
  REPO_ROOT,
  'internal',
  'agent-harness',
  'dogfood-coverage-matrix.md'
);

const TARGET_CLASSES = [
  'official-prototype',
  'composition',
  'app-local-proto',
  'native/static',
  'infrastructure-exempt',
];

const REPORTING_STATES = [
  'dogfooded',
  'app-local-proto',
  'ready',
  'research',
  'blocked',
  'native/static',
  'infrastructure-exempt',
];

const REQUIRED_BASELINES = Array.from(
  { length: 11 },
  (_unused, index) => `BL-${String(index + 1).padStart(3, '0')}`
);

const REQUIRED_ISSUES = [
  513,
  514,
  ...Array.from({ length: 19 }, (_unused, index) => 515 + index),
  377,
  500,
  501,
  388,
  389,
  374,
  495,
  420,
  558,
];
const ISSUE_LINK_RE = /\[#\d+\]\(https:\/\/github\.com\/Proto-UI\/Proto-UI\/issues\/\d+\)/u;

function unquote(value) {
  return value.replace(/^`|`$/gu, '');
}

function parseCells(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function countBy(rows, key) {
  const counts = Object.fromEntries(key.map((value) => [value, 0]));
  for (const row of rows) {
    if (Object.hasOwn(counts, row)) counts[row] += 1;
  }
  return counts;
}

function parsePublishedTotals(text, allowedValues, label, errors) {
  const totals = {};
  const heading = label === 'state' ? '### Reporting state totals' : '### Target class totals';
  const sectionStart = text.indexOf(heading);
  const nextSectionStart = text.indexOf('\n### ', sectionStart + heading.length);
  const section = text.slice(sectionStart, nextSectionStart === -1 ? undefined : nextSectionStart);
  if (sectionStart === -1) errors.push(`missing ${heading} section`);
  for (const value of allowedValues) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const match = section.match(new RegExp(`^\\|\\s*\`${escaped}\`\\s*\\|\\s*(\\d+)\\s*\\|`, 'mu'));
    if (!match) {
      errors.push(`missing published ${label} total for ${value}`);
      continue;
    }
    totals[value] = Number(match[1]);
  }
  return totals;
}

export function validateMatrixText(text) {
  const errors = [];
  const lines = text.split(/\r?\n/u);
  const surfaceRows = [];
  const baselineRows = [];
  const seenIds = new Set();
  const seenBaselineIds = new Set();

  if (!text.includes('<!-- agent-harness-dogfood-matrix:v1 -->')) {
    errors.push('missing matrix format marker');
  }

  for (const line of lines) {
    const surfaceMatch = line.match(/^\|\s*(AH-[A-Z0-9]+-\d{3})\s*\|/u);
    if (surfaceMatch) {
      const cells = parseCells(line);
      const id = surfaceMatch[1];
      if (cells.length !== 14) {
        errors.push(`${id} must contain exactly 14 columns; found ${cells.length}`);
        continue;
      }
      if (seenIds.has(id)) errors.push(`duplicate surface ID: ${id}`);
      seenIds.add(id);

      const targetClass = unquote(cells[4]);
      const state = unquote(cells[11]);
      if (!TARGET_CLASSES.includes(targetClass)) {
        errors.push(`${id} has unsupported target class: ${targetClass}`);
      }
      if (!REPORTING_STATES.includes(state)) {
        errors.push(`${id} has unsupported state: ${state}`);
      }
      if (['research', 'blocked'].includes(state) && !ISSUE_LINK_RE.test(cells[7])) {
        errors.push(`${id} in ${state} must link a dependency Issue`);
      }
      if (/(?:\bTBD\b|\bTODO\b|\bunknown\b)/u.test(line)) {
        errors.push(`${id} contains an unclassified placeholder`);
      }
      if (
        !/^None\b/u.test(cells[13]) &&
        (!ISSUE_LINK_RE.test(cells[13]) || !/until|remove|re-review|expire/iu.test(cells[13]))
      ) {
        errors.push(`${id} temporary escape must name a removal Issue and limit/re-review trigger`);
      }
      surfaceRows.push({ id, state, targetClass });
      continue;
    }

    const baselineMatch = line.match(/^\|\s*(BL-\d{3})\s*\|/u);
    if (baselineMatch) {
      const cells = parseCells(line);
      const id = baselineMatch[1];
      if (cells.length !== 7) {
        errors.push(`${id} must contain exactly 7 columns; found ${cells.length}`);
        continue;
      }
      if (/not implemented/iu.test(cells[3]) && !ISSUE_LINK_RE.test(cells[5])) {
        errors.push(`baseline ${id} marked not implemented must link a checkpoint Issue`);
      }
      if (seenBaselineIds.has(id)) errors.push(`duplicate baseline ID: ${id}`);
      seenBaselineIds.add(id);
      baselineRows.push({ id });
    }
  }

  if (surfaceRows.length < 40) {
    errors.push(`expected at least 40 surface rows; found ${surfaceRows.length}`);
  }

  for (const baselineId of REQUIRED_BASELINES) {
    if (!baselineRows.some(({ id }) => id === baselineId)) {
      errors.push(`missing required baseline ${baselineId}`);
    }
  }

  const classCounts = countBy(
    surfaceRows.map(({ targetClass }) => targetClass),
    TARGET_CLASSES
  );
  const stateCounts = countBy(
    surfaceRows.map(({ state }) => state),
    REPORTING_STATES
  );
  const publishedClassCounts = parsePublishedTotals(text, TARGET_CLASSES, 'target-class', errors);
  const publishedStateCounts = parsePublishedTotals(text, REPORTING_STATES, 'state', errors);

  for (const targetClass of TARGET_CLASSES) {
    if (publishedClassCounts[targetClass] !== classCounts[targetClass]) {
      errors.push(
        `published target-class total for ${targetClass} is ${publishedClassCounts[targetClass]}; actual is ${classCounts[targetClass]}`
      );
    }
  }
  for (const state of REPORTING_STATES) {
    if (publishedStateCounts[state] !== stateCounts[state]) {
      errors.push(
        `published state total for ${state} is ${publishedStateCounts[state]}; actual is ${stateCounts[state]}`
      );
    }
  }

  for (const issue of REQUIRED_ISSUES) {
    const issueLink = `[${`#${issue}`}](https://github.com/Proto-UI/Proto-UI/issues/${issue})`;
    if (!text.includes(issueLink)) {
      errors.push(`missing required dependency reconciliation link ${issueLink}`);
    }
  }

  for (const match of text.matchAll(
    /\[#(\d+)\]\(https:\/\/github\.com\/Proto-UI\/Proto-UI\/issues\/(\d+)\)/gu
  )) {
    if (match[1] !== match[2]) {
      errors.push(`Issue link label #${match[1]} targets Issue #${match[2]}`);
    }
  }

  for (const match of text.matchAll(/\]\(((?:\.\.\/)+[^)#]+)(?:#[^)]*)?\)/gu)) {
    const relativePath = decodeURIComponent(match[1]);
    const absolutePath = resolve(dirname(MATRIX_PATH), relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(`missing local evidence link target: ${relativePath}`);
    }
  }

  return {
    baselineCount: baselineRows.length,
    classCounts,
    errors,
    stateCounts,
    surfaceCount: surfaceRows.length,
  };
}

async function main() {
  const text = await readFile(MATRIX_PATH, 'utf8');
  const result = validateMatrixText(text);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`[agent-harness-matrix] ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `[agent-harness-matrix] OK (${result.surfaceCount} surfaces, ${result.baselineCount} baselines)`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
