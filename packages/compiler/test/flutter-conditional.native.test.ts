// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitFlutterSource } from '../src/flutter-source';
import { parsePrototype } from '../src/parser';

// Opt-in native evidence for the dormant direct emitter, not a Flutter Widget
// consumer or activation of flutter-source-v1. The caller supplies a Dart SDK.
const dart = process.env.PROTO_UI_DART;
const evidence = process.env.PROTO_UI_DART_EVIDENCE_DIR;
const name = (value: string) => `v_${Buffer.from(value).toString('hex')}`;

function runConditionals(
  label: string,
  body: string,
  expected: Record<string, string | number | boolean>,
  fixture: { parameters?: string; prelude?: string; before?: string; after?: string } = {}
) {
  const source = `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'conditional-native',setup(${fixture.parameters ?? ''}){${body}}});`;
  const parsed = parsePrototype(source, { fileName: `${label}.proto.ts` });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const generated = emitFlutterSource(parsed.value);
  if (!generated.ok) throw new Error(JSON.stringify(generated.diagnostics));
  const { code, supportingFiles } = generated.value;
  const host = supportingFiles?.find((file) => file.path === '.proto_ui/flutter_native.dart');
  if (!host) throw new Error('Missing emitted native support');

  // Copy the actual emitted setup statements and scalar support unchanged.
  // No widget, owner, view or platform input participates in these fixtures.
  // Fail if the generated boundaries change instead of silently testing a
  // handwritten equivalent of the conditional under review.
  const closure = code.indexOf('      ((');
  const start = code.indexOf(') {\n', closure);
  const end = code.indexOf('      })(', start);
  const scalarStart = host.contents.indexOf('class NativeVoid {');
  const scalarEnd = host.contents.indexOf('class NativeStateChange<T> {', scalarStart);
  const preludeEnd = code.indexOf('class GeneratedProps {');
  if (
    closure < 0 ||
    start < closure ||
    end < start ||
    scalarStart < 0 ||
    scalarEnd < scalarStart ||
    preludeEnd < 0
  )
    throw new Error('Unexpected emitted setup/scalar boundaries');
  const setup = code.slice(start + ') {\n'.length, end);
  const prelude = code
    .slice(0, preludeEnd)
    .split('\n')
    .filter((line) => !/^(?:import|export) /.test(line))
    .join('\n');
  const observe = Object.keys(expected)
    .map((key) => `${JSON.stringify(key)}: ${name(key)}`)
    .join(', ');
  const program = `import 'dart:convert';\n${host.contents.slice(scalarStart, scalarEnd)}\n${prelude}\n${fixture.prelude ?? ''}\nvoid main() {\n${fixture.before ?? ''}\n${setup}\n${fixture.after ?? ''}\nprint(jsonEncode({${observe}}));\n}\n`;
  const directory = evidence
    ? path.join(evidence, label)
    : mkdtempSync(path.join(tmpdir(), 'proto-flutter-conditional-'));
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'conditional.dart');
  writeFileSync(file, program);
  if (evidence) {
    writeFileSync(path.join(directory, 'input.proto.ts'), source);
    writeFileSync(path.join(directory, 'generated.dart'), code);
    writeFileSync(path.join(directory, 'flutter_native.dart'), host.contents);
    writeFileSync(path.join(directory, 'ir.json'), JSON.stringify(parsed.value, null, 2));
  }
  try {
    const result = spawnSync(dart!, ['run', file], {
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, DART_SUPPRESS_ANALYTICS: 'true' },
    });
    if (evidence)
      writeFileSync(
        path.join(directory, 'execution.json'),
        JSON.stringify(
          {
            command: [dart, 'run', file],
            status: result.status,
            signal: result.signal,
            error: result.error?.message,
            stdout: result.stdout,
            stderr: result.stderr,
            expected,
          },
          null,
          2
        )
      );
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual(expected);
    expect(readFileSync(file, 'utf8')).toBe(program);
  } finally {
    if (!evidence) rmSync(directory, { recursive: true, force: true });
  }
}

describe.skipIf(!dart)('Dart execution of emitted conditional statements', () => {
  it('retains Boolean conditions as the native control', () => {
    runConditionals(
      'boolean-control',
      `const yes = true ? 'yes' : 'no'; const no = false ? 'yes' : 'no';`,
      { yes: 'yes', no: 'no' }
    );
  });

  it('uses portable truthiness for admitted non-Boolean values', () => {
    runConditionals(
      'non-boolean',
      `const zero = 0 ? 'yes' : 'no';
       const negativeZero = -0 ? 'yes' : 'no';
       const positive = 2 ? 'yes' : 'no';
       const negative = -2 ? 'yes' : 'no';
       const nan = (0 / 0) ? 'yes' : 'no';
       const empty = '' ? 'yes' : 'no';
       const text = '0' ? 'yes' : 'no';
       const absent = undefined ? 'yes' : 'no';
       const nil = null ? 'yes' : 'no';
       const array = [1] ? 'yes' : 'no';
       const flags = [false];
       const presentFalse = flags[0] ? 'yes' : 'no';
       const missing = flags[2] ? 'yes' : 'no';`,
      {
        zero: 'no',
        negativeZero: 'no',
        positive: 'yes',
        negative: 'yes',
        nan: 'no',
        empty: 'no',
        text: 'yes',
        absent: 'no',
        nil: 'no',
        array: 'yes',
        presentFalse: 'no',
        missing: 'no',
      }
    );
  });

  it('evaluates conditions once, preserves lazy branches and consumes void effects', () => {
    runConditionals(
      'evaluation-order',
      `let trace = '';
       const condition = () => { trace = trace + 'c'; return 1; };
       const selected = () => { trace = trace + 't'; return 'yes'; };
       const unselected = () => { throw 'unselected branch'; };
       const ordered = condition() ? selected() : unselected();
       const lazyFalse = 0 ? unselected() : 'no';
       let calls = 0;
       const effect = () => { calls = calls + 1; };
       const voidValue = effect() ? unselected() : 'no';
       const negatedVoid = !effect();
       let entered = false;
       if (effect()) { entered = true; }`,
      {
        trace: 'ct',
        ordered: 'yes',
        lazyFalse: 'no',
        calls: 3,
        voidValue: 'no',
        negatedVoid: true,
        entered: false,
      }
    );
  });

  it('consumes actual Dart void-returning operations in ternary, not and if conditions', () => {
    runConditionals(
      'void-operations',
      `const ternary = def.expose.value('first', true) ? 'wrong' : 'no';
       const negated = !def.expose.value('second', true);
       let entered = false;
       if (def.expose.value('third', true)) { entered = true; }`,
      { ternary: 'no', negated: true, entered: false, writes: 3 },
      {
        parameters: 'def',
        // Typed port doubles only count the emitted effects. The generated
        // calls and all conditional expressions remain unchanged; this does
        // not claim NativeOwner lifecycle or Flutter Widget acceptance.
        prelude: `class Effects {
          int writes = 0;
          void bind${name('first')}(bool value) { writes++; }
          void bind${name('second')}(bool value) { writes++; }
          void bind${name('third')}(bool value) { writes++; }
        }`,
        before: 'final _owner = Effects();',
        after: `final ${name('writes')} = _owner.writes;`,
      }
    );
  });
});
