// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import type { GeneratedModule } from '../src/ir';

// The emitted GPUI owner is ordinary Rust source compiled by the native consumer
// gate. Two module-level items that bind the same name are cargo error E0428,
// so the composed SDK must declare every module-level item name exactly once.
const RUST_ITEM =
  /^(?:pub(?:\s*\([^)]*\))?\s+)?(?:const\s+|static\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?(fn|struct|enum|trait|type|union|mod|const|static)\s+([A-Za-z_][A-Za-z0-9_]*)/;

/**
 * Blank comments and literals so brace depth measures Rust code only. Raw
 * strings carry braces of their own and a lifetime is not a character literal.
 */
function blankNonCode(source: string): string {
  const out = source.split('');
  const blank = (from: number, to: number) => {
    for (let at = from; at < to; at += 1) if (out[at] !== '\n') out[at] = ' ';
  };
  const skipQuoted = (from: number, quote: string) => {
    let at = from + 1;
    while (at < source.length) {
      if (source[at] === '\\') {
        at += 2;
        continue;
      }
      if (source.startsWith(quote, at)) {
        at += 1;
        break;
      }
      at += 1;
    }
    blank(from, at);
    return at;
  };
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? source.length : end;
      blank(index, stop);
      index = stop;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(index, stop);
      index = stop;
      continue;
    }
    const raw = /^(?:b?r)(#*)"/.exec(source.slice(index));
    if (raw) {
      const terminator = `"${raw[1]}`;
      const end = source.indexOf(terminator, index + raw[0].length);
      const stop = end === -1 ? source.length : end + terminator.length;
      blank(index, stop);
      index = stop;
      continue;
    }
    if (character === '"' || (character === 'b' && source[index + 1] === '"')) {
      index = skipQuoted(character === '"' ? index : index + 1, '"');
      continue;
    }
    if (character === "'") {
      const escaped = source[index + 1] === '\\';
      const closed = source[index + 2] === "'";
      if (escaped || closed) {
        index = skipQuoted(index, "'");
        continue;
      }
      out[index] = ' ';
      index += 1;
      continue;
    }
    index += 1;
  }
  return out.join('');
}

/** Every module-level item declaration of an ordinary Rust source file. */
function moduleLevelItems(source: string): { kind: string; name: string; line: number }[] {
  const code = blankNonCode(source);
  const items: { kind: string; name: string; line: number }[] = [];
  let depth = 0;
  let line = 0;
  for (const text of code.split('\n')) {
    line += 1;
    if (depth === 0) {
      const match = RUST_ITEM.exec(text.trimStart());
      if (match) items.push({ kind: match[1], name: match[2], line });
    }
    for (const character of text) {
      if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
    }
  }
  return items;
}

function ownerSource(module: GeneratedModule): string {
  const source = module.supportingFiles?.find(
    (file) => file.path === '.proto-ui/gpui-native/src/gpui-native-owner.rs'
  );
  expect(source, 'Actual emitted SDK owner file').toBeDefined();
  if (!source) throw new Error('Missing emitted SDK owner');
  return source.contents;
}

const subject = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'native-owner-items',setup(def){
  def.expose.value('name','native-owner-items');
  return r=>r.el('div');
}});`;

describe('generated GPUI native owner source', () => {
  it('declares every module-level Rust item name exactly once', () => {
    const output = compilePrototype(subject, { profile: 'gpui-source-v1' });
    expect(output.ok, JSON.stringify(output.ok ? {} : output.diagnostics)).toBe(true);
    if (!output.ok) return;
    const owner = ownerSource(output.value.output);
    const items = moduleLevelItems(owner);
    // A scan that observed nothing would make the duplicate check vacuous.
    expect(items.length).toBeGreaterThan(100);
    expect(items.map((item) => item.name)).toContain('ControlLabelRef');
    const names = items.map((item) => item.name);
    const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
    expect(duplicates).toEqual([]);
  });
});
