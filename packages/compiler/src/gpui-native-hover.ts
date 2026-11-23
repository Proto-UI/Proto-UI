/** Preserve physical hover observations across the first authored mount. */
export const gpuiNativeHoverSource = String.raw`
// GPUI caches its hover state and can deliver the first change before the
// deferred authored mount commits. Retain the latest physical observation;
// replaying geometry or waiting for another mouse move loses that transition.
#[derive(Clone,Copy,PartialEq,Eq)]
struct NativeHoverView { epoch:u64, window:gpui::WindowId, hitbox:gpui::HitboxId }
#[derive(Default)]
struct NativeHoverState {
    mounted_epoch:Option<u64>,
    needs_sync:bool,
    cached_hover:Option<bool>,
    resample_input:bool,
    pending:Option<(NativeHoverView,bool,u64)>,
    observation:u64,
    delivered:bool,
}
fn native_hover_view(owner:&OwnerRef,window:&Window)->Option<NativeHoverView> {
    let o=owner.borrow();
    if o.disposed||o.disposing||!o.present||o.bounds.is_none()
        ||o.window_id!=Some(window.window_handle().window_id()){return None}
    Some(NativeHoverView {
        epoch:if o.mounted{o.epoch}else{o.epoch.wrapping_add(1)},
        window:o.window_id?,hitbox:o.native_hitbox.as_ref()?.id,
    })
}
fn native_hover_current(owner:&OwnerRef,view:NativeHoverView,window:&Window)->bool {
    native_hover_view(owner,window)==Some(view)
}
fn native_hover_mounted(owner:&OwnerRef,epoch:u64) {
    let mut o=owner.borrow_mut();
    // Mark completion after the authored lifecycle turn, including its error
    // boundary. A failure cannot disable a still-live view's later input;
    // synchronous detach, disposal or replacement still retires this epoch.
    if !o.disposed&&!o.disposing&&o.present&&o.mounted&&o.epoch==epoch {
        if o.native_hover.mounted_epoch!=Some(epoch){o.native_hover.needs_sync=true;}
        o.native_hover.mounted_epoch=Some(epoch);
    }
}
fn native_hover_flush(owner:&OwnerRef,window:&mut Window)->bool {
    let pending={
        let mut o=owner.borrow_mut();
        if !o.mounted||o.native_hover.mounted_epoch!=Some(o.epoch){return false}
        o.native_hover.pending.take()
    };
    let Some((view,hover,observation))=pending else{return false};
    if !native_hover_current(owner,view,window){return false}
    {
        let mut o=owner.borrow_mut();
        if o.native_hover.delivered==hover{return false}
        // Claim before callbacks, so synchronous host reentry cannot deliver
        // this same enter twice. A newer observation remains independently owned.
        o.native_hover.delivered=hover;
    }
    if !hover{control_label_cancel(owner);}
    let kind=if hover{"pointer.enter"}else{"pointer.leave"};
    let mut prevented=dispatch_root_route(owner,kind,event_fields(kind));
    if !native_hover_current(owner,view,window)||owner.borrow().native_hover.observation!=observation{return prevented}
    if !hover{control_label_pointer_cancel(owner);prevented|=pointer_intent(owner,"press.cancel",event_fields("press.cancel"));}
    if !native_hover_current(owner,view,window)||owner.borrow().native_hover.observation!=observation{return prevented}
    let kind=if hover{"host:mouseenter"}else{"host:mouseleave"};
    prevented|=dispatch(owner,kind,false,event_fields(kind));
    prevented
}
fn native_hover_fact(owner:&OwnerRef,view:NativeHoverView,hover:bool,window:&mut Window)->bool {
    // Each callback belongs to the view measured during its own prepaint.
    // Cached callbacks from another frame, window or mount cannot overwrite
    // the current observation, even when the same logical Owner is retained.
    if !native_hover_current(owner,view,window){return false}
    {
        let mut o=owner.borrow_mut();let state=&mut o.native_hover;
        if state.pending.is_none()&&state.delivered==hover{return false}
        state.observation=state.observation.wrapping_add(1);
        state.pending=Some((view,hover,state.observation));
    }
    native_hover_flush(owner,window)
}
fn native_hover_reconcile(owner:&OwnerRef,window:&mut Window,cx:&mut App)->bool {
    let Some(view)=native_hover_view(owner,window)else{return false};
    let synchronize={
        let mut o=owner.borrow_mut();
        if !o.mounted||o.native_hover.mounted_epoch!=Some(o.epoch){return false}
        std::mem::take(&mut o.native_hover.needs_sync)
    };
    if !synchronize{return native_hover_flush(owner,window)}
    // A previous frame's deferred GPUI callback can update its shared hover
    // cache before the current frame's callback runs. Never adopt that old
    // boolean. Read the current host hit-test fact once at this boundary; GPUI
    // owns clipping, occlusion, input modality and capture in is_hovered.
    let hover=!cx.has_active_drag()&&owner.borrow().native_hitbox.as_ref()
        .is_some_and(|hitbox|hitbox.id==view.hitbox&&hitbox.is_hovered(window));
    // If an old paint changed GPUI's cache to a different fact, its next real
    // inside move may not call on_hover. Keep only that mismatch until a
    // physical move or a current callback brings both observations together.
    {
        let mut o=owner.borrow_mut();let state=&mut o.native_hover;
        state.resample_input=state.cached_hover.is_some_and(|cached|cached!=hover);
    }
    native_hover_fact(owner,view,hover,window)
}
fn native_hover_input(owner:&OwnerRef,view:NativeHoverView,hover:bool,window:&mut Window,cx:&mut App)->bool {
    let Some(current)=native_hover_view(owner,window)else{return false};
    if current==view{
        {let mut o=owner.borrow_mut();o.native_hover.cached_hover=Some(hover);o.native_hover.resample_input=false;}
        return native_hover_fact(owner,view,hover,window)
    }
    // A changed paint frame within this same live view requests one fresh
    // physical observation. An old mount or another window has no authority
    // even to request that reconciliation.
    if current.epoch!=view.epoch||current.window!=view.window{return false}
    {let mut o=owner.borrow_mut();o.native_hover.cached_hover=Some(hover);o.native_hover.needs_sync=true;}
    native_hover_reconcile(owner,window,cx)
}
fn native_hover_motion(owner:&OwnerRef,view:Option<NativeHoverView>,window:&mut Window,cx:&mut App)->bool {
    let(Some(view),Some(current))=(view,native_hover_view(owner,window))else{return false};
    if current.epoch!=view.epoch||current.window!=view.window{return false}
    {
        let mut o=owner.borrow_mut();
        if !o.native_hover.resample_input{return false}
        o.native_hover.needs_sync=true;
    }
    native_hover_reconcile(owner,window,cx)
}

#[cfg(all(test,feature="test-support"))]
mod native_hover_tests {
    use super::*;
    use gpui::{AppContext,Context,Entity,Render,TestAppContext,WindowHandle,point,px,size};

    struct Content;
    impl Render for Content {
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
            div().w(px(80.)).h(px(40.))
        }
    }
    struct Host { owner:OwnerRef, focus:FocusHandle, shown:bool, _content:Entity<Content> }
    impl Render for Host {
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
            let mut root=div().size_full();
            if self.shown&&!self.owner.borrow().disposed {
                Owner::project(&self.owner);
                let snapshot=self.owner.borrow().projection.clone().unwrap();
                root=root.child(paint_native_root(&snapshot,&self.owner,&self.focus,
                    "native-hover-target".into(),Rc::new(|_,_|{})));
            }
            root
        }
    }
    fn owner(trace:Rc<RefCell<Vec<String>>>,retire_on_mount:bool,fail_on_mount:bool)->OwnerRef {
        let owner=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,
            |_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        let weak=Rc::downgrade(&owner);
        for kind in ["mounted","unmounted"] {
            let output=trace.clone();
            register_life(&weak,kind,Value::Function(Rc::new(move |_| {
                output.borrow_mut().push(kind.into());Value::Undefined
            })));
        }
        for kind in ["pointer.enter","pointer.leave","host:mouseenter","host:mouseleave"] {
            let output=trace.clone();
            listen(&weak,Value::string(kind),false,Value::Function(Rc::new(move |_| {
                output.borrow_mut().push(kind.into());Value::Undefined
            })),Value::Undefined);
        }
        if retire_on_mount {
            let target=weak.clone();
            register_life(&weak,"mounted",Value::Function(Rc::new(move |_| {
                if let Some(owner)=target.upgrade(){Owner::dispose(&owner)}Value::Undefined
            })));
        }
        if fail_on_mount {
            register_life(&weak,"mounted",Value::Function(Rc::new(|_|throw_value(Value::boolean(false)))));
        }
        Owner::finish(&owner,Value::Undefined);owner
    }
    fn open(cx:&mut TestAppContext,trace:Rc<RefCell<Vec<String>>>,retire:bool)->WindowHandle<Host> {
        cx.open_window(size(px(160.),px(80.)),move |_,cx| {
            let owner=owner(trace,retire,false);let content=cx.new(|_|Content);
            owner.borrow_mut().slot=vec![NativeSnapshot::native_view(content.clone().into())];
            Host{owner,focus:cx.focus_handle(),shown:false,_content:content}
        })
    }
    fn frames<T:Render>(window:WindowHandle<T>,cx:&mut TestAppContext) {
        for _ in 0..3 {
            cx.update_window(window.into(),|_,window,cx| {
                window.refresh();window.draw(cx).clear(cx);
            }).unwrap();
            cx.run_until_parked();
        }
    }
    fn cold_mount(window:WindowHandle<Host>,cx:&mut TestAppContext) {
        window.update(cx,|_,window,_|window.activate_window()).unwrap();
        frames(window,cx);
        window.update(cx,|host,window,cx| {
            window.simulate_mouse_move(point(px(10.),px(10.)),cx);
            host.shown=true;cx.notify();
        }).unwrap();
        frames(window,cx);
    }

    struct LabelHost { label:OwnerRef, target:OwnerRef, focus:FocusHandle }
    impl Render for LabelHost {
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
            let mut root=div().size_full().flex().flex_col();
            for (owner,path) in [(&self.label,"hover-label"),(&self.target,"hover-target")] {
                // Terminal owners deliberately have no projection to paint.
                if owner.borrow().disposed { continue; }
                Owner::project(owner);
                let snapshot=owner.borrow().projection.clone().unwrap();
                root=root.child(paint_native_root(&snapshot,owner,&self.focus,path.into(),Rc::new(|_,_|{})));
            }
            root
        }
    }
    #[gpui::test]
    fn current_hover_leave_cancels_label_activation_but_retired_leave_does_not(cx:&mut TestAppContext) {
        let calls=Rc::new(Cell::new(0));let observed=calls.clone();
        let window=cx.open_window(size(px(160.),px(80.)),move |_,cx| {
            let reference=ControlLabelRef::new();
            let make=|target| {
                let owner=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,
                    |_|true,|_,_|true,crate::gpui_native_style::vocabulary());
                let weak=Rc::downgrade(&owner);let observed=observed.clone();
                initialize_instance_associations(&owner,InstanceAssociations{control_label:Some(reference.clone())});
                as_accessible(&weak);
                control_label_declare(&weak,target,Value::Function(Rc::new(move |_| {
                    observed.set(observed.get()+1);Value::Undefined
                })),Value::Undefined);
                control_label_sync(&weak,record(vec![("naming",Value::boolean(true)),("activation",Value::boolean(true))]));
                owner.borrow_mut().slot=vec![NativeSnapshot::text_value(Value::string(if target{"Target"}else{"Label"}))];
                Owner::finish(&owner,Value::Undefined);owner
            };
            LabelHost{label:make(false),target:make(true),focus:cx.focus_handle()}
        });
        window.update(cx,|_,window,_|window.activate_window()).unwrap();frames(window,cx);
        window.update(cx,|host,window,cx| {
            let position=host.label.borrow().bounds.unwrap().origin+point(px(2.),px(2.));
            window.simulate_mouse_move(position,cx);
            let current=native_hover_view(&host.label,window).unwrap();
            let retired=NativeHoverView{epoch:current.epoch.wrapping_sub(1),..current};
            for stale in [true,false] {
                native_hover_input(&host.label,current,true,window,cx);
                window.dispatch_event(gpui::PlatformInput::MouseDown(gpui::MouseDownEvent {
                    position,button:gpui::MouseButton::Left,..Default::default()
                }),cx);
                assert!(host.label.borrow().modules.control_label.pointer.as_ref()
                    .is_some_and(|pointer|pointer.request.is_current()),"native down starts a current label turn");
                native_hover_input(&host.label,if stale{retired}else{current},false,window,cx);
                assert_eq!(host.label.borrow().modules.control_label.pointer.is_some(),stale,
                    "only a leave from the current native view may cancel its pending label activation");
                window.dispatch_event(gpui::PlatformInput::MouseUp(gpui::MouseUpEvent {
                    position,button:gpui::MouseButton::Left,..Default::default()
                }),cx);
                assert_eq!(calls.get(),1,"a cancelled hover turn cannot activate on the subsequent native click");
            }
            Owner::dispose(&host.label);Owner::dispose(&host.target);
        }).unwrap();
        frames(window,cx);
        window.update(cx,|host,_,_| {
            assert!(host.label.borrow().disposed&&host.target.borrow().disposed);
            assert!(host.label.borrow().projection.is_none()&&host.target.borrow().projection.is_none());
            assert_eq!(calls.get(),1,"terminal native frames cannot revive retired label activation");
        }).unwrap();
    }

    #[gpui::test]
    fn cold_hover_is_delivered_after_mount_once_and_tracks_real_transitions(cx:&mut TestAppContext) {
        let trace=Rc::new(RefCell::new(Vec::new()));let window=open(cx,trace.clone(),false);
        cold_mount(window,cx);
        assert_eq!(&*trace.borrow(),&["mounted","pointer.enter","host:mouseenter"],
            "the initial native hover must survive the pre-mount callback boundary");
        frames(window,cx);
        window.update(cx,|_,window,cx|window.simulate_mouse_move(point(px(12.),px(12.)),cx)).unwrap();
        assert_eq!(trace.borrow().len(),3,"cached frames and inside-to-inside motion cannot duplicate enter");
        window.update(cx,|_,window,cx| {
            window.simulate_mouse_move(point(px(120.),px(60.)),cx);
            window.simulate_mouse_move(point(px(10.),px(10.)),cx);
        }).unwrap();
        assert_eq!(&*trace.borrow(),&["mounted","pointer.enter","host:mouseenter",
            "pointer.leave","host:mouseleave","pointer.enter","host:mouseenter"]);
        window.update(cx,|host,_,_|Owner::dispose(&host.owner)).unwrap();
    }

    #[gpui::test]
    fn detach_retires_hover_facts_and_remount_rejects_old_view_callbacks(cx:&mut TestAppContext) {
        let trace=Rc::new(RefCell::new(Vec::new()));let window=open(cx,trace.clone(),false);
        cold_mount(window,cx);
        let stale=window.update(cx,|host,window,cx| {
            let view=native_hover_view(&host.owner,window).unwrap();
            host.shown=false;cx.notify();view
        }).unwrap();
        frames(window,cx);
        window.update(cx,|host,window,cx| {
            assert!(!host.owner.borrow().mounted);
            assert!(host.owner.borrow().native_hover.pending.is_none());
            assert!(!host.owner.borrow().native_hover.delivered);
            let before=trace.borrow().len();native_hover_input(&host.owner,stale,true,window,cx);
            assert_eq!(trace.borrow().len(),before);
            host.shown=true;cx.notify();
        }).unwrap();
        frames(window,cx);
        assert_eq!(&*trace.borrow(),&["mounted","pointer.enter","host:mouseenter",
            "unmounted","mounted","pointer.enter","host:mouseenter"]);
        window.update(cx,|host,window,cx| {
            let current=native_hover_view(&host.owner,window).unwrap();
            assert_ne!(stale.epoch,current.epoch);
            let before=trace.borrow().len();native_hover_input(&host.owner,stale,false,window,cx);
            assert_eq!(trace.borrow().len(),before,"retired leave cannot affect the remount");
            assert!(host.owner.borrow().native_hover.delivered);
            Owner::dispose(&host.owner);let before=trace.borrow().len();
            native_hover_input(&host.owner,current,true,window,cx);
            assert_eq!(trace.borrow().len(),before,"terminal owner rejects late physical input");
            assert!(host.owner.borrow().native_hover.pending.is_none());
        }).unwrap();
    }

    #[gpui::test]
    fn mounted_callback_retirement_discards_pending_native_hover(cx:&mut TestAppContext) {
        let trace=Rc::new(RefCell::new(Vec::new()));let window=open(cx,trace.clone(),true);
        cold_mount(window,cx);
        assert_eq!(&*trace.borrow(),&["mounted","unmounted"],
            "a physical fact cannot outlive synchronous authored mount retirement");
        window.update(cx,|host,_,_| {
            assert!(host.owner.borrow().disposed);
            assert!(host.owner.borrow().native_hover.pending.is_none());
        }).unwrap();
    }
    #[gpui::test]
    fn mounted_callback_failure_keeps_current_hover_and_exact_error(cx:&mut TestAppContext) {
        let trace=Rc::new(RefCell::new(Vec::new()));let output=trace.clone();
        let window=cx.open_window(size(px(160.),px(80.)),move |_,cx| {
            let owner=owner(output,false,true);let content=cx.new(|_|Content);
            owner.borrow_mut().slot=vec![NativeSnapshot::native_view(content.clone().into())];
            Host{owner,focus:cx.focus_handle(),shown:false,_content:content}
        });
        cold_mount(window,cx);
        assert_eq!(&*trace.borrow(),&["mounted","pointer.enter","host:mouseenter"],
            "an authored mount failure does not retire an otherwise current native view");
        window.update(cx,|host,window,cx| {
            let failures=take_native_failures(&host.owner);
            assert_eq!(failures.len(),1);
            assert!(matches!(failures[0].error,Value::Json(Json::Bool(false))));
            window.simulate_mouse_move(point(px(120.),px(60.)),cx);
            window.simulate_mouse_move(point(px(10.),px(10.)),cx);
            assert_eq!(trace.borrow().len(),7,"the current view keeps real leave and enter delivery");
            Owner::dispose(&host.owner);
        }).unwrap();
    }
    #[gpui::test]
    fn two_frames_before_deferred_commit_preserve_the_current_cold_hover(cx:&mut TestAppContext) {
        let trace=Rc::new(RefCell::new(Vec::new()));let window=open(cx,trace.clone(),false);
        window.update(cx,|_,window,_|window.activate_window()).unwrap();
        frames(window,cx);
        cx.update_window(window.into(),|_,window,cx| {
            window.simulate_mouse_move(point(px(10.),px(10.)),cx);
            let host=window.root::<Host>().unwrap().unwrap();
            host.update(cx,|host,cx|{host.shown=true;cx.notify();});
            window.refresh();window.draw(cx).clear(cx);
            window.refresh();window.draw(cx).clear(cx);
            assert!(trace.borrow().is_empty(),"draws precede the deferred mount and hover delivery");
        }).unwrap();
        cx.run_until_parked();
        assert_eq!(&*trace.borrow(),&["mounted","pointer.enter","host:mouseenter"],
            "a stale frame callback cannot consume the current view's only initial hover change");
        window.update(cx,|host,_,_|Owner::dispose(&host.owner)).unwrap();

        // The old frame's true cache is not authority for the current view:
        // move outside before the second draw, then genuinely enter again.
        let trace=Rc::new(RefCell::new(Vec::new()));let window=open(cx,trace.clone(),false);
        window.update(cx,|_,window,_|window.activate_window()).unwrap();frames(window,cx);
        cx.update_window(window.into(),|_,window,cx| {
            window.simulate_mouse_move(point(px(10.),px(10.)),cx);
            let host=window.root::<Host>().unwrap().unwrap();
            host.update(cx,|host,cx|{host.shown=true;cx.notify();});
            window.refresh();window.draw(cx).clear(cx);
            window.simulate_mouse_move(point(px(120.),px(60.)),cx);
            window.refresh();window.draw(cx).clear(cx);
        }).unwrap();cx.run_until_parked();
        assert_eq!(&*trace.borrow(),&["mounted"],"stale inside must not override the current outside hit-test");
        window.update(cx,|_,window,cx|window.simulate_mouse_move(point(px(10.),px(10.)),cx)).unwrap();
        assert_eq!(&*trace.borrow(),&["mounted","pointer.enter","host:mouseenter"],
            "a stale GPUI cache must not swallow the next real enter after reconciliation");
        frames(window,cx);
        assert_eq!(trace.borrow().len(),3,"physical reconciliation is finite and does not duplicate enter");
        window.update(cx,|host,_,_|Owner::dispose(&host.owner)).unwrap();
    }
}
`;
