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
`;
