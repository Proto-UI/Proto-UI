// Direct typed association and native view leases; appended to the shared owner.
export const gpuiNativeControlLabelSource = String.raw`
/// Opaque, same-SDK identity. It has no serialization or raw/structural constructor.
#[derive(Clone)]
pub struct ControlLabelRef(Rc<RefCell<ControlLabelGroup>>);
impl ControlLabelRef {pub fn new()->Self{Self(Rc::new(RefCell::new(ControlLabelGroup::default())))}}
impl Default for ControlLabelRef {fn default()->Self{Self::new()}}
#[derive(Clone,Default)]
pub struct NativeInstanceAssociations {pub control_label:Option<ControlLabelRef>}
#[derive(Default)]
struct ControlLabelGroup {next:u64,revision:u64,members:BTreeMap<u64,(OwnerWeak,Option<Rc<dyn Fn()>>)>}
struct ControlLabelBinding {reference:ControlLabelRef,id:u64}
impl Drop for ControlLabelBinding {fn drop(&mut self){self.reference.0.borrow_mut().members.remove(&self.id);control_label_changed(&self.reference);}}
#[derive(Default)]
pub struct ControlLabelModule {
    kind:Option<&'static str>,callback:Value,binding:Option<ControlLabelBinding>,notify:Option<Rc<dyn Fn()>>,
    naming:bool,activation:bool,view:Option<(u64,gpui::WindowId,Option<gpui::accesskit::NodeId>)>,pointer:Option<ControlLabelPointer>,
}
#[derive(Clone)]
struct ControlLabelPointer {pair:ControlLabelPair,origin:gpui::Point<Pixels>}
#[derive(Clone)]
struct ControlLabelPair {reference:ControlLabelRef,revision:u64,label:OwnerWeak,target:OwnerWeak,label_epoch:u64,target_epoch:u64}
impl ControlLabelPair {
    fn current(&self)->bool{
        if self.reference.0.borrow().revision!=self.revision{return false}
        let(Some(label),Some(target))=(self.label.upgrade(),self.target.upgrade())else{return false};
        if !ready(&label)||!ready(&target)||label.borrow().epoch!=self.label_epoch||target.borrow().epoch!=self.target_epoch{return false}
        let Ok(pair)=control_label_pair(&label,None)else{return false};
        Weak::ptr_eq(&pair.label,&self.label)&&Weak::ptr_eq(&pair.target,&self.target)&&label.borrow().modules.control_label.activation
    }
}
fn control_label_changed(reference:&ControlLabelRef){
    let notify={let mut group=reference.0.borrow_mut();group.revision=group.revision.wrapping_add(1);group.members.values().filter_map(|(_,notify)|notify.clone()).collect::<Vec<_>>()};
    for notify in notify{notify();}
}
pub fn configure_control_label_host(owner:&OwnerRef,notify:Rc<dyn Fn()>){owner.borrow_mut().modules.control_label.notify=Some(notify);}
/// This host input is separate from Props and has exactly one admitted reference family.
pub fn set_instance_associations(owner:&OwnerRef,associations:NativeInstanceAssociations){
    {let o=owner.borrow();if o.disposed{value_error("disposed native association recipient")}
    if o.phase!="setup"&&associations.control_label.is_some()&&o.modules.control_label.kind.is_none(){value_error("ControlLabel association recipient has no authored participant")}}
    let same={let o=owner.borrow();match(&o.modules.control_label.binding,&associations.control_label){(Some(binding),Some(next))=>Rc::ptr_eq(&binding.reference.0,&next.0),(None,None)=>true,_=>false}};if same{return}
    let notify=owner.borrow().modules.control_label.notify.clone();
    let old={let mut o=owner.borrow_mut();o.modules.control_label.pointer=None;o.dirty=true;o.modules.control_label.binding.take()};drop(old);
    if let Some(notify)=notify{notify();}
    if let Some(reference)=associations.control_label {
        let notify=owner.borrow().modules.control_label.notify.clone();
        let id={let mut group=reference.0.borrow_mut();group.next=group.next.checked_add(1).expect("native association registration overflow");let id=group.next;group.members.insert(id,(Rc::downgrade(owner),notify));id};
        owner.borrow_mut().modules.control_label.binding=Some(ControlLabelBinding{reference:reference.clone(),id});control_label_changed(&reference);
    }
}
pub fn control_label_finish(owner:&OwnerRef){if owner.borrow().modules.control_label.binding.is_some()&&owner.borrow().modules.control_label.kind.is_none(){value_error("ControlLabel association recipient has no authored participant")}}
pub fn control_label_declare(owner:&OwnerWeak,kind:&'static str,callback:Value)->Value{
    let owner=setup(owner);let mut o=owner.borrow_mut();let module=&mut o.modules.control_label;
    if module.kind.is_some(){value_error("one ControlLabel participant per logical owner")}
    module.kind=Some(kind);module.callback=callback;module.naming=true;module.activation=false;o.accessible=true;
    if kind=="label"{o.name_content=true;}Value::Handle(Rc::downgrade(&owner),"control-label-handle")
}
pub fn control_label_sync(owner:&OwnerWeak,options:Value)->Value{
    let owner=ensure(owner);let naming=options.member("naming",false).bool();let activation=options.member("activation",false).bool();
    let reference={let mut o=owner.borrow_mut();let module=&mut o.modules.control_label;if module.kind.is_none(){value_error("undeclared ControlLabel participant")}
        if module.naming==naming&&module.activation==activation{return Value::Undefined}module.naming=naming;module.activation=activation;module.pointer=None;let reference=module.binding.as_ref().map(|binding|binding.reference.clone());o.dirty=true;reference};
    if let Some(reference)=reference{control_label_changed(&reference);}Value::Undefined
}
pub fn control_label_commit(owner:&OwnerRef){
    // A logical participant may be painted through more than one native
    // parent. Keep an exact unique-node receipt, without treating each layout
    // frame as a new lease. Ambiguity and replacement retire pending input;
    // a stable ambiguous tree must not schedule an endless redraw loop.
    let view={let o=owner.borrow();if !ready(owner){None}else{o.window_id.map(|window|
        (o.epoch,window,if o.modules.a11y_frame!=0&&o.modules.a11y_bindings==1{o.modules.a11y_node}else{None}))}};
    let reference={let mut o=owner.borrow_mut();let module=&mut o.modules.control_label;if module.view==view{return}module.view=view;module.pointer=None;module.binding.as_ref().map(|binding|binding.reference.clone())};
    if let Some(reference)=reference{control_label_changed(&reference);}
}
pub fn control_label_detach(owner:&OwnerRef){
    let reference={let mut o=owner.borrow_mut();let module=&mut o.modules.control_label;module.view=None;module.pointer=None;module.binding.as_ref().map(|binding|binding.reference.clone())};
    if let Some(reference)=reference{control_label_changed(&reference);}
}
fn control_label_pair(owner:&OwnerRef,frame:Option<u64>)->Result<ControlLabelPair,&'static str>{
    let reference=owner.borrow().modules.control_label.binding.as_ref().map(|binding|binding.reference.clone()).ok_or("missing-binding")?;
    let (revision,members)={let group=reference.0.borrow();(group.revision,group.members.iter().map(|(id,(owner,_))|(*id,owner.clone())).collect::<Vec<_>>())};
    let window=owner.borrow().window_id;let mut labels=Vec::new();let mut targets=Vec::new();
    for(id,candidate)in members{let Some(candidate)=candidate.upgrade()else{continue};let o=candidate.borrow();let module=&o.modules.control_label;
        if o.disposed||!o.present||!module.binding.as_ref().is_some_and(|binding|binding.id==id&&Rc::ptr_eq(&binding.reference.0,&reference.0)){continue}
        let current_frame=frame.is_some_and(|frame|o.window_id==window&&o.modules.a11y_frame==frame&&o.modules.a11y_bindings==1);
        if !(o.mounted&&o.bounds.is_some()||current_frame){continue}
        match module.kind{Some("label")=>labels.push(candidate.clone()),Some("target")=>targets.push(candidate.clone()),_=>{}}
    }
    if labels.len()>1||targets.len()>1{return Err("duplicate-binding")}
    if labels.len()!=1||targets.len()!=1{return Err("missing-binding")}
    let label=labels.remove(0);let target=targets.remove(0);let l=label.borrow();let t=target.borrow();
    if l.window_id.is_none()||l.window_id!=t.window_id{return Err("foreign-tree-scope")}
    if l.modules.a11y_bindings>1||t.modules.a11y_bindings>1{return Err("ambiguous-view")}
    let frame=frame.unwrap_or(l.modules.a11y_frame);
    if frame==0||l.modules.a11y_frame!=frame||t.modules.a11y_frame!=frame||l.modules.a11y_bindings!=1||t.modules.a11y_bindings!=1
        ||l.modules.a11y_node.is_none()||t.modules.a11y_node.is_none(){return Err("missing-view")}
    Ok(ControlLabelPair{reference,revision,label:Rc::downgrade(&label),target:Rc::downgrade(&target),label_epoch:l.epoch,target_epoch:t.epoch})
}
fn control_label_name_conflict(target:&OwnerRef)->bool{
    let(name,relation)={let o=target.borrow();(o.modules.accessible_text.get("name").cloned(),o.modules.accessible_relations.get("labelledBy").cloned())};
    if name.is_some_and(|name|{let name=resolved(&name);!name.nullish()&&!matches!(name,Value::Json(Json::String(name))if name.is_empty())}){return true}
    relation.is_some_and(|spec|{let target=resolved(&spec.member("target",false));!target.nullish()&&!matches!(target,Value::Json(Json::String(text))if text.trim().is_empty())})
}
pub fn control_label_diagnostic(owner:&OwnerRef)->Option<&'static str>{
    let pair=match control_label_pair(owner,None){Ok(pair)=>pair,Err(code)=>return Some(code)};let label=pair.label.upgrade()?;let target=pair.target.upgrade()?;
    if label.borrow().modules.control_label.naming&&control_label_name_conflict(&target){Some("name-conflict")}
    else if label.borrow().modules.control_label.activation&&!control_label_passive_content(&label){Some("unsupported-pointer-content")}else{None}
}
pub fn control_label_name_node(owner:&OwnerRef)->Option<gpui::accesskit::NodeId>{
    let(frame,kind)={let o=owner.borrow();(o.modules.a11y_frame,o.modules.control_label.kind)};if kind!=Some("target")||frame==0{return None}
    let pair=control_label_pair(owner,Some(frame)).ok()?;let label=pair.label.upgrade()?;
    if !label.borrow().modules.control_label.naming||control_label_name_conflict(owner){return None}
    let node=label.borrow().modules.a11y_node;node
}
fn control_label_passive_content(owner:&OwnerRef)->bool{let o=owner.borrow();o.projection.as_ref().is_some_and(|projection|projection.passive_content)&&o.slot.iter().all(|child|child.passive_content)}
pub fn control_label_is_label(owner:&OwnerRef)->bool{owner.borrow().modules.control_label.kind==Some("label")}
pub fn control_label_action_enabled(owner:&OwnerRef)->bool{let o=owner.borrow();o.modules.control_label.kind==Some("label")&&o.modules.control_label.activation}
pub fn control_label_action_available(owner:&OwnerRef)->bool{control_label_action_enabled(owner)&&control_label_pair(owner,Some(owner.borrow().modules.a11y_frame)).is_ok()}
fn control_label_invoke(pair:ControlLabelPair,source:&'static str,window:&mut Window,cx:&mut App)->bool{
    if !pair.current(){return false}let Some(target)=pair.target.upgrade()else{return false};
    if target.borrow().window_id!=Some(window.window_handle().window_id()){return false}
    let callback=target.borrow().modules.control_label.callback.clone();let current=pair.clone();
    let request=record(vec![("source",Value::string(source)),("isCurrent",Value::Function(Rc::new(move |_|Value::boolean(current.current()))))]);
    native_host_callback(&target,"control-label",||invoke(&target,"callback",&callback,vec![capability(&Rc::downgrade(&target)),request]));
    let drive=target.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx);}true
}
/// Called only by the registered native AccessKit action, never by an Expose signal.
pub fn control_label_accessibility_action(owner:&OwnerRef,window:&mut Window,cx:&mut App)->bool{
    if !control_label_action_enabled(owner){return false}let Ok(pair)=control_label_pair(owner,None)else{return false};control_label_invoke(pair,"accessibility",window,cx)
}
pub fn control_label_request_current(request:Value)->Value{request.member("isCurrent",false).call_authored(vec![])}
fn control_label_unmodified(modifiers:gpui::Modifiers)->bool{!modifiers.control&&!modifiers.alt&&!modifiers.shift&&!modifiers.platform&&!modifiers.function}
pub fn control_label_pointer_down(owner:&OwnerRef,event:&gpui::MouseDownEvent,prevented:bool){
    owner.borrow_mut().modules.control_label.pointer=None;
    if prevented||event.button!=gpui::MouseButton::Left||!control_label_unmodified(event.modifiers)||!control_label_action_enabled(owner)||!control_label_passive_content(owner){return}
    let Ok(pair)=control_label_pair(owner,None)else{return};if !pair.current(){return}
    owner.borrow_mut().modules.control_label.pointer=Some(ControlLabelPointer{pair,origin:event.position});
}
pub fn control_label_pointer_move(owner:&OwnerRef,event:&gpui::MouseMoveEvent){
    let cancel={let o=owner.borrow();o.modules.control_label.pointer.as_ref().is_some_and(|pointer|{let delta=event.position-pointer.origin;f32::from(delta.x).abs()>6.||f32::from(delta.y).abs()>6.||event.pressed_button!=Some(gpui::MouseButton::Left)})};
    if cancel{control_label_pointer_cancel(owner);}
}
pub fn control_label_pointer_cancel(owner:&OwnerRef){owner.borrow_mut().modules.control_label.pointer=None;}
pub fn control_label_pointer_click(owner:&OwnerRef,event:&gpui::ClickEvent,prevented:bool,window:&mut Window,cx:&mut App)->bool{
    let pending=owner.borrow_mut().modules.control_label.pointer.take();let Some(pending)=pending else{return false};
    let gpui::ClickEvent::Mouse(event)=event else{return false};let delta=event.up.position-pending.origin;
    if prevented||event.down.button!=gpui::MouseButton::Left||event.up.button!=gpui::MouseButton::Left||!control_label_unmodified(event.down.modifiers)||!control_label_unmodified(event.up.modifiers)||f32::from(delta.x).abs()>6.||f32::from(delta.y).abs()>6.||!control_label_passive_content(owner){return false}
    control_label_invoke(pending.pair,"pointer",window,cx)
}

#[cfg(all(test,feature="test-support"))]
mod control_label_lease_tests {
    use super::*;
    use gpui::{AppContext,Render,Context,TestAppContext};
    struct Empty;
    impl Render for Empty {fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{div()}}
    fn owner(window:&Window,kind:&'static str,reference:&ControlLabelRef,callback:Value)->OwnerRef{
        let owner=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        let weak=Rc::downgrade(&owner);control_label_declare(&weak,kind,callback);
        control_label_sync(&weak,record(vec![("naming",Value::boolean(true)),("activation",Value::boolean(true))]));
        set_instance_associations(&owner,NativeInstanceAssociations{control_label:Some(reference.clone())});Owner::finish(&owner,Value::Undefined);
        {let mut o=owner.borrow_mut();o.window_id=Some(window.window_handle().window_id());o.mounted=true;o.bounds=Some(Bounds::default());o.epoch=1;
            o.modules.a11y_frame=1;o.modules.a11y_bindings=1;o.modules.a11y_node=Some(gpui::accesskit::NodeId(if kind=="label"{1}else{2}));}
        control_label_commit(&owner);
        owner
    }
    #[gpui::test]
    fn reentrant_rebinding_retires_the_old_request_even_if_identity_is_restored(cx:&mut TestAppContext){
        let window=cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap());
        window.update(cx,|_,window,cx|{
            let reference=ControlLabelRef::new();let label=owner(window,"label",&reference,Value::Undefined);
            let label_weak=Rc::downgrade(&label);let same=reference.clone();let calls=Rc::new(Cell::new(0));let called=calls.clone();
            let callback=Value::Function(Rc::new(move|arguments|{
                let request=arguments[1].clone();assert_eq!(request.member("source",false).text(),"accessibility");
                assert!(control_label_request_current(request.clone()).bool());
                let label=label_weak.upgrade().unwrap();set_instance_associations(&label,NativeInstanceAssociations::default());
                assert!(!control_label_request_current(request.clone()).bool());
                set_instance_associations(&label,NativeInstanceAssociations{control_label:Some(same.clone())});
                assert!(!control_label_request_current(request).bool(),"restoring the ref cannot restore an old request turn");
                called.set(called.get()+1);Value::Undefined
            }));
            let target=owner(window,"target",&reference,callback);
            assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(calls.get(),1);
            assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(calls.get(),2);
            let stale=control_label_pair(&label,None).unwrap();detach_native_view(&target);assert!(!stale.current());
            {let mut o=target.borrow_mut();o.mounted=true;o.bounds=Some(Bounds::default());o.epoch+=1;
                o.modules.a11y_frame=1;o.modules.a11y_bindings=1;o.modules.a11y_node=Some(gpui::accesskit::NodeId(2));}
            control_label_commit(&target);
            assert!(!stale.current());assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(calls.get(),3);
            Owner::dispose(&label);Owner::dispose(&target);
        }).unwrap();
    }
    #[gpui::test]
    fn explicit_name_conflict_keeps_activation_and_drops_only_association_name(cx:&mut TestAppContext){
        let window=cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap());
        window.update(cx,|_,window,cx|{
            let reference=ControlLabelRef::new();let label=owner(window,"label",&reference,Value::Undefined);
            let calls=Rc::new(Cell::new(0));let called=calls.clone();let target=owner(window,"target",&reference,Value::Function(Rc::new(move|_|{called.set(called.get()+1);Value::Undefined})));
            target.borrow_mut().modules.accessible_text.insert("name".into(),Value::string("Consumer name"));
            assert_eq!(control_label_diagnostic(&label),Some("name-conflict"));assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(calls.get(),1);
            set_instance_associations(&target,NativeInstanceAssociations::default());assert_eq!(target.borrow().modules.accessible_text["name"].text(),"Consumer name");
            assert!(!control_label_accessibility_action(&label,window,cx));Owner::dispose(&label);Owner::dispose(&target);
        }).unwrap();
    }
    #[gpui::test]
    fn pending_requests_cannot_revive_after_unique_node_replacement_or_physical_ambiguity(cx:&mut TestAppContext){
        let window=cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap());
        window.update(cx,|_,window,cx|{
            let reference=ControlLabelRef::new();let label=owner(window,"label",&reference,Value::Undefined);
            let retained=Rc::new(RefCell::new(Value::Undefined));let captured=retained.clone();
            let target=owner(window,"target",&reference,Value::Function(Rc::new(move|arguments|{
                *captured.borrow_mut()=arguments[1].clone();Value::Undefined
            })));
            assert!(control_label_accessibility_action(&label,window,cx));let original=retained.borrow().clone();
            assert!(control_label_request_current(original.clone()).bool());
            target.borrow_mut().modules.a11y_node=Some(gpui::accesskit::NodeId(3));control_label_commit(&target);
            assert!(!control_label_request_current(original.clone()).bool(),"a new physical node is a new view lease even if its owner and window stay the same");
            assert!(control_label_accessibility_action(&label,window,cx));let replaced=retained.borrow().clone();
            target.borrow_mut().modules.a11y_node=Some(gpui::accesskit::NodeId(2));control_label_commit(&target);
            assert!(!control_label_request_current(original).bool());assert!(!control_label_request_current(replaced).bool());
            assert!(control_label_accessibility_action(&label,window,cx));let unique=retained.borrow().clone();
            target.borrow_mut().modules.a11y_bindings=2;control_label_commit(&target);
            assert_eq!(control_label_diagnostic(&label),Some("ambiguous-view"));
            assert!(!control_label_accessibility_action(&label,window,cx));assert!(!control_label_request_current(unique.clone()).bool());
            let ambiguous_revision=reference.0.borrow().revision;control_label_commit(&target);
            assert_eq!(reference.0.borrow().revision,ambiguous_revision,"stable ambiguity does not repeatedly notify or invalidate");
            target.borrow_mut().modules.a11y_bindings=1;control_label_commit(&target);
            assert!(!control_label_request_current(unique).bool());
            assert!(control_label_accessibility_action(&label,window,cx));assert!(control_label_request_current(retained.borrow().clone()).bool());
            Owner::dispose(&label);Owner::dispose(&target);
        }).unwrap();
    }
    #[test]
    fn undeclared_recipient_is_rejected_without_touching_json_props(){
        let owner=Owner::new(serde_json::json!({"business":3}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        set_instance_associations(&owner,NativeInstanceAssociations{control_label:Some(ControlLabelRef::new())});
        assert!(catch_authored(||control_label_finish(&owner)).is_err());assert_eq!(owner.borrow().raw,serde_json::json!({"business":3}));Owner::dispose(&owner);
    }
}
`;
