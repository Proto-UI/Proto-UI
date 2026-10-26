import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, readlink, realpath, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { extractOverviewEntries } from '../docs/check-public-docs.mjs';
import { resolveProtoUiSource } from '../../apps/www/src/utils/proto-ui-source.mjs';

export const HISTORICAL_INVENTORY = Object.freeze({
  revision: 'b875ffdd0d9c823b4906a8f71b017e7f42a8971d',
  path: 'internal/compiler/website-demo-migrations.json',
  sha256: '79a3dcfab2e747a737fd75718d43ac052dd74b54af7a91c648904d7f7a44dd40',
  generatorPath: 'scripts/compiler/website-demo-inventory.mjs',
  generatorSha256: '581f0371b077457337e1c5b01e767fb713f30247d485186c8fc6b0ea3dcf4384',
});

export const DEFAULT_SOURCE_TREES = Object.freeze([
  'apps/www/src/components',
  'apps/www/src/content',
  'apps/www/src/utils',
  'packages',
]);

const SOURCE_EXTENSIONS = new Set([
  '.astro',
  '.cjs',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdx',
  '.mjs',
  '.ts',
  '.tsx',
]);

const STATIC_INPUT_PATHS = Object.freeze([
  'apps/www/astro.config.mjs',
  'apps/www/package.json',
  'apps/www/src/utils/proto-ui-source.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'scripts/build/public-packages.mjs',
  'scripts/compiler/website-demo-inventory.mjs',
  'scripts/compiler/website-demo-migrations-829.json',
  'scripts/docs/check-public-docs.mjs',
  'scripts/docs/public-doc-policy.mjs',
  'tsconfig.json',
]);

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lexical = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const toPosix = (value) => value.replaceAll('\\', '/');
const relativeTo = (root, file) => toPosix(path.relative(root, file));

export function normalizeDocRoute(value) {
  let route = toPosix(value)
    .replace(/^\.\//, '')
    .replace(/\.mdx?$/i, '');
  route = route.replace(/(?:^|\/)index$/i, '').replace(/^\/+|\/+$/g, '');
  return `/${route ? `${route}/` : ''}`;
}

function isSourceInputPath(relativePath, sourceTrees = DEFAULT_SOURCE_TREES) {
  const file = toPosix(relativePath);
  if (STATIC_INPUT_PATHS.includes(file)) return true;
  if (file.startsWith('packages/')) {
    return (
      /(?:^|\/)package\.json$/u.test(file) ||
      ((/(?:^|\/)src\//u.test(file) || file.startsWith('packages/compiler/test/')) &&
        SOURCE_EXTENSIONS.has(path.posix.extname(file)))
    );
  }
  return sourceTrees.some((tree) => {
    const prefix = `${toPosix(tree).replace(/\/$/u, '')}/`;
    return file.startsWith(prefix) && SOURCE_EXTENSIONS.has(path.posix.extname(file));
  });
}

async function walkFilesIncludingHidden(directory, output = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return output;
    throw error;
  }
  entries.sort((left, right) => lexical(left.name, right.name));
  for (const entry of entries) {
    if (entry.isDirectory() && ['node_modules', '.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walkFilesIncludingHidden(file, output);
    else if (entry.isFile() || entry.isSymbolicLink()) output.push(file);
  }
  return output;
}

function parseGitMap(root, command, args, parseEntry) {
  try {
    const bytes = execFileSync('git', command.concat(args), {
      cwd: root,
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    });
    const map = new Map();
    for (const entry of bytes.toString('utf8').split('\0')) {
      if (!entry) continue;
      const parsed = parseEntry(entry);
      if (parsed) map.set(parsed.path, parsed);
    }
    return map;
  } catch {
    return null;
  }
}

function gitObjectHash(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function gitTreeFiles(root, revision) {
  return parseGitMap(root, ['ls-tree'], ['-r', '-z', '--full-tree', revision], (entry) => {
    const tab = entry.indexOf('\t');
    if (tab < 0) return null;
    const [mode, type, oid] = entry.slice(0, tab).split(' ');
    return type === 'blob' ? { path: toPosix(entry.slice(tab + 1)), mode, oid } : null;
  });
}

function gitIndexFiles(root) {
  return parseGitMap(root, ['ls-files'], ['--stage', '-z'], (entry) => {
    const tab = entry.indexOf('\t');
    if (tab < 0) return null;
    const [mode, oid, stage] = entry.slice(0, tab).split(' ');
    return { path: toPosix(entry.slice(tab + 1)), mode, oid, stage };
  });
}

/** Capture all selected source bytes, modes, membership, and exact HEAD/index/worktree state. */
export async function snapshotInputBinding(
  root = DEFAULT_ROOT,
  { sourceTrees = DEFAULT_SOURCE_TREES, staticPaths = STATIC_INPUT_PATHS, git = true } = {}
) {
  const absoluteRoot = path.resolve(root);
  const physical = new Map();
  const addFile = async (file) => {
    const relativePath = relativeTo(absoluteRoot, file);
    if (!isSourceInputPath(relativePath, sourceTrees) && !staticPaths.includes(relativePath))
      return;
    const info = await lstat(file);
    if (!info.isFile() && !info.isSymbolicLink()) return;
    const bytes = await readFile(file);
    const linkTarget = info.isSymbolicLink() ? await readlink(file) : null;
    physical.set(relativePath, {
      path: relativePath,
      kind: info.isSymbolicLink() ? 'symlink' : 'file',
      symlinkTarget: linkTarget ?? undefined,
      mode: (info.mode & 0o777).toString(8).padStart(4, '0'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      worktreeBlob: gitObjectHash(linkTarget === null ? bytes : Buffer.from(linkTarget)),
      gitMode: info.isSymbolicLink() ? '120000' : info.mode & 0o111 ? '100755' : '100644',
    });
  };
  for (const tree of sourceTrees) {
    for (const file of await walkFilesIncludingHidden(path.join(absoluteRoot, tree)))
      await addFile(file);
  }
  for (const relativePath of staticPaths) {
    try {
      await addFile(path.join(absoluteRoot, relativePath));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  let revision = null;
  let headFiles = null;
  let indexFiles = null;
  let gitBindingError = null;
  if (git) {
    try {
      revision = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: absoluteRoot,
        encoding: 'utf8',
      }).trim();
      headFiles = gitTreeFiles(absoluteRoot, revision);
      indexFiles = gitIndexFiles(absoluteRoot);
      if (!headFiles || !indexFiles)
        throw new Error('Git HEAD or index membership could not be read.');
    } catch (error) {
      revision = null;
      gitBindingError = String(error);
    }
  }
  const members = new Set(physical.keys());
  for (const source of [headFiles, indexFiles]) {
    if (!source) continue;
    for (const relativePath of source.keys())
      if (isSourceInputPath(relativePath, sourceTrees) || staticPaths.includes(relativePath))
        members.add(relativePath);
  }
  const files = [...members].sort(lexical).map((relativePath) => {
    const current = physical.get(relativePath);
    const head = headFiles?.get(relativePath) ?? null;
    const index = indexFiles?.get(relativePath) ?? null;
    const state = !current
      ? 'missing-from-worktree'
      : !head && !index
        ? 'untracked'
        : head?.oid === index?.oid &&
            index?.oid === current.worktreeBlob &&
            head?.mode === index?.mode &&
            index?.mode === current.gitMode
          ? 'exact-head-bytes'
          : 'dirty-or-staged';
    return {
      path: relativePath,
      kind: current?.kind ?? 'missing',
      mode: current?.mode ?? null,
      symlinkTarget: current?.symlinkTarget,
      sha256: current?.sha256 ?? null,
      head: head ? { mode: head.mode, blob: head.oid } : null,
      index: index ? { mode: index.mode, blob: index.oid, stage: index.stage } : null,
      state,
    };
  });
  const digest = createHash('sha256').update(JSON.stringify(files)).digest('hex');
  return {
    revision: revision
      ? {
          head: revision,
          exactForAllInputs: files.every((file) => file.state === 'exact-head-bytes'),
        }
      : null,
    sourceTrees: sourceTrees.map(toPosix),
    staticPaths: staticPaths.map(toPosix),
    hiddenFilesIncluded: true,
    gitBindingError,
    sha256: digest,
    files,
  };
}

export function compareInputBindings(before, after) {
  const previous = new Map(before.files.map((file) => [file.path, file]));
  const current = new Map(after.files.map((file) => [file.path, file]));
  const added = [...current.keys()].filter((file) => !previous.has(file)).sort(lexical);
  const removed = [...previous.keys()].filter((file) => !current.has(file)).sort(lexical);
  const changed = [...current.keys()]
    .filter((file) => {
      const left = previous.get(file);
      const right = current.get(file);
      return left && !isDeepStrictEqual(left, right);
    })
    .sort(lexical);
  const revisionChanged =
    !isDeepStrictEqual(before.revision, after.revision) ||
    before.gitBindingError !== after.gitBindingError ||
    !isDeepStrictEqual(before.sourceTrees, after.sourceTrees) ||
    !isDeepStrictEqual(before.staticPaths, after.staticPaths);
  return { added, removed, changed, revisionChanged };
}

export function reconcileHistoricalRejections(historicalInventory, currentRows) {
  const currentById =
    currentRows instanceof Map ? currentRows : new Map(currentRows.map((row) => [row.id, row]));
  return historicalInventory.prototypes
    .filter((row) => row.nodeAdmission === 'rejected')
    .map((old) => {
      const current = currentById.get(old.id);
      const currentAdmission = current?.statuses?.nodeAdmission ?? null;
      const sameEntryBytes =
        !!current && current.entrySha256 !== null && current.entrySha256 === old.entrySha256;
      return {
        id: old.id,
        obligation: 'open-historical-rejection-reconciliation',
        historical: {
          nodeAdmission: 'rejected',
          entry: old.entry,
          entrySha256: old.entrySha256,
          diagnostics: old.diagnostics,
          sourceRevision: HISTORICAL_INVENTORY.revision,
        },
        current: current
          ? {
              nodeAdmission: currentAdmission,
              entry: current.entry ?? null,
              entrySha256: current.entrySha256 ?? null,
              sameEntryBytes,
            }
          : { nodeAdmission: 'not-discovered-in-current-scope', sameEntryBytes: false },
        reconciliation: sameEntryBytes
          ? 'same-entry-reclassified-currently; historical rejection remains open evidence'
          : current
            ? 'current-source-or-admission-differs; manual reconciliation remains open'
            : 'not-currently-discovered; manual reconciliation remains open',
      };
    });
}

async function snapshotDependencyBinding(www) {
  const websiteRequire = createRequire(path.join(www, 'package.json'));
  const astroRequire = createRequire(websiteRequire.resolve('astro/package.json'));
  const queue = [
    ['typescript', createRequire(import.meta.url)],
    ['yaml', createRequire(import.meta.url)],
    ['unified', websiteRequire],
    ['remark-parse', websiteRequire],
    ['remark-mdx', websiteRequire],
    ['@astrojs/compiler', astroRequire],
  ];
  const seen = new Set();
  const packages = [];
  while (queue.length) {
    const [name, resolver] = queue.shift();
    let resolvedEntry;
    try {
      resolvedEntry = resolver.resolve(name);
    } catch (error) {
      try {
        resolvedEntry = resolver.resolve(`${name}/package.json`);
      } catch {
        throw error;
      }
    }
    const entry = await realpath(resolvedEntry);
    let directory = path.dirname(entry);
    let manifest;
    while (true) {
      try {
        manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
        if (manifest.name) break;
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      const parent = path.dirname(directory);
      if (parent === directory)
        throw new Error(`No package manifest owns parser dependency ${name}`);
      directory = parent;
    }
    if (seen.has(directory)) continue;
    seen.add(directory);
    const files = [];
    for (const file of await walkFilesIncludingHidden(directory)) {
      const bytes = await readFile(file);
      const info = await lstat(file);
      files.push({
        path: relativeTo(directory, file),
        mode: (info.mode & 0o777).toString(8).padStart(4, '0'),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    files.sort((left, right) => lexical(left.path, right.path));
    packages.push({
      name: manifest.name,
      version: manifest.version,
      entry: relativeTo(directory, entry),
      files,
    });
    const ownRequire = createRequire(path.join(directory, 'package.json'));
    for (const dependency of Object.keys(manifest.dependencies ?? {}).sort(lexical))
      queue.push([dependency, ownRequire]);
  }
  packages.sort(
    (left, right) => lexical(left.name, right.name) || lexical(left.version, right.version)
  );
  return {
    scope:
      'Actual installed TypeScript, YAML, Markdown/MDX and Astro parser packages and their declared runtime dependency closures; development dependencies and framework/browser execution are not inputs to this classification.',
    sha256: createHash('sha256').update(JSON.stringify(packages)).digest('hex'),
    packages,
  };
}

const source = async (file, observed = null) => {
  observed?.add(path.resolve(file));
  return ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
};
const visit = (node, callback) => {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
};
const propertyName = (node) => node?.text;
const resolveSource = (specifier, containingFile, root = DEFAULT_ROOT) =>
  specifier.startsWith('@proto.ui/')
    ? resolveProtoUiSource(specifier, { repositoryRoot: root })
    : ts.resolveModuleName(
        specifier,
        containingFile,
        {
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          module: ts.ModuleKind.ESNext,
        },
        ts.sys
      ).resolvedModule?.resolvedFileName;

// Registration barrels forward a binding; the editable contract is its original definition.
// Resolve addresses only. Do not evaluate modules or rewrite the authored contract.
export async function definition(
  file,
  exportName,
  { root = DEFAULT_ROOT, seen = new Set(), observed = null } = {}
) {
  const identity = `${file}#${exportName}`;
  if (seen.has(identity))
    throw new Error(`Cyclic prototype forwarding: ${relativeTo(root, file)}#${exportName}`);
  seen.add(identity);
  const ast = await source(file, observed),
    imports = new Map();
  for (const statement of ast.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause ||
      statement.importClause.isTypeOnly ||
      !ts.isStringLiteralLike(statement.moduleSpecifier)
    )
      continue;
    const specifier = statement.moduleSpecifier.text;
    if (statement.importClause.name)
      imports.set(statement.importClause.name.text, { specifier, exportName: 'default' });
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const element of bindings.elements)
        if (!element.isTypeOnly)
          imports.set(element.name.text, {
            specifier,
            exportName: element.propertyName?.text ?? element.name.text,
          });
  }
  const forward = async (binding) => {
    const next = resolveSource(binding.specifier, file, root);
    if (!next)
      throw new Error(
        `Missing forwarded source ${binding.specifier} from ${relativeTo(root, file)}`
      );
    return definition(next, binding.exportName, { root, seen, observed });
  };
  for (const statement of ast.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      const element = statement.exportClause.elements.find(
        (element) => !element.isTypeOnly && element.name.text === exportName
      );
      if (!element) continue;
      const name = element.propertyName?.text ?? element.name.text;
      if (statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier))
        return forward({ specifier: statement.moduleSpecifier.text, exportName: name });
      if (imports.has(name)) return forward(imports.get(name));
    }
    if (
      exportName === 'default' &&
      ts.isExportAssignment(statement) &&
      !statement.isExportEquals &&
      ts.isIdentifier(statement.expression) &&
      imports.has(statement.expression.text)
    )
      return forward(imports.get(statement.expression.text));
  }
  return { file, exportName };
}

function unwrapExpression(node) {
  while (
    node &&
    (ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isAwaitExpression(node))
  )
    node = node.expression;
  return node;
}

function sourceLocation(root, file, node) {
  const position = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  return { file: relativeTo(root, file), line: position.line + 1, column: position.character + 1 };
}

function staticObjectKey(node) {
  const name = node?.name;
  if (name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)))
    return name.text;
  return null;
}

function staticString(node) {
  node = unwrapExpression(node);
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function importsForSourceFile(ast) {
  const imports = new Map();
  for (const statement of ast.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause ||
      statement.importClause.isTypeOnly ||
      !ts.isStringLiteralLike(statement.moduleSpecifier)
    )
      continue;
    const specifier = statement.moduleSpecifier.text;
    if (statement.importClause.name)
      imports.set(statement.importClause.name.text, {
        specifier,
        exportName: 'default',
        namespace: false,
      });
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const element of bindings.elements)
        if (!element.isTypeOnly)
          imports.set(element.name.text, {
            specifier,
            exportName: element.propertyName?.text ?? element.name.text,
            namespace: false,
          });
    if (bindings && ts.isNamespaceImport(bindings))
      imports.set(bindings.name.text, { specifier, exportName: '*', namespace: true });
  }
  return imports;
}

function declarationsForSourceFile(ast) {
  const variables = new Map();
  const helpers = new Map();
  for (const statement of ast.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body)
      helpers.set(statement.name.text, statement);
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        variables.set(declaration.name.text, declaration.initializer);
        const initializer = unwrapExpression(declaration.initializer);
        if (
          initializer &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        )
          helpers.set(declaration.name.text, initializer);
      }
    }
  }
  return { variables, helpers };
}

function variableInitializer(ast, name) {
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name)
        return declaration.initializer ?? null;
  }
  return null;
}

function exportedVariableInitializer(ast, name) {
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (
      !(statement.modifiers ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name)
        return declaration.initializer ?? null;
  }
  return null;
}

function dynamicImportsInFunction(fn) {
  const imports = new Map();
  const inspect = (node) => {
    if (node !== fn && ts.isFunctionLike(node)) return;
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const initializer = unwrapExpression(node.initializer);
      if (
        initializer &&
        ts.isCallExpression(initializer) &&
        initializer.expression.kind === ts.SyntaxKind.ImportKeyword &&
        ts.isStringLiteralLike(initializer.arguments[0])
      ) {
        const binding = {
          specifier: initializer.arguments[0].text,
          exportName: '*',
          namespace: true,
        };
        if (ts.isIdentifier(node.name)) imports.set(node.name.text, binding);
        else if (ts.isObjectBindingPattern(node.name))
          for (const element of node.name.elements)
            if (ts.isIdentifier(element.name))
              imports.set(element.name.text, {
                specifier: binding.specifier,
                exportName: (element.propertyName ?? element.name).text,
                namespace: false,
              });
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(fn);
  return imports;
}

function substituted(node, substitutions) {
  node = unwrapExpression(node);
  if (node && ts.isIdentifier(node) && substitutions.has(node.text))
    return unwrapExpression(substitutions.get(node.text));
  return node;
}

function importedExport(node, imports, substitutions) {
  node = substituted(node, substitutions);
  if (!node) return null;
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const binding = imports.get(node.expression.text);
    if (binding?.namespace) return { specifier: binding.specifier, exportName: node.name.text };
  }
  if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const binding = imports.get(node.expression.text);
    const name = staticString(node.argumentExpression);
    if (binding?.namespace && name !== null)
      return { specifier: binding.specifier, exportName: name };
  }
  if (ts.isIdentifier(node)) {
    const binding = imports.get(node.text);
    if (binding && !binding.namespace) return binding;
  }
  return null;
}

/** Discover literal registration addresses from the current manual registry and imported spreads. */
export async function discoverPrototypeRegistrations({
  root = DEFAULT_ROOT,
  registryFile = 'apps/www/src/components/PrototypePreviewer/prototype-modules.ts',
} = {}) {
  const absoluteRoot = path.resolve(root);
  const registryPath = path.isAbsolute(registryFile)
    ? registryFile
    : path.join(absoluteRoot, registryFile);
  const observed = new Set();
  const registrations = [];
  const unresolved = [];
  const parsed = new Map();

  const load = async (file) => {
    const absolute = path.resolve(file);
    if (!parsed.has(absolute)) parsed.set(absolute, await source(absolute, observed));
    return parsed.get(absolute);
  };
  const recordUnresolved = (file, node, reason, expression = node.getText()) => {
    unresolved.push({ ...sourceLocation(absoluteRoot, file, node), reason, expression });
  };

  const inspectRegistrationCall = (
    call,
    file,
    imports,
    helpers,
    substitutions,
    helperChain = []
  ) => {
    if (!ts.isIdentifier(call.expression)) return false;
    const name = call.expression.text;
    if (name === 'registerPrototype' || name === 'registerExactPrototype') {
      const id = staticString(substituted(call.arguments[0], substitutions));
      const binding = importedExport(call.arguments[1], imports, substitutions);
      if (id === null || !binding) {
        recordUnresolved(file, call, 'registration-id-or-module-export-is-dynamic');
        return true;
      }
      registrations.push({
        id,
        call: name,
        ...sourceLocation(absoluteRoot, file, call),
        specifier: binding.specifier,
        exportName: binding.exportName,
        viaHelper: helperChain,
      });
      return true;
    }
    const helper = helpers.get(name);
    if (!helper) return false;
    if (helperChain.includes(name)) {
      recordUnresolved(file, call, 'cyclic-registration-helper', name);
      return true;
    }
    const parameters = helper.parameters ?? [];
    const nextSubstitutions = new Map(substitutions);
    for (let index = 0; index < parameters.length; index += 1) {
      const parameter = parameters[index];
      const argument = call.arguments[index];
      if (parameter && ts.isIdentifier(parameter.name) && argument)
        nextSubstitutions.set(parameter.name.text, substituted(argument, substitutions));
    }
    const body = ts.isFunctionLike(helper) ? helper.body : null;
    if (!body) {
      recordUnresolved(file, call, 'registration-helper-has-no-static-body', name);
      return true;
    }
    const localImports = new Map([...imports, ...dynamicImportsInFunction(helper)]);
    let found = false;
    const walk = (node) => {
      if (node !== body && ts.isFunctionLike(node)) return;
      if (ts.isCallExpression(node)) {
        const handled = inspectRegistrationCall(
          node,
          file,
          localImports,
          helpers,
          nextSubstitutions,
          [...helperChain, name]
        );
        found ||= handled;
      }
      ts.forEachChild(node, walk);
    };
    walk(body);
    if (!found)
      recordUnresolved(file, call, 'registration-helper-does-not-resolve-a-registration', name);
    return true;
  };

  const parseLoader = (file, ast, key, value, imports, declarations) => {
    const fn = unwrapExpression(value);
    if (!fn || (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn))) {
      recordUnresolved(file, value, 'manual-loader-is-not-a-static-function', key);
      return;
    }
    const localImports = new Map([...imports, ...dynamicImportsInFunction(fn)]);
    const registrationsBefore = registrations.length;
    const body = fn.body;
    const walk = (node) => {
      if (node !== body && ts.isFunctionLike(node)) return;
      if (ts.isCallExpression(node))
        inspectRegistrationCall(node, file, localImports, declarations.helpers, new Map());
      ts.forEachChild(node, walk);
    };
    walk(body);

    if (registrations.length === registrationsBefore) {
      const returnImport = (node) => {
        node = unwrapExpression(node);
        if (
          node &&
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          ts.isStringLiteralLike(node.arguments[0])
        )
          return node.arguments[0].text;
        return null;
      };
      const returned = ts.isBlock(fn.body)
        ? fn.body.statements.flatMap((statement) =>
            ts.isReturnStatement(statement) ? [returnImport(statement.expression)] : []
          )
        : [returnImport(fn.body)];
      const literalReturn = returned.find((specifier) => specifier !== null);
      if (literalReturn !== undefined) {
        registrations.push({
          id: key,
          call: 'loader-default-export',
          ...sourceLocation(absoluteRoot, file, value),
          specifier: literalReturn,
          exportName: 'default',
          viaHelper: [],
        });
      } else {
        recordUnresolved(file, value, 'manual-loader-has-no-static-registration', key);
      }
    }
  };

  const parseObject = async (file, objectNode, ancestry = []) => {
    if (!ts.isObjectLiteralExpression(objectNode)) return;
    const absolute = path.resolve(file);
    const objectIdentity = `${absolute}:${objectNode.pos}:${objectNode.end}`;
    if (ancestry.includes(objectIdentity)) {
      recordUnresolved(file, objectNode, 'cyclic-registration-spread');
      return;
    }
    const ast = await load(absolute);
    const imports = importsForSourceFile(ast);
    const declarations = declarationsForSourceFile(ast);
    for (const property of objectNode.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = unwrapExpression(property.expression);
        if (!spread || !ts.isIdentifier(spread)) {
          recordUnresolved(file, property, 'registration-spread-is-dynamic');
          continue;
        }
        const name = spread.text;
        const imported = imports.get(name);
        if (imported) {
          const target = resolveSource(imported.specifier, absolute, absoluteRoot);
          if (!target) {
            recordUnresolved(file, property, 'registration-spread-module-is-unresolved');
            continue;
          }
          const targetAst = await load(target);
          const child = exportedVariableInitializer(targetAst, imported.exportName);
          if (!child || !ts.isObjectLiteralExpression(unwrapExpression(child))) {
            recordUnresolved(file, property, 'registration-spread-export-is-not-a-static-object');
            continue;
          }
          await parseObject(target, unwrapExpression(child), [...ancestry, objectIdentity]);
          continue;
        }
        const local = declarations.variables.get(name);
        if (local && ts.isObjectLiteralExpression(unwrapExpression(local))) {
          await parseObject(absolute, unwrapExpression(local), [...ancestry, objectIdentity]);
          continue;
        }
        recordUnresolved(file, property, 'registration-spread-binding-is-unresolved', name);
        continue;
      }
      if (!ts.isPropertyAssignment(property)) {
        recordUnresolved(file, property, 'manual-registration-property-is-not-an-assignment');
        continue;
      }
      const key = staticObjectKey(property);
      if (key === null) {
        recordUnresolved(file, property, 'manual-registration-id-is-dynamic');
        continue;
      }
      parseLoader(absolute, ast, key, property.initializer, imports, declarations);
    }
  };

  const registry = await load(registryPath);
  const initializer = variableInitializer(registry, 'manualPrototypeModules');
  if (!initializer || !ts.isObjectLiteralExpression(unwrapExpression(initializer))) {
    recordUnresolved(
      registryPath,
      initializer ?? registry,
      'manualPrototypeModules-is-not-a-static-object',
      'manualPrototypeModules'
    );
  } else {
    await parseObject(registryPath, unwrapExpression(initializer));
  }

  const byId = new Map();
  for (const registration of registrations) {
    const rows = byId.get(registration.id) ?? [];
    rows.push(registration);
    byId.set(registration.id, rows);
  }
  for (const [id, rows] of byId)
    if (rows.length > 1)
      unresolved.push({
        id,
        reason: 'duplicate-manual-registration-id',
        registrations: rows,
      });
  return {
    registrations: registrations.sort(
      (left, right) =>
        lexical(left.id, right.id) || lexical(left.file, right.file) || left.line - right.line
    ),
    unresolved: unresolved.sort(
      (left, right) =>
        lexical(left.file ?? '', right.file ?? '') || (left.line ?? 0) - (right.line ?? 0)
    ),
    sourceFiles: [...observed].map((file) => relativeTo(absoluteRoot, file)).sort(lexical),
  };
}

function importMetaGlobPatterns(ast) {
  const patterns = [];
  visit(ast, (node) => {
    const callee = ts.isCallExpression(node) ? unwrapExpression(node.expression) : null;
    if (
      !ts.isCallExpression(node) ||
      !callee ||
      !ts.isPropertyAccessExpression(callee) ||
      callee.name.text !== 'glob' ||
      unwrapExpression(callee.expression)?.getText(ast) !== 'import.meta' ||
      !node.arguments[0]
    )
      return;
    const first = unwrapExpression(node.arguments[0]);
    if (ts.isStringLiteralLike(first)) patterns.push({ pattern: first.text, node });
    else if (ts.isArrayLiteralExpression(first))
      for (const element of first.elements) {
        const value = staticString(element);
        if (value === null) patterns.push({ pattern: null, node: element });
        else patterns.push({ pattern: value, node: element });
      }
    else patterns.push({ pattern: null, node: first });
  });
  return patterns;
}

async function expandSourceGlob(root, importerFile, pattern) {
  if (typeof pattern !== 'string' || !pattern.includes('**'))
    return { files: [], unresolved: 'glob-pattern-is-not-a-supported-recursive-literal' };
  const marker = pattern.indexOf('**');
  const prefix = pattern.slice(0, marker);
  const suffix = pattern.slice(marker + 2).replace(/^[/\\]/u, '');
  if (/[*?{}]/u.test(prefix) || !suffix || /[{}]/u.test(suffix))
    return { files: [], unresolved: 'glob-pattern-has-unsupported-wildcard-shape' };
  const base = path.resolve(path.dirname(importerFile), prefix || '.');
  const relativeBase = path.relative(root, base);
  if (relativeBase.startsWith('..') || path.isAbsolute(relativeBase))
    return { files: [], unresolved: 'glob-base-escapes-repository-root' };
  const suffixPattern = new RegExp(
    `^(?:.*/)?${suffix
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replaceAll('\\*', '[^/]*')
      .replaceAll('\\?', '[^/]')}$`
  );
  const all = await walkFilesIncludingHidden(base);
  return {
    files: all
      .filter((file) => suffixPattern.test(relativeTo(base, file)))
      .sort((left, right) => lexical(relativeTo(root, left), relativeTo(root, right))),
    unresolved: null,
  };
}

/** Mirror only static import.meta.glob path membership; authored demo modules are parsed, never imported. */
export async function discoverDemoDeclarations({
  root = DEFAULT_ROOT,
  loaderFile = 'apps/www/src/components/PrototypePreviewer/demo-modules.ts',
} = {}) {
  const absoluteRoot = path.resolve(root);
  const loaderPath = path.isAbsolute(loaderFile) ? loaderFile : path.join(absoluteRoot, loaderFile);
  const observed = new Set();
  const ast = await source(loaderPath, observed);
  const patterns = importMetaGlobPatterns(ast);
  const declarations = [];
  const unresolved = [];
  const byId = new Map();
  if (!patterns.length)
    unresolved.push({
      file: relativeTo(absoluteRoot, loaderPath),
      line: 1,
      reason: 'demo-loader-has-no-static-import-meta-glob',
    });
  for (const entry of patterns) {
    if (entry.pattern === null) {
      unresolved.push({
        ...sourceLocation(absoluteRoot, loaderPath, entry.node),
        reason: 'demo-glob-pattern-is-dynamic',
      });
      continue;
    }
    const expanded = await expandSourceGlob(absoluteRoot, loaderPath, entry.pattern);
    if (expanded.unresolved) {
      unresolved.push({
        ...sourceLocation(absoluteRoot, loaderPath, entry.node),
        reason: expanded.unresolved,
        expression: entry.pattern,
      });
      continue;
    }
    for (const file of expanded.files) {
      const id = path.basename(file).replace(/\.demo\.ts$/u, '');
      if (!path.basename(file).endsWith('.demo.ts')) continue;
      const declarationAst = await source(file, observed);
      const prototypeIds = new Set();
      const unresolvedBindings = [];
      const imports = importsForSourceFile(declarationAst);
      visit(declarationAst, (node) => {
        if (!ts.isPropertyAssignment(node) || propertyName(node.name) !== 'prototypeId') return;
        const prototypeId = staticString(node.initializer);
        if (prototypeId !== null) prototypeIds.add(prototypeId);
        else
          unresolvedBindings.push({
            ...sourceLocation(absoluteRoot, file, node),
            expression: node.initializer.getText(),
          });
      });
      for (const statement of declarationAst.statements) {
        if (!ts.isExportAssignment(statement) || statement.isExportEquals) continue;
        const value = unwrapExpression(statement.expression);
        if (value && ts.isObjectLiteralExpression(value)) continue;
        const callee =
          value && ts.isCallExpression(value) ? unwrapExpression(value.expression) : null;
        const calleeName = callee && ts.isIdentifier(callee) ? callee.text : null;
        const imported = calleeName ? imports.get(calleeName) : null;
        unresolvedBindings.push({
          ...sourceLocation(absoluteRoot, file, statement),
          reason: ts.isCallExpression(value)
            ? 'default-demo-factory-not-statically-resolved'
            : 'default-demo-export-not-a-static-object',
          expression: statement.expression.getText(),
          ...(imported ? { specifier: imported.specifier, exportName: imported.exportName } : {}),
        });
      }
      const row = {
        id,
        file: relativeTo(absoluteRoot, file),
        globPattern: entry.pattern,
        hiddenPath: relativeTo(absoluteRoot, file)
          .split('/')
          .some((segment) => segment.startsWith('.')),
        prototypeIds: [...prototypeIds].sort(lexical),
        unresolvedBindings,
      };
      declarations.push(row);
      const rows = byId.get(id) ?? [];
      rows.push(row);
      byId.set(id, rows);
      if (rows.length > 1)
        unresolved.push({
          id,
          reason: 'duplicate-demo-id-from-current-loader-glob',
          files: rows.map((item) => item.file).sort(lexical),
        });
    }
  }
  return {
    declarations: declarations.sort(
      (left, right) => lexical(left.id, right.id) || lexical(left.file, right.file)
    ),
    byId,
    unresolved: unresolved.sort(
      (left, right) =>
        lexical(left.file ?? '', right.file ?? '') || (left.line ?? 0) - (right.line ?? 0)
    ),
    patterns: patterns.map((entry) => entry.pattern),
    sourceFiles: [...observed].map((file) => relativeTo(absoluteRoot, file)).sort(lexical),
  };
}

export async function discoverAutomaticPrototypeRegistrations({
  root = DEFAULT_ROOT,
  registryFile = 'apps/www/src/components/PrototypePreviewer/prototype-modules.ts',
} = {}) {
  const absoluteRoot = path.resolve(root);
  const registryPath = path.isAbsolute(registryFile)
    ? registryFile
    : path.join(absoluteRoot, registryFile);
  const observed = new Set();
  const ast = await source(registryPath, observed);
  const patterns = importMetaGlobPatterns(ast);
  const registrations = [];
  const unresolved = [];
  for (const entry of patterns) {
    if (entry.pattern === null) {
      unresolved.push({
        ...sourceLocation(absoluteRoot, registryPath, entry.node),
        reason: 'automatic-prototype-glob-is-dynamic',
      });
      continue;
    }
    const expanded = await expandSourceGlob(absoluteRoot, registryPath, entry.pattern);
    if (expanded.unresolved) {
      unresolved.push({
        ...sourceLocation(absoluteRoot, registryPath, entry.node),
        reason: expanded.unresolved,
        expression: entry.pattern,
      });
      continue;
    }
    for (const file of expanded.files) {
      if (!path.basename(file).endsWith('.demo.proto.ts')) continue;
      registrations.push({
        id: path.basename(file).replace(/\.demo\.proto\.ts$/u, ''),
        file: relativeTo(absoluteRoot, file),
        exportName: 'default',
        call: 'automatic-default-export',
        globPattern: entry.pattern,
        hiddenPath: relativeTo(absoluteRoot, file)
          .split('/')
          .some((segment) => segment.startsWith('.')),
      });
    }
  }
  return {
    registrations: registrations.sort(
      (left, right) => lexical(left.id, right.id) || lexical(left.file, right.file)
    ),
    unresolved,
    patterns: patterns.map((entry) => entry.pattern),
    sourceFiles: [...observed].map((file) => relativeTo(absoluteRoot, file)).sort(lexical),
  };
}

/** Resolve the homepage's finite family-bound Prototype candidates from source AST and manifest data. */
export async function discoverHomepagePrototypeCandidates({
  root = DEFAULT_ROOT,
  registeredPrototypeIds = null,
} = {}) {
  const absoluteRoot = path.resolve(root);
  const familyFile = path.join(absoluteRoot, 'apps/www/src/components/site-library-family.ts');
  const manifestFile = path.join(
    absoluteRoot,
    'apps/www/src/components/PrototypePreviewer/projection-families.ts'
  );
  if (registeredPrototypeIds === null) {
    const manual = await discoverPrototypeRegistrations({ root: absoluteRoot });
    const automatic = await discoverAutomaticPrototypeRegistrations({ root: absoluteRoot });
    registeredPrototypeIds = new Set([
      ...manual.registrations.map((row) => row.id),
      ...automatic.registrations.map((row) => row.id),
    ]);
  } else if (!(registeredPrototypeIds instanceof Set)) {
    registeredPrototypeIds = new Set(registeredPrototypeIds);
  }
  const familyAst = await source(familyFile);
  const familyType = familyAst.statements.find(
    (statement) =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === 'SiteLibraryFamily'
  );
  const familyIds = [];
  if (familyType) {
    const members = ts.isUnionTypeNode(familyType.type) ? familyType.type.types : [familyType.type];
    for (const member of members) {
      const literal = member;
      if (ts.isLiteralTypeNode(literal) && ts.isStringLiteralLike(literal.literal))
        familyIds.push(literal.literal.text);
    }
  }
  const manifestAst = await source(manifestFile);
  const topLevel = new Map();
  for (const statement of manifestAst.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name) && declaration.initializer)
        topLevel.set(declaration.name.text, declaration.initializer);
  }
  const objectLiteral = (value) => {
    value = unwrapExpression(value);
    if (
      value &&
      ts.isCallExpression(value) &&
      value.expression.getText(value.getSourceFile()) === 'Object.freeze'
    )
      value = unwrapExpression(value.arguments[0]);
    return value && ts.isObjectLiteralExpression(value) ? value : null;
  };
  const property = (object, name) => {
    object = objectLiteral(object) ?? object;
    if (!object || !ts.isObjectLiteralExpression(object)) return null;
    return (
      object.properties.find(
        (item) => ts.isPropertyAssignment(item) && staticObjectKey(item) === name
      ) ?? null
    );
  };
  const manifestRegistry = objectLiteral(topLevel.get('PROJECTION_FAMILY_MANIFESTS'));
  const familyManifests = new Map();
  for (const family of familyIds) {
    const entry = property(manifestRegistry, family);
    const value =
      entry && ts.isPropertyAssignment(entry) ? unwrapExpression(entry.initializer) : null;
    const manifest =
      value && ts.isIdentifier(value)
        ? objectLiteral(topLevel.get(value.text))
        : objectLiteral(value);
    if (manifest) familyManifests.set(family, manifest);
  }
  const manifestIds = new Set();
  for (const manifest of familyManifests.values())
    visit(manifest, (node) => {
      if (ts.isPropertyAssignment(node) && staticObjectKey(node) === 'prototypeId') {
        const value = staticString(node.initializer);
        if (value !== null) manifestIds.add(value);
      }
    });
  const partPrototype = (family, kind, part = 'root') => {
    const manifest = familyManifests.get(family);
    const families = property(manifest, 'families');
    const familyEntry = property(
      families && ts.isPropertyAssignment(families) ? families.initializer : null,
      kind
    );
    const parts =
      familyEntry && ts.isPropertyAssignment(familyEntry)
        ? property(familyEntry.initializer, 'parts')
        : null;
    const partEntry = property(
      parts && ts.isPropertyAssignment(parts) ? parts.initializer : null,
      part
    );
    const prototypeEntry =
      partEntry && ts.isPropertyAssignment(partEntry)
        ? property(partEntry.initializer, 'prototypeId')
        : null;
    return prototypeEntry && ts.isPropertyAssignment(prototypeEntry)
      ? staticString(prototypeEntry.initializer)
      : null;
  };
  const candidateIds = new Set();
  const candidateSources = new Map();
  const unresolved = [];
  const addCandidate = (id, relativeFile, node, reason) => {
    if (!id) return;
    candidateIds.add(id);
    const sources = candidateSources.get(id) ?? [];
    sources.push({
      ...sourceLocation(absoluteRoot, path.join(absoluteRoot, relativeFile), node),
      reason,
      expression: node.getText(),
    });
    candidateSources.set(id, sources);
  };
  const files = [
    'apps/www/src/components/Homepage/homepage-demo-participant.ts',
    'apps/www/src/components/Homepage/homepage-gallery-parts.ts',
    'apps/www/src/components/Homepage/homepage-runtime-client.ts',
    'apps/www/src/components/Homepage/homepage-showcase.ts',
    'apps/www/src/components/PrototypePreviewer/projection-families.ts',
    'apps/www/src/components/site-library-family.ts',
    'apps/www/src/components/surface-recipes.ts',
  ];
  for (const relativeFile of files) {
    const file = path.join(absoluteRoot, relativeFile);
    const ast = await source(file);
    visit(ast, (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const kind =
          name === 'resolveProjectionPart'
            ? staticString(node.arguments[1])
            : name === 'part'
              ? staticString(node.arguments[0])
              : null;
        if (kind !== null) {
          const part =
            (name === 'resolveProjectionPart'
              ? staticString(node.arguments[2])
              : staticString(node.arguments[1])) ?? 'root';
          for (const family of familyIds) {
            const id = partPrototype(family, kind, part);
            if (id) addCandidate(id, relativeFile, node, 'projection-manifest-part-reference');
          }
        }
        if (name === 'resolveProjectionSelectParts') {
          for (const family of familyIds) {
            const manifest = familyManifests.get(family);
            const families = property(manifest, 'families');
            const select = property(
              families && ts.isPropertyAssignment(families) ? families.initializer : null,
              'select'
            );
            const parts = property(
              select && ts.isPropertyAssignment(select) ? select.initializer : null,
              'parts'
            );
            const partsObject =
              parts && ts.isPropertyAssignment(parts) ? objectLiteral(parts.initializer) : null;
            if (!partsObject) continue;
            for (const partEntry of partsObject.properties) {
              if (!ts.isPropertyAssignment(partEntry)) continue;
              const id = partPrototype(family, 'select', staticObjectKey(partEntry) ?? '');
              if (id) addCandidate(id, relativeFile, node, 'projection-select-parts-reference');
            }
          }
        }
      }
      if (ts.isTemplateExpression(node)) {
        let values = [node.head.text];
        for (const span of node.templateSpans) {
          const expression = unwrapExpression(span.expression);
          const substitutions =
            expression &&
            ts.isIdentifier(expression) &&
            ['family', 'projectionFamilyId'].includes(expression.text)
              ? familyIds
              : staticString(expression) !== null
                ? [staticString(expression)]
                : null;
          if (!substitutions || values.length * substitutions.length > 256) {
            values = [];
            break;
          }
          values = values.flatMap((prefix) =>
            substitutions.map((value) => `${prefix}${value}${span.literal.text}`)
          );
        }
        for (const value of values)
          if (registeredPrototypeIds.has(value) || manifestIds.has(value))
            addCandidate(value, relativeFile, node, 'family-template-prototype-reference');
      }
      if (
        relativeFile !== 'apps/www/src/components/PrototypePreviewer/projection-families.ts' &&
        ts.isPropertyAssignment(node) &&
        staticObjectKey(node) === 'prototypeId'
      ) {
        const id = staticString(node.initializer);
        if (id && (registeredPrototypeIds.has(id) || manifestIds.has(id)))
          addCandidate(id, relativeFile, node, 'homepage-prototypeId-property');
      }
    });
  }
  if (!familyIds.length)
    unresolved.push({
      file: relativeTo(absoluteRoot, familyFile),
      reason: 'site-library-family-set-is-not-a-literal-string-union',
    });
  if (familyManifests.size !== familyIds.length)
    unresolved.push({
      file: relativeTo(absoluteRoot, manifestFile),
      reason: 'homepage-family-manifest-source-is-unresolved',
    });
  return {
    families: familyIds,
    prototypeIds: [...candidateIds].sort(lexical),
    candidates: [...candidateSources]
      .map(([id, sources]) => ({
        id,
        sources: sources.sort(
          (left, right) => left.line - right.line || lexical(left.file, right.file)
        ),
      }))
      .sort((left, right) => lexical(left.id, right.id)),
    sources: files,
    unresolved,
  };
}

export async function generateWebsiteInventory({ root = DEFAULT_ROOT, outputPath = null } = {}) {
  const www = path.join(root, 'apps/www');
  const require = createRequire(path.join(www, 'package.json'));
  const { unified } = await import(require.resolve('unified'));
  const { default: remarkParse } = await import(require.resolve('remark-parse'));
  const { default: remarkMdx } = await import(require.resolve('remark-mdx'));
  const { parse: parseAstro } = await import(
    createRequire(require.resolve('astro/package.json')).resolve('@astrojs/compiler')
  );
  const { compileFile } = await import('../../packages/compiler/src/compile.ts');
  const { isLocalSourceSpecifier, resolveLocalSource, runtimeSourceEdges, sourceName } =
    await import('../../packages/compiler/src/source-resolution.ts');
  const markdown = unified().use(remarkParse).use(remarkMdx);
  const relative = (file) => relativeTo(root, file);
  const inputBefore = await snapshotInputBinding(root);
  if (inputBefore.gitBindingError || !inputBefore.revision)
    throw new Error(
      `Inventory Git source membership is unavailable: ${inputBefore.gitBindingError ?? 'no HEAD revision'}`
    );
  const dependenciesBefore = await snapshotDependencyBinding(www);
  const historicalBytes = await readFile(
    path.join(root, 'scripts/compiler/website-demo-migrations-829.json')
  );
  const historicalSha256 = createHash('sha256').update(historicalBytes).digest('hex');
  if (historicalSha256 !== HISTORICAL_INVENTORY.sha256)
    throw new Error(
      `Historical inventory bytes differ from immutable #829 evidence: ${historicalSha256}`
    );
  const historicalInventory = JSON.parse(historicalBytes.toString('utf8'));
  const historicalDate = '2026-10-06T18:45:47+08:00';
  const registrationScan = await discoverPrototypeRegistrations({ root });
  const automaticScan = await discoverAutomaticPrototypeRegistrations({ root });
  const demoScan = await discoverDemoDeclarations({ root });
  const registrationLists = new Map();
  for (const registration of [...registrationScan.registrations, ...automaticScan.registrations]) {
    const rows = registrationLists.get(registration.id) ?? [];
    rows.push(registration);
    registrationLists.set(registration.id, rows);
  }
  const prototypeRegistrations = new Map(
    [...registrationLists].map(([id, rows]) => [
      id,
      rows.sort((left, right) => lexical(left.file, right.file)),
    ])
  );
  const registrationUnresolved = [
    ...registrationScan.unresolved,
    ...automaticScan.unresolved,
    ...[...prototypeRegistrations]
      .filter(([, rows]) => rows.length > 1)
      .map(([id, registrations]) => ({
        id,
        reason: 'manual-and-automatic-registration-collision',
        registrations,
      })),
  ];
  const demoDeclarations = new Map();
  for (const declaration of demoScan.declarations)
    if (!demoDeclarations.has(declaration.id)) demoDeclarations.set(declaration.id, declaration);

  const overviewFile = path.join(www, 'src/components/PrototypeLibraryOverview.astro');
  const libraries = new Map(
    [...extractOverviewEntries(await readFile(overviewFile, 'utf8'), relative(overviewFile))].map(
      ([library, entries]) => [
        library,
        entries
          .map((entry) => entry.demoId)
          .filter(Boolean)
          .sort(),
      ]
    )
  );
  const homepageCandidates = await discoverHomepagePrototypeCandidates({
    root,
    registeredPrototypeIds: new Set(prototypeRegistrations.keys()),
  });

  const surfaces = new Set([
    'PrototypePreviewer',
    'DemoPreviewer',
    'HomeDemoPreviewer',
    'DemoMatrix',
    'PrototypeLibraryOverview',
  ]);
  const componentFile = (specifier, containingFile) => {
    const normalized = specifier.replaceAll('\\', '/');
    if (normalized.startsWith('@/')) return path.join(www, 'src', normalized.slice(2));
    if (normalized.startsWith('.')) return path.resolve(path.dirname(containingFile), normalized);
    return null;
  };
  const expression = (text) => {
    const ast = ts.createSourceFile('mount.ts', `(${text})`, ts.ScriptTarget.Latest, true);
    return ast.parseDiagnostics.length || !ts.isExpressionStatement(ast.statements[0])
      ? null
      : ast.statements[0].expression;
  };
  const unwrap = (node) => {
    while (node && ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
  };
  // Only literal equality choices constrain dynamic mount IDs. Never execute author scripts.
  const choices = (node) => {
    node = unwrap(node);
    if (!node || !ts.isBinaryExpression(node)) return null;
    if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      const left = choices(node.left),
        right = choices(node.right);
      return left && right && left.key === right.key
        ? { key: left.key, values: [...new Set([...left.values, ...right.values])] }
        : null;
    }
    if (node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken) return null;
    const left = unwrap(node.left),
      right = unwrap(node.right);
    return (ts.isIdentifier(left) || ts.isPropertyAccessExpression(left)) &&
      ts.isStringLiteralLike(right)
      ? { key: left.getText(), values: [right.text] }
      : null;
  };
  const strings = (node, bindings) => {
    node = unwrap(node);
    if (!node) return null;
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node))
      return bindings.get(node.getText()) ?? null;
    if (!ts.isTemplateExpression(node)) return null;
    let values = [node.head.text];
    for (const span of node.templateSpans) {
      const part = strings(span.expression, bindings);
      if (!part || values.length * part.length > 256) return null;
      values = values.flatMap((prefix) => part.map((value) => prefix + value + span.literal.text));
    }
    return values;
  };
  const wrappers = new Map();
  async function wrapperMounts(file, seen = new Set()) {
    file = path.resolve(file);
    if (seen.has(file))
      return [
        {
          surface: 'unresolved-wrapper',
          attrs: new Map(),
          unresolved: [{ file: relative(file), reason: 'cyclic-astro-preview-wrapper' }],
        },
      ];
    if (wrappers.has(file)) return wrappers.get(file);
    const ancestry = new Set([...seen, file]);
    let ast;
    try {
      ({ ast } = await parseAstro(await readFile(file, 'utf8'), { position: true }));
    } catch (error) {
      const result = [
        {
          surface: 'unresolved-wrapper',
          attrs: new Map(),
          unresolved: [
            { file: relative(file), reason: 'astro-wrapper-parse-failed', error: String(error) },
          ],
        },
      ];
      wrappers.set(file, result);
      return result;
    }
    const frontmatter = ast.children.find((node) => node.type === 'frontmatter')?.value ?? '';
    const script = ts.createSourceFile(
      file,
      frontmatter,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const imports = new Map();
    const staticBindings = new Map();
    for (const statement of script.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const values = strings(expression(declaration.initializer.getText()), staticBindings);
        if (values) staticBindings.set(declaration.name.text, values);
      }
    }
    for (const statement of script.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !statement.importClause?.name ||
        statement.importClause.isTypeOnly ||
        !ts.isStringLiteralLike(statement.moduleSpecifier)
      )
        continue;
      const target = componentFile(statement.moduleSpecifier.text, file);
      if (target?.endsWith('.astro')) imports.set(statement.importClause.name.text, target);
    }
    const mounts = [];
    const walk = async (node, inherited) => {
      let bindings = inherited;
      if (node.type === 'expression') {
        const parsed = unwrap(
          expression(
            node.children.map((child) => (child.type === 'text' ? child.value : 'null')).join('')
          )
        );
        const selection =
          parsed &&
          ts.isBinaryExpression(parsed) &&
          parsed.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
            ? choices(parsed.left)
            : null;
        if (selection) {
          bindings = new Map(inherited);
          const prior = bindings.get(selection.key);
          bindings.set(
            selection.key,
            prior ? selection.values.filter((value) => prior.includes(value)) : selection.values
          );
        }
      }
      if (node.type === 'component') {
        const target = imports.get(node.name);
        const surface = target ? path.basename(target, '.astro') : node.name;
        if (surfaces.has(surface)) {
          const attrs = new Map(),
            unresolved = [];
          for (const attr of node.attributes ?? []) {
            if (!attr.name) {
              unresolved.push({
                file: relative(file),
                line: attr.position?.start.line ?? node.position.start.line,
                reason: 'astro-component-spread-attributes-may-bind-demo-identities',
                expression: attr.value ?? null,
              });
              continue;
            }
            if (!['demoId', 'prototypeId', 'library'].includes(attr.name)) continue;
            const values =
              attr.kind === 'quoted'
                ? [attr.value]
                : attr.kind === 'expression'
                  ? strings(expression(attr.value), new Map([...staticBindings, ...bindings]))
                  : null;
            if (values) attrs.set(attr.name, values);
            else
              unresolved.push({
                file: relative(file),
                line: attr.position?.start.line ?? node.position.start.line,
                reason: 'astro-preview-attribute-is-dynamic',
                expression: `${attr.name}=${attr.value}`,
              });
          }
          mounts.push({
            surface,
            attrs,
            unresolved,
            via: { file: relative(file), surface, line: node.position.start.line },
          });
          return;
        }
        if (target?.endsWith('.astro')) mounts.push(...(await wrapperMounts(target, ancestry)));
      }
      for (const child of node.children ?? []) await walk(child, bindings);
    };
    await walk(ast, new Map());
    wrappers.set(file, mounts);
    return mounts;
  }
  const pages = [];
  const pageParseFailures = [];
  const walkMarkdown = (node, callback) => {
    callback(node);
    for (const child of node.children ?? []) walkMarkdown(child, callback);
  };
  const literalDemos = (value, found) => {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'Literal' && demoDeclarations.has(value.value)) found.add(value.value);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) for (const item of child) literalDemos(item, found);
      else if (child && typeof child === 'object') literalDemos(child, found);
    }
  };
  const docsRoot = path.join(www, 'src/content/docs');
  const documentationSources = (await walkFilesIncludingHidden(docsRoot))
    .filter((file) => ['.md', '.mdx'].includes(path.extname(file).toLowerCase()))
    .sort((left, right) => lexical(relative(left), relative(right)));
  for (const file of documentationSources) {
    const text = await readFile(file, 'utf8');
    // Markdown-only pages cannot mount JSX components; do not count quoted examples as demos.
    if (!file.endsWith('.mdx')) continue;
    // Use the existing Markdown renderer's preamble rule; retain line coordinates.
    const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, (preamble) =>
      preamble.replace(/[^\r\n]/g, ' ')
    );
    let tree;
    try {
      tree = markdown.parse(body);
    } catch (error) {
      pageParseFailures.push({
        file: relative(file),
        route: normalizeDocRoute(relativeTo(docsRoot, file)),
        reason: 'mdx-source-parse-failed',
        error: String(error),
      });
      continue;
    }
    const declarations = new Set(),
      imports = new Map();
    walkMarkdown(tree, (node) => {
      if (node.type !== 'mdxjsEsm') return;
      literalDemos(node.data?.estree, declarations);
      for (const statement of node.data?.estree?.body ?? []) {
        if (statement.type !== 'ImportDeclaration') continue;
        const target = componentFile(statement.source.value, file);
        if (!target?.endsWith('.astro')) continue;
        for (const binding of statement.specifiers ?? [])
          if (binding.type === 'ImportDefaultSpecifier') imports.set(binding.local.name, target);
      }
    });
    const mounted = [];
    walkMarkdown(tree, (node) => {
      if (
        ['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type) &&
        (surfaces.has(node.name) || imports.has(node.name))
      )
        mounted.push(node);
    });
    const directMount = (node, surface) => {
      const attrs = new Map();
      const unresolved = [];
      for (const item of node.attributes ?? []) {
        if (item.type === 'mdxJsxExpressionAttribute') {
          unresolved.push({
            file: relative(file),
            line: item.position?.start.line ?? node.position.start.line,
            reason: 'mdx-spread-attributes-may-bind-demo-identities',
            expression: item.value,
          });
          continue;
        }
        if (
          item.type !== 'mdxJsxAttribute' ||
          !['demoId', 'prototypeId', 'library'].includes(item.name)
        )
          continue;
        if (typeof item.value === 'string') {
          attrs.set(item.name, [item.value]);
          continue;
        }
        if (
          item.value &&
          typeof item.value === 'object' &&
          item.value.type === 'mdxJsxAttributeValueExpression'
        ) {
          const values = strings(expression(item.value.value), new Map());
          if (values) attrs.set(item.name, values);
          else
            unresolved.push({
              file: relative(file),
              line: item.position?.start.line ?? node.position.start.line,
              reason: 'mdx-preview-attribute-is-dynamic',
              expression: `${item.name}={${item.value.value}}`,
            });
        }
      }
      return { surface, attrs, unresolved };
    };
    const rows = [];
    for (const node of mounted) {
      const target = imports.get(node.name);
      const directSurface = target ? path.basename(target, '.astro') : node.name;
      const mounts = surfaces.has(directSurface)
        ? [directMount(node, directSurface)]
        : await wrapperMounts(target);
      for (const mount of mounts) {
        const attrs = mount.attrs;
        const ids = new Set(),
          prototypeIds = new Set(),
          possiblePrototypeIds = new Set(),
          unresolved = [...mount.unresolved];
        for (const id of attrs.get('demoId') ?? []) ids.add(id);
        for (const id of attrs.get('prototypeId') ?? []) prototypeIds.add(id);
        if (mount.surface === 'DemoMatrix') {
          for (const id of demoDeclarations.keys()) ids.add(id);
          unresolved.push(...demoScan.unresolved);
        }
        if (mount.surface === 'HomeDemoPreviewer') {
          for (const id of declarations) ids.add(id);
          for (const id of homepageCandidates.prototypeIds) possiblePrototypeIds.add(id);
          unresolved.push({
            file: 'apps/www/src/components/Homepage/homepage-demo-participant.ts',
            reason:
              'homepage-showcase-content-is-selected-from-runtime-family-and-source-manifests',
            families: homepageCandidates.families,
            possiblePrototypeIds: homepageCandidates.prototypeIds,
            candidateSources: homepageCandidates.candidates,
            supportingSources: homepageCandidates.sources,
          });
          unresolved.push(...homepageCandidates.unresolved);
        }
        if (mount.surface === 'PrototypeLibraryOverview') {
          const selected = attrs.get('library') ?? [];
          if (!selected.length)
            unresolved.push('Library selection requires a source-bound resolution.');
          for (const library of selected) {
            if (libraries.has(library)) for (const id of libraries.get(library)) ids.add(id);
            else unresolved.push(`Missing library declaration: ${library}`);
          }
        }
        for (const id of ids) {
          const demo = demoDeclarations.get(id);
          if (!demo) {
            unresolved.push({ reason: 'missing-demo-declaration', id });
            continue;
          }
          for (const prototypeId of demo.prototypeIds) prototypeIds.add(prototypeId);
          for (const binding of demo.unresolvedBindings) unresolved.push(binding);
          if ((demoScan.byId.get(id) ?? []).length > 1)
            unresolved.push({ id, reason: 'demo-id-has-multiple-loader-source-files' });
        }
        if (!ids.size && !prototypeIds.size && !possiblePrototypeIds.size)
          unresolved.push({ reason: 'no-statically-resolved-demo-or-prototype' });
        rows.push({
          surface: mount.surface,
          mountedAs: node.name,
          line: node.position.start.line,
          ...(mount.via ? { via: mount.via } : {}),
          demoIds: [...ids].sort(),
          prototypeIds: [...prototypeIds].sort(),
          possiblePrototypeIds: [...possiblePrototypeIds].sort(),
          unresolved,
        });
      }
    }
    if (!rows.length) continue;
    pages.push({
      file: relative(file),
      route: normalizeDocRoute(relativeTo(docsRoot, file)),
      hiddenPath: relativeTo(root, file)
        .split('/')
        .some((segment) => segment.startsWith('.')),
      rows,
      migration: 'not-migrated',
      ownerIssue: 817,
    });
  }

  const usageById = new Map();
  for (const page of pages)
    for (const row of page.rows) {
      for (const id of row.prototypeIds) {
        const uses = usageById.get(id) ?? [];
        uses.push({
          page: page.file,
          route: page.route,
          surface: row.surface,
          certainty: 'source-resolved',
        });
        usageById.set(id, uses);
      }
      for (const id of row.possiblePrototypeIds) {
        const uses = usageById.get(id) ?? [];
        uses.push({
          page: page.file,
          route: page.route,
          surface: row.surface,
          certainty: 'possible-dynamic-family-branch',
        });
        usageById.set(id, uses);
      }
    }

  const compilerRoot = await realpath(root);
  const compileSourceSnapshot = async (entry) => {
    const files = Object.create(null);
    let entryName = sourceName(relativeTo(compilerRoot, path.resolve(entry)));
    let error = null;
    const load = async (filename) => {
      const absolute = await realpath(filename);
      const identityPath = relativeTo(compilerRoot, absolute);
      if (identityPath === '..' || identityPath.startsWith('../') || path.isAbsolute(identityPath))
        throw new Error(`Compiler source ${filename} escapes the declared project root.`);
      const identity = sourceName(identityPath);
      if (Object.hasOwn(files, identity)) return identity;
      const text = await readFile(absolute, 'utf8');
      files[identity] = text;
      const ast = ts.createSourceFile(identity, text, ts.ScriptTarget.Latest, true);
      for (const edge of runtimeSourceEdges(ast)) {
        if (!isLocalSourceSpecifier(edge.specifier)) continue;
        const target = await resolveLocalSource(compilerRoot, identity, edge.specifier);
        await load(path.join(compilerRoot, target));
      }
      return identity;
    };
    try {
      entryName = await load(path.resolve(entry));
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    return { snapshot: { entry: entryName, files }, error };
  };

  const unavailableCurrentBrowserHost = 'unavailable-in-current-main-no-browser-host';
  const admissions = [];
  for (const id of [...usageById.keys()].sort(lexical)) {
    const registrations = prototypeRegistrations.get(id) ?? [];
    const base = {
      id,
      usage: usageById.get(id),
      target: 'web-component-source-v1',
      statuses: {
        nodeAdmission: 'unresolved-registration',
        wasmExecution: unavailableCurrentBrowserHost,
        preview: 'not-run',
        migration: 'not-migrated',
      },
      ownerIssue: 817,
    };
    if (!registrations.length) {
      admissions.push({
        ...base,
        unresolved: { reason: 'no-current-manual-or-automatic-registration' },
      });
      continue;
    }
    if (registrations.length !== 1) {
      admissions.push({
        ...base,
        statuses: { ...base.statuses, nodeAdmission: 'ambiguous-registration' },
        unresolved: { reason: 'multiple-current-registration-paths', registrations },
      });
      continue;
    }
    const registration = registrations[0];
    const registrationFile =
      registration.call === 'automatic-default-export'
        ? path.join(root, registration.file)
        : resolveSource(registration.specifier, path.join(root, registration.file), root);
    const forwardingInputs = new Set();
    let origin;
    try {
      if (registrationFile)
        origin = await definition(registrationFile, registration.exportName, {
          root,
          observed: forwardingInputs,
        });
    } catch (error) {
      admissions.push({
        ...base,
        registration,
        statuses: { ...base.statuses, nodeAdmission: 'unresolved-forwarding' },
        unresolved: { reason: 'registration-forwarding-failed', error: String(error) },
        forwardingInputs: [...forwardingInputs].map(relative).sort(lexical),
      });
      continue;
    }
    const file = origin?.file;
    const relativeEntry = file ? relative(file) : null;
    if (
      !file ||
      relativeEntry === '..' ||
      relativeEntry.startsWith('../') ||
      path.isAbsolute(relativeEntry)
    ) {
      admissions.push({
        ...base,
        registration,
        statuses: { ...base.statuses, nodeAdmission: 'unresolved-source' },
        unresolved: { reason: 'registration-source-is-missing-or-outside-project-root' },
        forwardingInputs: [...forwardingInputs].map(relative).sort(lexical),
      });
      continue;
    }
    const sourceClosure = await compileSourceSnapshot(file);
    const compileOptions = {
      root,
      exportName: origin.exportName,
      profile: 'web-component-source-v1',
    };
    const result = sourceClosure.error
      ? await compileFile(file, compileOptions)
      : await compileFile(file, { ...compileOptions, sourceSnapshot: sourceClosure.snapshot });
    const sourceFiles = Object.entries(sourceClosure.snapshot.files)
      .map(([sourcePath, content]) => ({
        file: sourcePath,
        sha256: createHash('sha256').update(content).digest('hex'),
      }))
      .sort((left, right) => lexical(left.file, right.file));
    const entryIdentity = sourceName(relativeEntry);
    admissions.push({
      ...base,
      registration: {
        ...registration,
        resolvedFile: registrationFile ? relative(registrationFile) : null,
        resolvedExportName: registration.exportName,
      },
      forwardingInputs: [...forwardingInputs].map(relative).sort(lexical),
      entry: relativeEntry,
      exportName: origin.exportName,
      entrySha256: sourceClosure.snapshot.files[entryIdentity]
        ? createHash('sha256').update(sourceClosure.snapshot.files[entryIdentity]).digest('hex')
        : null,
      sourceClosure: {
        status: sourceClosure.error ? 'unresolved' : 'closed-static-runtime-imports',
        error: sourceClosure.error,
        sourceFiles,
      },
      statuses: {
        nodeAdmission: result.ok ? 'compiled' : 'rejected',
        wasmExecution: unavailableCurrentBrowserHost,
        preview: 'not-run',
        migration: 'not-migrated',
      },
      ...(result.ok
        ? {
            definitionFile: result.value.ir.setup.span.file,
            compilerSourceFiles: result.value.ir.sourceFiles.map((source) => ({
              file: source.file,
              sha256: source.sha256,
            })),
          }
        : { diagnostics: result.diagnostics }),
      ...(sourceClosure.error
        ? {
            unresolved: {
              reason: 'source-closure-could-not-be-frozen',
              error: sourceClosure.error,
            },
          }
        : {}),
    });
  }
  for (const failure of pageParseFailures)
    pages.push({
      file: failure.file,
      route: failure.route,
      rows: [],
      discovery: { status: 'unresolved', reason: failure.reason, error: failure.error },
      migration: 'not-migrated',
      ownerIssue: 817,
    });
  pages.sort((left, right) => lexical(left.route, right.route) || lexical(left.file, right.file));

  const currentById = new Map(admissions.map((row) => [row.id, row]));
  const historicalRejectedRows = historicalInventory.prototypes.filter(
    (row) => row.nodeAdmission === 'rejected'
  );
  const historicalReconciliation = reconcileHistoricalRejections(historicalInventory, currentById);

  const inputAfter = await snapshotInputBinding(root);
  const dependenciesAfter = await snapshotDependencyBinding(www);
  if (dependenciesBefore.sha256 !== dependenciesAfter.sha256)
    throw new Error('Installed inventory/parser dependency inputs changed during generation.');
  const inputDrift = compareInputBindings(inputBefore, inputAfter);
  if (
    inputDrift.revisionChanged ||
    inputDrift.added.length ||
    inputDrift.removed.length ||
    inputDrift.changed.length
  )
    throw new Error(`Inventory inputs changed during generation: ${JSON.stringify(inputDrift)}`);
  const inputDigestByPath = new Map(inputAfter.files.map((file) => [file.path, file.sha256]));
  const compilerManifest = JSON.parse(
    await readFile(path.join(root, 'packages/compiler/package.json'), 'utf8')
  );
  const browserExportPaths = Object.keys(compilerManifest.exports ?? {}).filter(
    (key) => key === './browser' || key.startsWith('./browser/')
  );
  const output = path.resolve(root, outputPath ?? 'internal/compiler/website-demo-migrations.json');
  const inventory = {
    schemaVersion: 2,
    ownerIssue: 817,
    scope:
      'Current mounted demo-bearing MDX pages and the source-backed homepage, Matrix, library, manual, spread, exact-registration and automatic demo loaders. Discovery is static and AST-only; no page is excluded because compiler admission rejects or remains unresolved.',
    compilerBoundary:
      'Canonical private Node compileFile admission with explicit web-component-source-v1 only. This inventory is not browser-host delivery, WASM execution, preview, page migration, public compiler support or full parity evidence.',
    statuses: {
      nodeAdmission: 'source-classification-only',
      wasmExecution: unavailableCurrentBrowserHost,
      preview: 'not-run',
      migration: 'not-migrated',
    },
    browserHost: {
      status: browserExportPaths.length
        ? 'export-declared-in-current-package-manifest'
        : 'absent-from-current-package-manifest',
      manifest: 'packages/compiler/package.json',
      browserExportPaths,
      publicCompiler: compilerManifest.private ? 'private-package' : 'package-not-marked-private',
    },
    sourceProvenance: {
      revision: inputAfter.revision,
      worktreeBinding: inputAfter.revision?.exactForAllInputs
        ? 'exact-head-bytes'
        : 'dirty-or-untracked-inputs-bound-by-sha256',
      generator: {
        path: 'scripts/compiler/website-demo-inventory.mjs',
        sha256: inputDigestByPath.get('scripts/compiler/website-demo-inventory.mjs') ?? null,
      },
      immutableHistoricalGenerator: {
        revision: HISTORICAL_INVENTORY.revision,
        path: HISTORICAL_INVENTORY.generatorPath,
        sha256: HISTORICAL_INVENTORY.generatorSha256,
      },
      immutableHistoricalInventory: {
        revision: HISTORICAL_INVENTORY.revision,
        recordedAt: historicalDate,
        path: HISTORICAL_INVENTORY.path,
        sha256: historicalSha256,
      },
    },
    inputBinding: {
      ...inputAfter,
      stabilityCheck: inputDrift,
    },
    dependencyBinding: dependenciesAfter,
    inputScope: {
      includesHiddenPaths: true,
      sourceTrees: DEFAULT_SOURCE_TREES,
      staticInputs: STATIC_INPUT_PATHS,
      note: 'Membership and SHA-256 byte bindings include current source files plus tracked in-scope paths missing from the worktree; Git HEAD and index provenance are reported separately from worktree bytes.',
    },
    pages,
    documentationSources: documentationSources.map(relative).sort(lexical),
    demos: demoScan.declarations,
    registrationSources: {
      manual: registrationScan.registrations,
      automatic: automaticScan.registrations,
      unresolved: registrationUnresolved,
    },
    homepage: {
      families: homepageCandidates.families,
      possiblePrototypeIds: homepageCandidates.prototypeIds,
      candidates: homepageCandidates.candidates,
      sources: homepageCandidates.sources,
      unresolved: homepageCandidates.unresolved,
    },
    prototypes: admissions,
    unresolvedSourceBindings: {
      demos: demoScan.unresolved,
      registrations: registrationUnresolved,
      pages: pageParseFailures,
    },
    historicalEvidence: {
      source: {
        revision: HISTORICAL_INVENTORY.revision,
        recordedAt: historicalDate,
        path: HISTORICAL_INVENTORY.path,
        sha256: historicalSha256,
      },
      originalInventory: historicalInventory,
      rejectedRowCount: historicalRejectedRows.length,
      rejectedRowReconciliation: historicalReconciliation,
    },
  };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(inventory, null, 2) + '\n');
  console.log(
    JSON.stringify({
      output: relative(output),
      pages: pages.length,
      demos: demoScan.declarations.length,
      prototypes: admissions.length,
      compiled: admissions.filter((row) => row.statuses.nodeAdmission === 'compiled').length,
      rejected: admissions.filter((row) => row.statuses.nodeAdmission === 'rejected').length,
      unresolved: admissions.filter(
        (row) =>
          row.statuses.nodeAdmission.startsWith('unresolved') ||
          row.statuses.nodeAdmission === 'ambiguous-registration'
      ).length,
      historicalRejectedObligations: historicalReconciliation.length,
      migrated: 0,
    })
  );
  return inventory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateWebsiteInventory({ outputPath: process.argv[2] }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
