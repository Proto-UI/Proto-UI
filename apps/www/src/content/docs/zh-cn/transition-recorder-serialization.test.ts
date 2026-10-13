// @vitest-environment node
// Recorder-only regression. No recorder entrypoint, server, browser or product imports.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../../../../../', import.meta.url));
const source = await readFile(
  new URL('../../../../scripts/capture-transition-frames.ts', import.meta.url),
  'utf8'
);
const parsed = ts.createSourceFile(
  'capture-transition-frames.ts',
  source,
  ts.ScriptTarget.Latest,
  true
);
const callbacks: string[] = [];
const cadenceInitializers = new Map<string, string>();
function visit(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    ['timestampsValid', 'gaps'].includes(node.name.text)
  ) {
    assert.ok(node.initializer);
    assert.ok(!cadenceInitializers.has(node.name.text), 'Cadence initializer must be unique');
    cadenceInitializers.set(node.name.text, node.initializer.getText(parsed));
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'evaluate'
  ) {
    const callback = node.arguments[0];
    assert.ok(
      ts.isArrowFunction(callback) || ts.isFunctionExpression(callback),
      'Every evaluate must use a directly inspectable callback'
    );
    callbacks.push(callback.getText(parsed));
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(callbacks.length, 5, 'Review every page/locator evaluate when the inventory changes');
assert.equal(cadenceInitializers.size, 2);
const cadence = `(frames: { timestamp?: number }[]) => ({
  timestampsValid: ${cadenceInitializers.get('timestampsValid')},
  gaps: ${cadenceInitializers.get('gaps')}
})`;

// Run the installed, locked tsx loader used by the actual workflow. Only these
// extracted self-owned callbacks/calculations are imported; the recorder is never run.
const temporary = await mkdtemp(path.join(tmpdir(), 'pui-recorder-serialize-'));
let serialized: string[];
try {
  const fixture = path.join(temporary, 'callbacks.ts');
  await writeFile(
    fixture,
    `const callbacks = [${[...callbacks, cadence].join(',\n')}];\nprocess.stdout.write(JSON.stringify(callbacks.map((callback) => callback.toString())));\n`
  );
  serialized = JSON.parse(
    execFileSync(
      process.execPath,
      ['--import', createRequire(import.meta.url).resolve('tsx'), fixture],
      {
        cwd: root,
        env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, 'tsconfig.json') },
        encoding: 'utf8',
        timeout: 15000,
      }
    )
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function browserModel() {
  const queued: (() => void)[] = [];
  const rect = { x: 20, y: 30, width: 80, height: 40 };
  const node = {
    localName: 'shadcn-drawer-content',
    textContent: 'Drawer',
    getAttribute: (name: string) =>
      (
        ({
          role: 'dialog',
          'aria-expanded': 'false',
          'aria-checked': 'false',
          'aria-controls': 'panel',
        }) as Record<string, string>
      )[name] ?? null,
    getBoundingClientRect: () => rect,
    querySelectorAll: () => [],
  };
  const style = {
    fontSize: '16px',
    colorScheme: 'light',
    opacity: '0.5',
    transform: 'none',
    translate: '0px 20px',
    scale: 'none',
    backgroundColor: 'white',
    transition: 'none',
    animation: 'none',
  };
  const context = vm.createContext({
    window: {},
    document: {
      fonts: { ready: Promise.resolve('fonts-ready') },
      documentElement: { className: 'light' },
      activeElement: node,
      querySelectorAll: () => [node],
    },
    performance: { now: () => 42 },
    Date: { now: () => 1000 },
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => style,
    innerWidth: 900,
    innerHeight: 700,
    devicePixelRatio: 1,
    requestAnimationFrame: (callback: () => void) => queued.push(callback),
  });
  const invoke = (index: number, argument?: unknown) =>
    vm.runInContext(`(${serialized[index]})`, context)(argument);
  const frame = () => {
    const callback = queued.shift();
    assert.ok(callback, 'Expected one scheduled observation');
    callback();
  };
  return { context, node, queued, invoke, frame };
}

// Node tsx can inject __name into a nested named arrow. Playwright serializes
// only the outer function, so module helpers do not cross into its page realm.
test('all actual tsx-serialized evaluate callbacks execute in a helper-free realm', async () => {
  const model = browserModel();
  assert.equal(vm.runInContext('typeof __name', model.context), 'undefined');
  assert.equal(await model.invoke(0), 'fonts-ready');
  assert.equal(model.invoke(1).rootFont, '16px');
  model.invoke(2);
  model.frame();
  assert.equal(model.invoke(3).length, 1);
  assert.equal(model.invoke(4, model.node).expanded, 'false');
});

test('serialized observation loop preserves samples, recurrence and stop cleanup', () => {
  const model = browserModel();
  model.invoke(2);
  assert.equal(model.queued.length, 1);
  model.frame();
  model.frame();
  const capture = model.context.window.__transitionCapture;
  assert.equal(capture.observations.length, 2);
  const sample = capture.observations[0];
  assert.equal(sample.now, 42);
  assert.equal(sample.wallTime, 1000);
  assert.equal(sample.subjects[0].y, 30);
  assert.equal(sample.subjects[0].translate, '0px 20px');
  assert.equal(model.queued.length, 1);
  assert.equal(model.invoke(3).length, 2);
  assert.equal(capture.stopped, true);
  model.frame();
  assert.equal(capture.observations.length, 2);
  assert.equal(model.queued.length, 0);
});

test('serialized observation loop retains its 1200-sample bound', () => {
  const model = browserModel();
  model.invoke(2);
  model.context.window.__transitionCapture.observations.length = 1200;
  model.frame();
  assert.equal(model.context.window.__transitionCapture.observations.length, 1200);
  assert.equal(model.queued.length, 0);
});

test('actual cadence checks reject missing and invalid native timestamps without inventing them', () => {
  const check = vm.runInNewContext(`(${serialized[5]})`);
  const valid = check([{ timestamp: 1 }, { timestamp: 1.125 }]);
  assert.equal(valid.timestampsValid, true);
  assert.equal(valid.gaps[0], 125);
  for (const frames of [
    [{}],
    [{ timestamp: NaN }],
    [{ timestamp: Infinity }],
    [{ timestamp: 1 }, {}],
    [{}, { timestamp: 1 }],
    [{ timestamp: 1 }, { timestamp: 1 }],
    [{ timestamp: 2 }, { timestamp: 1 }],
  ]) {
    const before = JSON.stringify(frames);
    assert.equal(check(frames).timestampsValid, false);
    assert.equal(JSON.stringify(frames), before, 'Native frame metadata must remain untouched');
  }
  assert.ok(Number.isNaN(check([{ timestamp: 1 }, {}]).gaps[0]));
});
