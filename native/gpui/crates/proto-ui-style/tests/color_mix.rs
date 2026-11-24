//! Concrete two-colour mixes used by the recorded native vocabulary.
//!
//! Numeric vectors use an independent f64 XYZ conversion route from CSS Color 4
//! §19 (2026-11-23), with Color 4 §13 / Color 5 §3 (2026-11-16) interpolation.
//! They do not call this crate to calculate their expected values. Each vector
//! below has an in-gamut result; the Lab-input case starts outside sRGB.

use proto_ui_style::color::{parse_rgba, ColorError};
use proto_ui_style::{themes, vocabulary, ColorScheme, Substitution};

fn assert_rgba(text: &str, expected: [f32; 4]) {
    let actual = parse_rgba(text).unwrap_or_else(|error| panic!("{text}: {error:?}"));
    for (channel, (actual, expected)) in [actual.r, actual.g, actual.b, actual.a]
        .into_iter()
        .zip(expected)
        .enumerate()
    {
        assert!(
            (actual - expected).abs() < 0.000_02,
            "{text} channel {channel}: {actual}, expected {expected}"
        );
    }
}

#[test]
fn parses_the_original_cross_theme_failure_without_losing_the_weight() {
    // A neutral Oklab lightness is the cube root of linear sRGB. Independently,
    // encode((.95*cbrt(decode(245/255)) + .05*cbrt(decode(51/255)))^3)
    // is 0.918489149882004. Encoded-RGB mixing would instead give 0.922745.
    assert_rgba(
        "color-mix(in oklch, #f5f5f5, #333333 5%)",
        [0.918_489_16, 0.918_489_16, 0.918_489_16, 1.0],
    );
}

#[test]
fn resolves_the_shadcn_secondary_hover_through_the_real_vocabulary_and_theme() {
    let token = "bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]";
    let resolved = vocabulary().resolve_all([token]);
    let raw = resolved
        .get("background-color")
        .expect("Shadcn hover declaration");
    assert_eq!(
        raw,
        "color-mix(in oklch, var(--pui-secondary), var(--pui-foreground) 5%)"
    );
    for (scheme, expected) in [
        (
            ColorScheme::Light,
            [0.906_891_3, 0.906_891_3, 0.906_891_3, 1.0],
        ),
        (
            ColorScheme::Dark,
            [0.183_930_26, 0.183_930_26, 0.183_930_26, 1.0],
        ),
    ] {
        let theme = themes().get("shadcn", scheme).expect("Shadcn theme");
        let Substitution::Resolved(value) = theme.substitute(raw) else {
            panic!("unresolved Shadcn hover in {scheme:?}");
        };
        assert_rgba(&value, expected);
    }
}

#[test]
fn normalizes_omitted_and_explicit_weights_without_discarding_alpha() {
    // Equal white/black in Oklab has L=.5, hence linear RGB=.125.
    let channel = 0.388_572_87;
    for (text, alpha) in [
        ("color-mix(in oklab, #fff, #000)", 1.0),
        ("color-mix(in oklab, #fff 50%, #000)", 1.0),
        ("color-mix(in oklab, #fff, #000 50%)", 1.0),
        ("color-mix(in oklab, #fff 75%, #000 75%)", 1.0),
        ("color-mix(in oklab, #fff 30%, #000 30%)", 0.6),
        ("color-mix(in oklab, #fff 0%, #000 0%)", 0.0),
    ] {
        assert_rgba(text, [channel, channel, channel, alpha]);
    }
}

#[test]
fn interpolates_in_oklab_instead_of_encoded_rgb() {
    assert_rgba(
        "color-mix(in oklab, #ff0000, #0000ff)",
        [0.550_441_1, 0.325_620_68, 0.636_500_7, 1.0],
    );
}

#[test]
fn carries_the_coloured_hue_when_the_other_colour_is_achromatic() {
    // A grey has powerless hue. Treating its numerical atan2 noise as a hue
    // would rotate this blue away from the authored hue.
    for text in [
        "color-mix(in oklch, #808080, #406080)",
        "color-mix(in oklch, #406080, #808080)",
    ] {
        assert_rgba(text, [0.378_067_34, 0.440_314_14, 0.504_670_8, 1.0]);
    }
}

#[test]
fn uses_the_shorter_hue_arc_across_zero() {
    assert_rgba(
        "color-mix(in oklch, #a04060, #6040a0)",
        [0.531_866_8, 0.235_474_06, 0.522_619_5, 1.0],
    );
}

#[test]
fn premultiplies_colour_but_not_polar_hue_and_keeps_inner_rgb_commas() {
    assert_rgba(
        "color-mix(in oklch, rgba(160, 64, 96, 0.25), rgb(64 96 128 / 75%))",
        [0.417_501_27, 0.325_329, 0.516_794_14, 0.5],
    );
    assert_rgba(
        "color-mix(in oklab, rgba(160, 64, 96, 0.25), rgb(64 96 128 / 75%))",
        [0.370_434_4, 0.357_421_7, 0.471_943_04, 0.5],
    );
    let base = parse_rgba("rgba(160, 64, 96, 0.5)").unwrap();
    for text in [
        "color-mix(in oklab, rgba(160, 64, 96, 0.5) 80%, transparent)",
        "color-mix(in oklch, transparent 20%, rgba(160, 64, 96, 0.5))",
    ] {
        let mixed = parse_rgba(text).unwrap();
        assert_eq!([mixed.r, mixed.g, mixed.b], [base.r, base.g, base.b]);
        assert!((mixed.a - 0.4).abs() < 1e-6);
    }
}

#[test]
fn mixes_unmapped_lab_input_before_projecting_the_result_to_srgb() {
    // This source Lab has linear green=-0.00940463488383992. The mixed
    // result is in gamut. Mapping the source first changes the final colour.
    assert_rgba(
        "color-mix(in oklab, lab(48.4493% 77.4328 61.5452), #808080)",
        [0.731_287_7, 0.364_507_5, 0.327_540_4, 1.0],
    );
}

#[test]
fn retains_explicit_unsupported_boundaries() {
    for text in [
        "color-mix(in srgb, #fff, #000)",
        "color-mix(in oklch longer hue, #fff, #000)",
        "color-mix(in oklch, currentColor, #000)",
        "color-mix(in oklch, var(--pui-secondary), #000)",
        "color-mix(in oklch, oklch(0.7 0.1 200), #000)",
        "color-mix(in oklab, #fff, #000, #333)",
        "color-mix(in oklab, #fff)",
        "color-mix(in oklab, color-mix(in oklab, #fff, #000), #333)",
    ] {
        assert!(
            matches!(parse_rgba(text), Err(ColorError::Unsupported(_))),
            "{text}"
        );
    }
}

#[test]
fn rejects_non_finite_out_of_range_or_malformed_weights_on_either_colour() {
    for text in [
        "color-mix(in oklch, #fff -1%, #000)",
        "color-mix(in oklch, #fff, #000 101%)",
        "color-mix(in oklch, #fff NaN%, #000)",
        "color-mix(in oklch, #fff, #000 inf%)",
        "color-mix(in oklch, #fff, #000 %)",
        "color-mix(in oklch, #fff,, #000)",
        "color-mix(in oklch, #fff, rgba(0, 0, 0, 1)))",
    ] {
        assert!(
            matches!(parse_rgba(text), Err(ColorError::Malformed(_))),
            "{text}"
        );
    }
}
