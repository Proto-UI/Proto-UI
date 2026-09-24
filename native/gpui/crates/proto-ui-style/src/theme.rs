//! Design-language theme variables for a host without CSS custom properties.
//!
//! Tokens resolve to declarations that reference variables — `bg-background`
//! becomes `background-color: var(--pui-background)` — so a host needs the
//! variable map before it has a colour. The map is recorded the same way the
//! token vocabulary is: by running the TypeScript renderer and embedding its
//! output, so there is one source of truth.
//!
//! Values are kept verbatim. Colour-space conversion (`lab(...)` to sRGB) and
//! arithmetic (`calc`, `max`) are ordinary, well-specified operations rather
//! than Proto UI semantics, so they belong to whoever paints, not here.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::Deserialize;

const THEME_FIXTURE: &str = include_str!("../../../fixtures/theme-tokens.json");

#[derive(Debug, Deserialize)]
struct ThemeFixture {
    themes: BTreeMap<String, ThemeModes>,
}

#[derive(Debug, Deserialize)]
struct ThemeModes {
    light: BTreeMap<String, String>,
    dark: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorScheme {
    Light,
    Dark,
}

impl ColorScheme {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "light" => Some(Self::Light),
            "dark" => Some(Self::Dark),
            _ => None,
        }
    }
}

/// One design language in one colour scheme.
pub struct Theme {
    variables: BTreeMap<String, String>,
}

/// How deep a `var()` chain may nest before it is treated as a defect.
/// `--pui-radius-md` referencing `--pui-radius` is one level; nothing in the
/// recorded themes goes further, so this only bounds a malformed input.
const MAX_SUBSTITUTION_DEPTH: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Substitution {
    /// Every reference resolved. The value may still contain `calc`/`max`.
    Resolved(String),
    /// A referenced variable is absent and had no fallback.
    Missing { variable: String },
    /// The chain exceeded [`MAX_SUBSTITUTION_DEPTH`], which a cycle would do.
    TooDeep,
}

impl Theme {
    pub fn variable(&self, name: &str) -> Option<&str> {
        self.variables.get(name).map(String::as_str)
    }

    pub fn len(&self) -> usize {
        self.variables.len()
    }

    pub fn is_empty(&self) -> bool {
        self.variables.is_empty()
    }

    /// Substitutes every `var(--name)` and `var(--name, fallback)` in a value.
    ///
    /// A missing variable with no fallback is reported rather than replaced by
    /// an empty string: an empty paint value is a silent wrong colour, which
    /// is the failure this distinguishes.
    pub fn substitute(&self, value: &str) -> Substitution {
        self.substitute_inner(value, 0)
    }

    fn substitute_inner(&self, value: &str, depth: usize) -> Substitution {
        if depth > MAX_SUBSTITUTION_DEPTH {
            return Substitution::TooDeep;
        }
        let Some(start) = value.find("var(") else {
            return Substitution::Resolved(value.to_string());
        };

        // Find the matching close paren: a fallback may itself contain var().
        let mut depth_paren = 0usize;
        let mut end = None;
        for (offset, character) in value[start..].char_indices() {
            match character {
                '(' => depth_paren += 1,
                ')' => {
                    depth_paren -= 1;
                    if depth_paren == 0 {
                        end = Some(start + offset);
                        break;
                    }
                }
                _ => {}
            }
        }
        let Some(end) = end else {
            // Unbalanced input is not a reference; leave it alone.
            return Substitution::Resolved(value.to_string());
        };

        let inner = &value[start + 4..end];
        let (name, fallback) = match inner.find(',') {
            Some(index) => (inner[..index].trim(), Some(inner[index + 1..].trim())),
            None => (inner.trim(), None),
        };

        let replacement = match self.variable(name) {
            Some(found) => found.to_string(),
            None => match fallback {
                // An empty fallback is what the ring properties use to mean
                // "contribute nothing", so it is a valid resolution.
                Some(text) => text.to_string(),
                None => {
                    return Substitution::Missing {
                        variable: name.to_string(),
                    }
                }
            },
        };

        let rebuilt = format!("{}{}{}", &value[..start], replacement, &value[end + 1..]);
        self.substitute_inner(&rebuilt, depth + 1)
    }
}

pub struct ThemeCatalog {
    themes: BTreeMap<String, (Theme, Theme)>,
}

static CATALOG: OnceLock<ThemeCatalog> = OnceLock::new();

pub fn themes() -> &'static ThemeCatalog {
    CATALOG.get_or_init(|| {
        let fixture: ThemeFixture =
            serde_json::from_str(THEME_FIXTURE).expect("the compiled-in theme fixture must parse");
        ThemeCatalog {
            themes: fixture
                .themes
                .into_iter()
                .map(|(name, modes)| {
                    (
                        name,
                        (
                            Theme {
                                variables: modes.light,
                            },
                            Theme {
                                variables: modes.dark,
                            },
                        ),
                    )
                })
                .collect(),
        }
    })
}

impl ThemeCatalog {
    /// Design languages present in the recorded catalog.
    pub fn names(&self) -> Vec<&str> {
        self.themes.keys().map(String::as_str).collect()
    }

    pub fn get(&self, design_language: &str, scheme: ColorScheme) -> Option<&Theme> {
        let (light, dark) = self.themes.get(design_language)?;
        Some(match scheme {
            ColorScheme::Light => light,
            ColorScheme::Dark => dark,
        })
    }
}
