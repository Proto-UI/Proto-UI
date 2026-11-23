/** Freeze actual consumer usage and source admission without claiming execution.
 * NATIVE_CONSUMER_COMPILER=/pinned/index.js node scripts/compiler/sprint2-consumer-inventory.mjs <shenko-snapshot> <verdant-snapshot> <output.json>
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
assert.equal(
  process.argv.slice(2).length,
  3,
  'Provide Shenko snapshot, Verdant snapshot and output'
);
const [shenko, verdant, output] = process.argv.slice(2).map((value) => path.resolve(value));
assert.ok(process.env.NATIVE_CONSUMER_COMPILER, 'Select an installed source-pinned compiler');
const entry = path.resolve(process.env.NATIVE_CONSUMER_COMPILER),
  directory = path.dirname(entry);
const compiler = await import(pathToFileURL(entry).href);
const identity = JSON.parse(readFileSync(path.join(directory, 'compiler-build.json'), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
assert.equal(git(shenko, 'rev-parse', 'HEAD'), 'f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42');
assert.equal(git(verdant, 'rev-parse', 'HEAD'), '91a775546ebd21a87d76d76568195a6513437719');
assert.equal(git(shenko, 'status', '--porcelain'), '');
assert.equal(git(verdant, 'status', '--porcelain'), '');
for (const input of identity.inputs)
  assert.equal(
    hash(readFileSync(path.join(root, input.path))),
    input.sha256,
    'Compiler implementation drift: ' + input.path
  );
const inventory = {
  schema: 'proto-ui.sprint2.consumer-inventory.v1',
  statusVocabulary: ['PASS', 'FAIL', 'UNSUPPORTED', 'UNTESTED'],
  scope:
    'Frozen actual source × declared target × observed consumer mode. Source-admission rows do not certify ordinary installation, browser execution, platform execution or all original Issue conditions. Separate execution receipts remain source-bound.',
  candidate: {
    head: git(root, 'rev-parse', 'HEAD'),
    compilerBuild: compiler.compilerBuildIdentity,
    compilerInputsMatchBuild: true,
    scriptSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  },
  tools: {
    node: process.version,
    typescript: identity.typescript,
    esbuild: identity.esbuild,
    packageManager: identity.packageManager,
    lockSha256: identity.lockSha256,
    profilesSha256: identity.profilesSha256,
  },
  consumers: [
    {
      name: 'Shenko',
      repository: 'https://github.com/cyjin-yl/shenko',
      revision: git(shenko, 'rev-parse', 'HEAD'),
      target: 'React 19.3.1 (consumer); admitted compiler React 19.2.6 independently checked',
      compiledPrototypes: ['transport-badge', 'message-bubble'],
      adapterFamilies: [
        'button',
        'textarea',
        'scroll-area',
        'collapsible',
        'drawer',
        'toggle-group',
        'input',
        'separator',
        'toggle',
      ],
    },
    {
      name: 'Verdant',
      repository: 'https://github.com/OpenGreendam/verdant',
      revision: git(verdant, 'rev-parse', 'HEAD'),
      target:
        'gpui-source-v1; inherits actual workspace GPUI e5f2f9db75e97613232b5c1946333e61fa3828ab',
      compiledPrototypes: ['pitch-gesture-surface'],
    },
  ],
  sourceAdmission: [],
};
function resultRow(source, result) {
  return {
    ...source,
    status: result.ok
      ? 'PASS'
      : result.diagnostics.some((diagnostic) => diagnostic.category === 'unsupported-input')
        ? 'UNSUPPORTED'
        : 'FAIL',
    firstDiagnostic: result.ok ? null : result.diagnostics[0],
    ...(result.ok
      ? {
          sourceGraphSha256: result.value.ir.source.sha256,
          sourceFiles: result.value.ir.sourceFiles.map(({ file, sha256, content }) => ({
            file,
            sha256,
            bytes: Buffer.byteLength(content),
          })),
          dependencies: result.value.output.dependencies,
          generatedSourceSha256: hash(result.value.output.code),
          generatedSourceBytes: Buffer.byteLength(result.value.output.code),
          supportingSourceBytes: (result.value.output.supportingFiles ?? [])
            .filter((file) => file.kind === 'source')
            .reduce((sum, file) => sum + Buffer.byteLength(file.contents), 0),
        }
      : { diagnostics: result.diagnostics }),
  };
}
const uiKit = readFileSync(path.join(shenko, 'crates/shenko-ui/web/src/ui-kit.tsx'), 'utf8');
for (const imported of uiKit.matchAll(
  /import\s*\{([^}]+)\}\s*from\s*['"]@proto\.ui\/prototypes-shadcn\/([^'"]+)['"]/g
)) {
  const family = imported[2],
    file = `packages/prototypes/shadcn/src/${family}/index.ts`;
  for (const exportName of imported[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    const result = await compiler.compileFile(file, {
      root,
      exportName,
      profile: 'react-dom-source-v1',
    });
    inventory.sourceAdmission.push(
      resultRow(
        {
          consumer: 'Shenko',
          consumerRevision: inventory.consumers[0].revision,
          consumerSource: 'crates/shenko-ui/web/src/ui-kit.tsx',
          consumerSourceSha256: hash(uiKit),
          observedMode: 'adapter',
          scope:
            'Compiler migration feasibility only; the frozen application uses this entry through createReactAdapter',
          entry: file,
          entrySha256: hash(readFileSync(path.join(root, file))),
          exportName,
          profile: 'react-dom-source-v1',
          admittedTargetVersion: '19.2.6',
        },
        result
      )
    );
  }
}
for (const [name, componentName] of [
  ['transport-badge', 'CompiledTransportBadge'],
  ['message-bubble', 'CompiledMessageBubble'],
]) {
  const file = name + '.proto.ts',
    sourceRoot = path.join(shenko, 'crates/shenko-ui/web/prototypes'),
    result = await compiler.compileFile(file, {
      root: sourceRoot,
      componentName,
      profile: 'react-dom-source-v1',
    });
  inventory.sourceAdmission.push(
    resultRow(
      {
        consumer: 'Shenko',
        consumerRevision: inventory.consumers[0].revision,
        observedMode: 'compiled',
        entry: 'crates/shenko-ui/web/prototypes/' + file,
        entrySha256: hash(readFileSync(path.join(sourceRoot, file))),
        exportName: 'default',
        componentName,
        profile: 'react-dom-source-v1',
        admittedTargetVersion: '19.2.6',
        actualApplicationVersion: '19.3.1',
      },
      result
    )
  );
}
const verdantEntry = 'frontend/proto-ui/src/pitch-gesture-surface.proto.ts',
  verdantSource = readFileSync(path.join(verdant, verdantEntry), 'utf8');
inventory.sourceAdmission.push(
  resultRow(
    {
      consumer: 'Verdant',
      consumerRevision: inventory.consumers[1].revision,
      observedMode: 'compiled',
      entry: verdantEntry,
      entrySha256: hash(verdantSource),
      exportName: 'default',
      componentName: 'PitchGestureSurface',
      profile: 'gpui-source-v1',
      gpuiDependency: 'workspace',
    },
    compiler.compilePrototype(verdantSource, {
      fileName: path.basename(verdantEntry),
      componentName: 'PitchGestureSurface',
      profile: 'gpui-source-v1',
      gpuiDependency: 'workspace',
    })
  )
);
inventory.absentUsage = {
  scope:
    'Authored public entry imports in the frozen consumer sources; aggregate bundled library definitions are not application usage evidence.',
  entries: ['Tree', 'DataTable', 'VirtualList', 'Resizable', 'Carousel'],
  Shenko: 'No direct authored consumer usage found in the frozen source inventory',
  Verdant: 'No direct authored consumer usage found in the frozen source inventory',
};
writeFileSync(output, JSON.stringify(inventory, null, 2) + '\n');
console.log(
  JSON.stringify({
    output,
    rows: inventory.sourceAdmission.length,
    byStatus: inventory.sourceAdmission.reduce(
      (counts, row) => ((counts[row.status] = (counts[row.status] ?? 0) + 1), counts),
      {}
    ),
  })
);
