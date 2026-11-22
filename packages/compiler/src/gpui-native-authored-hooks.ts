/** Captures owner-local artifacts; no authored state machine or source plan is stored. */
export const gpuiNativeAuthoredHooksSource = String.raw`
#[derive(Default)]
struct AuthoredHooks { entries:BTreeMap<String,Rc<RefCell<AuthoredEntry>>>, builtins:BTreeMap<String,(u64,Value)>, kinds:BTreeMap<String,bool>, frames:Vec<AuthoredFrame>, root_names:BTreeSet<String>, order:u64 }
struct AuthoredFrame { id:u64, names:BTreeSet<String>, states:BTreeMap<String,Value>, methods:BTreeMap<String,Value>, children:Vec<Value> }
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
fn capture_state(owner:&OwnerRef,name:String,state:Rc<State>){if let Some(frame)=owner.borrow_mut().authored.frames.last_mut(){frame.states.insert(name,Value::BorrowedState(state));}}
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
fn finish_capture(frame:AuthoredFrame,render:Value)->Value {
    let mut fields=BTreeMap::new();
    if !frame.states.is_empty(){let states=freeze(record_map(frame.states));fields.insert("stateHandles".into(),states.clone());fields.insert("getState".into(),Value::Function(Rc::new(move|args|states.member(&arg(&args,0).text(),false))));}
    if !frame.methods.is_empty(){let methods=frame.methods;fields.insert("getMethod".into(),Value::Function(Rc::new(move|args|methods.get(&arg(&args,0).text()).cloned().unwrap_or_default())));}
    if !frame.children.is_empty(){
        let children=Rc::new(frame.children);let raw=children.clone();
        fields.insert("getAsHook".into(),Value::Function(Rc::new(move|args|{let name=arg(&args,0);raw.iter().find(|child|strict_equal(&child.member("name",false),&name)).cloned().unwrap_or_default()})));
        fields.insert("getAsHookHandle".into(),Value::Function(Rc::new(move|args|{let name=arg(&args,0);children.iter().find(|child|strict_equal(&child.member("name",false),&name)).map(|child|child.member("handle",false)).unwrap_or_default()})));
    }
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
     owner.authored.frames.push(AuthoredFrame{id:order,names:BTreeSet::new(),states:BTreeMap::new(),methods:BTreeMap::new(),children:Vec::new()});}
    let mut guard=CaptureGuard{owner:owner.clone(),open:true};
    let render=install.call_authored(vec![definition_capability(owner),input.clone(),api.clone()]);
    let frame=owner_ref.borrow_mut().authored.frames.pop().expect("capture frame");guard.open=false;
    let result=finish_capture(frame,render);
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
    Value::Function(_)=>true,
    Value::Record(record)=>seen.insert(Rc::as_ptr(record)as usize)&&record.fields.borrow().values().any(|value|needs_public_projection(value,seen)),
    Value::Array(items)=>seen.insert(Rc::as_ptr(items)as usize)&&items.iter().any(|value|needs_public_projection(value,seen)),
    _=>false,
}}
fn outward_value(owner:&OwnerWeak,value:Value)->Value {
    fn project(owner:&OwnerWeak,value:Value,receiver:u64,projecting:&mut BTreeSet<usize>)->Value {match value{
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
`;
