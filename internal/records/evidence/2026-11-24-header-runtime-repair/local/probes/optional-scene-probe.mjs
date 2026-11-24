import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createHash } from 'node:crypto';
const repository = process.argv[2] ?? '/workspace/scratch/080997012d40/Proto-UI';
const rootRequire = createRequire(path.join(repository, 'package.json'));
const wwwRequire = createRequire(path.join(repository, 'apps/www/package.json'));
const astroRequire = createRequire(wwwRequire.resolve('astro/package.json'));
const { rollup } = astroRequire('rollup');
const ts = rootRequire('typescript');
const configText = fs.readFileSync(path.join(repository, 'apps/www/astro.config.mjs'), 'utf8');
const source = ts.createSourceFile('astro.config.mjs', configText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'websiteManualChunk');
const actualClassifier = vm.runInNewContext('(' + fn.getText(source) + ')', { normalizedBundleModuleId: id => id });
// Reconstruct the original classifier's exact scene exemption even if the live
// author has already changed that one return. Everything else stays actual.
const p = 'packages/adapters/base/src/';
const header = 'apps/www/src/components/override/Header.astro';
const controls = 'apps/www/src/components/site-shadcn-controls.ts';
const barrel = p + 'index.ts';
const host = p + 'host/adapter-host.ts';
const scene = p + 'material/shader-scene-host.ts';
const shared = p + 'material/shader-webgl2-host.ts';
const paint = p + 'material/paint-reservation.ts';
const core = 'packages/core/src/shared.ts';
const preview = 'apps/www/src/components/PrototypePreviewer/preview-material-scene.ts';
const classify = id => id === scene ? undefined : actualClassifier(id);
const records = [];
for (const mode of ['unused', 'const', 'reexport']) {
  for (const strategy of ['baseline', 'global-explicit', 'exact-scene', 'exact-scene-strict', 'exact-scene-no-hoist', 'exact-scene-and-preview', 'all-optional']) {
    const lazy = mode !== 'unused';
    const files = new Map([
      [header, `import {mount} from '${controls}'; export const ready=mount();` + (lazy ? `export const load=()=>import('${preview}');` : '')],
      [controls, `export {mount} from '${barrel}';`],
      [barrel, `export {mount} from '${host}'; export {scene} from '${scene}'; export {paint} from '${paint}';`],
      [host, `import {paint} from '${paint}'; import {webgl} from '${shared}'; export function mount(){return paint()+webgl()}`],
      [scene, `import {webgl} from '${shared}'; export function scene(){return 'optional-scene-'+webgl()}`],
      [shared, `import {common} from '${core}'; export function webgl(){return common()+'host'}`],
      [paint, `import {common} from '${core}'; export function paint(){return common()+'paint'}`],
      [core, 'export function common(){return "core"}'],
      [preview, mode === 'const' ? `import {scene} from '${scene}'; export const render=scene;` : `export {scene as render} from '${scene}';`],
    ]);
    const warnings = [];
    const bundle = await rollup({
      input: header,
      ...(strategy === 'exact-scene-strict' ? { preserveEntrySignatures: 'strict' } : {}),
      onwarn: w => warnings.push({ code: w.code, message: w.message }),
      plugins: [{ name: 'memory-scene-shared-eager-fixture', resolveId: id => files.has(id) ? id : null, load: id => files.get(id) ?? null }],
    });
    const manualChunks = id => {
      if (strategy.startsWith('exact-scene') && id === scene) return 'site-optional-scene';
      if (strategy === 'exact-scene-and-preview' && id === preview) return 'site-optional-scene';
      if (strategy === 'all-optional' && id.startsWith(p + 'material/') && id !== shared) return 'site-optional-material';
      return classify(id);
    };
    const { output } = await bundle.generate({
      format: 'es', manualChunks,
      onlyExplicitManualChunks: strategy === 'global-explicit',
      ...(strategy === 'exact-scene-no-hoist' ? { hoistTransitiveImports: false } : {}),
    });
    await bundle.close();
    const byName = new Map(output.map(o => [o.fileName, o]));
    const eager = new Set();
    function visit(o) { if (!o || eager.has(o.fileName)) return; eager.add(o.fileName); o.imports.forEach(id => visit(byName.get(id))); }
    visit(output.find(o => o.isEntry));
    records.push({ mode, strategy, warnings, eagerCount: eager.size,
      eagerBytes: output.filter(o => eager.has(o.fileName)).reduce((n, o) => n + Buffer.byteLength(o.code), 0),
      eagerScene: output.some(o => eager.has(o.fileName) && scene in o.modules),
      chunks: output.map(o => ({ name: o.name, fileName: o.fileName, eager: eager.has(o.fileName), imports: o.imports, dynamicImports: o.dynamicImports, code: o.code, sha256: createHash('sha256').update(o.code).digest('hex'), modules: Object.fromEntries(Object.entries(o.modules).map(([id, m]) => [id, m.renderedLength])) })) });
  }
}
console.log(JSON.stringify({ node: process.version, rollup: astroRequire('rollup/package.json').version, configSha256: createHash('sha256').update(configText).digest('hex'), actualSharedClassifier: classify(shared), records }, null, 2));
