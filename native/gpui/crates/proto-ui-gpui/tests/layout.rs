//! Closes the loop from a recorded token to a box GPUI actually lays out.
//!
//! Every other suite in this crate asserts the `StyleRefinement` we build.
//! That is one step short: it says what we handed GPUI, not what GPUI did
//! with it. These tests run a real layout and paint pass in GPUI's headless
//! harness and read the resulting bounds back, so a mapping that is wrong
//! about GPUI's own semantics fails here rather than at a screenshot.

use std::cell::RefCell;
use std::rc::Rc;

use gpui::prelude::*;
use gpui::{canvas, div, px, size, AnyWindowHandle, Bounds, Context, Pixels, Window};
use proto_ui_gpui::style::map;
use proto_ui_style::length::LengthContext;
use proto_ui_style::{themes, vocabulary, ColorScheme, Substitution};

/// A fixed window keeps the headless fixture independent of display size.
/// The measured subject's parent is narrower so `w-full` can distinguish a
/// parent-relative percentage from one incorrectly resolved to the viewport.
const VIEWPORT: (f32, f32) = (400., 300.);
const PARENT_WIDTH: f32 = 200.;

fn resolve(tokens: &[&str], language: &str) -> proto_ui_style::ResolvedStyle {
    let theme = themes()
        .get(language, ColorScheme::Light)
        .expect("theme present");
    let mut resolved = vocabulary().resolve_all(tokens.iter().copied());
    for value in resolved.declarations.values_mut() {
        if let Substitution::Resolved(text) = theme.substitute(value) {
            *value = text;
        }
    }
    resolved
}

struct Probe {
    tokens: Vec<String>,
    language: String,
    observed: Rc<RefCell<Option<Bounds<Pixels>>>>,
}

impl Render for Probe {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        let borrowed: Vec<&str> = self.tokens.iter().map(String::as_str).collect();
        let mapped = map(
            &resolve(&borrowed, &self.language),
            LengthContext::default(),
        );
        let observed = self.observed.clone();

        let mut subject = canvas(
            move |bounds, _, _| *observed.borrow_mut() = Some(bounds),
            |_, _, _, _| {},
        );
        // The refinement goes on the measured element itself, so the bounds
        // read back are that element's own layout box.
        *subject.style() = mapped.refinement;

        // The flex row gives percentages a definite 200px basis inside the
        // 400px window. `items_start` prevents the default cross-axis stretch
        // from hiding the height actually requested by the subject's token.
        div()
            .flex()
            .flex_row()
            .items_start()
            .size_full()
            .w(px(PARENT_WIDTH))
            .child(subject)
    }
}

/// Lays `tokens` out in a real GPUI window and returns the resulting box.
fn lay_out(cx: &mut gpui::TestAppContext, tokens: &[&str], language: &str) -> Bounds<Pixels> {
    let observed = Rc::new(RefCell::new(None));
    let captured = observed.clone();
    let owned: Vec<String> = tokens.iter().map(|t| t.to_string()).collect();
    let language = language.to_string();

    let window = cx.open_window(size(px(VIEWPORT.0), px(VIEWPORT.1)), move |_, _| Probe {
        tokens: owned,
        language,
        observed: captured,
    });
    let window = AnyWindowHandle::from(window);
    cx.update_window(window, |_, window, cx| window.draw(cx).clear(cx))
        .expect("the window draws");

    let bounds = observed.borrow().expect("prepaint reported bounds");
    bounds
}

#[gpui::test]
fn a_rem_length_reaches_gpui_at_the_web_default_root_size(cx: &mut gpui::TestAppContext) {
    // `h-9` records `height: 2.25rem`. GPUI's default rem size is 16px, the
    // same as the browser's, so the two agree without a conversion step.
    let bounds = lay_out(cx, &["h-9"], "shadcn");
    assert_eq!(bounds.size.height, px(36.));
}

#[gpui::test]
fn an_absolute_size_token_lays_out_at_its_recorded_length(cx: &mut gpui::TestAppContext) {
    // `size-4` records both axes as `1rem`.
    let bounds = lay_out(cx, &["size-4"], "shadcn");
    assert_eq!(bounds.size.width, px(16.));
    assert_eq!(bounds.size.height, px(16.));
}

#[gpui::test]
fn a_percentage_resolves_against_the_parent_not_the_viewport(cx: &mut gpui::TestAppContext) {
    // The style crate keeps the percentage symbolic. The parent is 200px
    // inside a 400px viewport, so a viewport-relative implementation fails.
    let bounds = lay_out(cx, &["w-full"], "shadcn");
    assert_eq!(bounds.size.width, px(PARENT_WIDTH));
}

#[gpui::test]
fn padding_expands_a_box_that_has_no_explicit_size(cx: &mut gpui::TestAppContext) {
    // `px-4` is `padding-inline: 1rem` and `py-2` is `padding-block: 0.5rem`.
    // With no content and no explicit size the box is exactly its padding,
    // which pins that both the inline and block shorthands reached GPUI and
    // landed on the right axis.
    let bounds = lay_out(cx, &["px-4", "py-2"], "shadcn");
    assert_eq!(bounds.size.width, px(32.));
    assert_eq!(bounds.size.height, px(16.));
}

#[gpui::test]
fn a_design_language_changes_the_box_through_its_theme(cx: &mut gpui::TestAppContext) {
    // Both languages resolve `h-9` the same way; the point is that running
    // the same token through two themes does not disturb layout, so a later
    // divergence is attributable to the theme rather than to the mapping.
    let shadcn = lay_out(cx, &["h-9"], "shadcn");
    let brutalist = lay_out(cx, &["h-9"], "brutalist");
    assert_eq!(shadcn.size.height, brutalist.size.height);
}

#[gpui::test]
fn the_cascade_order_survives_into_layout(cx: &mut gpui::TestAppContext) {
    // The compiler emits `h-9` at position 92 and `size-4` at 192, so
    // `size-4` is the later rule and wins the height. Alone, `h-9` gives 36px;
    // together, `size-4` overrides it to 16px. Asserting both is what makes
    // this an override rather than a coincidence.
    let alone = lay_out(cx, &["h-9"], "shadcn");
    assert_eq!(alone.size.height, px(36.));

    let forward = lay_out(cx, &["size-4", "h-9"], "shadcn");
    let reversed = lay_out(cx, &["h-9", "size-4"], "shadcn");

    // The order the tokens arrive in is not the order they cascade in.
    assert_eq!(forward.size, reversed.size);
    assert_eq!(forward.size.width, px(16.));
    assert_eq!(forward.size.height, px(16.));

    // Pin the premise: if the recorded emission order ever flips, this fails
    // here with a clear cause rather than as a mysterious layout change.
    let vocabulary = vocabulary();
    assert!(
        vocabulary.cascade_position("size-4") > vocabulary.cascade_position("h-9"),
        "the assertions above assume `size-4` is the later rule"
    );
}
