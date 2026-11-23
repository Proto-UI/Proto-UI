//! Unchanged Base Button, Toggle and Label compiled as separate crates.
//! TestAppContext dispatch is native framework evidence. The action lease below
//! is the production callback bridge, not physical OS/assistive-technology input.
use gpui::{
    prelude::*, point, px, size, App, Context, Element, Entity, Focusable, IntoElement,
    MouseButton, Modifiers, Render, TestAppContext, Window, WindowHandle,
};
use proto_ui_gpui_native::gpui_native_a11y::Semantics;
use proto_ui_gpui_native::gpui_native_owner::{
    control_label_action_lease, detach_native_view, native_key_input_needed,
    native_resource_counts, native_tab_participation, replace_instance_associations,
    take_control_label_diagnostics, watch_state, ControlLabelActionLease, ControlLabelRef,
    InstanceAssociations, NativeSnapshot, Owner, OwnerRef, Value,
};
use serde_json::{json, Value as Json};
use std::{cell::Cell, rc::Rc};

#[derive(Clone)]
enum Target {
    Button(Entity<base_button::CompiledComponent>),
    Toggle(Entity<base_toggle::CompiledComponent>),
    Named(Entity<named_button::CompiledComponent>),
}
impl Target {
    fn create(kind: &str, props: Json, reference: &ControlLabelRef, window: &mut Window, cx: &mut App) -> Self {
        let associations = associations(reference);
        let target = match kind {
            "button" => Self::Button(base_button::CompiledComponent::create_with_associations(props, None, associations, window, cx).unwrap()),
            "toggle" => Self::Toggle(base_toggle::CompiledComponent::create_with_associations(props, None, associations, window, cx).unwrap()),
            "named" => Self::Named(named_button::CompiledComponent::create_with_associations(props, None, associations, window, cx).unwrap()),
            _ => panic!("unknown consumer target"),
        };
        match &target {
            Self::Button(view) => view.update(cx, |view, cx| view.set_slot(text("Original button content"), cx).unwrap()),
            Self::Toggle(view) => view.update(cx, |view, cx| view.set_slot(text("Original toggle content"), cx).unwrap()),
            Self::Named(view) => view.update(cx, |view, cx| view.set_slot(text("Original named button content"), cx).unwrap()),
        }
        target
    }
    fn view(&self) -> gpui::AnyView {
        match self { Self::Button(view) => view.clone().into(), Self::Toggle(view) => view.clone().into(), Self::Named(view) => view.clone().into() }
    }
    fn owner(&self, cx: &App) -> OwnerRef {
        match self { Self::Button(view) => view.read(cx).owner.clone(), Self::Toggle(view) => view.read(cx).owner.clone(), Self::Named(view) => view.read(cx).owner.clone() }
    }
    fn events(&self, cx: &App) -> Vec<(String, Json)> {
        match self { Self::Button(view) => view.read(cx).handle().take_events(), Self::Toggle(view) => view.read(cx).handle().take_events(), Self::Named(view) => view.read(cx).handle().take_events() }
    }
    fn state(&self, key: &str, cx: &App) -> Json {
        match self { Self::Button(view) => view.read(cx).handle().state(key).unwrap(), Self::Toggle(view) => view.read(cx).handle().state(key).unwrap(), Self::Named(view) => view.read(cx).handle().state(key).unwrap() }
    }
    fn set_props(&self, props: Json, window: &mut Window, cx: &mut App) {
        match self { Self::Button(view) => view.update(cx, |view, cx| view.set_props(props, window, cx).unwrap()), Self::Toggle(view) => view.update(cx, |view, cx| view.set_props(props, window, cx).unwrap()), Self::Named(view) => view.update(cx, |view, cx| view.set_props(props, window, cx).unwrap()) }
    }
    fn set_associations(&self, associations: InstanceAssociations, window: &mut Window, cx: &mut App) {
        match self { Self::Button(view) => view.update(cx, |view, cx| view.set_instance_associations(associations, window, cx).unwrap()), Self::Toggle(view) => view.update(cx, |view, cx| view.set_instance_associations(associations, window, cx).unwrap()), Self::Named(view) => view.update(cx, |view, cx| view.set_instance_associations(associations, window, cx).unwrap()) }
    }
    fn focused(&self, window: &Window, cx: &App) -> bool {
        match self { Self::Button(view) => view.read(cx).focus_handle(cx).is_focused(window), Self::Toggle(view) => view.read(cx).focus_handle(cx).is_focused(window), Self::Named(view) => view.read(cx).focus_handle(cx).is_focused(window) }
    }
    fn dispose(&self, window: &mut Window, cx: &mut App) {
        match self { Self::Button(view) => view.read(cx).handle().dispose(window, cx).unwrap(), Self::Toggle(view) => view.read(cx).handle().dispose(window, cx).unwrap(), Self::Named(view) => view.read(cx).handle().dispose(window, cx).unwrap() }
    }
}
fn associations(reference: &ControlLabelRef) -> InstanceAssociations { InstanceAssociations { control_label: Some(reference.clone()) } }
fn text(value: &str) -> Vec<NativeSnapshot> { vec![NativeSnapshot::text_value(Value::string(value))] }
fn label(reference: &ControlLabelRef, props: Json, window: &mut Window, cx: &mut App) -> Entity<base_label::CompiledComponent> {
    let label = base_label::CompiledComponent::create_with_associations(props, None, associations(reference), window, cx).unwrap();
    label.update(cx, |label, cx| label.set_slot(text("Actual visible Label"), cx).unwrap());
    label
}
struct Harness {
    label: Entity<base_label::CompiledComponent>,
    target: Target,
    reference: ControlLabelRef,
    show_label: bool,
    show_target: bool,
    extra_labels: Vec<Entity<base_label::CompiledComponent>>,
    extra_targets: Vec<Target>,
}
impl Render for Harness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let mut root = gpui::div().size_full().flex().flex_col().items_start().gap_4().p_4();
        if self.show_label { root = root.child(self.label.clone()); }
        if self.show_target { root = root.child(self.target.view()); }
        for label in &self.extra_labels { root = root.child(label.clone()); }
        for target in &self.extra_targets { root = root.child(target.view()); }
        root
    }
}
fn open(cx: &mut TestAppContext, kind: &str, props: Json, label_props: Json) -> WindowHandle<Harness> {
    let window = cx.open_window(size(px(640.), px(480.)), |window, cx| {
        let reference = ControlLabelRef::new();
        let target = Target::create(kind, props, &reference, window, cx);
        let label = label(&reference, label_props, window, cx);
        Harness { label, target, reference, show_label: true, show_target: true, extra_labels: vec![], extra_targets: vec![] }
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
// Production semantic projection into a real AccessKit Node, using the current
// layout's exact semantic identity. Stored maps alone are not the assertion.
fn projected_node(owner: &OwnerRef) -> gpui::accesskit::Node {
    let semantics = Semantics { element: gpui::div(), owner: Rc::downgrade(owner), role: None };
    let mut node = gpui::accesskit::Node::new(semantics.a11y_role().expect("native role"));
    semantics.write_a11y_info(&mut node);
    node
}
fn label_owner(host: &Harness, cx: &App) -> OwnerRef { host.label.read(cx).owner.clone() }
fn action(host: &Harness, cx: &App) -> ControlLabelActionLease { control_label_action_lease(&label_owner(host, cx)).expect("enabled native Label action") }
fn location(owner: &OwnerRef) -> gpui::Point<gpui::Pixels> {
    let bounds = owner.borrow().bounds.expect("committed native bounds");
    assert!(bounds.size.width > px(4.) && bounds.size.height > px(4.));
    bounds.origin + point(px(2.), px(2.))
}
fn down(position: gpui::Point<gpui::Pixels>, button: MouseButton, modifiers: Modifiers, window: &mut Window, cx: &mut App) {
    window.dispatch_event(gpui::PlatformInput::MouseDown(gpui::MouseDownEvent { position, button, modifiers, ..Default::default() }), cx);
}
fn up(position: gpui::Point<gpui::Pixels>, button: MouseButton, modifiers: Modifiers, window: &mut Window, cx: &mut App) {
    window.dispatch_event(gpui::PlatformInput::MouseUp(gpui::MouseUpEvent { position, button, modifiers, ..Default::default() }), cx);
}
fn moved(position: gpui::Point<gpui::Pixels>, pressed_button: Option<MouseButton>, modifiers: Modifiers, window: &mut Window, cx: &mut App) {
    window.dispatch_event(gpui::PlatformInput::MouseMove(gpui::MouseMoveEvent { position, pressed_button, modifiers, ..Default::default() }), cx);
}
fn click(owner: &OwnerRef, window: &mut Window, cx: &mut App) {
    let position = location(owner);
    down(position, MouseButton::Left, Modifiers::default(), window, cx);
    up(position, MouseButton::Left, Modifiers::default(), window, cx);
}
fn assert_named(host: &Harness, cx: &App) {
    let label = label_owner(host, cx);
    let target = host.target.owner(cx);
    let label_node = projected_node(&label);
    let target_node = projected_node(&target);
    assert_eq!(label_node.role(), gpui::Role::Label);
    assert_eq!(label_node.label(), Some("Actual visible Label"));
    assert_eq!(target_node.labelled_by(), &[label.borrow().modules.a11y_node.expect("current Label semantic node")]);
    assert_eq!(target_node.label(), None, "the derived name is a reference, not a copied label");
}

#[gpui::test]
fn actual_button_pointer_activation_and_native_name_share_one_operation(cx: &mut TestAppContext) {
    let window = open(cx, "button", json!({}), json!({}));
    window.update(cx, |host, window, cx| {
        assert_named(host, cx);
        let owner = label_owner(host, cx);
        assert!(!native_tab_participation(&owner));
        assert!(!native_key_input_needed(&owner));
        assert!(projected_node(&owner).supports_action(gpui::accesskit::Action::Click));
        click(&owner, window, cx);
        assert_eq!(host.target.events(cx), vec![("click".into(), Json::Null)]);
        assert!(host.target.focused(window, cx));
        click(&host.target.owner(cx), window, cx);
        assert_eq!(host.target.events(cx), vec![("click".into(), Json::Null)], "ordinary direct target input still uses its own operation");
    }).unwrap();
}

#[gpui::test]
fn actual_toggle_retains_controlled_and_uncontrolled_state(cx: &mut TestAppContext) {
    for controlled in [false, true] {
        let props = if controlled { json!({"active": false}) } else { json!({"defaultActive": false}) };
        let window = open(cx, "toggle", props, json!({}));
        window.update(cx, |host, window, cx| {
            assert_named(host, cx);
            action(host, cx).request(window, cx);
            assert_eq!(host.target.events(cx), vec![("activeChange".into(), json!({"active": true}))]);
            assert_eq!(host.target.state("active", cx), json!(!controlled));
            assert_eq!(host.target.state("pressed", cx), json!(false));
            action(host, cx).request(window, cx);
            assert_eq!(host.target.events(cx), vec![("activeChange".into(), json!({"active": controlled}))]);
            assert_eq!(host.target.state("active", cx), json!(false));
        }).unwrap();
    }
}

#[gpui::test]
fn disabled_target_keeps_derived_naming_without_activation_or_focus(cx: &mut TestAppContext) {
    for kind in ["button", "toggle"] {
        let window = open(cx, kind, json!({"disabled": true}), json!({}));
        window.update(cx, |host, window, cx| {
            assert_named(host, cx);
            assert!(projected_node(&host.target.owner(cx)).is_disabled());
            click(&label_owner(host, cx), window, cx);
            action(host, cx).request(window, cx);
            assert!(host.target.events(cx).is_empty());
            assert!(!host.target.focused(window, cx));
            host.target.set_props(json!({"disabled": false}), window, cx);
            action(host, cx).request(window, cx);
            assert_eq!(host.target.events(cx).len(), 1);
        }).unwrap();
    }
}

#[gpui::test]
fn naming_and_activation_update_independently_and_retire_old_action_leases(cx: &mut TestAppContext) {
    let window = open(cx, "button", json!({}), json!({}));
    window.update(cx, |host, window, cx| {
        let old_action = action(host, cx);
        host.label.update(cx, |label, cx| label.set_props(json!({"activation": false}), window, cx).unwrap());
        assert_named(host, cx);
        assert!(!projected_node(&label_owner(host, cx)).supports_action(gpui::accesskit::Action::Click));
        assert!(control_label_action_lease(&label_owner(host, cx)).is_none());
        old_action.request(window, cx);
        click(&label_owner(host, cx), window, cx);
        assert!(host.target.events(cx).is_empty());
        host.label.update(cx, |label, cx| label.set_props(json!({"naming": false}), window, cx).unwrap());
        let target = projected_node(&host.target.owner(cx));
        assert!(target.labelled_by().is_empty());
        assert_eq!(target.label(), Some("Original button content"));
        old_action.request(window, cx);
        assert!(host.target.events(cx).is_empty(), "re-enabling cannot resurrect an old action generation");
        action(host, cx).request(window, cx);
        assert_eq!(host.target.events(cx).len(), 1);
        host.label.update(cx, |label, cx| label.set_props(json!({}), window, cx).unwrap());
        assert_named(host, cx);
    }).unwrap();
}

#[gpui::test]
fn explicit_author_name_survives_pairing_activation_and_detach(cx: &mut TestAppContext) {
    let window = open(cx, "named", json!({}), json!({}));
    window.update(cx, |host, window, cx| {
        let owner = host.target.owner(cx);
        let node = projected_node(&owner);
        assert_eq!(node.label(), Some("Consumer-owned button name"));
        assert!(node.labelled_by().is_empty());
        assert!(take_control_label_diagnostics(&owner).iter().any(|message| message.contains("author name")));
        action(host, cx).request(window, cx);
        assert_eq!(host.target.events(cx).len(), 1, "a naming conflict cannot silently remove separately requested activation");
        let Target::Named(view) = &host.target else { panic!("named consumer") };
        view.read(cx).handle().call("setConsumerName", vec![json!("")], window, cx).unwrap();
        assert_named(host, cx);
        view.read(cx).handle().call("setConsumerName", vec![json!("Consumer-owned button name")], window, cx).unwrap();
        host.target.set_associations(InstanceAssociations::default(), window, cx);
        assert_eq!(projected_node(&owner).label(), Some("Consumer-owned button name"));
        detach_native_view(&label_owner(host, cx));
        assert_eq!(projected_node(&owner).label(), Some("Consumer-owned button name"));
    }).unwrap();
}

#[gpui::test]
fn nominal_replacement_and_missing_reference_never_discover_a_nearby_target(cx: &mut TestAppContext) {
    let window = open(cx, "button", json!({}), json!({}));
    window.update(cx, |host, window, cx| {
        let old_action = action(host, cx);
        let other = ControlLabelRef::new();
        host.label.update(cx, |label, cx| label.set_instance_associations(associations(&other), window, cx).unwrap());
        old_action.request(window, cx);
        action(host, cx).request(window, cx);
        assert!(host.target.events(cx).is_empty());
        assert!(projected_node(&host.target.owner(cx)).labelled_by().is_empty());
        host.target.set_associations(associations(&other), window, cx);
        assert_named(host, cx);
        action(host, cx).request(window, cx);
        assert_eq!(host.target.events(cx).len(), 1);
        host.target.set_associations(InstanceAssociations::default(), window, cx);
        action(host, cx).request(window, cx);
        assert!(host.target.events(cx).is_empty());
    }).unwrap();
}

#[gpui::test]
fn duplicate_labels_and_targets_choose_no_registration_order_winner(cx: &mut TestAppContext) {
    for first in ["button", "toggle"] {
        let window = open(cx, first, json!({}), json!({}));
        window.update(cx, |host, window, cx| {
            let second = if first == "button" { "toggle" } else { "button" };
            host.extra_targets.push(Target::create(second, json!({}), &host.reference, window, cx));
            cx.notify();
        }).unwrap();
        frames(window, cx);
        window.update(cx, |host, window, cx| {
            action(host, cx).request(window, cx);
            assert!(host.target.events(cx).is_empty());
            assert!(host.extra_targets[0].events(cx).is_empty());
            assert!(projected_node(&host.target.owner(cx)).labelled_by().is_empty());
            host.extra_targets.clear();
            host.extra_labels.push(label(&host.reference, json!({}), window, cx));
            cx.notify();
        }).unwrap();
        frames(window, cx);
        window.update(cx, |host, window, cx| {
            for label in [&host.label, &host.extra_labels[0]] {
                control_label_action_lease(&label.read(cx).owner).unwrap().request(window, cx);
            }
            assert!(host.target.events(cx).is_empty());
            assert!(projected_node(&host.target.owner(cx)).labelled_by().is_empty());
            host.extra_labels.clear();
            cx.notify();
        }).unwrap();
        frames(window, cx);
        window.update(cx, |host, window, cx| {
            assert_named(host, cx);
            action(host, cx).request(window, cx);
            assert_eq!(host.target.events(cx).len(), 1);
        }).unwrap();
    }
}

#[gpui::test]
fn a_shared_reference_cannot_pair_across_window_trees(cx: &mut TestAppContext) {
    let first = open(cx, "button", json!({}), json!({}));
    let reference = first.update(cx, |host, _, _| host.reference.clone()).unwrap();
    let second = open(cx, "button", json!({}), json!({}));
    first.update(cx, |host, _, cx| { host.show_target = false; cx.notify(); }).unwrap();
    second.update(cx, |host, window, cx| {
        host.show_label = false;
        host.target.set_associations(associations(&reference), window, cx);
        cx.notify();
    }).unwrap();
    frames(first, cx);
    frames(second, cx);
    first.update(cx, |host, window, cx| { action(host, cx).request(window, cx); assert!(host.target.events(cx).is_empty()); }).unwrap();
    second.update(cx, |host, _, cx| {
        assert!(projected_node(&host.target.owner(cx)).labelled_by().is_empty());
        assert!(host.target.events(cx).is_empty());
    }).unwrap();
}

#[gpui::test]
fn detach_remount_and_terminal_disposal_revoke_exact_leases(cx: &mut TestAppContext) {
    let window = open(cx, "button", json!({}), json!({}));
    let old_action = window.update(cx, |host, _, cx| { let action = action(host, cx); host.show_label = false; cx.notify(); action }).unwrap();
    frames(window, cx);
    window.update(cx, |host, window, cx| {
        assert!(!label_owner(host, cx).borrow().mounted);
        old_action.request(window, cx);
        assert!(host.target.events(cx).is_empty());
        assert!(projected_node(&host.target.owner(cx)).labelled_by().is_empty());
        host.show_label = true;
        cx.notify();
    }).unwrap();
    frames(window, cx);
    window.update(cx, |host, window, cx| {
        assert_named(host, cx);
        old_action.request(window, cx);
        assert!(host.target.events(cx).is_empty());
        let new_action = action(host, cx);
        new_action.request(window, cx);
        assert_eq!(host.target.events(cx).len(), 1);
        host.target.dispose(window, cx);
        new_action.request(window, cx);
        assert!(host.target.events(cx).is_empty());
        host.label.read(cx).handle().dispose(window, cx).unwrap();
        new_action.request(window, cx);
        let counts = native_resource_counts(&label_owner(host, cx));
        assert_eq!(counts["pointerInput"], json!(false));
        assert!(control_label_action_lease(&label_owner(host, cx)).is_none());
    }).unwrap();
}

#[gpui::test]
fn pointer_final_sample_and_cancelled_turns_never_reuse_a_prior_click(cx: &mut TestAppContext) {
    let window = open(cx, "button", json!({}), json!({}));
    window.update(cx, |host, window, cx| {
        let owner = label_owner(host, cx);
        let start = location(&owner);
        for mode in 0..6 {
            let modifiers = if mode == 0 { Modifiers { shift: true, ..Default::default() } } else { Modifiers::default() };
            let button = if mode == 1 { MouseButton::Right } else { MouseButton::Left };
            down(start, button, modifiers, window, cx);
            match mode {
                2 => { moved(start + point(px(20.), px(0.)), Some(MouseButton::Left), Modifiers::default(), window, cx); moved(start, Some(MouseButton::Left), Modifiers::default(), window, cx); },
                3 => moved(start, None, Modifiers::default(), window, cx),
                4 => { window.dispatch_event(gpui::PlatformInput::MouseExited(gpui::MouseExitEvent::default()), cx); },
                _ => {},
            }
            // Mode 5 differs only at the final release sample, with no move.
            let final_position = if mode == 5 { start + point(px(20.), px(0.)) } else { start };
            up(final_position, button, modifiers, window, cx);
            assert!(host.target.events(cx).is_empty(), "ineligible pointer mode {mode}");
            // A click-only release must not resurrect a consumed/cancelled turn.
            up(start, MouseButton::Left, Modifiers::default(), window, cx);
            assert!(host.target.events(cx).is_empty());
        }
        click(&owner, window, cx);
        assert_eq!(host.target.events(cx).len(), 1);
    }).unwrap();
}

struct NativeChild { clicks: Rc<Cell<usize>>, bounds: Rc<Cell<Option<gpui::Bounds<gpui::Pixels>>>> }
impl Render for NativeChild {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let clicks = self.clicks.clone();
        let bounds = self.bounds.clone();
        gpui::div().id("opaque-native-child").relative().w(px(180.)).h(px(40.)).child("Native child button")
            // Pin the measuring canvas to this root. An auto-inset absolute
            // child keeps its after-text static position and measures outside
            // the clickable surface even though its size matches the root.
            .child(gpui::canvas(move |area, _, _| bounds.set(Some(area)), |_, _, _, _| {}).absolute().top_0().left_0().size_full())
            .on_click(move |_, _, _| clicks.set(clicks.get() + 1))
    }
}
#[gpui::test]
fn opaque_native_child_keeps_its_input_and_cannot_activate_the_enclosing_label(cx: &mut TestAppContext) {
    let window = open(cx, "button", json!({}), json!({}));
    let child_clicks = Rc::new(Cell::new(0));
    let child_bounds = Rc::new(Cell::new(None));
    window.update(cx, |host, _, cx| {
        let clicks = child_clicks.clone();
        let bounds = child_bounds.clone();
        let child = cx.new(|_| NativeChild { clicks, bounds });
        host.label.update(cx, |label, cx| label.set_slot(vec![NativeSnapshot::text_value(Value::string("Actual visible Label")), NativeSnapshot::native_view(child.into())], cx).unwrap());
    }).unwrap();
    frames(window, cx);
    window.update(cx, |host, window, cx| {
        let child_area = child_bounds.get().expect("measured actual native child");
        let child_position = child_area.origin + point(px(2.), px(2.));
        assert!(label_owner(host, cx).borrow().bounds.expect("current containing Label").contains(&child_position), "the native-child sample must be inside the current Label surface");
        down(child_position, MouseButton::Left, Modifiers::default(), window, cx);
        up(child_position, MouseButton::Left, Modifiers::default(), window, cx);
        assert_eq!(child_clicks.get(), 1, "the transparent boundary cannot stop child input");
        assert!(host.target.events(cx).is_empty());
        assert!(take_control_label_diagnostics(&label_owner(host, cx)).iter().any(|message| message.contains("opaque native_view")));
        let ordinary_text = location(&label_owner(host, cx));
        assert!(!child_area.contains(&ordinary_text), "the normal text control must be outside the opaque child");
        down(ordinary_text, MouseButton::Left, Modifiers::default(), window, cx);
        up(ordinary_text, MouseButton::Left, Modifiers::default(), window, cx);
        assert_eq!(host.target.events(cx).len(), 1, "ordinary text in the same Label retains its action");
        assert_eq!(child_clicks.get(), 1);
        // Naming/AX request remain separate from the unsupported pointer origin.
        action(host, cx).request(window, cx);
        assert_eq!(host.target.events(cx).len(), 1);
    }).unwrap();
}

#[gpui::test]
fn reentrant_state_observer_invalidates_subsequent_authored_request_work(cx: &mut TestAppContext) {
    let window = open(cx, "toggle", json!({}), json!({}));
    window.update(cx, |host, window, cx| {
        let target = host.target.owner(cx);
        let label = Rc::downgrade(&label_owner(host, cx));
        let active = target.borrow().exposes.get("active").unwrap().clone();
        // A public SDK observer enters through the ordinary State callback path.
        // It does not patch the compiled Toggle or call its outward event as input.
        let observer = Owner::new(json!({}), Default::default(), |_, _| true, |_| true, |_, _| true, target.borrow().style_vocabulary);
        watch_state(&Rc::downgrade(&observer), active, Value::Function(Rc::new(move |_| {
            if let Some(label) = label.upgrade() { replace_instance_associations(&label, InstanceAssociations::default()); }
            Value::Undefined
        })));
        Owner::finish(&observer, Value::Undefined);
        action(host, cx).request(window, cx);
        assert_eq!(host.target.state("active", cx), json!(true), "the write before reentry remains committed");
        assert!(host.target.events(cx).is_empty(), "the next authored isCurrent guard suppresses obsolete outward work");
        Owner::dispose(&observer);
        host.label.update(cx, |label, cx| label.set_instance_associations(associations(&host.reference), window, cx).unwrap());
        action(host, cx).request(window, cx);
        assert_eq!(host.target.events(cx), vec![("activeChange".into(), json!({"active": false}))]);
    }).unwrap();
}

#[gpui::test]
fn typed_association_rejects_undeclared_recipients_without_poisoning_construction(cx: &mut TestAppContext) {
    let window = open(cx, "button", json!({}), json!({}));
    window.update(cx, |host, window, cx| {
        assert!(plain::CompiledComponent::create_with_associations(json!({}), None, associations(&host.reference), window, cx).is_err());
        let ordinary = plain::CompiledComponent::create(json!({}), None, window, cx).unwrap();
        assert!(ordinary.update(cx, |view, cx| view.set_instance_associations(associations(&host.reference), window, cx)).is_err());
        assert!(!ordinary.read(cx).owner.borrow().disposed);
        action(host, cx).request(window, cx);
        assert_eq!(host.target.events(cx).len(), 1);
    }).unwrap();
}

struct GenericHarness {
    passive: Entity<generic_label::CompiledComponent>,
    enabled: Entity<generic_setup_label::CompiledComponent>,
    passive_target: Entity<generic_label_target::CompiledComponent>,
    enabled_target: Entity<generic_label_target::CompiledComponent>,
}
impl Render for GenericHarness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full().flex().flex_col().items_start().gap_4().p_4()
            .child(self.passive.clone()).child(self.passive_target.clone())
            .child(self.enabled.clone()).child(self.enabled_target.clone())
    }
}
#[gpui::test]
fn generic_defaults_setup_sync_and_target_sync_keep_their_own_facade_semantics(cx: &mut TestAppContext) {
    let window = cx.open_window(size(px(640.), px(480.)), |window, cx| {
        let passive_ref = ControlLabelRef::new();
        let enabled_ref = ControlLabelRef::new();
        let passive = generic_label::CompiledComponent::create_with_associations(json!({}), None, associations(&passive_ref), window, cx).unwrap();
        // SetupLabel performs label.sync in setup. Target performs target.sync
        // in setup and onCreated. These are shared-facade operations, not errors.
        let enabled = generic_setup_label::CompiledComponent::create_with_associations(json!({}), None, associations(&enabled_ref), window, cx).unwrap();
        let passive_target = generic_label_target::CompiledComponent::create_with_associations(json!({}), None, associations(&passive_ref), window, cx).unwrap();
        let enabled_target = generic_label_target::CompiledComponent::create_with_associations(json!({}), None, associations(&enabled_ref), window, cx).unwrap();
        passive.update(cx, |view, cx| view.set_slot(text("Passive generic Label"), cx).unwrap());
        enabled.update(cx, |view, cx| view.set_slot(text("Enabled generic Label"), cx).unwrap());
        passive_target.update(cx, |view, cx| view.set_slot(text("First generic target"), cx).unwrap());
        enabled_target.update(cx, |view, cx| view.set_slot(text("Second generic target"), cx).unwrap());
        GenericHarness { passive, enabled, passive_target, enabled_target }
    });
    window.update(cx, |_, window, _| window.activate_window()).unwrap();
    frames(window, cx);
    window.update(cx, |host, window, cx| {
        let passive = host.passive.read(cx).owner.clone();
        let enabled = host.enabled.read(cx).owner.clone();
        let passive_target = host.passive_target.read(cx).owner.clone();
        let enabled_target = host.enabled_target.read(cx).owner.clone();
        assert!(control_label_action_lease(&passive).is_none(), "generic participation defaults to naming only");
        assert!(!projected_node(&passive).supports_action(gpui::accesskit::Action::Click));
        assert_eq!(projected_node(&passive_target).labelled_by(), &[passive.borrow().modules.a11y_node.unwrap()]);
        for target in [&passive_target, &enabled_target] {
            assert!(control_label_action_lease(target).is_none(), "target sync cannot acquire the Label's native action");
            assert!(!projected_node(target).supports_action(gpui::accesskit::Action::Click));
        }
        click(&passive, window, cx);
        assert!(host.passive_target.read(cx).handle().take_events().is_empty());
        // Updating target-only options between the real down/up samples must
        // not retire the already-owned Label turn or its exact target lease.
        let position = location(&enabled);
        down(position, MouseButton::Left, Modifiers::default(), window, cx);
        host.enabled_target.read(cx).handle().call("syncTarget", vec![], window, cx).unwrap();
        up(position, MouseButton::Left, Modifiers::default(), window, cx);
        assert_eq!(host.enabled_target.read(cx).handle().take_events(), vec![("requested".into(), json!({"before": true, "after": true, "same": true}))],
            "a target's own sync update does not invalidate the Label-owned pair or request identity");
        host.passive.read(cx).handle().call("enable", vec![], window, cx).unwrap();
        control_label_action_lease(&passive).unwrap().request(window, cx);
        assert_eq!(host.passive_target.read(cx).handle().take_events(), vec![("requested".into(), json!({"before": true, "after": true, "same": true}))]);
    }).unwrap();
}
