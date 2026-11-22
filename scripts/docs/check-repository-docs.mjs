import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { parse as parseYaml } from 'yaml';
import { repositoryDocPolicy } from './repository-doc-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// pnpm 10.32.1 dist/pnpm.cjs: commandNames registry, argv[0] npm forwarding
// switch, and run-handler fallback aliases. Reconcile these with that actual
// dispatch when upgrading the pinned toolchain; help -a omits some commands.
// Explicit run/run-script never uses native-command classification.
const BUILTINS = new Set([
  'add',
  'approve-builds',
  'audit',
  'bin',
  'c',
  'cache',
  'cat-file',
  'cat-index',
  'ci',
  'clean-install',
  'completion',
  'config',
  'create',
  'dedupe',
  'deploy',
  'dislink',
  'dlx',
  'doctor',
  'env',
  'exec',
  'fetch',
  'find-hash',
  'get',
  'help',
  'i',
  'ic',
  'ignored-builds',
  'import',
  'init',
  'install',
  'install-clean',
  'install-test',
  'it',
  'la',
  'licenses',
  'link',
  'list',
  'll',
  'ln',
  'ls',
  'outdated',
  'pack',
  'patch',
  'patch-commit',
  'patch-remove',
  'prune',
  'publish',
  'rb',
  'rebuild',
  'remove',
  'restart',
  'rm',
  'root',
  'self-update',
  'server',
  'set',
  'setup',
  'store',
  'un',
  'uni',
  'uninstall',
  'unlink',
  'up',
  'update',
  'upgrade',
  'why',
]);
const RUN_COMMANDS = new Set(['run', 'run-script']);
const RECURSIVE_COMMANDS = new Set(['recursive', 'multi', 'm']);
const SCRIPT_ALIASES = new Map([
  ['t', 'test'],
  ['tst', 'test'],
]);
const NPM_PASSTHROUGH = new Set([
  'access',
  'adduser',
  'bugs',
  'deprecate',
  'dist-tag',
  'docs',
  'edit',
  'find',
  'home',
  'info',
  'issues',
  'login',
  'logout',
  'owner',
  'ping',
  'prefix',
  'profile',
  'pkg',
  'repo',
  's',
  'se',
  'search',
  'set-script',
  'show',
  'star',
  'stars',
  'team',
  'token',
  'unpublish',
  'unstar',
  'v',
  'version',
  'view',
  'whoami',
  'xmas',
]);
const SHELL_LANGUAGES = new Set(['sh', 'bash', 'shell', 'console', 'shell-session', 'zsh']);

function inside(root, file) {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function exists(file) {
  try {
    await fs.stat(file);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return false;
  }
}

function visit(node, callback) {
  callback(node);
  for (const child of node.children ?? []) visit(child, callback);
}

export function classifyRepositoryDocument(file, policy, publishedVersions) {
  const release = /^internal\/releases\/([^/]+)\//.exec(file);
  if (release && publishedVersions.has(release[1])) {
    return {
      kind: 'historical-release',
      reason: `Published release ${release[1]} has an active V entity; its evidence is retained.`,
    };
  }
  for (const scope of policy.scopes) {
    if (!file.startsWith(scope.prefix)) continue;
    if (scope.maintainedIndex && file === `${scope.prefix}README.md`) break;
    return { kind: scope.kind, reason: scope.reason };
  }
  return {
    kind: 'maintained',
    reason: 'Current repository prose, including draft release material and directory entrypoints.',
  };
}

// Tokenize only the documented static subset. We do not execute shell examples.
function staticTokens(command) {
  if (/[`\\]/.test(command)) return null;
  return [...command.matchAll(/"([^"\n]*)"|'([^'\n]*)'|([^\s"']+)/g)].map(
    (match) => match[1] ?? match[2] ?? match[3]
  );
}

const dynamicToken = (token) => /\$|[<>]/.test(token);

function commandSegments(line) {
  const segments = [];
  let quote;
  let start = 0;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '\\') {
      index++;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (!['&', '|', ';'].includes(character)) continue;
    segments.push(line.slice(start, index));
    if (line[index + 1] === character) index++;
    start = index + 1;
  }
  segments.push(line.slice(start));
  return segments;
}

function nearestManifest(root, file, manifests) {
  let directory = path.dirname(path.join(root, file));
  while (inside(root, directory)) {
    const relative = path.relative(root, directory).split(path.sep).join('/');
    const manifest = manifests.get(relative ? `${relative}/package.json` : 'package.json');
    if (manifest) return { directory, manifest };
    if (directory === root) break;
    directory = path.dirname(directory);
  }
  return { directory: root, manifest: manifests.get('package.json') };
}

function checkCommands({ root, file, nodes, manifests, errors, skipped }) {
  let checked = 0;
  const initial = nearestManifest(root, file, manifests);
  for (const node of nodes) {
    let directory = initial.directory;
    const lines = node.value.replace(/\\\r?\n/g, ' ').split('\n');
    for (let index = 0; index < lines.length; index++) {
      for (const segment of commandSegments(lines[index])) {
        const line = node.position.start.line + index + (node.type === 'code' ? 1 : 0);
        const text = segment.trim().replace(/^\$\s+/, '');
        if (!/^(?:corepack\s+)?pnpm(?:@[^\s]+)?\b|^cd\s/.test(text)) continue;
        const tokens = staticTokens(text);
        const skip = (reason) => skipped.push({ file, line, command: text, reason });
        if (!tokens) {
          skip('Dynamic shell or placeholder context is outside static script checking.');
          if (/^cd\s/.test(text)) directory = null;
          continue;
        }
        if (tokens[0] === 'cd') {
          directory =
            directory && tokens.length === 2 && !dynamicToken(tokens[1])
              ? path.resolve(directory, tokens[1])
              : null;
          continue;
        }
        if (tokens[0] === 'corepack') tokens.shift();
        tokens.shift(); // pnpm, with an optional Corepack version selector
        // The actual pnpm wrapper forwards only argv[0], before option parsing.
        if (NPM_PASSTHROUGH.has(tokens[0])) continue;
        let invocationDirectory = directory;
        let filter;
        let recursive = false;
        let supported = true;
        while (tokens[0]?.startsWith('-')) {
          const option = tokens.shift();
          if (['-s', '--silent'].includes(option)) continue;
          if (['-w', '--workspace-root'].includes(option)) {
            invocationDirectory = root;
            continue;
          }
          if (['-r', '--recursive'].includes(option)) {
            recursive = true;
            continue;
          }
          if (['-C', '--dir', '--filter', '-F'].includes(option)) {
            const argument = tokens.shift();
            if (!argument || dynamicToken(argument)) {
              supported = false;
              break;
            }
            if (['--filter', '-F'].includes(option)) {
              if (filter) supported = false;
              filter = argument;
            } else
              invocationDirectory = invocationDirectory
                ? path.resolve(invocationDirectory, argument)
                : null;
            continue;
          }
          if (option.startsWith('--filter=')) {
            if (filter) supported = false;
            filter = option.slice(9);
            if (dynamicToken(filter)) supported = false;
            continue;
          }
          if (option.startsWith('--dir=')) {
            if (dynamicToken(option.slice(6))) supported = false;
            invocationDirectory = invocationDirectory
              ? path.resolve(invocationDirectory, option.slice(6))
              : null;
            continue;
          }
          supported = false;
          break;
        }
        if (RECURSIVE_COMMANDS.has(tokens[0])) {
          skip('Named recursive execution is outside single-package script checking.');
          continue;
        }
        const explicitRun = RUN_COMMANDS.has(tokens[0]);
        if (explicitRun) tokens.shift();
        const script = explicitRun ? tokens[0] : (SCRIPT_ALIASES.get(tokens[0]) ?? tokens[0]);
        if (!script || (!explicitRun && BUILTINS.has(script))) continue;
        if (
          !supported ||
          dynamicToken(script) ||
          script.startsWith('-') ||
          recursive ||
          (filter && /[*?![\]{}]|^\.?\.?(?:\/|$)|\.\.\./.test(filter))
        ) {
          skip('Only static single-package selectors and explicit script commands are checked.');
          continue;
        }
        let selected;
        if (filter) {
          selected = [...manifests.entries()].find(([, manifest]) => manifest.name === filter);
          if (!selected) {
            errors.push(
              `${file}:${line}: pnpm filter ${filter} does not name a workspace package.`
            );
            continue;
          }
        } else if (invocationDirectory && inside(root, invocationDirectory)) {
          const relative = path.relative(root, invocationDirectory).split(path.sep).join('/');
          const manifestPath = relative ? `${relative}/package.json` : 'package.json';
          if (manifests.has(manifestPath)) selected = [manifestPath, manifests.get(manifestPath)];
        }
        if (!selected) {
          skip('The example uses an external, generated or non-package working directory.');
          continue;
        }
        checked++;
        if (!Object.hasOwn(selected[1].scripts ?? {}, script)) {
          const rootOnly =
            selected[0] !== 'package.json' &&
            Object.hasOwn(manifests.get('package.json')?.scripts ?? {}, script);
          if (rootOnly)
            errors.push(
              `${file}:${line}: pnpm script ${script} belongs to the repository root, while this document is package-local; make the command context explicit with -w or --dir.`
            );
          else if (explicitRun)
            errors.push(`${file}:${line}: pnpm script ${script} is absent from ${selected[0]}.`);
          else if (NPM_PASSTHROUGH.has(script))
            errors.push(
              `${file}:${line}: pnpm forwards ${script} to npm only as its first argument; preceding pnpm options do not select that forwarding path.`
            );
          else
            errors.push(
              `${file}:${line}: pnpm command ${script} is not a declared script in ${selected[0]}. Use pnpm run ${script} for an intended package script (and correct its name if absent), or pnpm exec ${script} for an executable; executable shorthand is outside this checker's documented syntax.`
            );
        }
      }
    }
  }
  return checked;
}

export async function runRepositoryDocsCheck({
  root = ROOT,
  files,
  policy = repositoryDocPolicy,
} = {}) {
  root = path.resolve(root);
  const inventory = [
    ...new Set(
      files ??
        execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
        })
          .split('\0')
          .filter(Boolean)
    ),
  ].sort();
  const errors = [];
  const manifests = new Map();
  const publishedVersions = new Set();
  const workspacePatterns = inventory.includes('pnpm-workspace.yaml')
    ? (parseYaml(await fs.readFile(path.join(root, 'pnpm-workspace.yaml'), 'utf8')).packages ?? [])
    : [];
  const isWorkspaceManifest = (file) =>
    file === 'package.json' ||
    (/\/package\.json$/.test(file) &&
      workspacePatterns.some(
        (pattern) => !pattern.startsWith('!') && path.matchesGlob(path.posix.dirname(file), pattern)
      ) &&
      !workspacePatterns.some(
        (pattern) =>
          pattern.startsWith('!') && path.matchesGlob(path.posix.dirname(file), pattern.slice(1))
      ));
  for (const file of inventory) {
    if (isWorkspaceManifest(file)) {
      manifests.set(file, JSON.parse(await fs.readFile(path.join(root, file), 'utf8')));
    }
    if (/^spec\/versions\/.*\.ya?ml$/.test(file)) {
      const entity = parseYaml(await fs.readFile(path.join(root, file), 'utf8'));
      if (entity?.type === 'version' && entity.status === 'active' && entity.release?.version)
        publishedVersions.add(entity.release.version);
    }
  }
  for (const file of policy.requiredEntrypoints) {
    if (!inventory.includes(file) || !(await exists(path.join(root, file))))
      errors.push(`${file}: required documentation entrypoint is missing.`);
  }
  for (const projection of policy.localProjections) {
    if (inventory.includes(projection.file))
      errors.push(
        `${projection.file}: local generated projection must not be tracked. ${projection.reason}`
      );
    if (!(await exists(path.join(root, projection.generator))))
      errors.push(`${projection.file}: generator ${projection.generator} is missing.`);
    if (
      !manifests.get('package.json')?.scripts?.[projection.command]?.includes(projection.generator)
    )
      errors.push(
        `${projection.file}: root script ${projection.command} must invoke ${projection.generator}.`
      );
  }
  const documents = [];
  const skippedCommands = [];
  let checkedLinks = 0;
  let checkedCommands = 0;
  let omittedLinks = 0;
  for (const file of inventory.filter((file) => /\.mdx?$/.test(file))) {
    const classification = classifyRepositoryDocument(file, policy, publishedVersions);
    documents.push({ file, ...classification });
    if (classification.kind !== 'maintained') continue;
    let text;
    try {
      text = await fs.readFile(path.join(root, file), 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      errors.push(`${file}: inventoried documentation file is missing.`);
      continue;
    }
    const tree = fromMarkdown(text);
    const definitions = new Map();
    const links = [];
    const commands = [];
    visit(tree, (node) => {
      if (node.type === 'definition' && !definitions.has(node.identifier))
        definitions.set(node.identifier, node.url);
      if (['link', 'image', 'linkReference', 'imageReference'].includes(node.type))
        links.push(node);
      if (node.type === 'inlineCode' || (node.type === 'code' && SHELL_LANGUAGES.has(node.lang)))
        commands.push(node);
    });
    for (const link of links) {
      const target = link.url ?? definitions.get(link.identifier);
      if (!target || /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/|#)/.test(target)) {
        omittedLinks++;
        continue;
      }
      const location = `${file}:${link.position.start.line}`;
      let decoded;
      try {
        decoded = decodeURIComponent(target.split(/[?#]/)[0]);
      } catch {
        errors.push(`${location}: invalid encoded local link ${target}.`);
        continue;
      }
      if (!decoded) continue;
      checkedLinks++;
      const destination = path.resolve(root, path.dirname(file), decoded);
      if (!inside(root, destination)) {
        errors.push(`${location}: local link ${target} escapes the repository.`);
        continue;
      }
      if (!(await exists(destination))) {
        errors.push(`${location}: local link ${target} does not exist.`);
        continue;
      }
      if (!inside(root, await fs.realpath(destination)))
        errors.push(`${location}: local link ${target} resolves outside the repository.`);
    }
    checkedCommands += checkCommands({
      root,
      file,
      nodes: commands,
      manifests,
      errors,
      skipped: skippedCommands,
    });
  }
  const counts = {};
  for (const document of documents) counts[document.kind] = (counts[document.kind] ?? 0) + 1;
  return {
    errors,
    counts,
    checkedLinks,
    checkedCommands,
    omittedLinks,
    skippedCommands,
    documents,
    publishedVersions: [...publishedVersions].sort(),
    excludedScopes: policy.scopes,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--json'))
    throw new Error('Usage: node scripts/docs/check-repository-docs.mjs [--json]');
  const report = await runRepositoryDocsCheck();
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(
      `[repository-docs] ${JSON.stringify(report.counts)}; ${report.checkedLinks} relative targets; ${report.checkedCommands} static script commands; ${report.skippedCommands.length} recognized command contexts outside the static subset.`
    );
    for (const error of report.errors) console.error(`- ${error}`);
  }
  if (report.errors.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[repository-docs] ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}
