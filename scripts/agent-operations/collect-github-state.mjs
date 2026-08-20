import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { buildSnapshot } from './lib.mjs';

function value(argv, index, option) {
  const result = argv[index];
  if (!result || result.startsWith('--')) throw new Error(`${option} requires a value`);
  return result;
}

function parseArgs(argv) {
  const args = {
    repository: process.env.GITHUB_REPOSITORY,
    kind: 'both',
    limit: 50,
    output: 'agent-operations-snapshot.json',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') args.repository = value(argv, ++index, arg);
    else if (arg === '--kind') args.kind = value(argv, ++index, arg);
    else if (arg === '--limit') args.limit = Number(value(argv, ++index, arg));
    else if (arg === '--output') args.output = value(argv, ++index, arg);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/agent-operations/collect-github-state.mjs [options]

Options:
  --repo <owner/name>   Repository, defaults to GITHUB_REPOSITORY
  --kind <value>       issues, prs, or both (default: both)
  --limit <n>          Maximum combined items, 1-100 (default: 50)
  --output <path>      Snapshot output (default: agent-operations-snapshot.json)
`);
}

async function github(path, token) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'proto-ui-agent-operations-shadow',
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`GitHub API ${response.status} for ${path}: ${detail}`);
  }
  return response.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.repository)
    throw new Error('Repository is required through --repo or GITHUB_REPOSITORY');
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required');

  const [owner, repository] = args.repository.split('/');
  if (!owner || !repository) throw new Error(`Invalid repository: ${args.repository}`);
  const encoded = `${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  const needIssues = args.kind === 'issues' || args.kind === 'both';
  const needPullRequests = args.kind === 'prs' || args.kind === 'both';
  if (!needIssues && !needPullRequests) throw new Error(`Invalid kind: ${args.kind}`);

  const [issues, pullRequests] = await Promise.all([
    needIssues
      ? github(
          `/repos/${encoded}/issues?state=open&sort=updated&direction=desc&per_page=100`,
          token
        )
      : [],
    needPullRequests
      ? github(`/repos/${encoded}/pulls?state=open&sort=updated&direction=desc&per_page=100`, token)
      : [],
  ]);
  const snapshot = buildSnapshot({
    repository: args.repository,
    kind: args.kind,
    limit: args.limit,
    issues,
    pullRequests,
  });
  writeFileSync(args.output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(
    `[agent-operations-collect] ${snapshot.itemCount} item(s), digest ${snapshot.digest.slice(0, 12)}, output ${args.output}`
  );
}

main().catch((error) => {
  console.error(`[agent-operations-collect] ${error.message}`);
  process.exitCode = 1;
});
