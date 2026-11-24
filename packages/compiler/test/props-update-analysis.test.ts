// @vitest-environment node
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype, type CompileOptions } from '../src/compile';
import { runCompilerCli } from '../src/cli';
import { analyzePropsUpdates } from '../src/props-update-analysis';

const temporary: string[] = [];
afterEach(async () => {
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});

function source(
  setup = '',
  render = "r => r.el('strong', [r.read.props.get().label])",
  declarations = ''
) {
  return `import { definePrototype, tw, type RunHandle, type DefHandle } from '@proto.ui/core';
${declarations}
export default definePrototype({name:'props-analysis',setup(def){
  def.props.define({label:{type:'string',default:'first'}});
  ${setup}
  return ${render};
}});`;
}

function compile(input: string, options: CompileOptions = {}) {
  const result = compilePrototype(input, {
    fileName: 'entry.proto.ts',
    profile: 'react-dom-source-v1',
    ...options,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  expect(result.value.analysis).toBeDefined();
  return result.value;
}

function report(input: string, options: CompileOptions = {}) {
  return compile(input, options).analysis!.propsUpdates;
}

describe('#1453 closed Props update advice', () => {
  it.each(['react-dom-source-v1', 'vue-source-v1', 'web-component-source-v1'])(
    'locates the absent authored request without rejecting %s or inserting a render',
    (profile) => {
      const input = source();
      const compilation = compile(input, { profile });
      const analysis = compilation.analysis!.propsUpdates;
      expect(analysis).toMatchObject({
        version: 'props-update-analysis-v1',
        policy: 'explicit',
        status: 'missing-authored-update',
        authoredUpdate: 'absent',
        closed: true,
        updateRequests: [],
        unknownReasons: [],
      });
      expect(analysis.reads).toHaveLength(1);
      expect(analysis.advisories).toHaveLength(1);
      const warning = analysis.advisories[0];
      expect(warning).toMatchObject({
        code: 'props-update:no-authored-request',
        severity: 'warning',
        span: { file: 'entry.proto.ts' },
      });
      expect(input.slice(warning.span.start, warning.span.end)).toBe('r.read.props.get()');
      expect(warning.message).toContain('public-handle update');
      expect(warning.message).toContain('does not prove an application bug');
      expect(compilation.output.provenance.observableSemantics?.props.update).toBe('explicit');
      expect(compilation.output.code).not.toContain('props-update:no-authored-request');
    }
  );

  it.each([
    "def.props.watch(['label'], run => run.update());",
    'def.props.watchAll(run => run.update());',
    "def.event.on('press.commit', run => run.update());",
    'def.lifecycle.onMounted(run => run.update());',
    "def.event.on('press.commit', run => { if (run.props.get().label === 'refresh') run.update(); });",
  ])('retains other legal update causes: %s', (setup) => {
    expect(report(source(setup))).toMatchObject({
      status: 'authored-update-present',
      authoredUpdate: 'present',
      closed: true,
      advisories: [],
    });
  });

  it('follows renamed and re-exported helpers instead of matching watcher spelling', () => {
    const input = source(
      'install(def);',
      undefined,
      "import { register as install } from './barrel';"
    );
    const analysis = report(input, {
      files: {
        'barrel.ts': "export { register } from './helpers';",
        'helpers.ts': `import type { DefHandle, RunHandle } from '@proto.ui/core';
          const forward = (run: RunHandle) => run.update();
          export const register = (definition: DefHandle) => {
            definition.event.on('press.commit', current => forward(current));
          };`,
      },
    });
    expect(analysis).toMatchObject({
      status: 'authored-update-present',
      closed: true,
      advisories: [],
    });
    expect(analysis.updateRequests).toHaveLength(1);
    expect(analysis.updateRequests[0].file).toBe('helpers.ts');
  });

  it('does not mistake a dormant helper or a literal-false branch for an update path', () => {
    for (const input of [
      source('', undefined, 'const unused = (run: RunHandle) => run.update();'),
      source('def.props.watchAll(run => { if (false) run.update(); });'),
    ]) {
      expect(report(input)).toMatchObject({
        status: 'missing-authored-update',
        authoredUpdate: 'absent',
        closed: true,
      });
    }
  });

  it.each(['react-runtime-v1', 'vue2-source-v1'])(
    'keeps the existing %s host default and suppresses explicit-policy advice',
    (profile) => {
      expect(report(source(), { profile })).toMatchObject({
        policy: 'host',
        status: 'host-policy',
        advisories: [],
      });
    }
  );

  it('uses the selected compatibility policy, not the profile default', () => {
    expect(
      report(source(), {
        profile: { profile: 'react-dom-source-v1', propsUpdatePolicy: 'host' },
      })
    ).toMatchObject({ policy: 'host', status: 'host-policy', advisories: [] });
    expect(
      report(source(), {
        profile: { profile: 'vue2-source-v1', propsUpdatePolicy: 'explicit' },
      })
    ).toMatchObject({ policy: 'explicit', status: 'missing-authored-update' });
  });

  it('separates Rule-only Props use from direct render reads', () => {
    const analysis = report(
      source(
        "def.rule({when:w=>w.prop('label').eq('first'),intent:i=>i.feedback.style.use(tw('active'))});",
        'r => r.slot()'
      )
    );
    expect(analysis).toMatchObject({
      status: 'no-direct-render-props',
      reads: [],
      advisories: [],
    });
  });

  it('observes raw presence reads and does not require resolved get()', () => {
    const analysis = report(
      source('', "r => r.el('strong', [r.read.props.isProvided('label') ? 'provided' : 'absent'])")
    );
    expect(analysis).toMatchObject({
      status: 'missing-authored-update',
      reads: [{ channel: 'provided' }],
    });
  });

  it('retains unknown external callable behavior even with a checked signature', () => {
    const analysis = report(source("def.expose.method('invoke', (work: () => void) => work());"));
    expect(analysis).toMatchObject({
      status: 'unknown',
      authoredUpdate: 'unknown',
      closed: false,
      unknownReasons: ['external-callable'],
      advisories: [],
    });
  });

  it('keeps recursive demand unknown instead of converting the finite analysis limit into absence', () => {
    const analysis = report(
      source(
        "def.expose.method('repeat', repeat);",
        undefined,
        "const repeat = (again: boolean): string => again ? repeat(again) : 'done';"
      )
    );
    expect(analysis).toMatchObject({
      status: 'unknown',
      authoredUpdate: 'unknown',
      closed: false,
      advisories: [],
    });
    expect(analysis.unknownReasons).toContain('opaque-callable');
  });

  it('does not mutate the admitted IR or generated output while producing a source-bound report', () => {
    const compilation = compile(source("def.props.watch(['label'], run => run.update());"));
    const before = JSON.stringify(compilation);
    const first = analyzePropsUpdates(compilation.ir, 'explicit');
    expect(first).toEqual(compilation.analysis!.propsUpdates);
    expect(JSON.stringify(compilation)).toBe(before);
    expect(analyzePropsUpdates(compilation.ir, 'host').advisories).toEqual([]);
    expect(JSON.stringify(compilation)).toBe(before);
  });

  it('makes the advisory available from real CLI check/explain without writing output or failing', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'proto-props-advisory-'));
    temporary.push(cwd);
    await writeFile(path.join(cwd, 'entry.proto.ts'), source());
    for (const command of ['check', 'explain']) {
      let stdout = '';
      let stderr = '';
      const code = await runCompilerCli(
        [command, 'entry.proto.ts', '--profile', 'react-dom-source-v1', '--json'],
        {
          cwd,
          stdout: (text) => {
            stdout += text;
          },
          stderr: (text) => {
            stderr += text;
          },
        }
      );
      expect(code).toBe(0);
      expect(stderr).toBe('');
      expect(JSON.parse(stdout)).toMatchObject({
        ok: true,
        command,
        diagnostics: [],
        result: { analysis: { propsUpdates: { status: 'missing-authored-update' } } },
      });
    }
    let text = '';
    expect(
      await runCompilerCli(['explain', 'entry.proto.ts', '--profile', 'react-dom-source-v1'], {
        cwd,
        stdout: (chunk) => {
          text += chunk;
        },
      })
    ).toBe(0);
    expect(text).toContain('Props update analysis: missing-authored-update');
    expect(text).toContain('props-update:no-authored-request');
    expect(await readdir(cwd)).toEqual(['entry.proto.ts']);
  });
});
