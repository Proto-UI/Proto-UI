//! The checked CFG first reads the caller's prefix in the block reached after both native reads.

use super::support::ObservedText;
use generated_gpui_consumer::{
    direct_pair_reader::{ContextScope, PairReader, PairReaderProps, PAIR_ZONE},
    keyed_loader::KeyedFiles,
};
use gpui::{prelude::*, px, rgb, Hsla, Point, TestAppContext, TestDispatcher, UnderlineStyle, WindowHandle};
use proto_ui_gpui_support::{owned_tasks::TaskOutcome, ActionOutcome};
use std::sync::Arc;

const FONT_SIZE: f32 = 16.;
const INK: u32 = 0x3d5174;

fn underline() -> UnderlineStyle {
    UnderlineStyle { thickness: px(1.), color: Some(rgb(INK).into()), wavy: false }
}

fn frame(cx: &mut TestAppContext, window: WindowHandle<PairReader>, text: &ObservedText, expected: &str) {
    cx.run_until_parked();
    window.update(cx, |reader, window, _| {
        assert_eq!(reader.projection().stage(), expected);
        let lines = window.painted_underlines();
        let mut labels = lines.iter().filter(|line| line.color == Hsla::from(rgb(INK)));
        let label = labels.next().expect("missing painted reader label");
        assert_eq!(label.bounds.intersect(&label.content_mask.bounds), label.bounds);
        text.expect_painted_label(expected, |size, width| size == px(FONT_SIZE) &&
            window.underline_bounds(Point::default(), width, &underline()).size == label.bounds.size);
        assert!(labels.next().is_none(), "another reader label was painted");
    }).unwrap();
}

#[test]
fn original_parameter_is_first_read_after_two_awaits_and_a_jump() {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let files = KeyedFiles::default();
    cx.set_global(files.clone());
    let zone = cx.new(|_| PAIR_ZONE.provider("left".to_owned()));
    let scope = ContextScope::default().with(PAIR_ZONE, zone);
    let reader = cx.update(|app| PairReader::mount(PairReaderProps::default(), &scope, app)).unwrap();
    reader.update(&mut cx, |reader, cx| reader.set_appearance(|_, style| {
        style.text.font_size = Some(px(FONT_SIZE).into());
        style.text.underline = Some(underline());
    }, cx));
    let window = cx.update(|app| app.open_window(Default::default(), |_, _| reader.clone())).unwrap();
    frame(&mut cx, window, &text, "idle");

    let mut stage = String::from("idle");
    for (completed_pairs, prefix) in ["caller supplied: ", "alternate caller: "].into_iter().enumerate() {
        let action = reader.update(&mut cx, |reader, cx| reader.actions(cx).begin("A".to_owned(), prefix.to_owned()));
        assert_eq!(action, ActionOutcome::Committed);
        frame(&mut cx, window, &text, &stage);
        let task = reader.read_with(&cx, |reader, _| reader.tasks().readPair()).expect("missing pair task receipt");
        let a = files.requests_for("A").pop().expect("missing first file request");
        assert_eq!(files.len(), 2 * completed_pairs + 1);
        assert_eq!(files.requests_for("B").len(), completed_pairs);
        assert_eq!(a.returned(), None);
        assert_eq!(task.outcome(), None);

        a.deliver("old");
        frame(&mut cx, window, &text, &stage);
        assert_eq!(a.returned().as_deref(), Some("Obsolete amber record"));
        let b = files.requests_for("B").pop().expect("missing second file request");
        assert_eq!(files.len(), 2 * completed_pairs + 2);
        assert_eq!(b.returned(), None);
        assert_eq!(task.outcome(), None);

        b.deliver("original");
        stage = format!("{prefix}Blue retained file");
        frame(&mut cx, window, &text, &stage);
        assert_eq!(b.returned().as_deref(), Some("Blue retained file"));
        assert_eq!(task.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(files.len(), 2 * completed_pairs + 2);
    }
    cx.quit();
}
