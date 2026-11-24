//! A generated, renamed Scroll declaration consumed by ordinary native views.
//! Native parts share the declaration's actual nominal identity; this does not
//! alias independent crates by descriptor or certify the unchanged Base family.
use gpui::{prelude::*, point, px, size, Bounds, Context, Entity, PlatformInput,
    Pixels, Point, Render, TestAppContext, Window, WindowHandle};
use proto_ui_gpui_native::gpui_native_owner::{
    anatomy_claim, attach_scroll_surface, bind_native_focus_window, create_state,
    expose_state, native_scroll_chrome_observation, paint_native_root, record,
    scroll_snapshot, state_set, style_use, register_sequential_focus_owner, ready, Drive, NativeScrollLease,
    NativeScrollTarget, NativeSnapshot, Owner, OwnerRef, OwnerWeak, StaticDeclaration, Value,
};
use proto_ui_gpui_native::gpui_native_move::move_owner_has_binding;
use serde_json::json;
use std::rc::Rc;

// This native peer implements only the declared logical part and native paint.
// It has no copied Scroll protocol, geometry state or independent control API.
struct Part { owner:OwnerRef, focus:gpui::FocusHandle, renders:u64 }
impl Part {
    fn new(parent:OwnerWeak,family:&'static StaticDeclaration,role:&str,window:&mut Window,cx:&mut Context<Self>)->Self {
        let owner=Owner::new(json!({}),parent,|_,_|true,|_|true,|_,_|true,
            proto_ui_gpui_native::gpui_native_style::vocabulary());
        let weak=Rc::downgrade(&owner);
        anatomy_claim(&weak,Value::StaticCapability(family),record(vec![("role",Value::string(role))]));
        let tokens:&[&str]=if role=="rail"{
            &["relative","w-full","h-full","p-1","bg-muted"]
        }else{
            &["relative","w-full","h-full","bg-primary","rounded-full"]
        };
        style_use(&weak,vec![Value::Style(tokens.iter().map(|token|(token.to_string(),token.to_string())).collect())]);
        if role=="rail" {
            let direction=create_state(&weak,"string",Value::string("native-direction"),Value::string("vertical"),Value::Undefined);
            expose_state(&weak,Value::string("direction"),direction);
        }
        let target=cx.entity().downgrade();
        let drive:Drive=Rc::new(move|window,cx|{
            let target=target.clone();window.defer(cx,move|_,cx|{
                let _=target.update(cx,|part,cx|{
                    if std::mem::take(&mut part.owner.borrow_mut().dirty){cx.notify();}
                });
            });
        });
        {let mut o=owner.borrow_mut();o.native_drive=Some(drive);o.window_id=Some(window.window_handle().window_id());}
        Owner::finish(&owner,Value::Undefined);
        register_sequential_focus_owner(&owner,cx);
        Self{owner,focus:cx.focus_handle(),renders:0}
    }
    fn children(&mut self,children:Vec<NativeSnapshot>,cx:&mut Context<Self>){self.owner.borrow_mut().slot=children;cx.notify();}
}
impl Render for Part {
    fn render(&mut self,window:&mut Window,_:&mut Context<Self>)->impl IntoElement {
        self.renders+=1;
        Owner::project(&self.owner);bind_native_focus_window(&self.owner,window);
        self.owner.borrow_mut().dirty=false;
        let snapshot=self.owner.borrow().projection.clone().unwrap();
        let drive=self.owner.borrow().native_drive.clone().unwrap();
        paint_native_root(&snapshot,&self.owner,&self.focus,format!("native-part-{}",Rc::as_ptr(&self.owner)as usize),drive)
    }
}
impl Drop for Part {fn drop(&mut self){Owner::dispose(&self.owner);}}

fn cached_style()->gpui::StyleRefinement{let mut surface=gpui::div().size_full();surface.style().clone()}
struct Rail { part:Entity<Part>,horizontal:bool,extent:f32,duplicate:bool,show:bool }
impl Render for Rail {
    fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
        let mut root=gpui::div().id("ordinary-native-rail").absolute().top_0().right_0()
            .w(px(if self.horizontal{self.extent}else{16.}))
            .h(px(if self.horizontal{16.}else{self.extent}));
        if self.show{root=root.child(self.part.clone().cached(cached_style()));}
        if self.duplicate{root=root.child(gpui::div().id("duplicate-physical-rail").size_full()
            .child(self.part.clone().cached(cached_style())));}
        root
    }
}
struct Viewport { handle:gpui::ScrollHandle,width:f32,height:f32 }
impl Render for Viewport {
    fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
        gpui::div().id("ordinary-native-viewport").size_full().overflow_x_scroll().overflow_y_scroll()
            .track_scroll(&self.handle)
            .child(gpui::div().flex_none().w(px(self.width)).h(px(self.height)))
    }
}
struct Harness {
    component:Entity<composed_scroll::CompiledComponent>,track:Entity<Part>,thumb:Entity<Part>,
    rail:Entity<Rail>,viewport:Entity<Viewport>,handle:gpui::ScrollHandle,
    lease:Option<NativeScrollLease>,outside:gpui::FocusHandle,
}
impl Render for Harness {
    fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
        gpui::div().size_full().child(self.component.clone())
            .child(gpui::div().id("outside-focus").absolute().left(px(300.)).w(px(20.)).h(px(20.)).track_focus(&self.outside))
    }
}
fn frames(window:WindowHandle<Harness>,cx:&mut TestAppContext){
    for _ in 0..5{
        cx.update_window(window.into(),|_,window,cx|{window.refresh();window.draw(cx).clear(cx);}).unwrap();
        cx.run_until_parked();
    }
}
fn quiet_frames(window:WindowHandle<Harness>,cx:&mut TestAppContext){
    for _ in 0..8{
        cx.run_until_parked();
        cx.update_window(window.into(),|_,window,cx|{window.draw(cx).clear(cx);}).unwrap();
    }
    cx.run_until_parked();
}
fn open(cx:&mut TestAppContext)->WindowHandle<Harness>{
    let window=cx.open_window(size(px(420.),px(240.)),|window,cx|{
        let component=composed_scroll::CompiledComponent::create(json!({}),None,window,cx).unwrap();
        let owner=component.read(cx).owner.clone();
        let family=owner.borrow().modules.topology.claims.values().next().unwrap().family;
        let track=cx.new(|cx|Part::new(Rc::downgrade(&owner),family,"rail",window,cx));
        let track_owner=track.read(cx).owner.clone();
        let thumb=cx.new(|cx|Part::new(Rc::downgrade(&track_owner),family,"knob",window,cx));
        track.update(cx,|part,cx|part.children(vec![NativeSnapshot::native_view(thumb.clone().into())],cx));
        let rail=cx.new(|_|Rail{part:track.clone(),horizontal:false,extent:160.,duplicate:false,show:true});
        let handle=gpui::ScrollHandle::new();
        let lease=attach_scroll_surface(&Rc::downgrade(&owner),NativeScrollTarget::new(handle.clone()),window).unwrap();
        let viewport=cx.new(|_|Viewport{handle:handle.clone(),width:640.,height:640.});
        component.update(cx,|part,cx|part.set_slot(vec![
            NativeSnapshot::native_view(viewport.clone().into()),NativeSnapshot::native_view(rail.clone().into()),
        ],cx).unwrap());
        Harness{component,track,thumb,rail,viewport,handle,lease:Some(lease),outside:cx.focus_handle()}
    });
    window.update(cx,|host,window,cx|{window.activate_window();host.outside.focus(window,cx);}).unwrap();
    frames(window,cx);window
}
fn near(actual:f32,expected:f32){assert!((actual-expected).abs()<0.75,"{actual} != {expected}");}
fn bounds(part:&Entity<Part>,cx:&gpui::App)->Bounds<Pixels>{part.read(cx).owner.borrow().bounds.expect("actual native part layout")}
fn owner(host:&Harness,cx:&gpui::App)->OwnerRef{host.component.read(cx).owner.clone()}
fn geometry(host:&Harness,cx:&gpui::App,horizontal:bool)->(f32,f32,f32){
    let track=bounds(&host.track,cx);let thumb=bounds(&host.thumb,cx);
    let (start,available,visible,max,thumb_start,extent)=if horizontal{
        (f32::from(track.origin.x)+4.,f32::from(track.size.width)-8.,f32::from(host.handle.bounds().size.width),f32::from(host.handle.max_offset().x),f32::from(thumb.origin.x),f32::from(thumb.size.width))
    }else{
        (f32::from(track.origin.y)+4.,f32::from(track.size.height)-8.,f32::from(host.handle.bounds().size.height),f32::from(host.handle.max_offset().y),f32::from(thumb.origin.y),f32::from(thumb.size.height))
    };
    let expected=(available*visible/(visible+max)).max(18.).min(available);
    near(extent,expected);
    let position=-f32::from(if horizontal{host.handle.offset().x}else{host.handle.offset().y})/max;
    near(thumb_start,start+(available-expected)*position);
    let observed=native_scroll_chrome_observation(&host.thumb.read(cx).owner);
    assert!(observed["painted"].is_object(),"an actual nonempty paint mask is required: {observed}");
    (start,available-expected,extent)
}
fn pointer(window:&mut Window,cx:&mut gpui::App,kind:&str,position:Point<Pixels>){
    match kind{
        "down"=>{window.dispatch_event(PlatformInput::MouseDown(gpui::MouseDownEvent{position,button:gpui::MouseButton::Left,..Default::default()}),cx);},
        "move"=>{window.dispatch_event(PlatformInput::MouseMove(gpui::MouseMoveEvent{position,pressed_button:Some(gpui::MouseButton::Left),..Default::default()}),cx);},
        "up"=>{window.dispatch_event(PlatformInput::MouseUp(gpui::MouseUpEvent{position,button:gpui::MouseButton::Left,..Default::default()}),cx);},
        _=>panic!("unknown native test input"),
    }
}

#[gpui::test]
fn composed_chrome_uses_native_geometry_without_jump_or_authored_render(cx:&mut TestAppContext){
    let window=open(cx);
    let (start,revision)=window.update(cx,|host,window,cx|{
        let source=owner(host,cx);
        assert_eq!(scroll_snapshot(&Rc::downgrade(&source)).member("projection",false).text(),"composed");
        assert_eq!(native_scroll_chrome_observation(&source)["controls"],json!(1));
        let (_,_,extent)=geometry(host,cx,false);
        let thumb=bounds(&host.thumb,cx);
        assert!(!host.thumb.read(cx).owner.borrow().focusable);
        assert!(!host.thumb.read(cx).owner.borrow().accessible);
        assert!(move_owner_has_binding(&host.thumb.read(cx).owner));
        let start=point(thumb.origin.x+thumb.size.width/2.,thumb.origin.y+px(extent*0.75));
        let offset=host.handle.offset();pointer(window,cx,"down",start);
        assert_eq!(host.handle.offset(),offset,"grabbing away from the origin cannot jump");
        let revision=source.borrow().projection_revision;(start,revision)
    }).unwrap();
    let end=window.update(cx,|host,window,cx|{
        let(_,travel,_)=geometry(host,cx,false);let end=start+point(px(0.),px(travel*0.5));
        pointer(window,cx,"move",end);end
    }).unwrap();
    frames(window,cx);
    window.update(cx,|host,window,cx|{
        near(-f32::from(host.handle.offset().y),f32::from(host.handle.max_offset().y)*0.5);
        geometry(host,cx,false);
        assert_eq!(owner(host,cx).borrow().projection_revision,revision,"host paint must not request authored rendering");
        assert!(host.outside.is_focused(window));pointer(window,cx,"up",end);
    }).unwrap();
}

#[gpui::test]
fn drag_remeasures_track_resize_and_cancels_at_target_replacement(cx:&mut TestAppContext){
    let window=open(cx);
    let press=window.update(cx,|host,window,cx|{
        let thumb=bounds(&host.thumb,cx);let press=f32::from(thumb.size.height)*0.5;
        pointer(window,cx,"down",point(thumb.origin.x+thumb.size.width/2.,thumb.origin.y+px(press)));
        host.rail.update(cx,|rail,cx|{rail.extent=120.;cx.notify();});press
    }).unwrap();
    frames(window,cx);
    window.update(cx,|host,window,cx|{
        let(start,travel,_)=geometry(host,cx,false);let thumb=bounds(&host.thumb,cx);
        pointer(window,cx,"move",point(thumb.origin.x+thumb.size.width/2.,px(start+press+travel*0.8)));
    }).unwrap();
    frames(window,cx);
    let old=window.update(cx,|host,window,cx|{
        near(-f32::from(host.handle.offset().y),f32::from(host.handle.max_offset().y)*0.8);
        let old=host.thumb.clone();let parent=host.track.read(cx).owner.clone();
        let family=parent.borrow().modules.topology.claims.values().next().unwrap().family;
        let replacement=cx.new(|cx|Part::new(Rc::downgrade(&parent),family,"knob",window,cx));
        host.track.update(cx,|part,cx|part.children(vec![NativeSnapshot::native_view(replacement.clone().into())],cx));
        host.thumb=replacement;old
    }).unwrap();
    frames(window,cx);
    window.update(cx,|host,window,cx|{
        assert!(!move_owner_has_binding(&old.read(cx).owner),"replaced physical target retires its lease");
        assert!(move_owner_has_binding(&host.thumb.read(cx).owner));
        let offset=host.handle.offset();pointer(window,cx,"move",point(px(240.),px(20.)));
        assert_eq!(host.handle.offset(),offset,"late movement has no new target authority");
        geometry(host,cx,false);
    }).unwrap();
}

#[gpui::test]
fn unavailable_axes_and_no_overflow_hide_paint_and_detach_releases_input(cx:&mut TestAppContext){
    let window=open(cx);
    window.update(cx,|host,window,cx|{
        host.component.read(cx).handle().call("horizontal",vec![],window,cx).unwrap();
    }).unwrap();
    frames(window,cx);
    window.update(cx,|host,window,cx|{
        assert!(native_scroll_chrome_observation(&host.thumb.read(cx).owner)["painted"].is_null());
        host.component.read(cx).handle().call("both",vec![],window,cx).unwrap();
        let direction=host.track.read(cx).owner.borrow().exposes["direction"].clone();
        state_set(direction,Value::string("horizontal"),Value::string("native orientation update"));
        host.rail.update(cx,|rail,cx|{rail.horizontal=true;rail.extent=240.;cx.notify();});
    }).unwrap();
    frames(window,cx);
    window.update(cx,|host,_,cx|{geometry(host,cx,true);host.viewport.update(cx,|viewport,cx|{viewport.width=100.;cx.notify();});}).unwrap();
    frames(window,cx);
    window.update(cx,|host,window,cx|{
        assert_eq!(host.handle.max_offset().x,px(0.));
        assert!(native_scroll_chrome_observation(&host.thumb.read(cx).owner)["painted"].is_null(),"no full-track false feedback");
        let thumb=bounds(&host.thumb,cx);let before=host.handle.offset();
        pointer(window,cx,"down",thumb.origin+point(px(2.),px(2.)));
        pointer(window,cx,"move",thumb.origin+point(px(30.),px(2.)));
        assert_eq!(host.handle.offset(),before,"hidden thumb cannot acquire dragging");
        host.lease.take();
        assert!(!move_owner_has_binding(&host.thumb.read(cx).owner));
        assert_eq!(scroll_snapshot(&Rc::downgrade(&owner(host,cx))).member("projection",false).text(),"unresolved");
        let before=host.handle.offset();pointer(window,cx,"move",point(px(200.),px(20.)));
        assert_eq!(host.handle.offset(),before,"released surface rejects old input");
    }).unwrap();
}

#[gpui::test]
fn cached_duplicate_views_revoke_control_without_false_unmount_or_aba_revival(cx:&mut TestAppContext){
    let window=open(cx);
    let (track,thumb,track_epoch,thumb_epoch)=window.update(cx,|host,window,cx|{
        let track=host.track.read(cx).owner.clone();let thumb=host.thumb.read(cx).owner.clone();
        assert_eq!(native_scroll_chrome_observation(&track)["physicalBindings"],json!(1));
        assert_eq!(native_scroll_chrome_observation(&thumb)["physicalBindings"],json!(1));
        let start=bounds(&host.thumb,cx);
        pointer(window,cx,"down",start.origin+point(start.size.width/2.,start.size.height/2.));
        host.rail.update(cx,|rail,cx|{rail.duplicate=true;cx.notify();});
        let track_epoch=track.borrow().epoch;let thumb_epoch=thumb.borrow().epoch;
        (track,thumb,track_epoch,thumb_epoch)
    }).unwrap();
    quiet_frames(window,cx);
    window.update(cx,|host,window,cx|{
        assert_eq!(native_scroll_chrome_observation(&track)["physicalBindings"],json!(2),"cached original and new occurrence both retain actual receipts");
        assert_eq!(native_scroll_chrome_observation(&thumb)["physicalBindings"],json!(2));
        assert!(!move_owner_has_binding(&thumb),"ambiguous physical target retires input immediately");
        assert!(native_scroll_chrome_observation(&thumb)["painted"].is_null());
        let before=host.handle.offset();pointer(window,cx,"move",point(px(245.),px(90.)));
        assert_eq!(host.handle.offset(),before);
        host.rail.update(cx,|rail,cx|{rail.duplicate=false;cx.notify();});
    }).unwrap();
    cx.update_window(window.into(),|_,window,cx|{
        window.draw(cx).clear(cx);
        assert_eq!(native_scroll_chrome_observation(&track)["physicalBindings"],json!(1));
        assert_eq!(native_scroll_chrome_observation(&thumb)["physicalBindings"],json!(1));
        assert!(ready(&track)&&ready(&thumb),"removing one cached occurrence does not unmount its survivor");
        assert_eq!(track.borrow().epoch,track_epoch);
        assert_eq!(thumb.borrow().epoch,thumb_epoch);
    }).unwrap();
    quiet_frames(window,cx);
    window.update(cx,|host,window,cx|{
        geometry(host,cx,false);assert!(move_owner_has_binding(&thumb));
        let before=host.handle.offset();pointer(window,cx,"move",point(px(245.),px(120.)));
        assert_eq!(host.handle.offset(),before,"A -> A+B -> A cannot revive the held old gesture");
        pointer(window,cx,"up",point(px(245.),px(120.)));
        host.rail.update(cx,|rail,cx|{rail.show=false;cx.notify();});
    }).unwrap();
    quiet_frames(window,cx);
    window.update(cx,|host,_,cx|{
        assert!(!ready(&track)&&!ready(&thumb),"the final actual occurrence really detaches");
        assert!(!move_owner_has_binding(&thumb));
        assert_eq!(native_scroll_chrome_observation(&thumb)["physicalBindings"],json!(0));
        host.rail.update(cx,|rail,cx|{rail.show=true;cx.notify();});
    }).unwrap();
    quiet_frames(window,cx);
    window.update(cx,|host,window,cx|{
        assert!(ready(&track)&&ready(&thumb));assert_ne!(thumb.borrow().epoch,thumb_epoch);
        geometry(host,cx,false);
        let before=host.handle.offset();pointer(window,cx,"move",point(px(245.),px(130.)));
        assert_eq!(host.handle.offset(),before,"a remount does not inherit the old input turn");
    }).unwrap();
}
