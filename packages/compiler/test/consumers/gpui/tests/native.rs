//! External consumer of checked-IR output. GPUI TestAppContext supplies native
//! layout, scene construction and pointer dispatch on its headless test platform.

mod authoring_badge;
mod support;

use generated_gpui_consumer::{
    delivery_badge::{DeliveryBadge, DeliveryBadgeProps},
    selection_control::{
        SelectionControl, SelectionControlProjection, SelectionControlProps, SelectionControlSignal,
    },
};
use gpui::{
    div, prelude::*, px, rgb, size, Bounds, Entity, Hsla, Modifiers, Pixels, StyleRefinement,
    Subscription, TestAppContext, TestDispatcher, VisualTestContext, Window,
};
use proto_ui_gpui_support::{with_owner, ActionOutcome, SegmentFailure};
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
    sync::Arc,
};
use support::ObservedText;

fn props(controlled: bool) -> SelectionControlProps {
    SelectionControlProps {
        controlled,
        accepted: "A".into(),
        candidate: "B".into(),
        initial: "local seed".into(),
        disabled: false,
        prefix: "mounted/".into(),
    }
}

// CASE-PHASES, CASE-CAPTURES and CASE-REACTIVITY. Each expected label is new
// to its window so GPUI's line cache cannot satisfy a subsequent observation.
#[test]
fn mounted_text_uses_current_props_and_each_instances_original_capture() {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let badge_window = cx.add_window(|_, _| {
        DeliveryBadge::new(DeliveryBadgeProps {
            connected: false,
            caption: "pending".into(),
        })
        .with_appearance(|projection, style| {
            style_host_box(style, if projection.available() { FILL_C } else { FILL_A });
        })
    });
    let assert_badge_fill = |cx: &mut TestAppContext, fill| {
        badge_window.update(cx, |_, window, _| {
            let center = gpui::point(px(WIDTH / 2.), px(HEIGHT / 2.));
            assert_painted_fill(window, center, fill);
        }).unwrap();
    };
    let badge = badge_window.root(&mut cx).unwrap();
    assert!(!badge.read_with(&cx, |view, _| view.projection().available()));
    text.expect_layout("Offline");
    assert_badge_fill(&mut cx, FILL_A);

    badge.update(&mut cx, |view, cx| {
        view.set_props(DeliveryBadgeProps {
            connected: true,
            caption: "A\u{1f642}e\u{301}".into(),
        }, cx);
    });
    assert!(badge.read_with(&cx, |view, _| view.projection().available()));
    text.expect_layout("A\u{1f642}e\u{301} ✓");
    assert_badge_fill(&mut cx, FILL_C);
    badge.update(&mut cx, |view, cx| {
        view.set_props(DeliveryBadgeProps {
            connected: true,
            caption: "Rerouted".into(),
        }, cx);
    });
    text.expect_layout("Rerouted ✓");

    let first_window = cx.add_window(|_, _| SelectionControl::new(props(true)));
    let first = first_window.root(&mut cx).unwrap();
    text.expect_layout("mounted/A");
    let latest = || SelectionControlProps {
        accepted: "C".into(),
        prefix: "replacement/".into(),
        ..props(true)
    };
    first.update(&mut cx, |view, cx| view.set_props(latest(), cx));
    text.expect_layout("mounted/C");
    let second_window = cx.add_window(|_, _| SelectionControl::new(latest()));
    let second = second_window.root(&mut cx).unwrap();
    text.expect_layout("replacement/C");

    // Both native instances stay mounted. Constructing the second cannot
    // replace the first instance's capture, and the next input belongs to its recipient.
    first.update(&mut cx, |view, cx| view.set_props(SelectionControlProps {
        accepted: "D".into(), ..latest()
    }, cx));
    text.expect_layout("mounted/D");
    second.read_with(&cx, |view, _| assert_eq!(view.projection().selection(), "C"));
    second.update(&mut cx, |view, cx| view.set_props(SelectionControlProps {
        accepted: "E".into(), prefix: "later/".into(), ..latest()
    }, cx));
    text.expect_layout("replacement/E");
    first.read_with(&cx, |view, _| assert_eq!(view.projection().selection(), "D"));

    drop((badge, first, second));
    cx.quit();
}

const FILL_A: u32 = 0x28568b;
const FILL_B: u32 = 0xad641e;
const FILL_C: u32 = 0x277254;
const FILL_OTHER: u32 = 0x65517c;
const WIDTH: f32 = 176.;
const HEIGHT: f32 = 42.;

fn host_appearance(projection: &SelectionControlProjection, style: &mut StyleRefinement) {
    let fill = match projection.selection() {
        "A" => FILL_A,
        "B" => FILL_B,
        "C" => FILL_C,
        _ => FILL_OTHER,
    };
    style_host_box(style, fill);
}

fn style_host_box(style: &mut StyleRefinement, fill: u32) {
    style.background = Some(rgb(fill).into());
    style.size.width = Some(px(WIDTH).into());
    style.size.height = Some(px(HEIGHT).into());
}

fn assert_painted_fill(window: &Window, point: gpui::Point<Pixels>, fill: u32) {
    let sample = point.scale(window.scale_factor());
    let palette = [FILL_A, FILL_B, FILL_C, FILL_OTHER].map(|n| Hsla::from(rgb(n)));
    let expected = Hsla::from(rgb(fill));
    let mut found = false;
    for color in window.painted_quads().into_iter()
        .filter(|quad| quad.bounds.contains(&sample) && quad.content_mask.bounds.contains(&sample))
        .filter_map(|quad| quad.background.as_solid())
        .filter(|color| palette.contains(color))
    {
        assert_eq!(color, expected, "stale host fill at {sample:?}");
        found = true;
    }
    assert!(found, "missing host fill {expected:?} at {sample:?}");
}

struct Host {
    control: Entity<SelectionControl>,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
}

impl Render for Host {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let measured = self.bounds.clone();
        div()
            .size_full()
            .flex()
            .flex_col()
            .items_start()
            .on_children_prepainted(move |children, _, _| {
                let [control] = children.as_slice() else {
                    panic!("expected one native child");
                };
                measured.set(Some(*control));
            })
            .child(self.control.clone())
    }
}

struct Mounted {
    host: Entity<Host>,
    view: Entity<SelectionControl>,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    ui: VisualTestContext,
}

type Requests = Rc<RefCell<Vec<(String, String, f64)>>>;

fn mount(cx: &mut TestAppContext, props: SelectionControlProps) -> Mounted {
    let bounds = Rc::new(Cell::new(None));
    let window = cx.add_window(|_, cx| Host {
        control: cx.new(|_| SelectionControl::new(props).with_appearance(host_appearance)),
        bounds: bounds.clone(),
    });
    let host = window.root(cx).expect("mounted host");
    let view = host.read_with(cx, |host, _| host.control.clone());
    let ui = VisualTestContext::from_window(window.into(), cx);
    ui.run_until_parked();
    Mounted {
        host,
        view,
        bounds,
        ui,
    }
}

impl Mounted {
    fn assert_state(&self, selected: &str, attempts: f64) {
        self.view.read_with(&self.ui, |view, _| {
            let projection = view.projection();
            assert_eq!(projection.selection(), selected);
            assert_eq!(projection.attempts(), attempts);
        });
    }

    fn assert_paint(&mut self, fill: u32) {
        let bounds = self.bounds.get().expect("generated child was laid out");
        assert_eq!(bounds.size, size(px(WIDTH), px(HEIGHT)));
        self.ui.update(|window, _| assert_painted_fill(window, bounds.center(), fill));
    }

    fn click_at(&mut self, point: gpui::Point<Pixels>) {
        self.ui.simulate_mouse_move(point, None, Modifiers::default());
        self.ui.simulate_click(point, Modifiers::default());
        self.ui.run_until_parked();
    }

    fn click(&mut self) {
        let point = self.bounds.get().expect("generated child was laid out").center();
        self.click_at(point);
    }

    fn watch_requests(&self) -> (Requests, Subscription) {
        let requests = Requests::default();
        let log = requests.clone();
        let subscription = self.ui.cx.update(|app| {
            app.subscribe(&self.view, move |view, event: &SelectionControlSignal, app| {
                let SelectionControlSignal::requested(candidate) = event;
                let current = view.read(app).projection();
                log.borrow_mut().push((
                    candidate.clone(),
                    current.selection().to_owned(),
                    current.attempts(),
                ));
            })
        });
        (requests, subscription)
    }
}

fn assert_requests(requests: &Requests, expected: &[(&str, &str, f64)]) {
    let requests = requests.borrow();
    let observed: Vec<_> = requests.iter().map(|(candidate, selected, attempts)| {
        (candidate.as_str(), selected.as_str(), *attempts)
    }).collect();
    assert_eq!(observed.as_slice(), expected, "(request, published selection, published attempts)");
}

// CASE-CONTROLLED and CASE-HOST-API. Read the published selection in the
// subscription itself, then inspect the frame after GPUI delivers the input.
#[gpui::test]
fn native_click_requests_b_while_a_is_painted_then_the_owner_supplies_c(cx: &mut TestAppContext) {
    let mut control = mount(cx, props(true));
    let (requests, _subscription) = control.watch_requests();
    control.assert_state("A", 0.);
    control.assert_paint(FILL_A);

    let viewport = control.ui.update(|window, _| window.viewport_size());
    let background = gpui::point(viewport.width - px(1.), viewport.height - px(1.));
    assert!(!control.bounds.get().unwrap().contains(&background));
    control.click_at(background);
    control.assert_state("A", 0.);
    assert_requests(&requests, &[]);

    control.click();
    assert_requests(&requests, &[("B", "A", 1.)]);
    control.assert_state("A", 1.);
    control.assert_paint(FILL_A);

    control.view.update(&mut control.ui, |view, cx| view.set_props(SelectionControlProps {
        accepted: "C".into(), ..props(true)
    }, cx));
    control.assert_state("C", 1.);
    control.assert_paint(FILL_C);
    assert_requests(&requests, &[("B", "A", 1.)]);
}

// Single-instance CASE-COMMIT: discard writes both local selection and count,
// queues a request, then fails. None of these can escape into a later action.
#[gpui::test]
fn uncontrolled_native_click_commits_and_failure_and_disabled_input_preserve_it(cx: &mut TestAppContext) {
    let mut control = mount(cx, props(false));
    let (requests, _subscription) = control.watch_requests();
    let publications = Rc::new(RefCell::new(Vec::new()));
    let observed = publications.clone();
    let _observer = control.ui.cx.update(|app| {
        app.observe(&control.view, move |source, app| {
            let current = source.read(app).projection();
            observed.borrow_mut().push((current.selection().to_owned(), current.attempts()));
        })
    });
    control.assert_state("local seed", 0.);
    control.assert_paint(FILL_OTHER);
    control.click();
    control.assert_state("B", 1.);
    control.assert_paint(FILL_B);
    assert_requests(&requests, &[("B", "B", 1.)]);

    let before_failure = publications.borrow().len();
    assert!(publications.borrow().iter().any(|(selection, attempts)| selection == "B" && *attempts == 1.));
    let outcome = control.view.update(&mut control.ui, |view, cx| view.actions(cx).discard());
    let ActionOutcome::Failed(failure) = outcome else {
        panic!("expected failure, got {outcome:?}");
    };
    assert_eq!(failure.reason, "selection-refused");
    control.ui.run_until_parked();
    assert_eq!(publications.borrow().len(), before_failure, "unpublished writes notified the host");
    control.assert_state("B", 1.);
    control.assert_paint(FILL_B);
    assert_requests(&requests, &[("B", "B", 1.)]);

    let next_props = |disabled| SelectionControlProps {
        disabled,
        initial: "changed seed".into(),
        candidate: "C".into(),
        ..props(false)
    };
    control.view.update(&mut control.ui, |view, cx| view.set_props(next_props(true), cx));
    control.click();
    control.assert_state("B", 1.);
    control.assert_paint(FILL_B);
    assert_requests(&requests, &[("B", "B", 1.)]);

    control.view.update(&mut control.ui, |view, cx| view.set_props(next_props(false), cx));
    control.click();
    control.assert_state("C", 2.);
    control.assert_paint(FILL_C);
    assert_requests(&requests, &[("B", "B", 1.), ("C", "C", 2.)]);
}

// CASE-REENTRY: a declared action submitted during a native signal waits
// until the current subscriber returns without exposing its future writes.
#[gpui::test]
fn a_request_subscriber_queues_the_next_declared_action(cx: &mut TestAppContext) {
    let mut control = mount(cx, props(true));
    let attempts = Rc::new(RefCell::new(Vec::new()));
    let deliveries = attempts.clone();
    let _subscription = control.ui.cx.update(|app| {
        app.subscribe(&control.view, move |source, event: &SelectionControlSignal, app| {
            let SelectionControlSignal::requested(candidate) = event;
            assert_eq!(candidate, "B");
            let published = source.read(app).projection();
            assert_eq!(published.selection(), "A");
            deliveries.borrow_mut().push(published.attempts());
            if deliveries.borrow().len() == 1 {
                let nested = source.update(app, |view, cx| view.actions(cx).choose());
                assert_eq!(nested, ActionOutcome::Queued);
                assert_eq!(source.read(app).projection().attempts(), 1.);
            }
        })
    });
    let outcome = control.view.update(&mut control.ui, |view, cx| view.actions(cx).choose());
    assert_eq!(outcome, ActionOutcome::Committed);
    control.ui.run_until_parked();
    assert_eq!(&*attempts.borrow(), &[1., 2.]);
    control.assert_state("A", 2.);
}

#[gpui::test]
fn a_queued_discard_reports_its_failure_without_publishing_its_request(cx: &mut TestAppContext) {
    let mut control = mount(cx, props(false));
    let (requests, _subscription) = control.watch_requests();
    let failures = Rc::new(Cell::new(0));
    let delivered = failures.clone();
    let _failure = control.ui.cx.update(|app| {
        app.subscribe(&control.view, move |source, failure: &SegmentFailure, app| {
            assert_eq!(failure.reason, "selection-refused");
            let published = source.read(app).projection();
            assert_eq!(published.selection(), "B");
            assert_eq!(published.attempts(), 1.);
            delivered.set(delivered.get() + 1);
        })
    });
    let _reject = control.ui.cx.update(|app| {
        let mut first = true;
        app.subscribe(&control.view, move |source, event: &SelectionControlSignal, app| {
            if first {
                first = false;
                let SelectionControlSignal::requested(candidate) = event;
                assert_eq!(candidate, "B");
                let admission = source.update(app, |view, cx| view.actions(cx).discard());
                assert_eq!(admission, ActionOutcome::Queued);
                assert_eq!(source.read(app).projection().attempts(), 1.);
            }
        })
    });

    control.click();
    assert_eq!(failures.get(), 1, "the queued discard must execute");
    control.assert_state("B", 1.);
    control.assert_paint(FILL_B);
    assert_requests(&requests, &[("B", "B", 1.)]);

    let next = control.view.update(&mut control.ui, |view, cx| view.actions(cx).choose());
    assert_eq!(next, ActionOutcome::Committed);
    control.ui.run_until_parked();
    control.assert_state("B", 2.);
    assert_eq!(failures.get(), 1);
    assert_requests(&requests, &[("B", "B", 1.), ("B", "B", 2.)]);
}

#[gpui::test]
fn removing_the_native_child_releases_its_owner_and_rejects_a_retained_dispatch(cx: &mut TestAppContext) {
    let mut control = mount(cx, props(true));
    let old = control.view.downgrade();
    let dispatch = |app: &mut gpui::App| {
        with_owner(&old, app, |view, cx| view.actions(cx).choose())
    };
    assert_eq!(control.ui.cx.update(&dispatch), ActionOutcome::Committed);
    control.assert_state("A", 1.);

    let releases = Rc::new(Cell::new(0));
    let observed = releases.clone();
    let _release = control.ui.cx.update(|app| app.observe_release(&control.view, move |view, _| {
        let published = view.projection();
        assert_eq!(published.selection(), "A");
        assert_eq!(published.attempts(), 1.);
        observed.set(observed.get() + 1);
    }));

    let replacement = control.host.update(&mut control.ui, |host, cx| {
        let new = cx.new(|_| SelectionControl::new(props(false)).with_appearance(host_appearance));
        host.control = new.clone();
        cx.notify();
        new
    });
    assert_ne!(control.view.entity_id(), replacement.entity_id());
    control.view = replacement;
    let outcome = control.ui.cx.update(dispatch);
    control.ui.run_until_parked();
    assert_eq!(releases.get(), 1);
    assert!(old.upgrade().is_none());
    assert_eq!(outcome, ActionOutcome::Disposed);
    control.assert_state("local seed", 0.);
    control.assert_paint(FILL_OTHER);
}
