import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const END_MARKER = '<!-- coverage-matrix:end -->';

export const CONSUMER_MATRICES = Object.freeze([
  Object.freeze({
    kind: 'website',
    jsonPath: 'internal/website/self-hosting-coverage-matrix.json',
    markdownPath: 'internal/website/self-hosting-coverage-matrix.md',
    startMarker: '<!-- coverage-matrix:start website -->',
    stateOrder: Object.freeze([
      'self-hosted',
      'ready',
      'research',
      'blocked',
      'native/static',
      'infrastructure-exempt',
    ]),
    targetClassOrder: null,
    hasSourceBindings: true,
    wrapIdBackticks: true,
    wrapStateBackticks: true,
    wrapTargetClassBackticks: true,
  }),
  Object.freeze({
    kind: 'agent-harness',
    jsonPath: 'internal/agent-harness/dogfood-coverage-matrix.json',
    markdownPath: 'internal/agent-harness/dogfood-coverage-matrix.md',
    startMarker: '<!-- coverage-matrix:start agent-harness -->',
    stateOrder: Object.freeze([
      'dogfooded',
      'app-local-proto',
      'ready',
      'research',
      'blocked',
      'native/static',
      'infrastructure-exempt',
    ]),
    targetClassOrder: Object.freeze([
      'official-prototype',
      'composition',
      'app-local-proto',
      'native/static',
      'infrastructure-exempt',
    ]),
    hasSourceBindings: false,
    wrapIdBackticks: false,
    wrapStateBackticks: false,
    wrapTargetClassBackticks: false,
  }),
]);

export function parseMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const cells = [];
  let current = '';
  const inner = trimmed.slice(1, -1);
  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index] === '\\' && inner[index + 1] === '|') {
      current += '|';
      index += 1;
    } else if (inner[index] === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += inner[index];
    }
  }
  cells.push(current.trim());
  return cells;
}

export function stripInlineCode(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function escapeTableCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/gu, ' ')
    .replace(/(?<!\\)\|/gu, '\\|');
}

function isSeparatorCells(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

function findTableBlock(lines, startAt, predicate) {
  for (let i = startAt; i < lines.length; i += 1) {
    const cells = parseMarkdownRow(lines[i]);
    if (!cells) continue;
    if (predicate(cells, i)) {
      let end = i + 1;
      while (end < lines.length && parseMarkdownRow(lines[end])) end += 1;
      return { start: i, end, headers: cells };
    }
  }
  return null;
}

export function extractConsumerMatrixFromMarkdown(markdown, spec) {
  const lines = markdown.replace(/\r\n/gu, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();

  const startIdx = lines.indexOf(spec.startMarker);
  const endIdx = lines.indexOf(END_MARKER, startIdx + 1);
  if (startIdx < 0 || endIdx < 0) {
    throw new Error(`Missing coverage matrix markers in ${spec.markdownPath}`);
  }

  const mainTable = findTableBlock(lines, startIdx + 1, () => true);
  if (!mainTable || mainTable.end > endIdx) {
    throw new Error(`Could not locate main table in ${spec.markdownPath}`);
  }

  const headers = mainTable.headers;
  const rows = [];
  for (let i = mainTable.start + 1; i < mainTable.end; i += 1) {
    const cells = parseMarkdownRow(lines[i]);
    if (!cells || isSeparatorCells(cells)) continue;
    const row = {};
    for (let col = 0; col < headers.length; col += 1) {
      const header = headers[col];
      const raw = cells[col] ?? '';
      if (header === 'ID') row.id = stripInlineCode(raw);
      else if (header === 'State') row.state = stripInlineCode(raw);
      else if (header === 'Target class') row.targetClass = stripInlineCode(raw);
      else row[header] = raw;
    }
    rows.push(row);
  }

  const stateTotalsTable = findTableBlock(
    lines,
    endIdx + 1,
    (cells) => cells.length === 2 && cells[0] === 'State' && cells[1] === 'Count'
  );
  if (!stateTotalsTable) {
    throw new Error(`Could not locate State totals table in ${spec.markdownPath}`);
  }

  const preamble = lines.slice(0, startIdx).join('\n');
  const betweenEndAndStateTotals = lines.slice(endIdx + 1, stateTotalsTable.start).join('\n');

  let targetClassTotalsTable = null;
  let betweenStateAndTargetTotals = null;
  let afterTotalsStart = stateTotalsTable.end;

  if (spec.targetClassOrder) {
    targetClassTotalsTable = findTableBlock(
      lines,
      stateTotalsTable.end,
      (cells) => cells.length === 2 && cells[0] === 'Target class' && cells[1] === 'Count'
    );
    if (!targetClassTotalsTable) {
      throw new Error(`Could not locate Target-class totals table in ${spec.markdownPath}`);
    }
    betweenStateAndTargetTotals = lines
      .slice(stateTotalsTable.end, targetClassTotalsTable.start)
      .join('\n');
    afterTotalsStart = targetClassTotalsTable.end;
  }

  let sourceBindings = null;
  let beforeSourceBindings = null;
  let afterSourceBindings = null;
  let trailing = null;

  if (spec.hasSourceBindings) {
    const bindingsTable = findTableBlock(
      lines,
      afterTotalsStart,
      (cells) =>
        cells.length === 3 &&
        cells[0] === 'Interactive or integration source' &&
        cells[1] === 'Owning matrix row' &&
        cells[2] === 'Source SHA-256'
    );
    if (!bindingsTable) {
      throw new Error(`Could not locate Source-scan bindings table in ${spec.markdownPath}`);
    }
    beforeSourceBindings = lines.slice(afterTotalsStart, bindingsTable.start).join('\n');
    sourceBindings = [];
    for (let i = bindingsTable.start + 1; i < bindingsTable.end; i += 1) {
      const cells = parseMarkdownRow(lines[i]);
      if (!cells || isSeparatorCells(cells)) continue;
      sourceBindings.push({
        source: stripInlineCode(cells[0]),
        owningMatrixRow: cells[1],
        sourceSha256: stripInlineCode(cells[2]),
      });
    }
    afterSourceBindings = lines.slice(bindingsTable.end).join('\n');
  } else {
    trailing = lines.slice(afterTotalsStart).join('\n');
  }

  return {
    schemaVersion: 1,
    kind: spec.kind,
    outputPath: spec.markdownPath,
    startMarker: spec.startMarker,
    endMarker: END_MARKER,
    formatting: {
      wrapIdBackticks: spec.wrapIdBackticks,
      wrapStateBackticks: spec.wrapStateBackticks,
      wrapTargetClassBackticks: spec.wrapTargetClassBackticks,
    },
    headers,
    stateOrder: [...spec.stateOrder],
    ...(spec.targetClassOrder ? { targetClassOrder: [...spec.targetClassOrder] } : {}),
    rows,
    ...(sourceBindings ? { sourceBindings } : {}),
    sections: {
      preamble,
      betweenEndAndStateTotals,
      ...(betweenStateAndTargetTotals !== null ? { betweenStateAndTargetTotals } : {}),
      ...(beforeSourceBindings !== null ? { beforeSourceBindings } : {}),
      ...(afterSourceBindings !== null ? { afterSourceBindings } : {}),
      ...(trailing !== null ? { trailing } : {}),
    },
  };
}

export function computeCounts(rows, field, order) {
  const counts = Object.fromEntries(order.map((key) => [key, 0]));
  for (const row of rows) {
    const value = row[field];
    if (!(value in counts)) {
      throw new Error(`Row "${row.id}" has unexpected ${field} "${value}"`);
    }
    counts[value] += 1;
  }
  return counts;
}

export function validateConsumerMatrixData(data) {
  const errors = [];
  if (data?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!Array.isArray(data?.headers) || data.headers.length === 0)
    errors.push('headers must be a non-empty array');
  if (!Array.isArray(data?.rows) || data.rows.length === 0)
    errors.push('rows must be a non-empty array');
  if (!Array.isArray(data?.stateOrder) || data.stateOrder.length === 0)
    errors.push('stateOrder must be a non-empty array');
  if (errors.length > 0) return errors;

  const seenIds = new Set();
  const validStates = new Set(data.stateOrder);
  const validTargetClasses = Array.isArray(data.targetClassOrder)
    ? new Set(data.targetClassOrder)
    : null;

  for (const [index, row] of data.rows.entries()) {
    if (!row?.id || typeof row.id !== 'string') {
      errors.push(`rows[${index}]: missing string id`);
      continue;
    }
    if (seenIds.has(row.id)) errors.push(`duplicate row id "${row.id}"`);
    seenIds.add(row.id);
    if (!validStates.has(row.state)) {
      errors.push(`row "${row.id}": invalid state "${row.state}"`);
    }
    if (validTargetClasses && !validTargetClasses.has(row.targetClass)) {
      errors.push(`row "${row.id}": invalid targetClass "${row.targetClass}"`);
    }
    for (const header of data.headers) {
      if (header === 'ID' || header === 'State' || header === 'Target class') continue;
      if (typeof row[header] !== 'string') {
        errors.push(`row "${row.id}": missing string field "${header}"`);
      }
    }
  }

  if (data.sourceBindings !== undefined) {
    if (!Array.isArray(data.sourceBindings)) {
      errors.push('sourceBindings must be an array when present');
    } else {
      const seenSources = new Set();
      for (const [index, binding] of data.sourceBindings.entries()) {
        if (!binding?.source || typeof binding.source !== 'string') {
          errors.push(`sourceBindings[${index}]: missing source`);
          continue;
        }
        if (seenSources.has(binding.source)) {
          errors.push(`duplicate sourceBindings entry "${binding.source}"`);
        }
        seenSources.add(binding.source);
        if (!/^[a-f0-9]{64}$/u.test(binding.sourceSha256 ?? '')) {
          errors.push(`sourceBindings[${binding.source}]: invalid sha256`);
        }
      }
    }
  }

  return errors;
}

function renderTotalsTable(labelHeader, counts, order) {
  const labelWidth = Math.max(labelHeader.length, ...order.map((item) => item.length));
  const countWidth = Math.max('Count'.length, ...order.map((item) => String(counts[item]).length));
  const lines = [
    `| ${labelHeader.padEnd(labelWidth)} | ${'Count'.padEnd(countWidth)} |`,
    `| ${'-'.repeat(labelWidth)} | ${'-'.repeat(countWidth - 1)}: |`,
  ];
  for (const key of order) {
    lines.push(`| ${key.padEnd(labelWidth)} | ${String(counts[key]).padStart(countWidth)} |`);
  }
  return lines.join('\n');
}

export function renderConsumerMatrix(data) {
  const validationErrors = validateConsumerMatrixData(data);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid consumer matrix data:\n- ${validationErrors.join('\n- ')}`);
  }

  const fmt = data.formatting ?? {};
  const wrap = (value, enabled) => (enabled ? `\`${value}\`` : value);

  const mainLines = [
    `| ${data.headers.join(' | ')} |`,
    `| ${data.headers.map(() => '---').join(' | ')} |`,
  ];

  for (const row of data.rows) {
    const cells = data.headers.map((header) => {
      if (header === 'ID') return escapeTableCell(wrap(row.id, fmt.wrapIdBackticks));
      if (header === 'State') return escapeTableCell(wrap(row.state, fmt.wrapStateBackticks));
      if (header === 'Target class')
        return escapeTableCell(wrap(row.targetClass, fmt.wrapTargetClassBackticks));
      return escapeTableCell(row[header]);
    });
    mainLines.push(`| ${cells.join(' | ')} |`);
  }

  const stateCounts = computeCounts(data.rows, 'state', data.stateOrder);
  const stateTable = renderTotalsTable('State', stateCounts, data.stateOrder);

  const parts = [
    data.sections.preamble,
    data.startMarker,
    '',
    mainLines.join('\n'),
    '',
    data.endMarker,
    data.sections.betweenEndAndStateTotals,
    stateTable,
  ];

  if (Array.isArray(data.targetClassOrder)) {
    const targetClassCounts = computeCounts(data.rows, 'targetClass', data.targetClassOrder);
    const targetTable = renderTotalsTable('Target class', targetClassCounts, data.targetClassOrder);
    parts.push(data.sections.betweenStateAndTargetTotals, targetTable);
  }

  if (Array.isArray(data.sourceBindings)) {
    const bindingLines = [
      '| Interactive or integration source | Owning matrix row | Source SHA-256 |',
      '| --- | --- | --- |',
      ...data.sourceBindings.map(
        (b) =>
          `| \`${escapeTableCell(b.source)}\` | ${escapeTableCell(b.owningMatrixRow)} | \`${escapeTableCell(b.sourceSha256)}\` |`
      ),
    ];
    parts.push(
      data.sections.beforeSourceBindings,
      bindingLines.join('\n'),
      data.sections.afterSourceBindings
    );
  } else {
    parts.push(data.sections.trailing);
  }

  return parts.join('\n') + '\n';
}

export function runConsumerMatricesCli(argv = process.argv.slice(2), root = DEFAULT_ROOT) {
  const mode = argv.includes('--extract')
    ? 'extract'
    : argv.includes('--write')
      ? 'write'
      : 'check';
  const errors = [];
  const summary = [];

  for (const spec of CONSUMER_MATRICES) {
    const jsonAbs = path.join(root, spec.jsonPath);
    const mdAbs = path.join(root, spec.markdownPath);

    if (mode === 'extract') {
      const markdown = fs.readFileSync(mdAbs, 'utf8');
      const data = extractConsumerMatrixFromMarkdown(markdown, spec);
      fs.writeFileSync(jsonAbs, JSON.stringify(data, null, 2) + '\n', 'utf8');
      summary.push(`${spec.kind}: extracted ${data.rows.length} rows -> ${spec.jsonPath}`);
      continue;
    }

    if (!fs.existsSync(jsonAbs)) {
      errors.push(`${spec.jsonPath}: missing canonical JSON source`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(jsonAbs, 'utf8'));
    const validationErrors = validateConsumerMatrixData(data);
    if (validationErrors.length > 0) {
      errors.push(...validationErrors.map((msg) => `${spec.jsonPath}: ${msg}`));
      continue;
    }

    const rendered = renderConsumerMatrix(data);
    if (mode === 'write') {
      fs.writeFileSync(mdAbs, rendered, 'utf8');
      summary.push(`${spec.kind}: rendered ${data.rows.length} rows -> ${spec.markdownPath}`);
    } else {
      const actual = fs.existsSync(mdAbs) ? fs.readFileSync(mdAbs, 'utf8') : '';
      if (actual !== rendered) {
        errors.push(
          `${spec.markdownPath}: drifted from canonical JSON source ${spec.jsonPath}; run \`corepack pnpm@10.32.1 coverage:matrices:render\` after editing the JSON source.`
        );
      } else {
        summary.push(`${spec.kind}: OK (${data.rows.length} rows synced with ${spec.jsonPath})`);
      }
    }
  }

  return { ok: errors.length === 0, errors, summary };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = runConsumerMatricesCli(process.argv.slice(2));
  if (!result.ok) {
    console.error(`[consumer-matrices] Failed:\n- ${result.errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`[consumer-matrices] ${result.summary.join('; ')}`);
  }
}
