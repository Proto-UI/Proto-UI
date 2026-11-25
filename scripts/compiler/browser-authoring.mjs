import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { browserRepositoryRoot as root, hashInputFiles } from './browser-inputs.mjs';

const require = createRequire(path.join(root, 'packages/compiler/package.json'));

/** Package the real, immutable core/type declarations and TypeScript libraries. */
export async function createBrowserAuthoringEnvironment() {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const entries = [
    'packages/core/src/index.ts',
    'packages/core/src/internal.ts',
    'packages/types/src/index.ts',
  ];
  const options = { ...parsed.options, target: ts.ScriptTarget.ES2022, types: [], noEmit: true };
  const program = ts.createProgram(
    entries.map((file) => path.join(root, file)),
    options
  );
  const libRoot = path.dirname(require.resolve('typescript/lib/lib.es2022.full.d.ts'));
  const virtualName = (file) => {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative.startsWith('packages/core/src/') || relative.startsWith('packages/types/src/'))
      return '/__pui_trusted__/' + relative;
    const library = path.relative(libRoot, file);
    if (!library.startsWith('..') && !path.isAbsolute(library))
      return '/__pui_trusted__/typescript/' + library.split(path.sep).join('/');
    throw new Error('Browser authoring dependency needs an explicit package boundary: ' + relative);
  };
  const sources = program.getSourceFiles().map((file) => [virtualName(file.fileName), file.text]);
  const files = Object.fromEntries(sources.sort(([a], [b]) => a.localeCompare(b)));
  const environment = {
    files,
    modules: {
      '@proto.ui/core': '/__pui_trusted__/packages/core/src/index.ts',
      '@proto.ui/core/internal': '/__pui_trusted__/packages/core/src/internal.ts',
      '@proto.ui/types': '/__pui_trusted__/packages/types/src/index.ts',
    },
    defaultLibFile: '/__pui_trusted__/typescript/lib.es2022.full.d.ts',
    typescriptVersion: ts.version,
    reactVersion: JSON.parse(await readFile(require.resolve('react/package.json'), 'utf8')).version,
  };
  if (!files[environment.defaultLibFile])
    throw new Error(
      'The browser authoring environment is missing the actual TypeScript default library.'
    );
  return {
    environment,
    inputFiles: await hashInputFiles([
      ...program.getSourceFiles().map((file) => file.fileName),
      'tsconfig.json',
      'scripts/compiler/browser-authoring.mjs',
      require.resolve('react/package.json'),
      require.resolve('typescript/package.json'),
    ]),
  };
}
