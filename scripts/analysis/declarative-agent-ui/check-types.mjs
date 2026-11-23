import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const configPath = path.join(here, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config ?? {}, ts.sys, here);

// The workspace Adapter develops against React 19, while this comparison pins
// React 18 for both catalog paths. Resolve imported Adapter types against that
// same consumer version, as build.mjs already does for its runtime bundle.
// Merge the inherited aliases rather than copying or replacing Proto-UI paths.
const consumerTypePaths = Object.fromEntries(
  ['react', 'react-dom'].flatMap((name) => {
    const directory = path.dirname(require.resolve(`@types/${name}/package.json`));
    return [
      [name, [path.join(directory, 'index.d.ts')]],
      [`${name}/*`, [path.join(directory, '*')]],
    ];
  })
);
parsed.options.paths = { ...parsed.options.paths, ...consumerTypePaths };

const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
const diagnostics = [
  ...(config.error ? [config.error] : []),
  ...parsed.errors,
  ...ts.getPreEmitDiagnostics(program),
];
if (diagnostics.length) {
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => here,
      getNewLine: () => '\n',
    })
  );
  process.exitCode = 1;
} else {
  console.log(
    `Strict consumer type check passed (${parsed.fileNames.length} entry files; shared mapping checked).`
  );
}
