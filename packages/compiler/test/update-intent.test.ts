// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileFile } from '../src/compile';
import { compilePrototype } from '../src/memory';

const fixture = fileURLToPath(
  new URL('./fixtures/differential-browser/update-intent.proto.ts', import.meta.url)
);
const root = fileURLToPath(new URL('../../../', import.meta.url));

describe('explicit update intent admission', () => {
  it('compiles a state write followed by a separate callback-time update request', async () => {
    const result = await compileFile(fixture, { root });
    expect(result.ok, result.ok ? undefined : JSON.stringify(result.diagnostics)).toBe(true);
  });

  it('rejects render-time and malformed update requests before output', () => {
    for (const setup of [
      'def.lifecycle.onCreated((run) => { run.update(true); });',
      'return (renderer) => { renderer.update(); return renderer.el("p", "x"); };',
    ]) {
      const result = compilePrototype(`import {definePrototype} from '@proto.ui/core';
        export default definePrototype({name:'invalid-update',setup(def){${setup}}});`);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Invalid update request was emitted');
      expect(result.diagnostics[0].category).toBe('unsupported-input');
    }
  });
});
