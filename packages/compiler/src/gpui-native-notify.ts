/** Native observer delivery must happen outside GPUI's draw/focus phase. */
export const gpuiNativeNotifySource = `
/// Source state and platform effects have already settled when this is called.
/// GPUI suppresses Notify effects while drawing (including focus callbacks),
/// so wake retained consumers after the current host lease has returned. A
/// terminal owner can still have a live generated entity whose consumers need
/// its final events; only the entity's actual lifetime gates this notification.
pub fn notify_native_change<T:'static>(cx:&mut gpui::Context<T>) {
    let view=cx.entity().downgrade();
    cx.defer(move |cx| {
        if let Some(view)=view.upgrade(){cx.notify(view.entity_id());}
    });
}

/// An undelivered event queue is not a standing request for more notifications.
/// Consume only the fact that a new event was emitted, including a terminal
/// event whose owner is already disposed. Drawing may clear ordinary dirty;
/// it must not clear this independent pending delivery fact.
pub fn notify_native_events<T:'static>(owner:&OwnerRef,cx:&mut gpui::Context<T>)->bool {
    if !std::mem::take(&mut owner.borrow_mut().pending_native_events){return false}
    notify_native_change(cx);
    true
}

/// A public operation can publish before it throws. Its caller must retain
/// that exact error while the existing coalesced native drive delivers the
/// already-published events. Do not drive failed calls that published nothing.
pub fn drive_pending_native_events(owner:&OwnerRef,window:&mut Window,cx:&mut App) {
    let drive={let owner=owner.borrow();if !owner.pending_native_events{return}owner.native_drive.clone()};
    if let Some(drive)=drive{native_host_callback(owner,"event-notification",||drive(window,cx));}
}

#[cfg(all(test,feature="test-support"))]
mod native_notification_tests {
    use super::notify_native_change;
    use gpui::prelude::*;
    use gpui::{AppContext,Context,Entity,FocusHandle,InteractiveElement,IntoElement,ParentElement,
        Render,Styled,Subscription,TestAppContext,Window,WindowHandle,div,px,size};
    use std::{cell::RefCell,rc::Rc};

    struct FocusTarget {
        focus:FocusHandle,
        active:bool,
        retired:bool,
        _blur:Subscription,
    }
    impl FocusTarget {
        fn new(window:&mut Window,cx:&mut Context<Self>)->Self {
            let focus=cx.focus_handle();
            let blur=cx.on_blur(&focus,window,|target,_,cx| {
                // This callback runs in Window::draw's Focus phase. A direct
                // cx.notify() here does not enqueue a native observer effect.
                target.active=false;
                target.retired=true;
                notify_native_change(cx);
                assert!(!target.active,"source retirement stays synchronous");
            });
            Self{focus,active:true,retired:false,_blur:blur}
        }
    }
    impl Render for FocusTarget {
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
            div().id("native-notification-target").track_focus(&self.focus).size(px(24.))
        }
    }
    struct Host {
        target:Entity<FocusTarget>,
        outside:FocusHandle,
        observed:Rc<RefCell<Vec<(bool,bool)>>>,
        _changes:Subscription,
    }
    impl Render for Host {
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
            div().size_full().flex().child(self.target.clone())
                .child(div().id("native-notification-outside").track_focus(&self.outside).size(px(24.)))
        }
    }
    fn frames(window:WindowHandle<Host>,cx:&mut TestAppContext) {
        for _ in 0..3 {
            cx.update_window(window.into(),|_,window,cx|{
                window.refresh();window.draw(cx).clear(cx);
            }).unwrap();
            cx.run_until_parked();
        }
    }

    #[gpui::test]
    fn physical_blur_notifies_retained_consumers_after_source_retirement(cx:&mut TestAppContext) {
        let window=cx.open_window(size(px(96.),px(48.)),|window,cx|{
            let target=cx.new(|cx|FocusTarget::new(window,cx));
            let observed=Rc::new(RefCell::new(Vec::new()));
            let output=observed.clone();
            let changes=cx.observe(&target,move|_:&mut Host,target,cx|{
                let target=target.read(cx);
                output.borrow_mut().push((target.active,target.retired));
            });
            Host{target,outside:cx.focus_handle(),observed,_changes:changes}
        });
        window.update(cx,|_,window,_|window.activate_window()).unwrap();
        frames(window,cx);
        window.update(cx,|host,window,cx|{
            let focus=host.target.read(cx).focus.clone();
            window.focus(&focus,cx);
        }).unwrap();
        frames(window,cx);
        window.update(cx,|host,window,cx|{
            assert!(host.target.read(cx).focus.is_focused(window));
            assert!(host.observed.borrow().is_empty());
            window.focus(&host.outside,cx);
        }).unwrap();
        frames(window,cx);
        window.update(cx,|host,_,cx|{
            assert!(!host.target.read(cx).active);
            assert!(host.target.read(cx).retired);
            assert_eq!(&*host.observed.borrow(),&[(false,true)],
                "native consumers must receive retirement even when it occurred during draw");
        }).unwrap();
    }

    #[gpui::test]
    fn deferred_notification_does_not_keep_a_dropped_entity_alive(cx:&mut TestAppContext) {
        let weak=cx.update(|cx|{
            let target=cx.new(|_|());
            let weak=target.downgrade();
            target.update(cx,|_,cx|notify_native_change(cx));
            drop(target);
            weak
        });
        cx.run_until_parked();
        assert!(weak.upgrade().is_none(),"notification does not retain or resurrect its target");
    }
}

#[cfg(all(test,feature="test-support"))]
mod native_event_notification_tests {
    use super::*;
    use gpui::{AppContext,Context,Entity,IntoElement,Render,Subscription,TestAppContext,WindowHandle,px,size};

    struct EmittingTarget { owner:OwnerRef, value:f64, authored_renders:Rc<Cell<usize>> }
    impl EmittingTarget {
        fn new(cx:&Context<Self>)->Self {
            let owner=Owner::new(serde_json::json!({"value":0}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
            let weak=Rc::downgrade(&owner);
            props_define(&weak,record(vec![("value",record(vec![("type",Value::string("number")),("default",Value::number(0.))]))]));
            expose_event(&weak,Value::string("proposed"));
            watch_props(&weak,Some(Value::string("value")),false,Value::Function(Rc::new(|args|{
                let value=arg(&args,1).member("value",false);
                emit(&arg(&args,0).owner(),Value::string("proposed"),value.clone());
                if value.num()==13.{throw_value(Value::boolean(false))}
                Value::Undefined
            })));
            let method_owner=weak.clone();
            expose_method(&weak,Value::string("publishThenThrow"),Value::Function(Rc::new(move|_|{
                emit(&method_owner,Value::string("proposed"),Value::number(21.));throw_value(Value::number(0.))
            })));
            let authored_renders=Rc::new(Cell::new(0));let observed=authored_renders.clone();
            Owner::finish(&owner,capture_renderer(Value::Function(Rc::new(|_|Value::Json(Json::Null))),Rc::new(move |_|{
                observed.set(observed.get()+1);NativeSnapshot::empty()
            })));
            let target=cx.entity().downgrade();
            owner.borrow_mut().native_drive=Some(Rc::new(move|window,cx|{
                let target=target.clone();window.defer(cx,move|_,cx|{let _=target.update(cx,|target,cx|target.drive(cx));});
            }));
            Self{owner,value:0.,authored_renders}
        }
        fn replace(&mut self,value:f64,window:&mut Window,cx:&mut Context<Self>)->Result<(),Value> {
            if self.value==value{return Ok(())}
            self.value=value;
            // This is the real SDK Props watcher and Expose publication path,
            // invoked from the containing GPUI view's render below.
            let outcome=catch_authored(||replace_props(&self.owner,serde_json::json!({"value":value})));
            if outcome.is_err(){drive_pending_native_events(&self.owner,window,cx);}
            outcome?;self.drive(cx);Ok(())
        }
        fn call_throwing(&self,window:&mut Window,cx:&mut App)->Result<Value,Value> {
            let outcome=catch_authored(||{
                let callback=self.owner.borrow().exposes["publishThenThrow"].clone();
                let result=invoke(&self.owner,"expose-method",&callback,vec![]);
                let drive=self.owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx);}
                result
            });
            if outcome.is_err(){drive_pending_native_events(&self.owner,window,cx);}
            outcome
        }
        fn drive(&mut self,cx:&mut Context<Self>) {
            let dirty=std::mem::take(&mut self.owner.borrow_mut().dirty);
            if !notify_native_events(&self.owner,cx)&&dirty{cx.notify();}
        }
    }
    impl Render for EmittingTarget {
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement {
            Owner::project(&self.owner);
            // Native drawing consumes repaint dirtiness independently of the
            // one pending event notification, as the generated component does.
            self.owner.borrow_mut().dirty=false;
            div().size_full()
        }
    }
    struct EventHost {
        target:Entity<EmittingTarget>,desired:f64,notifications:usize,
        events:Vec<(String,Json)>,drain:bool,error:Option<Value>,_changes:Subscription,
    }
    impl Render for EventHost {
        fn render(&mut self,window:&mut Window,cx:&mut Context<Self>)->impl IntoElement {
            if let Err(error)=self.target.update(cx,|target,cx|target.replace(self.desired,window,cx)){self.error=Some(error);}
            div().size_full().child(self.target.clone())
        }
    }
    fn frames(window:WindowHandle<EventHost>,cx:&mut TestAppContext) {
        for _ in 0..3 {
            cx.update_window(window.into(),|_,window,cx|{window.refresh();window.draw(cx).clear(cx);}).unwrap();
            cx.run_until_parked();
        }
    }
    fn open(cx:&mut TestAppContext,drain:bool)->WindowHandle<EventHost> {
        let window=cx.open_window(size(px(96.),px(48.)),move|_,cx|{
            let target=cx.new(|cx|EmittingTarget::new(cx));
            let changes=cx.observe(&target,|host:&mut EventHost,target,cx|{
                host.notifications+=1;
                if host.drain{host.events.extend(std::mem::take(&mut target.read(cx).owner.borrow_mut().emitted));}
            });
            EventHost{target,desired:0.,notifications:0,events:Vec::new(),drain,error:None,_changes:changes}
        });
        frames(window,cx);window
    }

    #[gpui::test]
    fn render_time_props_emit_reaches_a_retained_consumer_without_authored_repaint(cx:&mut TestAppContext) {
        let window=open(cx,true);
        window.update(cx,|host,_,cx|{assert_eq!(host.notifications,0);host.desired=7.;cx.notify();}).unwrap();
        frames(window,cx);
        window.update(cx,|host,_,cx|{
            assert_eq!(host.notifications,1);
            assert_eq!(host.events,vec![("proposed".into(),serde_json::json!(7.))]);
            let target=host.target.read(cx);assert_eq!(target.authored_renders.get(),1);
            assert!(!target.owner.borrow().update_requested);assert!(!target.owner.borrow().pending_native_events);
        }).unwrap();
        frames(window,cx);
        window.update(cx,|host,_,cx|{assert_eq!(host.notifications,1);assert_eq!(host.target.read(cx).authored_renders.get(),1);}).unwrap();
    }

    #[gpui::test]
    fn undrained_event_backlog_does_not_repeat_notifications_or_repaint(cx:&mut TestAppContext) {
        let window=open(cx,false);
        window.update(cx,|host,_,cx|{host.desired=1.;cx.notify();}).unwrap();frames(window,cx);
        window.update(cx,|host,_,cx|{
            assert_eq!(host.notifications,1);let target=host.target.read(cx);
            assert_eq!(target.owner.borrow().emitted.len(),1);assert!(!target.owner.borrow().pending_native_events);
            assert_eq!(target.authored_renders.get(),1);
        }).unwrap();
        frames(window,cx);
        window.update(cx,|host,_,cx|{assert_eq!(host.notifications,1);host.desired=2.;cx.notify();}).unwrap();frames(window,cx);
        window.update(cx,|host,_,cx|{
            assert_eq!(host.notifications,2);let target=host.target.read(cx);
            assert_eq!(target.owner.borrow().emitted.len(),2);assert_eq!(target.authored_renders.get(),1);
        }).unwrap();
    }

    #[gpui::test]
    fn terminal_owner_events_still_notify_a_live_retained_entity(cx:&mut TestAppContext) {
        let window=open(cx,true);
        window.update(cx,|host,_,cx|{
            host.target.update(cx,|target,cx|{
                invoke_scoped(&target.owner,"callback",||emit(&Rc::downgrade(&target.owner),Value::string("proposed"),Value::number(9.)));
                Owner::dispose(&target.owner);
                assert!(target.owner.borrow().pending_native_events);
                target.drive(cx);
            });
        }).unwrap();frames(window,cx);
        window.update(cx,|host,_,cx|{
            assert_eq!(host.notifications,1);assert_eq!(host.events,vec![("proposed".into(),serde_json::json!(9.))]);
            let target=host.target.read(cx);assert!(target.owner.borrow().disposed);assert!(!target.owner.borrow().pending_native_events);
        }).unwrap();
    }

    #[gpui::test]
    fn render_time_watcher_emit_then_throw_keeps_false_and_delivers_once(cx:&mut TestAppContext) {
        let window=open(cx,true);
        window.update(cx,|host,_,cx|{host.desired=13.;cx.notify();}).unwrap();frames(window,cx);
        window.update(cx,|host,_,cx|{
            assert!(matches!(host.error,Some(Value::Json(Json::Bool(false)))),"the original falsy authored error survives notification scheduling");
            assert_eq!(host.notifications,1);assert_eq!(host.events,vec![("proposed".into(),serde_json::json!(13.))]);
            assert_eq!(host.target.read(cx).authored_renders.get(),1);
        }).unwrap();
        frames(window,cx);
        window.update(cx,|host,_,_|{assert_eq!(host.notifications,1);assert_eq!(host.events.len(),1);}).unwrap();
    }

    #[gpui::test]
    fn public_method_emit_then_throw_keeps_zero_and_delivers_once(cx:&mut TestAppContext) {
        let window=open(cx,true);
        window.update(cx,|host,window,cx|{
            let error=host.target.update(cx,|target,cx|target.call_throwing(window,cx)).unwrap_err();
            assert!(strict_equal(&error,&Value::number(0.)),"the exact authored error is returned before the retained observer runs");
            assert_eq!(host.notifications,0);
        }).unwrap();frames(window,cx);
        window.update(cx,|host,_,cx|{
            assert_eq!(host.notifications,1);assert_eq!(host.events,vec![("proposed".into(),serde_json::json!(21.))]);
            assert_eq!(host.target.read(cx).authored_renders.get(),1);
        }).unwrap();
        frames(window,cx);
        window.update(cx,|host,_,_|{assert_eq!(host.notifications,1);assert_eq!(host.events.len(),1);}).unwrap();
    }
}
`;
