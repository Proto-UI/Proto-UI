import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createProcessor } from '@mdx-js/mdx';
import ts from 'typescript';
import { publicDocPolicy } from './public-doc-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXTENSIONS = ['.mdx', '.md', '/index.mdx', '/index.md'];
const digest = (source) => createHash('sha256').update(source).digest('hex');

function literal(expression) {
  const source = ts.createSourceFile(
    'attribute.ts',
    `const value = (${expression});`,
    ts.ScriptTarget.Latest,
    true
  );
  let node = source.statements[0]?.declarationList?.declarations[0]?.initializer;
  while (node && ts.isParenthesizedExpression(node)) node = node.expression;
  function read(value) {
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
    if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isArrayLiteralExpression(value)) return value.elements.map(read);
    throw new Error(
      'Expected a literal MDX attribute; dynamic expressions need an explicit inventory reader.'
    );
  }
  if (!node || source.parseDiagnostics.length) throw new Error('Invalid MDX attribute expression.');
  return read(node);
}

function attribute(node, name) {
  const attr = node.attributes?.find((entry) => entry.name === name);
  if (!attr) return undefined;
  if (attr.value === null) return true;
  if (typeof attr.value === 'string') return attr.value;
  return literal(attr.value.value);
}

/** Read authored MDX, never execute an example or interpret a passing source check as native acceptance. */
export function inspectReleaseDocument(source, runtimes) {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, (frontmatter) =>
    frontmatter.replace(/[^\r\n]/g, '')
  );
  const tree = createProcessor({ format: 'mdx' }).parse(body);
  const previews = [];
  const codeExamples = [];
  const diagnostics = [];
  let inlineCodeBlocks = 0;
  let iconGallery = false;
  const names = new Map(
    ['PrototypePreviewer', 'DemoPreviewer', 'CodeExample', 'LucideIconGallery'].map((name) => [
      name,
      name,
    ])
  );
  for (const node of tree.children) {
    if (node.type !== 'mdxjsEsm') continue;
    const esm = ts.createSourceFile('imports.ts', node.value, ts.ScriptTarget.Latest, true);
    for (const statement of esm.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      const component = statement.moduleSpecifier.text.match(
        /(?:^|\/)(PrototypePreviewer|DemoPreviewer|CodeExample|LucideIconGallery)\.astro$/
      )?.[1];
      if (component && statement.importClause?.name)
        names.set(statement.importClause.name.text, component);
    }
  }
  function walk(node) {
    if (node.type === 'code') inlineCodeBlocks++;
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const component = names.get(node.name);
      if (component === 'LucideIconGallery') iconGallery = true;
      if (component === 'CodeExample')
        codeExamples.push({ line: node.position?.start.line ?? null });
      if (['PrototypePreviewer', 'DemoPreviewer'].includes(component)) {
        try {
          if (node.attributes?.some((entry) => entry.type === 'mdxJsxExpressionAttribute'))
            throw new Error('A spread preview prop needs an explicit inventory reader.');
          const demoId = attribute(node, 'demoId');
          const prototypeId = attribute(node, 'prototypeId');
          if (
            Boolean(demoId) === Boolean(prototypeId) ||
            [demoId, prototypeId].some(
              (id) => id !== undefined && (typeof id !== 'string' || !id.trim())
            )
          )
            throw new Error('A preview must name exactly one literal demoId or prototypeId.');
          const selected = attribute(node, 'runtimes') ?? [...runtimes];
          if (
            !Array.isArray(selected) ||
            selected.length === 0 ||
            new Set(selected).size !== selected.length ||
            selected.some((id) => !runtimes.includes(id))
          )
            throw new Error(
              `Invalid or unsupported preview runtimes: ${JSON.stringify(selected)}.`
            );
          const codePanel = attribute(node, 'codePanel');
          const toolbar = attribute(node, 'toolbar');
          if (
            [codePanel, toolbar].some((value) => value !== undefined && typeof value !== 'boolean')
          )
            throw new Error('Preview codePanel and toolbar must be literal booleans.');
          previews.push({
            index: previews.length,
            demoId: demoId ?? null,
            prototypeId: prototypeId ?? null,
            runtimes: selected,
            codePanel: codePanel !== false,
            toolbar: toolbar !== false,
            line: node.position?.start.line ?? null,
          });
        } catch (error) {
          diagnostics.push(String(error.message ?? error));
        }
      }
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return { previews, codeExamples, inlineCodeBlocks, iconGallery, diagnostics };
}

async function sourceAt(root, relative, sources) {
  const source = await readFile(path.join(root, relative), 'utf8');
  sources.set(relative, { path: relative, sha256: digest(source) });
  return source;
}

async function documentAt(root, locale, slug, sources) {
  for (const extension of EXTENSIONS) {
    const file = `apps/www/src/content/docs/${locale}/${slug}${extension}`;
    try {
      return { file, source: await sourceAt(root, file, sources) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

export async function buildReleaseWebsiteInventory({ root = ROOT, policy = publicDocPolicy } = {}) {
  const sources = new Map();
  if (policy === publicDocPolicy)
    await sourceAt(root, 'scripts/docs/public-doc-policy.mjs', sources);
  const runtimePath = 'apps/www/src/components/PrototypePreviewer/runtimes/ids.ts';
  const runtimeSource = await sourceAt(root, runtimePath, sources);
  const runtimeDeclaration = runtimeSource.match(
    /export const AdapterIds\s*=\s*(\[[^;]+?\])\s+as const/
  );
  if (!runtimeDeclaration)
    throw new Error(`Cannot read the declared public runtime list in ${runtimePath}.`);
  const runtimes = literal(runtimeDeclaration[1]);
  if (
    !Array.isArray(runtimes) ||
    !runtimes.length ||
    new Set(runtimes).size !== runtimes.length ||
    runtimes.some((id) => typeof id !== 'string')
  )
    throw new Error('The public runtime list must be nonempty literal string identities.');
  const rows = [];
  const errors = [];
  for (const library of policy.libraries) {
    const manifestPath = `packages/prototypes/${library.id}/package.json`;
    const manifest = JSON.parse(await sourceAt(root, manifestPath, sources));
    const families = new Map();
    for (const exportName of Object.keys(manifest.exports)) {
      const classification = library.exportClassifications?.[exportName];
      if (classification) {
        if (classification.kind === 'overview-only') {
          const existing = families.get(library.overviewSlug);
          families.set(library.overviewSlug, {
            family: 'icon',
            exports: [...(existing?.exports ?? []), exportName],
            catalogId: classification.catalogId,
          });
        }
        continue;
      }
      if (!exportName.startsWith('./') || exportName.includes('*'))
        throw new Error(`Unclassified ${library.packageName} export: ${exportName}.`);
      const family = library.familyAliases?.[exportName.slice(2)] ?? exportName.slice(2);
      const slug = library.familyRoutes?.[family] ?? `${library.detailPrefix}/${family}`;
      const existing = families.get(slug);
      families.set(slug, {
        family,
        exports: [...(existing?.exports ?? []), exportName],
        catalogId: `${library.catalogPrefix}${family.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
      });
    }
    for (const [slug, family] of [...families].sort(([a], [b]) => a.localeCompare(b))) {
      for (const locale of policy.locales) {
        const row = {
          id: `${library.id}:${family.family}:${locale}`,
          library: library.id,
          ...family,
          locale,
          route: `/${locale}/${slug}/`,
          source: null,
          document: null,
          evidence: {
            browser: 'not-run',
            installedConsumer: 'not-run',
            physicalDevice: 'not-run',
            assistiveTechnology: 'not-run',
          },
        };
        const document = await documentAt(root, locale, slug, sources);
        if (!document)
          errors.push(`${row.id}: Missing localized public documentation at ${row.route}.`);
        else {
          row.source = document.file;
          try {
            row.document = inspectReleaseDocument(document.source, runtimes);
            errors.push(...row.document.diagnostics.map((error) => `${row.id}: ${error}`));
          } catch (error) {
            errors.push(`${row.id}: ${String(error.message ?? error)}`);
          }
        }
        rows.push(row);
      }
    }
  }
  const inputs = [...sources.values()].sort((a, b) => a.path.localeCompare(b.path));
  let revision = null;
  let dirty = null;
  try {
    revision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    dirty = Boolean(
      execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()
    );
  } catch {
    /* Fixture roots can lack Git; no source revision is invented. */
  }
  return {
    schemaVersion: 1,
    scope:
      '0.3 public documentation exported families, derived from publicDocPolicy and current package exports',
    revision,
    dirty,
    runtimes,
    generatorDigest: digest(await readFile(fileURLToPath(import.meta.url))),
    policyDigest: digest(JSON.stringify(policy)),
    inputDigest: digest(JSON.stringify(inputs)),
    inputs,
    historicalBoundary: {
      issue: 'https://github.com/Proto-UI/Proto-UI/issues/1042',
      routes: 518,
      cells: 5784,
      status:
        'Historical counts retain their original source; this current inventory does not replace or accept those rows.',
    },
    summary: {
      routes: rows.length,
      families: new Set(rows.map((row) => `${row.library}:${row.family}`)).size,
      previews: rows.reduce((total, row) => total + (row.document?.previews.length ?? 0), 0),
      previewHostCells: rows.reduce(
        (total, row) =>
          total +
          (row.document?.previews.reduce((count, preview) => count + preview.runtimes.length, 0) ??
            0),
        0
      ),
    },
    rows,
    errors,
    limitations: [
      'Source inventory only; it neither executes Preview/Code nor proves runnable installation or meaningful prose.',
      'Browser simulation, real mobile devices and assistive technology require separate source-bound receipts.',
      'Missing code or disabled Code panels remain visible in each row; enumeration cannot discharge their Usage obligation.',
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: { out: { type: 'string' }, check: { type: 'boolean', default: false } },
  });
  const result = await buildReleaseWebsiteInventory();
  if (values.out) {
    const out = path.resolve(values.out);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(
    JSON.stringify(
      {
        ...result.summary,
        errors: result.errors,
        inputDigest: result.inputDigest,
        acceptance: 'not-run',
        out: values.out ?? null,
      },
      null,
      2
    )
  );
  if (values.check && result.errors.length) process.exitCode = 1;
}
