//! T-COMPILER-AUTHORING-0001-CASE-CONTROLLED and CASE-INIT-MODE.
//! The generated button receives GPUI mouse input. Its published projection,
//! typed request and painted label are observed independently.

use super::support::ObservedText;
use generated_gpui_consumer::controlled_toggle::{
    ControlledToggle, ControlledToggleProps, ControlledToggleSignal,
};
use gpui::{
    div, prelude::*, px, rgb, size, AlignItems, Bounds, Display, Entity, FlexDirection, Hsla,
    Modifiers, Pixels, Point, StyleRefinement, Subscription, TestAppContext, TestDispatcher,
    UnderlineStyle, VisualTestContext, Window,
};
use proto_ui_gpui_support::{with_owner, ActionOutcome};
use std::{cell::{Cell, RefCell}, rc::Rc, sync::Arc};

const WIDTH: f32 = 144.;
const HEIGHT: f32 = 48.;
const BUTTON: u32 = 0x38546e;
const INK: u32 = 0xf7d98b;

fn underline() -> UnderlineStyle {
    UnderlineStyle { thickness: px(1.), color: Some(rgb(INK).into()), wavy: false }
}

// The theme gives either state exactly the same geometry and ink. Only the
// generated text determines the length of the underline in the painted scene.
fn bind_token(token: &str, style: &mut StyleRefinement) {
    if token == "authoring-toggle" {
        style.display = Some(Display::Flex);
        style.flex_direction = Some(FlexDirection::Row);
        style.align_items = Some(AlignItems::Center);
        style.size.width = Some(px(WIDTH).into());
        style.size.height = Some(px(HEIGHT).into());
        style.background = Some(rgb(BUTTON).into());
        style.text.font_size = Some(px(20.).into());
        style.text.color = Some(rgb(INK).into());
        style.text.underline = Some(underline());
    }
}

fn props(active: Option<bool>, default_active: bool, disabled: bool) -> ControlledToggleProps {
    ControlledToggleProps { active, defaultActive: default_active, disabled }
}

struct Host {
    toggle: Entity<ControlledToggle>,
    attached: bool,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
}

impl Render for Host {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let bounds = self.bounds.clone();
        let root = div().size_full().flex().flex_col().items_start()
            .on_children_prepainted(move |children, _, _| {
                bounds.set(match children.as_slice() {
                    [button] => Some(*button),
                    [] => None,
                    _ => panic!("expected at most one mounted Toggle"),
                });
            });
        if self.attached { root.child(self.toggle.clone()) } else { root }
    }
}

struct Mounted {
    host: Entity<Host>,
    toggle: Entity<ControlledToggle>,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    text: Arc<ObservedText>,
    ui: VisualTestContext,
}

// Retain the native event value itself so later transitions also check the
// earlier record payload. Capture the actual projection at delivery time.
type Requests = Rc<RefCell<Vec<(ControlledToggleSignal, bool)>>>;

impl Mounted {
    fn assert_view(&mut self, active: bool, disabled: bool) {
        self.toggle.read_with(&self.ui, |view, _| {
            let projection = view.projection();
            assert_eq!((projection.active(), projection.disabled()), (active, disabled));
        });
        let label = if active { "On" } else { "Off" };
        let bounds = self.bounds.get().expect("the native button was laid out");
        assert_eq!(bounds.size, size(px(WIDTH), px(HEIGHT)));
        self.ui.update(|window, _| {
            let quads = window.painted_quads();
            let mut buttons = quads.iter().filter(|q| q.background.as_solid() == Some(Hsla::from(rgb(BUTTON))));
            let button = buttons.next().expect("the generated button painted its background");
            assert!(buttons.next().is_none(), "a stale button also painted");
            assert_eq!(button.bounds.size, bounds.size.scale(window.scale_factor()));
            assert!(button.bounds.contains(&bounds.center().scale(window.scale_factor())));
            assert_eq!(button.bounds.intersect(&button.content_mask.bounds), button.bounds);

            let lines = window.painted_underlines();
            let mut labels = lines.iter().filter(|line| line.color == Hsla::from(rgb(INK)));
            let painted = labels.next().expect("the generated button painted its text");
            assert!(labels.next().is_none(), "the button painted more than one label");
            assert_eq!(painted.bounds.intersect(&painted.content_mask.bounds), painted.bounds);
            assert_eq!(painted.bounds.intersect(&button.bounds), painted.bounds);
            // Keep shaping history because GPUI legitimately caches an earlier
            // On or Off run. The current frame must paint that specific run.
            self.text.expect_label_at_width(label, |advance| {
                window.underline_bounds(Point::default(), advance, &underline()).size == painted.bounds.size
            });
        });
    }

    fn accept(&mut self, candidate: ControlledToggleProps) {
        let result = self.toggle.update(&mut self.ui, |view, cx| view.set_props(candidate, cx));
        let outcome = result.unwrap_or_else(|error| panic!("valid update rejected for {}", error.field));
        assert_eq!(outcome, ActionOutcome::Committed);
        self.ui.run_until_parked();
    }

    fn reject(&mut self, candidate: ControlledToggleProps, was_present: bool) {
        let result = self.toggle.update(&mut self.ui, |view, cx| view.set_props(candidate, cx));
        let error = result.expect_err("the fixed-mode instance accepted a change in presence");
        assert_eq!(error.field, "active");
        assert_eq!(error.was_present, was_present);
        assert_eq!(error.requested_present, !was_present);
        self.ui.run_until_parked();
    }

    fn click_at(&mut self, position: Point<Pixels>) {
        self.ui.simulate_mouse_move(position, None, Modifiers::default());
        self.ui.simulate_click(position, Modifiers::default());
        self.ui.run_until_parked();
    }

    fn click(&mut self) {
        self.click_at(self.bounds.get().expect("the button was mounted").center());
    }

    fn watch_requests(&self) -> (Requests, Subscription) {
        let requests = Requests::default();
        let observed = requests.clone();
        let subscription = self.ui.cx.update(|app| {
            app.subscribe(&self.toggle, move |source, signal: &ControlledToggleSignal, app| {
                observed.borrow_mut().push((signal.clone(), source.read(app).projection().active()));
            })
        });
        (requests, subscription)
    }

    fn attach(&mut self, attached: bool) {
        self.host.update(&mut self.ui, |host, cx| { host.attached = attached; cx.notify(); });
        self.ui.run_until_parked();
    }

    fn replace_owner(&mut self, candidate: ControlledToggleProps) {
        let next = self.ui.cx.new(|_| ControlledToggle::new(candidate, bind_token));
        assert_ne!(next.entity_id(), self.toggle.entity_id());
        self.host.update(&mut self.ui, |host, cx| { host.toggle = next.clone(); cx.notify(); });
        self.toggle = next;
        self.ui.run_until_parked();
    }
}

fn with_toggle(initial: ControlledToggleProps, test: impl FnOnce(&mut Mounted)) {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let bounds = Rc::new(Cell::new(None));
    let window = cx.add_window(|_, cx| Host {
        toggle: cx.new(|_| ControlledToggle::new(initial, bind_token)),
        attached: true,
        bounds: bounds.clone(),
    });
    let host = window.root(&mut cx).expect("mounted Toggle host");
    let toggle = host.read_with(&cx, |host, _| host.toggle.clone());
    let ui = VisualTestContext::from_window(window.into(), &cx);
    ui.run_until_parked();
    let mut mounted = Mounted { host, toggle, bounds, text, ui };
    test(&mut mounted);
    drop(mounted);
    cx.quit();
}

fn assert_requests(requests: &Requests, expected: &[(bool, bool)]) {
    let requests = requests.borrow();
    assert_eq!(requests.len(), expected.len(), "unexpected signal count");
    for ((signal, actual), &pair) in requests.iter().zip(expected) {
        let ControlledToggleSignal::activeChange(payload) = signal;
        assert_eq!((payload.active, *actual), pair, "(requested active, actual active during signal)");
    }
}

#[test]
fn repeated_controlled_pointer_requests_wait_for_the_owner_to_publish() {
    with_toggle(props(Some(false), true, false), |mounted| {
        let (requests, _subscription) = mounted.watch_requests();
        mounted.assert_view(false, false);
        for count in 1..=2 {
            mounted.click();
            mounted.assert_view(false, false);
            assert_requests(&requests, &[(true, false), (true, false)][..count]);
        }
        // The owner declines both requests. Reaffirming false emits no request.
        mounted.accept(props(Some(false), true, false));
        mounted.assert_view(false, false);
        // The rejected candidate also changed disabled. Neither change publishes.
        mounted.reject(props(None, false, true), true);
        mounted.assert_view(false, false);
        assert_requests(&requests, &[(true, false), (true, false)]);

        mounted.accept(props(Some(true), false, false));
        mounted.assert_view(true, false);
        assert_requests(&requests, &[(true, false), (true, false)]);
        mounted.click();
        mounted.assert_view(true, false);
        let expected = [(true, false), (true, false), (false, true)];
        assert_requests(&requests, &expected);
        mounted.accept(props(Some(true), false, true));
        mounted.assert_view(true, true);
        mounted.click();
        mounted.assert_view(true, true);
        assert_requests(&requests, &expected);
        mounted.accept(props(Some(false), false, false));
        mounted.assert_view(false, false);
        assert_requests(&requests, &expected);
    });
}

#[test]
fn uncontrolled_pointer_commit_survives_default_changes_and_reattachment() {
    with_toggle(props(None, true, false), |mounted| {
        let (old_requests, _old_subscription) = mounted.watch_requests();
        mounted.assert_view(true, false);
        mounted.click();
        mounted.assert_view(false, false);
        assert_requests(&old_requests, &[(false, false)]);
        mounted.accept(props(None, false, false));
        mounted.accept(props(None, true, false));
        mounted.assert_view(false, false);
        mounted.reject(props(Some(true), false, true), false);
        mounted.assert_view(false, false);
        mounted.accept(props(None, true, true));
        mounted.assert_view(false, true);
        mounted.click();
        mounted.assert_view(false, true);
        assert_requests(&old_requests, &[(false, false)]);
        mounted.accept(props(None, true, false));

        let original_id = mounted.toggle.entity_id();
        let point = mounted.bounds.get().unwrap().center();
        mounted.attach(false);
        mounted.ui.update(|window, _| {
            assert!(window.painted_quads().iter().all(|q| q.background.as_solid() != Some(Hsla::from(rgb(BUTTON)))));
            assert!(window.painted_underlines().iter().all(|line| line.color != Hsla::from(rgb(INK))));
        });
        mounted.click_at(point);
        assert_requests(&old_requests, &[(false, false)]);
        mounted.attach(true);
        assert_eq!(mounted.toggle.entity_id(), original_id);
        mounted.assert_view(false, false);

        // Replace the entity in the same host slot. Only this new owner chooses
        // a different mode; a retained callback still addresses the old entity.
        let old = mounted.toggle.downgrade();
        let retained_activate = move |app: &mut gpui::App| {
            with_owner(&old, app, |view, cx| view.actions(cx).activate())
        };
        let released = Rc::new(Cell::new(None));
        let observed = released.clone();
        let _release = mounted.ui.cx.update(|app| app.observe_release(&mounted.toggle, move |view, _| {
            let projection = view.projection();
            observed.set(Some((projection.active(), projection.disabled())));
        }));
        mounted.replace_owner(props(Some(true), false, false));
        mounted.assert_view(true, false);
        let (new_requests, _new_subscription) = mounted.watch_requests();
        let stale = mounted.ui.cx.update(retained_activate);
        assert_eq!(stale, ActionOutcome::Disposed);
        mounted.ui.run_until_parked();
        assert_eq!(released.get(), Some((false, false)));
        assert_requests(&new_requests, &[]);
        mounted.click();
        mounted.assert_view(true, false);
        assert_requests(&new_requests, &[(false, true)]);
        assert_requests(&old_requests, &[(false, false)]);
    });
}

#[test]
fn publication_subscriber_can_queue_acceptance_without_changing_its_current_snapshot() {
    with_toggle(props(Some(false), false, false), |mounted| {
        let requests = Requests::default();
        let observed = requests.clone();
        let _subscription = mounted.ui.cx.update(|app| {
            app.subscribe(&mounted.toggle, move |source, event: &ControlledToggleSignal, app| {
                let ControlledToggleSignal::activeChange(payload) = event;
                let active = source.read(app).projection().active();
                observed.borrow_mut().push((event.clone(), active));
                if observed.borrow().len() == 1 {
                    let bad = source.update(app, |view, cx| view.set_props(props(None, true, true), cx));
                    let rejected = bad.expect_err("the subscriber queued an invalid input candidate");
                    assert_eq!((rejected.field, rejected.was_present, rejected.requested_present), ("active", true, false));
                    assert!(!source.read(app).projection().disabled());
                    let outcome = source.update(app, |view, cx| view.set_props(props(Some(payload.active), false, false), cx));
                    assert!(matches!(outcome, Ok(ActionOutcome::Queued)), "subscriber input must queue a new action");
                    assert_eq!(source.read(app).projection().active(), active);
                }
            })
        });
        mounted.assert_view(false, false);
        mounted.click();
        assert_requests(&requests, &[(true, false)]);
        mounted.assert_view(true, false);
    });
}
