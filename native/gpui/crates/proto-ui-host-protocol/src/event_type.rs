//! The event type vocabulary, version 0.
//!
//! Mirrors `packages/types/src/event.ts`. The mirror is not transcribed: the
//! fixture in `native/gpui/fixtures/event-types.json` is generated from that
//! file and replayed by `tests/event_types.rs`, so adding a type on one side
//! without the other fails a test rather than producing a host that silently
//! ignores it.
//!
//! Three layers, and no fourth. Core types are the ones every Adapter must
//! produce. Optional types an Adapter may omit. Extension types carry the
//! `host:` prefix and are host-local by contract, which is why a host may
//! define them freely while the semantic layers stay closed.

use std::fmt;

/// The prefix an extension type must carry, and must exceed.
pub const EXTENSION_PREFIX: &str = "host:";

macro_rules! semantic_events {
    ($name:ident, $doc:literal, { $($variant:ident => $text:literal),+ $(,)? }) => {
        #[doc = $doc]
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
        pub enum $name {
            $(
                #[doc = concat!("`", $text, "`")]
                $variant,
            )+
        }

        impl $name {
            /// Every variant, in the order the vocabulary declares them.
            pub const ALL: &'static [Self] = &[$(Self::$variant),+];

            /// The wire spelling.
            pub const fn as_str(self) -> &'static str {
                match self {
                    $(Self::$variant => $text),+
                }
            }

            /// Parses the wire spelling.
            pub fn parse(text: &str) -> Option<Self> {
                match text {
                    $($text => Some(Self::$variant),)+
                    _ => None,
                }
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(self.as_str())
            }
        }
    };
}

semantic_events!(
    CoreEvent,
    "An event type every Adapter must produce.\n\nThe press family is an activation-intent lifecycle, not an alias for any\nhost event. `C-EVENT-TYPE-0002` forbids defining these as a host event by\nanother name, which is why a host decides for itself what counts as a press.",
    {
        PressStart => "press.start",
        PressEnd => "press.end",
        PressCancel => "press.cancel",
        PressCommit => "press.commit",
        KeyDown => "key.down",
        KeyUp => "key.up",
    }
);

semantic_events!(
    OptionalEvent,
    "An event type an Adapter may omit.\n\nOmitting one is a declared gap rather than a silent absence: a Prototype\nthat needs it sees the capability missing instead of an event that never\narrives.",
    {
        PointerDown => "pointer.down",
        PointerMove => "pointer.move",
        PointerUp => "pointer.up",
        PointerCancel => "pointer.cancel",
        PointerEnter => "pointer.enter",
        PointerLeave => "pointer.leave",
        NavFocus => "nav.focus",
        NavBlur => "nav.blur",
        TextFocus => "text.focus",
        TextBlur => "text.blur",
        Input => "input",
        Change => "change",
        ContextMenu => "context.menu",
    }
);

/// A host-local event type, carrying the `host:` prefix.
///
/// The prefix must be exceeded, not merely matched: `host:` alone is not a
/// type. The stored string keeps the prefix so the wire spelling needs no
/// reassembly.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ExtensionEvent(String);

impl ExtensionEvent {
    /// The wire spelling, including the prefix.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// The part after `host:`, which is never empty.
    pub fn suffix(&self) -> &str {
        &self.0[EXTENSION_PREFIX.len()..]
    }
}

impl fmt::Display for ExtensionEvent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// A validated event type.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum EventType {
    /// One every Adapter must produce.
    Core(CoreEvent),
    /// One an Adapter may omit.
    Optional(OptionalEvent),
    /// A host-local one.
    Extension(ExtensionEvent),
}

/// A string that is not an event type.
///
/// One variant, deliberately. The TypeScript validator returns a boolean and
/// draws no finer distinction, so categorising the failure here would be a
/// second opinion about the rules rather than a mirror of them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvalidEventType {
    /// The string that was offered.
    pub input: String,
}

impl fmt::Display for InvalidEventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "`{}` is not an event type", self.input)
    }
}

impl std::error::Error for InvalidEventType {}

impl EventType {
    /// Parses a wire spelling.
    pub fn parse(text: &str) -> Result<Self, InvalidEventType> {
        if let Some(core) = CoreEvent::parse(text) {
            return Ok(Self::Core(core));
        }
        if let Some(optional) = OptionalEvent::parse(text) {
            return Ok(Self::Optional(optional));
        }
        // The prefix must be exceeded. `host:` on its own is not a type, which
        // is why this checks the length rather than only the prefix.
        if text.len() > EXTENSION_PREFIX.len() && text.starts_with(EXTENSION_PREFIX) {
            return Ok(Self::Extension(ExtensionEvent(text.to_string())));
        }
        Err(InvalidEventType {
            input: text.to_string(),
        })
    }

    /// The wire spelling.
    pub fn as_str(&self) -> &str {
        match self {
            Self::Core(core) => core.as_str(),
            Self::Optional(optional) => optional.as_str(),
            Self::Extension(extension) => extension.as_str(),
        }
    }

    /// Whether this type is host-local.
    ///
    /// The distinction is load-bearing beyond naming: only an extension type
    /// may carry host listener options, and only an extension type delivers a
    /// raw host event rather than a portable payload.
    pub fn is_extension(&self) -> bool {
        matches!(self, Self::Extension(_))
    }
}

impl fmt::Display for EventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}
