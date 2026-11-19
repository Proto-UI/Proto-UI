// Move Gesture host capability for the GPUI target.
//
// C-MOVE-GESTURE-0001 / HC-MOVE-GESTURE-0001: one bounded continuous-movement
// session per attached binding. This is a native host capability, not a portable
// author API: D-MOVE-GESTURE-0001 forbids publishing `asMove()`/`asDrag()`, and
// no portable author surface exposes pointer coordinates.
//
// The pinned GPUI revision does expose a public pointer-capture API
// (Window::capture_pointer), but this realization does not depend on it. The host
// gesture arena claims a touch contact once, at its start position, and keeps
// routing that contact to the window, so the session owns the contact itself:
// recognition is immediate (a primary mouse-down inside the target's physical
// bounds, or a touch that starts inside it), and the session continues to receive
// window-scoped events after the contact leaves those bounds. A contact that
// leaves the window, or a target that is detached, disposed or replaced, ends the
// session with an explicit cancel reason.
//
// One contact owns one session. A touch contact is claimed in the host arena with
// prevent_default on the touch drag start, keeps the arena's original start
// position as its origin, and continues outside the target while the window still
// owns it. Mouse input is ignored while a touch contact is live, touch input is
// ignored while a mouse contact is live. Host cancellation, target replacement
// and detach end the session exactly once.
export const gpuiNativeMoveSource = String.raw`use std::cell::{Cell,RefCell};
use std::collections::BTreeMap;
use std::rc::{Rc,Weak};
use std::sync::OnceLock;
use std::time::Instant;
use gpui::{App,MouseButton,MouseDownEvent,MouseExitEvent,MouseMoveEvent,MouseUpEvent,Point,Pixels,TouchDragEvent,TouchPhase,Window};
use crate::gpui_native_owner::{native_host_hit,OwnerRef,OwnerWeak};

/// A host-local point. Units are the host's own pixels and never portable author state.
#[derive(Clone,Copy,Debug,PartialEq)]
pub struct MoveGesturePoint{pub x:f64,pub y:f64}

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum MoveGestureInput{Mouse,Touch,Pen,Unknown}

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum MoveGestureCancelReason{HostCancel,LostOwnership,TargetDetached,TargetReplaced,Disposed}

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum MoveGestureAxis{Horizontal,Vertical,Both}

#[derive(Clone,Copy,Debug,PartialEq,Eq)]
pub enum MoveGestureActivation{Immediate,Directional}

/// One accepted sample.
///
/// \`position\` is target-local: the host point minus the target's live hitbox origin.
/// \`delta\` and \`total_delta\` are pointer displacements measured in window space, so
/// they stay correct when the target scrolls or resizes between samples.
#[derive(Clone,Copy,Debug)]
pub struct MoveGestureSample{
    pub input:MoveGestureInput,
    pub position:MoveGesturePoint,
    pub delta:MoveGesturePoint,
    pub total_delta:MoveGesturePoint,
    pub timestamp:u64,
    pub modifiers:gpui::Modifiers,
}

/// The live host, supplied only when a cancel happens while a window and app still exist.
pub struct MoveGestureCancelContext<'a>{pub window:&'a mut Window,pub cx:&'a mut App}

/// A consumer binding. Callbacks receive the live host so a consumer can update
/// entities, move focus and drive projection. \`on_cancel\` receives the host only
/// when one still exists; a detach or dispose cancel carries no host.
pub trait MoveGestureBinding{
    /// Recognition hint only. It never derives Scroll, Slider, Resize, Drop or A11y semantics.
    fn axis(&self)->MoveGestureAxis{MoveGestureAxis::Both}
    /// Only \`Immediate\` is admitted by this GPUI realization.
    fn activation(&self)->MoveGestureActivation{MoveGestureActivation::Immediate}
    fn should_start(&self,_sample:&MoveGestureSample,_window:&mut Window,_cx:&mut App)->bool{true}
    fn on_start(&self,_sample:&MoveGestureSample,_window:&mut Window,_cx:&mut App){}
    fn on_move(&self,_sample:&MoveGestureSample,_window:&mut Window,_cx:&mut App){}
    fn on_end(&self,_sample:&MoveGestureSample,_window:&mut Window,_cx:&mut App){}
    fn on_cancel(&self,_reason:MoveGestureCancelReason,_context:Option<MoveGestureCancelContext<'_>>){}
}

struct MoveSession{binding:Rc<dyn MoveGestureBinding>,input:MoveGestureInput,start:Point<Pixels>,previous:Point<Pixels>}
struct MoveEntry{id:u64,target:OwnerWeak,binding:Rc<dyn MoveGestureBinding>,axis:MoveGestureAxis,session:Option<MoveSession>}

thread_local!{
    static MOVE_ENTRIES:RefCell<BTreeMap<u64,MoveEntry>>=RefCell::new(BTreeMap::new());
    static MOVE_NEXT_ID:Cell<u64>=Cell::new(1);
    static MOVE_DISPATCHED:Cell<bool>=Cell::new(false);
    static MOVE_TOUCH_DISPATCHED:Cell<bool>=Cell::new(false);
}

fn same_owner(left:&OwnerWeak,right:&OwnerWeak)->bool{Weak::ptr_eq(left,right)}
fn now_millis()->u64{static BASE:OnceLock<Instant>=OnceLock::new();BASE.get_or_init(Instant::now).elapsed().as_millis() as u64}
fn live_origin(owner:&OwnerRef)->Option<Point<Pixels>>{owner.borrow().native_hitbox.as_ref().map(|hitbox|hitbox.bounds.origin)}
fn local_point(point:Point<Pixels>,origin:Point<Pixels>)->MoveGesturePoint{
    MoveGesturePoint{x:f64::from(f32::from(point.x))-f64::from(f32::from(origin.x)),y:f64::from(f32::from(point.y))-f64::from(f32::from(origin.y))}
}
fn window_delta(point:Point<Pixels>,previous:Point<Pixels>)->MoveGesturePoint{
    MoveGesturePoint{x:f64::from(f32::from(point.x))-f64::from(f32::from(previous.x)),y:f64::from(f32::from(point.y))-f64::from(f32::from(previous.y))}
}

fn has_live_session(window:&Window)->bool{
    MOVE_ENTRIES.with(|entries|entries.borrow().values().any(|entry|entry.session.is_some()&&entry.target.upgrade().is_some_and(|owner|owns_window(&owner,window))))
}

/// Attach a move gesture to a generated host target.
///
/// The target is an owner that already exists; it need not be mounted yet. Recognition
/// stays gated on the first committed mount, so the host resolves the target's physical
/// bounds and hit participation only once the target is live.
pub fn attach_move_gesture(target:OwnerWeak,binding:Box<dyn MoveGestureBinding>)->Result<MoveGestureLease,String>{
    let Some(owner)=target.upgrade()else{return Err("move gesture target is no longer available".to_string())};
    if owner.borrow().disposed||owner.borrow().disposing{return Err("move gesture target is disposed".to_string())}
    if binding.activation()!=MoveGestureActivation::Immediate{
        return Err("move gesture activation other than immediate is not admitted by this GPUI realization".to_string());
    }
    let binding:Rc<dyn MoveGestureBinding>=Rc::from(binding);
    let axis=binding.axis();
    let id=MOVE_NEXT_ID.with(|next|{let id=next.get();next.set(id.wrapping_add(1));id});
    let busy=MOVE_ENTRIES.with(|entries|entries.borrow().values().any(|entry|same_owner(&entry.target,&target)));
    if busy{return Err("move gesture target already has an attached lease".to_string())}
    MOVE_ENTRIES.with(|entries|entries.borrow_mut().insert(id,MoveEntry{id,target,binding,axis,session:None}));
    Ok(MoveGestureLease{id})
}

/// The lease owns the attached binding and any accepted session.
pub struct MoveGestureLease{id:u64}

impl MoveGestureLease{
    /// Whether a session is currently accepted for this lease.
    pub fn is_active(&self)->bool{MOVE_ENTRIES.with(|entries|entries.borrow().get(&self.id).is_some_and(|entry|entry.session.is_some()))}
    /// The attached target.
    pub fn target(&self)->OwnerWeak{MOVE_ENTRIES.with(|entries|entries.borrow().get(&self.id).map(|entry|entry.target.clone()).unwrap_or_default())}
    /// The recognition hint this lease was attached with.
    pub fn axis(&self)->Option<MoveGestureAxis>{MOVE_ENTRIES.with(|entries|entries.borrow().get(&self.id).map(|entry|entry.axis))}
    /// End the current session only. The binding stays attached, so a later contact may
    /// start a new session. Use this for an explicit consumer cancellation.
    pub fn cancel(&self,reason:MoveGestureCancelReason,window:&mut Window,cx:&mut App){cancel_session(self.id,reason,Some((window,cx)))}
    /// Permanently release the binding and any accepted session.
    pub fn dispose(&self){
        let released=MOVE_ENTRIES.with(|entries|entries.borrow_mut().remove(&self.id));
        if let Some(entry)=released{if let Some(session)=entry.session{session.binding.on_cancel(MoveGestureCancelReason::Disposed,None)}}
    }
    /// Replace the attached binding, and optionally the target.
    ///
    /// Replacing the target while a session is accepted ends that session with
    /// \`TargetReplaced\`. Replacing only the binding keeps the accepted session.
    pub fn update(&self,target:OwnerWeak,binding:Box<dyn MoveGestureBinding>,window:&mut Window,cx:&mut App)->Result<(),String>{
        let Some(owner)=target.upgrade()else{return Err("move gesture target is no longer available".to_string())};
        if owner.borrow().disposed||owner.borrow().disposing{return Err("move gesture target is disposed".to_string())}
        if binding.activation()!=MoveGestureActivation::Immediate{
            return Err("move gesture activation other than immediate is not admitted by this GPUI realization".to_string());
        }
        let binding:Rc<dyn MoveGestureBinding>=Rc::from(binding);
        let axis=binding.axis();
        let replaced=MOVE_ENTRIES.with(|entries|{
            let entries=entries.borrow();
            let Some(entry)=entries.get(&self.id)else{return Err("move gesture lease is disposed".to_string())};
            if entries.values().any(|entry|entry.id!=self.id&&same_owner(&entry.target,&target)){return Err("move gesture target already has an attached lease".to_string())}
            Ok(!same_owner(&entry.target,&target))
        })?;
        if replaced{cancel_session(self.id,MoveGestureCancelReason::TargetReplaced,Some((window,cx)))}
        let previous=MOVE_ENTRIES.with(|entries|{
            let mut entries=entries.borrow_mut();
            if let Some(entry)=entries.get_mut(&self.id){
                entry.target=target;
                entry.axis=axis;
                Some(std::mem::replace(&mut entry.binding,binding))
            }else{None}
        });
        drop(previous);
        Ok(())
    }
}

impl Drop for MoveGestureLease{fn drop(&mut self){self.dispose()}}

fn cancel_session(id:u64,reason:MoveGestureCancelReason,host:Option<(&mut Window,&mut App)>){
    let cancelled=MOVE_ENTRIES.with(|entries|{
        let mut entries=entries.borrow_mut();
        let Some(entry)=entries.get_mut(&id)else{return None};
        entry.session.take().map(|session|session.binding)
    });
    let Some(binding)=cancelled else{return};
    match host{
        Some((window,cx))=>binding.on_cancel(reason,Some(MoveGestureCancelContext{window,cx})),
        None=>binding.on_cancel(reason,None),
    }
}

/// Whether this owner carries an attached move gesture. The owner installs the
/// window-scoped listeners during paint only when a binding is present, so a plain
/// component pays no listener and no per-event cost.
pub fn move_owner_has_binding(owner:&OwnerRef)->bool{
    let weak=Rc::downgrade(owner);
    MOVE_ENTRIES.with(|entries|entries.borrow().values().any(|entry|same_owner(&entry.target,&weak)))
}

/// Install the window-scoped mouse and touch listeners that carry a move session.
pub fn register_move_input(window:&mut Window,target:OwnerWeak){
    let id=MOVE_ENTRIES.with(|entries|entries.borrow().values().find(|entry|same_owner(&entry.target,&target)).map(|entry|entry.id));
    let Some(id)=id else{return};
    window.on_mouse_event::<MouseDownEvent>(|event,phase,window,cx|move_mouse_down(event,phase,window,cx));
    let moved=target.clone();
    window.on_mouse_event::<MouseMoveEvent>(move|event,phase,window,cx|move_mouse_move(event,phase,id,&moved,window,cx));
    let released=target.clone();
    window.on_mouse_event::<MouseUpEvent>(move|event,phase,window,cx|move_mouse_up(event,phase,id,&released,window,cx));
    let exited=target.clone();
    window.on_mouse_event::<MouseExitEvent>(move|event,phase,window,cx|move_mouse_exit(event,phase,id,&exited,window,cx));
    window.on_mouse_event::<TouchDragEvent>(move|event,phase,window,cx|move_touch_drag(event,phase,id,&target,window,cx));
}

pub fn move_blur(owner:&OwnerRef){
    let weak=Rc::downgrade(owner);
    let id=MOVE_ENTRIES.with(|entries|entries.borrow().values().find(|entry|same_owner(&entry.target,&weak)).map(|entry|entry.id));
    if let Some(id)=id{cancel_session(id,MoveGestureCancelReason::LostOwnership,None)}
}

fn owns_window(owner:&OwnerRef,window:&Window)->bool{
    owner.borrow().window_id==Some(window.window_handle().window_id())
}

/// Cancel the session of a target whose native view detached. The binding stays
/// attached, so the same target may start a new session once it is live again.
pub fn move_detach(owner:&OwnerRef){
    let weak=Rc::downgrade(owner);
    let id=MOVE_ENTRIES.with(|entries|entries.borrow().values().find(|entry|same_owner(&entry.target,&weak)).map(|entry|entry.id));
    if let Some(id)=id{cancel_session(id,MoveGestureCancelReason::TargetDetached,None)}
}

/// Cancel the session of a target that is being disposed and release its binding.
pub fn move_dispose(owner:&OwnerRef){
    let weak=Rc::downgrade(owner);
    let released=MOVE_ENTRIES.with(|entries|{
        let mut entries=entries.borrow_mut();
        let id=entries.values().find(|entry|same_owner(&entry.target,&weak))?.id;
        entries.remove(&id)
    });
    if let Some(entry)=released{if let Some(session)=entry.session{session.binding.on_cancel(MoveGestureCancelReason::Disposed,None)}}
}

fn move_mouse_down(event:&MouseDownEvent,phase:gpui::DispatchPhase,window:&mut Window,cx:&mut App){
    if phase.capture(){MOVE_DISPATCHED.with(|dispatched|dispatched.set(false));return}
    if !phase.bubble()||MOVE_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
    if event.button!=MouseButton::Left{return}
    // One contact owns one window: a live touch contact ignores mouse input.
    if has_live_session(window){return}
    let candidate=MOVE_ENTRIES.with(|entries|{
        let entries=entries.borrow();
        let mut best:Option<(u64,OwnerRef,u64)>=None;
        for entry in entries.values(){
            let Some(owner)=entry.target.upgrade()else{continue};
            if !owns_window(&owner,window){continue}
            if !native_host_hit(&owner,event.position,window){continue}
            let order=owner.borrow().modules.topology.order;
            if best.as_ref().map_or(true,|(_,_,current)|order>*current){best=Some((entry.id,owner,order))}
        }
        best
    });
    let Some((id,owner,_))=candidate else{return};
    let Some(origin)=live_origin(&owner)else{return};
    let binding=MOVE_ENTRIES.with(|entries|entries.borrow().get(&id).map(|entry|entry.binding.clone()));
    let Some(binding)=binding else{return};
    let sample=MoveGestureSample{
        input:MoveGestureInput::Mouse,
        position:local_point(event.position,origin),
        delta:MoveGesturePoint{x:0.0,y:0.0},
        total_delta:MoveGesturePoint{x:0.0,y:0.0},
        timestamp:now_millis(),
        modifiers:event.modifiers,
    };
    if !binding.should_start(&sample,window,cx){return}
    if !native_host_hit(&owner,event.position,window){return}
    let accepted=MOVE_ENTRIES.with(|entries|{
        let mut entries=entries.borrow_mut();
        if entries.values().any(|entry|entry.session.is_some()&&entry.target.upgrade().is_some_and(|owner|owns_window(&owner,window))){return false}
        let Some(entry)=entries.get_mut(&id)else{return false};
        if !same_owner(&entry.target,&Rc::downgrade(&owner))||!Rc::ptr_eq(&entry.binding,&binding){return false}
        if entry.session.is_some(){return false}
        entry.session=Some(MoveSession{binding:binding.clone(),input:MoveGestureInput::Mouse,start:event.position,previous:event.position});
        true
    });
    if !accepted{return}
    binding.on_start(&sample,window,cx);
}

fn move_mouse_move(event:&MouseMoveEvent,phase:gpui::DispatchPhase,id:u64,target:&OwnerWeak,window:&mut Window,cx:&mut App){
    if !phase.capture(){return}
    let active=MOVE_ENTRIES.with(|entries|{
        let entries=entries.borrow();
        let entry=entries.get(&id)?;
        if !same_owner(&entry.target,target){return None}
        let session=entry.session.as_ref()?;
        if session.input!=MoveGestureInput::Mouse{return None}
        let owner=entry.target.upgrade()?;
        if !owns_window(&owner,window){return None}
        Some((entry.id,session.binding.clone(),session.start,session.previous,owner))
    });
    let Some((id,binding,start,previous,owner))=active else{return};
    if event.pressed_button!=Some(MouseButton::Left){cancel_session(id,MoveGestureCancelReason::LostOwnership,Some((window,cx)));return}
    let Some(origin)=live_origin(&owner)else{cancel_session(id,MoveGestureCancelReason::TargetDetached,Some((window,cx)));return};
    let sample=MoveGestureSample{
        input:MoveGestureInput::Mouse,
        position:local_point(event.position,origin),
        delta:window_delta(event.position,previous),
        total_delta:window_delta(event.position,start),
        timestamp:now_millis(),
        modifiers:event.modifiers,
    };
    let updated=MOVE_ENTRIES.with(|entries|{
        let mut entries=entries.borrow_mut();
        let Some(entry)=entries.get_mut(&id)else{return false};
        let Some(session)=entry.session.as_mut()else{return false};
        session.previous=event.position;
        true
    });
    if !updated{return}
    binding.on_move(&sample,window,cx);
}

fn move_mouse_up(event:&MouseUpEvent,phase:gpui::DispatchPhase,id:u64,target:&OwnerWeak,window:&mut Window,cx:&mut App){
    if !phase.capture(){return}
    if event.button!=MouseButton::Left{return}
    let active=MOVE_ENTRIES.with(|entries|{
        let entries=entries.borrow();
        let entry=entries.get(&id)?;
        if !same_owner(&entry.target,target){return None}
        let session=entry.session.as_ref()?;
        if session.input!=MoveGestureInput::Mouse{return None}
        let owner=entry.target.upgrade()?;
        if !owns_window(&owner,window){return None}
        Some((entry.id,session.binding.clone(),session.start,session.previous,owner))
    });
    let Some((id,binding,start,previous,owner))=active else{return};
    let Some(origin)=live_origin(&owner)else{cancel_session(id,MoveGestureCancelReason::TargetDetached,Some((window,cx)));return};
    let sample=MoveGestureSample{
        input:MoveGestureInput::Mouse,
        position:local_point(event.position,origin),
        delta:window_delta(event.position,previous),
        total_delta:window_delta(event.position,start),
        timestamp:now_millis(),
        modifiers:event.modifiers,
    };
    let ended=MOVE_ENTRIES.with(|entries|{
        let mut entries=entries.borrow_mut();
        let Some(entry)=entries.get_mut(&id)else{return false};
        entry.session.take().is_some()
    });
    if !ended{return}
    binding.on_end(&sample,window,cx);
}

fn move_mouse_exit(_event:&MouseExitEvent,phase:gpui::DispatchPhase,id:u64,target:&OwnerWeak,window:&mut Window,cx:&mut App){
    if !phase.capture(){return}
    let owned=MOVE_ENTRIES.with(|entries|entries.borrow().get(&id).is_some_and(|entry|same_owner(&entry.target,target)&&entry.session.as_ref().is_some_and(|session|session.input==MoveGestureInput::Mouse)&&entry.target.upgrade().is_some_and(|owner|owns_window(&owner,window))));
    if owned{cancel_session(id,MoveGestureCancelReason::LostOwnership,Some((window,cx)))}
}

/// The window-scoped touch listener that carries a touch session.
///
/// The host gesture arena offers a touch drag at the contact's start position and
/// keeps routing that contact to the window while the drag is claimed. The claim
/// is taken with prevent_default on the started drag, which is what tells the
/// arena that this window owns the contact.
fn move_touch_drag(event:&TouchDragEvent,phase:gpui::DispatchPhase,id:u64,target:&OwnerWeak,window:&mut Window,cx:&mut App){
    if event.phase==TouchPhase::Started{
        if phase.capture(){MOVE_TOUCH_DISPATCHED.with(|dispatched|dispatched.set(false));return}
        if !phase.bubble()||MOVE_TOUCH_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
        move_touch_start(event,window,cx);
        return
    }
    if !phase.capture(){return}
    let active=MOVE_ENTRIES.with(|entries|{
        let entries=entries.borrow();
        let entry=entries.get(&id)?;
        if !same_owner(&entry.target,target){return None}
        let session=entry.session.as_ref()?;
        if session.input!=MoveGestureInput::Touch||session.start!=event.start_position{return None}
        let owner=entry.target.upgrade()?;
        if !owns_window(&owner,window){return None}
        Some((session.binding.clone(),session.start,session.previous,owner))
    });
    let Some((binding,start,previous,owner))=active else{return};
    if event.phase==TouchPhase::Cancelled{cancel_session(id,MoveGestureCancelReason::HostCancel,Some((window,cx)));return}
    let Some(origin)=live_origin(&owner)else{cancel_session(id,MoveGestureCancelReason::TargetDetached,Some((window,cx)));return};
    let sample=MoveGestureSample{
        input:MoveGestureInput::Touch,
        position:local_point(event.position,origin),
        delta:window_delta(event.position,previous),
        total_delta:window_delta(event.position,start),
        timestamp:now_millis(),
        modifiers:window.modifiers(),
    };
    let ended=event.phase==TouchPhase::Ended;
    let updated=MOVE_ENTRIES.with(|entries|{
        let mut entries=entries.borrow_mut();
        let Some(entry)=entries.get_mut(&id)else{return false};
        let Some(session)=entry.session.as_mut()else{return false};
        if ended{entry.session.take();}else{session.previous=event.position;}
        true
    });
    if !updated{return}
    if ended{binding.on_end(&sample,window,cx)}else{binding.on_move(&sample,window,cx)}
}

/// Start a touch session for a contact that begins inside the target.
///
/// The contact is recognized against the target's live hitbox at the arena's
/// start position, and the session keeps that start position as its origin.
fn move_touch_start(event:&TouchDragEvent,window:&mut Window,cx:&mut App){
    if has_live_session(window){return}
    let candidate=MOVE_ENTRIES.with(|entries|{
        let entries=entries.borrow();
        let mut best:Option<(u64,OwnerRef,u64)>=None;
        for entry in entries.values(){
            let Some(owner)=entry.target.upgrade()else{continue};
            if !owns_window(&owner,window){continue}
            if !native_host_hit(&owner,event.start_position,window){continue}
            let order=owner.borrow().modules.topology.order;
            if best.as_ref().map_or(true,|(_,_,current)|order>*current){best=Some((entry.id,owner,order))}
        }
        best
    });
    let Some((id,owner,_))=candidate else{return};
    let Some(origin)=live_origin(&owner)else{return};
    let binding=MOVE_ENTRIES.with(|entries|entries.borrow().get(&id).map(|entry|entry.binding.clone()));
    let Some(binding)=binding else{return};
    let sample=MoveGestureSample{
        input:MoveGestureInput::Touch,
        position:local_point(event.start_position,origin),
        delta:MoveGesturePoint{x:0.0,y:0.0},
        total_delta:MoveGesturePoint{x:0.0,y:0.0},
        timestamp:now_millis(),
        modifiers:window.modifiers(),
    };
    if !binding.should_start(&sample,window,cx){return}
    if !native_host_hit(&owner,event.start_position,window){return}
    let accepted=MOVE_ENTRIES.with(|entries|{
        let mut entries=entries.borrow_mut();
        if entries.values().any(|entry|entry.session.is_some()&&entry.target.upgrade().is_some_and(|owner|owns_window(&owner,window))){return false}
        let Some(entry)=entries.get_mut(&id)else{return false};
        if !same_owner(&entry.target,&Rc::downgrade(&owner))||!Rc::ptr_eq(&entry.binding,&binding){return false}
        if entry.session.is_some(){return false}
        entry.session=Some(MoveSession{binding:binding.clone(),input:MoveGestureInput::Touch,start:event.start_position,previous:event.start_position});
        true
    });
    if !accepted{return}
    // Claim the contact: the arena keeps routing it to this window only while the
    // claim stands.
    window.prevent_default();
    binding.on_start(&sample,window,cx);
}

`;
