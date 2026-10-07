// Native capability ownership and direct GPUI actions; appended to the owner module.
export const gpuiNativeModulesSource = String.raw`
pub struct StaticDeclaration { pub id:&'static str, pub kind:&'static str, pub config:fn()->Value }
impl Default for Value { fn default()->Self{Self::Undefined} }
#[derive(Default)]
pub struct Modules {
    pub boundary:BoundaryModule,pub hit:HitModule,pub scroll:ScrollModule,
    pub topology:Topology,pub hooks:BTreeSet<&'static str>,pub focus:FocusModule,pub state_watchers:Vec<NativeStateWatch>,
    pub transition:TransitionModule,pub text:TextModule,pub image:ImageModule,pub positioning:PositioningModule,pub overlay:OverlayModule,
    pub accessible_text:BTreeMap<String,Value>,pub accessible_relations:BTreeMap<String,Value>,
    pub accessible_tree:Value,pub accessible_level:Value,pub action_events:BTreeMap<String,String>,pub a11y_node:Option<gpui::accesskit::NodeId>,
    pub a11y_frame:u64,pub a11y_bindings:usize,
    pub trigger_child:OwnerWeak,
}
#[derive(Default)]
pub struct FocusModule {
    pub config:BTreeMap<String,Value>,pub entry:BTreeMap<String,Value>,pub scope:BTreeMap<String,Value>,pub roving:BTreeMap<String,Value>,
    pub entry_disabled:bool,pub scope_active:bool,pub visible:bool,pub selected:bool,pub active:bool,
    pub module_active:bool,pub has_focused:bool,pub bypass_gate:bool,
    pub roving_declared:bool,
    pub reason:String,pub blur_requested:bool,pub previous:OwnerWeak,pub remembered:OwnerWeak,
    pub pending:Option<(&'static str,Value)>,pub native:Option<FocusHandle>,
}
thread_local!{static ACTIVE_SCOPES:RefCell<Vec<OwnerWeak>>=RefCell::new(Vec::new());}
pub fn all_owners()->Vec<OwnerRef>{OWNERS.with(|all|{let mut all=all.borrow_mut();all.retain(|v|v.strong_count()>0);all.iter().filter_map(Weak::upgrade).filter(|o|!o.borrow().disposed).collect()})}
pub fn descendant(owner:&OwnerRef,ancestor:&OwnerRef)->bool{let mut current=Some(owner.clone());let mut visited=BTreeSet::new();while let Some(node)=current{assert!(visited.insert(Rc::as_ptr(&node)as usize),"cyclic logical ancestry");if Rc::ptr_eq(&node,ancestor){return true}current=node.borrow().parent.upgrade();}false}
pub fn ready(owner:&OwnerRef)->bool{let o=owner.borrow();!o.disposed&&o.mounted&&o.present&&o.bounds.is_some()}
fn field(config:&BTreeMap<String,Value>,key:&str)->Value{config.get(key).cloned().unwrap_or(Value::Undefined)}
fn text_or(value:Value,fallback:&str)->String{if value.nullish(){fallback.into()}else{value.text()}}
fn bool_or(value:Value,fallback:bool)->bool{if value.nullish(){fallback}else{value.bool()}}
fn merge_config(config:&mut BTreeMap<String,Value>,patch:Value){let Value::Record(entries)=patch else{panic!("module configuration record required")};config.extend(entries.iter().map(|(k,v)|(k.clone(),v.clone())));}
pub fn resolved(value:&Value)->Value{match value{Value::State(_)|Value::Observed(_,_)=>value.get(),_=>value.clone()}}
pub fn module_handle(owner:&OwnerWeak,kind:&'static str)->Value{setup(owner).borrow_mut().modules.hooks.insert(kind);Value::Handle(owner.clone(),kind)}
pub fn capability_member(owner:&OwnerWeak,kind:&str,key:&str)->Value{
    ensure(owner);
    if kind=="transition"{return match key{
        "transitionState"|"isPresent"=>transition_state_handle(owner,key),
        "controls"=>Value::Handle(owner.clone(),"transition-controls"),
        _=>panic!("unknown Transition capability member"),
    }}
    if kind=="transition-controls"{return ensure(owner).borrow().modules.transition.controls.member(key,false)}
    if kind=="collection"||kind=="collection-item"{return ensure(owner).borrow().modules.topology.handles.get(key).expect("unknown Collection state").clone()}
    if kind=="table-structure"{return match key{"role"=>Value::string(&ensure(owner).borrow().modules.topology.table.role),"states"=>Value::Handle(owner.clone(),"table-states"),_=>panic!("unknown Table capability member")}}
    if kind=="table-states"{return ensure(owner).borrow().modules.topology.handles.get(&format!("table.{key}")).expect("unknown Table state").clone()}
    if kind=="scroll"{match key{"horizontal"=>return Value::Handle(owner.clone(),"scroll-horizontal"),"vertical"=>return Value::Handle(owner.clone(),"scroll-vertical"),"endFollow"=>return Value::Handle(owner.clone(),"scroll-follow"),_=>{}}}
    if kind=="overlay"&&key=="open"{return Value::Observed(owner.clone(),"overlay.open")}
    let observation=match(kind,key){
        ("focus","focused")=>"focus.focused",("focus","focusVisible")=>"focus.visible",("focus","focusable")=>"focus.ready",
        ("focus-scope","active")=>"scope.active",("focus-roving","active")=>"roving.active",
        ("focus-scope","hasFocused")=>"scope.hasFocused",("focus-roving","hasFocused")=>"roving.hasFocused",
        ("scroll","axes")=>"scroll.axes",("scroll","projection")=>"scroll.projection",("scroll","scrolling")=>"scroll.scrolling",
        ("scroll-horizontal","position")=>"horizontal.position",("scroll-horizontal","visibleRatio")=>"horizontal.visibleRatio",("scroll-horizontal","canScrollBefore")=>"horizontal.canScrollBefore",("scroll-horizontal","canScrollAfter")=>"horizontal.canScrollAfter",("scroll-horizontal","atEnd")=>"horizontal.atEnd",
        ("scroll-vertical","position")=>"vertical.position",("scroll-vertical","visibleRatio")=>"vertical.visibleRatio",("scroll-vertical","canScrollBefore")=>"vertical.canScrollBefore",("scroll-vertical","canScrollAfter")=>"vertical.canScrollAfter",("scroll-vertical","atEnd")=>"vertical.atEnd",
        ("scroll-follow","state")=>"endFollow.state",("scroll-follow","requestStatus")=>"endFollow.requestStatus",
        _=>panic!("unmapped native capability member {kind}.{key}"),
    };Value::Observed(owner.clone(),observation)
}
pub fn observed(owner:&OwnerWeak,key:&str)->Value{
    if let Some((section,field))=key.split_once('.') {if ["scroll","horizontal","vertical","endFollow"].contains(&section){let snapshot=scroll_snapshot(owner);return if section=="scroll"{snapshot.member(field,false)}else{snapshot.member(section,false).member(field,false)}}}
    let owner=ensure(owner);
    match key{
        "focus.focused"=>Value::boolean(owner.borrow().focused),
        "overlay.open"=>Value::boolean(owner.borrow().modules.overlay.open),
        "focus.visible"=>Value::boolean(owner.borrow().modules.focus.visible),
        "focus.ready"=>Value::boolean(owner.borrow().focusable&&!owner.borrow().focus_disabled),
        "scope.active"|"roving.active"=>Value::boolean(owner.borrow().modules.focus.module_active),
        "scope.hasFocused"|"roving.hasFocused"=>Value::boolean(owner.borrow().modules.focus.has_focused),
        _=>panic!("unmapped native observation {key}"),
    }
}
pub fn focus_setup(owner:&OwnerWeak,kind:&'static str)->Value{let handle=module_handle(owner,kind);if kind=="focus-roving"{ensure(owner).borrow_mut().modules.focus.roving_declared=true;}handle}
pub fn native_focus_surface(owner:&OwnerRef)->bool{let owner=owner.borrow();owner.focusable&&!owner.focus_disabled||owner.modules.hooks.contains("focus-entry")}
pub fn native_focus_available(owner:&OwnerRef)->bool{let owner=owner.borrow();!owner.focus_disabled&&(owner.focusable||owner.modules.hooks.contains("focus-entry")&&!owner.modules.focus.entry_disabled)}
pub fn native_tab_participation(owner:&OwnerRef)->bool{let owner=owner.borrow();if owner.focusable{!owner.focus_disabled&&owner.focus_entry}else{owner.modules.hooks.contains("focus-entry")&&!owner.modules.focus.entry_disabled}}
pub fn focus_setup_config(owner:&OwnerWeak,kind:&str,patch:Value)->Value{
    let owner=setup(owner);
    {let mut o=owner.borrow_mut();match kind{
        "focus"=>{let disabled=patch.member("disabled",false);if !disabled.nullish(){o.focus_disabled=disabled.bool();}let auto=patch.member("autoFocus",false);if !auto.nullish()&&auto.bool(){o.focus_requested=true;}let nav=patch.member("navParticipation",false);if !nav.nullish(){o.focus_entry=nav.text()!="none";}merge_config(&mut o.modules.focus.config,patch);},
        "focus-entry"=>{let disabled=patch.member("disabled",false);if !disabled.nullish(){o.modules.focus.entry_disabled=disabled.bool();}merge_config(&mut o.modules.focus.entry,patch);},
        "focus-scope"=>{let group=patch.member("group",false);if !group.nullish()&&!matches!(group,Value::Json(Json::Bool(false))){o.modules.focus.roving_declared=true;if matches!(group,Value::Record(_)){merge_config(&mut o.modules.focus.roving,group);}}merge_config(&mut o.modules.focus.scope,patch);},
        "focus-roving"=>merge_config(&mut o.modules.focus.roving,patch),
        _=>panic!("invalid focus configuration capability"),
    }}Value::Undefined
}
pub fn focus_entry_disabled(owner:&OwnerWeak,value:Value)->Value{let owner=runtime(owner);let mut owner=owner.borrow_mut();owner.modules.focus.entry_disabled=value.bool();if owner.modules.focus.entry_disabled&&!owner.focusable{owner.focus_requested=false;}owner.dirty=true;Value::Undefined}
pub fn focus_nav(owner:&OwnerWeak,value:Value)->Value{let owner=runtime(owner);let text=value.text();assert!(text=="auto"||text=="none","invalid navigation participation");let mut o=owner.borrow_mut();o.focus_entry=text=="auto";o.modules.focus.config.insert("navParticipation".into(),value);o.dirty=true;Value::Undefined}
pub fn focus_status(owner:&OwnerWeak,value:Value)->Value{let owner=runtime(owner);let selected=value.member("selected",false);let active=value.member("active",false);let mut o=owner.borrow_mut();if !selected.nullish(){o.modules.focus.selected=selected.bool();}if !active.nullish(){o.modules.focus.active=active.bool();}o.dirty=true;Value::Undefined}
pub fn focus_set_roving(owner:&OwnerWeak,key:&str,value:Value)->Value{let owner=runtime(owner);if key=="loop"{value.bool();}else{assert!(["both","horizontal","vertical"].contains(&value.text().as_str()),"invalid roving orientation");}owner.borrow_mut().modules.focus.roving.insert(key.into(),value);Value::Undefined}
fn focus_provider(owner:&OwnerRef)->Option<OwnerRef>{
    let key=field(&owner.borrow().modules.focus.config,"groupKey");let mut current=owner.borrow().parent.upgrade();
    while let Some(candidate)=current{let o=candidate.borrow();let matches=o.modules.focus.roving_declared&&(key.nullish()||strict_equal(&field(&o.modules.focus.roving,"key"),&key));current=o.parent.upgrade();drop(o);if matches{return Some(candidate)}}None
}
pub fn focus_members(owner:&OwnerRef,roving:bool)->Vec<OwnerRef>{
    let window=owner.borrow().window_id;
    let mut members:Vec<_>=all_owners().into_iter().filter(|candidate|{let c=candidate.borrow();let eligible=!Rc::ptr_eq(candidate,owner)&&c.focusable&&!c.focus_disabled&&c.present&&(window.is_none()||c.window_id.is_none()||c.window_id==window);drop(c);eligible&&if roving{focus_provider(candidate).is_some_and(|p|Rc::ptr_eq(&p,owner))}else{descendant(candidate,owner)}}).collect();
    members.sort_by_key(|member|member.borrow().modules.topology.order);members
}
fn top_scope_in(window:Option<gpui::WindowId>)->Option<OwnerRef>{ACTIVE_SCOPES.with(|scopes|{let mut scopes=scopes.borrow_mut();scopes.retain(|s|s.upgrade().is_some_and(|s|!s.borrow().disposed&&s.borrow().modules.focus.scope_active));scopes.iter().rev().filter_map(Weak::upgrade).find(|s|window.is_none()||s.borrow().window_id.is_none()||s.borrow().window_id==window)})}
fn top_scope(owner:&OwnerRef)->Option<OwnerRef>{top_scope_in(owner.borrow().window_id)}
fn queue_native_focus(owner:&OwnerRef,options:Value,bypass_gate:bool){
    let mut o=owner.borrow_mut();o.modules.focus.reason=text_or(options.member("reason",true),"programmatic");o.modules.focus.bypass_gate=bypass_gate;o.focus_requested=true;o.dirty=true;
}
pub fn request_native_focus(owner:&OwnerRef,options:Value){
    if !owner.borrow().focusable||owner.borrow().focus_disabled{return}
    if ready(owner)&&top_scope(owner).is_some_and(|scope|!descendant(owner,&scope)){return}
    queue_native_focus(owner,options,false);
}
pub fn focus_request(owner:&OwnerWeak,options:Value,entry:bool)->Value{
    let owner=runtime(owner);
    if entry{let o=owner.borrow();if o.modules.focus.entry_disabled{return Value::Undefined}let strategy=text_or(field(&o.modules.focus.entry,"strategy"),"self");let fallback=text_or(field(&o.modules.focus.entry,"fallback"),"self");drop(o);if strategy=="descendant-first"{if let Some(target)=focus_members(&owner,false).first(){queue_native_focus(target,options,true);return Value::Undefined}}if fallback=="none"{return Value::Undefined}queue_native_focus(&owner,options,true);return Value::Undefined}
    request_native_focus(&owner,options);Value::Undefined
}
pub fn focus_blur(owner:&OwnerWeak)->Value{let owner=runtime(owner);let mut o=owner.borrow_mut();o.focus_requested=false;o.focused=false;o.modules.focus.visible=false;o.modules.focus.module_active=false;o.modules.focus.blur_requested=true;o.dirty=true;Value::Undefined}
pub fn focus_is_focused(owner:&OwnerWeak)->Value{Value::boolean(ensure(owner).borrow().focused)}
pub fn focus_is_active(owner:&OwnerWeak)->Value{Value::boolean(ensure(owner).borrow().modules.focus.scope_active)}
pub fn focus_get_roving(owner:&OwnerWeak)->Value{ensure(owner).borrow_mut().modules.focus.roving_declared=true;Value::Handle(owner.clone(),"focus-roving")}
pub fn focus_navigate(owner:&OwnerWeak,roving:bool,operation:&'static str,options:Value)->Value{
    let owner=runtime(owner);
    if roving||owner.borrow().modules.focus.roving_declared{navigate_focus(&owner,true,operation,options);}
    else if operation=="first"&&text_or(field(&owner.borrow().modules.focus.scope,"emptyPolicy"),"none")=="container"&&!owner.borrow().focus_disabled{
        let mut o=owner.borrow_mut();o.modules.focus.module_active=true;o.modules.focus.has_focused=false;o.focused=false;o.modules.focus.visible=false;o.dirty=true;
    }else{request_native_focus(&owner,Value::Undefined);}
    Value::Undefined
}
fn navigate_focus(owner:&OwnerRef,roving:bool,operation:&'static str,options:Value)->bool{
    let members=focus_members(owner,roving);if members.is_empty(){if roving&&bool_or(options.member("defer",true),false){owner.borrow_mut().modules.focus.pending=Some((operation,options));}return false}
    let current=members.iter().position(|m|m.borrow().focused).or_else(||if roving{members.iter().position(|m|m.borrow().modules.focus.active)}else{owner.borrow().modules.focus.remembered.upgrade().and_then(|remembered|members.iter().position(|m|Rc::ptr_eq(m,&remembered)))});
    let config=if roving{owner.borrow().modules.focus.roving.clone()}else{owner.borrow().modules.focus.scope.clone()};let looping=bool_or(field(&config,"loop"),false);
    let index=match operation{"first"=>Some(0),"last"=>Some(members.len()-1),"selected"=>Some(members.iter().position(|m|m.borrow().modules.focus.selected).unwrap_or(0)),"next"|"prev"=>{let next=match(current,operation){(Some(i),"next")=>i as isize+1,(Some(i),_)=>i as isize-1,(None,"next")=>0,(None,_)=>members.len()as isize-1};if looping{Some(next.rem_euclid(members.len()as isize)as usize)}else if next>=0&&(next as usize)<members.len(){Some(next as usize)}else if !roving{Some(next.clamp(0,members.len()as isize-1)as usize)}else{None}},_=>panic!("unknown native focus navigation")};
    if let Some(index)=index{let target=&members[index];let pending=!ready(target)&&bool_or(options.member("defer",true),false);owner.borrow_mut().modules.focus.pending=if pending{Some((operation,options.clone()))}else{None};let options=if options.nullish(){record(vec![("reason",Value::string("keyboard"))])}else{options};request_native_focus(target,options);true}else{false}
}
pub fn focus_activate(owner:&OwnerWeak,options:Value)->Value{
    let owner=runtime(owner);let window=owner.borrow().window_id;let previous=all_owners().into_iter().find(|o|o.borrow().window_id==window&&o.borrow().focused&&!descendant(o,&owner));{let mut o=owner.borrow_mut();o.modules.focus.previous=previous.as_ref().map(Rc::downgrade).unwrap_or_default();o.modules.focus.scope_active=true;o.modules.focus.module_active=true;o.modules.focus.has_focused=true;o.dirty=true;}
    ACTIVE_SCOPES.with(|scopes|{let mut scopes=scopes.borrow_mut();scopes.retain(|s|!Weak::ptr_eq(s,&Rc::downgrade(&owner)));scopes.push(Rc::downgrade(&owner));});
    let entry=text_or(field(&owner.borrow().modules.focus.scope,"entry"),"first");if entry!="manual"{let roving=owner.borrow().modules.focus.roving_declared;if let Some(target)=focus_members(&owner,roving).first(){request_native_focus(target,options);}else if text_or(field(&owner.borrow().modules.focus.scope,"emptyPolicy"),"none")=="none"{let mut o=owner.borrow_mut();o.modules.focus.scope_active=false;o.modules.focus.module_active=false;}}
    Value::Undefined
}
pub fn focus_restore(owner:&OwnerWeak)->Value{focus_request(owner,Value::Undefined,false)}
pub fn focus_deactivate(owner:&OwnerWeak,options:Value)->Value{
    let owner=runtime(owner);let was_active={let mut o=owner.borrow_mut();o.modules.focus.module_active=false;o.dirty=true;std::mem::take(&mut o.modules.focus.scope_active)};
    if !was_active{return Value::Undefined}
    for member in focus_members(&owner,false){let mut member=member.borrow_mut();member.focus_requested=false;member.modules.focus.module_active=false;if member.focused{member.modules.focus.blur_requested=true;member.focused=false;member.modules.focus.visible=false;}member.dirty=true;}
    let previous=owner.borrow().modules.focus.previous.upgrade();if let Some(previous)=previous{if ready(&previous)&&previous.borrow().focusable&&!previous.borrow().focus_disabled{queue_native_focus(&previous,options,true);}}Value::Undefined
}
pub fn native_focus_fact(owner:&OwnerRef,focused:bool){
    if !focused{native_press_blur(owner);}
    let focused=focused&&owner.borrow().focusable&&!owner.borrow().focus_disabled;
    {let mut o=owner.borrow_mut();o.focused=focused;o.modules.focus.visible=focused&&o.modules.focus.reason=="keyboard";o.modules.focus.module_active=focused;if focused{o.modules.focus.has_focused=true;}o.dirty=true;}
    if focused{for scope in all_owners(){if !Rc::ptr_eq(&scope,owner)&&descendant(owner,&scope){scope.borrow_mut().modules.focus.remembered=Rc::downgrade(owner);scope.borrow_mut().dirty=true;}}}
    poll_state_watchers();
}
pub fn modules_drive(owner:&OwnerRef,focus:&FocusHandle,window:&mut Window,cx:&mut App){
    overlay_input_scope(owner,cx);
    positioning_drive(window);
    owner.borrow_mut().modules.focus.native=Some(focus.clone());
    let blur=std::mem::take(&mut owner.borrow_mut().modules.focus.blur_requested);if (blur||text_disabled(owner))&&focus.is_focused(window){window.blur(cx);}
    let request=owner.borrow().focus_requested;
    if request&&ready(owner)&&native_focus_available(owner)&&!text_disabled(owner){let bypass_gate={let mut o=owner.borrow_mut();o.focus_requested=false;std::mem::take(&mut o.modules.focus.bypass_gate)};if bypass_gate||top_scope(owner).map_or(true,|scope|descendant(owner,&scope)){window.focus(focus,cx);}}
    transition_drive(owner,window,cx);
}
pub fn drive_queued_focus(owner:&OwnerRef,window:&mut Window,cx:&mut App){for other in owners_in(window){if Rc::ptr_eq(owner,&other){continue}let focus=other.borrow().modules.focus.native.clone();if let Some(focus)=focus{modules_drive(&other,&focus,window,cx);}}}
pub fn modules_commit(owner:&OwnerRef){overlay_commit(owner);image_mount(owner);topology_refresh();for owner in all_owners(){let pending=owner.borrow().modules.focus.pending.clone();if let Some((operation,options))=pending{navigate_focus(&owner,true,operation,options);}}poll_state_watchers();}
pub fn focus_key_navigation(event:&gpui::KeyDownEvent,window:&mut Window)->bool{
    let Some(key)=portable_key(&event.keystroke)else{return false};let id=Some(window.window_handle().window_id());
    if key=="Tab"{if let Some(scope)=top_scope_in(id).filter(ready){let trapped={let scope=scope.borrow();let config=&scope.modules.focus.scope;bool_or(field(config,"trap"),false)&&matches!(text_or(field(config,"navigation"),"tab").as_str(),"tab"|"tab+arrow")};if trapped{navigate_focus(&scope,false,if event.keystroke.modifiers.shift{"prev"}else{"next"},record(vec![("reason",Value::string("keyboard"))]));window.prevent_default();return true;}}return false;}
    let Some(target)=all_owners().into_iter().find(|o|o.borrow().focused&&o.borrow().window_id==id)else{return false};let Some(provider)=focus_provider(&target)else{return false};
    let config=provider.borrow().modules.focus.roving.clone();let navigation=text_or(field(&config,"navigation"),"none");if !matches!(navigation.as_str(),"arrow"|"tab+arrow"){return false}let orientation=text_or(field(&config,"orientation"),"vertical");
    let op=match key.as_str(){"ArrowDown" if orientation!="horizontal"=>Some("next"),"ArrowUp" if orientation!="horizontal"=>Some("prev"),"ArrowRight" if orientation!="vertical"=>Some("next"),"ArrowLeft" if orientation!="vertical"=>Some("prev"),"Home"=>Some("first"),"End"=>Some("last"),_=>None};
    if let Some(op)=op{if navigate_focus(&provider,true,op,record(vec![("reason",Value::string("keyboard"))])){window.prevent_default();return true;}}false
}
#[derive(Default)]
pub struct TransitionModule {
    controls:Value,target_open:bool,view_mounted:bool,queued:Option<bool>,generation:u64,
    pending:Option<(u64,&'static str)>,task:Option<gpui::Task<()>>,
}
fn transition_state_handle(owner:&OwnerWeak,key:&str)->Value{
    Value::State(ensure(owner).borrow().states.get(key).expect("Transition State declared").clone())
}
fn transition_status(owner:&OwnerRef)->String{transition_state_handle(&Rc::downgrade(owner),"transitionState").get().text()}
fn transition_invalidate(owner:&OwnerRef){
    let task={let mut o=owner.borrow_mut();let transition=&mut o.modules.transition;
        transition.generation=transition.generation.wrapping_add(1);transition.pending=None;transition.task.take()};
    drop(task);
}
fn transition_set_state(owner:&OwnerRef,state:&str){
    let weak=Rc::downgrade(owner);
    let Value::State(status)=transition_state_handle(&weak,"transitionState")else{unreachable!()};
    let Value::State(present)=transition_state_handle(&weak,"isPresent")else{unreachable!()};
    write_state_value(&status,Value::string(state),Value::string(&format!("reason: asTransition => {state}")));
    write_state_value(&present,Value::boolean(state!="closed"),Value::string(&format!("reason: asTransition presence => {state}")));
}
fn transition_prop(owner:&OwnerRef,key:&str,fallback:&str)->Value{
    let weak=Rc::downgrade(owner);
    let default=transition_state_handle(&weak,fallback).get();
    if is_provided(&weak,Value::string(key)).bool(){let value=read_props(&weak,false).member(key,false);if !value.nullish(){return value}}
    default
}
fn transition_interrupt(owner:&OwnerRef)->String{transition_prop(owner,"interrupt","transitionInterruptDefault").text()}
fn transition_arm(owner:&OwnerRef,state:&'static str){
    transition_invalidate(owner);
    let mut o=owner.borrow_mut();let transition=&mut o.modules.transition;
    transition.pending=Some((transition.generation,state));o.dirty=true;
}
fn transition_begin(owner:&OwnerRef,entering:bool){
    if entering {
        set_present(&Rc::downgrade(owner),Value::boolean(true));
        if !owner.borrow().modules.transition.view_mounted{return}
    }
    owner.borrow_mut().modules.transition.queued=None;
    emit(&Rc::downgrade(owner),Value::string(if entering{"beforeEnter"}else{"beforeLeave"}),Value::Undefined);
    let state=if entering{"entering"}else{"leaving"};
    transition_set_state(owner,state);transition_arm(owner,state);
}
fn transition_complete_current(owner:&OwnerRef,consume:bool){
    let state=transition_status(owner);
    if state!="entering"&&state!="leaving"{return}
    transition_invalidate(owner);
    if state=="entering" {
        transition_set_state(owner,"entered");emit(&Rc::downgrade(owner),Value::string("afterEnter"),Value::Undefined);
    } else {
        transition_set_state(owner,"closed");emit(&Rc::downgrade(owner),Value::string("afterLeave"),Value::Undefined);
        set_present(&Rc::downgrade(owner),Value::boolean(false));
    }
    if consume{let queued=owner.borrow_mut().modules.transition.queued.take();if let Some(open)=queued{transition_intent(owner,open);}}
}
fn transition_intent(owner:&OwnerRef,open:bool){
    owner.borrow_mut().modules.transition.target_open=open;
    let current=transition_status(owner);
    if open&&current=="entered"{return}
    if !open&&current=="closed"{set_present(&Rc::downgrade(owner),Value::boolean(false));return}
    if open&&current=="closed"||!open&&current=="entered"{transition_begin(owner,open);return}
    let interrupt=transition_interrupt(owner);
    if open&&current=="entering"||!open&&current=="leaving"{
        if interrupt=="wait"{owner.borrow_mut().modules.transition.queued=None;}return
    }
    if interrupt=="wait"{owner.borrow_mut().modules.transition.queued=Some(open);}
    else if interrupt=="immediate"{transition_complete_current(owner,false);transition_begin(owner,open);}
    else{assert_eq!(interrupt,"reverse","Transition interrupt must be reverse, wait, or immediate");transition_invalidate(owner);transition_begin(owner,open);}
}
pub fn transition_control(owner:&OwnerWeak,operation:&str)->Value{
    let owner=runtime(owner);
    match operation{"enter"=>transition_intent(&owner,true),"leave"=>transition_intent(&owner,false),"complete"=>transition_complete_current(&owner,true),_=>panic!("unknown Transition control")}
    Value::Undefined
}
fn transition_lifecycle(owner:&OwnerWeak,kind:&str)->Value{
    let owner=ensure(owner);
    match kind {
        "created"=>{
            let weak=Rc::downgrade(&owner);let props=read_props(&weak,false);
            let open=bool_or(if is_provided(&weak,Value::string("open")).bool(){props.member("open",false)}else{props.member("defaultOpen",false)},false);
            let appear=transition_prop(&owner,"appear","transitionAppearDefault").bool();
            {let mut o=owner.borrow_mut();o.modules.transition.target_open=open;o.modules.transition.queued=None;}
            transition_invalidate(&owner);
            if !open{transition_set_state(&owner,"closed");set_present(&weak,Value::boolean(false));}
            else{set_present(&weak,Value::boolean(true));if !appear{transition_set_state(&owner,"entered");}}
        },
        "mounted"=>{owner.borrow_mut().modules.transition.view_mounted=true;if owner.borrow().modules.transition.target_open&&transition_status(&owner)=="closed"{transition_begin(&owner,true);}},
        "unmounted"=>{owner.borrow_mut().modules.transition.view_mounted=false;transition_invalidate(&owner);owner.borrow_mut().modules.transition.queued=None;if transition_status(&owner)!="closed"{transition_set_state(&owner,"closed");}},
        "before-dispose"=>{owner.borrow_mut().modules.transition.view_mounted=false;owner.borrow_mut().modules.transition.queued=None;transition_invalidate(&owner);},
        _=>panic!("unknown Transition lifecycle phase"),
    }
    Value::Undefined
}
pub fn transition_setup(owner:&OwnerWeak)->Value{
    let owner_ref=setup(owner);
    if owner_ref.borrow().modules.hooks.contains("transition"){return Value::Handle(owner.clone(),"transition")}
    module_handle(owner,"transition");
    let options=Value::Array(Rc::new(["reverse","wait","immediate"].into_iter().map(Value::string).collect()));
    let scalar=|kind:&str|record(vec![("type",Value::string(kind)),("empty",Value::string("fallback"))]);
    props_define(owner,record(vec![("open",scalar("boolean")),("defaultOpen",scalar("boolean")),("appear",scalar("boolean")),("enterDuration",scalar("number")),("leaveDuration",scalar("number")),("interrupt",record(vec![("type",Value::string("enum")),("empty",Value::string("fallback")),("options",options.clone())]))]));
    set_defaults(owner,record(vec![("defaultOpen",Value::boolean(false)),("appear",Value::boolean(false)),("enterDuration",Value::number(300.)),("leaveDuration",Value::number(200.)),("interrupt",Value::string("reverse"))]));
    create_state(owner,"enum",Value::string("transitionState"),Value::string("closed"),record(vec![("options",Value::Array(Rc::new(["closed","entering","entered","leaving"].into_iter().map(Value::string).collect())))]));
    create_state(owner,"bool",Value::string("isPresent"),Value::boolean(false),Value::Undefined);
    create_state(owner,"bool",Value::string("transitionAppearDefault"),Value::boolean(false),Value::Undefined);
    create_state(owner,"discrete",Value::string("transitionEnterDurationDefault"),Value::number(300.),Value::Undefined);
    create_state(owner,"discrete",Value::string("transitionLeaveDurationDefault"),Value::number(200.),Value::Undefined);
    create_state(owner,"enum",Value::string("transitionInterruptDefault"),Value::string("reverse"),record(vec![("options",options)]));
    for event in ["beforeEnter","afterEnter","beforeLeave","afterLeave"]{expose_event(owner,Value::string(event));}
    for key in ["transitionState","isPresent"]{expose_state(owner,Value::string(key),transition_state_handle(owner,key));}
    let mut controls=Vec::new();
    for operation in ["enter","leave","complete"]{
        let weak=owner.clone();let callback=Value::Function(Rc::new(move |_|transition_control(&weak,operation)));
        expose_method(owner,Value::string(operation),callback.clone());controls.push((operation,callback));
    }
    owner_ref.borrow_mut().modules.transition.controls=record(controls);
    expose_value(owner,Value::string("controls"),Value::Handle(owner.clone(),"transition-controls"));
    for kind in ["created","mounted","unmounted","before-dispose"]{
        let weak=owner.clone();register_life(owner,kind,Value::Function(Rc::new(move |_|transition_lifecycle(&weak,kind))));
    }
    let weak=owner.clone();
    watch_props(owner,Some(Value::Array(Rc::new(["open","interrupt","enterDuration","leaveDuration"].into_iter().map(Value::string).collect()))),false,Value::Function(Rc::new(move |arguments|{
        if is_provided(&weak,Value::string("open")).bool(){
            let owner=ensure(&weak);let open=bool_or(arg(&arguments,1).member("open",false),false);
            if open!=owner.borrow().modules.transition.target_open{transition_intent(&owner,open);}
        }
        Value::Undefined
    })));
    Value::Handle(owner.clone(),"transition")
}
pub fn transition_configure(owner:&OwnerWeak,config:Value)->Value{
    setup(owner);
    for (key,state) in [("appear","transitionAppearDefault"),("enterDuration","transitionEnterDurationDefault"),("leaveDuration","transitionLeaveDurationDefault"),("interrupt","transitionInterruptDefault")]{
        let value=config.member(key,false);
        if matches!(value,Value::Undefined){continue}
        if key=="enterDuration"||key=="leaveDuration"{let duration=value.num();assert!(duration.is_finite()&&duration>=0.,"Transition duration must be finite and nonnegative");}
        state_default(transition_state_handle(owner,state),value);
    }
    Value::Undefined
}
fn transition_drive(owner:&OwnerRef,window:&mut Window,cx:&mut App){
    if !owner.borrow().modules.hooks.contains("transition")||!ready(owner){return}
    let pending=owner.borrow_mut().modules.transition.pending.take();let Some((generation,state))=pending else{return};
    if owner.borrow().modules.transition.generation!=generation||transition_status(owner)!=state{return}
    let duration=if cx.reduce_motion(){0.}else{transition_prop(owner,if state=="entering"{"enterDuration"}else{"leaveDuration"},if state=="entering"{"transitionEnterDurationDefault"}else{"transitionLeaveDurationDefault"}).num()};
    assert!(duration.is_finite()&&duration>=0.,"Transition duration must be finite and nonnegative");
    let timer=cx.background_executor().timer(std::time::Duration::from_secs_f64(duration/1000.));
    let handle=window.window_handle();let weak=Rc::downgrade(owner);
    let task=cx.spawn(async move |cx|{
        timer.await;
        let _=handle.update(cx,move |_,window,cx|{
            let Some(owner)=weak.upgrade().filter(|owner|!owner.borrow().disposed)else{return};
            if !ready(&owner)||owner.borrow().modules.transition.generation!=generation||transition_status(&owner)!=state{return}
            let task=owner.borrow_mut().modules.transition.task.take();if let Some(task)=task{task.detach();}
            let complete=owner.borrow().modules.transition.controls.member("complete",false);
            invoke(&owner,"delay",&complete,vec![]);
            let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx);}
        });
    });
    owner.borrow_mut().modules.transition.task=Some(task);
}
pub fn accessible_text(owner:&OwnerWeak,key:&str,value:Value)->Value{let owner=setup(owner);if key=="name"{owner.borrow_mut().name_content=false;}owner.borrow_mut().modules.accessible_text.insert(key.into(),value);Value::Undefined}
pub fn accessible_tree(owner:&OwnerWeak,value:Value)->Value{let owner=setup(owner);let mut o=owner.borrow_mut();if let(Value::Record(current),Value::Record(patch))=(&mut o.modules.accessible_tree,&value){Rc::make_mut(current).extend(patch.iter().map(|(key,value)|(key.clone(),value.clone())));}else{o.modules.accessible_tree=value;}Value::Undefined}
pub fn accessible_level_value(value:&Value)->Option<usize>{let number=match resolved(value){Value::Number(number)=>number,Value::Json(Json::Number(number))=>number.as_f64()?,_=>return None};if number>=1.&&number<=6.&&number.fract()==0.{Some(number as usize)}else{None}}
pub fn accessible_level(owner:&OwnerWeak,value:Value)->Value{let owner=setup(owner);assert!(accessible_level_value(&value).is_some(),"[A11y] level must be an integer in range 1-6");owner.borrow_mut().modules.accessible_level=value;Value::Undefined}
pub fn accessible_alive(owner:&OwnerRef){let level=owner.borrow().modules.accessible_level.clone();if matches!(level,Value::State(_)|Value::Observed(_,_)){assert!(accessible_level_value(&level).is_some(),"[A11y] level must be an integer in range 1-6");}}
pub fn accessible_relation(owner:&OwnerWeak,key:Value,mut value:Value)->Value{
    let owner=setup(owner);let target=value.member("target",false);
    if let Value::Array(items)=target{let mut refs=Vec::new();for item in items.iter(){let Value::ObjectRef(target)=item else{panic!("[A11y] relation reference lists accept semantic-object refs only")};if !refs.iter().any(|item|matches!(item,Value::ObjectRef(previous)if Weak::ptr_eq(previous,target))){refs.push(item.clone());}}let Value::Record(spec)=&mut value else{panic!("[A11y] relation spec must be a record")};Rc::make_mut(spec).insert("target".into(),Value::Array(Rc::new(refs)));}
    else{assert!(matches!(target,Value::Json(Json::String(_))|Value::State(_)|Value::Observed(_,_)|Value::ObjectRef(_)),"[A11y] relation target must be a string, State, or semantic-object ref");}
    owner.borrow_mut().modules.accessible_relations.insert(key.text(),value);Value::Undefined
}
pub fn accessible_action_spec(owner:&OwnerWeak,key:Value,spec:Value)->Value{let owner=setup(owner);let key=key.text();let event=text_or(spec.member("event",true),&format!("a11y:{key}"));let mut o=owner.borrow_mut();o.accessible_actions.insert(key.clone());o.modules.action_events.insert(key,event);Value::Undefined}
#[derive(Clone)]
pub struct NativeStateWatch{source:Value,previous:Value,callback:Value,active:Rc<Cell<bool>>,disconnected:bool}
pub fn state_default(receiver:Value,value:Value)->Value{let Value::State(state)=receiver else{panic!("Owned State required")};setup(&state.owner);*state.value.borrow_mut()=normalize_state(state.kind,value,&state.spec,true);Value::Undefined}
pub fn watch_state(owner:&OwnerWeak,source:Value,callback:Value)->Value{let owner=setup(owner);let previous=source.get();let active=Rc::new(Cell::new(true));owner.borrow_mut().modules.state_watchers.push(NativeStateWatch{source,previous,callback,active:active.clone(),disconnected:false});disposer(owner,active,false)}
enum StateNotice {
    Owned(Rc<State>,Value),
    Observed{owner:OwnerWeak,watch:NativeStateWatch,event:Value,terminal:bool},
}
thread_local!{
    static STATE_DISPATCHING:Cell<bool>=Cell::new(false);
    static STATE_NOTICES:RefCell<VecDeque<StateNotice>>=RefCell::new(VecDeque::new());
}
pub fn write_state_value(state:&Rc<State>,value:Value,reason:Value){
    let next=normalize_state(state.kind,value,&state.spec,false);
    let previous=state.value.borrow().clone();
    if same_value(&previous,&next){return}
    *state.value.borrow_mut()=next.clone();
    ensure(&state.owner).borrow_mut().dirty=true;
    let event=record(vec![("type",Value::string("next")),("prev",previous),("next",next),("reason",reason)]);
    STATE_NOTICES.with(|queue|queue.borrow_mut().push_back(StateNotice::Owned(state.clone(),event)));
    drain_state_notices();
}
fn drain_state_notices(){
    if STATE_DISPATCHING.with(|flag|flag.replace(true)){return}
    struct Reset;
    impl Drop for Reset{fn drop(&mut self){STATE_DISPATCHING.with(|flag|flag.set(false))}}
    let _reset=Reset;
    loop {
        let notice=STATE_NOTICES.with(|queue|queue.borrow_mut().pop_front());
        match notice {
            None=>break,
            Some(StateNotice::Owned(state,event))=>{
                if !state.owner.upgrade().is_some_and(|source|!source.borrow().disposed){continue}
                for owner in all_owners(){
                    if matches!(owner.borrow().phase,"setup"|"before-dispose"){continue}
                    let callbacks:Vec<_>=owner.borrow().modules.state_watchers.iter().filter(|watch|watch.active.get()&&!watch.disconnected&&matches!(&watch.source,Value::State(source)if Rc::ptr_eq(source,&state))).map(|watch|watch.callback.clone()).collect();
                    for callback in callbacks {
                        if owner.borrow().disposed{break}
                        invoke(&owner,"state-watch",&callback,vec![capability(&Rc::downgrade(&owner)),event.clone()]);
                    }
                }
            },
            Some(StateNotice::Observed{owner,watch,event,terminal})=>{
                if watch.active.get(){
                    if let Some(owner)=owner.upgrade().filter(|owner|!owner.borrow().disposed){
                        invoke(&owner,"state-watch",&watch.callback,vec![capability(&Rc::downgrade(&owner)),event]);
                    }
                }
                if terminal{watch.active.set(false);}
            },
        }
    }
}
pub fn poll_state_watchers(){
    for owner in all_owners(){
        if matches!(owner.borrow().phase,"setup"|"before-dispose"){continue}
        let watchers=owner.borrow().modules.state_watchers.clone();
        for (index,watch) in watchers.into_iter().enumerate(){
            if !watch.active.get()||watch.disconnected{continue}
            let source_owner=match &watch.source{Value::State(state)=>state.owner.clone(),Value::Observed(owner,_)=>owner.clone(),_=>panic!("State watch source required")};
            let terminal=!source_owner.upgrade().is_some_and(|source|!source.borrow().disposed);
            let event=if terminal {
                owner.borrow_mut().modules.state_watchers[index].disconnected=true;
                record(vec![("type",Value::string("disconnect")),("reason",Value::string("unmount"))])
            } else {
                if matches!(&watch.source,Value::State(_)){continue}
                let next=watch.source.get();
                if same_value(&watch.previous,&next){continue}
                owner.borrow_mut().modules.state_watchers[index].previous=next.clone();
                let mut fields=vec![("type",Value::string("next")),("next",next),("prev",watch.previous.clone())];
                if let Value::Observed(source,"overlay.open")=&watch.source{let reason=ensure(source).borrow().modules.overlay.reason.clone();if !matches!(reason,Value::Undefined){fields.push(("reason",reason));}}
                record(fields)
            };
            STATE_NOTICES.with(|queue|queue.borrow_mut().push_back(StateNotice::Observed{owner:Rc::downgrade(&owner),watch,event,terminal}));
        }
    }
    drain_state_notices();
}
pub fn host_target(owner:&OwnerWeak)->Value{let owner_ref=ensure(owner);if ready(&owner_ref){Value::HostTarget(owner.clone())}else{Value::Json(Json::Null)}}
`;
