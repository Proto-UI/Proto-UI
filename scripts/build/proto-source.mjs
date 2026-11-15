import { copyFileSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const inside = (root, file) => {
  const name = relative(root, file);
  return name !== '..' && !name.startsWith(`..${sep}`) && !isAbsolute(name);
};

/** Source conditions are preserved as authored paths, separate from runtime JS exports. */
export function protoSourceTargets(manifest) {
  const targets = new Set();
  function visit(value, authored = false) {
    if (typeof value === 'string') {
      if (authored || value.endsWith('.proto.ts')) targets.add(value);
      return;
    }
    if (authored) throw new Error('A proto export must be one static TypeScript source path.');
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === 'object')
      for (const [condition, entry] of Object.entries(value)) visit(entry, condition === 'proto');
  }
  visit(manifest.exports);
  return [...targets].sort();
}

function checkedSource(root, requested, context) {
  const lexical = resolve(root, requested);
  if (!inside(root, lexical)) throw new Error(`${context}: source escapes its package.`);
  const actual = realpathSync(lexical);
  if (!inside(root, actual)) throw new Error(`${context}: source symlink escapes its package.`);
  // A published closure has ordinary files at its authored import paths. Do not
  // silently change nominal source identity by following a source-file alias.
  if (actual !== lexical)
    throw new Error(`${context}: source aliases require explicit re-exports.`);
  if (!statSync(actual).isFile()) throw new Error(`${context}: source is not a regular file.`);
  return actual;
}

export function protoSourceEntries(pkg) {
  const targets = protoSourceTargets(pkg.manifest);
  if (!targets.length) return [];
  const root = realpathSync(pkg.dir);
  return targets.map((target) => {
    if (
      !target.startsWith('./') ||
      !target.endsWith('.ts') ||
      target.endsWith('.d.ts') ||
      /[\\\0%?#*]/.test(target) ||
      target
        .slice(2)
        .split('/')
        .some((part) => !part || part === '.' || part === '..' || part === 'node_modules')
    )
      throw new Error(
        `${pkg.name}: proto exports require explicit package-local TypeScript files.`
      );
    return checkedSource(root, target, pkg.name);
  });
}

/** Read every relative source/type edge; no package source or build hook is executed. */
export function protoSourceFiles(pkg) {
  const entries = protoSourceEntries(pkg);
  if (!entries.length) return [];
  const root = realpathSync(pkg.dir);
  const seen = new Set();
  function visit(filename) {
    if (seen.has(filename)) return;
    seen.add(filename);
    const source = ts.createSourceFile(
      filename,
      readFileSync(filename, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    function edge(node) {
      let specifier;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        specifier = node.moduleSpecifier.text;
      else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      )
        specifier = node.argument.literal.text;
      if (specifier && /^\.\.?($|\/)/.test(specifier)) {
        const base = resolve(dirname(filename), specifier);
        if (!inside(root, base))
          throw new Error(`${pkg.name}: relative source ${specifier} escapes its package.`);
        const candidates = [base, `${base}.ts`, `${base}.proto.ts`, resolve(base, 'index.ts')];
        let target;
        for (const candidate of candidates) {
          try {
            if (!statSync(candidate).isFile()) continue;
            target = checkedSource(root, candidate, pkg.name);
            break;
          } catch (error) {
            if (
              error &&
              typeof error === 'object' &&
              'code' in error &&
              (error.code === 'ENOENT' || error.code === 'ENOTDIR')
            )
              continue;
            throw error;
          }
        }
        if (!target)
          throw new Error(
            `${pkg.name}: missing authored source ${specifier} in ${relative(root, filename)}.`
          );
        visit(target);
      }
      ts.forEachChild(node, edge);
    }
    edge(source);
  }
  for (const entry of entries) visit(entry);
  return [...seen].map((file) => relative(root, file).split(sep).join('/')).sort();
}

export function writeProtoSourceFiles(pkg, stageDir) {
  const files = protoSourceFiles(pkg);
  for (const file of files) {
    const target = resolve(stageDir, file);
    if (!inside(resolve(stageDir), target))
      throw new Error('Authored source staging escapes its output.');
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(resolve(pkg.dir, file), target);
  }
  return files;
}
