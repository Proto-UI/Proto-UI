import { createHash } from 'node:crypto';
import { glob, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { compileFile } from '../../packages/compiler/src/compile.ts';
import { extractOverviewEntries } from '../docs/check-public-docs.mjs';
import { resolveProtoUiSource } from '../../apps/www/src/utils/proto-ui-source.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const www = path.join(root, 'apps/www');
const require = createRequire(path.join(www, 'package.json'));
const { unified } = await import(require.resolve('unified'));
const { default: remarkParse } = await import(require.resolve('remark-parse'));
const { default: remarkMdx } = await import(require.resolve('remark-mdx'));
const markdown = unified().use(remarkParse).use(remarkMdx);
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const files = async (pattern) => {
  const matches = [];
  for await (const file of glob(pattern, { cwd: root })) matches.push(path.join(root, file));
  return matches.sort();
};
const source = async (file) =>
  ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
const visit = (node, callback) => {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
};
const propertyName = (node) => node?.text;
const resolveSource = (specifier, containingFile) =>
  specifier.startsWith('@proto.ui/')
    ? resolveProtoUiSource(specifier)
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
async function definition(file, exportName, seen = new Set()) {
  const identity = `${file}#${exportName}`;
  if (seen.has(identity))
    throw new Error(`Cyclic prototype forwarding: ${relative(file)}#${exportName}`);
  seen.add(identity);
  const ast = await source(file),
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
    const next = resolveSource(binding.specifier, file);
    if (!next)
      throw new Error(`Missing forwarded source ${binding.specifier} from ${relative(file)}`);
    return definition(next, binding.exportName, seen);
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

const demoDeclarations = new Map();
for (const file of await files('apps/www/src/content/**/*.demo.ts')) {
  const prototypeIds = new Set(),
    unresolvedBindings = [];
  visit(await source(file), (node) => {
    if (!ts.isPropertyAssignment(node) || propertyName(node.name) !== 'prototypeId') return;
    if (ts.isStringLiteralLike(node.initializer)) prototypeIds.add(node.initializer.text);
    else
      unresolvedBindings.push({
        line: node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1,
        expression: node.initializer.getText(),
      });
  });
  const id = path.basename(file, '.demo.ts');
  if (demoDeclarations.has(id)) throw new Error(`Duplicate demo ID: ${id}`);
  demoDeclarations.set(id, {
    id,
    file: relative(file),
    prototypeIds: [...prototypeIds].sort(),
    unresolvedBindings,
  });
}

// Mirror registration addresses, not prototype behavior. The normal compiler owns admission.
const registry = path.join(www, 'src/components/PrototypePreviewer/prototype-modules.ts');
const prototypes = new Map();
visit(await source(registry), (node) => {
  if (!ts.isPropertyAssignment(node) || !ts.isArrowFunction(node.initializer)) return;
  const imports = new Map();
  visit(node.initializer, (child) => {
    if (!ts.isVariableDeclaration(child) || !ts.isIdentifier(child.name)) return;
    const value =
      child.initializer && ts.isAwaitExpression(child.initializer)
        ? child.initializer.expression
        : child.initializer;
    if (
      value &&
      ts.isCallExpression(value) &&
      value.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteralLike(value.arguments[0])
    )
      imports.set(child.name.text, value.arguments[0].text);
  });
  visit(node.initializer, (child) => {
    if (
      !ts.isCallExpression(child) ||
      !ts.isIdentifier(child.expression) ||
      child.expression.text !== 'registerPrototype'
    )
      return;
    const [id, binding] = child.arguments;
    if (
      !id ||
      !ts.isStringLiteralLike(id) ||
      !binding ||
      !ts.isPropertyAccessExpression(binding) ||
      !ts.isIdentifier(binding.expression)
    )
      return;
    const specifier = imports.get(binding.expression.text);
    if (specifier)
      prototypes.set(id.text, {
        id: id.text,
        specifier,
        exportName: binding.name.text,
        containingFile: registry,
      });
  });
});
for (const file of await files('apps/www/src/content/**/*.demo.proto.ts')) {
  const id = path.basename(file, '.demo.proto.ts');
  if (!prototypes.has(id)) prototypes.set(id, { id, file, exportName: 'default' });
}

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

const surfaces = new Set([
  'PrototypePreviewer',
  'DemoPreviewer',
  'HomeDemoPreviewer',
  'DemoMatrix',
  'PrototypeLibraryOverview',
]);
const pages = [];
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
for (const file of await files('apps/www/src/content/docs/**/*.{md,mdx}')) {
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
    throw new Error(`${relative(file)}: ${error.message}`, { cause: error });
  }
  const declarations = new Set();
  walkMarkdown(tree, (node) => {
    if (node.type === 'mdxjsEsm') literalDemos(node.data?.estree, declarations);
  });
  const rows = [];
  walkMarkdown(tree, (node) => {
    if (!surfaces.has(node.name) || !['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type))
      return;
    const attrs = new Map(
      (node.attributes ?? [])
        .filter((item) => item.type === 'mdxJsxAttribute')
        .map((item) => [item.name, item.value])
    );
    const ids = new Set(),
      prototypeIds = new Set(),
      unresolved = [];
    if (typeof attrs.get('demoId') === 'string') ids.add(attrs.get('demoId'));
    if (typeof attrs.get('prototypeId') === 'string') prototypeIds.add(attrs.get('prototypeId'));
    if (node.name === 'DemoMatrix') for (const id of demoDeclarations.keys()) ids.add(id);
    if (node.name === 'HomeDemoPreviewer') for (const id of declarations) ids.add(id);
    if (node.name === 'PrototypeLibraryOverview') {
      const library = attrs.get('library');
      if (typeof library === 'string' && libraries.has(library))
        for (const id of libraries.get(library)) ids.add(id);
      else unresolved.push('Library selection requires a source-bound resolution.');
    }
    for (const id of ids) {
      const demo = demoDeclarations.get(id);
      if (!demo) {
        unresolved.push(`Missing demo declaration: ${id}`);
        continue;
      }
      for (const prototypeId of demo.prototypeIds) prototypeIds.add(prototypeId);
      for (const binding of demo.unresolvedBindings)
        unresolved.push(`${demo.file}:${binding.line}: ${binding.expression}`);
    }
    if (!ids.size && !prototypeIds.size)
      unresolved.push('No statically resolved demo or prototype.');
    rows.push({
      surface: node.name,
      line: node.position.start.line,
      demoIds: [...ids].sort(),
      prototypeIds: [...prototypeIds].sort(),
      unresolved,
    });
  });
  if (!rows.length) continue;
  const route = path
    .relative(path.join(www, 'src/content/docs'), file)
    .replace(/\.mdx$/, '')
    .replace(/\/index$/, '');
  pages.push({
    file: relative(file),
    route: `/${route}/`,
    rows,
    migration: 'not-migrated',
    ownerIssue: 817,
  });
}

const used = new Set(pages.flatMap((page) => page.rows.flatMap((row) => row.prototypeIds)));
const admissions = [];
for (const id of [...used].sort()) {
  const registration = prototypes.get(id);
  if (!registration) {
    admissions.push({ id, status: 'unresolved-registration', ownerIssue: 817 });
    continue;
  }
  const registrationFile =
    registration.file ?? resolveSource(registration.specifier, registration.containingFile);
  let origin;
  try {
    if (registrationFile) origin = await definition(registrationFile, registration.exportName);
  } catch (error) {
    admissions.push({ id, status: 'unresolved-forwarding', error: error.message, ownerIssue: 817 });
    continue;
  }
  const file = origin?.file;
  if (!file || path.relative(root, file).startsWith('..')) {
    admissions.push({
      id,
      status: 'unresolved-source',
      specifier: registration.specifier,
      exportName: registration.exportName,
      ownerIssue: 817,
    });
    continue;
  }
  const result = await compileFile(file, {
    root,
    exportName: origin.exportName,
    profile: 'web-component-source-v1',
  });
  admissions.push({
    id,
    registration: { file: relative(registrationFile), exportName: registration.exportName },
    entry: relative(file),
    exportName: origin.exportName,
    entrySha256: createHash('sha256')
      .update(await readFile(file))
      .digest('hex'),
    target: 'web-component-source-v1',
    nodeAdmission: result.ok ? 'compiled' : 'rejected',
    ...(result.ok
      ? {
          definitionFile: result.value.ir.setup.span.file,
          source: result.value.ir.source,
          sourceFiles: result.value.ir.sourceFiles.map((source) => ({
            file: source.file,
            sha256: source.sha256,
          })),
        }
      : { diagnostics: result.diagnostics }),
    browserWasm: 'not-exercised-for-this-registration-graph',
    preview: 'not-migrated',
    ownerIssue: 817,
  });
}
const output = path.resolve(
  root,
  process.argv[2] ?? 'internal/compiler/website-demo-migrations.json'
);
const inventory = {
  schemaVersion: 1,
  ownerIssue: 817,
  scope:
    'Every mounted demo-bearing MDX documentation page in this source tree; static declarations include possible conditional demo parts. No page is excluded merely because its compiler admission fails.',
  compilerBoundary:
    'Private canonical Node source admission only. Browser/WASM execution, target preview, optional editing and lifecycle/security evidence are separate per-row obligations; none is inferred from Node admission.',
  frameDependency: {
    carrierPr: 777,
    issue: 786,
    note: 'Existing RuntimeBox frame work is an open, unmerged carrier; do not create a competing frame convention.',
  },
  pages,
  demos: [...demoDeclarations.values()].sort((a, b) => a.id.localeCompare(b.id)),
  prototypes: admissions,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(inventory, null, 2) + '\n');
console.log(
  JSON.stringify({
    output: relative(output),
    pages: pages.length,
    demos: demoDeclarations.size,
    prototypes: admissions.length,
    compiled: admissions.filter((row) => row.nodeAdmission === 'compiled').length,
    rejected: admissions.filter((row) => row.nodeAdmission === 'rejected').length,
    unresolved: admissions.filter((row) => row.status).length,
    migrated: 0,
  })
);
