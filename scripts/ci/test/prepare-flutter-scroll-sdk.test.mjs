import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  prepareFlutterScrollSdk,
  requireFlutterScrollIdentity,
} from '../prepare-flutter-scroll-sdk.mjs';

const observed = {
  flutterVersion: '3.47.5',
  channel: 'stable',
  frameworkRevision: '6a19cca56475dbfba1478ee68d7bd0c2ef891da1',
  engineRevision: 'af7e796e161ae0bb1ff0758c71a7105418bd9ded',
  dartSdkVersion: '3.13.4 (stable)',
};

test('accepts the independently observed pinned Flutter and Dart identity', () => {
  assert.equal(requireFlutterScrollIdentity(observed), observed);
});

for (const [field, value] of [
  ['flutterVersion', '3.50.1'],
  ['channel', 'beta'],
  ['frameworkRevision', '0'.repeat(40)],
  ['engineRevision', '0'.repeat(40)],
  ['dartSdkVersion', '3.14.0'],
  ['dartSdkVersion', '3.13.40'],
  ['frameworkRevision', undefined],
]) {
  test('rejects an actual SDK identity mismatch: ' + field + '=' + value, () => {
    assert.throws(() => requireFlutterScrollIdentity({ ...observed, [field]: value }));
  });
}

test('a pre-existing SDK destination is preserved and never published as prepared', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'proto-flutter-owner-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const sdk = path.join(temporary, 'sdk');
  const evidence = path.join(temporary, 'evidence');
  const environment = path.join(temporary, 'github-env');
  await fs.mkdir(sdk);
  await fs.writeFile(path.join(sdk, 'owner.txt'), 'Existing owner data\n');
  await fs.writeFile(environment, 'EXISTING=value\n');
  await assert.rejects(prepareFlutterScrollSdk(sdk, evidence, { GITHUB_ENV: environment }), {
    code: 'EEXIST',
  });
  assert.equal(await fs.readFile(path.join(sdk, 'owner.txt'), 'utf8'), 'Existing owner data\n');
  assert.equal(await fs.readFile(environment, 'utf8'), 'EXISTING=value\n');
  const receipt = JSON.parse(await fs.readFile(path.join(evidence, 'sdk-identity.json'), 'utf8'));
  assert.equal(receipt.completed, false);
  assert.match(receipt.error, /EEXIST/u);
  assert.equal(receipt.flutter, undefined);
});

test('the actual pre-created CI evidence container reaches the SDK ownership guard', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'proto-flutter-ci-entry-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const sdk = path.join(temporary, 'sdk');
  const evidence = path.join(temporary, 'evidence');
  const environment = path.join(temporary, 'github-env');
  await fs.mkdir(sdk);
  await fs.writeFile(path.join(sdk, 'owner.txt'), 'Existing SDK owner\n');
  await fs.mkdir(evidence);
  await fs.writeFile(path.join(evidence, 'source-sha'), 'frozen-source\n');
  await fs.writeFile(path.join(evidence, 'preparation.log'), 'Caller tee log\n');
  await fs.writeFile(environment, 'EXISTING=value\n');
  await assert.rejects(prepareFlutterScrollSdk(sdk, evidence, { GITHUB_ENV: environment }), {
    code: 'EEXIST',
  });
  // A failure at the outer evidence mkdir never reaches this owned receipt.
  const receipt = JSON.parse(await fs.readFile(path.join(evidence, 'sdk-identity.json'), 'utf8'));
  assert.equal(receipt.completed, false);
  assert.equal(receipt.sdkRoot, sdk);
  assert.match(receipt.error, /EEXIST/u);
  assert.equal(await fs.readFile(path.join(sdk, 'owner.txt'), 'utf8'), 'Existing SDK owner\n');
  assert.equal(await fs.readFile(path.join(evidence, 'source-sha'), 'utf8'), 'frozen-source\n');
  assert.equal(
    await fs.readFile(path.join(evidence, 'preparation.log'), 'utf8'),
    'Caller tee log\n'
  );
  assert.equal(await fs.readFile(environment, 'utf8'), 'EXISTING=value\n');
});
