//! Length evaluation, checked against the forms the fixtures contain.

use std::collections::BTreeSet;

use proto_ui_style::length::{evaluate, looks_like_length, Dimension, LengthContext, LengthError};
use proto_ui_style::{themes, vocabulary, ColorScheme, Substitution};

fn px(value: &str) -> f32 {
    evaluate(value, LengthContext::default())
        .unwrap_or_else(|error| panic!("{value}: {error:?}"))
        .px
}

#[test]
fn evaluates_every_recorded_unit() {
    assert_eq!(px("0"), 0.0);
    assert_eq!(px("2px"), 2.0);
    assert_eq!(px("-1px"), -1.0);
    assert_eq!(px("0.625rem"), 10.0);
    assert_eq!(px("1.25rem"), 20.0);

    // `em` follows the element, `rem` the root, so a context change separates
    // them; a module that folded both into one constant would pass otherwise.
    let context = LengthContext {
        root_font_size_px: 16.0,
        font_size_px: 24.0,
    };
    assert_eq!(evaluate("1rem", context).unwrap().px, 16.0);
    assert_eq!(evaluate("1em", context).unwrap().px, 24.0);
}

#[test]
fn keeps_a_percentage_symbolic_until_a_basis_arrives() {
    let half = evaluate("-50%", LengthContext::default()).unwrap();
    assert_eq!(half, Dimension::percent(-50.0));
    assert!(!half.is_absolute());
    assert_eq!(half.resolve(40.0), -20.0);

    // calc() mixing the two keeps both parts, because the pixel answer
    // depends on a basis this layer does not know.
    let mixed = evaluate("calc(100% - 1px)", LengthContext::default()).unwrap();
    assert_eq!(
        mixed,
        Dimension {
            px: -1.0,
            percent: 100.0
        }
    );
    assert_eq!(mixed.resolve(200.0), 199.0);
}

#[test]
fn evaluates_the_nested_forms_the_themes_produce() {
    // The radius ramp after substitution, for both design languages.
    assert_eq!(px("max(calc(0.625rem - 2px), 0px)"), 8.0);
    assert_eq!(px("max(calc(0.625rem - 4px), 0px)"), 6.0);
    assert_eq!(px("calc(0.625rem + 4px)"), 14.0);
    // Brutalist's radius is `0`, so substituting the ramp yields a unitless
    // number meeting a length. CSS `calc()` is typed and rejects that, in
    // either direction, so this evaluator does too rather than inventing a
    // dialect the recorded values were not authored in.
    for expression in [
        "calc(0 + 4px)",
        "calc(0 - 4px)",
        "calc(4px + 0)",
        "calc(2 - 4px)",
    ] {
        assert!(
            matches!(
                evaluate(expression, LengthContext::default()),
                Err(LengthError::InvalidArithmetic(_))
            ),
            "{expression} must not evaluate"
        );
    }
    // A zero that is the whole value, rather than an operand in a sum, is the
    // one unitless length CSS does accept.
    assert_eq!(px("0"), 0.0);
    assert_eq!(px("min(8px, 12px)"), 8.0);

    // Nesting and precedence.
    assert_eq!(px("calc(2px + 3px * 2)"), 8.0);
    assert_eq!(px("calc((2px + 3px) * 2)"), 10.0);
    assert_eq!(px("calc(10px / 4)"), 2.5);
}

#[test]
fn keeps_zero_number_type_inside_math_functions() {
    for expression in ["calc(0)", "calc(0 + 0)", "min(0, 0)", "max(0, -0)"] {
        assert!(
            matches!(
                evaluate(expression, LengthContext::default()),
                Err(LengthError::Unsupported(_))
            ),
            "{expression} is a number, not a length"
        );
    }

    // The legacy unitless zero exception applies only to the complete length
    // token, not to an expression which happens to evaluate to zero.
    assert_eq!(
        evaluate("0", LengthContext::default()).unwrap(),
        Dimension::ZERO
    );
    assert_eq!(
        evaluate("-0", LengthContext::default()).unwrap(),
        Dimension::ZERO
    );
}

#[test]
fn requires_whitespace_on_both_sides_of_calc_additive_operators() {
    assert_eq!(px("calc(2px + 3px)"), 5.0);
    assert_eq!(px("calc(2px\t+\n3px)"), 5.0);

    for expression in [
        "calc(2px+ 3px)",
        "calc(2px +3px)",
        "calc(2px- 3px)",
        "calc(2px -3px)",
    ] {
        assert!(
            matches!(
                evaluate(expression, LengthContext::default()),
                Err(LengthError::Malformed(_))
            ),
            "{expression} must have whitespace on both sides of + or -"
        );
    }
}

#[test]
fn reports_what_it_cannot_answer_rather_than_guessing() {
    let context = LengthContext::default();

    // Comparing a percentage with a pixel value has no answer without the
    // basis, so it is reported instead of being silently resolved one way.
    assert!(matches!(
        evaluate("min(100%, 12px)", context),
        Err(LengthError::NeedsBasis(_))
    ));

    // Scaling a length by a length is not a length.
    assert!(matches!(
        evaluate("calc(2px * 3px)", context),
        Err(LengthError::InvalidArithmetic(_))
    ));
    assert!(matches!(
        evaluate("calc(2px / 0)", context),
        Err(LengthError::InvalidArithmetic(_))
    ));

    // A unit this module does not implement is distinguished from a typo.
    assert!(matches!(
        evaluate("2vh", context),
        Err(LengthError::Unsupported(_))
    ));
    assert!(matches!(
        evaluate("calc(2px +", context),
        Err(LengthError::Malformed(_))
    ));
    assert!(matches!(
        evaluate("flex", context),
        Err(LengthError::Malformed(_))
    ));
}

#[test]
fn tells_a_length_apart_from_a_keyword() {
    for value in [
        "0",
        "2px",
        "-1px",
        "0.625rem",
        "-50%",
        "calc(100% - 1px)",
        "min(8px, 12px)",
    ] {
        assert!(
            looks_like_length(value),
            "{value} should look like a length"
        );
    }
    for value in [
        "flex",
        "absolute",
        "solid",
        "pointer",
        "1 / 1",
        "pui-enter",
        "",
    ] {
        assert!(!looks_like_length(value), "{value} should not");
    }
}

/// Completeness: every length-shaped value a theme can produce is either
/// evaluated or named here as invalid.
///
/// The invalid set is not a gap in this evaluator. Those expressions are what
/// the canonical Web compiler emits after variable substitution, and a browser
/// rejects them too: CSS `calc()` will not add a `<number>` to a `<length>`.
/// Brutalist sets `--pui-radius: 0`, so its radius ramp substitutes into
/// exactly that shape. On the Web the declaration is dropped and the property
/// falls back to its initial value, which for a radius is also zero — so these
/// subtract-and-clamp cases look right by coincidence.
///
/// The ramp's addition case, `--pui-radius-xl` as `calc(var(--pui-radius) +
/// 4px)`, is the one where the coincidence does not hold: dropping it leaves a
/// zero radius where `4px` was meant. It is absent from this list only because
/// no current token consumes that variable, so nothing reaches a declaration —
/// `calc(0 + 4px)` is asserted invalid as a unit case instead.
///
/// Recording the set here keeps that visible. When the generated ramp is
/// corrected at the TypeScript source so both hosts consume a valid
/// expression, this list shrinks and the test says so.
const INVALID_ON_THE_WEB_TOO: [&str; 2] = [
    "max(calc(0 - 2px), 0px)",
    "min(max(calc(0 - 2px), 0px), 12px)",
];

#[test]
fn evaluates_every_length_a_theme_can_produce() {
    let context = LengthContext::default();
    let mut checked = 0usize;
    let mut invalid: BTreeSet<String> = BTreeSet::new();

    for language in themes().names() {
        for scheme in [ColorScheme::Light, ColorScheme::Dark] {
            let theme = themes().get(language, scheme).expect("theme");

            for (token, declarations) in vocabulary().tokens_with_declarations() {
                for (property, raw) in declarations {
                    let Substitution::Resolved(value) = theme.substitute(raw) else {
                        // A token from another design language; covered by the
                        // colour suite's cross-language case.
                        continue;
                    };
                    if !looks_like_length(&value) {
                        continue;
                    }
                    match evaluate(&value, context) {
                        Ok(_) => checked += 1,
                        Err(LengthError::InvalidArithmetic(_)) => {
                            invalid.insert(value.clone());
                        }
                        Err(error) => {
                            panic!("{language}/{scheme:?} {token} {property} = {value}: {error:?}")
                        }
                    }
                }
            }
        }
    }

    let expected: BTreeSet<String> = INVALID_ON_THE_WEB_TOO
        .iter()
        .map(|s| s.to_string())
        .collect();
    assert_eq!(
        invalid, expected,
        "the set of expressions that are invalid CSS changed"
    );
    assert!(checked > 200, "only checked {checked} lengths");
}
