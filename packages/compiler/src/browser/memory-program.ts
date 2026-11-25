import ts from 'typescript';
import type { BrowserAuthoringEnvironment, BrowserCompileRequest } from './protocol';

const authoredRoot = '/__pui_authored__/';

/** Normalize only POSIX virtual paths. This host never consults a filesystem. */
function normalize(file: string): string {
  const result: string[] = [];
  for (const part of file.split('/')) {
    if (part === '..') result.pop();
    else if (part && part !== '.') result.push(part);
  }
  return '/' + result.join('/');
}

export function authoredPath(file: string): string {
  if (
    !file ||
    file.startsWith('/') ||
    file.includes('\\') ||
    file.includes('\0') ||
    file.split('/').includes('..') ||
    file.includes('/packages/core/') ||
    file.startsWith('packages/core/') ||
    file.includes('/@proto.ui/core/') ||
    file.startsWith('@proto.ui/core/') ||
    file.includes(':')
  )
    throw new Error('Authored source requires a relative virtual path outside the trusted core.');
  return normalize(authoredRoot + file);
}

export function createMemoryProgram(
  request: BrowserCompileRequest,
  environment: BrowserAuthoringEnvironment
): { program: ts.Program; entryPath: string; authoredFiles: readonly string[] } {
  const files = new Map(Object.entries(environment.files));
  const authored = new Set<string>();
  for (const [name, text] of Object.entries(request.options.files ?? {})) {
    const file = authoredPath(name);
    if (authored.has(file)) throw new Error('Duplicate normalized virtual source path: ' + name);
    files.set(file, text);
    authored.add(file);
  }
  const entryPath = authoredPath(request.options.fileName);
  files.set(entryPath, request.source);
  authored.add(entryPath);
  const paths: Record<string, string[]> = Object.fromEntries(
    Object.entries(environment.modules).map(([name, file]) => [name, [file]])
  );
  for (const [name, target] of Object.entries(request.options.sourceImports ?? {})) {
    if (Object.hasOwn(environment.modules, name)) {
      // A source asset may mention a core import, but cannot replace its binding.
      if (target !== name) throw new Error('Cannot override trusted authoring module: ' + name);
      continue;
    }
    if (!name || name.startsWith('.') || name.startsWith('/') || name.includes('\\'))
      throw new Error('Source module bindings must be bare module specifiers.');
    const file = authoredPath(target);
    if (!authored.has(file)) throw new Error('Source module binding has no supplied file: ' + name);
    paths[name] = [file];
  }
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
    baseUrl: '/',
    paths,
    jsx: ts.JsxEmit.ReactJSX,
  };
  const directories = new Set<string>(['/']);
  for (const file of files.keys()) {
    let at = file.lastIndexOf('/');
    while (at > 0) {
      directories.add(file.slice(0, at));
      at = file.lastIndexOf('/', at - 1);
    }
  }
  const sourceFiles = new Map<string, ts.SourceFile>();
  const host: ts.CompilerHost = {
    getSourceFile(fileName, languageVersion) {
      const file = normalize(fileName);
      const text = files.get(file);
      if (text === undefined) return undefined;
      let source = sourceFiles.get(file);
      if (!source) {
        source = ts.createSourceFile(file, text, languageVersion, true);
        sourceFiles.set(file, source);
      }
      return source;
    },
    getDefaultLibFileName: () => environment.defaultLibFile,
    getDefaultLibLocation: () =>
      environment.defaultLibFile.slice(0, environment.defaultLibFile.lastIndexOf('/')),
    writeFile: () => {
      throw new Error('The browser frontend does not write files.');
    },
    getCurrentDirectory: () => '/',
    getDirectories: (directory) => {
      const prefix = normalize(directory) + '/';
      return [...directories].filter(
        (name) => name.startsWith(prefix) && !name.slice(prefix.length).includes('/')
      );
    },
    directoryExists: (directory) => directories.has(normalize(directory)),
    fileExists: (file) => files.has(normalize(file)),
    readFile: (file) => files.get(normalize(file)),
    realpath: normalize,
    getCanonicalFileName: normalize,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };
  return {
    program: ts.createProgram([...authored], options, host),
    entryPath,
    authoredFiles: [...authored],
  };
}
