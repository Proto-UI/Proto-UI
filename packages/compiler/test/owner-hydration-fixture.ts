import { compilationArtifacts } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { emitWebComponentSource } from '../src/web-component-source';
import { loadGeneratedModule } from './button-ssr-fixture';

export const ownerHydrationSource = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'owner-retirement',setup(def){
  def.props.define({seed:{type:'number',default:3}});
  const value = def.state.numberDiscrete('value',0);
  def.expose.state('value',value);
  def.expose.event('phase',{payload:'json'});
  def.props.watch(['seed'],(run,next)=>{value.set(next.seed);run.update();});
  def.lifecycle.onCreated(run=>{value.set(run.props.get().seed);run.expose.emit('phase','created');});
  def.lifecycle.onMounted(run=>run.expose.emit('phase','mounted'));
  def.lifecycle.onUnmounted(run=>run.expose.emit('phase','unmounted'));
  def.lifecycle.onBeforeDispose(run=>run.expose.emit('phase','disposed'));
  return r=>r.el('output',value.get());
}});`;

/** Private SSR evidence; canonical target admission remains explicitly unsupported. */
export function compileOwnerHydrationFixture(tagName: string) {
  const parsed = parsePrototype(ownerHydrationSource, { fileName: 'owner-retirement.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const output = emitWebComponentSource(parsed.value, {
    ssr: true,
    tagName,
    className: 'OwnerRetirement',
  });
  if (!output.ok) throw new Error(JSON.stringify(output.diagnostics));
  const files = compilationArtifacts({ ir: parsed.value, output: output.value });
  const server = loadGeneratedModule(files, 'Component.ts') as {
    hydrationArtifacts: { source: string; helpers: string; css: string; environment: string };
    renderToString(props: { seed: number }): { html: string };
  };
  return {
    files,
    server,
    tagName,
    css: files.find((file) => file.path === 'Component.css')!.contents,
  };
}
