import { parsePrototype } from '../src/parser';
import type { PrototypeIR } from '../src/ir';

/** The original physical-root input, shared unchanged with the real browser oracle. */
export function physicalRootInput(kind: 'image' | 'text'): PrototypeIR {
  const declaration =
    kind === 'image'
      ? "declareImageView({source:'',alternativeText:'',a11yMode:'decorative',fit:'contain'})"
      : "declareTextControl({content:'plain-text',lineMode:'multiline',engine:'host'})";
  const setup =
    kind === 'image'
      ? 'asImageView();'
      : "const editor=asTextControl();def.lifecycle.onCreated(()=>editor.sync({defaultValue:'seed',valueMode:'uncontrolled',rows:3,minLength:-1,placeholder:'hint',readOnly:true}));";
  const parsed = parsePrototype(
    `import {definePrototype} from '@proto.ui/core';
      import {asImageView,asTextControl} from '@proto.ui/hooks';
      import {declareImageView} from '@proto.ui/module-image-view';
      import {declareTextControl} from '@proto.ui/module-text-control';
      export default definePrototype({name:'root-data-${kind}',modules:[${declaration}],setup(def){${setup}return()=>null;}});`,
    { fileName: `root-data-${kind}.proto.ts` }
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.value;
}

/** Identical authored editing journey inputs for Happy DOM and native Vue2 consumers. */
export function editingInput(lineMode: 'single' | 'multiline', controlled: boolean): PrototypeIR {
  const parsed = parsePrototype(
    `import {definePrototype} from '@proto.ui/core';
      import {asTextControl} from '@proto.ui/hooks';
      import {declareTextControl} from '@proto.ui/module-text-control';
      export default definePrototype({name:'native-editor-lease',
        modules:[declareTextControl({content:'plain-text',lineMode:${JSON.stringify(lineMode)},engine:'host'})],
        setup(def){
          def.props.define({value:{type:'string',default:'seed'},seed:{type:'string',default:'seed'},hint:{type:'string',default:'before'},present:{type:'boolean',default:true}});
          const editor=asTextControl();
          def.lifecycle.onCreated(run=>editor.sync({valueMode:${JSON.stringify(controlled ? 'controlled' : 'uncontrolled')},value:run.props.get().value,defaultValue:run.props.get().seed,placeholder:run.props.get().hint}));
          def.props.watch(['value','seed','hint','present'],(run,next)=>{
            editor.sync({value:next.value,defaultValue:next.seed,placeholder:next.hint});
            run.lifecycle.setPresent(next.present);
          });
          def.expose.method('snapshot',()=>editor.snapshot());
          return()=>null;
        }});`,
    { fileName: 'native-editor-lease.proto.ts' }
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.value;
}
