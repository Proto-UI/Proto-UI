//! Base Button in a real macOS window, read through the platform's
//! accessibility API.
//!
//! GPUI's test platform never starts AccessKit, so the headless suites cannot
//! see what the host reports. This opens a real window with `gpui_platform`,
//! replays Base Button and Base Toggle sessions the real peer recorded, and
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
    use serde_json::Value;

    const ENABLED: &str = "button-enabled";
    const DISABLED: &str = "button-disabled";
    const TOGGLE_OFF: &str = "toggle-inactive";
    const TOGGLE_ON: &str = "toggle-active";
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

    fn config(session: &str, prototype_key: &str, label: &str) -> SessionConfig {
        SessionConfig {
            instance_id: format!("{session}:instance"),
            prototype_key: prototype_key.into(),
            props: WireRecord::new(),
            slots: HashMap::from([(
                "slot-default".to_string(),
                vec![SurfaceChild::Text(label.to_string().into())],
            )]),
            root_style: StyleRefinement::default(),
            theme: None,
            parent: None,
        }
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
            into.push((
                depth,
                Seen {
                    role: string(role),
                    subrole: string(subrole),
                    title: string(title),
                    enabled,
                    number,
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
            let bounds = Bounds::centered(None, size(px(300.), px(120.)), cx);
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
                    {
                        view.receive(message, window, cx);
                    }
                    view.take_outbox();
                })
                .expect("the view replays the recording");

            cx.spawn(async move |cx| {
                let mut run = Run { window, passed: 0 };

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
                let toggles = run.with_role("AXCheckBox", cx);
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

                println!("test result: ok. {} passed; 0 failed", run.passed);
                process::exit(0);
            })
            .detach();
        });
    }
}
