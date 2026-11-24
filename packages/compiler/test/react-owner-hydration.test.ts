// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { URL as NodeURL } from 'node:url';
import ts from 'typescript';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactDOMServer from 'react-dom/server';
import * as ReactJSX from 'react/jsx-runtime';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { writeCompilation } from '../src/compile';
import { generatedSourcePath } from '../src/emitter-map';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const floatingRequire = createRequire(
  new NodeURL('../../modules/positioning/package.json', import.meta.url)
);
const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'adoption-owner',setup(def){
  def.props.define({seed:{type:'number',default:3}});
  const value=def.state.numberDiscrete('value',0);
  def.expose.state('value',value);
  def.expose.event('phase',{payload:'json'});
  def.lifecycle.onCreated(run=>{value.set(run.props.get().seed);run.expose.emit('phase','created');});
  def.lifecycle.onBeforeDispose(run=>run.expose.emit('phase','disposed'));
  return r=>r.el('section',{},[r.el('output',value.get()),r.slot()]);
}});`;

interface GeneratedRoot {
  root: ReactDOMClient.Root;
  diagnostics: unknown[];
  getHandle(): { getExposes(): { value: { get(): number } } };
  render(props: Record<string, unknown>): void;
  unmount(): void;
}
interface GeneratedModule {
  renderGeneratedToString(props?: Record<string, unknown>): { html: string; carrier: unknown };
  hydrateGeneratedRoot(
    container: Element,
    props: Record<string, unknown>,
    carrier: unknown,
    options?: ReactDOMClient.HydrationOptions
  ): GeneratedRoot;
}

function compileGenerated() {
  const parsed = parsePrototype(source, { fileName: 'react-adoption-owner.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted = emitReactSource(parsed.value, { ssr: true });
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  return { ir: parsed.value, output: emitted.value };
}

function generated(): GeneratedModule {
  const { output } = compileGenerated();
  const sources = new Map((output.supportingFiles ?? []).map((file) => [file.path, file.contents]));
  sources.set('Component.tsx', output.code);
  const cache = new Map<string, Record<string, unknown>>();
  function load(path: string): Record<string, unknown> {
    const previous = cache.get(path);
    if (previous) return previous;
    const input = sources.get(path);
    if (input === undefined) throw new Error(`Missing actual emitted module: ${path}`);
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const javascript = ts.transpileModule(input, {
      fileName: path,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    new Function('exports', 'require', javascript)(exports, (specifier: string) => {
      if (specifier === 'react') return React;
      if (specifier === 'react-dom') return ReactDOM;
      if (specifier === 'react-dom/client') return ReactDOMClient;
      if (specifier === 'react-dom/server') return ReactDOMServer;
      if (specifier === 'react/jsx-runtime') return ReactJSX;
      if (specifier === '@floating-ui/dom') return floatingRequire(specifier);
      if (!specifier.startsWith('.'))
        throw new Error(`Unexpected emitted dependency: ${specifier}`);
      const relative = posix.normalize(posix.join(posix.dirname(path), specifier));
      return load(sources.has(relative) ? relative : `${relative}.ts`);
    });
    return exports;
  }
  return load('Component.tsx') as unknown as GeneratedModule;
}

describe('C-LIFECYCLE-OWNER-INITIALIZATION-0001-E: generated React adoption', () => {
  it('retires a rejected hydration recovery and its native child effects', async () => {
    const module = generated();
    const server = module.renderGeneratedToString({
      children: React.createElement(
        React.Suspense,
        { fallback: null },
        React.createElement('button', null, 'server')
      ),
    });
    const host = document.createElement('div');
    host.innerHTML = server.html;
    document.body.append(host);
    const phases: unknown[] = [],
      errors: unknown[] = [];
    const audit = { active: 0, mounted: 0, retired: 0, events: 0 };
    const listener = () => {
      audit.events += 1;
    };
    function NativeChild() {
      React.useEffect(() => {
        audit.active += 1;
        audit.mounted += 1;
        window.addEventListener('react-owner-probe', listener);
        return () => {
          audit.active -= 1;
          audit.retired += 1;
          window.removeEventListener('react-owner-probe', listener);
        };
      }, []);
      return React.createElement('button', null, 'client');
    }
    let app: GeneratedRoot | undefined;
    try {
      await React.act(async () => {
        app = module.hydrateGeneratedRoot(
          host,
          {
            children: React.createElement(
              React.Suspense,
              { fallback: null },
              React.createElement(NativeChild)
            ),
            onPhase: (phase: unknown) => phases.push(phase),
          },
          server.carrier,
          {
            onRecoverableError(error) {
              errors.push(error);
            },
          }
        );
      });
      expect(errors).toHaveLength(1);
      expect(() => app!.getHandle()).toThrow(/adoption did not succeed/);
      expect(audit).toEqual({ active: 0, mounted: 1, retired: 1, events: 0 });
      expect(() => app!.render({ seed: 9 })).toThrow(/rejected or disposed/);
      window.dispatchEvent(new Event('react-owner-probe'));
      expect(audit.events).toBe(0);
      expect(phases.at(-1)).toBe('disposed');
    } finally {
      await React.act(async () => {
        app?.unmount();
      });
      host.remove();
    }
  });

  it('keeps accepted adoption live until terminal unmount and creates fresh State on explicit recovery', async () => {
    const module = generated();
    const server = module.renderGeneratedToString({
      children: React.createElement('button', null, 'server'),
    });
    const host = document.createElement('div');
    host.innerHTML = server.html;
    document.body.append(host);
    const initialRoot = host.firstElementChild;
    const phases: unknown[] = [];
    const props = {
      seed: 3,
      children: React.createElement('button', null, 'server'),
      onPhase: (phase: unknown) => phases.push(phase),
    };
    let app: GeneratedRoot | undefined;
    try {
      await React.act(async () => {
        app = module.hydrateGeneratedRoot(host, props, server.carrier);
      });
      expect(app!.diagnostics).toEqual([]);
      expect(host.firstElementChild).toBe(initialRoot);
      const state = app!.getHandle().getExposes().value;
      expect(state.get()).toBe(3);
      await React.act(async () => {
        app!.render({ ...props, children: React.createElement('button', null, 'updated') });
      });
      expect(host.querySelector('button')?.textContent).toBe('updated');
      expect(app!.getHandle().getExposes().value).toBe(state);
      expect(phases).toEqual(['created']);
      await React.act(async () => {
        app!.unmount();
        app!.unmount();
      });
      expect(phases).toEqual(['created', 'disposed']);
      expect(() => state.get()).toThrow(/terminal disposal/);
      expect(() => app!.getHandle()).toThrow(/disposed/);
      expect(() => app!.render(props)).toThrow(/disposed/);

      host.innerHTML = server.html;
      await React.act(async () => {
        app = module.hydrateGeneratedRoot(host, props, server.carrier);
      });
      const next = app!.getHandle().getExposes().value;
      expect(next).not.toBe(state);
      expect(next.get()).toBe(3);
      expect(phases).toEqual(['created', 'disposed', 'created']);
      expect(host.querySelector('button')?.textContent).toBe('server');
      expect(() => state.get()).toThrow(/terminal disposal/);
    } finally {
      await React.act(async () => {
        app?.unmount();
      });
      host.remove();
    }
    expect(phases).toEqual(['created', 'disposed', 'created', 'disposed']);
  });

  it('typechecks the complete actual SSR artifact closure as a strict consumer', async () => {
    const compiled = compileGenerated();
    const base = join(process.cwd(), 'packages/compiler/test/generated-modules');
    await mkdir(base, { recursive: true });
    const temp = await mkdtemp(join(base, 'react-adoption-strict-'));
    const output = join(temp, 'output');
    try {
      const written = await writeCompilation(compiled, output);
      if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
      const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
      const names = [
        join(output, generatedSourcePath(compiled.output.profile)),
        ...(compiled.output.supportingFiles ?? [])
          .filter((file) => /\.[cm]?[jt]sx?$/.test(file.path))
          .map((file) => join(output, file.path)),
      ];
      const program = ts.createProgram(names, {
        ...parsed.options,
        strict: true,
        noEmit: true,
        allowJs: true,
        checkJs: true,
      });
      expect(
        ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
          code: diagnostic.code,
          file: diagnostic.file?.fileName.replace(output, '<artifact>'),
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        }))
      ).toEqual([]);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }, 30_000);
});
