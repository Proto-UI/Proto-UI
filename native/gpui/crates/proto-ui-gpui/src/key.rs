//! Translates GPUI keyboard input into the portable payload fields.
//!
//! A Prototype compares `ev.key` against `KeyboardEvent.key` values: `'Tab'`,
//! `'Enter'`, `'ArrowDown'`, `' '`. Those comparisons are the contract, and a
//! Web Adapter satisfies it by passing the browser's value through untouched.
//! GPUI spells the same keys differently (`escape`, `up`, `pageup`), so a host
//! on GPUI has to translate, and getting a single name wrong means a Prototype
//! silently stops responding to that key.
//!
//! The table below is the W3C UI Events key values, which is what a browser
//! produces and what the comparisons were written against. It is transcribed
//! rather than generated, because unlike the style tables it has no sibling
//! implementation in this repository that could drift from it.
//!
//! What *is* recorded is the other side: `native/gpui/fixtures/event-types.json`
//! carries every string this repository compares a `key` property against, and
//! `tests/key_names.rs` requires each one to either come out of this table or
//! be named as something other than keyboard input.

use gpui::{KeyDownEvent, KeyUpEvent, Keystroke, Modifiers};

/// The modifier flags a portable payload carries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PortableModifiers {
    /// `ctrlKey`.
    pub ctrl: bool,
    /// `metaKey`. The platform key: command on macOS, super elsewhere.
    pub meta: bool,
    /// `altKey`.
    pub alt: bool,
    /// `shiftKey`.
    pub shift: bool,
}

impl From<Modifiers> for PortableModifiers {
    fn from(modifiers: Modifiers) -> Self {
        Self {
            ctrl: modifiers.control,
            // GPUI's `platform` is command on macOS, the windows key on
            // Windows and super on Linux. That is exactly what the browser
            // reports as `metaKey`.
            meta: modifiers.platform,
            alt: modifiers.alt,
            shift: modifiers.shift,
        }
        // `Modifiers::function` has no `KeyboardEvent` counterpart and is
        // deliberately dropped: inventing a field would put something on the
        // wire that no Prototype can read.
    }
}

/// The keys the web spells differently from GPUI, as `(gpui, web)` pairs.
///
/// The GPUI names are the ones `gpui_macos::events::key_to_native` and
/// `Keystroke::parse` accept at the pinned revision. Function keys are handled
/// separately: they follow a rule rather than needing thirty-five entries.
pub const NAMED_KEYS: &[(&str, &str)] = &[
    ("space", " "),
    ("enter", "Enter"),
    ("tab", "Tab"),
    ("escape", "Escape"),
    ("up", "ArrowUp"),
    ("down", "ArrowDown"),
    ("left", "ArrowLeft"),
    ("right", "ArrowRight"),
    ("home", "Home"),
    ("end", "End"),
    ("pageup", "PageUp"),
    ("pagedown", "PageDown"),
    ("backspace", "Backspace"),
    ("delete", "Delete"),
    ("insert", "Insert"),
    ("back", "BrowserBack"),
    ("forward", "BrowserForward"),
    // GPUI's keystroke parser accepts a bare modifier as the key itself
    // (`Keystroke::parse("shift")`), and its simulated input then fills
    // `key_char` with the modifier's own name. Without these entries that name
    // would leak through as if it were a typed character.
    ("shift", "Shift"),
    ("control", "Control"),
    ("alt", "Alt"),
    ("platform", "Meta"),
    ("function", "Fn"),
];

/// The highest function key GPUI names.
const HIGHEST_FUNCTION_KEY: u8 = 35;

/// Translates a GPUI key name, for the keys the web spells differently.
pub fn named_key(gpui: &str) -> Option<String> {
    if let Some((_, web)) = NAMED_KEYS.iter().find(|(name, _)| *name == gpui) {
        return Some((*web).to_string());
    }
    // `f1` through `f35`. Parsed rather than listed so a new one cannot be
    // half-supported, and bounded so an arbitrary `f<n>` is not invented.
    if let Some(number) = gpui.strip_prefix('f') {
        if let Ok(index) = number.parse::<u8>() {
            if (1..=HIGHEST_FUNCTION_KEY).contains(&index) && !number.starts_with('0') {
                return Some(format!("F{index}"));
            }
        }
    }
    None
}

/// Translates a keystroke into the `key` value a portable payload carries.
///
/// `None` means this layer has no web spelling for the key. The caller reports
/// that rather than guessing, because a guessed name reaches a Prototype as a
/// key that never matches anything.
pub fn portable_key(keystroke: &Keystroke) -> Option<String> {
    // The named table comes first, and that ordering is load-bearing. GPUI
    // fills `key_char` for enter with `"\n"` and for space with `" "`, so
    // preferring the typed character would spell Enter as a newline.
    if let Some(named) = named_key(&keystroke.key) {
        return Some(named);
    }

    // For a printable key the web reports the character that would be typed,
    // which is what `key_char` holds: `A` for shift-a, `ß` for option-s.
    if let Some(typed) = keystroke.key_char.as_deref() {
        if !typed.is_empty() {
            return Some(typed.to_string());
        }
    }

    // GPUI's raw key is a printed or ASCII-equivalent physical spelling, not
    // necessarily the layout- and modifier-resolved character a browser uses.
    // Without a typed character, this layer cannot faithfully name it.
    None
}

/// The keyboard fields of a portable payload.
///
/// Exactly the fields `InputSample` carries for a key event, and nothing
/// more: no key code, no location, no physical key. The contract keeps the
/// portable payload to what a Prototype can compare against.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortableKeyFields {
    /// `key`.
    pub key: String,
    /// `ctrlKey`, `metaKey`, `altKey`, `shiftKey`.
    pub modifiers: PortableModifiers,
    /// `repeat`.
    pub repeat: bool,
}

/// The portable fields of a key press, or `None` when the key has no web
/// spelling (see [`portable_key`]).
pub fn from_key_down(event: &KeyDownEvent) -> Option<PortableKeyFields> {
    Some(PortableKeyFields {
        key: portable_key(&event.keystroke)?,
        modifiers: event.keystroke.modifiers.into(),
        // GPUI reports auto-repeat as `is_held`: the key was already down
        // when this press arrived. That is the browser's `repeat`.
        repeat: event.is_held,
    })
}

/// The portable fields of a key release.
///
/// A release never repeats, which matches the browser: `repeat` is only ever
/// true on a keydown.
pub fn from_key_up(event: &KeyUpEvent) -> Option<PortableKeyFields> {
    Some(PortableKeyFields {
        key: portable_key(&event.keystroke)?,
        modifiers: event.keystroke.modifiers.into(),
        repeat: false,
    })
}
