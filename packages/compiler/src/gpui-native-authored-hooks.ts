/** Captures owner-local artifacts; no authored state machine or source plan is stored. */
export const gpuiNativeAuthoredHooksSource = String.raw`
#[derive(Default)]
struct AuthoredHooks { entries:BTreeMap<String,Rc<RefCell<AuthoredEntry>>>, builtins:BTreeMap<String,(u64,Value)>, kinds:BTreeMap<String,bool>, frames:Vec<AuthoredFrame>, root_names:BTreeSet<String>, state_names:BTreeMap<usize,String>, order:u64 }
struct AuthoredFrame { id:u64, names:BTreeSet<String>, states:BTreeMap<String,Value>, methods:BTreeMap<String,Value>, children:Vec<Value>, effects:BTreeMap<String,Vec<Value>>, disposers:BTreeMap<String,Vec<Value>>, event_keys:BTreeMap<String,Value> }
struct AuthoredEntry { order:u64, mode:&'static str, api:Value, result:Value, handle:Value, handle_set:bool }
struct CaptureGuard { owner:OwnerWeak, open:bool }
impl Drop for CaptureGuard { fn drop(&mut self){if self.open{if let Some(owner)=self.owner.upgrade(){owner.borrow_mut().authored.frames.pop();}}} }
fn claim_state_name(owner:&OwnerRef,name:&str)->String {
    let mut owner=owner.borrow_mut();let authored=&mut owner.authored;
    let (names,id)=if let Some(frame)=authored.frames.last_mut(){(&mut frame.names,Some(frame.id))}else{(&mut authored.root_names,None)};
    if name.is_empty(){value_error("[State] state name must be a non-empty string.")}
    if !names.insert(name.into()){value_error(&format!("[State] duplicate state name in setup frame: {name}"))}
    id.map(|id|format!("hook:{id}:{name}")).unwrap_or_else(||name.into())
}
fn capture_state(owner:&OwnerRef,name:String,state:Rc<State>){
    let mut owner=owner.borrow_mut();owner.authored.state_names.insert(Rc::as_ptr(&state)as usize,name.clone());
    if let Some(frame)=owner.authored.frames.last_mut(){frame.states.insert(name,Value::BorrowedState(state));}
}
pub fn capture_introduced_state(owner:&OwnerWeak,state:Value){
    let owner=setup(owner);let mut owner=owner.borrow_mut();
    let projected=match &state{
        Value::State(state)|Value::BorrowedState(state)=>owner.authored.state_names.get(&(Rc::as_ptr(state)as usize)).cloned().map(|name|(name,Value::BorrowedState(state.clone()))),
        Value::Observed(_,"focus.focused")=>Some(("focused".into(),state.clone())),
        Value::Observed(_,"focus.visible")=>Some(("focusVisible".into(),state.clone())),
        Value::Observed(_,"focus.ready")=>Some(("focusable".into(),state.clone())),
        _=>None,
    };
    if let (Some((name,state)),Some(frame))=(projected,owner.authored.frames.last_mut()){frame.states.insert(name,state);}
}
// These functions store receipts of already executed checked setup operations.
// Bucket values remain opaque; no operation or behavior is interpreted here.
pub fn capture_effect(owner:&OwnerWeak,bucket:&str,value:Value){
    let owner=setup(owner);if let Some(frame)=owner.borrow_mut().authored.frames.last_mut(){frame.effects.entry(bucket.into()).or_default().push(value);};
}
pub fn capture_disposer(owner:&OwnerWeak,group:&str,value:Value){
    let owner=setup(owner);if let Some(frame)=owner.borrow_mut().authored.frames.last_mut(){frame.disposers.entry(group.into()).or_default().push(value);};
}
pub fn capture_event_key(owner:&OwnerWeak,key:Value){
    let owner=setup(owner);if let Some(frame)=owner.borrow_mut().authored.frames.last_mut(){frame.event_keys.insert(key.text(),key);};
}
pub fn capture_rule(owner:&OwnerWeak,handle:Value)->Value{
    let target=owner.clone();let captured=handle.clone();
    let off=Value::Function(Rc::new(move |_|rule_dispose(&target,captured.clone())));
    capture_effect(owner,"context",record(vec![("op",Value::string("rule")),("handle",handle.clone()),("off",off.clone())]));
    capture_disposer(owner,"rule",off);handle
}
fn capture_method(owner:&OwnerRef,name:String,method:Value){if let Some(frame)=owner.borrow_mut().authored.frames.last_mut(){frame.methods.insert(name,method);}}
fn record_hook_child(owner:&OwnerRef,name:&str,mode:&str,order:u64,privileged:bool,result:Value,handle:Value){
    if let Some(frame)=owner.borrow_mut().authored.frames.last_mut(){frame.children.push(freeze(record(vec![
        ("name",Value::string(name)),("order",Value::number(order as f64)),("privileged",Value::boolean(privileged)),
        ("mode",Value::string(mode)),("result",result),("handle",handle),
    ])));}
}
fn record_authored_child(owner:&OwnerRef,name:&str,mode:&str,entry:&AuthoredEntry)->Value{
    // A pending or failed first registration still owns the name. Core returns
    // a fresh truthy empty record while no result exists; it never retries the
    // losing installer. A projector that explicitly returned undefined is set.
    let result=if entry.result.nullish(){record(vec![])}else{entry.result.clone()};
    let handle=if entry.handle_set{entry.handle.clone()}else{result.clone()};
    record_hook_child(owner,name,mode,entry.order,false,result,handle.clone());handle
}
fn register_hook_kind(owner:&OwnerRef,name:&str,privileged:bool){
    let mut owner=owner.borrow_mut();
    if owner.authored.kinds.get(name).is_some_and(|previous|*previous!=privileged){throw_error("HOOK_KIND_CONFLICT","privileged and authored hooks cannot share a registration name")}
    owner.authored.kinds.insert(name.into(),privileged);
}
// Core's privileged wrapper records the facade result itself as both raw result
// and handle; it does not begin an authored effect-capture frame. Every reuse is
// still a child record and shares the owner's registration-order sequence.
pub fn native_builtin_hook(owner:&OwnerWeak,name:&str,install:impl FnOnce()->Value)->Value{
    let owner_ref=setup(owner);register_hook_kind(&owner_ref,name,true);
    let previous=owner_ref.borrow().authored.builtins.get(name).cloned();
    let (order,result)=if let Some(previous)=previous{previous}else{
        let order={let mut owner=owner_ref.borrow_mut();let order=owner.authored.order;owner.authored.order+=1;order};
        let result=install();owner_ref.borrow_mut().authored.builtins.insert(name.into(),(order,result.clone()));(order,result)
    };
    record_hook_child(&owner_ref,name,"once",order,true,result.clone(),result.clone());result
}
fn finish_capture(owner:&OwnerWeak,frame:AuthoredFrame,render:Value)->Value {
    let mut fields=BTreeMap::new();let mut artifacts=BTreeMap::new();
    for (bucket,mut effects) in frame.effects { let value=if effects.len()==1{effects.pop().unwrap()}else{Value::Array(Rc::new(effects))};fields.insert(bucket,value); }
    if !frame.states.is_empty(){
        let states=freeze(record_map(frame.states));fields.insert("stateHandles".into(),states.clone());artifacts.insert("stateHandles".into(),states.clone());
        fields.insert("getState".into(),Value::Function(Rc::new(move|args|states.member(&arg(&args,0).text(),false))));
    }
    if !frame.methods.is_empty(){
        let methods=freeze(record_map(frame.methods));fields.insert("methods".into(),methods.clone());artifacts.insert("methods".into(),methods.clone());
        fields.insert("getMethod".into(),Value::Function(Rc::new(move|args|methods.member(&arg(&args,0).text(),false))));
    }
    if !frame.children.is_empty(){
        let children=Rc::new(frame.children);let raw=children.clone();let array=Value::Array(children.clone());
        fields.insert("asHooks".into(),array.clone());artifacts.insert("asHooks".into(),array);
        fields.insert("getAsHook".into(),Value::Function(Rc::new(move|args|{let name=arg(&args,0);raw.iter().find(|child|strict_equal(&child.member("name",false),&name)).cloned().unwrap_or_default()})));
        fields.insert("getAsHookHandle".into(),Value::Function(Rc::new(move|args|{let name=arg(&args,0);children.iter().find(|child|strict_equal(&child.member("name",false),&name)).map(|child|child.member("handle",false)).unwrap_or_default()})));
    }
    if !frame.event_keys.is_empty(){artifacts.insert("eventKeys".into(),freeze(record_map(frame.event_keys)));}
    if !artifacts.is_empty(){fields.insert("artifacts".into(),freeze(record_map(artifacts)));}
    let mut groups=BTreeMap::new();let mut all=Vec::new();let mut disposers=frame.disposers;
    for group in ["props","context","rule","event","feedback"] {
        let Some(source)=disposers.remove(group) else{continue};if source.is_empty(){continue}
        let wrapped:Vec<Value>=source.into_iter().map(|off|{
            let owner=owner.clone();Value::Function(Rc::new(move |_|{setup(&owner);off.call_authored(vec![]);Value::Undefined}))
        }).collect();
        all.extend(wrapped.iter().cloned());groups.insert(group.into(),Value::Array(Rc::new(wrapped)));
    }
    if !all.is_empty(){groups.insert("all".into(),Value::Array(Rc::new(all)));fields.insert("disposers".into(),freeze(record_map(groups)));}
    if matches!(render,Value::Function(_)|Value::NativeFunction{..}|Value::Renderer(_)){fields.insert("render".into(),render);}
    freeze(record_map(fields))
}
pub fn authored_hook(owner:&OwnerWeak,name:&str,mode:&'static str,input:Value,install:Value,project:Value,configure:Value)->Value {
    let owner_ref=setup(owner);
    register_hook_kind(&owner_ref,name,false);
    let previous=if mode=="multiple"{None}else{owner_ref.borrow().authored.entries.get(name).cloned()};
    let warning_name=name.to_owned();let conflict_name=name.to_owned();
    let tools=freeze(record(vec![
        ("warn",Value::Function(Rc::new(move|args|{eprintln!("[Hook:{}] {}",warning_name,arg(&args,0).scalar_text());Value::Undefined}))),
        ("conflict",Value::Function(Rc::new(move|args|throw_error("HOOK_CONFLICT",&format!("[Hook:{}] {}",conflict_name,arg(&args,0).scalar_text()))))),
    ]));
    if let Some(previous)=previous{
        let (previous_mode,api)={let entry=previous.borrow();(entry.mode,entry.api.clone())};
        if previous_mode!="once"&&mode!="once"&&!configure.nullish(){configure.call_authored(vec![api,input,tools]);}
        return record_authored_child(&owner_ref,name,mode,&previous.borrow())
    }
    let order={let mut owner=owner_ref.borrow_mut();let order=owner.authored.order;owner.authored.order+=1;order};
    let api=freeze(record(vec![("name",Value::string(name)),("order",Value::number(order as f64)),("store",record(vec![]))]));
    let entry=Rc::new(RefCell::new(AuthoredEntry{order,mode,api:api.clone(),result:Value::Undefined,handle:Value::Undefined,handle_set:false}));
    {let mut owner=owner_ref.borrow_mut();if mode!="multiple"{owner.authored.entries.insert(name.into(),entry.clone());}
     owner.authored.frames.push(AuthoredFrame{id:order,names:BTreeSet::new(),states:BTreeMap::new(),methods:BTreeMap::new(),children:Vec::new(),effects:BTreeMap::new(),disposers:BTreeMap::new(),event_keys:BTreeMap::new()});}
    let mut guard=CaptureGuard{owner:owner.clone(),open:true};
    let render=install.call_authored(vec![definition_capability(owner),input.clone(),api.clone()]);
    let frame=owner_ref.borrow_mut().authored.frames.pop().expect("capture frame");guard.open=false;
    let result=finish_capture(owner,frame,render);
    // Capture succeeded even if projection subsequently throws. Preserve that
    // raw result for the already-owned registration, as the Core wrapper does.
    entry.borrow_mut().result=result.clone();
    let handle=if project.nullish(){result.clone()}else{project.call_authored(vec![result.clone()])};
    {let mut entry=entry.borrow_mut();entry.handle=handle.clone();entry.handle_set=true;}
    record_authored_child(&owner_ref,name,mode,&entry.borrow());
    if mode=="configurable"&&!configure.nullish(){configure.call_authored(vec![api,input,tools]);}
    handle
}
// Only outward callable trees enter callback scope. Raw capture getters retain
// authored setup methods. Weak owner-local projections preserve public aliases
// without retaining every temporary returned object for the owner's lifetime.
type WeakPublicCallback=Weak<dyn Fn(Vec<Value>)->Value>;
#[derive(Default)]
struct PublicValues {
    next_receiver:u64,
    records:BTreeMap<usize,(Weak<NativeRecord>,Weak<NativeRecord>,u64)>,
    arrays:BTreeMap<usize,(Weak<Vec<Value>>,Weak<Vec<Value>>,u64)>,
    functions:BTreeMap<(u64,usize),(WeakPublicCallback,WeakPublicCallback)>,
    projected_records:BTreeMap<usize,(Weak<NativeRecord>,u64)>,
    projected_arrays:BTreeMap<usize,(Weak<Vec<Value>>,u64)>,
    projected_functions:BTreeMap<usize,WeakPublicCallback>,
}
fn needs_public_projection(value:&Value,seen:&mut BTreeSet<usize>)->bool{match value{
    Value::Function(_)|Value::Renderer(_)=>true,
    Value::Record(record)=>seen.insert(Rc::as_ptr(record)as usize)&&record.fields.borrow().values().any(|value|needs_public_projection(value,seen)),
    Value::Array(items)=>seen.insert(Rc::as_ptr(items)as usize)&&items.iter().any(|value|needs_public_projection(value,seen)),
    _=>false,
}}
fn outward_value(owner:&OwnerWeak,value:Value)->Value {
    fn project(owner:&OwnerWeak,value:Value,receiver:u64,projecting:&mut BTreeSet<usize>)->Value {match value{
        Value::Renderer(adapter)=>{
            // Re-exposing a public renderer through its owner is an identity
            // operation. Other owners retain both sets of lifetime guards.
            ensure(owner);
            if adapter.public_owner.as_ref().is_some_and(|known|Weak::ptr_eq(known,owner)){return Value::Renderer(adapter)}
            let callable=project(owner,adapter.callable.clone(),receiver,projecting);
            let weak=owner.clone();let render=adapter.render.clone();
            let render:NativeRenderer=Rc::new(move|args|{let owner=ensure(&weak);invoke_scoped(&owner,"render",||render(args))});
            Value::Renderer(Rc::new(RendererAdapter{callable,render,public_owner:Some(owner.clone())}))
        },
        Value::Function(callback)=>{
            let id=Rc::as_ptr(&callback)as *const ()as usize;let owner_ref=ensure(owner);
            // Echoing an already public value through the same owner is an
            // identity operation. Keep the original lifetime/phase guard.
            if owner_ref.borrow().public_values.projected_functions.get(&id).and_then(Weak::upgrade).is_some_and(|known|Rc::ptr_eq(&known,&callback)){return Value::Function(callback)}
            if let Some(result)=owner_ref.borrow().public_values.functions.get(&(receiver,id)).and_then(|(_,value)|value.upgrade()){return Value::Function(result)}
            let weak=owner.clone();let raw=callback.clone();
            let wrapped:Callback=Rc::new(move|args|{let owner=ensure(&weak);let result=invoke(&owner,"expose-method",&Value::Function(raw.clone()),args);outward_value(&weak,result)});
            let mut owner=owner_ref.borrow_mut();let values=&mut owner.public_values;
            values.functions.retain(|_,(_,value)|value.strong_count()>0);
            values.projected_functions.retain(|_,value|value.strong_count()>0);
            values.projected_functions.insert(Rc::as_ptr(&wrapped)as *const ()as usize,Rc::downgrade(&wrapped));
            values.functions.insert((receiver,id),(Rc::downgrade(&callback),Rc::downgrade(&wrapped)));Value::Function(wrapped)
        },
        Value::Record(record)=>{
            let id=Rc::as_ptr(&record)as usize;let owner_ref=ensure(owner);
            let projected=owner_ref.borrow().public_values.projected_records.get(&id).filter(|(known,_)|known.upgrade().is_some_and(|known|Rc::ptr_eq(&known,&record))).cloned();
            let(result,receiver)=if let Some((_,receiver))=projected{(record.clone(),receiver)}else{
                let previous=owner_ref.borrow().public_values.records.get(&id).filter(|(source,_,_)|source.upgrade().is_some_and(|source|Rc::ptr_eq(&source,&record))).cloned();
                let result=previous.as_ref().and_then(|(_,value,_)|value.upgrade()).unwrap_or_else(||{let Value::Record(result)=record_map(BTreeMap::new())else{unreachable!()};result});
                let mut owner=owner_ref.borrow_mut();let values=&mut owner.public_values;
                let receiver=previous.map(|(_,_,id)|id).unwrap_or_else(||{values.next_receiver+=1;values.next_receiver});
                values.records.retain(|_,(source,value,_)|source.strong_count()>0||value.strong_count()>0);
                values.projected_records.retain(|_,(value,_)|value.strong_count()>0);
                values.projected_records.insert(Rc::as_ptr(&result)as usize,(Rc::downgrade(&result),receiver));
                values.records.insert(id,(Rc::downgrade(&record),Rc::downgrade(&result),receiver));(result,receiver)
            };
            if !projecting.insert(id){return Value::Record(result)}
            // A projected record stays the same object, but authored code may
            // have replaced a callable field since its previous public return.
            // Visit current fields in place; already guarded callables retain
            // identity while newly installed closures acquire this owner guard.
            let fields=record.fields.borrow().clone();let mut refreshed=BTreeMap::new();
            for(key,value)in fields{let value=if needs_public_projection(&value,&mut BTreeSet::new()){project(owner,value,receiver,projecting)}else{value};refreshed.insert(key,value);}
            *result.fields.borrow_mut()=refreshed;projecting.remove(&id);Value::Record(result)
        },
        Value::Array(items)=>{
            let id=Rc::as_ptr(&items)as usize;let owner_ref=ensure(owner);
            let projected=owner_ref.borrow().public_values.projected_arrays.get(&id).filter(|(known,_)|known.upgrade().is_some_and(|known|Rc::ptr_eq(&known,&items))).cloned();
            if let Some((_,receiver))=projected{
                if !projecting.insert(id){return Value::Array(items)}
                for value in items.iter(){if needs_public_projection(value,&mut BTreeSet::new()){project(owner,value.clone(),receiver,projecting);}}
                projecting.remove(&id);return Value::Array(items)
            }
            let previous=owner_ref.borrow().public_values.arrays.get(&id).filter(|(source,_,_)|source.upgrade().is_some_and(|source|Rc::ptr_eq(&source,&items))).cloned();
            let receiver={let mut owner=owner_ref.borrow_mut();previous.as_ref().map(|(_,_,id)|*id).unwrap_or_else(||{owner.public_values.next_receiver+=1;owner.public_values.next_receiver})};
            if let Some(result)=previous.as_ref().and_then(|(_,value,_)|value.upgrade()){
                if !projecting.insert(id){return Value::Array(result)}
                for value in items.iter(){if needs_public_projection(value,&mut BTreeSet::new()){project(owner,value.clone(),receiver,projecting);}}
                projecting.remove(&id);return Value::Array(result)
            }
            let result:Rc<Vec<Value>>=Rc::new(items.iter().map(|value|if needs_public_projection(value,&mut BTreeSet::new()){project(owner,value.clone(),receiver,projecting)}else{value.clone()}).collect());
            let mut owner=owner_ref.borrow_mut();owner.public_values.arrays.retain(|_,(source,value,_)|source.strong_count()>0||value.strong_count()>0);
            owner.public_values.projected_arrays.retain(|_,(value,_)|value.strong_count()>0);
            owner.public_values.projected_arrays.insert(Rc::as_ptr(&result)as usize,(Rc::downgrade(&result),receiver));
            owner.public_values.arrays.insert(id,(Rc::downgrade(&items),Rc::downgrade(&result),receiver));Value::Array(result)
        },
        other=>other,
    }}
    if needs_public_projection(&value,&mut BTreeSet::new()){project(owner,value,0,&mut BTreeSet::new())}else{value}
}
fn finish_public_exposes(owner:&OwnerRef){
    let raw=std::mem::take(&mut owner.borrow_mut().exposes);let weak=Rc::downgrade(owner);
    let wrapped=raw.into_iter().map(|(key,value)|(key,outward_value(&weak,value))).collect();owner.borrow_mut().exposes=wrapped;
}

#[cfg(all(test,feature="test-support"))]
mod authored_renderer_identity_tests {
    use super::*;
    fn owner()->OwnerRef {
        Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary())
    }
    fn text_renderer(callback:Value)->Value {
        let original=callback.clone();
        capture_renderer(callback,Rc::new(move|arguments|NativeSnapshot::text_value(original.call_authored(arguments))))
    }
    fn capture(owner:&OwnerRef,callback:Value)->Value {
        let install=Value::Function(Rc::new(move|_|text_renderer(callback.clone())));
        authored_hook(&Rc::downgrade(owner),"identity-content","once",Value::Undefined,install,Value::Undefined,Value::Undefined)
    }

    #[test]
    fn captured_scalar_renderer_keeps_identity_and_direct_invocation() {
        let owner=owner();let calls=Rc::new(Cell::new(0));let observed=calls.clone();
        let original=Value::Function(Rc::new(move|_|{observed.set(observed.get()+1);Value::string("captured text")}));
        let captured=capture(&owner,original.clone());let render=captured.member("render",false);
        assert!(strict_equal(&render,&original));assert!(strict_equal(&original,&render));
        assert!(strict_equal(&render,&captured.member("render",false)));
        assert!(!strict_equal(&render,&Value::Function(Rc::new(|_|Value::string("captured text")))));
        assert_eq!(render.call(vec![]).unwrap().text(),"captured text");
        assert_eq!(typeof_value(&render).text(),"function");assert!(render.is_callback());
        assert!(render.truthy());assert!(!render.nullish());assert!(render.try_data().is_none());
        assert_eq!(calls.get(),1,"capture does not eagerly execute the callable");
        Owner::finish(&owner,render);Owner::project(&owner);
        assert_eq!((owner.borrow().projection.as_ref().unwrap().text)(&[]),"captured text");
        assert_eq!(calls.get(),2);Owner::project(&owner);assert_eq!(calls.get(),2);
        Owner::dispose(&owner);
    }

    #[test]
    fn public_renderer_aliases_keep_guards_and_scalar_call_behavior() {
        let owner=owner();let weak=Rc::downgrade(&owner);let observed=weak.clone();
        let original=Value::Function(Rc::new(move|_|Value::string(observed.upgrade().unwrap().borrow().phase)));
        let captured=capture(&owner,original.clone());let render=captured.member("render",false);
        expose_value(&weak,Value::string("api"),record(vec![("render",render.clone()),("original",original)]));
        Owner::finish(&owner,render);
        let api=owner.borrow().exposes["api"].clone();let public=api.member("render",false);
        assert!(strict_equal(&public,&api.member("original",false)),"same receiver aliases share one public callback");
        assert_eq!(public.call(vec![]).unwrap().text(),"expose-method");
        assert_eq!(owner.borrow().phase,"idle");
        let echoed=outward_value(&weak,api.clone());assert!(strict_equal(&api,&echoed));
        assert!(strict_equal(&public,&echoed.member("render",false)));
        let Value::Renderer(adapter)=&public else{panic!("public renderer loses checked rendering")};
        for _ in 0..4 {
            let Value::Renderer(echoed)=outward_value(&weak,public.clone()) else{panic!("public renderer changed kind")};
            assert!(Rc::ptr_eq(adapter,&echoed),"public echo must not accumulate guard closures");
        }
        assert_eq!(((adapter.render)(vec![]).text)(&[]),"render");
        assert_eq!(owner.borrow().phase,"idle");
        Owner::dispose(&owner);
        let error=public.call(vec![]).unwrap_err();assert_eq!(error.member("code",false).text(),"OWNER_DISPOSED");
        let error=catch_authored(||(adapter.render)(vec![])).err().expect("retired public render must reject");
        assert_eq!(error.member("code",false).text(),"OWNER_DISPOSED");
    }

    #[test]
    fn captured_native_renderer_retains_its_original_callable_identity() {
        let native:NativeCallable<dyn Fn()->NativeSnapshot>=NativeCallable{identity:Rc::new(()),call:Rc::new(NativeSnapshot::empty)};
        let render:NativeRenderer=Rc::new(|_|NativeSnapshot::empty());
        let original=Value::NativeFunction{identity:native.identity.clone(),render:render.clone()};
        let captured=capture_renderer(original.clone(),render);
        assert!(strict_equal(&original,&captured));assert!(strict_equal(&captured,&captured));
        assert!(native.equals_value(&captured));assert_eq!(typeof_value(&captured).text(),"function");
        let other=Value::NativeFunction{identity:Rc::new(()),render:Rc::new(|_|NativeSnapshot::empty())};
        assert!(!strict_equal(&captured,&other));
    }
}
#[cfg(all(test,feature="test-support"))]
mod authored_capture_facade_tests {
    use super::*;
    fn owner()->OwnerRef {
        Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary())
    }
    fn hook(owner:&OwnerWeak,name:&str,install:Value,project:Value)->Value {
        authored_hook(owner,name,"once",Value::Undefined,install,project,Value::Undefined)
    }
    #[test]
    fn capture_facade_preserves_shared_artifacts_raw_children_and_projected_handles() {
        let owner=owner();let weak=Rc::downgrade(&owner);let target=weak.clone();
        let read=Value::Function(Rc::new(|_|Value::string("seed")));let method=read.clone();
        let render=Value::Function(Rc::new(|_|Value::string("text")));let render_child=render.clone();
        let child=Value::Function(Rc::new(move |_|{
            let state=create_state(&target,"string",Value::string("text"),Value::string("seed"),record(vec![]));
            capture_effect(&target,"state",state.clone());
            expose_method(&target,Value::string("read"),method.clone());
            capture_effect(&target,"context",record(vec![("op",Value::string("expose.method")),("key",Value::string("read")),("fn",method.clone())]));
            expose_event(&target,Value::string("changed"));capture_event_key(&target,Value::string("changed"));
            capture_effect(&target,"event",record(vec![("op",Value::string("expose.event")),("key",Value::string("changed"))]));
            render_child.clone()
        }));
        let projected=Value::Function(Rc::new(|args|{let raw=arg(&args,0);let mut fields=own_entries(raw);fields.insert("projected".into(),Value::boolean(true));freeze(record_map(fields))}));
        let target=weak.clone();let raw_slot=Rc::new(RefCell::new(Value::Undefined));let raw_observed=raw_slot.clone();
        let outer=Value::Function(Rc::new(move |_|{
            let first=hook(&target,"child",child.clone(),projected.clone());
            let again=hook(&target,"child",child.clone(),projected.clone());assert!(strict_equal(&first,&again));
            *raw_observed.borrow_mut()=first;Value::Undefined
        }));
        let capture=hook(&weak,"outer",outer,Value::Undefined);let child=raw_slot.borrow().clone();
        let descriptor=capture.member("getAsHook",false).call_authored(vec![Value::string("child")]);
        let raw=descriptor.member("result",false);let handle=descriptor.member("handle",false);
        assert!(strict_equal(&handle,&child));assert!(!strict_equal(&raw,&handle));
        assert!(strict_equal(&descriptor,&capture.member("getAsHook",false).call_authored(vec![Value::string("child")])));
        assert!(strict_equal(&handle,&capture.member("getAsHookHandle",false).call_authored(vec![Value::string("child")])));
        assert!(capture.member("stateHandles",false).nullish(),"nested state is not flattened");
        assert_eq!(capture.member("asHooks",false).items().len(),2);
        assert!(strict_equal(&capture.member("asHooks",false),&capture.member("artifacts",false).member("asHooks",false)));
        let states=raw.member("stateHandles",false);let methods=raw.member("methods",false);let artifacts=raw.member("artifacts",false);
        assert!(strict_equal(&states,&artifacts.member("stateHandles",false)));
        assert!(strict_equal(&methods,&artifacts.member("methods",false)));
        assert!(strict_equal(&methods.member("read",false),&read));
        assert!(strict_equal(&read,&raw.member("getMethod",false).call_authored(vec![Value::string("read")])));
        assert!(strict_equal(&states.member("text",false),&raw.member("getState",false).call_authored(vec![Value::string("text")])));
        assert!(matches!(states.member("text",false),Value::BorrowedState(_)));
        assert!(strict_equal(&child.member("getState",false),&raw.member("getState",false)));
        assert!(strict_equal(&child.member("getMethod",false),&raw.member("getMethod",false)),"projectHandle forwards the original captured getter");
        assert!(strict_equal(&child.member("render",false),&render));
        assert_eq!(artifacts.member("eventKeys",false).member("changed",false).text(),"changed");
        assert_eq!(raw.member("getMethod",false).call_authored(vec![Value::string("read")]).call_authored(vec![]).text(),"seed");
        assert!(raw.try_data().is_none(),"capabilities must never become portable JSON");
        expose_value(&weak,Value::string("facade"),capture);Owner::finish(&owner,Value::Undefined);
        let public=owner.borrow().exposes["facade"].clone();let public_child=public.member("getAsHook",false).call(vec![Value::string("child")]).unwrap();
        assert!(strict_equal(&public_child,&public.member("asHooks",false).items()[0]),"getter lookup returns the same public child record");
        let projected_public=public_child.member("handle",false);let raw_public=public_child.member("result",false);
        // Public callbacks preserve their original receiver. The raw result and
        // custom handle are separate receivers, while capture above retains
        // the original getter identity before this outward guard boundary.
        let projected_getter=projected_public.member("getMethod",false);
        let raw_getter=raw_public.member("getMethod",false);
        let again=public.member("getAsHook",false).call(vec![Value::string("child")]).unwrap();
        assert!(strict_equal(&projected_public,&again.member("handle",false)));
        assert!(strict_equal(&raw_public,&again.member("result",false)));
        assert!(strict_equal(&projected_getter,&again.member("handle",false).member("getMethod",false)),"same projected receiver keeps its public getter");
        assert!(strict_equal(&raw_getter,&again.member("result",false).member("getMethod",false)),"same raw receiver keeps its public getter");
        let projected_read=projected_getter.call(vec![Value::string("read")]).unwrap();
        let raw_read=raw_getter.call(vec![Value::string("read")]).unwrap();
        assert!(strict_equal(&projected_read,&raw_read),"both getters return the same live public method");
        assert_eq!(projected_read.call(vec![]).unwrap().text(),"seed");
        assert_eq!(raw_read.call(vec![]).unwrap().text(),"seed");
        Owner::dispose(&owner);
        assert!(public.member("getAsHook",false).call(vec![Value::string("child")]).is_err());
        for getter in [projected_getter,raw_getter] {
            let error=getter.call(vec![Value::string("read")]).unwrap_err();
            assert_eq!(error.member("code",false).text(),"OWNER_DISPOSED");
        }
        for method in [projected_read,raw_read] {
            let error=method.call(vec![]).unwrap_err();
            assert_eq!(error.member("code",false).text(),"OWNER_DISPOSED");
        }
    }
    #[test]
    fn capture_disposers_release_real_registrations_only_during_setup() {
        let owner=owner();let weak=Rc::downgrade(&owner);let target=weak.clone();
        let install=Value::Function(Rc::new(move |_|{
            let off=watch_props(&target,None,false,Value::Function(Rc::new(|_|Value::Undefined)));
            capture_effect(&target,"props",record(vec![("op",Value::string("watchAll")),("off",off.clone())]));
            capture_disposer(&target,"props",off);Value::Undefined
        }));
        let capture=hook(&weak,"watcher",install,Value::Undefined);
        let disposers=capture.member("disposers",false);let off=disposers.member("all",false).items()[0].clone();
        assert!(strict_equal(&off,&disposers.member("props",false).items()[0]));
        assert!(owner.borrow().watchers[0].active.get());off.call_authored(vec![]);assert!(!owner.borrow().watchers[0].active.get());
        Owner::finish(&owner,Value::Undefined);
        assert!(off.call(vec![]).is_err(),"captured disposer is setup-only");
        Owner::dispose(&owner);assert!(off.call(vec![]).is_err());
    }
    #[test]
    fn empty_capture_omits_absent_public_fields() {
        let owner=owner();let weak=Rc::downgrade(&owner);
        let capture=hook(&weak,"empty",Value::Function(Rc::new(|_|Value::Undefined)),Value::Undefined);
        for key in ["props","state","context","event","feedback","stateHandles","methods","asHooks","artifacts","disposers","render","getState","getMethod","getAsHook","getAsHookHandle"] {
            assert!(!has_own(&capture,&Value::string(key)).bool(),"unexpected empty field: {key}");
        }
        Owner::dispose(&owner);
    }
}

`;
