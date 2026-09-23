//! Colour parsing, checked against known conversions and against every colour
//! the recorded fixtures actually contain.

use proto_ui_style::color::{parse, parse_rgba, ColorError, ColorValue, Rgba};
use proto_ui_style::{themes, vocabulary, ColorScheme, Substitution};

const COLOR_PROPERTIES: [&str; 6] = [
    "color",
    "background-color",
    "border-color",
    "fill",
    "stroke",
    "outline-color",
];

fn rgba8(value: &str) -> [u8; 4] {
    parse_rgba(value)
        .unwrap_or_else(|error| panic!("{value}: {error:?}"))
        .to_rgba8()
}

#[test]
fn parses_hex_in_every_recorded_length() {
    assert_eq!(rgba8("#000"), [0, 0, 0, 255]);
    assert_eq!(rgba8("#f5f5f5"), [245, 245, 245, 255]);
    assert_eq!(rgba8("#93c5fd"), [147, 197, 253, 255]);
    // Short form expands by repetition, not by padding.
    assert_eq!(rgba8("#abc"), rgba8("#aabbcc"));
    assert_eq!(rgba8("#0000"), [0, 0, 0, 0]);
    assert_eq!(rgba8("#11223344"), [17, 34, 51, 68]);
}

#[test]
fn parses_both_rgb_syntaxes() {
    assert_eq!(rgba8("rgba(0, 0, 0, 0.75)"), [0, 0, 0, 191]);
    assert_eq!(rgba8("rgb(0 0 0 / 0.5)"), [0, 0, 0, 128]);
    assert_eq!(rgba8("rgb(255, 128, 0)"), [255, 128, 0, 255]);
}

#[test]
fn converts_lab_through_the_css_color_4_path() {
    // The endpoints are exact by definition and catch a wrong white point or a
    // missing gamma encode, both of which would still produce plausible greys.
    assert_eq!(rgba8("lab(100% 0 0)"), [255, 255, 255, 255]);
    assert_eq!(rgba8("lab(0% 0 0)"), [0, 0, 0, 255]);

    // Shadcn's foreground. A linear-light mistake here reads as about 19.
    let near_black = rgba8("lab(2.75381% 0 0)");
    assert_eq!(near_black[3], 255);
    assert!(
        (9..=11).contains(&near_black[0]),
        "unexpected lightness: {near_black:?}"
    );
    assert_eq!(near_black[0], near_black[1], "a neutral must stay neutral");
    assert_eq!(near_black[1], near_black[2], "a neutral must stay neutral");

    // `lab()` takes the same optional slash alpha as `rgb()`; the Shadcn dark
    // theme uses it for translucent borders, and the completeness guard below
    // is what surfaced it.
    assert_eq!(rgba8("lab(100% 0 0 / 0.1)"), [255, 255, 255, 26]);

    // A chromatic value must not collapse to grey.
    let chromatic = rgba8("lab(50% 40 -30)");
    assert!(
        chromatic[0] > chromatic[1] && chromatic[2] > chromatic[1],
        "expected a magenta-ish cast, got {chromatic:?}"
    );
}

#[test]
fn treats_a_transparent_mix_as_alpha_attenuation() {
    let mixed = parse_rgba("color-mix(in oklab, #3366ff 80%, transparent)").unwrap();
    let base = parse_rgba("#3366ff").unwrap();
    assert_eq!(mixed.r, base.r);
    assert_eq!(mixed.g, base.g);
    assert_eq!(mixed.b, base.b);
    assert!((mixed.a - 0.8).abs() < 1e-6, "alpha was {}", mixed.a);

    assert_eq!(parse_rgba("transparent").unwrap(), Rgba::TRANSPARENT);

    // `currentColor` stays symbolic: it resolves against the inherited text
    // colour, which is how every Lucide icon gets its stroke.
    let current = Rgba::new(0.1, 0.2, 0.3, 1.0);
    assert_eq!(parse("currentColor").unwrap(), ColorValue::CurrentColor);
    assert_eq!(parse("currentColor").unwrap().resolve(current), current);
    assert_eq!(
        parse("#3366ff").unwrap().resolve(current),
        parse_rgba("#3366ff").unwrap()
    );
}

#[test]
fn reports_rather_than_approximates_what_it_cannot_do() {
    // A mix against a second colour is a real interpolation this does not do.
    assert!(matches!(
        parse("color-mix(in oklab, #fff 50%, #000)"),
        Err(ColorError::Unsupported(_))
    ));
    // A colour space it has never seen.
    assert!(matches!(
        parse("oklch(0.7 0.1 200)"),
        Err(ColorError::Unsupported(_))
    ));
    // An unresolved reference is not a colour.
    assert!(matches!(
        parse("var(--pui-accent)"),
        Err(ColorError::Unsupported(_))
    ));
    // A recognised form with broken contents is distinguished from an
    // unknown one, so a caller can tell a typo from a missing feature.
    assert!(matches!(parse("#12345"), Err(ColorError::Malformed(_))));
    assert!(matches!(parse("lab(50% 0)"), Err(ColorError::Malformed(_))));
}

/// Completeness: every colour a theme can actually produce must parse.
///
/// This is the guard that matters. The unit cases above only prove the forms
/// present today are handled; this fails when the vocabulary or a theme starts
/// using a syntax nothing here implements, instead of that surfacing as a
/// wrong colour at paint time. It found `currentColor`, which the survey of
/// the fixtures had missed.
#[test]
fn parses_every_colour_a_theme_can_produce() {
    let mut checked = 0usize;
    let mut unresolved = 0usize;

    for language in themes().names() {
        for scheme in [ColorScheme::Light, ColorScheme::Dark] {
            let theme = themes().get(language, scheme).expect("theme");

            for (token, _) in vocabulary().tokens_with_declarations() {
                let resolved = vocabulary().resolve_all([token.as_str()]);
                for property in COLOR_PROPERTIES {
                    let Some(raw) = resolved.get(property) else {
                        continue;
                    };
                    match theme.substitute(raw) {
                        Substitution::Resolved(value) => {
                            parse(&value).unwrap_or_else(|error| {
                                panic!(
                                    "{language}/{scheme:?} {token} {property} = {value}: {error:?}"
                                )
                            });
                            checked += 1;
                        }
                        // A token from another design language is expected not
                        // to resolve; the next test pins that down.
                        Substitution::Missing { .. } => unresolved += 1,
                        Substitution::TooDeep => {
                            panic!(
                                "{language}/{scheme:?} {token} {property}: substitution ran away"
                            )
                        }
                    }
                }
            }
        }
    }

    // Guards against the loop silently finding nothing, which would make the
    // whole test vacuous.
    assert!(checked > 200, "only checked {checked} colours");
    assert!(unresolved > 0, "the cross-language case disappeared");
}

/// The vocabulary spans every design language; a theme does not.
///
/// `bg-canary` is a Brutalist palette token, and the Shadcn theme defines no
/// `--pui-canary`. Pairing the wrong theme with a prototype family is
/// therefore detectable rather than silent, which is why `substitute` reports
/// `Missing` instead of substituting an empty string.
#[test]
fn a_token_from_another_design_language_is_reported_not_guessed() {
    let brutalist_only = vocabulary().resolve_all(["bg-canary"]);
    let value = brutalist_only.get("background-color").expect("declaration");
    assert_eq!(value, "var(--pui-canary)");

    let brutalist = themes().get("brutalist", ColorScheme::Light).unwrap();
    assert_eq!(
        brutalist.substitute(value),
        Substitution::Resolved("#FEF08A".to_string())
    );

    let shadcn = themes().get("shadcn", ColorScheme::Light).unwrap();
    assert_eq!(
        shadcn.substitute(value),
        Substitution::Missing {
            variable: "--pui-canary".to_string()
        }
    );
}
