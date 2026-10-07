// The author AsHook owns presence; physical layer/position/modal leases follow its view epochs.
export const gpuiNativeOverlaySource = String.raw`
#[derive(Default)]
pub struct OverlayModule {
    config:BTreeMap<String,Value>,open:bool,reason:Value,view_active:bool,retained:bool,presence:Value,
    presence_active:Option<Rc<Cell<bool>>>,trigger:OwnerWeak,anchor:OwnerWeak,content:OwnerWeak,
    materialized:bool,modal_locked:bool,layer_order:u64,
}
thread_local!{static OVERLAY_LAYERS:Cell<u64>=Cell::new(0);static OVERLAY_OWNERS:RefCell<Vec<OwnerWeak>>=RefCell::new(Vec::new());static POINTER_PRESS_DISPATCHED:Cell<bool>=Cell::new(false);}
fn overlay_boolean(owner:&OwnerRef,key:&str)->bool{bool_or(field(&owner.borrow().modules.overlay.config,key),false)}
fn overlay_position_config(owner:&OwnerRef)->Value {
    let owner=owner.borrow();let config=&owner.modules.overlay.config;
    record(vec![("side",Value::string(&text_or(field(config,"placement"),"bottom"))),("align",Value::string(&text_or(field(config,"align"),"start"))),
        ("sideOffset",config.get("sideOffset").cloned().unwrap_or(Value::number(4.))),("alignOffset",config.get("alignOffset").cloned().unwrap_or(Value::number(0.))),
        ("strategy",Value::string(&text_or(field(config,"strategy"),"absolute"))),("avoidCollisions",config.get("avoidCollisions").cloned().unwrap_or(Value::boolean(true))),
        ("collisionBoundary",Value::string(&text_or(field(config,"collisionBoundary"),"clippingAncestors"))),("collisionPadding",config.get("collisionPadding").cloned().unwrap_or(Value::number(0.))),
        ("excludeAnchorTranslation",config.get("excludeAnchorTranslation").cloned().unwrap_or(Value::boolean(false)))])
}
fn overlay_view_active(owner:&OwnerRef,active:bool){
    let changed={let mut owner=owner.borrow_mut();let overlay=&mut owner.modules.overlay;if overlay.view_active==active{false}else{overlay.view_active=active;if !active{overlay.modal_locked=false;}owner.dirty=true;true}};
    if changed&&!active{positioning_detach(owner);}if changed{position_changed();}
}
pub fn overlay_detach(owner:&OwnerRef){let mut owner=owner.borrow_mut();let overlay=&mut owner.modules.overlay;overlay.materialized=false;overlay.modal_locked=false;overlay.layer_order=0;}
fn overlay_reconcile(owner:&OwnerRef){
    if !ready(owner)||!owner.borrow().modules.hooks.contains("overlay"){return}
    let active=owner.borrow().modules.overlay.view_active;if !active{return}
    {let mut owner=owner.borrow_mut();let overlay=&mut owner.modules.overlay;if !overlay.materialized{overlay.materialized=true;OVERLAY_LAYERS.with(|sequence|{overlay.layer_order=sequence.get();sequence.set(sequence.get().wrapping_add(1));});owner.dirty=true;position_changed();}}
    let modal=overlay_boolean(owner,"modal");owner.borrow_mut().modules.overlay.modal_locked=modal;
    let (anchor,floating)={let owner=owner.borrow();let overlay=&owner.modules.overlay;(overlay.anchor.upgrade().or_else(||overlay.trigger.upgrade()),overlay.content.upgrade())};
    if !overlay_boolean(owner,"anchored")||anchor.is_none(){positioning_detach(owner);return}
    let anchor=anchor.expect("anchored overlay reference");let floating=floating.unwrap_or_else(||owner.clone());let config=overlay_position_config(owner);let parsed=PositionConfig::read(&config);
    let same=owner.borrow().modules.positioning.connection.as_ref().is_some_and(|connection|Weak::ptr_eq(&connection.anchor,&Rc::downgrade(&anchor))&&Weak::ptr_eq(&connection.floating,&Rc::downgrade(&floating))&&connection.config==parsed);
    if !same{positioning_connect(&Rc::downgrade(owner),record(vec![("anchor",Value::HostTarget(Rc::downgrade(&anchor))),("floating",Value::HostTarget(Rc::downgrade(&floating))),("config",config)]));}
}
pub fn overlay_commit(owner:&OwnerRef){overlay_reconcile(owner);}
fn overlay_drive_presence(owner:&OwnerRef,open:bool){
    let(presence,retained)={let owner=owner.borrow();(owner.modules.overlay.presence.clone(),owner.modules.overlay.retained)};
    if matches!(presence,Value::Undefined){overlay_view_active(owner,open);if !retained{set_present(&Rc::downgrade(owner),Value::boolean(open));}}
    else{presence.member(if open{"enter"}else{"leave"},false).call(vec![]);}
}
fn overlay_set_open(owner:&OwnerRef,open:bool,reason:Value){
    let changed={let mut owner=owner.borrow_mut();let overlay=&mut owner.modules.overlay;overlay.reason=reason;let changed=overlay.open!=open;overlay.open=open;if changed{owner.dirty=true;}changed};
    if !changed{if open{overlay_reconcile(owner);}return}
    if owner.borrow().phase!="setup"{overlay_drive_presence(owner,open);}
    // Observed next events belong to each intent, not the enclosing callback's final value.
    poll_state_watchers();
    let current=owner.borrow().modules.overlay.open;let mut owner=owner.borrow_mut();owner.modules.boundary.active=current;
    if current{BOUNDARY_ORDER.with(|sequence|{owner.modules.boundary.stack_order=sequence.get().wrapping_add(1);sequence.set(owner.modules.boundary.stack_order);});}
}
pub fn overlay_intent(owner:&OwnerWeak,operation:&str,reason:Value)->Value{let owner=runtime(owner);let open=match operation{"openOverlay"=>true,"close"=>false,"toggle"=>!owner.borrow().modules.overlay.open,_=>panic!("unknown Overlay intent")};overlay_set_open(&owner,open,reason);Value::Undefined}
pub fn overlay_is_open(owner:&OwnerWeak)->Value{Value::boolean(ensure(owner).borrow().modules.overlay.open)}
pub fn overlay_configure(owner:&OwnerWeak,patch:Value,position_only:bool)->Value{
    let owner=if position_only{runtime(owner)}else{setup(owner)};
    let keys=if position_only{&["placement","align","sideOffset","alignOffset","strategy","avoidCollisions","collisionBoundary","collisionPadding","excludeAnchorTranslation"][..]}else{&["defaultOpen","closeOnEscape","closeOnOutsidePress","closeOnFocusOutside","closeOnAnchorPress","closeOnTriggerPress","placement","align","sideOffset","alignOffset","anchored","strategy","avoidCollisions","collisionBoundary","collisionPadding","excludeAnchorTranslation","entry","restore","portal","modal","layerRole","layerOffset"][..]};
    {let mut owner=owner.borrow_mut();for key in keys{let value=patch.member(key,false);if !matches!(value,Value::Undefined){owner.modules.overlay.config.insert((*key).into(),value);}}
        let meta=patch.member("meta",false);if !position_only&&!matches!(meta,Value::Undefined){let mut merged=BTreeMap::new();let previous=field(&owner.modules.overlay.config,"meta");if !previous.nullish(){merge_config(&mut merged,previous);}merge_config(&mut merged,meta);owner.modules.overlay.config.insert("meta".into(),Value::Record(Rc::new(merged)));}}
    if !position_only{let observing=overlay_boolean(&owner,"closeOnOutsidePress");owner.borrow_mut().modules.boundary.observing=observing;if overlay_boolean(&owner,"defaultOpen"){overlay_set_open(&owner,true,Value::string("programmatic"));}}
    else{overlay_reconcile(&owner);}Value::Undefined
}
fn overlay_lifecycle(owner:&OwnerWeak,kind:&str)->Value{
    let owner=ensure(owner);
    match kind{
        "created"=>{let presence=owner.borrow().modules.overlay.presence.clone();let open=owner.borrow().modules.overlay.open;if matches!(presence,Value::Undefined){overlay_drive_presence(&owner,open);}},
        "presence-created"=>{let presence=owner.borrow().modules.overlay.presence.clone();let open=owner.borrow().modules.overlay.open;overlay_view_active(&owner,presence.member("present",false).get().bool());presence.member(if open{"enter"}else{"leave"},false).call(vec![]);},
        "mounted"=>{owner.borrow_mut().modules.overlay.content=Rc::downgrade(&owner);overlay_reconcile(&owner);},
        "unmounted"=>overlay_detach(&owner),
        "before-dispose"=>{if let Some(active)=owner.borrow_mut().modules.overlay.presence_active.take(){active.set(false);}overlay_detach(&owner);},
        _=>panic!("unknown Overlay lifecycle phase"),
    }Value::Undefined
}
pub fn overlay_setup(owner:&OwnerWeak)->Value{
    let owner_ref=setup(owner);if owner_ref.borrow().modules.hooks.contains("overlay"){return Value::Handle(owner.clone(),"overlay")}
    let value=module_handle(owner,"overlay");OVERLAY_OWNERS.with(|owners|owners.borrow_mut().push(owner.clone()));
    for kind in ["created","mounted","unmounted","before-dispose"]{let weak=owner.clone();register_life(owner,kind,Value::Function(Rc::new(move|_|overlay_lifecycle(&weak,kind))));}
    value
}
pub fn overlay_register(owner:&OwnerWeak,target:Value,kind:&str)->Value{
    let owner=ensure(owner);assert!(!matches!(owner.borrow().phase,"render"|"before-dispose"),"Overlay binding phase required");
    let target=if target.nullish(){OwnerWeak::new()}else{let target=target.owner();ensure(&target);target};
    {let mut owner=owner.borrow_mut();let overlay=&mut owner.modules.overlay;match kind{"trigger"=>overlay.trigger=target,"anchor"=>overlay.anchor=target,"content"=>overlay.content=target,_=>panic!("unknown Overlay registration")}}
    overlay_reconcile(&owner);Value::Undefined
}
pub fn overlay_keep_mounted(owner:&OwnerWeak)->Value{let owner=setup(owner);let mut owner=owner.borrow_mut();assert!(matches!(owner.modules.overlay.presence,Value::Undefined),"cannot retain a Presence-bound overlay");owner.modules.overlay.retained=true;Value::Undefined}
pub fn overlay_bind_presence(owner:&OwnerWeak,binding:Value)->Value{
    let owner_ref=setup(owner);{let owner=owner_ref.borrow();assert!(!owner.modules.overlay.retained,"cannot bind Presence after keepMounted");if !matches!(owner.modules.overlay.presence,Value::Undefined){assert!(strict_equal(&owner.modules.overlay.presence,&binding),"Overlay Presence already bound");return Value::Undefined}}
    assert!(matches!(binding.member("enter",false),Value::Function(_))&&matches!(binding.member("leave",false),Value::Function(_)),"Presence requires callable enter/leave");let present=binding.member("present",false);let active=present.get().bool();
    owner_ref.borrow_mut().modules.overlay.presence=binding;overlay_view_active(&owner_ref,active);
    let weak=owner.clone();watch_state(owner,present,Value::Function(Rc::new(move|arguments|{let event=arg(&arguments,1);if event.member("type",false).text()=="next"{let owner=ensure(&weak);overlay_view_active(&owner,event.member("next",false).bool());overlay_reconcile(&owner);}Value::Undefined})));let active=owner_ref.borrow().modules.state_watchers.last().expect("Presence watcher").active.clone();owner_ref.borrow_mut().modules.overlay.presence_active=Some(active);
    // Registered at bind time, after the bound transition's created callback.
    let weak=owner.clone();register_life(owner,"created",Value::Function(Rc::new(move|_|overlay_lifecycle(&weak,"presence-created"))));Value::Undefined
}
fn overlays_in(window:&Window)->Vec<OwnerRef>{let id=window.window_handle().window_id();OVERLAY_OWNERS.with(|owners|{let mut owners=owners.borrow_mut();owners.retain(|owner|owner.strong_count()!=0);owners.iter().filter_map(Weak::upgrade).filter(|owner|ready(owner)&&owner.borrow().window_id==Some(id)).collect()})}
fn overlay_escape(window:&Window)->bool{let candidate=overlays_in(window).into_iter().filter(|owner|{let owner=owner.borrow();owner.modules.overlay.open&&owner.modules.overlay.view_active&&bool_or(field(&owner.modules.overlay.config,"closeOnEscape"),false)}).max_by_key(|owner|owner.borrow().modules.boundary.stack_order);if let Some(owner)=candidate{overlay_set_open(&owner,false,Value::string("escape"));true}else{false}}
struct OverlayInputScope{_keyboard:gpui::Subscription}
impl gpui::Global for OverlayInputScope{}
pub fn overlay_input_scope(owner:&OwnerRef,cx:&mut App){
    if !owner.borrow().modules.hooks.contains("overlay")||cx.has_global::<OverlayInputScope>(){return}
    let keyboard=cx.intercept_keystrokes(|event,window,cx|{if portable_key(&event.keystroke).as_deref()==Some("Escape")&&overlay_escape(window){drive_owners(window,cx);}});
    cx.set_global(OverlayInputScope{_keyboard:keyboard});
}
pub fn overlay_outside(owner:&OwnerRef){if owner.borrow().modules.hooks.contains("overlay")&&owner.borrow().modules.overlay.open&&overlay_boolean(owner,"closeOnOutsidePress"){overlay_set_open(owner,false,Value::string("outside.press"));}}
pub fn overlay_modal_wheel(event:&gpui::ScrollWheelEvent,phase:gpui::DispatchPhase,window:&mut Window,cx:&mut App){if !phase.capture(){return}let locked=overlays_in(window).into_iter().any(|owner|owner.borrow().modules.overlay.modal_locked&&!native_host_hit(&owner,event.position,window));if locked{window.prevent_default();cx.stop_propagation();}}
fn overlay_presentation(owner:&OwnerRef)->Option<(bool,usize)>{
    let owner=owner.borrow();let overlay=&owner.modules.overlay;if !owner.modules.hooks.contains("overlay")||!overlay.materialized&&!overlay.view_active{return None}
    let role=text_or(field(&overlay.config,"layerRole"),"overlay");let role_offset=match role.as_str(){"dialog-mask"=>1000,"dialog-content"=>1010,_=>0};let offset=field(&overlay.config,"layerOffset");let offset=if offset.nullish(){0.}else{offset.num().trunc()};
    Some((bool_or(field(&overlay.config,"portal"),false),(10000.+overlay.layer_order as f64+role_offset as f64+offset).max(0.)as usize))
}
struct ViewportRoot{element:AnyElement}
impl gpui::IntoElement for ViewportRoot{type Element=Self;fn into_element(self)->Self{self}}
impl gpui::Element for ViewportRoot{
    type RequestLayoutState=();type PrepaintState=();fn id(&self)->Option<gpui::ElementId>{None}fn source_location(&self)->Option<&'static std::panic::Location<'static>>{None}
    fn request_layout(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,window:&mut Window,cx:&mut App)->(gpui::LayoutId,()){let child=self.element.request_layout(window,cx);let viewport=window.viewport_size();let layout=window.request_layout(gpui::Style{position:gpui::Position::Absolute,size:gpui::size(viewport.width.into(),viewport.height.into()),..Default::default()},[child],cx);(layout,())}
    fn prepaint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,bounds:Bounds<Pixels>,_:&mut (),window:&mut Window,cx:&mut App){window.with_element_offset(-bounds.origin,|window|self.element.prepaint(window,cx));}
    fn paint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut (),_:&mut (),window:&mut Window,cx:&mut App){self.element.paint(window,cx)}
}
struct ClippedLayer{element:AnyElement,mask:Rc<Cell<Option<gpui::ContentMask<Pixels>>>>}
impl gpui::IntoElement for ClippedLayer{type Element=Self;fn into_element(self)->Self{self}}
impl gpui::Element for ClippedLayer{
    type RequestLayoutState=();type PrepaintState=();fn id(&self)->Option<gpui::ElementId>{None}fn source_location(&self)->Option<&'static std::panic::Location<'static>>{None}
    fn request_layout(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,window:&mut Window,cx:&mut App)->(gpui::LayoutId,()){(self.element.request_layout(window,cx),())}
    fn prepaint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut (),window:&mut Window,cx:&mut App){window.with_content_mask(self.mask.get(),|window|self.element.prepaint(window,cx));}
    fn paint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut (),_:&mut (),window:&mut Window,cx:&mut App){window.with_content_mask(self.mask.get(),|window|self.element.paint(window,cx));}
}
struct OverlayLayer{element:Option<AnyElement>,mask:Option<Rc<Cell<Option<gpui::ContentMask<Pixels>>>>>,priority:usize}
impl gpui::IntoElement for OverlayLayer{type Element=Self;fn into_element(self)->Self{self}}
impl gpui::Element for OverlayLayer{
    type RequestLayoutState=();type PrepaintState=();fn id(&self)->Option<gpui::ElementId>{None}fn source_location(&self)->Option<&'static std::panic::Location<'static>>{None}
    fn request_layout(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,window:&mut Window,cx:&mut App)->(gpui::LayoutId,()){(self.element.as_mut().expect("layer content").request_layout(window,cx),())}
    fn prepaint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut (),window:&mut Window,_:&mut App){let mask=self.mask.as_ref().map(|mask|{let value=window.content_mask();mask.set(Some(value));value});let offset=window.element_offset();window.defer_draw(self.element.take().expect("layer content"),offset,self.priority,mask);}
    fn paint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut (),_:&mut (),_:&mut Window,_:&mut App){}
}
pub fn viewport_root(element:AnyElement)->AnyElement{gpui::deferred(ViewportRoot{element}).into_any_element()}
pub fn overlay_root(owner:&OwnerRef,element:AnyElement,fixed:bool)->AnyElement{
    let Some((portal,priority))=overlay_presentation(owner)else{return if fixed{viewport_root(element)}else{element}};let portal=portal||fixed;
    let(mask,element)=if portal{(None,ViewportRoot{element}.into_any_element())}else{let mask=Rc::new(Cell::new(None));(Some(mask.clone()),ClippedLayer{element,mask}.into_any_element())};
    OverlayLayer{element:Some(element),mask,priority}.into_any_element()
}
pub fn native_pointer_press(event:&gpui::MouseDownEvent,phase:gpui::DispatchPhase,window:&mut Window,cx:&mut App){
    if phase.capture(){POINTER_PRESS_DISPATCHED.with(|sample|sample.set(false));return}
    if !phase.bubble()||POINTER_PRESS_DISPATCHED.with(|sample|sample.replace(true)){return}
    native_boundary_press(event.position,window,cx);
}
`;
