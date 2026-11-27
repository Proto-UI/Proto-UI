use super::support::ObservedText;
use generated_gpui_consumer::authoring_badge::{AuthoringBadge, AuthoringBadgeProps};
use gpui::{
    px, rgb, size, AlignItems, Display, FlexDirection, Hsla, Point,
    StyleRefinement, TestAppContext, TestDispatcher, UnderlineStyle, Window, WindowHandle,
};
use std::{cell::Cell, rc::Rc, sync::Arc};

const CHIP_WIDTH: f32 = 238.;
const CHIP_HEIGHT: f32 = 44.;
const DOT_SIZE: f32 = 12.;
const COMMON: u32 = 0x385067;
const ONLINE: u32 = 0x287344;
const CONNECTING: u32 = 0x8e5c1d;
const RECONNECTING: u32 = 0x81528f;
const LOCAL: u32 = 0x33418b;
const DOT: u32 = 0xd9a63b;
const LABEL: u32 = 0xf2e9d5;

fn label_underline() -> UnderlineStyle {
    UnderlineStyle { thickness: px(1.), color: Some(rgb(LABEL).into()), wavy: false }
}

// This consumer theme resolves only the tokens it receives from the native view.
// Common chip geometry survives an online fill override. The dot owns its own box.
fn bind_token(token: &str, style: &mut StyleRefinement) {
    let fill = match token {
        "shenko-status-chip" => {
            style.display = Some(Display::Flex);
            style.flex_direction = Some(FlexDirection::Row);
            style.align_items = Some(AlignItems::Center);
            style.size.width = Some(px(CHIP_WIDTH).into());
            style.size.height = Some(px(CHIP_HEIGHT).into());
            style.text.font_size = Some(px(20.).into());
            style.text.color = Some(rgb(LABEL).into());
            style.text.underline = Some(label_underline());
            COMMON
        }
        "shenko-status-online" => ONLINE,
        "shenko-status-connecting" => CONNECTING,
        "shenko-status-reconnecting" => RECONNECTING,
        "shenko-status-local" => LOCAL,
        "shenko-status-dot" => {
            style.size.width = Some(px(DOT_SIZE).into());
            style.size.height = Some(px(DOT_SIZE).into());
            DOT
        }
        _ => panic!("unexpected Badge style token {token:?}"),
    };
    style.background = Some(rgb(fill).into());
}

fn assert_frame(window: &Window, expected_fill: u32, label: &str, text: &ObservedText) {
    let scale = window.scale_factor();
    let quads = window.painted_quads();
    let root_colors = [COMMON, ONLINE, CONNECTING, RECONNECTING, LOCAL].map(|c| Hsla::from(rgb(c)));
    let mut chips = quads.iter().enumerate().filter(|(_, q)| {
        q.background.as_solid().is_some_and(|color| root_colors.contains(&color))
    });
    let (chip_index, chip) = chips.next().expect("the chip painted a host fill");
    assert!(chips.next().is_none(), "a stale or duplicate chip also painted");
    assert_eq!(chip.background.as_solid(), Some(Hsla::from(rgb(expected_fill))));
    assert_eq!(chip.bounds.size, size(px(CHIP_WIDTH), px(CHIP_HEIGHT)).scale(scale));
    assert_eq!(chip.bounds.intersect(&chip.content_mask.bounds), chip.bounds);

    let mut dots = quads.iter().enumerate()
        .filter(|(_, q)| q.background.as_solid() == Some(Hsla::from(rgb(DOT))));
    let (dot_index, dot) = dots.next().expect("the styled inner element painted its dot");
    assert!(dots.next().is_none(), "more than one inner dot painted");
    assert_eq!(dot.bounds.size, size(px(DOT_SIZE), px(DOT_SIZE)).scale(scale));
    assert_eq!(dot.bounds.intersect(&dot.content_mask.bounds), dot.bounds);
    assert_eq!(dot.bounds.intersect(&chip.bounds), dot.bounds);
    assert!(dot_index > chip_index, "the dot must paint in front of its chip");

    // GPUI paints this underline when it paints the label's shaped glyph run.
    // Its width identifies the label even when GPUI reused a cached layout.
    let underlines = window.painted_underlines();
    let mut labels = underlines.iter().filter(|u| u.color == Hsla::from(rgb(LABEL)));
    if !label.is_empty() {
        let line = labels.next().expect("the nonempty label was painted");
        text.expect_label_at_width(label, |advance| {
            window.underline_bounds(Point::default(), advance, &label_underline()).size == line.bounds.size
        });
        assert_eq!(line.bounds.intersect(&line.content_mask.bounds), line.bounds);
        assert_eq!(line.bounds.intersect(&chip.bounds), line.bounds);
        assert!(line.bounds.left() >= dot.bounds.right(), "the label must follow the dot");
    }
    assert!(labels.next().is_none(), "an unexpected label run was painted");
}

fn assert_badge(
    window: WindowHandle<AuthoringBadge>,
    cx: &mut TestAppContext,
    label: &str,
    tone: &str,
    fill: u32,
    text: &ObservedText,
) {
    window.update(cx, |view, window, _| {
        let projection = view.projection();
        assert_eq!(projection.label(), label);
        assert_eq!(projection.tone(), tone);
        assert_frame(window, fill, label, text);
    }).unwrap();
}

// Independent checked-IR consumer trace for T-COMPILER-AUTHORING-0001-CASE-BADGE.
#[test]
fn retained_authoring_badge_paints_its_label_chip_and_nested_dot_as_inputs_change() {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let window = cx.add_window(|_, _| AuthoringBadge::new(AuthoringBadgeProps::default(), bind_token));
    let badge = window.root(&mut cx).unwrap();
    let notifications = Rc::new(Cell::new(0));
    let observed = notifications.clone();
    let subscription = cx.update(|app| app.observe(&badge, move |_, _| {
        observed.set(observed.get() + 1);
    }));
    assert_badge(window, &mut cx, "", "offline", COMMON, &text);

    // Omit tone on this update as well as at mount; its schema default supplies offline.
    badge.update(&mut cx, |view, cx| view.set_props(AuthoringBadgeProps {
        label: "Offline".into(), ..Default::default()
    }, cx));
    assert_badge(window, &mut cx, "Offline", "offline", COMMON, &text);

    // Distinct label advances let the painted stroke identify exactly one shaped string.
    for (label, tone, fill) in [
        ("Connected", "online", ONLINE),
        ("Retitled", "online", ONLINE),
    ] {
        badge.update(&mut cx, |view, cx| view.set_props(AuthoringBadgeProps {
            label: label.into(), tone: tone.into(),
        }, cx));
        assert_badge(window, &mut cx, label, tone, fill, &text);
    }

    let label = "Unmodified";
    for (tone, fill) in [
        ("connecting", CONNECTING), ("reconnecting", RECONNECTING), ("local", LOCAL),
        ("some-future-tone", COMMON), ("online", ONLINE),
    ] {
        badge.update(&mut cx, |view, cx| view.set_props(AuthoringBadgeProps {
            label: label.into(), tone: tone.into(),
        }, cx));
        assert_badge(window, &mut cx, label, tone, fill, &text);
    }

    // The observer saw real prop publications. Redrawing with the same inputs
    // must keep the same visible result without notifying the host again.
    let published = notifications.get();
    assert!(published > 0, "the observer saw no preceding prop changes");
    for _ in 0..2 {
        window.update(&mut cx, |_, window, _| window.refresh()).unwrap();
        cx.run_until_parked();
        assert_badge(window, &mut cx, label, "online", ONLINE, &text);
        assert_eq!(notifications.get(), published, "a redraw published a Badge change");
    }

    badge.update(&mut cx, |view, cx| view.set_props(AuthoringBadgeProps::default(), cx));
    assert_badge(window, &mut cx, "", "offline", COMMON, &text);
    assert!(notifications.get() > published, "restoring the default props did not publish");

    drop((subscription, badge));
    cx.quit();
}
