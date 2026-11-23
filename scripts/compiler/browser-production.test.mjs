import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const moduleFiles = [
  'scripts/compiler/browser-production.mjs',
  'scripts/compiler/browser-inputs.mjs',
  'scripts/test/sprint3-consumer-evidence.mjs',
  'scripts/test/sprint3-source-server.mjs',
  'scripts/compiler/browser-repository-root.mjs',
];
const artifactNames = ['build.log', 'dist-files.json', 'preview-requests.jsonl'];
const workerFile = '_astro/negative-worker.js';
const wasmFile = '_astro/negative-engine.wasm';
const serialize = (value) => JSON.stringify(value, null, 2) + '\n';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Only throwaway repositories are written. The helper and its complete current
// local import closure are copied byte-for-byte. The same workspace discovery
// remains the authority; the production verifier receives no new root override.
async function fixture(t) {
  const parent = await realpath(await mkdtemp(path.join(tmpdir(), 'pui-production-negative-')));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'source');
  const output = path.join(parent, 'evidence');
  await mkdir(path.join(root, 'apps/www'), { recursive: true });
  await mkdir(path.join(root, 'packages/compiler'), { recursive: true });
  await mkdir(output);
  for (const relative of moduleFiles) {
    const destination = path.join(root, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(repository, relative), destination);
    assert.deepEqual(await readFile(destination), await readFile(path.join(repository, relative)));
  }
  await writeFile(path.join(root, '.gitignore'), 'apps/www/dist/\n');
  await writeFile(path.join(root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
  await writeFile(
    path.join(root, 'pnpm-workspace.yaml'),
    'packages:\n  - apps/*\n  - packages/*\n'
  );
  await writeFile(
    path.join(root, 'package.json'),
    serialize({ name: 'proto-ui', private: true, packageManager: 'pnpm@10.32.1' })
  );
  await writeFile(
    path.join(root, 'packages/compiler/package.json'),
    serialize({ name: '@proto.ui/compiler', private: true })
  );
  await writeFile(
    path.join(root, 'apps/www/package.json'),
    serialize({ name: 'apps-www', private: true, scripts: { build: 'node failed-build.cjs' } })
  );
  await writeFile(
    path.join(root, 'apps/www/failed-build.cjs'),
    [
      "const fs = require('node:fs');",
      'fs.writeFileSync(process.env.PUI_NEGATIVE_BUILD_PID, String(process.pid));',
      "console.error('INTENTIONAL_PRODUCTION_PREPARATION_NEGATIVE_CONTROL');",
      'process.exitCode = 1;',
      '',
    ].join('\n')
  );
  await writeFile(path.join(root, 'tracked.txt'), 'original tracked source\n');
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        'core.hooksPath=' + path.join(parent, 'unused-hooks'),
        '-c',
        'commit.gpgsign=false',
        '-c',
        'user.name=OpenAI Codex',
        '-c',
        'user.email=codex@openai.com',
        ...args,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_AUTHOR_NAME: 'OpenAI Codex',
          GIT_AUTHOR_EMAIL: 'codex@openai.com',
          GIT_COMMITTER_NAME: 'OpenAI Codex',
          GIT_COMMITTER_EMAIL: 'codex@openai.com',
        },
      }
    ).trim();
  git('init', '--quiet');
  git('add', '.');
  git(
    'commit',
    '--quiet',
    '--signoff',
    '--message',
    'Create disposable production negative fixture'
  );
  const head = git('rev-parse', 'HEAD');
  const moduleURL = pathToFileURL(path.join(root, moduleFiles[0])).href;
  const helper = await import(moduleURL);
  const { sealProductionArtifact } = await import(
    pathToFileURL(path.join(root, moduleFiles[2])).href
  );
  return { parent, root, output, git, head, moduleURL, helper, sealProductionArtifact };
}

// Deliberately success-shaped *negative inputs*, never native evidence.
// They omit canonical kind/browser/compiler/source fields, are never accepted
// through verifyBrowserReceipt, and are never serialized as a passing receipt.
async function rejectedInput(f) {
  const directory = path.join(f.output, 'production');
  const dist = path.join(f.root, 'apps/www/dist');
  await mkdir(directory);
  await mkdir(path.join(dist, '_astro'), { recursive: true });
  const contents = {
    [workerFile]: Buffer.from('// Negative fixture only; never executed as a Worker.\n'),
    [wasmFile]: Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
  };
  const files = {};
  for (const name of Object.keys(contents).sort()) {
    const bytes = contents[name];
    await writeFile(path.join(dist, name), bytes);
    files[name] = { bytes: bytes.length, sha256: digest(bytes) };
  }
  const source = {
    head: f.head,
    tree: f.git('rev-parse', 'HEAD^{tree}'),
    worktreeStatus: f.git('status', '--porcelain', '--untracked-files=normal'),
    lockSha256: digest(await readFile(path.join(f.root, 'pnpm-lock.yaml'))),
  };
  assert.equal(source.worktreeStatus, '');
  const url = 'http://127.0.0.1:43219';
  const production = {
    candidate: f.head,
    source,
    build: {
      status: 'passed',
      command: ['corepack', 'pnpm@10.32.1', 'run', 'build'],
      cwd: path.join(f.root, 'apps/www'),
      exitCode: 0,
      signal: null,
      stopReason: null,
      spawnError: null,
      ioError: null,
    },
    files,
    stability: { status: 'passed', distSha256: digest(serialize(files)) },
  };
  await writeFile(
    path.join(directory, 'build.log'),
    'NEGATIVE CONTROL ONLY: this is not an Astro build or browser execution.\n'
  );
  await writeFile(path.join(directory, 'dist-files.json'), serialize(files));
  await writeFile(
    path.join(directory, 'preview-requests.jsonl'),
    serialize({ kind: 'negative-control-only', noBrowserExecution: true })
  );
  for (const name of artifactNames) f.sealProductionArtifact(directory, production, name);
  const service = {
    mode: 'runner-owned-production-static',
    url,
    owner: {
      status: 'passed',
      closed: true,
      root: f.root,
      cwd: path.join(f.root, 'apps/www'),
      pid: process.pid,
      port: 43219,
    },
    production,
  };
  const loadedProductionAssets = Object.fromEntries(
    Object.entries(files).map(([name, file]) => [
      name,
      {
        status: 200,
        sha256: file.sha256,
        contentType: name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
      },
    ])
  );
  const receipt = {
    head: f.head,
    service,
    consoleErrors: [],
    cases: [{ name: 'production-worker-chunks-and-cleanup', status: 'passed' }],
    productionWorkers: Array.from({ length: 4 }, () => ({
      url: url + '/' + workerFile,
      closed: true,
    })),
    loadedProductionAssets,
  };
  return {
    directory,
    dist,
    receipt,
    verify: () => f.helper.verifyProductionBrowserEvidence(receipt, { PUI_EVIDENCE_DIR: f.output }),
  };
}

for (const [name, environment, message] of [
  [
    'caller URL',
    { PUI_BROWSER_URL: 'http://127.0.0.1:43219' },
    /production rejects external browser URLs/,
  ],
  ['caller port', { PUI_BROWSER_PORT: '43219' }, /production owns an ephemeral loopback port/],
  ['missing candidate', { CANDIDATE_SHA: undefined }, /production requires CANDIDATE_SHA/],
  ['abbreviated candidate', { CANDIDATE_SHA: '3195270' }, /production requires CANDIDATE_SHA/],
  [
    'different full candidate',
    { CANDIDATE_SHA: '0'.repeat(40) },
    /production checkout must match CANDIDATE_SHA/,
  ],
]) {
  test('production preparation rejects ' + name + ' before starting a build', async (t) => {
    const f = await fixture(t);
    await assert.rejects(
      f.helper.prepareProductionBrowserService({
        root: f.root,
        output: f.output,
        environment: { CANDIDATE_SHA: f.head, ...environment },
      }),
      message
    );
    assert.equal(existsSync(path.join(f.output, 'production/build.log')), false);
  });
}

test('production preparation refuses a genuinely dirty Git checkout', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'tracked.txt'), 'changed tracked source\n');
  await assert.rejects(
    f.helper.prepareProductionBrowserService({
      root: f.root,
      output: f.output,
      environment: { CANDIDATE_SHA: f.head },
    }),
    /production requires a clean candidate checkout/
  );
  assert.equal(existsSync(path.join(f.output, 'production/build.log')), false);
});

for (const [name, mutate, rejected] of [
  [
    'unclosed listener',
    (r) => {
      r.service.owner.closed = false;
    },
    (error) => /owned production listener must close/.test(error.message),
  ],
  [
    'failed build',
    (r) => {
      r.service.production.build.status = 'failed';
    },
    (error) =>
      error.code === 'ERR_ASSERTION' && error.actual === 'failed' && error.expected === 'passed',
  ],
  [
    'different build command',
    (r) => {
      r.service.production.build.command = ['node', 'unowned-build.mjs'];
    },
    (error) =>
      error.code === 'ERR_ASSERTION' &&
      JSON.stringify(error.expected) ===
        JSON.stringify(['corepack', 'pnpm@10.32.1', 'run', 'build']),
  ],
  [
    'missing sealed request log',
    (r) => {
      delete r.service.production.productionArtifacts['preview-requests.jsonl'];
    },
    (error) =>
      error.code === 'ERR_ASSERTION' &&
      JSON.stringify(error.expected) === JSON.stringify([...artifactNames].sort()),
  ],
]) {
  test('production service validation rejects ' + name, async (t) => {
    const f = await fixture(t);
    const { receipt } = await rejectedInput(f);
    mutate(receipt);
    assert.throws(() => f.helper.verifyProductionBrowserService(receipt.service), rejected);
  });
}

for (const name of artifactNames) {
  test('independent production verification rereads sealed ' + name + ' bytes', async (t) => {
    const f = await fixture(t);
    const input = await rejectedInput(f);
    const file = path.join(input.directory, name);
    const original = await readFile(file);
    const changed = Buffer.from(original);
    changed[0] ^= 1; // Same length: the content digest, not only size, must reject.
    await writeFile(file, changed);
    const sealed = input.receipt.service.production.productionArtifacts[name];
    assert.throws(
      input.verify,
      (error) =>
        error.code === 'ERR_ASSERTION' &&
        error.actual === digest(changed) &&
        error.expected === sealed.sha256
    );
  });
}

test('independent production verification rejects altered current dist bytes', async (t) => {
  const f = await fixture(t);
  const input = await rejectedInput(f);
  await writeFile(path.join(input.dist, workerFile), '// changed dist source\n');
  assert.throws(
    input.verify,
    (error) =>
      error.code === 'ERR_ASSERTION' &&
      error.expected === input.receipt.service.production.files &&
      error.actual[workerFile].sha256 !== error.expected[workerFile].sha256
  );
});

test('independent production verification refuses an artifact alias even with identical bytes', async (t) => {
  const f = await fixture(t);
  const input = await rejectedInput(f);
  const original = path.join(input.directory, 'build.log');
  const aliasTarget = path.join(f.parent, 'same-bytes.log');
  await writeFile(aliasTarget, await readFile(original));
  await unlink(original);
  await symlink(aliasTarget, original);
  assert.throws(input.verify, /production artifacts cannot be aliases/);
});

test('independent production verification compares the actual Git candidate', async (t) => {
  const f = await fixture(t);
  const input = await rejectedInput(f);
  input.receipt.head = '0'.repeat(40);
  input.receipt.service.production.candidate = input.receipt.head;
  input.receipt.service.production.source.head = input.receipt.head;
  assert.throws(
    input.verify,
    (error) =>
      error.code === 'ERR_ASSERTION' &&
      error.actual.head === f.head &&
      error.expected.head === input.receipt.head
  );
});

test('independent production verification rejects source dirtiness after a sealed build', async (t) => {
  const f = await fixture(t);
  const input = await rejectedInput(f);
  await writeFile(path.join(f.root, 'tracked.txt'), 'source drift after build\n');
  assert.throws(
    input.verify,
    (error) =>
      error.code === 'ERR_ASSERTION' &&
      error.actual.worktreeStatus.includes('tracked.txt') &&
      error.expected.worktreeStatus === ''
  );
});

for (const [name, mutate, message] of [
  [
    'an unretired Worker',
    (r) => {
      r.productionWorkers[0].closed = false;
    },
    /navigation must retire every actual module Worker/,
  ],
  [
    'a Worker from another origin',
    (r) => {
      r.productionWorkers[0].url = 'https://foreign.invalid/_astro/negative-worker.js';
    },
    /foreign\.invalid/,
  ],
  [
    'a Worker entry without consumed production bytes',
    (r) => {
      delete r.loadedProductionAssets[workerFile];
    },
    /actual Worker entry was consumed/,
  ],
  [
    'incomplete initial cancel reopen and bilingual Worker history',
    (r) => {
      r.productionWorkers.pop();
    },
    /initial\/cancel\/reopen\/bilingual Workers must run/,
  ],
]) {
  test('production browser proof rejects ' + name, async (t) => {
    const f = await fixture(t);
    const input = await rejectedInput(f);
    mutate(input.receipt);
    assert.throws(input.verify, message);
  });
}

for (const [name, file, mutate, expectedFailure] of [
  [
    'wrong JavaScript MIME',
    workerFile,
    (entry) => {
      entry.contentType = 'text/plain';
    },
    (error) => error.code === 'ERR_ASSERTION' && error.actual === 'text/plain',
  ],
  [
    'wrong WASM MIME',
    wasmFile,
    (entry) => {
      entry.contentType = 'application/octet-stream';
    },
    (error) => error.code === 'ERR_ASSERTION' && error.actual === 'application/octet-stream',
  ],
  [
    'failed asset response',
    workerFile,
    (entry) => {
      entry.status = 404;
    },
    (error) => error.code === 'ERR_ASSERTION' && error.actual === 404 && error.expected === 200,
  ],
  [
    'mismatched loaded asset hash',
    workerFile,
    (entry) => {
      entry.sha256 = '0'.repeat(64);
    },
    (error) => error.code === 'ERR_ASSERTION' && error.actual === '0'.repeat(64),
  ],
]) {
  test('production browser proof rejects ' + name, async (t) => {
    const f = await fixture(t);
    const input = await rejectedInput(f);
    mutate(input.receipt.loadedProductionAssets[file]);
    assert.throws(input.verify, expectedFailure);
  });
}

test('production browser proof requires its own completed Worker control', async (t) => {
  const f = await fixture(t);
  const input = await rejectedInput(f);
  input.receipt.cases = [];
  assert.throws(
    input.verify,
    (error) => error.code === 'ERR_ASSERTION' && error.actual === false && error.expected === true
  );
});

test(
  'an actually failing owned build is sealed without starting preview and releases signal handlers',
  { timeout: 40_000 },
  async (t) => {
    const f = await fixture(t);
    const pidFile = path.join(f.parent, 'failed-build.pid');
    const childProgram = [
      "import { readFileSync } from 'node:fs';",
      "import path from 'node:path';",
      'const helper = await import(process.env.PUI_NEGATIVE_HELPER_URL);',
      "const before = ['SIGINT', 'SIGTERM'].map((name) => process.listenerCount(name));",
      'let rejected = false;',
      'try {',
      '  await helper.prepareProductionBrowserService({',
      '    root: process.env.PUI_NEGATIVE_ROOT, output: process.env.PUI_NEGATIVE_OUTPUT, environment: process.env,',
      '  });',
      '} catch (error) {',
      '  rejected = true;',
      "  console.log('PUI_NEGATIVE_BUILD_RESULT ' + JSON.stringify({",
      '    message: String(error), before,',
      "    after: ['SIGINT', 'SIGTERM'].map((name) => process.listenerCount(name)),",
      "    production: JSON.parse(readFileSync(path.join(process.env.PUI_NEGATIVE_OUTPUT, 'production/production.json'), 'utf8')),",
      '  }));',
      '}',
      "if (!rejected) throw new Error('A failing fixture build must never become a browser service');",
    ].join('\n');
    const environment = {
      ...process.env,
      COREPACK_ENABLE_NETWORK: '0',
      CANDIDATE_SHA: f.head,
      PUI_NEGATIVE_HELPER_URL: f.moduleURL,
      PUI_NEGATIVE_ROOT: f.root,
      PUI_NEGATIVE_OUTPUT: f.output,
      PUI_NEGATIVE_BUILD_PID: pidFile,
    };
    delete environment.PUI_BROWSER_URL;
    delete environment.PUI_BROWSER_PORT;
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', childProgram], {
      cwd: f.root,
      env: environment,
      encoding: 'utf8',
      timeout: 30_000,
      killSignal: 'SIGTERM',
    });
    assert.equal(
      child.error,
      undefined,
      'the failed-build control must finish within its owned deadline'
    );
    assert.equal(child.status, 0, child.stderr);
    const line = child.stdout
      .split('\n')
      .find((entry) => entry.startsWith('PUI_NEGATIVE_BUILD_RESULT '));
    assert.ok(line, child.stdout);
    const result = JSON.parse(line.slice('PUI_NEGATIVE_BUILD_RESULT '.length));
    assert.match(result.message, /the owned production build must succeed/);
    assert.deepEqual(
      result.after,
      result.before,
      'build signal handlers must be removed after rejection'
    );
    assert.equal(result.production.build.status, 'failed');
    assert.notEqual(result.production.build.exitCode, 0);
    assert.equal(result.production.build.stopReason, null);
    assert.equal(result.production.build.spawnError, null);
    const buildLog = await readFile(path.join(f.output, 'production/build.log'));
    assert.match(buildLog.toString(), /INTENTIONAL_PRODUCTION_PREPARATION_NEGATIVE_CONTROL/);
    assert.equal(result.production.productionArtifacts['build.log'].sha256, digest(buildLog));
    assert.equal(existsSync(path.join(f.output, 'production/dist-files.json')), false);
    assert.equal(existsSync(path.join(f.output, 'production/preview-requests.jsonl')), false);
    const pid = Number(await readFile(pidFile, 'utf8'));
    assert.ok(Number.isInteger(pid) && pid > 0);
    assert.throws(
      () => process.kill(pid, 0),
      (error) => error.code === 'ESRCH'
    );
  }
);
