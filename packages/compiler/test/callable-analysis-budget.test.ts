// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const worker = fileURLToPath(
  new URL('./fixtures/callable-analysis-budget/compile-entries.mjs', import.meta.url)
);

describe('finite callable analysis resources', () => {
  it('reports changing recursive stores at their source instead of overflowing the stack', () => {
    const result = compilePrototype(
      `import {definePrototype} from '@proto.ui/core';
      export default definePrototype({name:'recursive-record-owner',setup(def){
        def.expose.event('report',{payload:'json'});
        def.event.on('press.commit',run=>{
          const make=(value:number):{value:number}=>({value});
          let current:{value:number}|null=null;
          const walk=(depth:number):void=>{
            current=make(depth);
            if(depth>0)walk(depth-1);
          };
          walk(2);
          if(current)run.expose.emit('report',current);
        });
        return r=>r.slot();
      }});`,
      { fileName: 'retained-record.proto.ts', profile: 'react-dom-source-v1' }
    );
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI1007',
          category: 'unsupported-input',
          message: expect.stringContaining('analysis call-depth boundary'),
          span: { file: 'retained-record.proto.ts', line: 5 },
        },
      ],
    });
    if (result.ok) throw new Error('expected an explicit incomplete-proof diagnostic');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].span.start).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics[0].span.end).toBeGreaterThan(result.diagnostics[0].span.start);
  });

  it('bounds the original Drawer store growth and keeps admitted controls compiling afterward', () => {
    const requests = [
      {
        entry: 'packages/prototypes/base/src/drawer/content.proto.ts',
        profile: 'gpui-source-v1',
      },
      {
        entry: 'packages/prototypes/base/src/transition/transition.proto.ts',
        profile: 'react-dom-source-v1',
      },
      {
        entry: 'packages/prototypes/base/src/button/button.proto.ts',
        profile: 'react-dom-source-v1',
      },
    ];
    // An in-process test timeout cannot interrupt synchronous compiler work.
    // This process bound fails the regression without hanging the test runner;
    // it does not change the inventory worker's existing 180-second deadline.
    const child = spawnSync(process.execPath, ['--import', 'tsx', worker], {
      cwd: root,
      input: JSON.stringify(requests),
      encoding: 'utf8',
      timeout: 45_000,
      maxBuffer: 1024 * 1024,
    });
    const receipt = JSON.stringify({
      status: child.status,
      signal: child.signal,
      error: child.error?.message,
      stdout: child.stdout,
      stderr: child.stderr,
    });
    expect(child.error, receipt).toBeUndefined();
    expect(child.signal, receipt).toBeNull();
    expect(child.status, receipt).toBe(0);
    const rows = child.stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(
      rows.map(({ entry, profile }) => ({ entry, profile })),
      receipt
    ).toEqual(requests);
    expect(rows[0].result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI1007',
          category: 'unsupported-input',
          message: expect.stringContaining('finite analysis call-depth boundary'),
          span: { file: 'packages/prototypes/base/src/transition/as-transition.proto.ts' },
        },
      ],
    });
    expect(rows[0].result.diagnostics).toHaveLength(1);
    expect(rows[0].result.diagnostics[0].span.start).toBeGreaterThanOrEqual(0);
    expect(rows[0].result.diagnostics[0].span.line).toBeGreaterThan(0);
    expect(rows.slice(1).map(({ result }) => result)).toEqual([{ ok: true }, { ok: true }]);
  });
});
