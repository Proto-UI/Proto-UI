//! A relation that names another session: a Tabs panel takes its name from the
//! tab that labels it.
//!
//! Two sessions install the projection the real peer recorded for Base Button,
//! then report what Base Tabs' trigger and content say about themselves. The
//! panel names its tab by id, as the Prototype does, and the host resolves that
//! across sessions into the name the panel reports.

use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::rc::Rc;

use gpui::{px, size, AnyWindowHandle, Role, TestAppContext, VisualTestContext, WindowHandle};
use proto_ui_gpui::a11y::A11yProjection;
use proto_ui_gpui::host::{InputBridge, ProtoHostView, SurfaceChild};
use proto_ui_gpui::hub::SessionConfig;
use proto_ui_host_protocol::messages::{PeerToHostMessage, WireRecord};
use serde_json::{json, Value};

const TAB: &str = "tab";
const PANEL: &str = "panel";

/// The recorded Base Button session, as the session `session`.
fn installed(session: &str) -> Vec<PeerToHostMessage> {
    let path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/base-button-session.json");
    let fixture: Value =
        serde_json::from_str(&fs::read_to_string(path).expect("the fixture reads"))
            .expect("the fixture parses");
    let recorded = serde_json::to_string(&fixture["sessions"]["enabled"])
        .expect("the recording writes")
        .replace("\"button-enabled\"", &format!("\"{session}\""));
    serde_json::from_str::<Vec<Value>>(&recorded)
        .expect("the recording reads")
        .into_iter()
        .map(|message| serde_json::from_value(message).expect("a peer message"))
        .collect()
}

/// An accessibility snapshot for the view the recording installed.
fn snapshot(session: &str, snapshot: Value) -> PeerToHostMessage {
    serde_json::from_value(json!({
        "kind": "a11y.snapshot",
        "sessionId": session,
        "viewEpoch": 1,
        "snapshot": snapshot,
    }))
    .expect("a snapshot message")
}

/// What Base Tabs' trigger says about itself.
fn tab() -> Value {
    json!({
        "semanticObjectId": "tab-object",
        "id": "pui-tabs-1-trigger-overview",
        "role": "tab",
        "name": { "kind": "content" },
        "states": { "selected": true, "disabled": false },
        "actions": { "activate": { "event": "click" } },
        "relations": { "controls": "pui-tabs-1-content-overview" },
    })
}

/// What Base Tabs' content says about itself, naming its tab by `labelled_by`.
fn panel(labelled_by: Value) -> Value {
    json!({
        "semanticObjectId": "panel-object",
        "id": "pui-tabs-1-content-overview",
        "role": "tabpanel",
        "states": { "hidden": false },
        "actions": {},
        "relations": { "labelledBy": labelled_by },
    })
}

fn config(session: &str, text: &str) -> SessionConfig {
    SessionConfig {
        instance_id: format!("{session}:instance"),
        prototype_key: "base-button".into(),
        props: WireRecord::new(),
        slots: HashMap::from([(
            "slot-default".to_string(),
            vec![SurfaceChild::Text(text.to_string().into())],
        )]),
        root_style: Default::default(),
        theme: None,
        parent: None,
    }
}

struct Tabs {
    window: WindowHandle<ProtoHostView>,
    cx: VisualTestContext,
}

impl Tabs {
    fn open(cx: &mut TestAppContext) -> Self {
        let bridge = Rc::new(RefCell::new(InputBridge::new()));
        let window = cx.open_window(size(px(300.), px(100.)), move |window, cx| {
            let mut view = ProtoHostView::new(bridge, Vec::new(), window, cx);
            view.open_session(TAB, config(TAB, "Overview"), cx);
            view.open_session(PANEL, config(PANEL, "Panel body"), cx);
            view
        });
        cx.run_until_parked();
        let mut tabs = Self {
            window,
            cx: VisualTestContext::from_window(AnyWindowHandle::from(window), cx),
        };
        tabs.receive(installed(TAB));
        tabs.receive(installed(PANEL));
        tabs
    }

    fn receive(&mut self, messages: impl IntoIterator<Item = PeerToHostMessage>) {
        for message in messages {
            self.window
                .update(&mut self.cx, |view, window, cx| {
                    view.receive(message, window, cx)
                })
                .expect("the view receives");
        }
        self.cx.update(|window, cx| window.draw(cx).clear(cx));
    }

    fn reported(&mut self, session: &str) -> Option<A11yProjection> {
        self.window
            .update(&mut self.cx, |view, _, _| view.reported_a11y(session))
            .expect("the view reads")
    }
}

#[gpui::test]
fn a_panel_is_named_by_the_tab_its_id_names(cx: &mut TestAppContext) {
    let mut tabs = Tabs::open(cx);
    tabs.receive([
        snapshot(TAB, tab()),
        snapshot(PANEL, panel(json!("pui-tabs-1-trigger-overview"))),
    ]);

    let panel = tabs.reported(PANEL).expect("the panel is reported");
    assert_eq!(panel.role, Role::TabPanel);
    // The tab's name comes from its content, so the panel reads that text.
    assert_eq!(panel.label.as_deref(), Some("Overview"));
    let tab = tabs.reported(TAB).expect("the tab is reported");
    assert_eq!(tab.role, Role::Tab);
    assert_eq!(tab.selected, Some(true));
    assert_eq!(tab.label, None);
}

#[gpui::test]
fn a_panel_can_name_its_tab_as_a_semantic_object(cx: &mut TestAppContext) {
    let mut tabs = Tabs::open(cx);
    tabs.receive([
        snapshot(TAB, tab()),
        snapshot(PANEL, panel(json!(["tab-object"]))),
    ]);
    assert_eq!(
        tabs.reported(PANEL)
            .and_then(|panel| panel.label)
            .as_deref(),
        Some("Overview")
    );
}

#[gpui::test]
fn a_tab_with_a_name_of_its_own_labels_the_panel_with_it(cx: &mut TestAppContext) {
    let mut tabs = Tabs::open(cx);
    let mut named = tab();
    named["name"] = json!({ "kind": "text", "value": "Account overview" });
    tabs.receive([
        snapshot(TAB, named),
        snapshot(PANEL, panel(json!("pui-tabs-1-trigger-overview"))),
    ]);
    assert_eq!(
        tabs.reported(PANEL)
            .and_then(|panel| panel.label)
            .as_deref(),
        Some("Account overview")
    );
}

#[gpui::test]
fn a_panel_whose_tab_is_not_open_keeps_no_borrowed_name(cx: &mut TestAppContext) {
    let mut tabs = Tabs::open(cx);
    tabs.receive([snapshot(PANEL, panel(json!("pui-tabs-1-trigger-missing")))]);
    let panel = tabs.reported(PANEL).expect("the panel is still reported");
    assert_eq!(panel.label, None);
}
