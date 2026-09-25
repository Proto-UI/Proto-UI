import { mkdir, open, readFile, realpath, rmdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import { parsePrototype } from './parser';
import { emitReact } from './react';
import type { CompileResult, GeneratedModule, ParseOptions, PrototypeIR, SourceSpan } from './ir';

export interface Compilation {
  ir: PrototypeIR;
  output: GeneratedModule;
}
export interface CompileOptions extends ParseOptions {
  componentName?: string;
}

export function compilePrototype(
  source: string,
  options: CompileOptions = {}
): CompileResult<Compilation> {
  const parsed = parsePrototype(source, options);
  if (!parsed.ok) return parsed;
  const emitted = emitReact(parsed.value, { componentName: options.componentName });
  if (!emitted.ok) return emitted;
  return { ok: true, value: { ir: parsed.value, output: emitted.value } };
}

/** Read only source files beneath a declared project root; never import or evaluate them. */
export async function compileFile(
  entry: string,
  options: { root?: string; exportName?: string; componentName?: string } = {}
): Promise<CompileResult<Compilation>> {
  const fallback: SourceSpan = {
    file: '<input>',
    start: 0,
    end: 0,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
  try {
    const root = await realpath(options.root ?? process.cwd());
    const files: Record<string, string> = Object.create(null);
    async function load(filename: string): Promise<string> {
      const absolute = await realpath(filename);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (relative.startsWith('../') || path.isAbsolute(relative))
        throw new Error('Source escapes the declared project root');
      if (Object.hasOwn(files, relative)) return relative;
      const source = await readFile(absolute, 'utf8');
      files[relative] = source;
      const file = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true);
      for (const statement of file.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        if (
          ts.isImportDeclaration(statement) &&
          (statement.importClause?.isTypeOnly ||
            (statement.importClause?.namedBindings &&
              ts.isNamedImports(statement.importClause.namedBindings) &&
              statement.importClause.namedBindings.elements.every((item) => item.isTypeOnly)))
        )
          continue;
        if (ts.isExportDeclaration(statement) && statement.isTypeOnly) continue;
        const specifier = statement.moduleSpecifier;
        if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.'))
          continue;
        const base = path.resolve(path.dirname(absolute), specifier.text);
        let resolved: string | undefined;
        for (const candidate of [
          base,
          `${base}.ts`,
          `${base}.proto.ts`,
          path.join(base, 'index.ts'),
        ]) {
          try {
            resolved = await realpath(candidate);
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
        if (!resolved) throw new Error(`Missing local source ${specifier.text} in ${relative}`);
        await load(resolved);
      }
      return relative;
    }
    const fileName = await load(path.resolve(entry));
    return compilePrototype(files[fileName], {
      fileName,
      files,
      exportName: options.exportName,
      componentName: options.componentName,
    });
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI1003',
          category: 'invalid-input',
          message: error instanceof Error ? error.message : String(error),
          span: fallback,
        },
      ],
    };
  }
}

export interface ExclusiveOutputFile {
  writeFile(data: string): Promise<unknown>;
  close(): Promise<void>;
}

/** Reserve a fresh destination; no force flag, overwrite, or consumer manifest mutation. */
export async function writeCompilation(
  compilation: Compilation,
  directory: string,
  openExclusive: (filename: string) => Promise<ExclusiveOutputFile> = (filename) =>
    open(filename, 'wx')
): Promise<CompileResult<{ directory: string; files: string[] }>> {
  const output = path.resolve(directory);
  const created: string[] = [];
  let reserved = false;
  try {
    await mkdir(output);
    reserved = true;
    const manifest =
      JSON.stringify(
        {
          ...compilation.output.provenance,
          profile: compilation.output.profile,
          dependencies: compilation.output.dependencies,
          generatedSha256: createHash('sha256').update(compilation.output.code).digest('hex'),
        },
        null,
        2
      ) + '\n';
    for (const [name, contents] of [
      ['Component.tsx', compilation.output.code],
      ['provenance.json', manifest],
    ]) {
      const filename = path.join(output, name);
      const handle = await openExclusive(filename);
      // Exclusive creation establishes ownership BEFORE any write can leave partial bytes.
      created.push(filename);
      try {
        await handle.writeFile(contents);
      } finally {
        await handle.close();
      }
    }
    return { ok: true, value: { directory: output, files: created } };
  } catch (error) {
    const cleanupErrors: string[] = [];
    if (reserved) {
      for (const filename of created) {
        try {
          await unlink(filename);
        } catch (cleanup) {
          cleanupErrors.push(String(cleanup));
        }
      }
      try {
        await rmdir(output);
      } catch (cleanup) {
        cleanupErrors.push(String(cleanup));
      }
    }
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI3002',
          category: 'output-conflict',
          message: `Cannot create a fresh output destination: ${error instanceof Error ? error.message : String(error)}${cleanupErrors.length ? `; rollback preserved unresolved/foreign contents: ${cleanupErrors.join('; ')}` : ''}`,
          span: compilation.ir.setup.span,
        },
      ],
    };
  }
}
