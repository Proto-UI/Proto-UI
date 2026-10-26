import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { accordionActivationProbePlugin } from './accordion-activation-probe.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const routerPath = path.join(root, 'packages/adapters/base/src/events/web-event-router.ts');
const reactPath = path.join(root, 'packages/adapters/react/src/adapt.ts');
const routerSource = readFileSync(routerPath, 'utf8');
const reactSource = readFileSync(reactPath, 'utf8');
const gateSource = readFileSync(
  path.join(root, 'packages/adapters/base/src/gate/event-gate.ts'),
  'utf8'
);
const envKey = 'PROTO_UI_ACCORDION_ACTIVATION_PROBE_DIR';
const probeDirectory = mkdtempSync(path.join(os.tmpdir(), 'accordion-activation-probe-'));
after(() => rmSync(probeDirectory, { recursive: true, force: true }));

function plugin(value = probeDirectory) {
  const previous = process.env[envKey];
  try {
    if (value === undefined) delete process.env[envKey];
    else process.env[envKey] = value;
    return accordionActivationProbePlugin(root);
  } finally {
    if (previous === undefined) delete process.env[envKey];
    else process.env[envKey] = previous;
  }
}

function javascript(source) {
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
}

function between(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `missing source boundary ${start}`);
  return source.slice(first, last);
}

const router = () => plugin().transform(routerSource, routerPath).code;
const react = () => plugin().transform(reactSource, reactPath).code;

it('is absent without opt-in and excluded by actual Vite build plugin selection', async () => {
  assert.equal(plugin(''), undefined);
  const previous = process.env[envKey];
  delete process.env[envKey];
  try {
    assert.equal(accordionActivationProbePlugin(root), undefined);
  } finally {
    if (previous !== undefined) process.env[envKey] = previous;
  }
  const astroRequire = createRequire(require.resolve('astro/package.json'));
  const { resolveConfig } = await import(pathToFileURL(astroRequire.resolve('vite')).href);
  const selected = plugin();
  const config = await resolveConfig(
    { root, configFile: false, envFile: false, plugins: [selected], logLevel: 'silent' },
    'build'
  );
  assert.equal(
    config.plugins.some((item) => item.name === selected.name),
    false
  );
});

it('only transforms the two exact source paths and rejects source-shape drift', () => {
  const selected = plugin();
  assert.equal(selected.transform(routerSource, `${routerPath}.other.ts`), null);
  assert.equal(selected.transform(routerSource, path.join(root, 'packages/cli/src/ir.ts')), null);
  assert.equal(selected.transform(routerSource, `${routerPath}?v=test`).code, router());
  assert.throws(
    () => selected.transform('', routerPath),
    /ACCORDION_ACTIVATION_PROBE_SETUP.*router-enabled/
  );
  assert.throws(
    () => selected.transform(`${routerSource}\n${routerSource}`, routerPath),
    /ACCORDION_ACTIVATION_PROBE_SETUP.*router-enabled/
  );
  assert.throws(
    () =>
      selected.transform(
        reactSource.replace('eventGateRef.current = eventGate;', 'eventGateRef.current = null;'),
        reactPath
      ),
    /ACCORDION_ACTIVATION_PROBE_SETUP.*react-event-gate/
  );
});

it('retains the actual transformed source hashes and refuses an unavailable evidence directory', () => {
  const selected = plugin();
  for (const [name, filename, source] of [
    ['router', routerPath, routerSource],
    ['react', reactPath, reactSource],
  ]) {
    const result = selected.transform(source, filename);
    const hash = (text) => createHash('sha256').update(text).digest('hex');
    const beforeSHA = hash(source),
      afterSHA = hash(result.code);
    const filenameReceipt = path.join(
      probeDirectory,
      'source-transforms',
      `${name}-${beforeSHA}-${afterSHA}.json`
    );
    const receiptBytes = readFileSync(filenameReceipt, 'utf8');
    const receipt = JSON.parse(receiptBytes);
    assert.equal(receipt.relativePath, path.relative(root, filename).replaceAll('\\', '/'));
    assert.equal(receipt.beforeSHA, beforeSHA);
    assert.equal(receipt.afterSHA, afterSHA);
    assert.equal(receipt.stage, 'test-onlyViteServe');
    assert.equal(receipt.shapes.length, name === 'router' ? 5 : 1);
    assert.equal(path.isAbsolute(receipt.relativePath), false);
    selected.transform(source, filename);
    assert.equal(readFileSync(filenameReceipt, 'utf8'), receiptBytes);
  }
  const unavailable = path.join(probeDirectory, 'not-a-directory');
  writeFileSync(unavailable, 'occupied');
  assert.throws(
    () => plugin(unavailable).transform(routerSource, routerPath),
    /ACCORDION_ACTIVATION_PROBE_SETUP.*Cannot retain transform binding/
  );
});

it('preserves the actual enabled result, short circuit and original throw under observer failures', () => {
  const observed = between(router(), '  const isEnabled =', '  const contactWriter =');
  const original = between(routerSource, '  const isEnabled =', '  const contactWriter =');
  for (const [active, value, originalThrows, observerThrows] of [
    [true, true, false, false],
    [true, false, false, false],
    [false, true, false, false],
    [false, true, true, true],
    [true, true, true, true],
    [true, true, false, true],
  ]) {
    const error = { original: true };
    function run(source) {
      const rootEl = {},
        routerIdentity = {},
        native = {};
      let calls = 0;
      const records = [];
      const context = {
        rootEl,
        routerIdentity,
        native,
        activeRouterByRoot: new Map(active ? [[rootEl, routerIdentity]] : []),
        opt: {
          isEnabled() {
            calls++;
            if (originalThrows) throw error;
            return value;
          },
        },
        __accordionTrace: {
          record(...args) {
            records.push(args);
            if (observerThrows) throw new Error('observer');
          },
        },
      };
      let result, thrown;
      try {
        result = vm.runInNewContext(
          javascript(source) + '\nisEnabled(native, "root.keydown");',
          context
        );
      } catch (caught) {
        thrown = caught;
      }
      return { result, thrown, calls, records, native };
    }
    const plain = run(original),
      captured = run(observed);
    assert.equal(captured.result, plain.result);
    assert.equal(captured.thrown, plain.thrown);
    assert.equal(captured.calls, active ? 1 : 0);
    assert.equal(captured.records.length, active && originalThrows ? 0 : 1);
    if (captured.records.length) {
      assert.equal(captured.records[0][1].optEvaluated, active);
      assert.equal(captured.records[0][5], captured.native);
    }
  }
});

it('forwards each of the three keyboard handlers own event into its original gate check', () => {
  const source = router();
  for (const [target, type, handler] of [
    ['globalEl', 'keydown', 'global.keydown'],
    ['rootEl', 'keydown', 'root.keydown'],
    ['globalEl', 'keyup', 'global.keyup'],
  ]) {
    const block = between(
      source,
      `    listen(${target}, '${type}', (e: KeyboardEvent) => {`,
      '\n    })'
    );
    let callback;
    const calls = [];
    const event = { type };
    vm.runInNewContext(javascript(block + '\n    });'), {
      [target]: {},
      listen(_target, _type, cb) {
        callback = cb;
      },
      isEnabled(...args) {
        calls.push(args);
        return false;
      },
    });
    callback(event);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], event);
    assert.equal(calls[0][1], handler);
  }
});

it('preserves one native dispatch and its original throw even when emit observations throw', () => {
  const source = between(router(), '  function emit(', '\n\n  function emitFromPhysicalRoot');
  const error = { originalDispatch: true };
  for (const originalThrows of [false, true]) {
    let calls = 0;
    const native = {};
    const target = {
      dispatchEvent(event) {
        calls++;
        assert.equal(event.detail, native);
        if (originalThrows) throw error;
        return false;
      },
    };
    const context = {
      target,
      native,
      protoRootBus: {},
      rootEl: {},
      opt: {},
      routerIdentity: {},
      CustomEvent: class {
        constructor(type, options) {
          this.type = type;
          this.detail = options.detail;
        }
      },
      createProtoEventPayload: (_type, event) => event,
      __accordionTrace: {
        record() {
          throw new Error('observer');
        },
      },
    };
    const invoke = () =>
      vm.runInNewContext(javascript(source) + '\nemit(target, "key.down", native);', context);
    if (originalThrows) assert.throws(invoke, (caught) => caught === error);
    else assert.equal(invoke(), undefined);
    assert.equal(calls, 1);
  }
});

it('preserves the real eventGate method results, arguments and receiver under observer failures', () => {
  const source = between(
    react(),
    "        for (const method of ['enable'",
    '\n\n        const router ='
  );
  const make = () => {
    const context = { exports: {} };
    vm.runInNewContext(javascript(gateSource), context);
    return context.exports.createEventGate();
  };
  const operations = [
    'isEnabled',
    'enable',
    'isEnabled',
    'disable',
    'isEnabled',
    'dispose',
    'enable',
    'isEnabled',
  ];
  for (const observerThrows of [false, true]) {
    const plain = make(),
      eventGate = make();
    const calls = [],
      records = [],
      argument = {};
    for (const method of ['enable', 'disable', 'isEnabled', 'dispose']) {
      const original = eventGate[method];
      eventGate[method] = function (...args) {
        calls.push({ method, receiver: this, args });
        return Reflect.apply(original, this, args);
      };
    }
    vm.runInNewContext(javascript(source), {
      eventGate,
      rootEl: {},
      instanceTokenRef: { current: {} },
      viewGenerationRef: { current: 4 },
      viewReadyRef: { current: true },
      pendingCommitRef: { current: null },
      __accordionTrace: {
        record(...args) {
          records.push(args);
          if (observerThrows) throw new Error('observer');
        },
      },
    });
    for (const method of operations)
      assert.equal(eventGate[method](argument), plain[method](argument));
    assert.deepEqual(
      calls.map((call) => call.method),
      operations
    );
    for (const call of calls) {
      assert.equal(call.receiver, eventGate);
      assert.equal(call.args.length, 1);
      assert.equal(call.args[0], argument);
    }
    assert.equal(records.length, operations.length);
    for (let i = 0; i < records.length; i++)
      assert.equal(records[i][0], `react.gate.${operations[i]}`);
  }
});
