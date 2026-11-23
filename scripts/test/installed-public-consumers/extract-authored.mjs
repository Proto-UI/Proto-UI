import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

assert.equal(process.argv.length, 4, 'usage: extract-authored.mjs REPOSITORY NEW_JSON_OUTPUT');
const repository = realpathSync(process.argv[2]);
const output = resolve(process.argv[3]);
const require = createRequire(join(repository, 'package.json'));
const { build } = require('esbuild');
const tooltip = join(repository, 'apps/www/src/content/docs/demo_components/tooltip-usage.ts');
const select = join(
  repository,
  'apps/www/src/content/docs/demo_components/base-select/baseSelectCode.ts'
);
// This bundle only evaluates the real displayed source generators. Consumer
// builds below resolve public imports from installed tarballs, without aliases.
const result = await build({
  stdin: {
    contents: [
      'import { baseTooltipFiles, shadcnTooltipFiles, brutalistTooltipFiles } from ' +
        JSON.stringify(tooltip) +
        ';',
      'import { codeMap } from ' + JSON.stringify(select) + ';',
      'export default { tooltip: { base: baseTooltipFiles, shadcn: shadcnTooltipFiles, brutalist: brutalistTooltipFiles }, select: codeMap };',
    ].join('\n'),
    resolveDir: repository,
    loader: 'ts',
    sourcefile: 'installed-public-consumer-source.ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  tsconfig: join(repository, 'apps/www/tsconfig.json'),
  write: false,
  metafile: true,
});
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(
  module,
  module.exports,
  require
);
const authored = module.exports.default;
for (const host of ['wc', 'react', 'vue', 'vue2']) {
  for (const family of ['base', 'shadcn', 'brutalist']) {
    assert(authored.tooltip[family][host]?.length, 'Missing public Tooltip files');
  }
  assert.equal(typeof authored.select[host]?.['demo-base-select'], 'string');
}
const sourceFiles = Object.keys(result.metafile.inputs)
  .filter((name) => name !== 'installed-public-consumer-source.ts')
  .map((name) => {
    const file = realpathSync(resolve(repository, name));
    const path = relative(repository, file);
    assert(
      path && !path.startsWith('../') && !isAbsolute(path),
      'Authored generator escaped repository'
    );
    return { path, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') };
  })
  .sort((a, b) => a.path.localeCompare(b.path));
const { getAllPackages } = await import(
  pathToFileURL(join(repository, 'scripts/release/lib.mjs')).href
);
const workspacePackages = Object.fromEntries(
  getAllPackages().map((pkg) => [pkg.name, pkg.manifest])
);
writeFileSync(output, JSON.stringify({ ...authored, sourceFiles, workspacePackages }) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({ output, sourceFiles: sourceFiles.length, publicGroups: ['tooltip', 'select'] })
);
