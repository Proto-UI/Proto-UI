// v9 static reconstruction: original visible prefix retained; late-resource tail newly authored.
// No Rust execution or original-file SHA identity is claimed.
//! Actual generated Component.rs and ordinary GPUI Entity/AnyView consumer.
//! No Adapter bridge, Node peer, runtime IR fixture or replacement owner.
use generated_gpui_component::CompiledComponent;
use gpui::{prelude::*, px, size, AnyView, AnyWindowHandle, Context, Render, TestAppContext, VisualTestContext, Window};
use proto_ui_gpui_native::gpui_native_owner::{text_content, NativeSnapshot, Owner, Value};
use serde_json::json;
use std::{cell::Cell, panic::{catch_unwind, AssertUnwindSafe}, rc::Rc};

struct NativeSibling {
    renders: Rc<Cell<usize>>,
    drops: Rc<Cell<usize>>,
}
impl Render for NativeSibling {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        self.renders.set(self.renders.get() + 1);
        gpui::div().child("ordinary GPUI child")
    }
}
impl Drop for NativeSibling {
    fn drop(&mut self) {
        self.drops.set(self.drops.get() + 1);
    }
}

fn draw(cx: &mut VisualTestContext) {
    cx.update(|window, cx| {
        window.refresh();
        window.draw(cx).clear(cx);
    });
    cx.run_until_parked();
}

#[gpui::test]
fn generated_component_preserves_native_children_and_requested_projection(cx: &mut TestAppContext) {
    let window = cx.open_window(size(px(320.), px(240.)), |window, cx| {
        CompiledComponent::new(json!({}), None, window, cx)
    });
    let mut visual = VisualTestContext::from_window(AnyWindowHandle::from(window), cx);
    let renders = Rc::new(Cell::new(0));
    let drops = Rc::new(Cell::new(0));
    let native = visual.update(|_, cx| cx.new(|_| NativeSibling {
        renders: renders.clone(), drops: drops.clone(),
    }));
    let native_id = native.entity_id();
    let weak_native = native.downgrade();
    window.update(&mut visual, |component, _, cx| {
        component.set_slot(vec![
            NativeSnapshot::text_value(Value::string("external")),
            NativeSnapshot::native_view(AnyView::from(native)),
        ], cx);
    }).unwrap();
    draw(&mut visual);
    let handle = window.update(&mut visual, |component, _, _| component.handle()).unwrap();
    let owner = handle.owner.clone();
    let (revision, identity) = {
        let owner = owner.borrow();
        assert!(owner.mounted);
        assert_eq!(text_content(&owner.projection, &owner.slot), "A0A0external");
        (owner.projection_revision, owner.projection.as_ref().unwrap().identity.clone())
    };
    assert!(renders.get() > 0, "a real ordinary GPUI child was rendered");
    window.update(&mut visual, |component, _, cx| {
        let before = component.owner.borrow().slot.iter().map(|child| child.identity.clone()).collect::<Vec<_>>();
        let before_revision = component.owner.borrow().projection_revision;
        let before_dirty = component.owner.borrow().dirty;
        let rejected = catch_unwind(AssertUnwindSafe(|| component.set_slot(vec![
            NativeSnapshot::text_value(Value::string("must not partially replace")),
            NativeSnapshot::invalid(Value::Undefined),
        ], cx)));
        assert!(rejected.is_err());
        let retained = component.owner.borrow();
        assert_eq!(retained.slot.len(), before.len());
        assert!(retained.slot.iter().zip(&before).all(|(child, prior)| Rc::ptr_eq(&child.identity, prior)));
        assert_eq!(retained.projection_revision, before_revision);
        assert_eq!(retained.dirty, before_dirty);
        assert_eq!(text_content(&retained.projection, &retained.slot), "A0A0external");
    }).unwrap();

    // New v9 boundary: externally supplied factories cannot claim this owner's slot.
    window.update(&mut visual, |component, _, cx| {
        let before = component.owner.borrow().slot.iter().map(|child| child.identity.clone()).collect::<Vec<_>>();
        let rejected = catch_unwind(AssertUnwindSafe(|| component.set_slot(vec![
            NativeSnapshot::sequence(vec![NativeSnapshot::slot()], None),
        ], cx)));
        assert!(rejected.is_err());
        let retained = component.owner.borrow();
        assert_eq!(retained.slot.len(), before.len());
        assert!(retained.slot.iter().zip(&before).all(|(child, prior)| Rc::ptr_eq(&child.identity, prior)));
    }).unwrap();

    for _ in 0..3 { draw(&mut visual); }
    assert_eq!(owner.borrow().projection_revision, revision, "native repaint is not authored render");
    assert!(Rc::ptr_eq(&identity, &owner.borrow().projection.as_ref().unwrap().identity));
    assert_eq!(weak_native.upgrade().unwrap().entity_id(), native_id);

    window.update(&mut visual, |component, window, cx| {
        component.set_props(json!({"next":1,"requested":false}), window, cx);
    }).unwrap();
    draw(&mut visual);
    assert_eq!(handle.state("count").as_f64(), Some(1.0));
    assert_eq!(owner.borrow().projection_revision, revision);
    assert_eq!(text_content(&owner.borrow().projection, &owner.borrow().slot), "A0A0external");

    window.update(&mut visual, |component, window, cx| {
        component.set_props(json!({"next":1,"requested":true}), window, cx);
    }).unwrap();
    draw(&mut visual);
    let next_revision = owner.borrow().projection_revision;
    assert_eq!(next_revision, revision + 1);
    assert_eq!(text_content(&owner.borrow().projection, &owner.borrow().slot), "A1A1external");
    let committed = owner.borrow().committed_revision;
    Owner::commit(&owner, revision);
    assert_eq!(owner.borrow().committed_revision, committed, "retired canvas commit cannot win");

    visual.update(|window, cx| handle.dispose(window, cx));
    draw(&mut visual);
    assert!(owner.borrow().disposed);
    assert!(owner.borrow().projection.is_none());
    assert!(owner.borrow().slot.is_empty());
    assert_eq!(drops.get(), 1, "the released ordinary native child is dropped once");
    assert!(weak_native.upgrade().is_none());
    visual.update(|window, cx| handle.dispose(window, cx));
    assert_eq!(drops.get(), 1, "repeated disposal does not dispose the native child twice");
    let rejected_drops = Rc::new(Cell::new(0));
    let late = visual.update(|_, cx| cx.new(|_| NativeSibling {
        renders: Rc::new(Cell::new(0)), drops: rejected_drops.clone(),
    }));
    let late_weak = late.downgrade();
    window.update(&mut visual, |component, _, cx| {
        let rejected = catch_unwind(AssertUnwindSafe(|| component.set_slot(vec![
            NativeSnapshot::native_view(AnyView::from(late)),
        ], cx)));
        assert!(rejected.is_err(), "terminal owner rejects a late native resource");
        assert!(component.owner.borrow().slot.is_empty());
        assert!(component.owner.borrow().projection.is_none());
    }).unwrap();
    draw(&mut visual);
    assert!(late_weak.upgrade().is_none());
    assert_eq!(rejected_drops.get(), 1);
    assert_eq!(drops.get(), 1);
}
