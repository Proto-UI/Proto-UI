import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runModelTraceCli } from '../modeltrace-cli.mjs';

test('challenge rejects checkout contexts before reading, including directory aliases', (t) => {
  const outside = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-context-input-'));
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const inside = fs.mkdtempSync(path.join(root, '.modeltrace-context-fixture-'));
  t.after(() => {
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(inside, { recursive: true, force: true });
  });
  const context = {
    schemaVersion: 1,
    kind: 'proto-ui.modeltrace-context',
    repositoryId: 'github.com:fixture/repository',
    sessionId: 'd'.repeat(64),
    contextDigest: 'a'.repeat(64),
    routeDigest: 'b'.repeat(64),
    declared: { systemModel: null, harnessModel: null },
  };
  const insideContext = path.join(inside, 'context.json');
  const malformedContext = path.join(inside, 'malformed.json');
  const outsideContext = path.join(outside, 'context.json');
  const alias = path.join(outside, 'checkout-alias');
  fs.writeFileSync(insideContext, JSON.stringify(context));
  fs.writeFileSync(malformedContext, '{unread private context');
  fs.writeFileSync(outsideContext, JSON.stringify(context));
  fs.symlinkSync(inside, alias);

  const deniedContexts = [insideContext, path.join(alias, 'context.json'), malformedContext];
  const openedContexts = [];
  const originalOpenSync = fs.openSync;
  t.mock.method(fs, 'openSync', function (p, flags, ...rest) {
    if (deniedContexts.includes(p)) openedContexts.push(p);
    return originalOpenSync.call(this, p, flags, ...rest);
  });
  let stdout = '';
  const options = {
    now: new Date('2026-10-06T00:00:00.000Z'),
    stdout: {
      write(text) {
        stdout += text;
      },
    },
  };
  for (const [index, contextPath] of deniedContexts.entries()) {
    const outPath = path.join(outside, `denied-${index}.json`);
    assert.throws(
      () => runModelTraceCli(['challenge', '--context', contextPath, '--out', outPath], options),
      /outside the repository/
    );
    assert.equal(fs.existsSync(outPath), false);
  }
  assert.deepEqual(openedContexts, [], 'checkout contexts must be refused before opening them');
  assert.equal(stdout, '');

  const outPath = path.join(outside, 'challenge.json');
  const challenge = runModelTraceCli(
    ['challenge', '--context', outsideContext, '--out', outPath],
    options
  );
  assert.deepEqual(challenge.context, context);
  assert.deepEqual(JSON.parse(fs.readFileSync(outPath, 'utf8')), challenge);
});

test('write-time parent retarget is rejected when renamed to a checkout symlink after preflight', (t) => {
  const outside = fs.mkdtempSync(path.join(tmpdir(), 'modeltrace-retarget-'));
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const inside = fs.mkdtempSync(path.join(root, '.modeltrace-retarget-fixture-'));
  const parent = path.join(outside, 'parent');
  fs.mkdirSync(parent);
  t.after(() => {
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(inside, { recursive: true, force: true });
  });

  const contextPath = path.join(outside, 'context.json');
  fs.writeFileSync(
    contextPath,
    JSON.stringify({
      schemaVersion: 1,
      kind: 'proto-ui.modeltrace-context',
      repositoryId: 'github.com:fixture/repository',
      sessionId: 'd'.repeat(64),
      contextDigest: 'a'.repeat(64),
      routeDigest: 'b'.repeat(64),
      declared: { systemModel: null, harnessModel: null },
    })
  );

  const outPath = path.join(parent, 'record.json');
  let retargeted = false;
  const originalOpenSync = fs.openSync;
  t.mock.method(fs, 'openSync', function (p, flags, ...rest) {
    if (!retargeted && p === contextPath) {
      fs.renameSync(parent, path.join(outside, 'parent.bak'));
      fs.symlinkSync(inside, parent);
      retargeted = true;
    }
    return originalOpenSync.call(this, p, flags, ...rest);
  });

  assert.throws(
    () =>
      runModelTraceCli(['challenge', '--context', contextPath, '--out', outPath], {
        now: new Date('2026-10-06T00:00:00.000Z'),
        stdout: { write() {} },
      }),
    /outside the repository/
  );
  assert.equal(retargeted, true, 'retarget injection must have fired between preflight and write');
  assert.equal(fs.existsSync(path.join(inside, 'record.json')), false);
});
