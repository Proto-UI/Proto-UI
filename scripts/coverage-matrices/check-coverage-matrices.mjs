import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TOTAL_HEADERS = ['State', 'Count'];
const TARGET_CLASS_TOTAL_HEADERS = ['Target class', 'Count'];
const END_MARKER = '<!-- coverage-matrix:end -->';
const CATALOG_ID_PATTERN = /\b(?:P|T|M|HC|A|D)-[A-Z0-9]+(?:[.-][A-Z0-9]+)*\b/g;
const INTERACTIVE_SOURCE_PATTERN =
  /<script\b|\baddEventListener\s*\(|\bcustomElements\.define\s*\(|\b(?:Intersection|Mutation|Resize)Observer\s*\(|\bon(?:click|keydown|keyup|pointerdown|pointerup|change|input)\s*=/;

const WEBSITE_HEADERS = [
  'ID',
  'Path',
  'User job',
  'Current owner',
  'Target class',
  'Proto UI chain',
  'Lifecycle',
  'WC host and SSR/no-JS strategy',
  'Dependency and owner',
  'Difficulty',
  'Milestone',
  'State',
  'Evidence',
  'Escape or exemption',
  'Re-review or removal issue',
];

const AGENT_HARNESS_HEADERS = [
  'ID',
  'Path',
  'User job',
  'Current owner',
  'Target owner',
  'Target class',
  'Proto UI chain',
  'App state and semantic events',
  'Production host and equivalence evidence',
  'Dependency and owner',
  'Difficulty',
  'Milestone',
  'State',
  'Evidence',
  'Escape or exemption',
  'Re-review or removal issue',
];

export const MATRIX_CONFIGS = Object.freeze([
  Object.freeze({
    kind: 'website',
    relativePath: 'internal/website/self-hosting-coverage-matrix.md',
    startMarker: '<!-- coverage-matrix:start website -->',
    headers: WEBSITE_HEADERS,
    idPattern: /^www\.[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/,
    idExample: 'www.shell.search',
    allowedTargetClasses: [
      'official-prototype',
      'site-composition',
      'native/static',
      'infrastructure-exempt',
    ],
    allowedStates: [
      'self-hosted',
      'ready',
      'research',
      'blocked',
      'native/static',
      'infrastructure-exempt',
    ],
    ownerHeaders: ['Current owner', 'Dependency and owner'],
    existingPathHeaders: ['Path', 'Evidence'],
    requiredIds: ['www.shell.primary-nav', 'www.icons.static-lucide'],
    inheritedSurfaceManifests: Object.freeze([
      Object.freeze({
        source: '@astrojs/starlight@0.35.3',
        ids: Object.freeze([
          'www.shell.skip-link',
          'www.shell.mobile-menu-toggle',
          'www.shell.mobile-menu-panel',
          'www.shell.mobile-theme-select',
          'www.shell.sidebar-navigation',
          'www.shell.mobile-table-of-contents',
          'www.shell.footer',
          'www.shell.pagination',
          'www.content.draft-notice',
        ]),
      }),
      Object.freeze({
        source: '@expressive-code/core@0.41.7 and @expressive-code/plugin-frames@0.41.7',
        ids: Object.freeze([
          'www.docs.expressive-code-copy-feedback',
          'www.docs.expressive-code-scroll-focus',
        ]),
      }),
    ]),
    classStateRequirements: {
      'native/static': 'native/static',
      'infrastructure-exempt': 'infrastructure-exempt',
    },
    exemptTargetClasses: ['native/static', 'infrastructure-exempt'],
    exemptStates: ['native/static', 'infrastructure-exempt'],
  }),
  Object.freeze({
    kind: 'agent-harness',
    relativePath: 'internal/agent-harness/dogfood-coverage-matrix.md',
    startMarker: '<!-- coverage-matrix:start agent-harness -->',
    headers: AGENT_HARNESS_HEADERS,
    idPattern: /^harness\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/,
    idExample: 'harness.transcript.viewport',
    allowedTargetClasses: [
      'official-prototype',
      'composition',
      'app-local-proto',
      'native/static',
      'infrastructure-exempt',
    ],
    allowedStates: [
      'dogfooded',
      'app-local-proto',
      'ready',
      'research',
      'blocked',
      'native/static',
      'infrastructure-exempt',
    ],
    ownerHeaders: ['Current owner', 'Target owner', 'Dependency and owner'],
    requiredIds: [
      'harness.shell.frame',
      'harness.sessions.list',
      'harness.sessions.grouped-tree',
      'harness.sessions.selection',
      'harness.workspace.branch-checkpoints',
    ],
    classStateRequirements: {
      'native/static': 'native/static',
      'infrastructure-exempt': 'infrastructure-exempt',
    },
    exemptTargetClasses: ['native/static', 'infrastructure-exempt'],
    exemptStates: ['native/static', 'infrastructure-exempt'],
  }),
]);

export class CoverageMatrixValidationError extends Error {
  constructor(issues) {
    super(
      `Coverage matrix validation failed with ${issues.length} issue${issues.length === 1 ? '' : 's'}:\n${issues
        .map((issue) => `- ${issue}`)
        .join('\n')}`
    );
    this.name = 'CoverageMatrixValidationError';
    this.issues = issues;
  }
}

function parseMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  const cells = [];
  let current = '';
  const inner = trimmed.slice(1, -1);
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index];
    if (character === '\\' && inner[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (character === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  return cells;
}

function stripInlineCode(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 1) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isMeaningful(value) {
  const normalized = stripInlineCode(value)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim()
    .toLowerCase();
  return ![
    '',
    '-',
    '—',
    '–',
    'none',
    'n/a',
    'na',
    'not applicable',
    'tbd',
    'todo',
    'unknown',
    'unclassified',
  ].includes(normalized);
}

function findExactLineIndexes(lines, expected) {
  const indexes = [];
  lines.forEach((line, index) => {
    if (line.trim() === expected) indexes.push(index);
  });
  return indexes;
}

function formatHeaders(headers) {
  return `| ${headers.join(' | ')} |`;
}

function parseTable(lines, fromIndex, toIndex, expectedHeaders, label, issues) {
  let headerIndex = -1;
  for (let index = fromIndex; index < toIndex; index += 1) {
    if (lines[index].trim().startsWith('|')) {
      headerIndex = index;
      break;
    }
  }

  if (headerIndex === -1) {
    issues.push(
      `${label}: missing Markdown table; expected header ${formatHeaders(expectedHeaders)}`
    );
    return null;
  }

  const headers = parseMarkdownRow(lines[headerIndex]);
  if (!headers || headers.length !== expectedHeaders.length) {
    issues.push(`${label}: malformed header; expected exactly ${formatHeaders(expectedHeaders)}`);
    return null;
  }
  if (headers.some((header, index) => header !== expectedHeaders[index])) {
    issues.push(
      `${label}: header mismatch; expected exactly ${formatHeaders(expectedHeaders)}, received ${formatHeaders(headers)}`
    );
  }

  const separator = parseMarkdownRow(lines[headerIndex + 1] ?? '');
  if (
    !separator ||
    separator.length !== headers.length ||
    separator.some((cell) => !/^:?-{3,}:?$/.test(cell))
  ) {
    issues.push(
      `${label}: header must be followed by a ${headers.length}-column Markdown separator row`
    );
    return null;
  }

  const rows = [];
  for (let index = headerIndex + 2; index < toIndex; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      if (rows.length > 0) break;
      continue;
    }
    if (!line.trim().startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    const cells = parseMarkdownRow(line);
    if (!cells || cells.length !== expectedHeaders.length) {
      issues.push(
        `${label}: line ${index + 1} has ${cells?.length ?? 0} columns; expected ${expectedHeaders.length}. Escape literal pipes as \\|.`
      );
      continue;
    }
    rows.push({ line: index + 1, cells });
  }

  if (rows.length === 0) issues.push(`${label}: matrix must contain at least one data row`);
  return { headers, rows };
}

function rowRecord(headers, cells) {
  return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
}

function includesIssue(value) {
  return /(^|\D)#\d+\b/.test(value);
}

function includesForbiddenClassification(value) {
  return /\b(?:unknown|unclassified)\b/i.test(value);
}

function explicitRepositoryPaths(value) {
  const paths = [];
  for (const match of value.matchAll(/`([^`\r\n]+)`/g)) {
    const candidate = match[1].trim().replaceAll('\\', '/');
    if (!/^(?:apps|packages|scripts|spec|internal)\//.test(candidate)) continue;
    if (/[?*{}\[\]]/.test(candidate) || candidate.split('/').includes('..')) continue;
    paths.push(candidate);
  }
  return paths;
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

function loadCatalogEntries(rootDir) {
  const entries = new Map();
  for (const absolutePath of walkFiles(path.join(rootDir, 'spec'))) {
    if (!absolutePath.endsWith('.yaml')) continue;
    const content = fs.readFileSync(absolutePath, 'utf8');
    const id = content.match(/^id:\s*([^\s#]+)\s*$/m)?.[1];
    const status = content.match(/^status:\s*([^\s#]+)\s*$/m)?.[1];
    if (id && status) entries.set(id, { absolutePath, status });
  }
  return entries;
}

function sourceTextForInteractionScan(absolutePath) {
  const content = fs.readFileSync(absolutePath, 'utf8');
  if (!/\.mdx?$/.test(absolutePath)) return content;
  // Documentation examples contain literal event-listener snippets. They are
  // authored text, not website state machines; real MDX script/handler markup
  // remains visible after fenced code is removed.
  return content.replace(/^\s*```[^\r\n]*[\r\n][\s\S]*?^\s*```\s*$/gm, '');
}

function discoverWebsiteInteractiveSources(rootDir) {
  const sourceRoot = path.join(rootDir, 'apps', 'www', 'src');
  const contentRoot = path.join(sourceRoot, 'content', 'docs');
  return walkFiles(sourceRoot)
    .filter((absolutePath) => /\.(?:astro|[cm]?[jt]sx?)$/.test(absolutePath))
    .filter((absolutePath) => !absolutePath.startsWith(`${contentRoot}${path.sep}`))
    .concat(walkFiles(contentRoot).filter((absolutePath) => /\.mdx?$/.test(absolutePath)))
    .filter(
      (absolutePath, index, files) =>
        files.indexOf(absolutePath) === index &&
        !/\.(?:test|browser\.test|demo)\.[cm]?[jt]sx?$/.test(absolutePath)
    )
    .filter((absolutePath) =>
      INTERACTIVE_SOURCE_PATTERN.test(sourceTextForInteractionScan(absolutePath))
    )
    .map((absolutePath) => path.relative(rootDir, absolutePath).replaceAll('\\', '/'))
    .sort();
}

function requireLabels(value, labels, context, issues) {
  for (const label of labels) {
    if (!value.includes(label)) {
      issues.push(`${context}: missing required \`${label}\` label`);
    }
  }
}

function validateMainRows(config, table, relativePath, rootDir, catalogEntries, issues) {
  if (!table) {
    return {
      stateCounts: new Map(),
      targetClassCounts: new Map(),
      seenIds: new Map(),
      sourceOwners: new Map(),
    };
  }
  const seenIds = new Map();
  const stateCounts = new Map(config.allowedStates.map((state) => [state, 0]));
  const targetClassCounts = new Map(
    config.allowedTargetClasses.map((targetClass) => [targetClass, 0])
  );
  const sourceOwners = new Map();

  for (const row of table.rows) {
    const record = rowRecord(config.headers, row.cells);
    const context = `${relativePath}:${row.line}`;
    const id = stripInlineCode(record.ID);
    const targetClass = stripInlineCode(record['Target class']);
    const state = stripInlineCode(record.State);
    const recordText = Object.values(record).join(' ');

    for (const [header, value] of Object.entries(record)) {
      if (!value.trim()) issues.push(`${context}: ${header} must not be empty`);
      if (includesForbiddenClassification(value)) {
        issues.push(`${context}: ${header} must not contain unknown or unclassified`);
      }
    }

    if (!config.idPattern.test(id)) {
      issues.push(`${context}: unstable ID \`${id}\`; expected the form \`${config.idExample}\``);
    }
    if (seenIds.has(id)) {
      issues.push(`${context}: duplicate ID \`${id}\` (first declared on line ${seenIds.get(id)})`);
    } else {
      seenIds.set(id, row.line);
    }

    if (!config.allowedTargetClasses.includes(targetClass)) {
      issues.push(
        `${context}: unsupported Target class \`${targetClass}\`; allowed: ${config.allowedTargetClasses.join(', ')}`
      );
    } else {
      targetClassCounts.set(targetClass, (targetClassCounts.get(targetClass) ?? 0) + 1);
    }
    if (!config.allowedStates.includes(state)) {
      issues.push(
        `${context}: unsupported State \`${state}\`; allowed: ${config.allowedStates.join(', ')}`
      );
    } else {
      stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
    }

    const requiredState = config.classStateRequirements?.[targetClass];
    if (requiredState && state !== requiredState) {
      issues.push(
        `${context}: Target class \`${targetClass}\` requires State \`${requiredState}\`, received \`${state}\``
      );
    }

    if (config.kind === 'website') {
      for (const repositoryPath of explicitRepositoryPaths(record.Path)) {
        if (!repositoryPath.startsWith('apps/www/src/')) continue;
        const owners = sourceOwners.get(repositoryPath) ?? [];
        owners.push({ id, line: row.line });
        sourceOwners.set(repositoryPath, owners);
      }
    }

    for (const header of config.existingPathHeaders ?? []) {
      for (const repositoryPath of explicitRepositoryPaths(record[header])) {
        if (!fs.existsSync(path.resolve(rootDir, repositoryPath))) {
          issues.push(
            `${context}: ${header} references missing repository path \`${repositoryPath}\``
          );
        }
      }
    }

    const referencedIds = [...new Set(recordText.match(CATALOG_ID_PATTERN) ?? [])];
    for (const entityId of referencedIds) {
      if (!catalogEntries.has(entityId)) {
        issues.push(`${context}: references uncataloged entity ID \`${entityId}\``);
      }
    }

    const lifecycleText = config.kind === 'website' ? record.Lifecycle : record['Proto UI chain'];
    const chainIds = [...new Set(record['Proto UI chain'].match(CATALOG_ID_PATTERN) ?? [])];
    const referencedStatuses = new Set(
      chainIds.map((entityId) => catalogEntries.get(entityId)?.status).filter(Boolean)
    );
    for (const catalogStatus of referencedStatuses) {
      if (!new RegExp(`\\b${catalogStatus}\\b`, 'i').test(lifecycleText)) {
        issues.push(
          `${context}: ${config.kind === 'website' ? 'Lifecycle' : 'Proto UI chain'} must report catalog status \`${catalogStatus}\` for referenced entities`
        );
      }
    }

    for (const header of config.ownerHeaders) {
      if (!isMeaningful(record[header])) issues.push(`${context}: ${header} must name an owner`);
    }
    if (!isMeaningful(record.Evidence)) {
      issues.push(`${context}: Evidence must name a baseline, executable check, or evidence path`);
    }

    if (
      (state === 'blocked' || state === 'research') &&
      !includesIssue(record['Dependency and owner'])
    ) {
      issues.push(
        `${context}: ${state} rows must link a dependency as #<issue> in Dependency and owner`
      );
    }

    const exemptLike =
      config.exemptTargetClasses.includes(targetClass) || config.exemptStates.includes(state);
    const escapeOrExemption = record['Escape or exemption'];
    const reReviewOrRemoval = record['Re-review or removal issue'];
    if (exemptLike) {
      if (!isMeaningful(escapeOrExemption)) {
        issues.push(`${context}: exempt/native rows must state a reason in Escape or exemption`);
      }
      if (!isMeaningful(reReviewOrRemoval)) {
        issues.push(
          `${context}: exempt/native rows must state a re-review trigger in Re-review or removal issue`
        );
      }
    } else if (isMeaningful(escapeOrExemption) && !includesIssue(reReviewOrRemoval)) {
      issues.push(`${context}: temporary escapes must link their removal as #<issue>`);
    }

    if (config.kind === 'website') {
      requireLabels(
        record['WC host and SSR/no-JS strategy'],
        ['WC:', 'SSR:', 'no-JS:'],
        `${context}: WC host and SSR/no-JS strategy`,
        issues
      );
    } else {
      requireLabels(
        record['App state and semantic events'],
        ['App state:', 'Events:'],
        `${context}: App state and semantic events`,
        issues
      );
      requireLabels(
        record['Production host and equivalence evidence'],
        ['Host:', 'WC:', 'React:', 'Vue:'],
        `${context}: Production host and equivalence evidence`,
        issues
      );
    }
  }

  const inheritedIds = new Map(
    (config.inheritedSurfaceManifests ?? []).flatMap((manifest) =>
      manifest.ids.map((id) => [id, manifest.source])
    )
  );
  for (const requiredId of [...(config.requiredIds ?? []), ...inheritedIds.keys()]) {
    if (!seenIds.has(requiredId)) {
      const inheritedSource = inheritedIds.has(requiredId)
        ? ` from inherited manifest ${inheritedIds.get(requiredId)}`
        : '';
      issues.push(
        `${relativePath}: required inventory surface ID \`${requiredId}\` is missing${inheritedSource}`
      );
    }
  }

  return { stateCounts, targetClassCounts, seenIds, sourceOwners };
}

function parseSourceBindings(lines, afterIndex, relativePath, issues) {
  const headingIndexes = findExactLineIndexes(lines, '## Source-scan bindings').filter(
    (index) => index > afterIndex
  );
  if (headingIndexes.length === 0) return new Map();
  if (headingIndexes.length !== 1) {
    issues.push(
      `${relativePath}: expected at most one \`## Source-scan bindings\` heading after ${END_MARKER}; found ${headingIndexes.length}`
    );
    return new Map();
  }

  const headingIndex = headingIndexes[0];
  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
  const tableEnd = nextHeadingOffset === -1 ? lines.length : headingIndex + 1 + nextHeadingOffset;
  const table = parseTable(
    lines,
    headingIndex + 1,
    tableEnd,
    ['Interactive or integration source', 'Owning matrix row'],
    `${relativePath} Source-scan bindings`,
    issues
  );
  const bindings = new Map();
  if (!table) return bindings;

  for (const row of table.rows) {
    const context = `${relativePath}:${row.line}`;
    const sourcePaths = explicitRepositoryPaths(row.cells[0]);
    if (sourcePaths.length !== 1 || !sourcePaths[0].startsWith('apps/www/src/')) {
      issues.push(`${context}: source binding must name exactly one \`apps/www/src/**\` path`);
      continue;
    }
    const sourcePath = sourcePaths[0];
    if (bindings.has(sourcePath)) {
      issues.push(
        `${context}: duplicate source binding for \`${sourcePath}\` (first declared on line ${bindings.get(sourcePath).line})`
      );
      continue;
    }
    const ownerIds = [...row.cells[1].matchAll(/`(www\.[a-z0-9.-]+)`/g)].map((match) => match[1]);
    if (ownerIds.length === 0) {
      issues.push(`${context}: source binding must name at least one owning matrix row ID`);
      continue;
    }
    bindings.set(sourcePath, { line: row.line, ownerIds: [...new Set(ownerIds)] });
  }
  return bindings;
}

function validateWebsiteSourceBindings(
  rootDir,
  relativePath,
  lines,
  afterIndex,
  matrixResult,
  issues
) {
  const bindings = parseSourceBindings(lines, afterIndex, relativePath, issues);
  for (const [sourcePath, binding] of bindings) {
    if (!fs.existsSync(path.resolve(rootDir, sourcePath))) {
      issues.push(
        `${relativePath}:${binding.line}: source binding references missing path \`${sourcePath}\``
      );
    }
    for (const ownerId of binding.ownerIds) {
      if (!matrixResult.seenIds.has(ownerId)) {
        issues.push(
          `${relativePath}:${binding.line}: source binding references missing matrix row \`${ownerId}\``
        );
      }
    }
  }

  for (const sourcePath of discoverWebsiteInteractiveSources(rootDir)) {
    const directOwners = matrixResult.sourceOwners.get(sourcePath) ?? [];
    const binding = bindings.get(sourcePath);
    if (directOwners.length === 0 && !binding) {
      issues.push(
        `${relativePath}: interactive website source \`${sourcePath}\` is not bound to a matrix row`
      );
      continue;
    }

    if (directOwners.length === 1 && binding) {
      issues.push(
        `${relativePath}: interactive website source \`${sourcePath}\` is already owned by matrix row \`${directOwners[0].id}\`; use the direct Path or the explicit binding, not both`
      );
      continue;
    }

    if (directOwners.length > 1) {
      if (!binding) {
        const directSummary = directOwners.map(({ id }) => `\`${id}\``).join(', ');
        issues.push(
          `${relativePath}: interactive website source \`${sourcePath}\` appears in multiple matrix Path cells (${directSummary}); add one explicit grouped binding naming exactly those rows`
        );
        continue;
      }
      const directIds = [...new Set(directOwners.map(({ id }) => id))].sort();
      const boundIds = [...binding.ownerIds].sort();
      if (
        directIds.length !== boundIds.length ||
        directIds.some((ownerId, index) => ownerId !== boundIds[index])
      ) {
        issues.push(
          `${relativePath}:${binding.line}: grouped binding for \`${sourcePath}\` must name exactly the matrix Path owners (${directIds.join(', ')})`
        );
      }
    }
  }
}

function validateTotals(config, lines, afterIndex, actualCounts, relativePath, issues) {
  const totalHeadingIndexes = findExactLineIndexes(lines, '## State totals').filter(
    (index) => index > afterIndex
  );
  if (totalHeadingIndexes.length !== 1) {
    issues.push(
      `${relativePath}: expected exactly one \`## State totals\` heading after ${END_MARKER}; found ${totalHeadingIndexes.length}`
    );
    return;
  }

  const headingIndex = totalHeadingIndexes[0];
  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
  const tableEnd = nextHeadingOffset === -1 ? lines.length : headingIndex + 1 + nextHeadingOffset;
  const totalsTable = parseTable(
    lines,
    headingIndex + 1,
    tableEnd,
    TOTAL_HEADERS,
    `${relativePath} State totals`,
    issues
  );
  if (!totalsTable) return;

  const declaredCounts = new Map();
  let declaredTotal = null;
  for (const row of totalsTable.rows) {
    const [rawState, rawCount] = row.cells;
    const state = stripInlineCode(rawState);
    const context = `${relativePath}:${row.line}`;
    if (state === 'Total') {
      if (declaredTotal !== null) {
        issues.push(`${context}: duplicate totals row for \`Total\``);
        continue;
      }
      if (!/^\d+$/.test(rawCount.trim())) {
        issues.push(`${context}: Count must be a non-negative integer, received \`${rawCount}\``);
        continue;
      }
      declaredTotal = Number.parseInt(rawCount, 10);
      continue;
    }
    if (!config.allowedStates.includes(state)) {
      issues.push(
        `${context}: unsupported totals State \`${state}\`; allowed: ${config.allowedStates.join(', ')}`
      );
      continue;
    }
    if (declaredCounts.has(state)) {
      issues.push(`${context}: duplicate totals row for State \`${state}\``);
      continue;
    }
    if (!/^\d+$/.test(rawCount.trim())) {
      issues.push(`${context}: Count must be a non-negative integer, received \`${rawCount}\``);
      continue;
    }
    declaredCounts.set(state, Number.parseInt(rawCount, 10));
  }

  for (const state of config.allowedStates) {
    if (!declaredCounts.has(state)) {
      issues.push(`${relativePath}: State totals is missing \`${state}\``);
      continue;
    }
    const declared = declaredCounts.get(state);
    const actual = actualCounts.get(state) ?? 0;
    if (declared !== actual) {
      issues.push(
        `${relativePath}: State totals declares ${state}=${declared}, but the matrix contains ${actual}`
      );
    }
  }

  if (declaredTotal !== null) {
    const actualTotal = [...actualCounts.values()].reduce((sum, count) => sum + count, 0);
    if (declaredTotal !== actualTotal) {
      issues.push(
        `${relativePath}: State totals declares Total=${declaredTotal}, but the matrix contains ${actualTotal} rows`
      );
    }
  }
}

function validateTargetClassTotals(config, lines, afterIndex, actualCounts, relativePath, issues) {
  const headingIndexes = findExactLineIndexes(lines, '## Target-class totals').filter(
    (index) => index > afterIndex
  );
  if (headingIndexes.length !== 1) {
    issues.push(
      `${relativePath}: expected exactly one \`## Target-class totals\` heading after ${END_MARKER}; found ${headingIndexes.length}`
    );
    return;
  }

  const headingIndex = headingIndexes[0];
  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => /^#{1,6}\s+/.test(line.trim()));
  const tableEnd = nextHeadingOffset === -1 ? lines.length : headingIndex + 1 + nextHeadingOffset;
  const totalsTable = parseTable(
    lines,
    headingIndex + 1,
    tableEnd,
    TARGET_CLASS_TOTAL_HEADERS,
    `${relativePath} Target-class totals`,
    issues
  );
  if (!totalsTable) return;

  const declaredCounts = new Map();
  for (const row of totalsTable.rows) {
    const [rawTargetClass, rawCount] = row.cells;
    const targetClass = stripInlineCode(rawTargetClass);
    const context = `${relativePath}:${row.line}`;
    if (!config.allowedTargetClasses.includes(targetClass)) {
      issues.push(
        `${context}: unsupported totals Target class \`${targetClass}\`; allowed: ${config.allowedTargetClasses.join(', ')}`
      );
      continue;
    }
    if (declaredCounts.has(targetClass)) {
      issues.push(`${context}: duplicate totals row for Target class \`${targetClass}\``);
      continue;
    }
    if (!/^\d+$/.test(rawCount.trim())) {
      issues.push(`${context}: Count must be a non-negative integer, received \`${rawCount}\``);
      continue;
    }
    declaredCounts.set(targetClass, Number.parseInt(rawCount, 10));
  }

  for (const targetClass of config.allowedTargetClasses) {
    if (!declaredCounts.has(targetClass)) {
      issues.push(`${relativePath}: Target-class totals is missing \`${targetClass}\``);
      continue;
    }
    const declared = declaredCounts.get(targetClass);
    const actual = actualCounts.get(targetClass) ?? 0;
    if (declared !== actual) {
      issues.push(
        `${relativePath}: Target-class totals declares ${targetClass}=${declared}, but the matrix contains ${actual}`
      );
    }
  }
}

function validateMatrixFile(rootDir, config, catalogEntries, issues) {
  const absolutePath = path.join(rootDir, config.relativePath);
  if (!fs.existsSync(absolutePath)) {
    issues.push(
      `${config.relativePath}: file is missing; create it with ${config.startMarker}, the exact matrix table, ${END_MARKER}, and a ## State totals table`
    );
    return;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const starts = findExactLineIndexes(lines, config.startMarker);
  const ends = findExactLineIndexes(lines, END_MARKER);
  if (starts.length !== 1) {
    issues.push(
      `${config.relativePath}: expected exactly one ${config.startMarker}; found ${starts.length}`
    );
    return;
  }
  const endIndexes = ends.filter((index) => index > starts[0]);
  if (endIndexes.length !== 1) {
    issues.push(
      `${config.relativePath}: expected exactly one ${END_MARKER} after ${config.startMarker}; found ${endIndexes.length}`
    );
    return;
  }

  const endIndex = endIndexes[0];
  const table = parseTable(
    lines,
    starts[0] + 1,
    endIndex,
    config.headers,
    `${config.relativePath} ${config.kind} matrix`,
    issues
  );
  const matrixResult = validateMainRows(
    config,
    table,
    config.relativePath,
    rootDir,
    catalogEntries,
    issues
  );
  validateTotals(config, lines, endIndex, matrixResult.stateCounts, config.relativePath, issues);
  if (config.kind === 'agent-harness') {
    validateTargetClassTotals(
      config,
      lines,
      endIndex,
      matrixResult.targetClassCounts,
      config.relativePath,
      issues
    );
  } else {
    validateWebsiteSourceBindings(
      rootDir,
      config.relativePath,
      lines,
      endIndex,
      matrixResult,
      issues
    );
  }
}

export function collectCoverageMatrixIssues({ rootDir = process.cwd() } = {}) {
  const issues = [];
  const catalogEntries = loadCatalogEntries(rootDir);
  for (const config of MATRIX_CONFIGS) {
    validateMatrixFile(rootDir, config, catalogEntries, issues);
  }
  return issues;
}

export function validateCoverageMatrices(options = {}) {
  const issues = collectCoverageMatrixIssues(options);
  if (issues.length > 0) throw new CoverageMatrixValidationError(issues);
  return { matrixCount: MATRIX_CONFIGS.length };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const result = validateCoverageMatrices();
    console.log(`[coverage-matrices] OK (${result.matrixCount} matrices)`);
  } catch (error) {
    if (error instanceof CoverageMatrixValidationError) {
      console.error(`[coverage-matrices] ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
