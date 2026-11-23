import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

// Official stable release archive, matching the dormant emitter's declared target.
// https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json
export const FLUTTER_SCROLL_SDK = Object.freeze({
  version: '3.47.5',
  dartVersion: '3.13.4',
  frameworkRevision: '6a19cca56475dbfba1478ee68d7bd0c2ef891da1',
  engineRevision: 'af7e796e161ae0bb1ff0758c71a7105418bd9ded',
  url: 'https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.47.5-stable.tar.xz',
  archiveSha256: '2132e990f236f8d22e7c6314b29a191a95b10d7cbcfec9b4e2e303d996652cbb',
  archiveBytes: 1576266884,
});

export function requireFlutterScrollIdentity(value) {
  assert.equal(value.flutterVersion, FLUTTER_SCROLL_SDK.version, 'Actual Flutter version');
  assert.equal(value.channel, 'stable', 'Actual Flutter channel');
  assert.equal(value.frameworkRevision, FLUTTER_SCROLL_SDK.frameworkRevision, 'Actual framework');
  assert.equal(value.engineRevision, FLUTTER_SCROLL_SDK.engineRevision, 'Actual engine');
  assert.match(value.dartSdkVersion, /^3\.13\.4(?:\s|$)/u, 'Actual Dart version');
  return value;
}

async function archiveIdentity(file) {
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length;
    assert.ok(bytes <= FLUTTER_SCROLL_SDK.archiveBytes, 'SDK archive exceeds pinned size');
    digest.update(chunk);
  }
  const sha256 = digest.digest('hex');
  assert.equal(bytes, FLUTTER_SCROLL_SDK.archiveBytes, 'SDK archive size');
  assert.equal(sha256, FLUTTER_SCROLL_SDK.archiveSha256, 'SDK archive content identity');
  return { bytes, sha256 };
}

async function downloadArchive(file) {
  const response = await fetch(FLUTTER_SCROLL_SDK.url, {
    redirect: 'error',
    signal: AbortSignal.timeout(600_000),
  });
  assert.equal(response.status, 200, 'Official Flutter archive response');
  assert.ok(response.body, 'Official Flutter archive body');
  const length = response.headers.get('content-length');
  if (length !== null) assert.equal(Number(length), FLUTTER_SCROLL_SDK.archiveBytes);
  let bytes = 0;
  const bounded = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(
        bytes > FLUTTER_SCROLL_SDK.archiveBytes
          ? new Error('Official archive exceeds pinned size')
          : null,
        chunk
      );
    },
  });
  const partial = file + '.partial';
  await pipeline(
    Readable.fromWeb(response.body),
    bounded,
    createWriteStream(partial, { flags: 'wx' })
  );
  const identity = await archiveIdentity(partial);
  await fs.rename(partial, file);
  return identity;
}

async function command(evidence, label, executable, args, cwd, env, timeoutMs) {
  const stdoutFile = path.join(evidence, label + '.stdout.log');
  const stderrFile = path.join(evidence, label + '.stderr.log');
  const stdout = createWriteStream(stdoutFile, { flags: 'wx' });
  const stderr = createWriteStream(stderrFile, { flags: 'wx' });
  const startedAt = new Date().toISOString();
  let output = '';
  let outputBytes = 0;
  let timedOut = false;
  let error;
  const child = spawn(executable, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stop = () => {
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (failure) {
        if (failure.code !== 'ESRCH') throw failure;
      }
    }
  };
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutMs);
  child.stdout.on('data', (chunk) => {
    stdout.write(chunk);
    outputBytes += chunk.length;
    if (outputBytes <= 8 * 1024 * 1024) output += chunk.toString();
    else {
      error = 'Command stdout exceeded capture bound';
      stop();
    }
  });
  child.stderr.pipe(stderr);
  child.on('error', (failure) => {
    error = failure.message;
  });
  const result = await new Promise((resolve) =>
    child.on('close', (code, signal) => resolve({ code, signal }))
  );
  clearTimeout(timer);
  await Promise.all([
    new Promise((resolve, reject) =>
      stdout.end((failure) => (failure ? reject(failure) : resolve()))
    ),
    new Promise((resolve, reject) => {
      if (stderr.writableFinished) resolve();
      else {
        stderr.once('finish', resolve);
        stderr.once('error', reject);
      }
    }),
  ]);
  const receipt = {
    command: [executable, ...args],
    cwd,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...result,
    timedOut,
    error: error ?? null,
    stdoutFile,
    stderrFile,
  };
  await fs.writeFile(
    path.join(evidence, label + '.json'),
    JSON.stringify(receipt, null, 2) + '\n',
    { flag: 'wx' }
  );
  assert.equal(error, undefined, label + ' spawn/output error');
  assert.equal(timedOut, false, label + ' timeout');
  assert.equal(result.signal, null, label + ' signal');
  assert.equal(result.code, 0, label + ' exit');
  return output;
}

export async function prepareFlutterScrollSdk(sdkRoot, evidence, env = process.env) {
  assert.equal(process.platform, 'linux', 'Pinned Flutter archive requires Linux');
  assert.equal(process.arch, 'x64', 'Pinned Flutter archive requires x64');
  for (const value of [sdkRoot, evidence, env.GITHUB_ENV]) {
    assert.ok(
      typeof value === 'string' && path.isAbsolute(value) && !/[\r\n\0]/u.test(value),
      'SDK, evidence and GitHub environment paths must be absolute single-line paths'
    );
  }
  sdkRoot = path.resolve(sdkRoot);
  evidence = path.resolve(evidence);
  assert.notEqual(sdkRoot, evidence, 'SDK and evidence roots must be separate');
  // The CI caller creates this outer container for source identity and tee logs.
  // SDK roots and every preparation-owned file remain create-only.
  await fs.mkdir(evidence, { recursive: true });
  const receipt = {
    startedAt: new Date().toISOString(),
    pin: FLUTTER_SCROLL_SDK,
    nodeVersion: process.version,
    sdkRoot,
    evidence,
    completed: false,
  };
  const receiptFile = path.join(evidence, 'sdk-identity.json');
  try {
    await fs.mkdir(sdkRoot, { recursive: false });
    const cachedArchive = env.PROTO_UI_FLUTTER_ARCHIVE;
    const archive = cachedArchive
      ? path.resolve(cachedArchive)
      : path.join(sdkRoot, 'flutter.tar.xz');
    receipt.archiveOrigin = cachedArchive
      ? 'explicit local cache, same mandatory content pin'
      : FLUTTER_SCROLL_SDK.url;
    console.log('Verifying pinned Flutter archive');
    receipt.archive = cachedArchive
      ? await archiveIdentity(archive)
      : await downloadArchive(archive);
    const childEnv = {
      ...env,
      CI: 'true',
      FLUTTER_SUPPRESS_ANALYTICS: 'true',
      DART_SUPPRESS_ANALYTICS: 'true',
      PUB_CACHE: path.join(sdkRoot, 'pub-cache'),
    };
    await fs.mkdir(childEnv.PUB_CACHE);
    console.log('Extracting verified Flutter SDK');
    await command(
      evidence,
      'extract',
      'tar',
      ['--no-same-owner', '-xf', archive, '-C', sdkRoot],
      sdkRoot,
      childEnv,
      600_000
    );
    const flutter = path.join(sdkRoot, 'flutter', 'bin', 'flutter');
    const machine = await command(
      evidence,
      'version',
      flutter,
      ['--version', '--machine'],
      sdkRoot,
      childEnv,
      180_000
    );
    receipt.actual = requireFlutterScrollIdentity(JSON.parse(machine));
    console.log('Preparing pinned native engine and SDK dependency cache');
    await command(
      evidence,
      'precache',
      flutter,
      ['precache', '--linux'],
      sdkRoot,
      childEnv,
      600_000
    );
    const seed = path.join(sdkRoot, 'cache-seed');
    await fs.mkdir(seed);
    const pubspec =
      'name: compiled_proto_component\npublish_to: none\nenvironment:\n  sdk: ">=3.13.4 <4.0.0"\n  flutter: ">=3.47.5"\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n';
    await fs.writeFile(path.join(seed, 'pubspec.yaml'), pubspec, { flag: 'wx' });
    await fs.writeFile(path.join(evidence, 'cache-seed.pubspec.yaml'), pubspec, { flag: 'wx' });
    await command(evidence, 'pub-cache-warm', flutter, ['pub', 'get'], seed, childEnv, 300_000);
    const lock = await fs.readFile(path.join(seed, 'pubspec.lock'));
    await fs.writeFile(path.join(evidence, 'cache-seed.pubspec.lock'), lock, { flag: 'wx' });
    receipt.cacheSeedLockSha256 = createHash('sha256').update(lock).digest('hex');
    receipt.flutter = flutter;
    receipt.pubCache = childEnv.PUB_CACHE;
    receipt.nativeEvidence = evidence;
    // The existing consumer still performs its own offline pub get and real
    // Widget tests. Cache preparation makes no product-test acceptance claim.
    await fs.appendFile(
      env.GITHUB_ENV,
      'PROTO_UI_FLUTTER=' +
        flutter +
        '\nPUB_CACHE=' +
        childEnv.PUB_CACHE +
        '\nPROTO_UI_FLUTTER_EVIDENCE_DIR=' +
        receipt.nativeEvidence +
        '\n'
    );
    receipt.completed = true;
    console.log('Pinned Flutter SDK and offline consumer cache ready');
    return receipt;
  } catch (error) {
    receipt.error = error.message;
    throw error;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    await fs.writeFile(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 4)
    throw new Error(
      'Usage: node prepare-flutter-scroll-sdk.mjs <new-sdk-root> <new-evidence-directory>'
    );
  await prepareFlutterScrollSdk(process.argv[2], process.argv[3]);
}
