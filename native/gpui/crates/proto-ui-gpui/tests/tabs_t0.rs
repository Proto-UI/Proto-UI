//! Base Tabs over topology T0: a root with a list of two tabs and an
//! indicator, and a panel for each tab, every part run by the real peer and
//! composed on one GPUI host.
//!
//! The evidence is what the parts report back and what the host shows: which
//! tab is selected, which panel has a view, what each part reports to
//! accessibility, which tab Tab reaches, and what a key does to a focused tab.
//!
//! Ignored by default because it starts Node and needs the repository's
//! `node_modules` (`pnpm install`). The `rust-interop` CI job installs both
//! and runs them explicitly:
//!
//!   cargo test -p proto-ui-gpui --test tabs_t0 -- --ignored

mod t0;

use gpui::prelude::*;
use gpui::{div, px, Orientation, Role, StyleRefinement, TestAppContext};
use proto_ui_gpui::host::SurfaceChild;
use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
use serde_json::{json, Value};
use t0::{Fixture, Session};

const ROOT: &str = "t0-tabs";
const LIST: &str = "t0-tabs-list";
const ALPHA: &str = "t0-tabs-alpha";
const BETA: &str = "t0-tabs-beta";
const INDICATOR: &str = "t0-tabs-indicator";
const PANEL_ALPHA: &str = "t0-tabs-panel-alpha";
const PANEL_BETA: &str = "t0-tabs-panel-beta";
/// Inside the second tab: the tabs stack in the list, 20 high each.
const ON_BETA: (f32, f32) = (5., 25.);

fn props(value: Value) -> WireRecord {
    value.as_object().cloned().expect("props are an object")
}

fn sized(width: f32, height: f32) -> StyleRefinement {
    let mut element = div().w(px(width)).h(px(height));
    element.style().clone()
}

fn tabs(root: Value) -> Vec<Session> {
    let part = |id, prototype_key, props, content, parent, root_style| Session {
        id,
        prototype_key,
        props,
        content,
        parent: Some(parent),
        root_style,
    };
    let text = |text: &'static str| vec![SurfaceChild::Text(text.into())];
    vec![
        Session {
            id: ROOT,
            prototype_key: "base-tabs-root",
            props: props(root),
            content: [LIST, PANEL_ALPHA, PANEL_BETA]
                .map(|id| SurfaceChild::Session(id.into()))
                .to_vec(),
            parent: None,
            root_style: StyleRefinement::default(),
        },
        part(
            LIST,
            "base-tabs-list",
            props(json!({ "a11yLabel": "Sections" })),
            [ALPHA, BETA, INDICATOR]
                .map(|id| SurfaceChild::Session(id.into()))
                .to_vec(),
            ROOT,
            StyleRefinement::default(),
        ),
        part(
            ALPHA,
            "base-tabs-trigger",
            props(json!({ "value": "alpha" })),
            text("Alpha"),
            LIST,
            sized(60., 20.),
        ),
        part(
            BETA,
            "base-tabs-trigger",
            props(json!({ "value": "beta" })),
            text("Beta"),
            LIST,
            sized(60., 20.),
        ),
        part(
            INDICATOR,
            "base-tabs-indicator",
            WireRecord::new(),
            Vec::new(),
            LIST,
            StyleRefinement::default(),
        ),
        part(
            PANEL_ALPHA,
            "base-tabs-content",
            props(json!({ "value": "alpha" })),
            text("Alpha panel"),
            ROOT,
            StyleRefinement::default(),
        ),
        part(
            PANEL_BETA,
            "base-tabs-content",
            props(json!({ "value": "beta" })),
            text("Beta panel"),
            ROOT,
            StyleRefinement::default(),
        ),
    ]
}

/// Every part but the panel of the tab that is not selected has a view.
fn start(cx: &mut TestAppContext, root: Value) -> Fixture {
    let mut fixture = Fixture::start_viewed(
        cx,
        tabs(root),
        &[ROOT, LIST, ALPHA, BETA, INDICATOR, PANEL_ALPHA],
    );
    fixture.settle();
    fixture
}

/// Pumps until the `from` panel has detached its view and `to` has
/// activated one.
fn switch_panels(fixture: &mut Fixture, from: &str, to: &str) {
    let (mut detached, mut attached) = (false, false);
    while !(detached && attached) {
        let seen = fixture.pump_until(|message| match message {
            PeerToHostMessage::ProjectionDetach(detach) => detach.session_id == from,
            PeerToHostMessage::ProjectionActivate(activate) => activate.session_id == to,
            _ => false,
        });
        match seen.last() {
            Some(PeerToHostMessage::ProjectionDetach(_)) => detached = true,
            Some(PeerToHostMessage::ProjectionActivate(_)) => attached = true,
            _ => {}
        }
    }
    fixture.settle();
}

fn exposed(fixture: &mut Fixture, session: &str, name: &str) -> Option<Value> {
    fixture.with_view(|view| view.exposed_states(session)?.get(name).cloned())
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn the_selected_tab_shows_its_panel_and_every_part_reports_its_role(cx: &mut TestAppContext) {
    let mut fixture = start(cx, json!({ "defaultValue": "alpha" }));
    assert_eq!(
        fixture.with_view(|view| view.rendered_sessions()),
        [ROOT, LIST, ALPHA, BETA, INDICATOR, PANEL_ALPHA]
    );

    let list = fixture
        .with_view(|view| view.reported_a11y(LIST))
        .expect("the list is reported");
    assert_eq!(list.role, Role::TabList);
    assert_eq!(list.label.as_deref(), Some("Sections"));
    assert_eq!(list.orientation, Some(Orientation::Horizontal));
    let selected = |fixture: &mut Fixture, session| {
        fixture
            .with_view(|view| view.reported_a11y(session))
            .and_then(|tab| tab.selected)
    };
    assert_eq!(selected(&mut fixture, ALPHA), Some(true));
    assert_eq!(selected(&mut fixture, BETA), Some(false));
    // The panel is named by the tab that labels it, in another session.
    let panel = fixture
        .with_view(|view| view.reported_a11y(PANEL_ALPHA))
        .expect("the panel is reported");
    assert_eq!(panel.role, Role::TabPanel);
    assert_eq!(panel.label.as_deref(), Some("Alpha"));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_click_selects_a_tab_and_moves_the_panel_view(cx: &mut TestAppContext) {
    let mut fixture = start(cx, json!({ "defaultValue": "alpha" }));

    fixture.click(ON_BETA);
    switch_panels(&mut fixture, PANEL_ALPHA, PANEL_BETA);

    assert_eq!(exposed(&mut fixture, ALPHA, "selected"), Some(json!(false)));
    assert_eq!(exposed(&mut fixture, BETA, "selected"), Some(json!(true)));
    assert_eq!(
        fixture.with_view(|view| view.rendered_sessions()),
        [ROOT, LIST, ALPHA, BETA, INDICATOR, PANEL_BETA]
    );
    assert_eq!(
        fixture
            .with_view(|view| view.reported_a11y(PANEL_BETA))
            .and_then(|panel| panel.label)
            .as_deref(),
        Some("Beta")
    );
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn tab_reaches_the_selected_tab_and_not_the_other(cx: &mut TestAppContext) {
    let mut fixture = start(cx, json!({ "defaultValue": "alpha" }));
    fixture.click(ON_BETA);
    fixture.session_state_becomes(BETA, "selected", json!(true));
    fixture.settle();

    // The tab stop moved with the selection, outside a commit.
    for _ in 0..3 {
        fixture.cx.simulate_keystrokes("tab");
        fixture.settle();
        assert_eq!(exposed(&mut fixture, ALPHA, "focused"), Some(json!(false)));
    }
    assert_eq!(exposed(&mut fixture, BETA, "focused"), Some(json!(true)));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn enter_and_space_select_the_focused_tab_and_space_is_prevented(cx: &mut TestAppContext) {
    // Manual activation: focus alone selects nothing, so the key does.
    let mut fixture = start(
        cx,
        json!({ "defaultValue": "alpha", "activationMode": "manual" }),
    );
    fixture.with_view(|view| view.call_exposed(BETA, "focusSelf", Vec::new()));
    fixture.session_state_becomes(BETA, "focused", json!(true));
    fixture.settle();
    assert_eq!(exposed(&mut fixture, BETA, "selected"), Some(json!(false)));

    fixture.cx.simulate_keystrokes("enter");
    switch_panels(&mut fixture, PANEL_ALPHA, PANEL_BETA);
    assert_eq!(exposed(&mut fixture, BETA, "selected"), Some(json!(true)));

    // Space selects too, and the focused tab asks the host not to run
    // Space's default action for that very key press.
    fixture.with_view(|view| view.call_exposed(ALPHA, "focusSelf", Vec::new()));
    fixture.session_state_becomes(ALPHA, "focused", json!(true));
    fixture.cx.simulate_keystrokes("space");
    // The press commits before the key press reaches the tab, so the panels
    // may move before or after the prevention arrives.
    let (mut prevention, mut detached, mut attached) = (None, false, false);
    while prevention.is_none() || !detached || !attached {
        let seen = fixture.pump_until(|message| match message {
            PeerToHostMessage::DefaultActionPrevent(prevent) => {
                prevent.request.reason.as_deref() == Some("tabs.space-activation")
            }
            PeerToHostMessage::ProjectionDetach(detach) => detach.session_id == PANEL_BETA,
            PeerToHostMessage::ProjectionActivate(activate) => activate.session_id == PANEL_ALPHA,
            _ => false,
        });
        match seen.last() {
            Some(PeerToHostMessage::DefaultActionPrevent(prevent)) => {
                prevention = Some(prevent.clone())
            }
            Some(PeerToHostMessage::ProjectionDetach(_)) => detached = true,
            Some(PeerToHostMessage::ProjectionActivate(_)) => attached = true,
            _ => {}
        }
    }
    let prevent = prevention.expect("a prevention");
    assert_eq!(prevent.request.session_id, ALPHA);
    assert!(fixture.sent.iter().any(|message| matches!(
        message,
        HostToPeerMessage::InputSample(input)
            if input.session_id == ALPHA
                && input.sample.sample_id == prevent.request.sample_id
                && input.sample.kind == "key.down"
                && input.sample.key.as_deref() == Some(" ")
    )));
    fixture.settle();
    assert_eq!(exposed(&mut fixture, ALPHA, "selected"), Some(json!(true)));
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn a_disabled_tab_is_neither_selected_nor_focused(cx: &mut TestAppContext) {
    let mut fixture = start(cx, json!({ "defaultValue": "alpha" }));
    fixture.with_view(|view| {
        view.set_props(BETA, props(json!({ "value": "beta", "disabled": true })))
    });
    fixture.session_state_becomes(BETA, "disabled", json!(true));

    fixture.click(ON_BETA);
    fixture.with_view(|view| view.call_exposed(BETA, "focusSelf", Vec::new()));
    fixture.settle();
    assert_eq!(exposed(&mut fixture, BETA, "selected"), Some(json!(false)));
    assert_eq!(exposed(&mut fixture, BETA, "focused"), Some(json!(false)));
    assert_eq!(exposed(&mut fixture, ALPHA, "selected"), Some(json!(true)));
    assert_eq!(
        fixture.with_view(|view| view.rendered_sessions()),
        [ROOT, LIST, ALPHA, BETA, INDICATOR, PANEL_ALPHA]
    );
}
