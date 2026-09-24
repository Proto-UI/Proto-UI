//! Checks the recorded theme catalog and the variable substitution a host
//! performs before it can paint anything.

use proto_ui_style::{themes, vocabulary, ColorScheme, Substitution};

#[test]
fn records_both_design_languages_in_both_schemes() {
    let catalog = themes();
    assert_eq!(catalog.names(), vec!["brutalist", "shadcn"]);

    for name in catalog.names() {
        for scheme in [ColorScheme::Light, ColorScheme::Dark] {
            let theme = catalog.get(name, scheme).expect("theme present");
            assert!(!theme.is_empty(), "{name} {scheme:?} is empty");
            // Every mode is a complete map: the dark block overrides the light
            // one rather than replacing it, so a host never has to merge.
            assert!(
                theme.variable("--pui-background").is_some(),
                "{name} {scheme:?}"
            );
            assert!(
                theme.variable("--pui-foreground").is_some(),
                "{name} {scheme:?}"
            );
            assert!(
                theme.variable("--pui-radius").is_some(),
                "{name} {scheme:?}"
            );
        }
    }

    assert!(catalog.get("nonexistent", ColorScheme::Light).is_none());
}

#[test]
fn schemes_differ_where_the_design_language_says_they_do() {
    let catalog = themes();
    for name in ["shadcn", "brutalist"] {
        let light = catalog.get(name, ColorScheme::Light).unwrap();
        let dark = catalog.get(name, ColorScheme::Dark).unwrap();
        assert_ne!(
            light.variable("--pui-background"),
            dark.variable("--pui-background"),
            "{name} background must differ between schemes"
        );
    }

    // Brutalist keeps its palette across schemes on purpose; that is a fact of
    // the design language, not a recording mistake.
    let light = catalog.get("brutalist", ColorScheme::Light).unwrap();
    let dark = catalog.get("brutalist", ColorScheme::Dark).unwrap();
    assert_eq!(
        light.variable("--pui-accent"),
        dark.variable("--pui-accent")
    );
    assert_eq!(light.variable("--pui-accent"), Some("#bae6fd"));
}

#[test]
fn a_later_theme_declaration_wins_over_the_radius_ramp() {
    // The renderer emits the ramp first and the theme may redefine part of it.
    // Brutalist sets `--pui-radius-sm: 2px` after the ramp's max(calc(...)).
    let brutalist = themes().get("brutalist", ColorScheme::Light).unwrap();
    assert_eq!(brutalist.variable("--pui-radius-sm"), Some("2px"));

    let shadcn = themes().get("shadcn", ColorScheme::Light).unwrap();
    assert_eq!(
        shadcn.variable("--pui-radius-sm"),
        Some("max(calc(var(--pui-radius) - 4px), 0px)")
    );
}

#[test]
fn substitutes_a_token_declaration_into_a_concrete_value() {
    let theme = themes().get("brutalist", ColorScheme::Light).unwrap();
    let resolved = vocabulary().resolve_all(["bg-background"]);
    let value = resolved.get("background-color").expect("declaration");

    assert_eq!(value, "var(--pui-background)");
    assert_eq!(
        theme.substitute(value),
        Substitution::Resolved("#f5f5f5".to_string())
    );
}

#[test]
fn substitutes_through_a_chain_and_leaves_arithmetic_alone() {
    let theme = themes().get("shadcn", ColorScheme::Light).unwrap();

    // --pui-radius-md references --pui-radius, so one pass is not enough.
    match theme.substitute("var(--pui-radius-md)") {
        Substitution::Resolved(value) => {
            assert!(
                !value.contains("var("),
                "chain not fully substituted: {value}"
            );
            assert_eq!(value, "max(calc(0.625rem - 2px), 0px)");
        }
        other => panic!("unexpected: {other:?}"),
    }
}

#[test]
fn reports_a_missing_variable_rather_than_painting_nothing() {
    let theme = themes().get("shadcn", ColorScheme::Light).unwrap();

    assert_eq!(
        theme.substitute("var(--pui-not-a-variable)"),
        Substitution::Missing {
            variable: "--pui-not-a-variable".to_string()
        }
    );

    // A fallback is honoured, including the empty one the ring properties use
    // to mean "contribute nothing".
    assert_eq!(
        theme.substitute("var(--pui-not-a-variable, 4px)"),
        Substitution::Resolved("4px".to_string())
    );
    assert_eq!(
        theme.substitute("var(--pui-ring-inset,) 0 0 0 2px"),
        Substitution::Resolved(" 0 0 0 2px".to_string())
    );
}

#[test]
fn resolves_the_composed_shadow_a_ring_token_produces() {
    let theme = themes().get("shadcn", ColorScheme::Light).unwrap();
    let resolved = vocabulary().resolve_all(["ring-3"]);
    let shadow = resolved.get("box-shadow").expect("box-shadow");

    // The composed shadow references three custom properties, each with its
    // own fallback; none of them is a theme variable, so all fallbacks apply.
    match theme.substitute(shadow) {
        Substitution::Resolved(value) => {
            assert!(!value.contains("var("), "left a reference: {value}");
            assert!(value.contains("0 0 #0000"), "fallbacks lost: {value}");
        }
        other => panic!("unexpected: {other:?}"),
    }
}
