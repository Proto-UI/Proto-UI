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
const { parse: parseAstro } = await import(
  createRequire(require.resolve('astro/package.json')).resolve('@astrojs/compiler')
);
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
const componentFile = (specifier, containingFile) =>
  specifier.startsWith('@/')
    ? path.join(www, 'src', specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(containingFile), specifier)
      : null;
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
  if (seen.has(file)) throw new Error(`Cyclic Astro preview wrapper: ${relative(file)}`);
  if (wrappers.has(file)) return wrappers.get(file);
  const ancestry = new Set([...seen, file]);
  const { ast } = await parseAstro(await readFile(file, 'utf8'), { position: true });
  const frontmatter = ast.children.find((node) => node.type === 'frontmatter')?.value ?? '';
  const script = ts.createSourceFile(
    file,
    frontmatter,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const imports = new Map();
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
          if (!['demoId', 'prototypeId', 'library'].includes(attr.name)) continue;
          const values =
            attr.kind === 'quoted'
              ? [attr.value]
              : attr.kind === 'expression'
                ? strings(expression(attr.value), bindings)
                : null;
          if (values) attrs.set(attr.name, values);
          else
            unresolved.push(
              `${relative(file)}:${attr.position?.start.line ?? node.position.start.line}: unresolved ${attr.name}=${attr.value}`
            );
        }
        mounts.push({
          surface,
          attrs,
          unresolved,
          via: { file: relative(file), surface, line: node.position.start.line },
        });
        return;
      }
      if (target) mounts.push(...(await wrapperMounts(target, ancestry)));
    }
    for (const child of node.children ?? []) await walk(child, bindings);
  };
  await walk(ast, new Map());
  wrappers.set(file, mounts);
  return mounts;
}
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
  const rows = [];
  for (const node of mounted) {
    const target = imports.get(node.name);
    const directSurface = target ? path.basename(target, '.astro') : node.name;
    const mounts = surfaces.has(directSurface)
      ? [
          {
            surface: directSurface,
            attrs: new Map(
              (node.attributes ?? [])
                .filter((item) => item.type === 'mdxJsxAttribute')
                .map((item) => [item.name, typeof item.value === 'string' ? [item.value] : []])
            ),
            unresolved: [],
          },
        ]
      : await wrapperMounts(target);
    for (const mount of mounts) {
      const attrs = mount.attrs;
      const ids = new Set(),
        prototypeIds = new Set(),
        unresolved = [...mount.unresolved];
      for (const id of attrs.get('demoId') ?? []) ids.add(id);
      for (const id of attrs.get('prototypeId') ?? []) prototypeIds.add(id);
      if (mount.surface === 'DemoMatrix') for (const id of demoDeclarations.keys()) ids.add(id);
      if (mount.surface === 'HomeDemoPreviewer') for (const id of declarations) ids.add(id);
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
        ...(mount.via ? { via: mount.via } : {}),
        demoIds: [...ids].sort(),
        prototypeIds: [...prototypeIds].sort(),
        unresolved,
      });
    }
  }
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
