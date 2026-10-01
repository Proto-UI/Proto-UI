//! A view that comes and goes with the instance's view intent, over topology
//! T0: Base Tabs panels, each opened inside the root and placed in its slot.
//!
//! Only the current panel wants a view, so the other one installs nothing.
//! Changing the value detaches one panel's view and attaches the other's; the
//! instances themselves stay open, and a panel that comes back does so in a
//! new view epoch (C-LIFECYCLE-0008).
//!
//! Ignored by default because it starts Node and needs the repository's
//! `node_modules` (`pnpm install`). The `rust-interop` CI job installs both
//! and runs it explicitly:
//!
//!   cargo test -p proto-ui-gpui --test view_intent_t0 -- --ignored

mod t0;

use gpui::{StyleRefinement, TestAppContext};
use proto_ui_gpui::host::SurfaceChild;
use proto_ui_host_protocol::messages::{PeerToHostMessage, WireRecord};
use serde_json::{json, Value};
use t0::{Fixture, Session};

const ROOT: &str = "t0-tabs";
const OVERVIEW: &str = "t0-tabs-overview";
const SETTINGS: &str = "t0-tabs-settings";

fn props(value: Value) -> WireRecord {
    value.as_object().cloned().expect("props are an object")
}

/// A Tabs root showing `value`, with a panel for each of two values.
fn tabs(value: &str) -> Vec<Session> {
    let panel = |id: &'static str, value: &str, text: &'static str| Session {
        id,
        prototype_key: "base-tabs-content",
        props: props(json!({ "value": value })),
        content: vec![SurfaceChild::Text(text.into())],
        parent: Some(ROOT),
        root_style: StyleRefinement::default(),
    };
    vec![
        Session {
            id: ROOT,
            prototype_key: "base-tabs-root",
            props: props(json!({ "value": value })),
            content: vec![
                SurfaceChild::Session(OVERVIEW.into()),
                SurfaceChild::Session(SETTINGS.into()),
            ],
            parent: None,
            root_style: StyleRefinement::default(),
        },
        panel(OVERVIEW, "overview", "Overview panel"),
        panel(SETTINGS, "settings", "Settings panel"),
    ]
}

/// Pumps until `detached` has detached a view and `attached` has activated one.
fn switch_views(fixture: &mut Fixture, detached: &str, attached: &str) -> (u64, u64) {
    let (mut gone, mut came) = (None, None);
    while gone.is_none() || came.is_none() {
        let seen = fixture.pump_until(|message| match message {
            PeerToHostMessage::ProjectionDetach(detach) => detach.session_id == detached,
            PeerToHostMessage::ProjectionActivate(activate) => activate.session_id == attached,
            _ => false,
        });
        match seen.last() {
            Some(PeerToHostMessage::ProjectionDetach(detach)) => gone = Some(detach.view_epoch),
            Some(PeerToHostMessage::ProjectionActivate(activate)) => {
                came = Some(activate.view_epoch)
            }
            _ => {}
        }
    }
    (gone.expect("a detach"), came.expect("an activation"))
}

#[gpui::test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn only_the_current_panel_has_a_view_and_the_view_follows_the_value(cx: &mut TestAppContext) {
    let mut fixture = Fixture::start_viewed(cx, tabs("overview"), &[ROOT, OVERVIEW]);
    fixture.settle();
    // The other panel is detached from its creation: it never rendered.
    assert_eq!(
        fixture.with_view(|view| view.rendered_sessions()),
        [ROOT, OVERVIEW]
    );

    fixture.with_view(|view| view.set_props(ROOT, props(json!({ "value": "settings" }))));
    let (gone, came) = switch_views(&mut fixture, OVERVIEW, SETTINGS);
    assert_eq!((gone, came), (1, 1));
    fixture.settle();
    assert_eq!(
        fixture.with_view(|view| view.rendered_sessions()),
        [ROOT, SETTINGS]
    );

    // The overview instance was kept; its view comes back in a new epoch.
    fixture.with_view(|view| view.set_props(ROOT, props(json!({ "value": "overview" }))));
    let (gone, came) = switch_views(&mut fixture, SETTINGS, OVERVIEW);
    assert_eq!((gone, came), (1, 2));
    fixture.settle();
    assert_eq!(
        fixture.with_view(|view| view.rendered_sessions()),
        [ROOT, OVERVIEW]
    );
}
