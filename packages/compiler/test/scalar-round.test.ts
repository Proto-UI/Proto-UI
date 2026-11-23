// @vitest-environment node
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitRustDataSource } from '../src/rust-data-source';

const source = `import{definePrototype}from'@proto.ui/core';
function rounded(value:number):number{return Math.round(value);}
export default definePrototype({name:'round-consumer',setup(def){def.expose.method('rounded',rounded);return r=>r.slot();}});`;
it.each([
  'gpui-source-v1',
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
])('lowers checked numeric rounding in %s', (profile) => {
  const result = compilePrototype(source, { profile });
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
});
it.each(['', 'true', '"1"', 'undefined', '{}', 'value,value'])(
  'rejects an invalid rounding operand/arity %s',
  (argument) => {
    expect(
      compilePrototype(source.replace('Math.round(value)', `Math.round(${argument})`), {
        profile: 'gpui-source-v1',
      }).ok
    ).toBe(false);
  }
);
it('does not treat a shadowed Math as the intrinsic', () => {
  const text = source.replace(
    'function rounded(value:number)',
    'function rounded(value:number,Math:{round:number})'
  );
  expect(parsePrototype(text).ok).toBe(false);
});
it('revalidates an independently supplied intrinsic operand', () => {
  const parsed = parsePrototype(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const ir = JSON.parse(JSON.stringify(parsed.value));
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'intrinsic' && node.name === 'math.round')
      node.arguments = [{ kind: 'literal', value: '1', type: 'string', span: node.span }];
    else for (const value of Object.values(node)) visit(value);
  };
  visit(ir);
  expect(validateIR(ir).ok).toBe(false);
});

const cargo = process.env.PROTO_UI_RUST_DATA_CARGO ?? process.env.CARGO ?? 'cargo';
const available = spawnSync(cargo, ['--version'], { encoding: 'utf8' }).status === 0;
it.skipIf(!available && process.env.PROTO_UI_REQUIRE_RUST_DATA_TESTS !== '1')(
  'executes generated Rust with JS ties, signed zero and precision edges',
  async () => {
    const parsed = parsePrototype(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const output = emitRustDataSource(parsed.value, {
      methods: ['rounded'],
      crateName: 'round-consumer',
    });
    if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
    const values = [
      -2.5,
      -1.5,
      -0.5,
      -0.49999999999999994,
      -Number.MIN_VALUE,
      -0,
      0,
      Number.MIN_VALUE,
      0.49999999999999994,
      0.5,
      1.5,
      2.5,
      4503599627370495.5,
      4503599627370496,
      Number.MAX_VALUE,
    ];
    const bits = (value: number) => {
      const b = Buffer.alloc(8);
      b.writeDoubleLE(value);
      return b.readBigUInt64LE().toString();
    };
    const tests = values
      .map(
        (value) =>
          `assert_eq!(rounded(f64::from_bits(${bits(value)})).unwrap().to_bits(),${bits(Math.round(value))});`
      )
      .join('\n');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'pui-round-'));
    try {
      await writeFile(
        path.join(dir, 'lib.rs'),
        output.value.code + `\n#[test]fn js_round_boundaries(){${tests}}`
      );
      for (const file of output.value.supportingFiles)
        await writeFile(path.join(dir, file.path), file.contents);
      const run = spawnSync(cargo, ['test', '--offline'], {
        cwd: dir,
        encoding: 'utf8',
        timeout: 60000,
      });
      expect(run.error, run.stderr).toBeUndefined();
      expect(run.status, run.stdout + run.stderr).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  60000
);
