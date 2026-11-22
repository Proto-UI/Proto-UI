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
const urls=[];let retire=()=>{},closed=false;
const error=(value)=>{if(!closed)send('preview-error',{message:String(value&&value.message||value).slice(0,2000)});};
addEventListener('error',(event)=>error(event.error||event.message));
addEventListener('unhandledrejection',(event)=>error(event.reason));
// Source-defined links remain visible, but a preview cannot navigate its frame.
addEventListener('click',(event)=>{if(event.composedPath().some(node=>node&&node.tagName==='A'&&node.hasAttribute('href')))event.preventDefault();},true);
addEventListener('submit',(event)=>event.preventDefault(),true);
addEventListener('message',(event)=>{
  const message=event.data;
  if(event.source!==parent||!message||message.type!=='dispose'||message.token!==input.token||message.revision!==input.revision||closed)return;
  closed=true;
  try{retire();}catch(failure){send('cleanup-error',{message:String(failure).slice(0,2000)});}
  finally{document.getElementById('stage').replaceChildren();for(const url of urls)URL.revokeObjectURL(url);send('disposed');}
});
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
    for(const item of input.items){
      const element=document.createElement('compiled-preview-control');element.dataset.previewItem='';element.textContent=item.text||'';
      owners.push(element);element.setProps(item.props);stage.append(element);
    }
  }else if(input.target.profile==='react-dom-source-v1'){
    const React=await import('react');const {createRoot}=await import('react-dom/client');if(closed)return;
    const root=createRoot(stage);retire=()=>root.unmount();root.render(React.createElement(React.Fragment,null,...input.items.map((item,index)=>React.createElement(component,{...item.props,key:index,'data-preview-item':''},item.text||''))));
  }else if(input.target.profile==='vue-source-v1'){
    const Vue=await import('vue');if(closed)return;
    const app=Vue.createApp({render:()=>input.items.map(item=>Vue.h(component,{...item.props,'data-preview-item':''},{default:()=>item.text||''}))});retire=()=>app.unmount();app.mount(stage);
  }else if(input.target.profile==='vue2-source-v1'){
    const {default:Vue}=await import('vue');if(closed)return;
    const app=new Vue({render(h){return h('div',input.items.map(item=>h(component,{props:item.props,attrs:{'data-preview-item':''}},[item.text||''])));}});
    retire=()=>app.$destroy();stage.append(app.$mount().$el);
  }else throw new Error('Unsupported preview target '+input.target.profile);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(!closed)send('preview-ready',{profile:input.target.profile});
})().catch(error);
</script></body></html>`;
}

export function mountCompiledPreview(
  host: HTMLElement,
  result: Extract<BrowserCompileResult, { ok: true }>,
  target: BrowserTargetAssets,
  items: readonly CompiledPreviewItem[],
  onFailure: (error: Error) => void
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
    retirePromise: Promise<void> | undefined;
  let finishRetirement: (() => void) | undefined;
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
  const listener = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== 'null') return;
    const message = event.data;
    if (!message || message.token !== token || message.revision !== result.revision) return;
    if (message.type === 'disposed') {
      finishRetirement?.();
      return;
    }
    if (disposed) return;
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
      retirePromise = new Promise<void>((resolve) => {
        const finish = () => {
          window.clearTimeout(timeout);
          window.removeEventListener('message', listener);
          frame.remove();
          resolve();
        };
        const timeout = window.setTimeout(finish, 250);
        finishRetirement = finish;
        frame.contentWindow?.postMessage(
          { type: 'dispose', token, revision: result.revision },
          '*'
        );
      });
      return retirePromise;
    },
  };
}
