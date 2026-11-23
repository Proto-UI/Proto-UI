import type {
  BrowserCompileResult,
  BrowserPreviewArtifact,
} from '../../../../../packages/compiler/src/browser/protocol';

export interface CompiledPreviewItem {
  props: Record<string, unknown>;
  text?: string;
}
export interface BrowserTargetAssets {
  format: 1;
  profile: string;
  modules: Record<string, string>;
  versions: Record<string, string>;
  modulesSha256: string;
}
export interface CompiledPreviewMount {
  readonly frame: HTMLIFrameElement;
  readonly ready: Promise<void>;
  dispose(): Promise<void>;
}

const budget = `let checks=0, reset;
export function checkpoint(){
  if(reset===undefined)reset=setTimeout(()=>{checks=0;reset=undefined;},0);
  if(++checks>100000)throw new Error('Preview execution checkpoint limit exceeded.');
}`;
const safeJSON = (value: unknown) =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');

/** Build only the isolated preview document; it has no origin/storage/network grants. */
export function compiledPreviewDocument(
  preview: BrowserPreviewArtifact,
  target: BrowserTargetAssets,
  revision: string,
  token: string,
  items: readonly CompiledPreviewItem[]
): string {
  const payload = safeJSON({ preview, target, revision, token, items, budget });
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${token}' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; child-src 'none';"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font:14px/1.5 system-ui,sans-serif;color:#202124;background:transparent}#stage{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;min-height:150px;padding:16px;box-sizing:border-box}#stage>[data-preview-item]{padding:8px 16px;border:1px solid #adb5bd;border-radius:6px}#stage>[data-preview-item]:focus-visible{outline:2px solid #2563eb;outline-offset:3px}[aria-disabled=true]{opacity:.45}</style></head><body><div id="stage"></div><script nonce="${token}">
const input=${payload};
const send=(type,detail={})=>parent.postMessage({type,revision:input.revision,token:input.token,...detail},'*');
const urls=[],cleanupFailures=[],secondaryFailures=[];let retire=()=>{},closed=false,failed=false,retiring=false;
const eventProps=(index)=>Object.fromEntries(input.preview.events.map(name=>['on'+name[0].toUpperCase()+name.slice(1),()=>{if(!closed&&!failed)send('preview-event',{name,index});}]));
const error=(value)=>{if(retiring)cleanupFailures.push(value);else if(!closed){if(failed)secondaryFailures.push(value);else{failed=true;send('preview-error',{message:String(value&&value.message||value).slice(0,2000)});}}};
addEventListener('error',(event)=>error(event.error||event.message));
addEventListener('unhandledrejection',(event)=>error(event.reason));
// Admission rejects authored anchors/forms; additionally suppress native defaults
// from trusted delivery code. CSP alone does not prevent frame self-navigation.
addEventListener('click',(event)=>{if(event.composedPath().some(node=>node&&node.tagName==='A'&&node.hasAttribute('href')))event.preventDefault();},true);
addEventListener('submit',(event)=>event.preventDefault(),true);
addEventListener('message',async(event)=>{
  const message=event.data;
  if(event.source!==parent||!message||message.type!=='dispose'||message.token!==input.token||message.revision!==input.revision||closed)return;
  closed=true;retiring=true;
  try{await retire();}catch(failure){cleanupFailures.push(failure);}
  finally{
    try{document.getElementById('stage').replaceChildren();}catch(failure){cleanupFailures.push(failure);}
    for(const url of urls){try{URL.revokeObjectURL(url);}catch(failure){cleanupFailures.push(failure);}}
    const failures=[...secondaryFailures.map(value=>'Secondary preview error: '+String(value&&value.message||value)),...cleanupFailures.map(value=>'Cleanup error: '+String(value&&value.message||value))];
    if(failures.length)send('cleanup-error',{message:failures.join(' | ').slice(0,2000)});
    retiring=false;send('disposed');
  }
});
send('preview-listener-ready');
(async()=>{
  const modules={...input.target.modules,...input.preview.modules,'pui:preview-budget':input.budget};
  const imports={};
  for(const [name,source]of Object.entries(modules)){
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));urls.push(url);imports[name]=url;
  }
  const map=document.createElement('script');map.type='importmap';map.nonce=input.token;map.textContent=JSON.stringify({imports});document.head.append(map);
  for(const css of input.preview.styles){const style=document.createElement('style');style.textContent=css;document.head.append(style);}
  const generated=await import(input.preview.entry);if(closed)return;
  const component=generated.default||generated.CompiledComponent;
  const stage=document.getElementById('stage');
  if(input.target.profile==='web-component-source-v1'){
    customElements.define('compiled-preview-control',component);
    const owners=[];
    retire=()=>{const failures=[];for(const owner of owners){try{owner.dispose();}catch(error){failures.push(error);}}if(failures.length)throw new AggregateError(failures,'Preview cleanup failed.');};
    for(const [index,item] of input.items.entries()){
      const element=document.createElement('compiled-preview-control');element.dataset.previewItem='';element.textContent=item.text||'';
      for(const name of input.preview.events)element.addEventListener(name,event=>{if(!closed&&!failed&&event instanceof CustomEvent&&event.target===element)send('preview-event',{name,index});});
      owners.push(element);element.setProps(item.props);stage.append(element);
    }
  }else if(input.target.profile==='react-dom-source-v1'){
    const React=await import('react');const {createRoot}=await import('react-dom/client');const {flushSync}=await import('react-dom');if(closed)return;
    const root=createRoot(stage,{onUncaughtError:error});retire=()=>root.unmount();flushSync(()=>root.render(React.createElement(React.Fragment,null,...input.items.map((item,index)=>React.createElement(component,{...item.props,...eventProps(index),key:index,'data-preview-item':''},item.text||'')))));
  }else if(input.target.profile==='vue-source-v1'){
    const Vue=await import('vue');if(closed)return;
    const app=Vue.createApp({render:()=>input.items.map((item,index)=>Vue.h(component,{...item.props,...eventProps(index),'data-preview-item':''},{default:()=>item.text||''}))});app.config.errorHandler=error;retire=()=>app.unmount();app.mount(stage);
  }else if(input.target.profile==='vue2-source-v1'){
    const {default:Vue}=await import('vue');if(closed)return;Vue.config.errorHandler=error;
    const app=new Vue({render(h){return h('div',input.items.map((item,index)=>h(component,{props:item.props,on:Object.fromEntries(input.preview.events.map(name=>[name,()=>{if(!closed&&!failed)send('preview-event',{name,index});}])),attrs:{'data-preview-item':''}},[item.text||''])));}});
    retire=()=>app.$destroy();stage.append(app.$mount().$el);
  }else throw new Error('Unsupported preview target '+input.target.profile);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(!closed&&!failed)send('preview-ready',{profile:input.target.profile});
})().catch(error);
</script></body></html>`;
}

export function mountCompiledPreview(
  host: HTMLElement,
  result: Extract<BrowserCompileResult, { ok: true }>,
  target: BrowserTargetAssets,
  items: readonly CompiledPreviewItem[],
  onFailure: (error: Error) => void,
  onEvent?: (name: string, index: number) => void
): CompiledPreviewMount {
  if (
    !result.preview ||
    result.preview.format !== 1 ||
    target.format !== 1 ||
    target.profile !== result.output.profile
  )
    throw new Error('Preview artifact and selected target do not match.');
  const window = host.ownerDocument.defaultView!;
  const frame = host.ownerDocument.createElement('iframe');
  const token = window.crypto.randomUUID().replaceAll('-', '');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  frame.title = `Compiled preview · ${result.revision}`;
  frame.style.cssText = 'width:100%;height:190px;border:0;display:block;';
  let disposed = false,
    readySettled = false,
    listenerReady = false,
    disposeSent = false,
    retirePromise: Promise<void> | undefined;
  let finishRetirement: (() => void) | undefined;
  let cleanupError: Error | undefined;
  let rejectReady!: (error: Error) => void, resolveReady!: () => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const readyDeadline = window.setTimeout(() => {
    if (!disposed) {
      const error = new Error('Preview mount exceeded its 10-second deadline.');
      rejectReady(error);
      onFailure(error);
    }
  }, 10_000);
  const sendRetirement = () => {
    if (!disposed || !listenerReady || !finishRetirement || disposeSent) return;
    const current = frame.contentWindow;
    if (!current) return;
    disposeSent = true;
    current.postMessage({ type: 'dispose', token, revision: result.revision }, '*');
  };
  const listener = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== 'null') return;
    const message = event.data;
    if (!message || message.token !== token || message.revision !== result.revision) return;
    if (message.type === 'preview-listener-ready') {
      listenerReady = true;
      sendRetirement();
      return;
    }
    if (message.type === 'cleanup-error') {
      cleanupError = new Error(String(message.message));
      return;
    }
    if (message.type === 'disposed') {
      finishRetirement?.();
      return;
    }
    if (disposed) return;
    if (
      message.type === 'preview-event' &&
      result.preview!.events.includes(message.name) &&
      Number.isInteger(message.index) &&
      message.index >= 0 &&
      message.index < items.length
    )
      onEvent?.(message.name, message.index);
    if (message.type === 'preview-ready' && message.profile === target.profile) {
      readySettled = true;
      window.clearTimeout(readyDeadline);
      resolveReady();
    }
    if (message.type === 'preview-error') {
      const error = new Error(String(message.message));
      window.clearTimeout(readyDeadline);
      rejectReady(error);
      onFailure(error);
    }
  };
  window.addEventListener('message', listener);
  frame.srcdoc = compiledPreviewDocument(result.preview, target, result.revision, token, items);
  host.replaceChildren(frame);
  return {
    frame,
    ready,
    dispose() {
      if (retirePromise) return retirePromise;
      disposed = true;
      window.clearTimeout(readyDeadline);
      if (!readySettled) rejectReady(new DOMException('Preview was retired.', 'AbortError'));
      frame.hidden = true;
      retirePromise = new Promise<void>((resolve, reject) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          finishRetirement = undefined;
          window.clearTimeout(timeout);
          window.removeEventListener('message', listener);
          frame.remove();
          if (cleanupError) reject(cleanupError);
          else resolve();
        };
        const timeout = window.setTimeout(() => {
          cleanupError ??= new Error(
            'Preview cleanup acknowledgement exceeded its 250-millisecond deadline.'
          );
          finish();
        }, 250);
        finishRetirement = finish;
        sendRetirement();
      });
      return retirePromise;
    },
  };
}
