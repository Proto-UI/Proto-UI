/**
 * Browser-only native resource support. This is emitted source, not executed by the
 * compiler. It accepts completed native DOM fragments, never tags or semantic IR.
 * Component construction/props/style operations must be emitted at their call sites.
 * Not connected to the production emitter until the full migration is verified.
 */
export const webComponentBrowserSupport = {
  path: '.proto-ui/web-component/browser-v1.ts',
  kind: 'source' as const,
  contents: `
import {createNativeInteraction,markNativeExposeEvent} from '../interaction/native-v1';
import {ownerScopes,type ContextScope} from '../context/scope-v1';
export interface NativeFrame {
  readonly fragment: DocumentFragment;
  readonly slot: Readonly<{start: Comment; end: Comment}> | null;
}
function validRange(start: Comment, end: Comment): boolean {
  if (start===end || !start.parentNode || start.parentNode!==end.parentNode) return false;
  for (let node=start.nextSibling;node;node=node.nextSibling) if(node===end)return true;
  return false;
}
export interface NativeFrameBuilder {
  readonly document: Document;
  slot(): Node;
  finish(fragment: DocumentFragment): NativeFrame;
}
/** Allocate detached native slot resources without moving any live consumer child. */
export function createNativeFrame(document: Document, shadow: boolean): NativeFrameBuilder {
  let requested = false, finished = false;
  let range: {start: Comment; end: Comment} | null = null;
  return {
    document,
    slot() {
      if (finished) throw new Error('Native frame is finished');
      if (requested) throw new Error('Multiple slots are unsupported');
      requested = true;
      if (shadow) return document.createElement('slot');
      range = {start: document.createComment('pui-slot-start'), end: document.createComment('pui-slot-end')};
      const fragment = document.createDocumentFragment();
      fragment.append(range.start, range.end);
      return fragment;
    },
    finish(fragment) {
      if (finished) throw new Error('Native frame is finished');
      if (fragment.ownerDocument !== document) throw new Error('Native frame document differs');
      finished = true;
      // A called-but-discarded slot does not project children into an unrelated tree.
      if (range && fragment.contains(range.start) !== fragment.contains(range.end)) throw new Error('Native slot range is split');
      const slot = range && fragment.contains(range.start) && fragment.contains(range.end) ? range : null;
      if (slot && !validRange(slot.start,slot.end)) throw new Error('Native slot range is split');
      return Object.freeze({fragment,slot});
    },
  };
}
export interface NativeRangeOwner {
  commit(frame: NativeFrame): void;
  clear(): void;
  dispose(): void;
}
/**
 * This API owns insertion/removal and light-slot projection only. It cannot construct
 * a semantic element, interpret a template value or dispatch an operation.
 */
export function createNativeRangeOwner(host: HTMLElement, shadow: boolean): NativeRangeOwner {
  const document = host.ownerDocument;
  const root: HTMLElement | ShadowRoot = shadow ? host.shadowRoot ?? host.attachShadow({mode:'open'}) : host;
  let disposed = false, mutating = false, pendingClear = false;
  let owned: Node[] = [];
  let slot: NativeFrame['slot'] = null;
  let projected: Node[] = [];
  let observer: MutationObserver | null = null;
  const accepted = new WeakSet<object>();
  function inSlot(node: Node): boolean {
    if (!slot || !root.contains(slot.start) || !root.contains(slot.end) || node.parentNode !== slot.start.parentNode || slot.start.parentNode !== slot.end.parentNode) return false;
    for (let current=slot.start.nextSibling;current && current!==slot.end;current=current.nextSibling) if(current===node)return true;
    return false;
  }
  function externalChildren(): Node[] {
    if (shadow) return [];
    const roots = new Set(owned);
    return [...new Set([...projected.filter(inSlot),
      ...Array.from(host.childNodes).filter(node=>!roots.has(node))])];
  }
  function observe(): void {
    if (disposed || shadow || !slot) return;
    observer = new document.defaultView!.MutationObserver(()=>{
      if (disposed || !slot?.end.parentNode || !root.contains(slot.start) || !root.contains(slot.end)) return;
      projected = projected.filter(inSlot);
      const roots = new Set(owned);
      for (const node of Array.from(host.childNodes)) {
        if (roots.has(node) || projected.includes(node)) continue;
        slot.end.parentNode.insertBefore(node,slot.end);
        projected.push(node);
      }
      projected = projected.filter(inSlot);
    });
    observer.observe(host,{childList:true,subtree:true});
  }
  function disconnect(): void {observer?.disconnect();observer=null;}
  function removeOwned(): void {
    for (const node of owned) if (node.parentNode===root) root.removeChild(node);
    owned=[];
  }
  function clear(): void {
    const external=externalChildren();
    disconnect();
    for (const node of external) node.parentNode?.removeChild(node);
    removeOwned();slot=null;projected=[];
    for (const node of external) host.appendChild(node);
  }
  function mutate(operation:()=>void):void {
    if(mutating)throw new Error('Native resource commit is reentrant');
    mutating=true;
    try {operation();}
    finally {
      try {if(pendingClear){pendingClear=false;clear();}}
      finally {pendingClear=false;mutating=false;}
    }
  }
  return {
    commit(frame) {
      if(disposed)throw new Error('Native range owner is disposed');
      if(accepted.has(frame))throw new Error('Native frame already committed');
      if(frame.fragment.ownerDocument!==document)throw new Error('Native frame document differs');
      if(frame.slot && (!frame.fragment.contains(frame.slot.start) || !frame.fragment.contains(frame.slot.end) || !validRange(frame.slot.start,frame.slot.end)))throw new Error('Invalid native slot range');
      if(mutating)throw new Error('Native resource commit is reentrant');
      mutate(()=>{
      // All authored evaluation and fragment construction have already succeeded.
      // Only this commit boundary is allowed to relocate existing native children.
      const external=externalChildren();
      const next=Array.from(frame.fragment.childNodes);
      disconnect();
      for(const node of external)node.parentNode?.removeChild(node);
      removeOwned();
      owned=next;slot=frame.slot;projected=[];accepted.add(frame);
      root.appendChild(frame.fragment);
      if(slot) {
        for(const node of external)slot.end.parentNode!.insertBefore(node,slot.end);
        projected=external;
      } else for(const node of external)host.appendChild(node);
      observe();
      });
    },
    clear() {if(disposed)return;if(mutating){pendingClear=true;return;}mutate(clear);},
    dispose() {
      if(disposed)return;disposed=true;disconnect();
      if(mutating){pendingClear=true;return;}
      mutate(clear);
    },
  };
}
export interface NativeBrowserPort {
  readonly server:false;readonly isConnected:boolean;readonly root:HTMLElement;readonly host:HTMLElement;
  readonly document:Document;
  readonly hydrationAttributes?:Readonly<Record<string,string|null>>;
  readonly hydrationBaselines?:Readonly<Record<string,string|null>>;
  createInteraction:typeof createNativeInteraction;
  createFrame():NativeFrameBuilder;
  projectRoot(tag:string|null,properties:Readonly<Record<string,string|number|boolean|null>>,portal:HTMLElement|null):void;
  projectInteraction(snapshot:Readonly<Record<string,string|null>>):void;
  attribute(name:string,value:string|null):void;
  commit(frame:NativeFrame):void;clear():void;visible(present:boolean):void;
  emit(key:string,payload?:unknown,options?:CustomEventInit):void;
  parentContext():ContextScope|null;bindContext(scope:ContextScope|null):void;
  accept():void;dispose():void;
}
function nativeParent(host:HTMLElement):ContextScope|null {
  let node:Node|null=host.parentNode;
  while(node){const scope=ownerScopes.get(node);if(scope)return scope;node=node.parentNode??(node instanceof host.ownerDocument.defaultView!.ShadowRoot?node.host:null);}
  return null;
}
/** Physical host mediation only; commit receives already constructed native Nodes. */
export function createNativeBrowserPort(host:HTMLElement,shadow:boolean):NativeBrowserPort {
  const document=host.ownerDocument,range=createNativeRangeOwner(host,shadow);
  let disposed=false,accepted=false,control:HTMLElement|null=null;
  let portalAnchor:Comment|null=null,portalParent:ContextScope|null=null;
  let display:{value:string;priority:string}|null=null;
  const attributes=new Map<string,{baseline:string|null;projected:string|null}>();
  const emissions:{key:string;payload:unknown;options?:CustomEventInit}[]=[];
  const port:NativeBrowserPort={
    server:false,host,document,get isConnected(){return host.isConnected&&!disposed;},get root(){return control??host;},
    createInteraction:createNativeInteraction,
    createFrame(){return createNativeFrame(document,shadow);},
    projectRoot(tag,properties,portal){
      if(tag&&!['input','textarea','img'].includes(tag))throw new Error('Unsupported physical Root tag');
      if(tag&&!control){control=document.createElement(tag);control.setAttribute('part',tag==='img'?'image':'control');}
      if(control&&control.localName!==tag)throw new Error('Physical control declaration cannot change during an owner lifetime');
      if(control)for(const [name,value]of Object.entries(properties)){
        if(name==='value'){if(!accepted)(control as HTMLInputElement).value=String(value??'');continue;}
        if(value===null||value===false)control.removeAttribute(name);else control.setAttribute(name,value===true?'':String(value));
      }
      if(portal){if(!portalAnchor){portalParent=nativeParent(host);portalAnchor=document.createComment('pui-portal');host.parentNode?.insertBefore(portalAnchor,host);}if(host.parentNode!==portal)portal.appendChild(host);}
      else if(portalAnchor){portalAnchor.parentNode?.insertBefore(host,portalAnchor);portalAnchor.remove();portalAnchor=null;portalParent=null;}
    },
    projectInteraction(snapshot){for(const [name,value]of Object.entries(snapshot))port.attribute(name,value);},
    attribute(name,value){
      const target=control??host,current=target.getAttribute(name);let entry=attributes.get(name);
      if(!entry){entry={baseline:current,projected:current};attributes.set(name,entry);}else if(current!==entry.projected)entry.baseline=current;
      if(current!==value){if(value===null)target.removeAttribute(name);else target.setAttribute(name,value);}entry.projected=value;
    },
    commit(frame){
      if(disposed)throw new Error('Native browser port is disposed');
      if(control){if(frame.fragment.childNodes.length)throw new Error('[Template] physical control Root requires empty children');const root=host.shadowRoot??host;if(control.parentNode!==root)root.appendChild(control);return;}
      range.commit(frame);
    },
    clear(){range.clear();if(control?.parentNode===(host.shadowRoot??host))control.remove();},
    visible(present){
      if(!present){if(!display)display={value:host.style.getPropertyValue('display'),priority:host.style.getPropertyPriority('display')};host.style.setProperty('display','none','important');}
      else if(display){if(host.style.getPropertyValue('display')==='none'&&host.style.getPropertyPriority('display')==='important'){if(display.value)host.style.setProperty('display',display.value,display.priority);else host.style.removeProperty('display');}display=null;}
    },
    emit(key,payload,options){if(!accepted){emissions.push({key,payload,options});return;}if(!disposed)host.dispatchEvent(markNativeExposeEvent(new document.defaultView!.CustomEvent(key,{detail:payload,bubbles:true,cancelable:true,...options})));},
    parentContext:()=>portalAnchor?portalParent:nativeParent(host),
    bindContext(scope){if(scope)ownerScopes.set(host,scope);else ownerScopes.delete(host);},
    accept(){accepted=true;for(const emission of emissions.splice(0)){if(disposed)break;port.emit(emission.key,emission.payload,emission.options);}},
    dispose(){
      if(disposed)return;disposed=true;emissions.length=0;range.dispose();if(control?.parentNode===(host.shadowRoot??host))control.remove();
      const target=control??host;for(const[name,entry]of attributes)if(target.getAttribute(name)===entry.projected){if(entry.baseline===null)target.removeAttribute(name);else target.setAttribute(name,entry.baseline);}attributes.clear();ownerScopes.delete(host);
      if(portalAnchor){portalAnchor.parentNode?.insertBefore(host,portalAnchor);portalAnchor.remove();portalAnchor=null;}
      if(display){if(display.value)host.style.setProperty('display',display.value,display.priority);else host.style.removeProperty('display');display=null;}
    },
  };
  return port;
}

`,
};
