//! Resolves Proto UI style tokens to declarations for a host without CSS.
//!
//! # Why this is a lookup and not a second compiler
//!
//! Proto UI's `tw(...)` tokens are an intermediate representation; the entire
//! vocabulary lives in `packages/cli/src/services/proto-style-css.ts`. This
//! crate deliberately does **not** re-derive that vocabulary in Rust. It reads
//! `native/gpui/fixtures/style-tokens.json`, which is produced by running that
//! compiler and is kept current by `pnpm check:gpui-style-fixture` inside the
//! repository's trusted test job.
//!
//! Re-implementing the spacing scale, the colour table and the four dynamic
//! families here would create exactly the second source of truth the fixture
//! exists to prevent: the two could disagree, and nothing would say which was
//! right. The cost of the lookup is that a token the TypeScript compiler has
//! never emitted is not resolvable — which is why [`Resolution::Unknown`]
//! exists and why callers must not treat it as "no style".
//!
//! # What is deliberately absent
//!
//! *State variants.* Author-time tokens cannot carry a `:` variant, and
//! variants are produced by the Web-only `rule-expose-state-web` lowering. A
//! host with no selectors never receives them: its Rules stay on the default
//! plan and evaluate to a flat token list.
//!
//! *Semantic merge.* Last-wins merging by semantic group happens in the
//! Feedback module before the tokens cross the wire, so the host receives an
//! already-merged list. [`resolve_all`] still applies later-wins per property,
//! which is composition of the resolved result, not a second merge policy.

pub mod color;
pub mod length;
pub mod theme;

pub use color::{parse as parse_color, ColorError, ColorValue, Rgba};
pub use length::{evaluate as evaluate_length, Dimension, LengthContext, LengthError};

pub use theme::{themes, ColorScheme, Substitution, Theme, ThemeCatalog};

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::Deserialize;

/// The fixture is compiled in: the crate must not depend on a file being
/// present at run time, and the CI gate already proves it is current.
const FIXTURE: &str = include_str!("../../../fixtures/style-tokens.json");

#[derive(Debug, Deserialize)]
struct Fixture {
    tokens: BTreeMap<String, BTreeMap<String, String>>,
    order: Vec<String>,
    #[serde(rename = "noDeclarations")]
    no_declarations: Vec<String>,
}

/// What a single token resolves to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Resolution<'a> {
    /// The token carries declarations.
    Declarations(&'a BTreeMap<String, String>),
    /// The token is a marker the Web side uses for selector targeting and
    /// carries no declarations. Ignoring it is correct.
    NoDeclarations,
    /// The token is not in the vocabulary. The TypeScript compiler emits
    /// nothing for a marker *and* for a token it has never heard of, so this
    /// crate keeps the two apart: an unknown token is a defect to report, not
    /// something to render unstyled.
    Unknown,
}

pub struct StyleVocabulary {
    tokens: BTreeMap<String, BTreeMap<String, String>>,
    markers: BTreeMap<String, ()>,
    /// Position of each token in the compiler's emission order, which is the
    /// order the cascade applies them in.
    order: BTreeMap<String, usize>,
}

static VOCABULARY: OnceLock<StyleVocabulary> = OnceLock::new();

/// The compiled-in vocabulary.
pub fn vocabulary() -> &'static StyleVocabulary {
    VOCABULARY.get_or_init(|| {
        let fixture: Fixture =
            serde_json::from_str(FIXTURE).expect("the compiled-in style fixture must parse");
        StyleVocabulary {
            tokens: fixture.tokens,
            markers: fixture
                .no_declarations
                .into_iter()
                .map(|token| (token, ()))
                .collect(),
            order: fixture
                .order
                .into_iter()
                .enumerate()
                .map(|(index, token)| (token, index))
                .collect(),
        }
    })
}

impl StyleVocabulary {
    /// Number of tokens that carry declarations.
    pub fn len(&self) -> usize {
        self.tokens.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tokens.is_empty()
    }

    /// Tokens accepted but carrying no declarations.
    pub fn marker_count(&self) -> usize {
        self.markers.len()
    }

    /// Every token that carries declarations, for exhaustive checks.
    pub fn tokens_with_declarations(
        &self,
    ) -> impl Iterator<Item = (&String, &BTreeMap<String, String>)> {
        self.tokens.iter()
    }

    pub fn resolve(&self, token: &str) -> Resolution<'_> {
        if let Some(declarations) = self.tokens.get(token) {
            return Resolution::Declarations(declarations);
        }
        if self.markers.contains_key(token) {
            return Resolution::NoDeclarations;
        }
        Resolution::Unknown
    }

    /// Position of a token in the cascade, for composing several of them.
    pub fn cascade_position(&self, token: &str) -> Option<usize> {
        self.order.get(token).copied()
    }

    /// Resolves a token list into one declaration set.
    ///
    /// Composition follows the compiler's emission order, not the order the
    /// tokens arrived in, because that emission order *is* the cascade. The
    /// compiler deliberately emits `leading-*` after the composite `text-*`
    /// utilities and `duration-*` / `ease-*` / `delay-*` after `transition-*`,
    /// so an explicit override beats the composite whichever way an author
    /// wrote them. Applying arrival order instead would let `text-sm` after
    /// `leading-none` overwrite the explicit line height, which the Web does
    /// not do.
    ///
    /// Same-group tokens such as `px-3` and `px-2` never reach a host together:
    /// the Feedback module's semantic merge collapses them by author order
    /// before they cross the wire.
    ///
    /// Unknown tokens are collected rather than dropped: a caller decides
    /// whether to fail or to report a diagnostic, and neither choice should be
    /// made silently here.
    pub fn resolve_all<'a, I>(&self, tokens: I) -> ResolvedStyle
    where
        I: IntoIterator<Item = &'a str>,
    {
        let mut ordered: Vec<&str> = tokens.into_iter().collect();
        // A stable sort keeps arrival order among tokens the compiler never
        // emitted, which are reported rather than applied anyway.
        ordered.sort_by_key(|token| self.cascade_position(token).unwrap_or(usize::MAX));

        let mut declarations = BTreeMap::new();
        let mut unknown = Vec::new();
        for token in ordered {
            match self.resolve(token) {
                Resolution::Declarations(entries) => {
                    for (property, value) in entries {
                        declarations.insert(property.clone(), value.clone());
                    }
                }
                Resolution::NoDeclarations => {}
                Resolution::Unknown => unknown.push(token.to_string()),
            }
        }
        ResolvedStyle {
            declarations,
            unknown,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ResolvedStyle {
    pub declarations: BTreeMap<String, String>,
    /// Tokens the vocabulary does not contain, in the order they appeared.
    pub unknown: Vec<String>,
}

impl ResolvedStyle {
    pub fn get(&self, property: &str) -> Option<&str> {
        self.declarations.get(property).map(String::as_str)
    }
}
