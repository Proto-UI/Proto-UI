export const qtControlsSource = `// Native TextInput/TextEdit, Image and Flickable retained controls.
export function createControls(options) {
  const declarations=options.declarations||[];
  const textDeclaration=declarations.find((entry)=>entry.id==='@proto.ui/text-control/declaration');
  const imageDeclaration=declarations.find((entry)=>entry.id==='@proto.ui/image-view/declaration');
  let textDeclared=!!textDeclaration,imageDeclared=!!imageDeclaration,scrollDeclared=false,composing=false,textValue='',imageGeneration=0,hasChrome=false;
  let textPatch={valueMode:'uncontrolled',lineMode:textDeclaration?textDeclaration.config.lineMode:'multiline'},imagePatch=Object.assign({source:'',fit:'contain',a11yMode:'informative'},imageDeclaration?imageDeclaration.config:{}),imageStatus='idle';
  const textListeners=[],imageListeners=[],facts=new Map();
  let scrollConfig={axes:'both',projection:'auto',endFollow:{mode:'off'}};
  let scrollSnapshot={axes:'both',horizontal:{position:0,visibleRatio:1,canScrollBefore:false,canScrollAfter:false,atEnd:true},vertical:{position:0,visibleRatio:1,canScrollBefore:false,canScrollAfter:false,atEnd:true},scrolling:false,projection:'unresolved',endFollow:{state:'off',requestStatus:'idle'}};
  let followRequest='idle',followState='off',wasAtEnd=true;
  function observed(key,initial) {
    let value=initial;const listeners=new Set(),watchers=new Set();
    const handle={get() {options.alive();return value;},spec:{kind:typeof initial==='boolean'?'bool':typeof initial==='number'?'number.range':'string'},watch(cb){options.setup();watchers.add(cb);return ()=>{options.alive();watchers.delete(cb);};},subscribe(cb) {options.alive();listeners.add(cb);return ()=>{options.alive();listeners.delete(cb);};},unsubscribe(off) {options.alive();off();}};
    const update={handle,set(next) {if(Object.is(value,next))return;const prev=value;value=next;options.changed();if(options.active()){const event={type:'next',prev,next,reason:'native-control'};for(const cb of Array.from(listeners))options.invoke(cb,[event],false,'control-facts');for(const cb of Array.from(watchers))options.invoke(cb,[event],true,'state-watch');}},clear() {watchers.clear();let failure;for(const cb of Array.from(listeners))try{cb({type:'disconnect',reason:'unmount'});}catch(error){if(failure===undefined)failure=error;}listeners.clear();if(failure!==undefined)throw failure;}};
    facts.set(key,update);return handle;
  }
  const scroll={axes:observed('axes','both'),scrolling:observed('scrolling',false),projection:observed('projection','unresolved'),horizontal:{},vertical:{},endFollow:{state:observed('followState','off'),requestStatus:observed('followRequest','idle')}};
  for(const axis of ['horizontal','vertical'])for(const key of ['position','visibleRatio','canScrollBefore','canScrollAfter','atEnd'])scroll[axis][key]=observed(axis+'.'+key,scrollSnapshot[axis][key]);
  function normalize(value) {value=String(value).replace(/\\r\\n/g,'\\n').replace(/\\r/g,'\\n');return textPatch.lineMode==='multiline'?value:value.replace(/\\n/g,'');}
  function register(list,type,callback) {
    options.setup();const entry={type,callback,active:true};list.push(entry);
    return ()=>{options.setup();entry.active=false;};
  }
  function notify(list,type,payload) {
    if(!options.ready())return;
    for(const entry of list.slice())if(entry.active&&entry.type===type)options.invoke(entry.callback,[payload],true,'control-event');
  }
  const text={on:(type,callback)=>register(textListeners,type,callback),sync(patch) {
    options.runtime();const first=!Object.prototype.hasOwnProperty.call(textPatch,'initialized');
    if(textPatch.lineMode==='single'&&(patch.rows!==undefined||patch.wrap!==undefined))throw new Error('Single-line TextControl cannot accept rows/wrap');
    const mode=first?patch.valueMode||'uncontrolled':textPatch.valueMode;
    Object.assign(textPatch,patch);textPatch.initialized=true;textPatch.valueMode=mode;
    if(mode==='controlled')textValue=normalize(textPatch.value===undefined?'':textPatch.value);
    else if(first)textValue=normalize(patch.defaultValue===undefined?'':patch.defaultValue);
    const root=options.root();if(root){const projection=Object.assign({},textPatch);if(mode==='controlled'&&composing)delete projection.value;else projection.value=textValue;root.syncText(projection);}
    options.refreshFacts();
  },snapshot() {options.alive();return textDeclared?Object.freeze({value:textValue,composing}):null;}};
  const image={on:(type,callback)=>register(imageListeners,type,callback),sync(patch) {
    options.runtime();if(patch.source!==undefined&&patch.source!==imagePatch.source){++imageGeneration;imageStatus=patch.source?'loading':'idle';}
    Object.assign(imagePatch,patch);if(patch.loadingStatus!==undefined)imageStatus=patch.loadingStatus;
    const root=options.root();if(root)root.syncImage(imagePatch,imageGeneration);
    options.refreshFacts();
  },snapshot() {options.alive();return imageDeclared?Object.freeze({source:imagePatch.source,loadingStatus:imageStatus,fit:imagePatch.fit}):null;}};
  Object.assign(scroll,{configure(patch) {
    options.setup();
    Object.assign(scrollConfig,patch);if(patch.requireProjection)scrollConfig.projection=patch.requireProjection;followState=scrollConfig.endFollow.mode==='off'?'off':'pending';
  },bindComposedChrome(binding) {options.setup();options.bindScrollChrome(binding);hasChrome=true;scrollConfig.projection='composed';},request(request) {
    options.runtime();const root=options.root();
    if(!root){if(request.kind==='to-end'){followRequest='rejected';facts.get('followRequest').set(followRequest);}return;}
    if(request.kind==='to-end'&&scrollConfig.endFollow.mode==='while-at-end'&&request.axis!==scrollConfig.endFollow.axis){followRequest='rejected';facts.get('followRequest').set(followRequest);return;}
    if(request.kind==='to-end'){followRequest='applied';if(scrollConfig.endFollow.mode==='while-at-end')followState='following';}
    root.scrollRequest(request);
  },getSnapshot() {options.alive();return scrollSnapshot;}});
  return {hooks:{asTextControl() {options.setup();if(!textDeclaration)throw new Error('TextControl requires its checked Module declaration');textDeclared=true;return text;},asImageView() {options.setup();if(!imageDeclaration)throw new Error('ImageView requires its checked Module declaration');imageDeclared=true;return image;},asScrollSurface() {options.setup();scrollDeclared=true;return scroll;}},
    mount() {
      const root=options.root();if(!root)return;
      if(textDeclared){textValue=normalize(textValue);root.syncText(Object.assign({},textPatch,{value:textValue}));}
      if(imageDeclared)root.syncImage(imagePatch,imageGeneration);
      if(scrollDeclared){if(scrollConfig.projection==='composed'&&!hasChrome)throw new Error('Composed scroll projection requires authored chrome');root.syncScroll(scrollConfig);}
    },
    textEvent(type,value,data) {
      if(!textDeclared||!options.ready())return;
      if(type==='compositionstart')composing=true;if(type==='compositionend')composing=false;
      const next=normalize(value);
      if(textPatch.valueMode!=='controlled'&&type==='input')textValue=next;
      options.refreshFacts();
      notify(textListeners,type,Object.freeze({type,value:next,composing,data:data===undefined?null:data,inputType:null}));
      const root=options.root();if(root&&textPatch.valueMode==='controlled'&&!composing)root.syncText(Object.assign({},textPatch,{value:textValue}));
    },
    composition(preedit,value) {
      if(!textDeclared||!options.ready())return;
      if(preedit&&!composing){composing=true;this.textEvent('compositionstart',value,preedit);}
      if(preedit)this.textEvent('compositionupdate',value,preedit);
      else if(composing){composing=false;this.textEvent('compositionend',value,null);}
    },
    imageStatus(status,generation) {
      if(!imageDeclared||!options.ready()||generation!==imageGeneration)return;
      const next=status===1?'loaded':status===2?'loading':status===3?'error':'idle';
      if(next===imageStatus)return;const prev=imageStatus;imageStatus=next;
      notify(imageListeners,'loadingStatusChange',Object.freeze({status:next,previousStatus:prev,source:imagePatch.source}));
    },
    scrollFacts(next) {
      if(!scrollDeclared||!options.ready())return;
      const policy=scrollConfig.endFollow;
      if(policy.mode==='while-at-end') {
        const atEnd=next[policy.axis].atEnd;
        if(wasAtEnd&&!atEnd&&!next.scrolling){wasAtEnd=false;const root=options.root();followState='following';if(root){root.scrollRequest({kind:'to-end',axis:policy.axis});return;}}
        else if(next.scrolling&&!atEnd)followState='paused';else if(atEnd)followState='following';
        wasAtEnd=atEnd;
      }
      next.endFollow=Object.freeze({state:followState,requestStatus:followRequest});next.horizontal=Object.freeze(next.horizontal);next.vertical=Object.freeze(next.vertical);scrollSnapshot=Object.freeze(next);
      facts.get('axes').set(next.axes);facts.get('scrolling').set(next.scrolling);facts.get('projection').set(next.projection);
      facts.get('followState').set(followState);facts.get('followRequest').set(followRequest);
      for(const axis of ['horizontal','vertical'])for(const key of ['position','visibleRatio','canScrollBefore','canScrollAfter','atEnd'])facts.get(axis+'.'+key).set(next[axis][key]);
    },
    facts(){
      if(textDeclared)return {role:'textbox',readOnly:!!textPatch.readOnly,disabled:!!textPatch.disabled,value:textValue,multiLine:!!(options.root()&&options.root().multiline)};
      if(imageDeclared)return {role:'img',name:imagePatch.alternativeText||'',accessibleIgnored:imagePatch.a11yMode==='decorative'};
      return {};
    },
    unmount() {++imageGeneration;composing=false;scrollSnapshot=Object.freeze(Object.assign({},scrollSnapshot,{projection:'unresolved',scrolling:false}));facts.get('scrolling').set(false);facts.get('projection').set('unresolved');},
    dispose() {++imageGeneration;textListeners.length=0;imageListeners.length=0;let failure;for(const fact of facts.values())try{fact.clear();}catch(error){if(failure===undefined)failure=error;}if(failure!==undefined)throw failure;}
  };
}
`;
