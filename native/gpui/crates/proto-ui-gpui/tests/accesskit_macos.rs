//! Base Button in a real macOS window, read through the platform's
//! accessibility API.
//!
//! GPUI's test platform never starts AccessKit, so the headless suites cannot
//! see what the host reports. This opens a real window with `gpui_platform`,
//! replays Base Button, Base Toggle and Base Switch sessions the real peer
//! recorded, and
//! asks macOS what is there, with the `NSAccessibility` calls a screen reader
//! makes. It then presses them the way a screen reader does and checks what
//! the host sends the peer.
//!
//! The calls go to this process's own window, so no accessibility permission
//! is involved. Frames are drawn by hand: macOS does not draw a window nobody
//! can see, and the display of a CI runner, or of a locked machine, may be
//! asleep.
//!
//! Off by default, because it needs a window server:
//!
//!   cargo test -p proto-ui-gpui --features macos-accessibility-test --test accesskit_macos

#[cfg(not(target_os = "macos"))]
fn main() {
    println!("accesskit_macos: macOS only, nothing to run");
}

#[cfg(target_os = "macos")]
fn main() {
    macos::run();
}

#[cfg(target_os = "macos")]
#[path = "support/native_capture.rs"]
mod native_capture;

#[cfg(target_os = "macos")]
mod macos {
    use std::cell::RefCell;
    use std::collections::HashMap;
    use std::ffi::CStr;
    use std::fs;
    use std::os::raw::c_char;
    use std::path::Path;
    use std::process;
    use std::rc::Rc;
    use std::thread;
    use std::time::Duration;

    use gpui::{
        px, size, AnyWindowHandle, App, AppContext, AsyncApp, Bounds, KeyDownEvent, KeyUpEvent,
        Keystroke, PlatformInput, StyleRefinement, WindowBounds, WindowHandle, WindowOptions,
    };
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use proto_ui_gpui::host::{
        FocusAction, InputBridge, ProtoHostView, SurfaceChild, FOCUS_ROOT_REF,
    };
    use proto_ui_gpui::hub::SessionConfig;
    use proto_ui_host_protocol::messages::{HostToPeerMessage, PeerToHostMessage, WireRecord};
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use serde_json::{json, Value};

    const ENABLED: &str = "button-enabled";
    const DISABLED: &str = "button-disabled";
    const TOGGLE_OFF: &str = "toggle-inactive";
    const TOGGLE_ON: &str = "toggle-active";
    const SWITCH_OFF: &str = "switch-root";
    const SWITCH_OFF_THUMB: &str = "switch-thumb";
    const SWITCH_ON: &str = "switch-checked";
    const SWITCH_ON_THUMB: &str = "switch-checked-thumb";
    const TAB_LIST: &str = "tabs-list";
    const TAB_ON: &str = "tab-overview";
    const TAB_OFF: &str = "tab-settings";
    const TAB_PANEL: &str = "tab-panel";
    const CHECKBOX_OFF: &str = "checkbox-root";
    const CHECKBOX_OFF_INDICATOR: &str = "checkbox-indicator";
    const CHECKBOX_ON: &str = "checkbox-checked";
    const CHECKBOX_ON_INDICATOR: &str = "checkbox-checked-indicator";
    const CHECKBOX_MIXED: &str = "checkbox-mixed";
    const CHECKBOX_MIXED_INDICATOR: &str = "checkbox-mixed-indicator";
    /// Long enough for AccessKit's action channel to reach the foreground.
    const SETTLE: Duration = Duration::from_millis(200);

    /// The peer's recorded messages for one session, and the lease ids its
    /// projection registered for `press.commit` on the root.
    fn recorded(fixture: &str, session: &str) -> (Vec<PeerToHostMessage>, Vec<String>) {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures")
            .join(fixture);
        let fixture: Value =
            serde_json::from_str(&fs::read_to_string(path).expect("the fixture reads"))
                .expect("the fixture parses");
        let messages: Vec<PeerToHostMessage> = fixture["sessions"][session]
            .as_array()
            .expect("a recorded session")
            .iter()
            .map(|message| serde_json::from_value(message.clone()).expect("a peer message"))
            .collect();
        let commit_leases = messages
            .iter()
            .find_map(|message| match message {
                PeerToHostMessage::ProjectionInstall(install) => Some(
                    install
                        .transaction
                        .events
                        .registrations
                        .iter()
                        .filter(|registration| {
                            registration.kind.as_deref() == Some("press.commit")
                                && registration.scope.as_deref() == Some("root")
                        })
                        .filter_map(|registration| registration.lease_id.clone())
                        .collect(),
                ),
                _ => None,
            })
            .expect("the recorded session installed a projection");
        (messages, commit_leases)
    }

    /// A later snapshot of the enabled Button's installed view.
    fn snapshot(disabled: bool, name: Value) -> PeerToHostMessage {
        serde_json::from_value(json!({
            "kind": "a11y.snapshot",
            "sessionId": ENABLED,
            "viewEpoch": 1,
            "snapshot": {
                "semanticObjectId": "button-enabled:a11y:1",
                "role": "button",
                "name": name,
                "states": { "disabled": disabled },
                "actions": { "activate": { "event": "click" } },
                "relations": {},
            },
        }))
        .expect("a snapshot message")
    }

    /// A Base Tabs part: the recorded Base Button projection installed as
    /// `session`, then what the Tabs part says about itself.
    fn tabs_part(session: &str, snapshot: Value) -> Vec<PeerToHostMessage> {
        let path =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/base-button-session.json");
        let fixture: Value =
            serde_json::from_str(&fs::read_to_string(path).expect("the fixture reads"))
                .expect("the fixture parses");
        let recorded = serde_json::to_string(&fixture["sessions"]["enabled"])
            .expect("the recording writes")
            .replace("\"button-enabled\"", &format!("\"{session}\""));
        let mut messages: Vec<Value> =
            serde_json::from_str(&recorded).expect("the recording reads");
        messages.push(json!({
            "kind": "a11y.snapshot",
            "sessionId": session,
            "viewEpoch": 1,
            "snapshot": snapshot,
        }));
        messages
            .into_iter()
            .map(|message| serde_json::from_value(message).expect("a peer message"))
            .collect()
    }

    /// A recorded session replayed as the session `to`, the name its
    /// snapshots give it replaced by `name` when there is one.
    fn replayed(
        fixture: &str,
        session: &str,
        from: &str,
        to: &str,
        name: Option<&str>,
    ) -> Vec<PeerToHostMessage> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures")
            .join(fixture);
        let fixture: Value =
            serde_json::from_str(&fs::read_to_string(path).expect("the fixture reads"))
                .expect("the fixture parses");
        let recorded = serde_json::to_string(&fixture["sessions"][session])
            .expect("the recording writes")
            .replace(&format!("\"{from}"), &format!("\"{to}"));
        let mut messages: Vec<Value> =
            serde_json::from_str(&recorded).expect("the recording reads");
        if let Some(name) = name {
            for message in &mut messages {
                for pointer in ["/transaction/a11y", "/snapshot"] {
                    if let Some(snapshot) = message
                        .pointer_mut(pointer)
                        .filter(|snapshot| snapshot.is_object())
                    {
                        snapshot["name"] = json!({ "kind": "text", "value": name });
                    }
                }
            }
        }
        messages
            .into_iter()
            .map(|message| serde_json::from_value(message).expect("a peer message"))
            .collect()
    }

    /// What Base Tabs' trigger says about itself.
    fn tab(value: &str, selected: bool) -> Value {
        json!({
            "semanticObjectId": format!("tab-{value}"),
            "id": format!("pui-tabs-1-trigger-{value}"),
            "role": "tab",
            "name": { "kind": "content" },
            "states": { "selected": selected, "disabled": false },
            "actions": { "activate": { "event": "click" } },
            "relations": { "controls": format!("pui-tabs-1-content-{value}") },
        })
    }

    fn config(session: &str, prototype_key: &str, label: &str) -> SessionConfig {
        composed(
            session,
            prototype_key,
            vec![SurfaceChild::Text(label.to_string().into())],
            None,
        )
    }

    /// An instance whose default slot holds `content`, opened inside `parent`.
    fn composed(
        session: &str,
        prototype_key: &str,
        content: Vec<SurfaceChild>,
        parent: Option<&str>,
    ) -> SessionConfig {
        SessionConfig {
            instance_id: format!("{session}:instance"),
            prototype_key: prototype_key.into(),
            props: WireRecord::new(),
            slots: HashMap::from([("slot-default".to_string(), content)]),
            root_style: StyleRefinement::default(),
            theme: None,
            parent: parent.map(Into::into),
        }
    }

    /// A Switch labelled `label`, with its thumb in the default slot.
    fn switch(session: &str, thumb: &str, label: &str) -> [(String, SessionConfig); 2] {
        [
            (
                session.to_string(),
                composed(
                    session,
                    "base-switch-root",
                    vec![
                        SurfaceChild::Session(thumb.into()),
                        SurfaceChild::Text(label.to_string().into()),
                    ],
                    None,
                ),
            ),
            (
                thumb.to_string(),
                composed(thumb, "base-switch-thumb", Vec::new(), Some(session)),
            ),
        ]
    }

    /// A Checkbox labelled `label`, with its indicator in the default slot.
    fn checkbox(session: &str, indicator: &str, label: &str) -> [(String, SessionConfig); 2] {
        [
            (
                session.to_string(),
                composed(
                    session,
                    "base-checkbox-root",
                    vec![
                        SurfaceChild::Session(indicator.into()),
                        SurfaceChild::Text(label.to_string().into()),
                    ],
                    None,
                ),
            ),
            (
                indicator.to_string(),
                composed(
                    indicator,
                    "base-checkbox-indicator",
                    Vec::new(),
                    Some(session),
                ),
            ),
        ]
    }

    // --- NSAccessibility, as a screen reader asks it ------------------------

    /// The window's content view. AccessKit's adapter subclasses it; GPUI's own
    /// view is a subview of it.
    fn content_view(window: &gpui::Window) -> *mut AnyObject {
        let view: *mut AnyObject = match HasWindowHandle::window_handle(window)
            .expect("a window handle")
            .as_raw()
        {
            RawWindowHandle::AppKit(handle) => handle.ns_view.as_ptr().cast(),
            other => panic!("not an AppKit window: {other:?}"),
        };
        // SAFETY: `view` is GPUI's live `NSView`; both messages are plain
        // AppKit accessors on the main thread.
        unsafe {
            let ns_window: *mut AnyObject = msg_send![view, window];
            msg_send![ns_window, contentView]
        }
    }

    /// # Safety
    /// `object` is null or a live `NSString`.
    unsafe fn string(object: *mut AnyObject) -> Option<String> {
        if object.is_null() {
            return None;
        }
        let utf8: *const c_char = msg_send![object, UTF8String];
        Some(CStr::from_ptr(utf8).to_string_lossy().into_owned())
    }

    /// # Safety
    /// `object` is null or a live object.
    unsafe fn number(object: *mut AnyObject) -> Option<i64> {
        if object.is_null() {
            return None;
        }
        let is_number: bool = msg_send![object, isKindOfClass: objc2::class!(NSNumber)];
        is_number.then(|| msg_send![object, longLongValue])
    }

    /// # Safety
    /// `object` is a live object implementing `NSAccessibility`.
    unsafe fn children(object: *mut AnyObject) -> Vec<*mut AnyObject> {
        let array: *mut AnyObject = msg_send![object, accessibilityChildren];
        if array.is_null() {
            return Vec::new();
        }
        let count: usize = msg_send![array, count];
        (0..count)
            .map(|index| msg_send![array, objectAtIndex: index])
            .collect()
    }

    /// One accessibility object as a screen reader sees it.
    #[derive(Debug, Clone, PartialEq)]
    struct Seen {
        role: Option<String>,
        subrole: Option<String>,
        title: Option<String>,
        enabled: bool,
        /// The value, when it is a number, as a checkbox's is.
        number: Option<i64>,
        text_value: Option<String>,
        object: *mut AnyObject,
    }

    /// Every object beneath `object`, depth first.
    ///
    /// # Safety
    /// `object` is a live object implementing `NSAccessibility`.
    unsafe fn walk(object: *mut AnyObject, depth: usize, into: &mut Vec<(usize, Seen)>) {
        for child in children(object) {
            let role: *mut AnyObject = msg_send![child, accessibilityRole];
            let subrole: *mut AnyObject = msg_send![child, accessibilitySubrole];
            let title: *mut AnyObject = msg_send![child, accessibilityTitle];
            let enabled: bool = msg_send![child, isAccessibilityEnabled];
            let value: *mut AnyObject = msg_send![child, accessibilityValue];
            let number = number(value);
            let is_text: bool =
                !value.is_null() && msg_send![value, isKindOfClass: objc2::class!(NSString)];
            let text_value = if is_text { string(value) } else { None };
            into.push((
                depth,
                Seen {
                    role: string(role),
                    subrole: string(subrole),
                    title: string(title),
                    enabled,
                    number,
                    text_value,
                    object: child,
                },
            ));
            walk(child, depth + 1, into);
        }
    }

    // --- The run --------------------------------------------------------------

    struct Run {
        window: WindowHandle<ProtoHostView>,
        passed: usize,
        capture_failures: Vec<String>,
    }

    impl Run {
        fn any(&self) -> AnyWindowHandle {
            self.window.into()
        }

        /// Draws a frame, which is when GPUI builds the accessibility tree
        /// and hands it to AccessKit.
        fn draw(&self, cx: &mut AsyncApp) {
            cx.update_window(self.any(), |_, window, cx| window.draw(cx).clear(cx))
                .expect("the window draws");
        }

        /// Capture only this test's own window, at the named current phase.
        /// Node presence alone is not evidence that text is inside the frame;
        /// the resulting PNG still requires pixel inspection.
        async fn capture(&mut self, phase: &str, cx: &mut AsyncApp) {
            let Ok(directory) = std::env::var("PROTO_GPUI_EVIDENCE_DIR") else {
                return;
            };
            let path = Path::new(&directory).join(format!("control-label-{phase}.png"));
            let result = async {
                fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
                let target = cx
                    .update_window(self.any(), |_, window, _| {
                        // SAFETY: this is the main-thread, live view of our own
                        // test window. No external window identifier is accepted.
                        unsafe { super::native_capture::Target::from_view(content_view(window)) }
                    })
                    .map_err(|error| error.to_string())??;
                super::native_capture::capture(target, &path, cx).await?;
                println!("native capture target: {target:?}");
                Ok::<(), String>(())
            }
            .await;
            match result {
                Ok(()) => {
                    self.passed += 1;
                    println!("native pixel evidence: {}", path.display());
                }
                Err(error) => {
                    // Preserve the failure, but still exercise the actions
                    // below. A missing screenshot must not erase AT evidence.
                    let failure = format!("{phase}: {error}");
                    println!("FAILED native pixel evidence: {failure}");
                    self.capture_failures.push(failure);
                }
            }
        }

        fn tree(&self, cx: &mut AsyncApp) -> Vec<(usize, Seen)> {
            cx.update_window(self.any(), |_, window, _| {
                let mut seen = Vec::new();
                // SAFETY: the content view is live while the window is.
                unsafe { walk(content_view(window), 0, &mut seen) };
                seen
            })
            .expect("the window reads")
        }

        /// Every object with this role, in tree order.
        fn with_role(&self, role: &str, cx: &mut AsyncApp) -> Vec<Seen> {
            self.tree(cx)
                .into_iter()
                .map(|(_, seen)| seen)
                .filter(|seen| seen.role.as_deref() == Some(role))
                .collect()
        }

        /// Presses a button as a screen reader does, and waits for AccessKit
        /// to hand the action to GPUI.
        async fn press(&self, button: &Seen, cx: &mut AsyncApp) -> bool {
            // SAFETY: the object came from this window's tree, which has not
            // been rebuilt since.
            let accepted: bool = unsafe { msg_send![button.object, accessibilityPerformPress] };
            cx.background_executor().timer(SETTLE).await;
            accepted
        }

        /// The `press.commit` samples the host would send the peer now, with
        /// the session and the leases each one reaches.
        fn commits(&self, cx: &mut AsyncApp) -> Vec<(String, Vec<String>)> {
            self.window
                .update(cx, |view, _, _| view.take_outbox())
                .expect("the view drains")
                .into_iter()
                .filter_map(|message| match message {
                    HostToPeerMessage::InputSample(input)
                        if input.sample.kind == "press.commit" =>
                    {
                        Some((input.session_id, input.sample.lease_ids))
                    }
                    _ => None,
                })
                .collect()
        }

        fn check(&mut self, what: &str, holds: bool, detail: impl std::fmt::Debug) {
            if holds {
                self.passed += 1;
                println!("ok: {what}");
            } else {
                println!("FAILED: {what}: {detail:?}");
                println!("test result: FAILED. {} passed; 1 failed", self.passed);
                process::exit(1);
            }
        }
    }

    pub fn run() {
        // Nothing here should take long; a hang is a failure, not a wait.
        thread::spawn(|| {
            thread::sleep(Duration::from_secs(60));
            println!("FAILED: timed out after 60 s");
            process::exit(1);
        });

        gpui_platform::application().run(|cx: &mut App| {
            let (enabled_messages, enabled_commit) =
                recorded("base-button-session.json", "enabled");
            let (disabled_messages, _) = recorded("base-button-session.json", "disabled");
            let (toggle_off_messages, toggle_off_commit) =
                recorded("base-toggle-session.json", "inactive");
            let (toggle_on_messages, _) = recorded("base-toggle-session.json", "active");
            let (switch_off_messages, switch_off_commit) =
                recorded("base-switch-session.json", "root");
            let (switch_off_thumb_messages, _) = recorded("base-switch-session.json", "thumb");
            let (switch_on_messages, _) = recorded("base-switch-session.json", "checked");
            let (switch_on_thumb_messages, _) =
                recorded("base-switch-session.json", "checkedThumb");
            let (checkbox_off_messages, checkbox_off_commit) =
                recorded("base-checkbox-session.json", "root");
            let checkbox_messages: Vec<PeerToHostMessage> = checkbox_off_messages
                .into_iter()
                .chain(
                    [
                        "indicator",
                        "checked",
                        "checkedIndicator",
                        "mixed",
                        "mixedIndicator",
                    ]
                    .into_iter()
                    .flat_map(|session| recorded("base-checkbox-session.json", session).0),
                )
                .collect();
            let tabs_messages: Vec<PeerToHostMessage> = tabs_part(
                TAB_LIST,
                json!({
                    "semanticObjectId": "tab-list",
                    "role": "tablist",
                    "name": { "kind": "text", "value": "Sections" },
                    "states": { "orientation": "horizontal" },
                    "actions": {},
                    "relations": {},
                }),
            )
            .into_iter()
            .chain(tabs_part(TAB_ON, tab("overview", true)))
            .chain(tabs_part(TAB_OFF, tab("settings", false)))
            .chain(tabs_part(
                TAB_PANEL,
                json!({
                    "semanticObjectId": "tab-panel",
                    "id": "pui-tabs-1-content-overview",
                    "role": "tabpanel",
                    "states": { "hidden": false },
                    "actions": {},
                    "relations": { "labelledBy": "pui-tabs-1-trigger-overview" },
                }),
            ))
            .collect();
            let bounds = Bounds::centered(None, size(px(300.), px(300.)), cx);
            let window = cx
                .open_window(
                    WindowOptions {
                        window_bounds: Some(WindowBounds::Windowed(bounds)),
                        ..Default::default()
                    },
                    |window, cx| {
                        cx.new(|cx| {
                            let bridge = Rc::new(RefCell::new(InputBridge::new()));
                            let mut view = ProtoHostView::new(bridge, Vec::new(), window, cx);
                            view.open_session(ENABLED, config(ENABLED, "base-button", "Save"), cx);
                            view.open_session(
                                DISABLED,
                                config(DISABLED, "base-button", "Delete"),
                                cx,
                            );
                            view.open_session(
                                TOGGLE_OFF,
                                config(TOGGLE_OFF, "base-toggle", "Bold"),
                                cx,
                            );
                            view.open_session(
                                TOGGLE_ON,
                                config(TOGGLE_ON, "base-toggle", "Italic"),
                                cx,
                            );
                            for (session, config) in switch(SWITCH_OFF, SWITCH_OFF_THUMB, "Wi-Fi")
                                .into_iter()
                                .chain(switch(SWITCH_ON, SWITCH_ON_THUMB, "Bluetooth"))
                            {
                                view.open_session(session, config, cx);
                            }
                            // Base Tabs parts, installed through the recorded
                            // Button projection.
                            for (session, label) in [
                                (TAB_LIST, ""),
                                (TAB_ON, "Overview"),
                                (TAB_OFF, "Settings"),
                                (TAB_PANEL, "Panel body"),
                            ] {
                                view.open_session(session, config(session, "base-button", label), cx);
                            }
                            for (session, config) in
                                checkbox(CHECKBOX_OFF, CHECKBOX_OFF_INDICATOR, "Accept")
                                    .into_iter()
                                    .chain(checkbox(CHECKBOX_ON, CHECKBOX_ON_INDICATOR, "Subscribe"))
                                    .chain(checkbox(
                                        CHECKBOX_MIXED,
                                        CHECKBOX_MIXED_INDICATOR,
                                        "Select all",
                                    ))
                            {
                                view.open_session(session, config, cx);
                            }
                            view
                        })
                    },
                )
                .expect("a window opens; this test needs a window server");

            window
                .update(cx, |view, window, cx| {
                    for message in enabled_messages
                        .into_iter()
                        .chain(disabled_messages)
                        .chain(toggle_off_messages)
                        .chain(toggle_on_messages)
                        .chain(switch_off_messages)
                        .chain(switch_off_thumb_messages)
                        .chain(switch_on_messages)
                        .chain(switch_on_thumb_messages)
                        .chain(tabs_messages)
                        .chain(checkbox_messages)
                    {
                        view.receive(message, window, cx);
                    }
                    view.take_outbox();
                })
                .expect("the view replays the recording");

            cx.spawn(async move |cx| {
                let mut run = Run { window, passed: 0, capture_failures: Vec::new() };

                // The first question a screen reader asks starts AccessKit.
                cx.update_window(run.any(), |_, window, _| {
                    // SAFETY: the content view is live while the window is.
                    unsafe { children(content_view(window)) };
                })
                .expect("the window reads");
                // One frame to see AccessKit is active, one to send the tree.
                run.draw(cx);
                run.draw(cx);

                println!("accessibility tree, as macOS reports it:");
                for (depth, seen) in run.tree(cx) {
                    println!(
                        "  {:indent$}{}{} title={:?} enabled={}{}",
                        "",
                        seen.role.as_deref().unwrap_or("?"),
                        seen.subrole
                            .as_deref()
                            .filter(|subrole| *subrole != "AXUnknown")
                            .map(|subrole| format!("/{subrole}"))
                            .unwrap_or_default(),
                        seen.title,
                        seen.enabled,
                        seen.number
                            .map(|number| format!(" value={number}"))
                            .unwrap_or_default(),
                        indent = depth * 2
                    );
                }

                let buttons = run.with_role("AXButton", cx);
                let reported: Vec<(Option<String>, bool)> = buttons
                    .iter()
                    .map(|seen| (seen.title.clone(), seen.enabled))
                    .collect();
                run.check(
                    "both Buttons are reported, named by their content, the disabled one disabled",
                    reported
                        == vec![
                            (Some("Save".to_string()), true),
                            (Some("Delete".to_string()), false),
                        ],
                    &reported,
                );

                // A Toggle is a toggle button: macOS reports a checkbox with the
                // toggle subrole, and its value says whether it is on.
                let toggles: Vec<Seen> = run
                    .with_role("AXCheckBox", cx)
                    .into_iter()
                    .filter(|seen| seen.subrole.as_deref() == Some("AXToggle"))
                    .collect();
                let reported: Vec<(Option<String>, Option<String>, Option<i64>)> = toggles
                    .iter()
                    .map(|seen| (seen.title.clone(), seen.subrole.clone(), seen.number))
                    .collect();
                run.check(
                    "both Toggles are reported as toggle buttons, off and on",
                    reported
                        == vec![
                            (Some("Bold".into()), Some("AXToggle".into()), Some(0)),
                            (Some("Italic".into()), Some("AXToggle".into()), Some(1)),
                        ],
                    &reported,
                );
                let accepted = run.press(&toggles[0], cx).await;
                let commits = run.commits(cx);
                run.check(
                    "a screen reader's press commits the Toggle on its own lease",
                    accepted
                        && commits == vec![(TOGGLE_OFF.to_string(), toggle_off_commit.clone())],
                    (accepted, &commits),
                );

                // A Switch is a checkbox with the switch subrole. AccessKit does
                // not name a switch from its content, so the host names it.
                let switches: Vec<Seen> = run
                    .with_role("AXCheckBox", cx)
                    .into_iter()
                    .filter(|seen| seen.subrole.as_deref() == Some("AXSwitch"))
                    .collect();
                let reported: Vec<(Option<String>, Option<i64>)> = switches
                    .iter()
                    .map(|seen| (seen.title.clone(), seen.number))
                    .collect();
                run.check(
                    "both Switches are reported as switches named by their content, off and on",
                    reported
                        == vec![
                            (Some("Wi-Fi".into()), Some(0)),
                            (Some("Bluetooth".into()), Some(1)),
                        ],
                    &reported,
                );
                // Base Tabs parts. AccessKit reports a tab as a radio button
                // with the tab button subrole, its value saying whether it is
                // the selected one; the host names it from its content.
                let tabs: Vec<(Option<String>, Option<i64>)> = run
                    .with_role("AXRadioButton", cx)
                    .into_iter()
                    .filter(|seen| seen.subrole.as_deref() == Some("AXTabButton"))
                    .map(|seen| (seen.title, seen.number))
                    .collect();
                run.check(
                    "both tabs are reported as tab buttons named by their content, selected and not",
                    tabs == vec![
                        (Some("Overview".into()), Some(1)),
                        (Some("Settings".into()), Some(0)),
                    ],
                    &tabs,
                );
                let panels: Vec<Option<String>> = run
                    .with_role("AXGroup", cx)
                    .into_iter()
                    .filter(|seen| seen.subrole.as_deref() == Some("AXTabPanel"))
                    .map(|seen| seen.title)
                    .collect();
                run.check(
                    "the tab panel is named by the tab that labels it, from another session",
                    panels == vec![Some("Overview".into())],
                    &panels,
                );
                let lists: Vec<Option<String>> = run
                    .with_role("AXTabGroup", cx)
                    .into_iter()
                    .map(|seen| seen.title)
                    .collect();
                run.check(
                    "the tab list is reported as a tab group with its name",
                    lists == vec![Some("Sections".into())],
                    &lists,
                );

                let accepted = run.press(&switches[0], cx).await;
                let commits = run.commits(cx);
                run.check(
                    "a screen reader's press commits the Switch on its own lease",
                    accepted
                        && commits == vec![(SWITCH_OFF.to_string(), switch_off_commit.clone())],
                    (accepted, &commits),
                );

                // A Checkbox is a checkbox with no subrole, named by AccessKit
                // from its content. Pinned for upgrades: the host gives
                // AccessKit a mixed state, and AccessKit's macOS adapter reports
                // any toggled state as on or off, so mixed reads as checked.
                let checkboxes: Vec<Seen> = run
                    .with_role("AXCheckBox", cx)
                    .into_iter()
                    .filter(|seen| {
                        !matches!(seen.subrole.as_deref(), Some("AXToggle" | "AXSwitch"))
                    })
                    .collect();
                let reported: Vec<(Option<String>, Option<i64>)> = checkboxes
                    .iter()
                    .map(|seen| (seen.title.clone(), seen.number))
                    .collect();
                run.check(
                    "the three Checkboxes are reported named by their content, mixed read as checked",
                    reported
                        == vec![
                            (Some("Accept".into()), Some(0)),
                            (Some("Subscribe".into()), Some(1)),
                            (Some("Select all".into()), Some(1)),
                        ],
                    &reported,
                );
                let accepted = run.press(&checkboxes[0], cx).await;
                let commits = run.commits(cx);
                run.check(
                    "a screen reader's press commits the Checkbox on its own lease",
                    accepted
                        && commits
                            == vec![(CHECKBOX_OFF.to_string(), checkbox_off_commit.clone())],
                    (accepted, &commits),
                );

                let accepted = run.press(&buttons[0], cx).await;
                let commits = run.commits(cx);
                run.check(
                    "a screen reader's press commits the Button on its own lease",
                    accepted && commits == vec![(ENABLED.to_string(), enabled_commit.clone())],
                    (accepted, &commits),
                );

                // Enter commits on the key. A browser would follow it with a
                // click the router suppresses; GPUI sends none, so a later
                // screen-reader press is an activation of its own.
                let focused = run
                    .window
                    .update(cx, |view, window, cx| {
                        view.request_focus(ENABLED, FOCUS_ROOT_REF, FocusAction::Focus, window, cx)
                    })
                    .expect("the view focuses");
                let enter = Keystroke::parse("enter").expect("a keystroke");
                cx.update_window(run.any(), |_, window, cx| {
                    window.dispatch_event(
                        PlatformInput::KeyDown(KeyDownEvent {
                            keystroke: enter.clone(),
                            is_held: false,
                            prefer_character_input: false,
                        }),
                        cx,
                    );
                    window
                        .dispatch_event(PlatformInput::KeyUp(KeyUpEvent { keystroke: enter }), cx);
                })
                .expect("the window takes the key");
                let by_key = run.commits(cx);
                run.check(
                    "Enter on the focused Button commits it",
                    by_key == vec![(ENABLED.to_string(), enabled_commit.clone())],
                    (focused, &by_key),
                );

                run.draw(cx);
                let buttons = run.with_role("AXButton", cx);
                let accepted = run.press(&buttons[0], cx).await;
                let after_key = run.commits(cx);
                run.check(
                    "a screen reader's press after Enter still commits",
                    accepted && after_key == vec![(ENABLED.to_string(), enabled_commit.clone())],
                    (accepted, &after_key),
                );

                // The same live node through later snapshots of its view: what
                // a snapshot takes back, the host takes back too.
                let mut steps = Vec::new();
                for (disabled, name, expected) in [
                    (true, json!({ "kind": "content" }), (Some("Save"), false)),
                    (false, json!({ "kind": "content" }), (Some("Save"), true)),
                    (false, json!({ "kind": "text", "value": "A" }), (Some("A"), true)),
                    (false, json!({ "kind": "text", "value": "B" }), (Some("B"), true)),
                    (false, json!({ "kind": "content" }), (Some("Save"), true)),
                ] {
                    run.window
                        .update(cx, |view, window, cx| {
                            view.receive(snapshot(disabled, name), window, cx)
                        })
                        .expect("the view receives");
                    run.draw(cx);
                    let seen = run.with_role("AXButton", cx);
                    steps.push(((seen[0].title.clone(), seen[0].enabled), expected));
                }
                run.check(
                    "later snapshots disable, re-enable and rename the Button, then name it by its content again",
                    steps.iter().all(|((title, enabled), (want_title, want_enabled))| {
                        title.as_deref() == *want_title && enabled == want_enabled
                    }),
                    &steps,
                );

                let buttons = run.with_role("AXButton", cx);
                let accepted = run.press(&buttons[0], cx).await;
                let re_enabled = run.commits(cx);
                run.check(
                    "a press after the Button is re-enabled commits once",
                    accepted && re_enabled == vec![(ENABLED.to_string(), enabled_commit.clone())],
                    (accepted, &re_enabled),
                );

                // Pinned for upgrades of GPUI and AccessKit: the same slot text
                // names a Button through AccessKit and a Switch through the
                // host, once each, and a text name the Prototype gives wins
                // over the content for both.
                run.window
                    .update(cx, |view, window, cx| {
                        for (button, root, thumb, name) in [
                            ("same-button", "same-switch", "same-switch-thumb", None),
                            ("named-button", "named-switch", "named-switch-thumb", Some("Named")),
                        ] {
                            view.open_session(button, config(button, "base-button", "Same"), cx);
                            for (session, config) in switch(root, thumb, "Same") {
                                view.open_session(session, config, cx);
                            }
                            let button_messages =
                                replayed("base-button-session.json", "enabled", ENABLED, button, name);
                            let root_messages =
                                replayed("base-switch-session.json", "root", SWITCH_OFF, root, name);
                            let thumb_messages = replayed(
                                "base-switch-session.json",
                                "thumb",
                                SWITCH_OFF_THUMB,
                                thumb,
                                None,
                            );
                            for message in button_messages
                                .into_iter()
                                .chain(root_messages)
                                .chain(thumb_messages)
                            {
                                view.receive(message, window, cx);
                            }
                        }
                        view.take_outbox();
                    })
                    .expect("the view opens more sessions");
                run.draw(cx);
                run.draw(cx);
                let named: Vec<(Option<String>, Option<String>)> = run
                    .tree(cx)
                    .into_iter()
                    .map(|(_, seen)| seen)
                    .filter(|seen| matches!(seen.title.as_deref(), Some("Same" | "Named")))
                    .map(|seen| (seen.role, seen.title))
                    .collect();
                let expected: Vec<(Option<String>, Option<String>)> = [
                    ("AXButton", "Same"),
                    ("AXCheckBox", "Same"),
                    ("AXButton", "Named"),
                    ("AXCheckBox", "Named"),
                ]
                .into_iter()
                .map(|(role, title)| (Some(role.to_string()), Some(title.to_string())))
                .collect();
                run.check(
                    "the same slot text names a Button and a Switch once each, and a text name wins",
                    named == expected,
                    &named,
                );

                // Replay the real Label peer's two source-bound recordings.
                // A Label remains a single visible StaticText node; no Button
                // role or Tab stop is invented to obtain an AccessKit action.
                let passive = recorded("base-label-session.json", "passive").0;
                let actionable = recorded("base-label-session.json", "actionable").0;
                let active_plan = actionable.iter().find_map(|message| match message {
                    PeerToHostMessage::ControlLabelPlan(plan) => plan.plan.clone(),
                    _ => None,
                }).expect("the real peer declares its Label lease");
                run.window.update(cx, |view, window, cx| {
                    // This window is 300px high. Earlier suites leave more
                    // than a viewport of rows, so retire those fixtures before
                    // capturing Labels rather than appending offscreen text.
                    for session_id in view.rendered_sessions() {
                        view.receive(PeerToHostMessage::SessionDisposed(proto_ui_host_protocol::messages::SessionDisposed { session_id }), window, cx);
                    }
                    view.open_session("label-passive", config("label-passive", "base-label-root", "Native passive label"), cx);
                    view.open_session("label-actionable", config("label-actionable", "base-label-root", "Native actionable label"), cx);
                    for message in passive.into_iter().chain(actionable) { view.receive(message, window, cx); }
                    view.take_outbox();
                }).expect("real Label projections replay");
                run.draw(cx);
                run.draw(cx);
                let labels: Vec<Seen> = run.with_role("AXStaticText", cx).into_iter().filter(|seen| seen.text_value.as_deref().is_some_and(|value| value.starts_with("Native "))).collect();
                run.check("Label is exactly one native text node for each caption", labels.len() == 2, &labels);
                let sessions = run.window.update(cx, |view, _, _| view.rendered_sessions()).expect("current sessions");
                run.check("the capture stage contains only the two Label fixtures", sessions.len() == 2 && sessions.iter().all(|id| id.starts_with("label-")), &sessions);
                run.capture("action-enabled", cx).await;
                // Capture yields to the main loop. Read fresh accessibility
                // objects rather than reusing pointers from before that await.
                run.draw(cx);
                let labels: Vec<Seen> = run.with_role("AXStaticText", cx).into_iter().filter(|seen| seen.text_value.as_deref().is_some_and(|value| value.starts_with("Native "))).collect();
                let passive = labels.iter().find(|seen| seen.text_value.as_deref() == Some("Native passive label")).expect("passive text");
                let actionable = labels.iter().find(|seen| seen.text_value.as_deref() == Some("Native actionable label")).expect("actionable text");
                let passive_accepted = run.press(passive, cx).await;
                let passive_out = run.window.update(cx, |view, _, _| view.take_outbox()).expect("outbox");
                run.check("passive Label offers no native press action", !passive_accepted && !passive_out.iter().any(|message| matches!(message, HostToPeerMessage::ControlLabelActivate(_))), &passive_out);
                let accepted = run.press(actionable, cx).await;
                let actions = run.window.update(cx, |view, _, _| view.take_outbox()).expect("outbox");
                let label_actions: Vec<_> = actions.iter().filter_map(|message| match message { HostToPeerMessage::ControlLabelActivate(action) => Some(action), _ => None }).collect();
                run.check("the native text action requests exactly one current Label activation", accepted && label_actions.len() == 1 && label_actions[0].session_id == "label-actionable" && label_actions[0].source == proto_ui_host_protocol::messages::ControlLabelActivationSource::Accessibility, &actions);
                run.window.update(cx, |view, window, cx| {
                    let mut plan = active_plan;
                    plan.activation = false;
                    view.receive(PeerToHostMessage::ControlLabelPlan(proto_ui_host_protocol::messages::ControlLabelPlanMessage { session_id: "label-actionable".into(), view_epoch: 1, plan: Some(plan) }), window, cx);
                    view.take_outbox();
                }).expect("activation is withdrawn");
                run.draw(cx);
                run.draw(cx);
                let now_passive = run.with_role("AXStaticText", cx).into_iter().find(|seen| seen.text_value.as_deref() == Some("Native actionable label")).expect("same current visible caption");
                let accepted = run.press(&now_passive, cx).await;
                let actions = run.window.update(cx, |view, _, _| view.take_outbox()).expect("outbox");
                run.check("disabling Label activation removes the native text action", !accepted && !actions.iter().any(|message| matches!(message, HostToPeerMessage::ControlLabelActivate(_))), &actions);
                run.capture("action-disabled", cx).await;

                if run.capture_failures.is_empty() {
                    println!("test result: ok. {} passed; 0 failed", run.passed);
                    process::exit(0);
                }
                println!("capture failures: {:?}", run.capture_failures);
                println!("test result: FAILED. {} passed; {} failed", run.passed, run.capture_failures.len());
                process::exit(1);
            })
            .detach();
        });
    }
}
