import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deepStrictEqual, ok } from 'node:assert/strict';
import { build } from 'esbuild';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const outputDir = mkdtempSync(join(tmpdir(), 'proto-ui-adapter-refactor-'));
const baseline = '078c6e91c6ffdc1a4e1508978f63f31289da2cf8';
const paths = [
  'packages/modules/props/src/kernel/kernel.ts',
  'packages/modules/anatomy/src/impl.ts',
];
const before = new Map(
  paths.map((p) => [
    `${root}/${p}`,
    execFileSync('git', ['show', `${baseline}:${p}`], { cwd: root, encoding: 'utf8' }),
  ])
);
const mods = {};
for (const version of ['before', 'after']) {
  const outfile = join(outputDir, `review-${version}.mjs`);
  await build({
    absWorkingDir: root,
    stdin: {
      contents: `export { PropsKernel } from './packages/modules/props/src/kernel/kernel'; export { AnatomyModuleImpl } from './packages/modules/anatomy/src/impl'; export { createAnatomyFamily } from './packages/core/src/anatomy'; export { makeCaps, createSysCaps } from './packages/modules/anatomy/test/utils/fake-caps';`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: ['node24'],
    outfile,
    logLevel: 'silent',
    plugins:
      version === 'before'
        ? [
            {
              name: 'exact-baseline',
              setup(b) {
                b.onLoad({ filter: /packages\/modules\/(props|anatomy)\/src\/.*\.ts$/ }, (args) =>
                  before.has(args.path)
                    ? { contents: before.get(args.path), loader: 'ts' }
                    : undefined
                );
              },
            },
          ]
        : [],
  });
  mods[version] = await import(pathToFileURL(outfile));
}
let propsCases = 0,
  propsOperations = 0;
for (const empty of ['accept', 'fallback', 'error'])
  for (const defaultValue of [undefined, null, 2, 3, 7])
    for (const defaults of [[], [4], [4, 3], [4, null], [7, 3]]) {
      const logs = [];
      for (const version of ['before', 'after']) {
        const trace = [],
          k = new mods[version].PropsKernel(),
          events = [];
        const validator = (key) => (v) => {
          trace.push([key, v]);
          if (v === 7) throw new Error('validator throw');
          return v !== 3;
        };
        const spec = {
          x: { type: 'number', empty, range: { min: 0, max: 8 }, validator: validator('x') },
          y: { type: 'number', empty: 'fallback', default: 2, validator: validator('y') },
        };
        if (defaultValue !== undefined) spec.x.default = defaultValue;
        const run = (label, fn) => {
          try {
            events.push({
              label,
              result: fn(),
              snapshot: k.get(),
              raw: k.getRaw(),
              diags: k.getDiagnostics(),
              calls: trace.slice(),
            });
          } catch (e) {
            events.push({
              label,
              error: { name: e.name, message: e.message },
              snapshot: k.get(),
              raw: k.getRaw(),
              diags: k.getDiagnostics(),
              calls: trace.slice(),
            });
          }
        };
        run('define', () => k.define(spec));
        for (const value of defaults)
          run(`defaults ${value}`, () => k.setDefaults({ x: value, y: 4 }));
        for (const raw of [
          { x: 5, y: 6 },
          {},
          { x: undefined },
          { x: null },
          { x: 3, y: 3 },
          { x: 7, y: 7 },
          { x: 'bad', y: 'bad' },
          { x: 9 },
          { x: 8, y: 2 },
          {},
        ])
          run('raw', () => k.applyRaw(raw));
        logs.push(events);
      }
      deepStrictEqual(
        logs[1],
        logs[0],
        `Props difference: ${JSON.stringify({ empty, defaultValue, defaults })}`
      );
      propsCases++;
      propsOperations += logs[0].length;
    }
function anatomyScenario(api, profile, roleCount, withHooks) {
  const { createAnatomyFamily, AnatomyModuleImpl, makeCaps, createSysCaps } = api;
  const family = createAnatomyFamily('independent-review', {
    roles: {
      root: { cardinality: { min: 1, max: 1 }, requires: [{ kind: 'hook', name: 'baseRoot' }] },
      group: { cardinality: { min: 1, max: 2 } },
      item: { cardinality: { min: 0, max: 2 }, requires: [{ kind: 'hook', name: 'baseItem' }] },
    },
    relations: [{ kind: 'contains', parent: 'group', child: 'item' }],
    profiles: {
      selected: {
        roles: {
          group: { cardinality: { min: 2, max: 2 } },
          item: {
            cardinality: { min: 1, max: 1 },
            requires: [{ kind: 'hook', name: 'profileItem' }],
          },
        },
        relations: [{ kind: 'contains', parent: 'root', child: 'item' }],
      },
    },
  });
  const instances = [{ id: 0 }, ...Array.from({ length: roleCount }, (_, i) => ({ id: i + 1 }))];
  const parents = new Map(instances.map((instance, i) => [instance, i ? instances[0] : null]));
  const readTrace = [];
  const getParent = (instance) => {
    readTrace.push(['parent', instance.id]);
    return parents.get(instance) ?? null;
  };
  const protos = instances.map((instance, i) => {
    const proto = { name: `p-${i}`, setup() {} };
    Object.defineProperty(proto, '__asHooks', {
      get() {
        readTrace.push(['hooks', i]);
        return withHooks ? [{ name: i ? 'baseItem' : 'baseRoot' }] : [];
      },
    });
    return proto;
  });
  const systems = instances.map(() => createSysCaps());
  const impls = instances.map(
    (instance, i) =>
      new AnatomyModuleImpl(
        makeCaps({ sys: systems[i], instance, getParent, getPrototype: () => protos[i] }),
        `p-${i}`,
        { get() {}, getAll: () => ({}), has: () => false, keys: () => [] }
      )
  );
  impls[0].claim(family, { role: 'root', ...(profile ? { profile: 'selected' } : {}) });
  for (let i = 1; i < impls.length; i++) impls[i].claim(family, { role: 'item' });
  readTrace.length = 0;
  const diagnostics = impls[0].port.getDiagnostics().map((d) => ({
    keys: Object.keys(d),
    ...d,
    family: d.family.debugName,
    ownsProfile: Object.hasOwn(d, 'profile'),
  }));
  const diagnosticReads = readTrace.slice();
  const results = [];
  const capture = (phase, name, fn) => {
    readTrace.length = 0;
    try {
      const value = fn();
      results.push({
        phase,
        name,
        result: Array.isArray(value)
          ? value.map((x) => x.role)
          : value && typeof value === 'object'
            ? value.role
            : value,
        reads: readTrace.slice(),
      });
    } catch (e) {
      results.push({
        phase,
        name,
        error: { name: e.name, message: e.message },
        reads: readTrace.slice(),
      });
    }
  };
  for (const phase of ['setup', 'render', 'callback']) {
    for (const sys of systems) sys.__setExecPhase(phase);
    for (const [owner, impl] of impls.entries())
      for (const [name, args] of [
        ['tryVersion', [family]],
        ['tryParts', [family]],
        ['tryPartsOf', [family, 'item']],
        ['tryIndexOfSelf', [family, 'item']],
        ['tryPrevOfSelf', [family, 'item']],
        ['tryNextOfSelf', [family, 'item']],
      ])
        capture(phase, `${owner}:${name}`, () => impl.port.order[name](...args));
    capture(phase, 'public parts', () => impls[0].orderedParts(family));
  }
  for (const impl of impls) impl.dispose();
  return { diagnostics, diagnosticReads, results };
}
let anatomyCases = 0,
  anatomyOperations = 0,
  diagnosticRows = 0;
for (const profile of [false, true])
  for (const count of [0, 1, 3])
    for (const hooks of [false, true]) {
      const old = anatomyScenario(mods.before, profile, count, hooks),
        current = anatomyScenario(mods.after, profile, count, hooks);
      deepStrictEqual(
        current,
        old,
        `Anatomy difference: ${JSON.stringify({ profile, count, hooks })}`
      );
      ok(current.diagnostics.every((d) => d.ownsProfile === (d.scope === 'profile')));
      anatomyCases++;
      anatomyOperations += current.results.length;
      diagnosticRows += current.diagnostics.length;
    }
const evidence = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  baseline,
  reviewedFiles: paths.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(`${root}/${path}`))
      .digest('hex'),
  })),
  props: {
    cases: propsCases,
    operations: propsOperations,
    pass: true,
    checks: [
      'declared-key order',
      'fallback candidate order',
      'validator call order and count including throwing/rejecting validators',
      'missing versus provided-empty versus invalid',
      'error names and messages',
      'resolved/raw snapshots',
      'change reports and metadata',
      'empty accept/fallback/error',
      'layered defaults and prevValid',
    ],
  },
  anatomy: {
    cases: anatomyCases,
    operations: anatomyOperations,
    diagnosticRows,
    pass: true,
    checks: [
      'complete diagnostic order/code/message/level/scope',
      'family profile-property absence',
      'inherited requirements not duplicated',
      'hook/parent getter invocation trace',
      'ordered try port calls in setup/render/callback',
      'author query phase guards unchanged',
      'null/zero/absent-self boundaries',
    ],
  },
  limitations: [
    'Same-toolchain diagnostic comparison, not canonical repository CI.',
    'Anatomy tests use logical fake host caps, not browser DOM layout.',
    'No full-suite test run, browser layout validation or formal approval is established by this comparison.',
    'The comparison does not modify the source files under review.',
  ],
};
if (process.argv[2])
  writeFileSync(resolve(process.argv[2]), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
