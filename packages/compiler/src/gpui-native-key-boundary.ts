/** Native cancellation is observed before synthesizing root key-down intent. */
export const gpuiNativeKeyBoundarySource = String.raw`
// C-EVENT-TYPE-0002 separates portable intent from a host event alias. A
// native descendant can consume a sample while its physical event still
// bubbles. Do not promote that sample into the ancestor's root key/press
// route. Read this fact before portable callbacks: their own default-action
// request (for example Space scroll prevention) still permits the source's
// normal activation intent. Raw host/global observations remain independent.
// Key-up is deliberately not gated: terminal callbacks must release ordinary
// source-owned key sessions as well as the SDK's Enter/Space press lease.
fn native_root_key_target(window:&Window)->Option<OwnerRef> {
    if window.default_prevented(){return None}
    KEY_TARGET.with(|target|target.borrow().as_ref().and_then(Weak::upgrade))
}

#[cfg(all(test,feature="test-support"))]
mod native_key_boundary_tests {
    use super::*;
    use gpui::{AppContext,Context,Entity,IntoElement,KeyDownEvent,KeyUpEvent,
        Keystroke,PlatformInput,Render,Subscription,TestAppContext,WindowHandle,px,size};

    struct NativeChild {
        focus:FocusHandle, consume_down:Rc<Cell<bool>>, consume_up:Rc<Cell<bool>>,
        trace:Rc<RefCell<Vec<String>>>,
    }
    impl Render for NativeChild {
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
            let down=self.consume_down.clone();let up=self.consume_up.clone();
            let down_trace=self.trace.clone();let up_trace=self.trace.clone();
            div().id("key-boundary-native-child").w(px(96.)).h(px(40.))
                .track_focus(&self.focus)
                .on_key_down(move|event,window,_|{
                    down_trace.borrow_mut().push(format!("native.down:{}",event.keystroke.key));
                    if down.get(){window.prevent_default();}
                })
                .on_key_up(move|event,window,_|{
                    up_trace.borrow_mut().push(format!("native.up:{}",event.keystroke.key));
                    if up.get(){window.prevent_default();}
                })
        }
    }
    struct Host {
        owner:OwnerRef, focus:FocusHandle, child_focus:FocusHandle, outside:FocusHandle,
        consume_down:Rc<Cell<bool>>, consume_up:Rc<Cell<bool>>,
        trace:Rc<RefCell<Vec<String>>>, pressed:Rc<Cell<bool>>,
        _child:Entity<NativeChild>, _blur:Subscription,
    }
    impl Render for Host {
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
            Owner::project(&self.owner);
            let snapshot=self.owner.borrow().projection.clone().unwrap();
            div().size_full().flex()
                .child(paint_native_root(&snapshot,&self.owner,&self.focus,
                    "key-boundary-root".into(),Rc::new(|_,_|{})))
                .child(div().id("key-boundary-outside").track_focus(&self.outside).size(px(40.)))
        }
    }
    fn open(cx:&mut TestAppContext,consume:bool)->WindowHandle<Host> {
        let window=cx.open_window(size(px(240.),px(100.)),move|window,cx|{
            let owner=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,
                |_|true,|_,_|true,crate::gpui_native_style::vocabulary());
            let weak=Rc::downgrade(&owner);
            as_focusable(&weak);
            let trace=Rc::new(RefCell::new(Vec::new()));let pressed=Rc::new(Cell::new(false));
            for kind in ["key.down","key.up","press.start","press.commit","press.end","press.cancel"] {
                let observed=trace.clone();let active=pressed.clone();
                listen(&weak,Value::string(kind),false,Value::Function(Rc::new(move|args|{
                    let input=arg(&args,1);let key=input.member("key",false);
                    observed.borrow_mut().push(format!("{}:{}",kind,if key.nullish(){String::new()}else{key.text()}));
                    if kind=="press.start"||(kind=="key.down"&&key.text()=="a"){active.set(true);}
                    if matches!(kind,"press.end"|"press.cancel")||(kind=="key.up"&&key.text()=="a"){active.set(false);}
                    if kind=="key.down"&&key.text()==" "{prevent(input);}
                    Value::Undefined
                })),Value::Undefined);
            }
            let observed=trace.clone();
            listen(&weak,Value::string("host:keydown"),false,Value::Function(Rc::new(move|args|{
                observed.borrow_mut().push(format!("host.down:{}",arg(&args,1).member("key",false).text()));
                Value::Undefined
            })),Value::Undefined);
            Owner::finish(&owner,Value::Undefined);
            register_sequential_focus_owner(&owner,cx);
            let focus=cx.focus_handle();let child_focus=cx.focus_handle();
            let consume_down=Rc::new(Cell::new(consume));let consume_up=Rc::new(Cell::new(consume));
            let child=cx.new(|_|NativeChild{focus:child_focus.clone(),consume_down:consume_down.clone(),consume_up:consume_up.clone(),trace:trace.clone()});
            owner.borrow_mut().slot=vec![NativeSnapshot::native_view(child.clone().into())];
            let blur=cx.on_blur(&focus,window,|host:&mut Host,_,_|{native_press_blur(&host.owner);});
            Host{owner,focus,child_focus,outside:cx.focus_handle(),consume_down,consume_up,trace,pressed,_child:child,_blur:blur}
        });
        window.update(cx,|_,window,_|window.activate_window()).unwrap();
        frames(window,cx);
        window.update(cx,|host,window,cx|window.focus(&host.child_focus,cx)).unwrap();
        frames(window,cx);window
    }
    fn frames(window:WindowHandle<Host>,cx:&mut TestAppContext) {
        for _ in 0..3 {
            cx.update_window(window.into(),|_,window,cx|{window.refresh();window.draw(cx).clear(cx);}).unwrap();
            cx.run_until_parked();
        }
    }
    fn key(window:WindowHandle<Host>,name:&str,down:bool,cx:&mut TestAppContext) {
        cx.update_window(window.into(),|_,window,cx|{
            let mut keystroke=Keystroke::parse(name).unwrap();
            // This physical sample explicitly carries the printable text fact.
            if name=="a"{keystroke.key_char=Some("a".into());}
            window.dispatch_event(if down {
                PlatformInput::KeyDown(KeyDownEvent{keystroke,is_held:false,prefer_character_input:false})
            } else {PlatformInput::KeyUp(KeyUpEvent{keystroke})},cx);
        }).unwrap();
        cx.run_until_parked();
    }
    fn semantic_trace(host:&Host)->Vec<String> {
        host.trace.borrow().iter().filter(|item|item.starts_with("key.")||item.starts_with("press.")).cloned().collect()
    }

    #[gpui::test]
    fn native_child_cancellation_does_not_become_ancestor_keyboard_intent(cx:&mut TestAppContext) {
        let window=open(cx,true);
        window.update(cx,|host,window,_|assert!(host.child_focus.is_focused(window))).unwrap();
        for name in ["enter","escape","space"]{key(window,name,true,cx);key(window,name,false,cx);}
        window.update(cx,|host,_,_|{
            assert_eq!(semantic_trace(host),["key.up:Enter","key.up:Escape","key.up: "],
                "canceled key-down cannot create root intent; terminal key-up stays observable");
            for name in ["enter","escape","space"] {
                assert!(host.trace.borrow().contains(&format!("native.down:{name}")));
                assert!(host.trace.borrow().contains(&format!("native.up:{name}")));
            }
            for name in ["Enter","Escape"," "]{assert!(host.trace.borrow().contains(&format!("host.down:{name}")),"physical bubbling still reaches the raw host listener");}
            assert!(host.owner.borrow().press.key.is_none());assert!(!host.pressed.get());
        }).unwrap();
        window.update(cx,|host,_,_|{host.trace.borrow_mut().clear();host.consume_down.set(false);host.consume_up.set(false);}).unwrap();
        key(window,"enter",true,cx);key(window,"enter",false,cx);
        window.update(cx,|host,_,_|{
            assert_eq!(semantic_trace(host),["key.down:Enter","press.start:Enter","press.commit:Enter","key.up:Enter","press.end:Enter"]);
            assert!(!host.pressed.get());assert!(host.owner.borrow().press.key.is_none());
        }).unwrap();
    }

    #[gpui::test]
    fn source_space_prevention_keeps_one_activation_and_canceled_up_retires_the_lease(cx:&mut TestAppContext) {
        let window=open(cx,false);
        key(window,"space",true,cx);
        window.update(cx,|host,window,_|{
            assert!(host.child_focus.is_focused(window));
            assert!(host.pressed.get());assert_eq!(host.owner.borrow().press.key.as_deref(),Some(" "));
            assert_eq!(semantic_trace(host),["key.down: ","press.start: ","press.commit: "]);
            host.consume_up.set(true);
        }).unwrap();
        key(window,"space",false,cx);
        window.update(cx,|host,_,_|{
            assert!(host.trace.borrow().contains(&"native.up:space".into()));
            assert_eq!(semantic_trace(host),["key.down: ","press.start: ","press.commit: ","key.up: ","press.end: "]);
            assert!(!host.pressed.get());assert!(host.owner.borrow().press.key.is_none(),"canceled key-up cannot retain an earlier live press");
            host.trace.borrow_mut().clear();
        }).unwrap();
        // A non-activation key has no SDK press lease. Its source callback
        // still owns a session that must receive the real terminal key-up.
        key(window,"a",true,cx);
        window.update(cx,|host,_,_|{
            assert!(host.pressed.get());assert!(host.owner.borrow().press.key.is_none());
        }).unwrap();
        key(window,"a",false,cx);
        window.update(cx,|host,_,_|{
            assert_eq!(semantic_trace(host),["key.down:a","key.up:a"]);
            assert!(!host.pressed.get(),"native cancellation cannot suppress source-owned terminal input");
        }).unwrap();
    }

    #[gpui::test]
    fn native_focus_loss_cancels_a_held_root_press_before_late_key_up(cx:&mut TestAppContext) {
        let window=open(cx,false);
        window.update(cx,|host,window,cx|window.focus(&host.focus,cx)).unwrap();frames(window,cx);
        key(window,"enter",true,cx);
        window.update(cx,|host,window,cx|{
            assert!(host.focus.is_focused(window));assert!(host.pressed.get());
            assert_eq!(host.owner.borrow().press.key.as_deref(),Some("Enter"));
            window.focus(&host.outside,cx);
        }).unwrap();frames(window,cx);
        window.update(cx,|host,_,_|{
            assert!(!host.pressed.get());assert!(host.owner.borrow().press.key.is_none());
            assert_eq!(semantic_trace(host).iter().filter(|item|item.starts_with("press.cancel:")).count(),1);
            assert_eq!(semantic_trace(host).iter().filter(|item|item.starts_with("press.commit:")).count(),1);
        }).unwrap();
        key(window,"enter",false,cx);
        window.update(cx,|host,_,_|{
            assert!(!host.pressed.get());assert!(host.owner.borrow().press.key.is_none());
            assert_eq!(semantic_trace(host).iter().filter(|item|item.starts_with("press.commit:")).count(),1);
        }).unwrap();
    }
}
`;
