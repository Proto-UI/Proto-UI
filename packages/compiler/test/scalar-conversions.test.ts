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
function numberValue(value:string):number{return Number(value);}
function numberText(value:number):string{return String(value);}
function floorValue(value:number):number{return Math.floor(value);}
function textLength(value:string):number{return value.length;}
function emptyNumber():number{return Number();}
function emptyString():string{return String();}
export default definePrototype({name:'scalar-conversion-consumer',setup(def){
 def.expose.method('numberValue',numberValue);def.expose.method('numberText',numberText);
 def.expose.method('floorValue',floorValue);def.expose.method('textLength',textLength);
 def.expose.method('emptyNumber',emptyNumber);def.expose.method('emptyString',emptyString);
 return r=>r.slot();}});`;

it.each([
  'gpui-source-v1',
  'react-dom-source-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
])('compiles ordinary scalar conversion, floor and UTF-16 length in %s', (profile) => {
  const result = compilePrototype(source, { profile });
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
});
it.each(['{}', '[]', '()=>1', 'value,value'])(
  'rejects non-scalar Number conversion or wrong arity: %s',
  (operand) => {
    expect(
      compilePrototype(source.replace('Number(value)', `Number(${operand})`), {
        profile: 'gpui-source-v1',
      }).ok
    ).toBe(false);
  }
);
it('does not admit opaque unknown numeric coercion', () => {
  expect(
    parsePrototype(source.replace('numberValue(value:string)', 'numberValue(value:unknown)')).ok
  ).toBe(false);
});
it('does not reinterpret a shadowed Number as a global conversion', () => {
  expect(
    parsePrototype(
      source.replace('numberValue(value:string)', 'numberValue(value:string,Number:{value:number})')
    ).ok
  ).toBe(false);
});
it('independently rejects a forged structured numeric conversion', () => {
  const result = parsePrototype(source);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const ir = JSON.parse(JSON.stringify(result.value));
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'intrinsic' && node.name === 'number' && node.arguments.length)
      node.arguments = [
        { kind: 'record', entries: [], type: { kind: 'record', fields: [] }, span: node.span },
      ];
    else Object.values(node).forEach(visit);
  };
  visit(ir);
  expect(validateIR(ir).ok).toBe(false);
});

const cargo = process.env.PROTO_UI_RUST_DATA_CARGO ?? process.env.CARGO ?? 'cargo';
const available = spawnSync(cargo, ['--version'], { encoding: 'utf8' }).status === 0;
it.skipIf(!available && process.env.PROTO_UI_REQUIRE_RUST_DATA_TESTS !== '1')(
  'executes emitted Rust conversions, floor and UTF-16 length against ECMAScript',
  async () => {
    const parsed = parsePrototype(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const output = emitRustDataSource(parsed.value, {
      methods: [
        'numberValue',
        'numberText',
        'floorValue',
        'textLength',
        'emptyNumber',
        'emptyString',
      ],
      crateName: 'scalar-conversions',
    });
    if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
    const bits = (value: number) => {
      const buffer = Buffer.alloc(8);
      buffer.writeDoubleLE(value);
      return buffer.readBigUInt64LE().toString();
    };
    const rustString = (value: string) =>
      `String::from_utf8(vec![${[...Buffer.from(value)].join(',')}]).unwrap()`;
    const checks: string[] = [];
    for (const text of [
      '',
      '  ',
      '\u00a0\ufeff42\n',
      '-0',
      '+2.5',
      '0x10',
      '0o17',
      '0b101',
      '1e-3',
      'Infinity',
      'NaN',
      '0x',
      '+0x1',
      '12x',
    ]) {
      const expected = Number(text),
        call = `number_value(${rustString(text)})`;
      checks.push(
        Number.isFinite(expected)
          ? `assert_eq!(${call}.unwrap().to_bits(),${bits(expected)});`
          : `assert!(${call}.is_err());`
      );
    }
    for (const value of [
      -1.5,
      -0.5,
      -Number.MIN_VALUE,
      -0,
      0,
      0.9999999999999999,
      1.5,
      4503599627370496,
    ]) {
      checks.push(
        `assert_eq!(floor_value(f64::from_bits(${bits(value)})).unwrap().to_bits(),${bits(Math.floor(value))});`
      );
      checks.push(
        `assert_eq!(number_text(f64::from_bits(${bits(value)})).unwrap(),${rustString(String(value))});`
      );
    }
    for (const text of ['', '歌', 'a😀b', '候选\r\n😀', 'e\u0301'])
      checks.push(`assert_eq!(text_length(${rustString(text)}).unwrap(),${text.length}.0);`);
    checks.push('assert_eq!(empty_number().unwrap(),0.0);assert_eq!(empty_string().unwrap(),"");');
    const directory = await mkdtemp(path.join(os.tmpdir(), 'pui-conversions-'));
    try {
      await writeFile(
        path.join(directory, 'lib.rs'),
        output.value.code + `\n#[test]fn ecmascript_edges(){${checks.join('\n')}}`
      );
      for (const file of output.value.supportingFiles)
        await writeFile(path.join(directory, file.path), file.contents);
      const run = (args: string[]) => {
        const result = spawnSync(cargo, args, { cwd: directory, encoding: 'utf8', timeout: 60000 });
        expect(result.error, `${args.join(' ')}: ${result.stderr}`).toBeUndefined();
        expect(result.status, `${args.join(' ')}:\n${result.stdout}\n${result.stderr}`).toBe(0);
      };
      // Numeric-to-text support has a declared serde_json dependency. Resolve a
      // lockfile before testing, allowing an ordinary cold Cargo cache to fetch
      // it. Explicit CARGO_NET_OFFLINE still works for prepared offline runners.
      run(['generate-lockfile']);
      run(['test', '--locked']);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  60000
);
