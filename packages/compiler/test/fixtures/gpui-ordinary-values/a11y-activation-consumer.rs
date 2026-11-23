//! Native action entry for unchanged, independently compiled Base prototypes.
//! The lease is the production on_a11y_action callback bridge. Invoking it is
//! native framework evidence, not delivery from an OS or assistive technology.
use gpui::{prelude::*, px, size, App, Context, Entity, IntoElement, Render, TestAppContext, Window, WindowHandle};
use proto_ui_gpui_native::gpui_native_owner::{
    accessible_action, accessible_action_spec, action_from_name, as_accessible,
    control_label_action_lease, listen, native_accessible_action_lease, ControlLabelRef,
    InstanceAssociations, NativeAccessibleActionLease, NativeSnapshot, Owner, OwnerRef, Value,
};
use serde_json::{json, Value as Json};
use std::{cell::Cell, rc::Rc};

enum Target {
    Button(Entity<base_button::CompiledComponent>),
    Toggle(Entity<base_toggle::CompiledComponent>),
}
impl Target {
    fn owner(&self, cx: &App) -> OwnerRef {
        match self { Self::Button(view) => view.read(cx).owner.clone(), Self::Toggle(view) => view.read(cx).owner.clone() }
    }
    fn view(&self) -> gpui::AnyView {
        match self { Self::Button(view) => view.clone().into(), Self::Toggle(view) => view.clone().into() }
    }
    fn events(&self, cx: &App) -> Vec<(String, Json)> {
        match self { Self::Button(view) => view.read(cx).handle().take_events(), Self::Toggle(view) => view.read(cx).handle().take_events() }
    }
    fn state(&self, key: &str, cx: &App) -> Json {
        match self { Self::Button(view) => view.read(cx).handle().state(key).unwrap(), Self::Toggle(view) => view.read(cx).handle().state(key).unwrap() }
    }
    fn set_props(&self, props: Json, window: &mut Window, cx: &mut App) {
        match self { Self::Button(view) => view.update(cx, |view, cx| view.set_props(props, window, cx).unwrap()), Self::Toggle(view) => view.update(cx, |view, cx| view.set_props(props, window, cx).unwrap()) }
    }
    fn dispose(&self, window: &mut Window, cx: &mut App) {
        match self { Self::Button(view) => view.read(cx).handle().dispose(window, cx).unwrap(), Self::Toggle(view) => view.read(cx).handle().dispose(window, cx).unwrap() }
    }
}
struct Harness { target: Target, shown: bool }
impl Render for Harness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let root = gpui::div().size_full().p_4();
        if self.shown { root.child(self.target.view()) } else { root }
    }
}
fn open(cx: &mut TestAppContext, toggle: bool, props: Json) -> WindowHandle<Harness> {
    let window = cx.open_window(size(px(480.), px(320.)), |window, cx| {
        let content = vec![NativeSnapshot::text_value(Value::string("Original authored target"))];
        let target = if toggle {
            let view = base_toggle::CompiledComponent::create(props, None, window, cx).unwrap();
            view.update(cx, |view, cx| view.set_slot(content, cx).unwrap());
            Target::Toggle(view)
        } else {
            let view = base_button::CompiledComponent::create(props, None, window, cx).unwrap();
            view.update(cx, |view, cx| view.set_slot(content, cx).unwrap());
            Target::Button(view)
        };
        Harness { target, shown: true }
    });
    window.update(cx, |_, window, _| window.activate_window()).unwrap();
    frames(window, cx);
    window
}
fn frames<T: Render>(window: WindowHandle<T>, cx: &mut TestAppContext) {
    for _ in 0..3 {
        cx.update_window(window.into(), |_, window, cx| { window.refresh(); window.draw(cx).clear(cx); }).unwrap();
        cx.run_until_parked();
    }
}
fn activation(host: &Harness, cx: &App) -> NativeAccessibleActionLease {
    native_accessible_action_lease(&host.target.owner(cx), "activate").expect("declared native action")
}

#[gpui::test]
fn actual_button_activation_preserves_disabled_and_exact_view_lifetime(cx: &mut TestAppContext) {
    let first = open(cx, false, json!({}));
    let lease = first.update(cx, |host, _, cx| activation(host, cx)).unwrap();
    let foreign = open(cx, false, json!({}));
    foreign.update(cx, |host, window, cx| {
        lease.request(window, cx);
        assert!(host.target.events(cx).is_empty());
    }).unwrap();
    first.update(cx, |host, window, cx| {
        assert!(host.target.events(cx).is_empty(), "a foreign Window cannot activate the original owner");
        host.target.set_props(json!({"disabled": true}), window, cx);
        lease.request(window, cx);
        assert!(host.target.events(cx).is_empty());
        host.target.set_props(json!({"disabled": false}), window, cx);
        for _ in 0..2 {
            lease.request(window, cx);
            assert_eq!(host.target.events(cx), vec![("click".into(), Json::Null)], "each native request enters the authored operation exactly once");
            assert_eq!(host.target.state("pressed", cx), json!(false));
        }
        host.shown = false;
        cx.notify();
    }).unwrap();
    frames(first, cx);
    first.update(cx, |host, window, cx| {
        assert!(!host.target.owner(cx).borrow().mounted);
        lease.request(window, cx);
        assert!(host.target.events(cx).is_empty());
        host.shown = true;
        cx.notify();
    }).unwrap();
    frames(first, cx);
    first.update(cx, |host, window, cx| {
        lease.request(window, cx);
        assert!(host.target.events(cx).is_empty(), "remount must not revive the old callback");
        let current = activation(host, cx);
        current.request(window, cx);
        assert_eq!(host.target.events(cx), vec![("click".into(), Json::Null)]);
        host.target.dispose(window, cx);
        current.request(window, cx);
        assert!(host.target.events(cx).is_empty());
        assert!(native_accessible_action_lease(&host.target.owner(cx), "activate").is_none());
    }).unwrap();
}

#[gpui::test]
fn actual_toggle_activation_keeps_authored_controlled_state_and_event(cx: &mut TestAppContext) {
    for controlled in [false, true] {
        let props = if controlled { json!({"active": false}) } else { json!({"defaultActive": false}) };
        let window = open(cx, true, props);
        window.update(cx, |host, window, cx| {
            let lease = activation(host, cx);
            lease.request(window, cx);
            assert_eq!(host.target.events(cx), vec![("activeChange".into(), json!({"active": true}))]);
            assert_eq!(host.target.state("active", cx), json!(!controlled));
            assert_eq!(host.target.state("pressed", cx), json!(false));
            lease.request(window, cx);
            assert_eq!(host.target.events(cx), vec![("activeChange".into(), json!({"active": controlled}))]);
            assert_eq!(host.target.state("active", cx), json!(false));
            let disabled = if controlled { json!({"active": false, "disabled": true}) } else { json!({"disabled": true}) };
            host.target.set_props(disabled, window, cx);
            lease.request(window, cx);
            assert!(host.target.events(cx).is_empty());
            assert_eq!(host.target.state("active", cx), json!(false));
        }).unwrap();
    }
}

#[gpui::test]
fn native_action_routes_keep_declaration_identity_and_reject_unknown_names(cx: &mut TestAppContext) {
    for name in ["activate", "click", "press"] {
        assert!(matches!(action_from_name(name), gpui::AccessibleAction::Click));
    }
    assert!(matches!(action_from_name("focus"), gpui::AccessibleAction::Focus));
    assert!(matches!(action_from_name("increment"), gpui::AccessibleAction::Increment));
    assert!(matches!(action_from_name("decrement"), gpui::AccessibleAction::Decrement));
    assert!(std::panic::catch_unwind(|| action_from_name("unknown-native-action")).is_err());
    let window = open(cx, false, json!({}));
    window.update(cx, |host, window, cx| {
        // Manual SDK controls isolate setup replacement and metadata routing;
        // the two preceding tests execute the actual authored Base definitions.
        let vocabulary = host.target.owner(cx).borrow().style_vocabulary;
        let owner = Owner::new(json!({}), Default::default(), |_, _| true, |_| true, |_, _| true, vocabulary);
        owner.borrow_mut().window_id = Some(window.window_handle().window_id());
        let weak = Rc::downgrade(&owner);
        as_accessible(&weak);
        let commits = Rc::new(Cell::new(0));
        let forged_input = Rc::new(Cell::new(0));
        let other_route = Rc::new(Cell::new(0));
        let default_route = Rc::new(Cell::new(0));
        let drives = Rc::new(Cell::new(0));
        for (kind, count) in [("press.commit", commits.clone()), ("outward-result", forged_input.clone()), ("other-route", other_route.clone()), ("a11y:click", default_route.clone())] {
            listen(&weak, Value::string(kind), false, Value::Function(Rc::new(move |_| { count.set(count.get() + 1); Value::Undefined })), Value::Undefined);
        }
        accessible_action_spec(&weak, Value::string("activate"), Value::json(json!({"event": "outward-result"})));
        let replaced = native_accessible_action_lease(&owner, "activate").unwrap();
        accessible_action_spec(&weak, Value::string("activate"), Value::json(json!({"event": "outward-result"})));
        let current = native_accessible_action_lease(&owner, "activate").unwrap();
        accessible_action_spec(&weak, Value::string("press"), Value::json(json!({"event": "other-route"})));
        let other = native_accessible_action_lease(&owner, "press").unwrap();
        accessible_action_spec(&weak, Value::string("click"), Value::json(json!({"event": "outward-result"})));
        let old_default = native_accessible_action_lease(&owner, "click").unwrap();
        accessible_action(&weak, Value::string("click"));
        let default = native_accessible_action_lease(&owner, "click").unwrap();
        let counted = drives.clone();
        owner.borrow_mut().native_drive = Some(Rc::new(move |_, _| counted.set(counted.get() + 1)));
        Owner::finish(&owner, Value::Undefined);
        Owner::project(&owner);
        owner.borrow_mut().bounds = host.target.owner(cx).borrow().bounds;
        let revision = owner.borrow().projection_revision;
        Owner::commit(&owner, revision);
        replaced.request(window, cx);
        old_default.request(window, cx);
        assert_eq!((commits.get(), forged_input.get(), drives.get()), (0, 0, 0), "same-key setup replacement retires callbacks, even with identical metadata");
        current.request(window, cx);
        assert_eq!((commits.get(), forged_input.get(), drives.get()), (1, 0, 1), "activate metadata is not a fabricated event input");
        other.request(window, cx);
        default.request(window, cx);
        assert_eq!((other_route.get(), default_route.get(), forged_input.get()), (1, 1, 0), "other existing action routes retain their declared/default inputs");
        owner.borrow_mut().accessible_actions.remove("activate");
        let before = drives.get();
        current.request(window, cx);
        assert_eq!((commits.get(), drives.get()), (1, before), "an absent declaration cannot activate or drive effects");
        Owner::dispose(&owner);
    }).unwrap();
}

struct LabelPair {
    label: Entity<base_label::CompiledComponent>,
    target: Entity<base_button::CompiledComponent>,
}
impl Render for LabelPair {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full().flex().flex_col().items_start().gap_4().p_4()
            .child(self.label.clone()).child(self.target.clone())
    }
}
fn open_pair(cx: &mut TestAppContext) -> WindowHandle<LabelPair> {
    let window = cx.open_window(size(px(480.), px(320.)), |window, cx| {
        let reference = ControlLabelRef::new();
        let label = base_label::CompiledComponent::create_with_associations(json!({}), None, InstanceAssociations { control_label: Some(reference.clone()) }, window, cx).unwrap();
        let target = base_button::CompiledComponent::create_with_associations(json!({}), None, InstanceAssociations { control_label: Some(reference) }, window, cx).unwrap();
        label.update(cx, |view, cx| view.set_slot(vec![NativeSnapshot::text_value(Value::string("Actual Label"))], cx).unwrap());
        target.update(cx, |view, cx| view.set_slot(vec![NativeSnapshot::text_value(Value::string("Actual Button"))], cx).unwrap());
        LabelPair { label, target }
    });
    frames(window, cx);
    window
}

#[gpui::test]
fn control_label_action_rejects_a_foreign_window_before_target_work(cx: &mut TestAppContext) {
    let first = open_pair(cx);
    let second = open_pair(cx);
    let first_action = first.update(cx, |host, _, cx| control_label_action_lease(&host.label.read(cx).owner).unwrap()).unwrap();
    let second_action = second.update(cx, |host, _, cx| control_label_action_lease(&host.label.read(cx).owner).unwrap()).unwrap();
    second.update(cx, |host, window, cx| {
        first_action.request(window, cx);
        assert!(host.target.read(cx).handle().take_events().is_empty());
    }).unwrap();
    first.update(cx, |host, window, cx| {
        assert!(host.target.read(cx).handle().take_events().is_empty(), "a valid pair must not grant work in the wrong host Window");
        second_action.request(window, cx);
        assert!(host.target.read(cx).handle().take_events().is_empty());
        first_action.request(window, cx);
        assert_eq!(host.target.read(cx).handle().take_events(), vec![("click".into(), Json::Null)]);
    }).unwrap();
    second.update(cx, |host, window, cx| {
        assert!(host.target.read(cx).handle().take_events().is_empty(), "foreign-window refusal must hold in both directions");
        second_action.request(window, cx);
        assert_eq!(host.target.read(cx).handle().take_events(), vec![("click".into(), Json::Null)]);
    }).unwrap();
}
