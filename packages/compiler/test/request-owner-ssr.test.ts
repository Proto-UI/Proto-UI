// @vitest-environment node
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import { compilePrototype } from '../src/compile';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { createRenderer } from '../../adapters/vue2/node_modules/vue-server-renderer';

type Target = 'react' | 'vue' | 'vue2' | 'web-component';
const require = createRequire(import.meta.url);
const floatingRequire = createRequire(
  new URL('../../modules/positioning/package.json', import.meta.url)
);

/** Execute the complete emitted artifact set with the real declared framework. */
function generated(target: Target, created = '', dispose = '') {
  const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'request-owner',setup(def){
  def.props.define({seed:{type:'number',default:3}});
  const count = def.state.numberDiscrete('count',0);
  def.expose.event('phase',{payload:'json'});
  def.lifecycle.onCreated(run=>{count.set(run.props.get().seed);run.expose.emit('phase','created');${created}});
  def.lifecycle.onCreated(run=>{run.expose.emit('phase','created-two');});
  def.lifecycle.onMounted(()=>{throw 'request-must-not-mount';});
  def.lifecycle.onUnmounted(()=>{throw 'request-must-not-unmount';});
  def.lifecycle.onBeforeDispose(run=>{run.expose.emit('phase','dispose');${dispose}});
  def.lifecycle.onBeforeDispose(run=>{run.expose.emit('phase','dispose-two');});
  return r=>r.el('output',count.get());
}});`;
  const parsed = parsePrototype(source, { fileName: 'request-owner.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const output =
    target === 'react'
      ? emitReactSource(parsed.value, { ssr: true })
      : target === 'vue'
        ? emitVueSource(parsed.value, { ssr: true })
        : target === 'vue2'
          ? emitVue2Source(parsed.value, { ssr: true })
          : emitWebComponentSource(parsed.value, { ssr: true });
  if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
  const sources = new Map(
    (output.value.supportingFiles ?? []).map((file) => [file.path, file.contents])
  );
  sources.set('Component.ts', output.value.code);
  const cache = new Map<string, Record<string, any>>();
  function load(path: string): Record<string, any> {
    const previous = cache.get(path);
    if (previous) return previous;
    const source = sources.get(path);
    if (source === undefined) throw new Error(`Missing emitted artifact: ${path}`);
    const exports: Record<string, any> = {};
    cache.set(path, exports);
    const javascript = ts.transpileModule(source, {
      fileName: path,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    new Function('exports', 'require', javascript)(exports, (specifier: string) => {
      if (
        [
          'react',
          'react-dom/server',
          'react-dom/client',
          'react/jsx-runtime',
          'vue',
          'vue/server-renderer',
        ].includes(specifier)
      )
        return require(specifier);
      if (specifier === '@floating-ui/dom') return floatingRequire(specifier);
      if (!specifier.startsWith('.'))
        throw new Error(`Unexpected emitted dependency: ${specifier}`);
      const relative = posix.normalize(posix.join(posix.dirname(path), specifier));
      return load(sources.has(relative) ? relative : `${relative}.ts`);
    });
    return exports;
  }
  const module = load('Component.ts');
  const webSupport = () => {
    const entry = [...sources].find(
      ([name, code]) => name !== 'Component.ts' && code.includes('export function decodeRaw(')
    );
    if (!entry) throw new Error('Missing generated Web Component data boundary');
    return load(entry[0]);
  };
  return {
    source,
    module,
    validateInitialData(carrier: any) {
      if (target === 'react') return module.hydrateGeneratedRoot({}, {}, carrier);
      if (target === 'vue') return module.hydrate({}, carrier);
      if (target === 'vue2') return module.hydrate({ Vue: Vue2, target: {}, carrier });
      return webSupport().decodeRaw(carrier.raw);
    },
    observeCleanup(events: unknown[]) {
      if (target !== 'web-component')
        return this.render({ onPhase: (phase: unknown) => events.push(phase) });
      const port = webSupport().createServerPort({});
      const emit = port.emit.bind(port);
      port.emit = (key: string, payload: unknown, options: object) => {
        events.push(payload);
        emit(key, payload, options);
      };
      try {
        const owner = module.createHydrationOwner(port, {});
        owner.serialize();
        owner.dispose();
      } finally {
        port.close();
      }
    },
    render(props: Record<string, unknown> = {}, options: object = {}) {
      if (target === 'react') return module.renderGeneratedToString(props, options);
      if (target === 'vue2') {
        const raw = Object.create(
          Object.getPrototypeOf(props),
          Object.getOwnPropertyDescriptors(props)
        );
        const onPhase = Object.getOwnPropertyDescriptor(props, 'onPhase')?.value;
        delete raw.onPhase;
        return module.renderToString({
          Vue: Vue2,
          renderer: createRenderer(),
          props: raw,
          ...(onPhase ? { on: { phase: onPhase } } : {}),
          ...options,
        });
      }
      return module.renderToString(props, options);
    },
  };
}

async function outcome(run: () => unknown) {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error };
  }
}

describe.each<Target>(['react', 'vue', 'vue2', 'web-component'])(
  '%s generated request owner',
  (target) => {
    it('runs created and projection without any browser or physical mount', async () => {
      expect(typeof document).toBe('undefined');
      const module = generated(target);
      const first = await module.render({ seed: 7 });
      const second = await module.render({ seed: 11 });
      expect(first.html).toContain('7');
      expect(second.html).toContain('11');
    });

    it.each(['undefined', 'null', 'false', '0', "''"])(
      'preserves thrown %s when failed-created cleanup also throws',
      async (literal) => {
        const values: Record<string, unknown> = {
          undefined,
          null: null,
          false: false,
          0: 0,
          "''": '',
        };
        const module = generated(target, `throw ${literal};`, "throw 'secondary-cleanup';");
        expect(await outcome(() => module.render())).toEqual({ ok: false, error: values[literal] });
      }
    );

    it('rejects a normal completion when beforeDispose throws undefined', async () => {
      const module = generated(target, '', 'throw undefined;');
      expect(await outcome(() => module.render())).toEqual({ ok: false, error: undefined });
    });

    it.each([true, false])(
      'keeps exhaustive failed-created cleanup distinct from ordinary fail-fast disposal (%j)',
      async (failedCreated) => {
        const module = generated(
          target,
          failedCreated ? 'throw undefined;' : '',
          "throw 'secondary-cleanup';"
        );
        const events: unknown[] = [];
        const result = await outcome(() => module.observeCleanup(events));
        expect(result).toEqual({
          ok: false,
          error: failedCreated ? undefined : 'secondary-cleanup',
        });
        expect(events).toEqual(
          failedCreated
            ? ['created', 'dispose', 'dispose-two']
            : ['created', 'created-two', 'dispose']
        );
      }
    );

    it('retains the first abort when synchronous authored/request work subsequently throws', async () => {
      const controller = new AbortController();
      const module = generated(
        target,
        target === 'web-component' ? '' : 'throw undefined;',
        "throw 'cleanup';"
      );
      const result = await outcome(() =>
        target === 'web-component'
          ? module.module.renderWithScope({}, { signal: controller.signal }, () => {
              controller.abort(false);
              throw undefined;
            })
          : module.render(
              {
                onPhase(phase: string) {
                  if (phase === 'created') controller.abort(false);
                },
              },
              { signal: controller.signal }
            )
      );
      expect(result).toEqual({ ok: false, error: false });
    });

    it.each([null, false, 0, ''])('preserves an already aborted reason %j', async (reason) => {
      const signal = AbortSignal.abort(reason);
      const module = generated(target, "throw 'setup-started';");
      expect(await outcome(() => module.render({}, { signal }))).toEqual({
        ok: false,
        error: reason,
      });
    });

    it('rejects accessor data before authored created or the accessor can run', async () => {
      const module = generated(target, "throw 'created-started';");
      let reads = 0;
      const value = Object.defineProperty([1], '0', {
        enumerable: true,
        get() {
          reads++;
          return 3;
        },
      });
      for (const props of [
        Object.defineProperty({}, 'seed', {
          enumerable: true,
          get() {
            reads++;
            return 3;
          },
        }),
        { extra: value },
      ]) {
        const result = await outcome(() => module.render(props));
        expect(result.ok).toBe(false);
        expect('error' in result && result.error).toBeInstanceOf(TypeError);
      }
      expect(reads).toBe(0);
    });

    it('rejects live handles, sparse/extended arrays and bounded-data overflow', async () => {
      const module = generated(target, "throw 'created-started';");
      let deep: unknown = 1;
      for (let i = 0; i < 66; i++) deep = [deep];
      for (const extra of [
        new Date(),
        () => {},
        Symbol('owner'),
        new Array(2),
        Object.assign([1], { extra: true }),
        Array(10001).fill(0),
        deep,
        'x'.repeat(1048577),
      ]) {
        const result = await outcome(() => module.render({ extra }));
        expect(result.ok).toBe(false);
        expect('error' in result && result.error).toBeInstanceOf(TypeError);
      }
    });

    it('checks malformed initialization tags and duplicate fields before any receiving owner starts', async () => {
      const module = generated(target);
      const result = await module.render();
      for (const bad of target === 'react'
        ? [
            { kind: 'undefined', value: 1 },
            {
              kind: 'object',
              entries: [
                ['same', { kind: 'value', value: 1 }],
                ['same', { kind: 'undefined' }],
              ],
            },
          ]
        : [
            ['undefined', 1],
            [
              'record',
              [
                ['same', 1],
                ['same', 2],
              ],
            ],
          ]) {
        const carrier = JSON.parse(JSON.stringify(result.carrier ?? result.handoff));
        if (target === 'react') Object.values<any>(carrier.projections)[0].raw = bad;
        else if (target === 'vue') Object.values<any>(carrier.records)[0].raw = bad;
        else if (target === 'vue2') carrier.initialProps = bad;
        else carrier.raw = [['seed', { kind: 'value', value: bad }]];
        await expect(
          Promise.resolve().then(() => module.validateInitialData(carrier))
        ).rejects.toThrow(/malformed/);
      }
    });

    it('keeps every canonical SSR target explicitly unsupported', () => {
      const { source } = generated(target);
      for (const profile of [
        'react-dom-ssr-v1',
        'vue-ssr-v1',
        'vue2-ssr-v1',
        'web-component-ssr-v1',
      ]) {
        const result = compilePrototype(source, { profile });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.diagnostics[0].code).toBe('PUI4001');
      }
    });
  }
);
