//! Maps recorded declarations onto GPUI styles.
//!
//! The completeness test is the important one: it walks every token in the
//! vocabulary and pins down exactly which properties do not reach a
//! `StyleRefinement` yet. That list is an explicit inventory of remaining
//! work, and a property leaving or joining it fails the test rather than
//! quietly changing what a surface paints.

use std::collections::BTreeSet;

use gpui::{AbsoluteLength, DefiniteLength, Display, Length, Position};
use proto_ui_gpui::style::{map, Unmapped};
use proto_ui_style::length::LengthContext;
use proto_ui_style::{themes, vocabulary, ColorScheme, Substitution};

fn resolve(tokens: &[&str], language: &str) -> proto_ui_style::ResolvedStyle {
    let theme = themes()
        .get(language, ColorScheme::Light)
        .expect("theme present");
    let mut resolved = vocabulary().resolve_all(tokens.iter().copied());
    for value in resolved.declarations.values_mut() {
        if let Substitution::Resolved(substituted) = theme.substitute(value) {
            *value = substituted;
        }
    }
    resolved
}

#[test]
fn maps_layout_and_box_properties() {
    let mapped = map(
        &resolve(
            &["flex", "flex-col", "items-center", "px-3", "py-1", "gap-2"],
            "shadcn",
        ),
        LengthContext::default(),
    );
    let style = &mapped.refinement;

    assert_eq!(style.display, Some(Display::Flex));
    assert_eq!(style.flex_direction, Some(gpui::FlexDirection::Column));
    assert_eq!(style.align_items, Some(gpui::AlignItems::Center));

    // 0.75rem and 0.25rem at the default root size.
    assert_eq!(
        style.padding.left,
        Some(DefiniteLength::Absolute(AbsoluteLength::Pixels(gpui::px(
            12.0
        ))))
    );
    assert_eq!(
        style.padding.top,
        Some(DefiniteLength::Absolute(AbsoluteLength::Pixels(gpui::px(
            4.0
        ))))
    );
    assert_eq!(
        style.gap.width,
        Some(DefiniteLength::Absolute(AbsoluteLength::Pixels(gpui::px(
            8.0
        ))))
    );
    assert!(
        mapped.unmapped_properties().is_empty(),
        "{:?}",
        mapped.unmapped
    );
}

#[test]
fn maps_a_percentage_to_a_fraction_and_keeps_position() {
    let mapped = map(
        &resolve(&["absolute", "w-full", "left-1/2"], "shadcn"),
        LengthContext::default(),
    );
    let style = &mapped.refinement;

    assert_eq!(style.position, Some(Position::Absolute));
    assert_eq!(
        style.size.width,
        Some(Length::Definite(DefiniteLength::Fraction(1.0)))
    );
    assert_eq!(
        style.inset.left,
        Some(Length::Definite(DefiniteLength::Fraction(0.5)))
    );
}
#[test]
fn maps_font_family_fallbacks_as_distinct_candidates() {
    let mapped = map(
        &declared(&[(
            "font-family",
            "ui-monospace, SFMono-Regular, Menlo, \"Liberation Mono\", monospace",
        )]),
        LengthContext::default(),
    );
    assert_eq!(
        mapped.refinement.text.font_family.as_deref(),
        Some("ui-monospace")
    );
    assert_eq!(
        mapped
            .refinement
            .text
            .font_fallbacks
            .as_ref()
            .unwrap()
            .fallback_list(),
        ["SFMono-Regular", "Menlo", "Liberation Mono", "monospace"]
    );
    assert!(mapped.is_complete(), "unexpected: {:?}", mapped.unmapped);
}

#[test]
fn static_position_ignores_insets_and_fixed_position_fails_closed() {
    let static_style = map(
        &declared(&[("position", "static"), ("top", "1rem"), ("left", "2px")]),
        LengthContext::default(),
    );
    assert_eq!(static_style.refinement.position, None);
    assert!(static_style.unmapped.iter().any(|(p, v, reason)| {
        p == "position" && v == "static" && *reason == Unmapped::UnsupportedValue
    }));
    assert_eq!(static_style.refinement.inset.top, None);
    assert_eq!(static_style.refinement.inset.left, None);

    let implicit_static = map(&declared(&[("top", "1rem")]), LengthContext::default());
    assert_eq!(implicit_static.refinement.inset.top, None);
    assert!(implicit_static.is_complete());

    let fixed = map(
        &declared(&[("position", "fixed"), ("top", "1rem")]),
        LengthContext::default(),
    );
    assert_eq!(fixed.refinement.position, None);
    assert_eq!(fixed.refinement.inset.top, None);
    assert!(fixed.unmapped.iter().any(|(p, v, reason)| {
        p == "position" && v == "fixed" && *reason == Unmapped::UnsupportedValue
    }));
    assert!(fixed.unmapped.iter().any(|(p, v, reason)| {
        p == "top" && v == "1rem" && *reason == Unmapped::UnsupportedValue
    }));
}

#[test]
fn keeps_overflow_clip_distinct_from_hidden() {
    let clip = map(&declared(&[("overflow", "clip")]), LengthContext::default());
    assert_eq!(clip.refinement.overflow.x, Some(gpui::Overflow::Clip));
    assert_eq!(clip.refinement.overflow.y, Some(gpui::Overflow::Clip));
}

#[test]
fn unsupported_flex_basis_does_not_partially_mutate_the_style() {
    let mapped = map(
        &declared(&[("flex", "2 3 fit-content")]),
        LengthContext::default(),
    );
    assert_eq!(mapped.refinement.flex_grow, None);
    assert_eq!(mapped.refinement.flex_shrink, None);
    assert_eq!(mapped.refinement.flex_basis, None);
    assert!(mapped.unmapped.iter().any(|(p, v, reason)| {
        p == "flex" && v == "2 3 fit-content" && *reason == Unmapped::UnsupportedValue
    }));
}
#[test]
fn maps_colour_through_the_theme_of_each_design_language() {
    // The expected values are stated independently of the pipeline: Brutalist
    // authors `--background: #f5f5f5` and Shadcn authors `lab(100% 0 0)`,
    // which is pure white. Landing on them exercises token lookup, theme
    // substitution, colour parsing and the conversion to GPUI in one go.
    let expected_brutalist: gpui::Hsla = gpui::Rgba {
        r: 245.0 / 255.0,
        g: 245.0 / 255.0,
        b: 245.0 / 255.0,
        a: 1.0,
    }
    .into();

    let brutalist = map(
        &resolve(&["bg-background"], "brutalist"),
        LengthContext::default(),
    );
    assert_eq!(
        brutalist.refinement.background,
        Some(gpui::Fill::Color(expected_brutalist.into()))
    );

    // That `lab(100% 0 0)` is white is pinned one layer down, in the colour
    // suite. What matters here is that the plumbing reaches GPUI and that the
    // two design languages do not collapse onto one value.
    let shadcn = map(
        &resolve(&["bg-background"], "shadcn"),
        LengthContext::default(),
    );

    // The two design languages must not collapse onto the same colour.
    assert_ne!(
        brutalist.refinement.background,
        shadcn.refinement.background
    );
}

#[test]
fn reports_a_property_it_cannot_express() {
    // `will-change` is a browser hint with no GPUI counterpart.
    let mapped = map(
        &resolve(&["will-change-transform"], "shadcn"),
        LengthContext::default(),
    );
    assert!(mapped
        .unmapped
        .iter()
        .any(|(property, _, reason)| property == "will-change"
            && *reason == Unmapped::UnknownProperty));
    assert!(!mapped.is_complete());
}

/// The inventory of properties this layer does not implement at all.
///
/// Every entry here is deliberate, not an oversight: each needs work beyond a
/// property assignment, and each is named in the plan as its own slice.
const EXPECTED_UNMAPPED: [&str; 28] = [
    // Composed paint that needs BoxShadow construction from the ring/shadow
    // custom properties rather than a single declaration.
    "box-shadow",
    "outline",
    "outline-color",
    "outline-offset",
    "outline-style",
    "outline-width",
    // Element-level concerns GPUI expresses outside Style.
    "transform",
    "backdrop-filter",
    "z-index",
    "pointer-events",
    "touch-action",
    "user-select",
    "resize",
    "will-change",
    "background-clip",
    // The animation driver is its own slice.
    "animation-duration",
    "animation-fill-mode",
    "animation-name",
    "animation-timing-function",
    "transition-duration",
    "transition-property",
    "transition-timing-function",
    // Text properties this layer has not mapped yet.
    "letter-spacing",
    "text-align",
    "text-decoration-line",
    "text-transform",
    "text-underline-offset",
    "white-space",
];

/// The inventory of values a property this layer *does* implement cannot take.
///
/// This is a separate list from the property inventory on purpose. `width` is
/// mapped; `width: fit-content` is not. Recording the pair keeps the property
/// inventory from claiming that `width` never reaches a surface.
const EXPECTED_UNMAPPED_VALUES: [(&str, &str, &str); 6] = [
    (
        "width",
        "fit-content",
        "GPUI's `Length` is definite-or-auto and has no content-driven form. \
         Whether `Auto` is close enough is a pixel-gate question, so this \
         records the gap rather than guessing at a substitute.",
    ),
    (
        "color",
        "currentColor",
        "Resolves against the inherited text colour, which a single surface's \
         declarations do not carry. Reported as `NeedsInheritedColor` so the \
         caller can substitute and re-map.",
    ),
    (
        "border-radius",
        "max(calc(0 - 2px), 0px)",
        "Brutalist's `--radius` is `0px`, so `rounded-md` substitutes to an \
         addition mixing a plain number with a length. That is invalid CSS, \
         and a browser drops the declaration too.",
    ),
    (
        "border-radius",
        "min(max(calc(0 - 2px), 0px), 12px)",
        "The arbitrary-value form of the same Brutalist substitution.",
    ),
    (
        "height",
        "calc(100% - 1px)",
        "Shadcn Tabs Trigger (packages/prototypes/shadcn/src/tabs/trigger.proto.ts) \
         sizes itself one pixel short of its list. GPUI's `DefiniteLength` is a \
         length or a fraction, never their sum, so this has to be resolved \
         against the parent's size at layout time. Before this was reported it \
         was mapped as a plain 100%, one pixel too tall. The Tabs slice owns it.",
    ),
    (
        "position",
        "fixed",
        "GPUI absolute positioning is ancestor-relative and cannot preserve CSS viewport-fixed behavior.",
    ),
];

/// The end of the Brutalist radius chain, followed through every layer.
///
/// `rounded-md` records `max(calc(var(--radius) - 2px), 0px)`; the Brutalist
/// theme substitutes `--radius` with `0px`; the result subtracts a length from
/// a plain number, which CSS rejects. The web baseline drops the declaration,
/// so the mapped surface must carry no radius rather than an invented one.
#[test]
fn brutalist_radius_substitution_reaches_the_map_as_invalid() {
    let resolved = resolve(&["rounded-md"], "brutalist");
    assert_eq!(
        resolved
            .declarations
            .get("border-radius")
            .map(String::as_str),
        Some("max(calc(0 - 2px), 0px)"),
        "the theme should have substituted --radius before the map sees it"
    );

    let mapped = map(&resolved, LengthContext::default());
    assert!(
        mapped.refinement.corner_radii.top_left.is_none(),
        "an invalid declaration must not paint a radius"
    );
    assert!(mapped.unmapped.iter().any(|(property, value, reason)| {
        property == "border-radius"
            && value == "max(calc(0 - 2px), 0px)"
            && *reason == Unmapped::UnsupportedValue
    }));

    // Shadcn's `--radius` is non-zero, so the same token does paint there.
    // Without this the assertion above would pass for the wrong reason.
    let shadcn = map(
        &resolve(&["rounded-md"], "shadcn"),
        LengthContext::default(),
    );
    assert!(
        shadcn.refinement.corner_radii.top_left.is_some(),
        "the same token must still map where the substitution is valid"
    );
}

#[test]
fn a_unitless_line_height_multiplies_the_font_size() {
    let mapped = map(
        &resolve(&["leading-none"], "shadcn"),
        LengthContext::default(),
    );
    assert_eq!(
        mapped.refinement.text.line_height,
        Some(DefiniteLength::Fraction(1.0))
    );
    assert!(mapped.is_complete());
}

#[test]
fn current_color_asks_the_caller_for_the_inherited_colour() {
    let mapped = map(
        &resolve(&["text-current"], "shadcn"),
        LengthContext::default(),
    );
    assert!(mapped.unmapped.iter().any(
        |(property, _, reason)| property == "color" && *reason == Unmapped::NeedsInheritedColor
    ));
}

#[test]
fn every_token_maps_or_appears_in_the_inventory() {
    let mut unmapped: BTreeSet<String> = BTreeSet::new();
    let mut unmapped_values: BTreeSet<(String, String)> = BTreeSet::new();
    let mut mapped_count = 0usize;

    for language in themes().names() {
        for (token, _) in vocabulary().tokens_with_declarations() {
            let resolved = resolve(&[token.as_str()], language);
            // A token from another design language leaves an unsubstituted
            // reference; the colour suite covers that case.
            if resolved
                .declarations
                .values()
                .any(|value| value.contains("var("))
            {
                continue;
            }
            let mapped = map(&resolved, LengthContext::default());
            mapped_count += mapped.refinement.padding.left.is_some() as usize;
            for (property, value, reason) in &mapped.unmapped {
                match reason {
                    Unmapped::UnknownProperty => {
                        unmapped.insert(property.clone());
                    }
                    // A property that is mapped but cannot take this value is
                    // a value-level gap, recorded with the value that caused it.
                    Unmapped::UnsupportedValue | Unmapped::NeedsInheritedColor => {
                        unmapped_values.insert((property.clone(), value.clone()));
                    }
                    // A custom property feeding a composed value belongs to
                    // neither inventory: the property it feeds carries the gap.
                    Unmapped::ComposedInput => {}
                }
            }
        }
    }

    let expected: BTreeSet<String> = EXPECTED_UNMAPPED.iter().map(|s| s.to_string()).collect();
    let unexpected: Vec<&String> = unmapped.difference(&expected).collect();
    let gone: Vec<&String> = expected.difference(&unmapped).collect();

    assert!(
        unexpected.is_empty(),
        "a property stopped mapping or is newly present: {unexpected:?}"
    );
    assert!(
        gone.is_empty(),
        "these are now mapped and should leave the inventory: {gone:?}"
    );
    let expected_values: BTreeSet<(String, String)> = EXPECTED_UNMAPPED_VALUES
        .iter()
        .map(|(property, value, _)| (property.to_string(), value.to_string()))
        .collect();
    let unexpected_values: Vec<&(String, String)> =
        unmapped_values.difference(&expected_values).collect();
    let gone_values: Vec<&(String, String)> =
        expected_values.difference(&unmapped_values).collect();

    assert!(
        unexpected_values.is_empty(),
        "a value stopped mapping or is newly present: {unexpected_values:?}"
    );
    assert!(
        gone_values.is_empty(),
        "these values now map and should leave the inventory: {gone_values:?}"
    );

    // Guards against the loop finding nothing, which would make this vacuous.
    assert!(mapped_count > 0, "no token produced a mapped padding");
}

fn declared(pairs: &[(&str, &str)]) -> proto_ui_style::ResolvedStyle {
    proto_ui_style::ResolvedStyle {
        declarations: pairs
            .iter()
            .map(|(property, value)| (property.to_string(), value.to_string()))
            .collect(),
        unknown: Vec::new(),
    }
}

#[test]
fn a_mixed_percentage_and_length_is_reported_not_truncated() {
    // Evaluation keeps both parts of `calc(100% - 1px)`. GPUI's
    // `DefiniteLength` is a length or a fraction, never their sum, so mapping
    // either part alone would move an edge while reporting success.
    let cases = [
        // Through `to_length`.
        ("width", "calc(100% - 1px)"),
        ("top", "calc(50% + 2px)"),
        // Through `to_definite`.
        ("padding-left", "calc(50% + 2px)"),
        ("padding-block", "calc(10% - 1px)"),
    ];
    for (property, value) in cases {
        let declarations = if property == "top" {
            vec![("position", "absolute"), (property, value)]
        } else {
            vec![(property, value)]
        };
        let mapped = map(&declared(&declarations), LengthContext::default());
        assert!(
            mapped.unmapped.iter().any(|(p, v, reason)| p == property
                && v == value
                && *reason == Unmapped::UnsupportedValue),
            "`{property}: {value}` must be reported, got {:?}",
            mapped.unmapped
        );
        assert!(!mapped.is_complete());
    }

    // Nothing truncated reaches the refinement either.
    let width = map(
        &declared(&[("width", "calc(100% - 1px)")]),
        LengthContext::default(),
    );
    assert_eq!(width.refinement.size.width, None);
    let padding = map(
        &declared(&[("padding-left", "calc(50% + 2px)")]),
        LengthContext::default(),
    );
    assert_eq!(padding.refinement.padding.left, None);
}

#[test]
fn a_pure_percentage_and_a_pure_length_still_map() {
    // The guard is about sums. It must not catch either part on its own.
    let mapped = map(
        &declared(&[
            ("position", "absolute"),
            ("width", "100%"),
            ("padding-left", "1rem"),
            ("top", "calc(0% + 4px)"),
        ]),
        LengthContext::default(),
    );
    assert!(mapped.is_complete(), "unexpected: {:?}", mapped.unmapped);
    assert_eq!(
        mapped.refinement.size.width,
        Some(Length::Definite(DefiniteLength::Fraction(1.0)))
    );
    assert_eq!(
        mapped.refinement.padding.left,
        Some(DefiniteLength::Absolute(AbsoluteLength::Pixels(gpui::px(
            16.
        ))))
    );
    // A zero percentage contributes nothing, so this is a plain length.
    assert_eq!(
        mapped.refinement.inset.top,
        Some(Length::Definite(DefiniteLength::Absolute(
            AbsoluteLength::Pixels(gpui::px(4.))
        )))
    );
}
