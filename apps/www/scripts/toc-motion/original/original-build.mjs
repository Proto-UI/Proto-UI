import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BASELINE_SHA } from './original-contract.mjs';
import { loadOriginalRuntime, bindingFingerprint } from './original-runtime.mjs';
const runtime = await loadOriginalRuntime();
const { subjectRoot: root, out, production, bind } = runtime;
await mkdir(out, { recursive: true });
const binding = await bind();
const file = path.join(out, 'comparison-build-binding.json');
const options = { root, out, expectedHead: BASELINE_SHA };
if (process.argv[2] === 'begin-build') {
  await writeFile(
    file,
    JSON.stringify({ binding, fingerprint: bindingFingerprint(binding) }, null, 2) + '\n'
  );
  await production.beginReadingBuild(options);
} else if (process.argv[2] === 'finish-build') {
  const before = JSON.parse(await readFile(file, 'utf8'));
  if (before.fingerprint !== bindingFingerprint(binding))
    throw Error('Runner/helper/subject binding changed during baseline build');
  await production.finishReadingBuild(options);
} else throw Error('Expected begin-build or finish-build');
