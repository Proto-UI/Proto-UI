import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_SOURCE = 'internal/issues/v0-good-first-issues.json';

const LABELS = {
  'good first issue': {
    color: '7057ff',
    description: 'Small, well-scoped issue suitable for a new contributor',
  },
  'help wanted': {
    color: '008672',
    description: 'Maintainers welcome external contributions',
  },
  'v0 launch': {
    color: '1d76db',
    description: 'Useful before or shortly after the v0 launch',
  },
  prototype: {
    color: 'c5def5',
    description: 'Prototype library work',
  },
  adapter: {
    color: 'bfdadc',
    description: 'Adapter or host integration work',
  },
  docs: {
    color: '0075ca',
    description: 'Documentation work',
  },
  whitepaper: {
    color: '5319e7',
    description: 'Whitepaper or conceptual documentation',
  },
  community: {
    color: 'd4c5f9',
    description: 'Community, education, or outreach work',
  },
  automation: {
    color: 'fbca04',
    description: 'Repository automation',
  },
  spike: {
    color: 'fef2c0',
    description: 'Research or feasibility spike',
  },
};

function printHelp() {
  console.log(`Usage: node scripts/issues/publish-good-first-issues.mjs [options]

Options:
  --source <path>          Issue seed JSON, defaults to ${DEFAULT_SOURCE}
  --repo <owner/name>      GitHub repository, inferred from git remote when possible
  --dry-run                Print the planned issues without creating them (default)
  --publish                Create missing labels and issues through GitHub CLI
  --limit <n>              Only process the first n issues after filtering
  --category <name>        Only process issues in one category
  --only <ids>             Comma-separated issue ids to process
  --allow-duplicates       Do not skip an issue when the same title already exists
  --json                   Print the selected issue payload as JSON in dry-run mode
`);
}

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    publish: false,
    dryRun: false,
    allowDuplicates: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--source') args.source = requireValue(argv, ++index, arg);
    else if (arg === '--repo') args.repo = requireValue(argv, ++index, arg);
    else if (arg === '--publish') args.publish = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--limit') args.limit = Number(requireValue(argv, ++index, arg));
    else if (arg === '--category') args.category = requireValue(argv, ++index, arg);
    else if (arg === '--only') args.only = new Set(requireValue(argv, ++index, arg).split(','));
    else if (arg === '--allow-duplicates') args.allowDuplicates = true;
    else if (arg === '--json') args.json = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!args.publish) args.dryRun = true;
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  return args;
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function loadSeed(source) {
  const sourcePath = resolve(ROOT_DIR, source);
  if (!existsSync(sourcePath)) {
    throw new Error(`Issue seed file not found: ${sourcePath}`);
  }
  const seed = JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (!Array.isArray(seed.issues)) {
    throw new Error('Issue seed must include an issues array');
  }
  for (const issue of seed.issues) {
    validateIssue(issue);
  }
  return seed;
}

function validateIssue(issue) {
  const requiredStrings = ['id', 'category', 'title', 'summary'];
  for (const key of requiredStrings) {
    if (typeof issue[key] !== 'string' || issue[key].trim() === '') {
      throw new Error(`Issue is missing required string field: ${key}`);
    }
  }
  for (const key of ['scope', 'acceptance', 'references', 'outOfScope']) {
    if (!Array.isArray(issue[key]) || issue[key].length === 0) {
      throw new Error(`Issue ${issue.id} is missing non-empty array field: ${key}`);
    }
  }
}

function selectIssues(seed, args) {
  let issues = seed.issues;
  if (args.category) {
    issues = issues.filter((issue) => issue.category === args.category);
  }
  if (args.only) {
    issues = issues.filter((issue) => args.only.has(issue.id));
  }
  if (args.limit) {
    issues = issues.slice(0, args.limit);
  }
  return issues.map((issue) => ({
    ...issue,
    labels: unique([...(seed.defaultLabels ?? []), ...(issue.labels ?? [])]),
  }));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function renderIssueBody(issue, seed) {
  const lines = [
    `Campaign: ${seed.campaign ?? 'good-first-issues'}`,
    `Seed id: \`${issue.id}\``,
    '',
    '## Summary',
    '',
    issue.summary,
    '',
    '## Scope',
    '',
    ...issue.scope.map((item) => `- ${item}`),
    '',
    '## Acceptance criteria',
    '',
    ...issue.acceptance.map((item) => `- [ ] ${item}`),
    '',
    '## References',
    '',
    ...issue.references.map((item) => `- \`${item}\``),
    '',
    '## Out of scope',
    '',
    ...issue.outOfScope.map((item) => `- ${item}`),
    '',
    '## Maintainer notes',
    '',
    `Category: \`${issue.category}\``,
    `Difficulty: \`${issue.difficulty ?? 'unspecified'}\``,
  ];
  return `${lines.join('\n')}\n`;
}

function inferRepo() {
  const result = run('git', ['remote', 'get-url', 'origin'], { allowFailure: true });
  if (result.code !== 0) return null;
  const remote = result.stdout.trim();
  const match =
    remote.match(/^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/) ??
    remote.match(/^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/);
  return match?.[1] ?? null;
}

function ensureGh() {
  const result = run('gh', ['--version'], { allowFailure: true });
  if (result.code !== 0) {
    throw new Error('Publishing requires GitHub CLI (`gh`) to be installed and authenticated.');
  }
}

function ensureLabels(repo, issues) {
  const labels = unique(issues.flatMap((issue) => issue.labels));
  for (const label of labels) {
    const meta = LABELS[label] ?? {
      color: 'ededed',
      description: 'Created by the Good First Issue publishing script',
    };
    const result = run('gh', [
      'label',
      'create',
      label,
      '--repo',
      repo,
      '--color',
      meta.color,
      '--description',
      meta.description,
      '--force',
    ]);
    if (result.code !== 0) {
      throw new Error(`Failed to create or update label "${label}":\n${result.stderr}`);
    }
  }
}

function findExistingIssue(repo, title) {
  const result = run('gh', [
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'all',
    '--search',
    `${title} in:title`,
    '--json',
    'number,title',
    '--limit',
    '30',
  ]);
  if (result.code !== 0) {
    throw new Error(`Failed to search existing issues:\n${result.stderr}`);
  }
  const issues = JSON.parse(result.stdout);
  return issues.find((issue) => issue.title === title) ?? null;
}

function createIssue(repo, issue, body) {
  const args = ['issue', 'create', '--repo', repo, '--title', issue.title, '--body', body];
  for (const label of issue.labels) {
    args.push('--label', label);
  }
  const result = run('gh', args);
  if (result.code !== 0) {
    throw new Error(`Failed to create issue "${issue.title}":\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });
  if (result.error && !options.allowFailure) {
    throw result.error;
  }
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? String(result.error ?? ''),
  };
}

function printDryRun(seed, issues, args) {
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          campaign: seed.campaign,
          count: issues.length,
          issues,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Good First Issue dry-run: ${issues.length} issue(s) selected`);
  console.log('');
  for (const issue of issues) {
    console.log(`- ${issue.id}`);
    console.log(`  title: ${issue.title}`);
    console.log(`  labels: ${issue.labels.join(', ')}`);
    console.log(`  category: ${issue.category}`);
  }
  console.log('');
  console.log('Pass --publish to create labels and issues with GitHub CLI.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const seed = loadSeed(args.source);
  const issues = selectIssues(seed, args);
  if (issues.length === 0) {
    throw new Error('No issues selected. Check --category, --only, or --limit.');
  }

  if (args.dryRun) {
    printDryRun(seed, issues, args);
    return;
  }

  const repo = args.repo ?? inferRepo();
  if (!repo) {
    throw new Error('Unable to infer GitHub repo. Pass --repo owner/name.');
  }

  ensureGh();
  ensureLabels(repo, issues);

  for (const issue of issues) {
    if (!args.allowDuplicates) {
      const existing = findExistingIssue(repo, issue.title);
      if (existing) {
        console.log(`skip #${existing.number}: ${issue.title}`);
        continue;
      }
    }

    const url = createIssue(repo, issue, renderIssueBody(issue, seed));
    console.log(`created: ${url}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
