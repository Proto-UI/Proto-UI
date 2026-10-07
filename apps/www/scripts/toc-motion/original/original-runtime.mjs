import { readFile, realpath, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { BASELINE_SHA, sha256 } from './original-contract.mjs';
export async function loadOriginalRuntime() {
  for (const key of [
    'PROTO_UI_TOC_RUNNER_ROOT',
    'PROTO_UI_TOC_RUNNER_SHA',
    'PROTO_UI_TOC_SUBJECT_ROOT',
    'PROTO_UI_TOC_OUT',
  ])
    if (!process.env[key]) throw Error(`${key} is required`);
  if (process.env.PROTO_UI_BROWSER_BASE_URL) throw Error('External/shared server override refused');
  const runnerRoot = await realpath(process.env.PROTO_UI_TOC_RUNNER_ROOT);
  const subjectRoot = await realpath(process.env.PROTO_UI_TOC_SUBJECT_ROOT);
  const outputPath = path.resolve(process.env.PROTO_UI_TOC_OUT);
  const inside = (base, file) => file === base || file.startsWith(base + path.sep);
  if (inside(runnerRoot, subjectRoot) || inside(subjectRoot, runnerRoot))
    throw Error('Runner and historical subject must be separate, non-nested checkouts');
  if (inside(runnerRoot, outputPath) || inside(subjectRoot, outputPath))
    throw Error('Evidence output must be outside both source checkouts');
  await mkdir(outputPath, { recursive: true });
  const out = await realpath(outputPath);
  if (inside(runnerRoot, out) || inside(subjectRoot, out))
    throw Error('Resolved evidence output must be outside both source checkouts');
  const at = (name) => import(pathToFileURL(path.join(runnerRoot, name)).href);
  const guards = await at('apps/www/scripts/reading-reference-contract.mjs');
  const production = await at('apps/www/scripts/reading-reference-production.mjs');
  const strictPreview = await at('apps/www/scripts/search-production-preview.mjs');
  const bind = async () => {
    const runner = guards.readSourceBinding(process.env.PROTO_UI_TOC_RUNNER_SHA, runnerRoot);
    const subject = guards.readSourceBinding(BASELINE_SHA, subjectRoot);
    const files = {};
    for (const name of [
      'reading-reference-contract.mjs',
      'reading-reference-production.mjs',
      'search-production-preview.mjs',
    ])
      files[`runner/apps/www/scripts/${name}`] = sha256(
        await readFile(path.join(runnerRoot, 'apps/www/scripts', name))
      );
    files['runner/scripts/test/server-readiness.mjs'] = sha256(
      await readFile(path.join(runnerRoot, 'scripts/test/server-readiness.mjs'))
    );
    for (const name of [
      'original-contract.mjs',
      'original-observer.mjs',
      'original-runtime.mjs',
      'original-build.mjs',
      'capture-original.mjs',
    ])
      files[`kit/${name}`] = sha256(await readFile(new URL(name, import.meta.url)));
    for (const [label, root] of [
      ['runner', runnerRoot],
      ['subject', subjectRoot],
    ])
      files[`${label}/pnpm-lock.yaml`] = sha256(await readFile(path.join(root, 'pnpm-lock.yaml')));
    const kitPath = fileURLToPath(new URL('.', import.meta.url));
    return {
      runner,
      subject,
      kitOrigin: inside(runnerRoot, kitPath) ? 'runner-checkout' : 'external-hash-bound-kit',
      files,
    };
  };
  const runnerRequire = createRequire(path.join(runnerRoot, 'apps/www/package.json'));
  const subjectRequire = createRequire(path.join(subjectRoot, 'apps/www/package.json'));
  return {
    runnerRoot,
    subjectRoot,
    out,
    guards,
    production,
    strictPreview,
    bind,
    runnerRequire,
    subjectRequire,
  };
}
export function bindingFingerprint(binding) {
  return sha256(
    JSON.stringify({
      runner: binding.runner.actualGitHead,
      subject: binding.subject.actualGitHead,
      files: binding.files,
    })
  );
}
