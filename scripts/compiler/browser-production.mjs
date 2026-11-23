import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { browserRepositoryRoot, digest } from './browser-inputs.mjs';
import {
  resolveEvidenceDirectory,
  runCommand,
  sealProductionArtifact,
  startOwnedPreview,
} from '../test/sprint3-consumer-evidence.mjs';

const command = ['corepack', 'pnpm@10.32.1', 'run', 'build'];
const artifactNames = ['build.log', 'dist-files.json', 'preview-requests.jsonl'];
const serialize = (value) => JSON.stringify(value, null, 2) + '\n';

function sourceState(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  return {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    worktreeStatus: git('status', '--porcelain', '--untracked-files=normal'),
    lockSha256: digest(readFileSync(path.join(root, 'pnpm-lock.yaml'))),
  };
}

function assertCandidate(source, candidate) {
  assert.match(candidate ?? '', /^[a-f0-9]{40}$/, 'production requires CANDIDATE_SHA');
  assert.equal(source.head, candidate, 'production checkout must match CANDIDATE_SHA');
  assert.equal(source.worktreeStatus, '', 'production requires a clean candidate checkout');
}

function inventory(directory) {
  assert.equal(realpathSync(directory), path.resolve(directory), 'dist cannot be an alias');
  const files = {};
  const visit = (relative) => {
    const file = path.join(directory, relative);
    const stat = lstatSync(file);
    assert.equal(stat.isSymbolicLink(), false, 'dist cannot contain symbolic links');
    if (stat.isDirectory()) {
      for (const name of readdirSync(file).sort()) visit(path.join(relative, name));
    } else {
      assert.ok(stat.isFile(), 'dist entries must be ordinary files');
      const bytes = readFileSync(file);
      files[relative.split(path.sep).join('/')] = { bytes: bytes.length, sha256: digest(bytes) };
    }
  };
  visit('');
  assert.ok(Object.keys(files).length, 'production build must contain files');
  return files;
}

/** The same static production server used by Sprint 3; never accepts an external URL. */
export async function prepareProductionBrowserService({ root, output, environment }) {
  assert.equal(environment.PUI_BROWSER_URL, undefined, 'production rejects external browser URLs');
  assert.equal(
    environment.PUI_BROWSER_PORT,
    undefined,
    'production owns an ephemeral loopback port'
  );
  root = realpathSync(root);
  const directory = resolveEvidenceDirectory(path.join(output, 'production'), root);
  mkdirSync(directory);
  const candidate = environment.CANDIDATE_SHA;
  const source = sourceState(root);
  assertCandidate(source, candidate);
  const cwd = path.join(root, 'apps/www');
  const production = { candidate, source, build: { status: 'running', command, cwd } };
  const save = () => writeFileSync(path.join(directory, 'production.json'), serialize(production));
  save();
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const result = await runCommand(command[0], command.slice(1), {
      cwd,
      env: { ...environment, ASTRO_TELEMETRY_DISABLED: '1' },
      log: path.join(directory, 'build.log'),
      timeoutMs: 20 * 60_000,
      signal: abort.signal,
    });
    production.build = {
      ...production.build,
      ...result,
      status:
        result.exitCode === 0 && !result.stopReason && !result.spawnError && !result.ioError
          ? 'passed'
          : 'failed',
    };
    sealProductionArtifact(directory, production, 'build.log');
    save();
    assert.equal(production.build.status, 'passed', 'the owned production build must succeed');
    assert.deepEqual(sourceState(root), source, 'candidate changed during the production build');
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
  const dist = path.join(cwd, 'dist');
  production.files = inventory(dist);
  writeFileSync(path.join(directory, 'dist-files.json'), serialize(production.files), {
    flag: 'wx',
  });
  sealProductionArtifact(directory, production, 'dist-files.json');
  save();
  const preview = await startOwnedPreview(
    dist,
    candidate,
    path.join(directory, 'preview-requests.jsonl')
  );
  const receipt = {
    mode: 'runner-owned-production-static',
    url: preview.url,
    owner: {
      status: 'running',
      root,
      cwd,
      pid: process.pid,
      port: Number(new URL(preview.url).port),
    },
    production,
  };
  return {
    url: preview.url,
    receipt,
    files: production.files,
    async close(completed) {
      try {
        await preview.close();
        receipt.owner.closed = true;
        sealProductionArtifact(directory, production, 'preview-requests.jsonl');
        for (const name of artifactNames) {
          const bytes = readFileSync(path.join(directory, name));
          const sealed = production.productionArtifacts[name];
          assert.equal(bytes.length, sealed.bytes, 'sealed artifact size changed: ' + name);
          assert.equal(digest(bytes), sealed.sha256, 'sealed artifact changed: ' + name);
        }
        assert.deepEqual(
          inventory(dist),
          production.files,
          'production files changed during browsing'
        );
        assert.deepEqual(sourceState(root), source, 'candidate changed during browsing');
        production.stability = {
          status: 'passed',
          distSha256: digest(serialize(production.files)),
        };
        receipt.owner.status = completed ? 'passed' : 'failed';
      } catch (error) {
        receipt.owner.status = 'failed';
        production.stability = { status: 'failed', error: String(error) };
        throw error;
      } finally {
        save();
      }
    },
  };
}

export function verifyProductionBrowserService(service) {
  const { owner, production } = service ?? {};
  assert.equal(service?.mode, 'runner-owned-production-static');
  assert.equal(owner?.status, 'passed');
  assert.equal(owner?.closed, true, 'owned production listener must close');
  assert.ok(path.isAbsolute(owner.root));
  assert.equal(owner.cwd, path.join(owner.root, 'apps/www'));
  assert.ok(Number.isInteger(owner.pid) && owner.pid > 0);
  assert.ok(Number.isInteger(owner.port) && owner.port > 0 && owner.port <= 65535);
  assert.equal(service.url, 'http://127.0.0.1:' + owner.port);
  assertCandidate(production?.source, production?.candidate);
  assert.equal(production.build.status, 'passed');
  assert.equal(production.build.exitCode, 0);
  assert.equal(production.build.stopReason, null);
  assert.equal(production.build.spawnError, null);
  assert.equal(production.build.ioError, null);
  assert.deepEqual(production.build.command, command);
  assert.equal(production.build.cwd, owner.cwd);
  assert.equal(production.stability.status, 'passed');
  const manifestSha256 = digest(serialize(production.files));
  assert.equal(production.stability.distSha256, manifestSha256);
  assert.deepEqual(Object.keys(production.productionArtifacts).sort(), [...artifactNames].sort());
  for (const name of artifactNames) {
    const artifact = production.productionArtifacts[name];
    assert.equal(artifact.file, name);
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(artifact.bytes) && artifact.bytes > 0);
  }
  assert.equal(production.productionArtifacts['dist-files.json'].sha256, manifestSha256);
}

/** Re-read fixed local build artifacts, rather than accepting receipt-supplied paths. */
export function verifyProductionBrowserEvidence(receipt, environment = process.env) {
  verifyProductionBrowserService(receipt.service);
  assert.ok(environment.PUI_EVIDENCE_DIR, 'production verification needs its evidence directory');
  const directory = resolveEvidenceDirectory(
    path.join(environment.PUI_EVIDENCE_DIR, 'production'),
    browserRepositoryRoot
  );
  const production = receipt.service.production;
  assert.equal(receipt.head, production.candidate);
  assert.deepEqual(sourceState(browserRepositoryRoot), production.source);
  assert.deepEqual(inventory(path.join(browserRepositoryRoot, 'apps/www/dist')), production.files);
  for (const name of artifactNames) {
    const file = path.join(directory, name);
    assert.equal(realpathSync(file), file, 'production artifacts cannot be aliases');
    assert.ok(lstatSync(file).isFile());
    const bytes = readFileSync(file);
    assert.equal(bytes.length, production.productionArtifacts[name].bytes);
    assert.equal(digest(bytes), production.productionArtifacts[name].sha256);
  }
  assert.deepEqual(
    JSON.parse(readFileSync(path.join(directory, 'dist-files.json'), 'utf8')),
    production.files
  );
  assert.deepEqual(receipt.consoleErrors, []);
  assert.ok(
    receipt.cases.some(
      (row) => row.name === 'production-worker-chunks-and-cleanup' && row.status === 'passed'
    )
  );
  const workers = receipt.productionWorkers;
  assert.ok(
    Array.isArray(workers) && workers.length >= 4,
    'initial/cancel/reopen/bilingual Workers must run'
  );
  for (const worker of workers) {
    const url = new URL(worker.url);
    assert.equal(url.origin, receipt.service.url);
    assert.match(url.pathname, /^\/_astro\/[^/]+\.js$/);
    assert.equal(worker.closed, true, 'navigation must retire every actual module Worker');
    assert.ok(
      receipt.loadedProductionAssets[url.pathname.slice(1)],
      'actual Worker entry was consumed'
    );
  }
  for (const [file, loaded] of Object.entries(receipt.loadedProductionAssets)) {
    const expected = production.files[file];
    assert.ok(expected, 'loaded asset must belong to the sealed production build: ' + file);
    assert.equal(loaded.status, 200);
    assert.equal(loaded.sha256, expected.sha256);
    assert.match(
      loaded.contentType,
      file.endsWith('.wasm') ? /application\/wasm/ : /(?:java|ecma)script/i
    );
  }
}
