import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { URL as NodeURL } from 'node:url';
import ts from 'typescript';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';

export const ownerMatrixTargets = ['react', 'vue', 'vue2'] as const;
export type OwnerMatrixTarget = (typeof ownerMatrixTargets)[number];
export type OwnerMatrixJourney = 'ownership' | 'rejection' | 'absent' | 'failure' | 'commit';
export const ownerMatrixCases: readonly {
  target: OwnerMatrixTarget;
  journey: OwnerMatrixJourney;
}[] = [
  ...ownerMatrixTargets.flatMap((target) =>
    (['ownership', 'rejection'] as const).map((journey) => ({ target, journey }))
  ),
  { target: 'vue', journey: 'absent' },
  { target: 'vue', journey: 'failure' },
  { target: 'vue', journey: 'commit' },
];
export const ownerMatrixSources = {
  'keys.ts': `import {createContextKey} from '@proto.ui/core';
export const KEY=createContextKey<{value:number}>('owner-browser-context');`,
  'Provider.proto.ts': `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
export default definePrototype({name:'owner-browser-provider',setup(def){
  def.props.define({seed:{type:'number',default:3},visible:{type:'boolean',default:true},commitEffects:{type:'boolean',default:false}});
  const value=def.state.numberDiscrete('value',0);
  let snapshot={value:0};
  def.context.provide(KEY,{value:0});
  def.context.subscribe(KEY,(run,next)=>{snapshot=next;value.set(next.value);run.update();});
  def.expose.state('value',value);
  def.expose.method('contextSnapshot',()=>snapshot);
  def.expose.event('phase',{payload:'json'});
  def.props.watch(['seed'],(run,next)=>{run.context.update(KEY,{value:next.seed});});
  def.props.watch(['visible'],(run,next)=>{run.lifecycle.setPresent(next.visible);});
  def.lifecycle.onCreated(run=>{run.context.update(KEY,{value:run.props.get().seed});run.lifecycle.setPresent(run.props.get().visible);run.expose.emit('phase','created');});
  def.lifecycle.onMounted(run=>{if(run.props.get().commitEffects)run.context.update(KEY,{value:7});run.expose.emit('phase','mounted');});
  def.lifecycle.onUpdated(run=>{if(run.props.get().commitEffects&&value.get()===7){run.context.update(KEY,{value:8});run.expose.emit('phase','updated');}});
  def.lifecycle.onUnmounted(run=>run.expose.emit('phase','unmounted'));
  def.lifecycle.onBeforeDispose(run=>run.expose.emit('phase','disposed'));
  return r=>r.el('section',{},[r.el('output',value.get()),r.slot()]);
}});`,
  'Consumer.proto.ts': `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
export default definePrototype({name:'owner-browser-consumer',setup(def){
  const value=def.state.numberDiscrete('value',0);
  let snapshot={value:0};
  def.context.subscribe(KEY,(run,next)=>{snapshot=next;value.set(next.value);run.update();});
  def.expose.state('value',value);
  def.expose.method('contextSnapshot',()=>snapshot);
  def.expose.event('phase',{payload:'json'});
  def.lifecycle.onCreated(run=>{snapshot=run.context.read(KEY);value.set(snapshot.value);run.expose.emit('phase','created');});
  def.lifecycle.onMounted(run=>run.expose.emit('phase','mounted'));
  def.lifecycle.onUnmounted(run=>run.expose.emit('phase','unmounted'));
  def.lifecycle.onBeforeDispose(run=>run.expose.emit('phase','disposed'));
  return r=>r.el('output',value.get());
}});`,
};

export interface OwnerMatrixFixture {
  html: string;
  carrier: unknown;
  serverPhases: string[];
}

const require = createRequire(import.meta.url);
const positioningRequire = createRequire(
  new NodeURL('../../modules/positioning/package.json', import.meta.url)
);
const vue2Require = createRequire(new NodeURL('../../adapters/vue2/package.json', import.meta.url));
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Actual private producer and native server renderers; no canonical SSR admission. */
export async function compileOwnerMatrix() {
  const artifacts = new Map<string, string>();
  const fixtures: Record<string, OwnerMatrixFixture> = {};
  for (const target of ownerMatrixTargets) {
    const sources = new Map<string, string>();
    const extension = target === 'react' ? 'tsx' : target === 'vue2' ? 'js' : 'ts';
    for (const name of ['Provider', 'Consumer'] as const) {
      const parsed = parsePrototype(ownerMatrixSources[`${name}.proto.ts`], {
        fileName: `${name}.proto.ts`,
        files: { 'keys.ts': ownerMatrixSources['keys.ts'] },
      });
      if (!parsed.ok)
        throw new Error(JSON.stringify({ target, name, diagnostics: parsed.diagnostics }));
      const emit =
        target === 'react' ? emitReactSource : target === 'vue' ? emitVueSource : emitVue2Source;
      const emitted = emit(parsed.value, { ssr: true, componentName: `Owner${name}` });
      if (!emitted.ok)
        throw new Error(JSON.stringify({ target, name, diagnostics: emitted.diagnostics }));
      sources.set(`${name}.${extension}`, emitted.value.code);
      for (const file of emitted.value.supportingFiles ?? []) {
        const previous = sources.get(file.path);
        if (previous !== undefined && previous !== file.contents)
          throw new Error(`Conflicting real artifact ${target}/${file.path}`);
        sources.set(file.path, file.contents);
      }
    }
    const cache = new Map<string, Record<string, any>>();
    function load(file: string): Record<string, any> {
      const previous = cache.get(file);
      if (previous) return previous;
      const input = sources.get(file);
      if (input === undefined) throw new Error(`Missing emitted matrix artifact ${target}/${file}`);
      const exports: Record<string, any> = {};
      cache.set(file, exports);
      const javascript = ts.transpileModule(input, {
        fileName: file,
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
            'react-dom',
            'react-dom/server',
            'react-dom/client',
            'react/jsx-runtime',
            'vue',
            'vue/server-renderer',
          ].includes(specifier)
        )
          return require(specifier);
        if (specifier === '@floating-ui/dom') return positioningRequire(specifier);
        if (!specifier.startsWith('.'))
          throw new Error(`Unexpected generated dependency ${specifier}`);
        const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        for (const candidate of [relative, `${relative}.ts`, `${relative}.js`])
          if (sources.has(candidate)) return load(candidate);
        throw new Error(`Generated dependency escaped matrix ${target}/${relative}`);
      });
      return exports;
    }
    const provider = load(`Provider.${extension}`),
      consumerModule = load(`Consumer.${extension}`);
    const providerComponent = provider.default ?? provider.OwnerProvider;
    const consumer = consumerModule.default ?? consumerModule.OwnerConsumer;
    for (const { journey } of ownerMatrixCases.filter((candidate) => candidate.target === target)) {
      const serverPhases: string[] = [];
      const phase = (owner: string) => (value: string) => serverPhases.push(`${owner}:${value}`);
      let rendered: { html: string; handoff?: unknown; carrier?: unknown };
      if (target === 'react') {
        const React = require('react'),
          h = React.createElement;
        const children =
          journey === 'rejection'
            ? h(React.Suspense, { fallback: null }, h('button', null, 'server'))
            : h(
                'article',
                { 'data-native-wrapper': '' },
                h(consumer, { onPhase: phase('child') }),
                h(
                  providerComponent,
                  { seed: 11, onPhase: phase('nested') },
                  h(consumer, { onPhase: phase('nested-child') })
                )
              );
        rendered = provider.renderGeneratedToString({
          seed: 3,
          visible: true,
          children,
          onPhase: phase('root'),
        });
      } else if (target === 'vue') {
        const Vue = require('vue'),
          h = Vue.h;
        const slots = {
          default: () =>
            journey === 'rejection'
              ? [h('button', 'server')]
              : [
                  h('article', { 'data-native-wrapper': '' }, [
                    h(consumer, { onPhase: phase('child') }),
                    h(
                      providerComponent,
                      { seed: 11, onPhase: phase('nested') },
                      { default: () => [h(consumer, { onPhase: phase('nested-child') })] }
                    ),
                  ]),
                ],
        };
        rendered = await provider.renderToString(
          {
            seed: 3,
            visible: journey !== 'absent',
            commitEffects: journey === 'commit',
            onPhase: phase('root'),
          },
          { slots }
        );
      } else {
        const Vue = vue2Require('vue'),
          renderer = vue2Require('vue-server-renderer').createRenderer();
        const children = (h: any) =>
          journey === 'rejection'
            ? [h('button', 'server')]
            : [
                h('article', { attrs: { 'data-native-wrapper': '' } }, [
                  h(consumer, { on: { phase: phase('child') } }),
                  h(providerComponent, { props: { seed: 11 }, on: { phase: phase('nested') } }, [
                    h(consumer, { on: { phase: phase('nested-child') } }),
                  ]),
                ]),
              ];
        rendered = await provider.renderToString({
          Vue,
          renderer,
          props: { seed: 3, visible: true },
          on: { phase: phase('root') },
          children,
        });
      }
      fixtures[`${target}/${journey}`] = {
        html: rendered.html,
        carrier: rendered.carrier ?? rendered.handoff,
        serverPhases,
      };
    }
    for (const [name, content] of sources) artifacts.set(`${target}/${name}`, content);
  }
  return {
    artifacts,
    fixtures,
    provenance: {
      source: Object.entries(ownerMatrixSources).map(([file, contents]) => ({
        file,
        sha256: sha256(contents),
      })),
      artifacts: [...artifacts].map(([file, contents]) => ({ file, sha256: sha256(contents) })),
      frameworks: {
        react: require('react').version,
        vue: require('vue').version,
        vue2: vue2Require('vue').version,
      },
    },
  };
}
