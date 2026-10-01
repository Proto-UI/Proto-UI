//! Drives real GPUI keyboard dispatch and checks what a Prototype would see.
//!
//! A lookup-table test would only prove the table agrees with itself. These
//! tests dispatch through a GPUI window, including the simulated-input step
//! that fills `key_char`, so the ordering traps in the translation (Enter
//! arriving with `key_char == "\n"`) are exercised the way they occur.

use std::cell::RefCell;
use std::fs;
use std::path::Path;
use std::rc::Rc;

use gpui::prelude::*;
use gpui::{
    div, px, size, AnyWindowHandle, Context, FocusHandle, KeyDownEvent, KeyUpEvent, Keystroke,
    PlatformInput, TestAppContext, Window,
};
use proto_ui_gpui::key::{
    from_key_down, from_key_up, named_key, portable_key, PortableModifiers, NAMED_KEYS,
};
use serde::Deserialize;

/// Records every key event that reaches a focused element.
struct KeyProbe {
    focus: FocusHandle,
    downs: Rc<RefCell<Vec<KeyDownEvent>>>,
    ups: Rc<RefCell<Vec<KeyUpEvent>>>,
}

impl Render for KeyProbe {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        let downs = self.downs.clone();
        let ups = self.ups.clone();
        div()
            .track_focus(&self.focus)
            .size_full()
            .on_key_down(move |event, _, _| downs.borrow_mut().push(event.clone()))
            .on_key_up(move |event, _, _| ups.borrow_mut().push(event.clone()))
    }
}

struct Harness {
    window: AnyWindowHandle,
    downs: Rc<RefCell<Vec<KeyDownEvent>>>,
    ups: Rc<RefCell<Vec<KeyUpEvent>>>,
}

impl Harness {
    fn open(cx: &mut TestAppContext) -> Self {
        let downs = Rc::new(RefCell::new(Vec::new()));
        let ups = Rc::new(RefCell::new(Vec::new()));
        let (probe_downs, probe_ups) = (downs.clone(), ups.clone());
        let window = cx.open_window(size(px(200.), px(200.)), move |window, cx| {
            let focus = cx.focus_handle();
            window.focus(&focus, cx);
            KeyProbe {
                focus,
                downs: probe_downs,
                ups: probe_ups,
            }
        });
        let window = AnyWindowHandle::from(window);
        // Key events route through the dispatch tree a paint builds; without a
        // draw the focused element is not in it and nothing is delivered.
        cx.update_window(window, |_, window, cx| window.draw(cx).clear(cx))
            .expect("the window draws");
        Self { window, downs, ups }
    }

    /// Presses one keystroke through GPUI's own simulated input path.
    fn press(&self, cx: &mut TestAppContext, keystroke: &str) -> KeyDownEvent {
        let before = self.downs.borrow().len();
        cx.simulate_keystrokes(self.window, keystroke);
        let downs = self.downs.borrow();
        assert_eq!(
            downs.len(),
            before + 1,
            "`{keystroke}` should deliver exactly one key press"
        );
        downs.last().cloned().expect("a key press was recorded")
    }

    /// Dispatches a raw platform event, for what the simulated path cannot
    /// express: a held key and a release.
    fn dispatch(&self, cx: &mut TestAppContext, event: PlatformInput) {
        cx.update_window(self.window, |_, window, cx| {
            window.dispatch_event(event, cx);
        })
        .expect("the window dispatches");
    }
}

fn web_key(event: &KeyDownEvent) -> String {
    from_key_down(event)
        .unwrap_or_else(|| panic!("`{}` has no portable key", event.keystroke.key))
        .key
}

#[gpui::test]
fn every_named_key_reaches_a_prototype_with_its_web_spelling(cx: &mut TestAppContext) {
    let harness = Harness::open(cx);
    for (gpui_name, web_name) in NAMED_KEYS {
        let event = harness.press(cx, gpui_name);
        assert_eq!(
            web_key(&event),
            *web_name,
            "GPUI `{gpui_name}` must reach a Prototype as `{web_name}`"
        );
    }
}

#[gpui::test]
fn enter_tab_and_space_are_named_although_gpui_fills_a_typed_character(cx: &mut TestAppContext) {
    // The trap, observed rather than assumed: GPUI's simulated input fills
    // `key_char` for these three. A translation that preferred the typed
    // character would deliver Enter as a newline and Tab as a tab character.
    let harness = Harness::open(cx);
    for (gpui_name, typed, web_name) in [
        ("enter", "\n", "Enter"),
        ("tab", "\t", "Tab"),
        ("space", " ", " "),
    ] {
        let event = harness.press(cx, gpui_name);
        assert_eq!(event.keystroke.key_char.as_deref(), Some(typed));
        assert_eq!(web_key(&event), web_name);
    }
}

#[gpui::test]
fn a_shifted_letter_reports_the_character_it_types(cx: &mut TestAppContext) {
    let harness = Harness::open(cx);
    let event = harness.press(cx, "shift-a");
    let fields = from_key_down(&event).expect("a letter has a portable key");
    // The browser's `key` is the produced character, so shift-a is `A`.
    assert_eq!(fields.key, "A");
    assert!(fields.modifiers.shift);
}

#[gpui::test]
fn a_control_shifted_printable_without_key_char_is_not_guessed(cx: &mut TestAppContext) {
    // The pinned GPUI parser stores ctrl-shift-v as the lowercase physical
    // spelling and does not provide the typed character. That is insufficient
    // to reconstruct KeyboardEvent.key across layouts; do not emit `v`.
    let harness = Harness::open(cx);
    let event = harness.press(cx, "ctrl-shift-v");
    assert_eq!(event.keystroke.key, "v");
    assert_eq!(event.keystroke.key_char, None);
    assert!(event.keystroke.modifiers.control);
    assert!(event.keystroke.modifiers.shift);
    assert_eq!(portable_key(&event.keystroke), None);
    assert!(from_key_down(&event).is_none());
}

#[gpui::test]
fn modifier_flags_preserve_browser_meaning_even_when_key_is_unavailable(cx: &mut TestAppContext) {
    let harness = Harness::open(cx);
    for (chord, expected) in [
        (
            "ctrl-x",
            PortableModifiers {
                ctrl: true,
                ..Default::default()
            },
        ),
        (
            "cmd-x",
            PortableModifiers {
                meta: true,
                ..Default::default()
            },
        ),
        (
            "alt-x",
            PortableModifiers {
                alt: true,
                ..Default::default()
            },
        ),
        (
            "shift-tab",
            PortableModifiers {
                shift: true,
                ..Default::default()
            },
        ),
    ] {
        let event = harness.press(cx, chord);
        assert_eq!(
            PortableModifiers::from(event.keystroke.modifiers),
            expected,
            "`{chord}`"
        );
    }

    // Shift-Tab is a named key, so it still produces a complete portable
    // payload with both the key and its modifier.
    let back = harness.press(cx, "shift-tab");
    let fields = from_key_down(&back).expect("Tab has a named portable spelling");
    assert_eq!(fields.key, "Tab");
    assert!(fields.modifiers.shift);
}

#[gpui::test]
fn a_bare_modifier_does_not_leak_its_name_as_a_character(cx: &mut TestAppContext) {
    // `Keystroke::parse("shift")` makes shift the key, and the simulated input
    // then fills `key_char` with the literal text `shift`.
    let harness = Harness::open(cx);
    let event = harness.press(cx, "shift");
    assert_eq!(event.keystroke.key_char.as_deref(), Some("shift"));
    assert_eq!(web_key(&event), "Shift");
}

#[gpui::test]
fn a_held_key_arrives_as_a_repeat_and_a_release_never_does(cx: &mut TestAppContext) {
    let harness = Harness::open(cx);
    let keystroke = Keystroke::parse("down").expect("a valid keystroke");

    harness.dispatch(
        cx,
        PlatformInput::KeyDown(KeyDownEvent {
            keystroke: keystroke.clone(),
            is_held: true,
            prefer_character_input: false,
        }),
    );
    let held = harness.downs.borrow().last().cloned().expect("delivered");
    let fields = from_key_down(&held).expect("down has a portable key");
    assert_eq!(fields.key, "ArrowDown");
    assert!(fields.repeat, "`is_held` is the browser's `repeat`");

    harness.dispatch(cx, PlatformInput::KeyUp(KeyUpEvent { keystroke }));
    let released = harness.ups.borrow().last().cloned().expect("delivered");
    let fields = from_key_up(&released).expect("down has a portable key");
    assert_eq!(fields.key, "ArrowDown");
    assert!(!fields.repeat, "a release is never a repeat");
}

#[test]
fn function_keys_follow_the_rule_inside_gpuis_range_only() {
    assert_eq!(named_key("f1").as_deref(), Some("F1"));
    assert_eq!(named_key("f12").as_deref(), Some("F12"));
    assert_eq!(named_key("f35").as_deref(), Some("F35"));
    // Past GPUI's highest function key, a leading zero, and a bare `f` are
    // not function keys; inventing `F36` would name a key nothing produces.
    assert_eq!(named_key("f36"), None);
    assert_eq!(named_key("f0"), None);
    assert_eq!(named_key("f01"), None);
    assert_eq!(named_key("f"), None);
}

#[test]
fn an_unknown_multi_character_key_is_reported_not_guessed() {
    let keystroke = Keystroke {
        modifiers: Default::default(),
        key: "capslock".into(),
        key_char: None,
    };
    assert_eq!(portable_key(&keystroke), None);
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventFixture {
    compared_keys: Vec<String>,
}

/// Strings the repository compares a `key` property against that are not
/// keyboard input. Each needs a reason; an unexplained entry is a key this
/// host would silently fail to produce.
// `typeof patch.key !== 'undefined'` is a property-presence check, not a comparison
// against the value a keyboard event exposes as `key`.
const NOT_A_KEYBOARD_KEY: &[(&str, &str)] = &[(
    "colorScheme",
    "the meta key of a Rule dependency, compared in packages/modules/rule-meta/src/create.ts",
)];

/// Keys whose consumers are known, so a scan that misses them is broken.
///
/// The scan is a superset check, and a superset check passes vacuously when it
/// finds too little. These are read by focus traversal, activation, dismissal
/// and roving navigation respectively; the first scan written for this test
/// missed `Enter` because it looked in the wrong directory.
const MUST_BE_FOUND: &[&str] = &["Tab", "Enter", " ", "Escape", "ArrowDown", "Home", "End"];

fn compared_keys() -> Vec<String> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/event-types.json");
    let text = fs::read_to_string(path).expect("the event fixture reads");
    let fixture: EventFixture = serde_json::from_str(&text).expect("the event fixture parses");
    fixture.compared_keys
}

#[gpui::test]
fn every_key_a_prototype_compares_against_is_delivered_with_that_spelling(cx: &mut TestAppContext) {
    let compared = compared_keys();
    for required in MUST_BE_FOUND {
        assert!(
            compared.iter().any(|key| key == required),
            "the scan did not find `{required}`; its roots are probably wrong"
        );
    }
    for (entry, _) in NOT_A_KEYBOARD_KEY {
        assert!(
            compared.iter().any(|key| key == entry),
            "`{entry}` is no longer compared anywhere; remove it from the list"
        );
    }

    let harness = Harness::open(cx);
    for key in &compared {
        if NOT_A_KEYBOARD_KEY.iter().any(|(entry, _)| entry == key) {
            continue;
        }
        // Find the GPUI name that should produce this web spelling, then
        // press it for real and read back what a Prototype would receive.
        let gpui_name = NAMED_KEYS
            .iter()
            .find(|(_, web)| web == key)
            .map(|(gpui, _)| (*gpui).to_string())
            .or_else(|| (key.chars().count() == 1).then(|| key.clone()))
            .unwrap_or_else(|| {
                panic!(
                    "`{key}` is compared by a Prototype but no GPUI key produces it; \
                     add it to the table or to NOT_A_KEYBOARD_KEY with a reason"
                )
            });
        let event = harness.press(cx, &gpui_name);
        assert_eq!(&web_key(&event), key, "pressing GPUI `{gpui_name}`");
    }
}
