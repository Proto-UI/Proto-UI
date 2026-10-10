//! Native layout evidence for the exact root-region lowering. These tests use
//! GPUI's actual layout/prepaint, not expected coordinates injected as output.
use std::cell::RefCell;
use std::rc::Rc;

use gpui::prelude::*;
use gpui::{canvas, div, point, px, size, AnyWindowHandle, Bounds, Context, Pixels, Window};
use proto_ui_gpui::available_space::centered_root;
use proto_ui_gpui::style::style_for_feedback_in_region;
use proto_ui_host_protocol::messages::AvailableSpaceRect;
use proto_ui_style::length::LengthContext;

const CENTER: &[&str] = &[
    "fixed",
    "left-[var(--proto-ui-available-region-center-x,50%)]",
    "top-[var(--proto-ui-available-region-center-y,50%)]",
    "-translate-x-1/2",
    "-translate-y-1/2",
];

struct Probe {
    region: AvailableSpaceRect,
    constrained: bool,
    measured: Rc<RefCell<Option<Bounds<Pixels>>>>,
}

impl Render for Probe {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let mut tokens = CENTER.to_vec();
        if self.constrained {
            tokens.push(
                "max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]",
            );
            tokens.push("max-h-[calc(var(--proto-ui-available-region-height,100%)_-_2rem)]");
        }
        let mapped =
            style_for_feedback_in_region(tokens, None, LengthContext::default(), Some(self.region));
        assert!(mapped.issues.is_empty(), "{:?}", mapped.issues);
        assert!(mapped.fixed_centered);
        let measured = self.measured.clone();
        let mut subject = canvas(
            move |bounds, _, _| *measured.borrow_mut() = Some(bounds),
            |_, _, _, _| {},
        );
        *subject.style() = mapped.refinement;
        subject.style().size.width = Some(px(600.).into());
        subject.style().size.height = Some(px(500.).into());
        div()
            .relative()
            .size_full()
            .child(centered_root(subject.into_any_element(), self.region))
    }
}

fn layout(
    cx: &mut gpui::TestAppContext,
    region: AvailableSpaceRect,
    constrained: bool,
) -> Bounds<Pixels> {
    let observed = Rc::new(RefCell::new(None));
    let measured = observed.clone();
    let window = cx.open_window(size(px(390.), px(900.)), move |_, _| Probe {
        region,
        constrained,
        measured,
    });
    cx.update_window(AnyWindowHandle::from(window), |_, window, cx| {
        window.draw(cx).clear(cx)
    })
    .unwrap();
    let result = observed
        .borrow()
        .expect("the actual native prepaint measured its root");
    result
}

#[gpui::test]
fn fixed_center_does_not_flex_shrink_a_600px_root_in_a_390px_region(cx: &mut gpui::TestAppContext) {
    let bounds = layout(
        cx,
        AvailableSpaceRect {
            x: 0.,
            y: 0.,
            width: 390.,
            height: 900.,
        },
        false,
    );
    assert_eq!(bounds.size.width, px(600.));
    assert_eq!(bounds.origin.x, px(-105.));
    assert_eq!(bounds.origin.y, px(200.));
}

#[gpui::test]
fn same_region_controls_center_and_authored_maximum(cx: &mut gpui::TestAppContext) {
    let bounds = layout(
        cx,
        AvailableSpaceRect {
            x: 10.,
            y: 60.,
            width: 370.,
            height: 390.,
        },
        true,
    );
    assert_eq!(
        bounds,
        Bounds::new(point(px(26.), px(76.)), size(px(338.), px(358.)))
    );
}

#[test]
fn absent_region_does_not_claim_fixed_transform_support() {
    let mapped =
        style_for_feedback_in_region(CENTER.iter().copied(), None, LengthContext::default(), None);
    assert!(!mapped.fixed_centered);
    assert!(!mapped.issues.is_empty());
}

#[test]
fn another_transform_does_not_enter_the_fixed_center_lowering() {
    let mut tokens = CENTER.to_vec();
    tokens.push("translate-x-1");
    let mapped = style_for_feedback_in_region(
        tokens,
        None,
        LengthContext::default(),
        Some(AvailableSpaceRect {
            x: 0.,
            y: 0.,
            width: 390.,
            height: 900.,
        }),
    );
    assert!(!mapped.fixed_centered);
    assert!(!mapped.issues.is_empty());
}
