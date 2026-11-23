/** Native scheduling, preference snapshots and nominal presence ownership only. */
export const gpuiNativeAsyncSource = String.raw`
#[derive(Default)]
struct NativeHostAtoms {
    scheduler_enabled:bool,metadata_enabled:bool,
    app:Option<gpui::AsyncApp>,window:Option<gpui::AnyWindowHandle>,meta:BTreeMap<String,Value>,
    delays:Vec<Rc<NativeDelay>>,presence:Vec<Rc<RefCell<NativePresence>>>,
}
struct NativeDelay { active:Cell<bool>, callback:RefCell<Option<Value>>, task:RefCell<Option<gpui::Task<()>>> }
struct NativePresence { reference:Value,writer:Value,frame:Value,binding:Value,pending:Value,callback:Value }
pub fn configure_native_atoms(owner:&OwnerRef,scheduler:bool,metadata:bool){let mut owner=owner.borrow_mut();owner.atoms.scheduler_enabled=scheduler;owner.atoms.metadata_enabled=metadata;}
pub fn refresh_native_atoms(owner:&OwnerRef,window:&Window,cx:&App){
    let mut owner=owner.borrow_mut();let atoms=&mut owner.atoms;
    if atoms.scheduler_enabled{atoms.app=Some(cx.to_async());atoms.window=Some(window.window_handle());}
    if !atoms.metadata_enabled{return}
    let motion=Value::string(if cx.reduce_motion(){"reduce"}else{"no-preference"});
    atoms.meta.insert("reducedMotion".into(),motion.clone());atoms.meta.insert("preference.reducedMotion".into(),motion);
    atoms.meta.insert("colorScheme".into(),Value::string(match window.appearance(){gpui::WindowAppearance::Dark|gpui::WindowAppearance::VibrantDark=>"dark",_=>"light"}));
    atoms.meta.insert("viewport.width".into(),Value::number(f32::from(window.viewport_size().width)as f64));
}
pub fn native_meta_get(owner:&OwnerWeak,key:Value)->Value {
    let owner=ensure(owner);let key=key.text();let owner=owner.borrow();owner.atoms.meta.get(&key).cloned().unwrap_or_else(||{
        if key.starts_with("preference.")||key.starts_with("styleSupport.")||key=="viewport.width"{Value::string("unknown")}else{Value::Undefined}
    })
}
fn cancel_delay(delay:&NativeDelay){delay.active.set(false);delay.callback.borrow_mut().take();delay.task.borrow_mut().take();}
pub fn schedule_delay(owner:&OwnerWeak,duration:Value,callback:Value)->Value {
    let owner_ref=runtime(owner);let duration=duration.num();
    if !duration.is_finite()||duration<0.{value_type_error("Delay duration must be finite and nonnegative")}
    if !callback.is_callback(){value_type_error("Delay callback must be callable")}
    let (app,window)={let owner=owner_ref.borrow();(owner.atoms.app.clone().expect("native scheduler is not bound"),owner.atoms.window.expect("native scheduler window is not bound"))};
    let delay=Rc::new(NativeDelay{active:Cell::new(true),callback:RefCell::new(Some(callback)),task:RefCell::new(None)});
    let executor=app.background_executor().clone();let start=executor.now();let weak=owner.clone();let pending=delay.clone();
    // Bound every host timer, rather than overflowing Duration/Instant for a
    // large finite authored number. Zero still crosses the foreground scheduler.
    let task=app.spawn(async move|cx|{
        let mut remaining=duration;
        loop{
            executor.timer(std::time::Duration::from_secs_f64(remaining.min(86_400_000.)/1000.)).await;
            if !pending.active.get(){return}
            remaining=duration-executor.now().saturating_duration_since(start).as_secs_f64()*1000.;
            if remaining<=0.{break}
        }
        let failed=pending.clone();
        let result=window.update(cx,move|_,window,cx|{
            let Some(owner)=weak.upgrade().filter(|owner|!owner.borrow().disposed)else{cancel_delay(&pending);return};
            if !pending.active.replace(false){return}
            if let Some(task)=pending.task.borrow_mut().take(){task.detach();}
            let callback=pending.callback.borrow_mut().take();
            owner.borrow_mut().atoms.delays.retain(|delay|delay.active.get());
            refresh_native_atoms(&owner,window,cx);
            if let Some(callback)=callback{native_host_callback(&owner,"delay",||invoke(&owner,"delay",&callback,vec![]));}
            let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx);}
        });
        if result.is_err(){failed.active.set(false);failed.callback.borrow_mut().take();if let Some(task)=failed.task.borrow_mut().take(){task.detach();}}
    });
    *delay.task.borrow_mut()=Some(task);
    {let mut owner=owner_ref.borrow_mut();owner.atoms.delays.retain(|delay|delay.active.get());owner.atoms.delays.push(delay.clone());}
    freeze(record(vec![("cancel",Value::Function(Rc::new(move|_|{cancel_delay(&delay);Value::Undefined})))]))
}
fn own_fields(value:&Value,names:&[&str])->BTreeMap<String,Value>{
    let fields=match value{Value::Record(record)=>record.fields.borrow().clone(),_=>value_type_error("Presence requires own data fields")};
    if fields.len()!=names.len()||fields.keys().any(|key|!names.contains(&key.as_str())){value_type_error("Unexpected presence record shape")}
    fields
}
fn finite_presence(value:&Value,positive:bool)->f64 {
    let number=match value{Value::Number(number)=>*number,Value::Json(Json::Number(number))=>number.as_f64().unwrap(),_=>value_type_error("Presence duration must be a number")};
    if !number.is_finite()||if positive{number<=0.}else{number<0.}{value_type_error("Invalid finite presence duration")};number
}
fn integer_presence(value:&Value)->f64 {let value=finite_presence(value,false);if value.fract()!=0.||value>9_007_199_254_740_991.{value_type_error("Invalid presence revision")};value}
pub fn snapshot_completion(value:Value)->Value {
    if strict_equal(&value,&Value::string("timer")){return value}
    let fields=own_fields(&value,&["kind","timeoutMs"]);if !strict_equal(&field(&fields,"kind"),&Value::string("presentation")){value_type_error("Invalid completion kind")}
    freeze(record(vec![("kind",Value::string("presentation")),("timeoutMs",Value::number(finite_presence(&field(&fields,"timeoutMs"),true)))]))
}
fn snapshot_presence_frame(value:Value)->Value {
    let fields=own_fields(&value,&["owner","revision","phase","attempt","completion","durationMs","timeoutMs"]);
    let owner=field(&fields,"owner");if !matches!(owner,Value::Opaque(_)){value_type_error("Invalid presentation owner reference")}
    let phase=field(&fields,"phase").text();if !["closed","preparing","entering","entered","leaving"].contains(&phase.as_str()){value_type_error("Invalid presence phase")}
    let completion=field(&fields,"completion").text();if completion!="timer"&&completion!="presentation"{value_type_error("Invalid completion kind")}
    let timeout=field(&fields,"timeoutMs");let timeout=if matches!(timeout,Value::Json(Json::Null)){timeout}else{Value::number(finite_presence(&timeout,true))};
    if (completion=="timer")!=matches!(timeout,Value::Json(Json::Null)){value_type_error("Presence timeout disagrees with completion kind")}
    let attempt=field(&fields,"attempt");let attempt=if matches!(attempt,Value::Json(Json::Null)){attempt}else{
        let parts=own_fields(&attempt,&["ownerEpoch","phaseAttempt"]);freeze(record(vec![("ownerEpoch",Value::number(integer_presence(&field(&parts,"ownerEpoch")))),("phaseAttempt",Value::number(integer_presence(&field(&parts,"phaseAttempt"))))]))
    };
    if matches!(phase.as_str(),"entering"|"leaving")==matches!(attempt,Value::Json(Json::Null)){value_type_error("Presence phase and attempt disagree")}
    freeze(record(vec![("owner",owner),("revision",Value::number(integer_presence(&field(&fields,"revision")))),("phase",Value::string(&phase)),("attempt",attempt),
        ("completion",Value::string(&completion)),("durationMs",Value::number(finite_presence(&field(&fields,"durationMs"),false))),("timeoutMs",timeout)]))
}
fn find_presence(owner:&OwnerRef,writer:&Value)->Option<Rc<RefCell<NativePresence>>>{owner.borrow().atoms.presence.iter().find(|entry|strict_equal(&entry.borrow().writer,writer)).cloned()}
fn require_presence(owner:&OwnerWeak,writer:&Value)->Rc<RefCell<NativePresence>>{let owner=ensure(owner);find_presence(&owner,writer).unwrap_or_else(||value_type_error("Foreign presentation writer"))}
pub fn presence_owner(owner:&OwnerWeak)->Value {
    let owner_ref=setup(owner);let reference=Value::Opaque(Rc::new(()));let writer=Value::Opaque(Rc::new(()));
    let state=Rc::new(RefCell::new(NativePresence{reference:reference.clone(),writer:writer.clone(),frame:Value::Undefined,binding:Value::Undefined,pending:Value::Undefined,callback:Value::Undefined}));
    owner_ref.borrow_mut().atoms.presence.push(state.clone());let weak=owner.clone();
    freeze(record(vec![("ref",reference),("writer",writer),("onCompletionRequest",Value::Function(Rc::new(move|args|{
        setup(&weak);let callback=arg(&args,0);if !callback.is_callback()||!state.borrow().callback.nullish(){value_type_error("Exactly one presence completion receiver is required")}
        state.borrow_mut().callback=callback;Value::Undefined
    })))]))
}
pub fn presence_publish(owner:&OwnerWeak,writer:Value,value:Value)->Value{
    runtime(owner);let state=require_presence(owner,&writer);let frame=snapshot_presence_frame(value);let mut state=state.borrow_mut();
    if !strict_equal(&state.reference,&frame.member("owner",false))||!state.frame.nullish()&&frame.member("revision",false).num()<=state.frame.member("revision",false).num(){value_type_error("Foreign owner or nonmonotonic presence revision")}
    state.pending=Value::Undefined;state.frame=frame;Value::Undefined
}
pub fn presence_is_current(owner:&OwnerWeak,writer:Value,receipt:Value)->Value{
    let Some(owner)=owner.upgrade().filter(|owner|!owner.borrow().disposed)else{return Value::boolean(false)};
    let Some(state)=find_presence(&owner,&writer)else{return Value::boolean(false)};let state=state.borrow();
    if state.pending.nullish()||!strict_equal(&state.pending,&receipt)||state.frame.nullish(){return Value::boolean(false)}
    let attempt=state.frame.member("attempt",false);if attempt.nullish(){return Value::boolean(false)}
    let receipt_attempt=receipt.member("attempt",true);
    Value::boolean(strict_equal(&state.reference,&receipt.member("owner",true))&&strict_equal(&state.binding,&receipt.member("viewBinding",true))
        &&strict_equal(&state.frame.member("revision",false),&receipt.member("ownerRevision",true))&&strict_equal(&receipt.member("targetRevision",true),&Value::number(0.))
        &&strict_equal(&attempt.member("ownerEpoch",false),&receipt_attempt.member("ownerEpoch",true))&&strict_equal(&attempt.member("phaseAttempt",false),&receipt_attempt.member("phaseAttempt",true)))
}
pub fn presence_settle(owner:&OwnerWeak,writer:Value,outcome:Value)->Value{
    let owner_ref=runtime(owner);let state=require_presence(owner,&writer);
    let (frame,pending)={let state=state.borrow();(state.frame.clone(),state.pending.clone())};
    if frame.nullish()||frame.member("attempt",false).nullish()||!strict_equal(&frame.member("completion",false),&Value::string("presentation"))||presence_is_current(owner,writer.clone(),pending).bool(){return Value::Undefined}
    let (receipt,callback)={let mut state=state.borrow_mut();if state.binding.nullish(){state.binding=Value::Opaque(Rc::new(()));}
        let outcome=if strict_equal(&outcome,&Value::string("finished")){Value::string("missing-capability")}else{outcome};
        let receipt=freeze(record(vec![("owner",state.reference.clone()),("attempt",frame.member("attempt",false)),("viewBinding",state.binding.clone()),
            ("ownerRevision",frame.member("revision",false)),("targetRevision",Value::number(0.)),("channels",Value::Array(Rc::new(vec![]))),("outcome",outcome)]));
        state.pending=receipt.clone();(receipt,state.callback.clone())};
    if !callback.nullish()&&presence_is_current(owner,writer,receipt.clone()).bool(){invoke(&owner_ref,"presence-completion",&callback,vec![capability(owner),freeze(record(vec![("receipt",receipt)]))]);}Value::Undefined
}
fn atoms_detach(owner:&OwnerRef){
    let delays=std::mem::take(&mut owner.borrow_mut().atoms.delays);for delay in delays{cancel_delay(&delay);}
    let states=owner.borrow().atoms.presence.clone();for state in states{let mut state=state.borrow_mut();state.binding=Value::Undefined;state.pending=Value::Undefined;}
}
`;
