import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../src/cli-entry.mjs', import.meta.url));

function fixture(run) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'proto-lint-cli-'));
  try {
    return run(cwd, (args) =>
      spawnSync(process.execPath, [cli, 'lint', ...args], { cwd, encoding: 'utf8' })
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('CLI diagnoses bool violations using the imported helper type and performs no author execution', () =>
  fixture((cwd, run) => {
    writeFileSync(path.join(cwd, 'helper.ts'), 'export function value(): number { return 1; }\n');
    writeFileSync(
      path.join(cwd, 'sample.proto.ts'),
      `
    import { value as renamed } from './helper';
    if (renamed()) { const message = 'never run'; }
  `
    );
    const result = run(['sample.proto.ts', '--target', 'react', '--json']);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assert.equal(report.sourceValid, false);
    assert.equal(report.analysisComplete, false);
    assert.ok(report.diagnostics.some((item) => item.ruleId === 'proto/explicit-bool-condition'));
    assert.ok(report.sourceClosure.files.some((entry) => entry.path.endsWith('/helper.ts')));
    assert.equal(report.targets.react.compilable, false);
    assert.equal(existsSync(path.join(cwd, 'generated')), false);
  }));

test('a file with no known value errors remains incomplete, not a successful compile', () =>
  fixture((cwd, run) => {
    writeFileSync(
      path.join(cwd, 'valid.proto.ts'),
      'export function same(a: number, b: number): boolean { return a == b; }\n'
    );
    const result = run(['valid.proto.ts', '--target', 'gpui', '--json']);
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.sourceValid, null);
    assert.equal(report.analysisComplete, false);
    assert.deepEqual(Object.keys(report.targets).sort(), [
      'gpui',
      'react',
      'vue2',
      'vue3',
      'web-components',
    ]);
    assert.ok(Object.values(report.targets).every((target) => target.compilable === false));
  }));

test('configuration paths resolve real source closures without ambient Node or DOM admission', () =>
  fixture((cwd, run) => {
    writeFileSync(path.join(cwd, 'helper.ts'), 'export const count: number = 3;\n');
    writeFileSync(
      path.join(cwd, 'main.proto.ts'),
      "import { count } from '@fixture/helper'; if (count) {}\n"
    );
    writeFileSync(
      path.join(cwd, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@fixture/helper': ['./helper.ts'] },
          lib: ['es2024', 'dom'],
          types: ['node'],
        },
      })
    );
    const result = run(['main.proto.ts', '--project', 'tsconfig.json', '--json']);
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.ok(report.diagnostics.some((item) => item.ruleId === 'proto/explicit-bool-condition'));
    assert.ok(report.sourceClosure.files.some((entry) => entry.path.endsWith('/helper.ts')));
    assert.ok(
      !report.sourceClosure.files.some((entry) => /lib\.dom\.d\.ts|@types\/node/.test(entry.path))
    );
  }));

test('discovered and explicit project noCheck options cannot hide source type errors', () =>
  fixture((cwd, run) => {
    writeFileSync(path.join(cwd, 'main.proto.ts'), 'export const label: string = 1;\n');
    writeFileSync(
      path.join(cwd, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { noCheck: true } })
    );
    for (const projectArguments of [[], ['--project', 'tsconfig.json']]) {
      const result = run(['main.proto.ts', ...projectArguments, '--json']);
      assert.equal(result.status, 1, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.sourceValid, false);
      assert.equal(report.sourceClosure.compilerOptions.noCheck, false);
      assert.ok(
        report.diagnostics.some(
          (item) => item.code === 'PUI_TYPESCRIPT_2322' && item.category === 'source-invalid'
        )
      );
    }
  }));

test('nested project paths retain their defining config base instead of selecting a cwd shadow', () =>
  fixture((cwd, run) => {
    mkdirSync(path.join(cwd, 'project'));
    mkdirSync(path.join(cwd, 'config'));
    writeFileSync(path.join(cwd, 'helper.ts'), 'export const flag: number = 7;\n');
    writeFileSync(path.join(cwd, 'project/helper.ts'), 'export const flag: number = 8;\n');
    writeFileSync(path.join(cwd, 'config/helper.ts'), 'export const flag: boolean = true;\n');
    writeFileSync(
      path.join(cwd, 'config/base.json'),
      JSON.stringify({
        compilerOptions: {
          paths: { '@fixture/helper': ['./helper.ts'] },
        },
      })
    );
    writeFileSync(
      path.join(cwd, 'project/tsconfig.json'),
      JSON.stringify({ extends: '../config/base.json' })
    );
    writeFileSync(
      path.join(cwd, 'project/main.proto.ts'),
      "import { flag } from '@fixture/helper'; if (flag) {}\n"
    );
    const result = run(['project/main.proto.ts', '--project', 'project/tsconfig.json', '--json']);
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.sourceValid, null);
    assert.equal(report.sourceClosure.complete, true);
    assert.ok(!report.diagnostics.some((item) => item.category === 'source-invalid'));
    assert.equal(
      report.sourceClosure.resolutions.find((item) => item.specifier === '@fixture/helper')
        .resolvedPath,
      path.join(cwd, 'config/helper.ts')
    );
    assert.ok(
      !report.sourceClosure.files.some(
        (item) =>
          item.path === path.join(cwd, 'helper.ts') ||
          item.path === path.join(cwd, 'project/helper.ts')
      )
    );
  }));

test('invalid CLI target and missing entries fail as invocation errors without writing outputs', () =>
  fixture((_cwd, run) => {
    for (const args of [
      [],
      ['sample.proto.ts', '--target', 'unknown'],
      ['sample.proto.ts', '--out', 'generated'],
    ]) {
      const result = run(args);
      assert.equal(result.status, 64);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /Usage: proto-compiler lint/);
    }
  }));
