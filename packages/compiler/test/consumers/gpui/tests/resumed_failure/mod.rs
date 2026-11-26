//! A generated task rolls back its resumed writes while retaining the stage published before await.

use super::support::ObservedText;
use generated_gpui_consumer::{
    failure_reader::{ContextScope, FailureReader, FailureReaderProps, EXPECTED_DOCUMENT},
    keyed_loader::KeyedFiles,
};
use gpui::{prelude::*, px, rgb, Entity, Hsla, Point, TestAppContext, TestDispatcher, UnderlineStyle, WindowHandle};
use proto_ui_gpui_support::{owned_tasks::{TaskHandle, TaskOutcome}, ActionOutcome, SegmentFailure};
use std::{cell::RefCell, rc::Rc, sync::Arc};

const OLD: &str = "Obsolete amber record";
const NEW: &str = "Apricot replacement";
const INK: u32 = 0x563b67;
const FONT_SIZE: f32 = 16.;

fn underline() -> UnderlineStyle {
    UnderlineStyle { thickness: px(1.), color: Some(rgb(INK).into()), wavy: false }
}

fn state(reader: &FailureReader) -> (String, f64) {
    let projection = reader.projection();
    (projection.stage().to_owned(), projection.accepted())
}

fn frame(cx: &mut TestAppContext, window: WindowHandle<FailureReader>, text: &ObservedText,
    stage: &str, accepted: f64, expected: &str) {
    cx.run_until_parked();
    window.update(cx, |reader, window, _| {
        let projection = reader.projection();
        assert_eq!((projection.stage(), projection.accepted(), projection.expected()), (stage, accepted, expected));
        let lines = window.painted_underlines();
        let mut painted = lines.iter().filter(|line| line.color == Hsla::from(rgb(INK)));
        let line = painted.next().unwrap_or_else(|| panic!("missing painted stage {stage:?}"));
        assert_eq!(line.bounds.intersect(&line.content_mask.bounds), line.bounds);
        text.expect_painted_label(stage, |size, width| size == px(FONT_SIZE) &&
            window.underline_bounds(Point::default(), width, &underline()).size == line.bounds.size);
        assert!(painted.next().is_none(), "another stage painted in the same window");
    }).unwrap();
}

fn begin(reader: &Entity<FailureReader>, cx: &mut TestAppContext) -> TaskHandle<FailureReader, (), SegmentFailure> {
    assert_eq!(reader.update(cx, |reader, cx| reader.actions(cx).begin("A".into())), ActionOutcome::Committed);
    cx.run_until_parked();
    reader.read_with(cx, |reader, _| reader.tasks().readItem().expect("begin submitted readItem"))
}

#[test]
fn failed_resumed_writes_stay_unpublished_and_the_next_read_commits() {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let files = KeyedFiles::default();
    cx.set_global(files.clone());
    let document = cx.new(|_| EXPECTED_DOCUMENT.provider(OLD.to_owned()));
    let scope = ContextScope::default().with(EXPECTED_DOCUMENT, document.clone());
    let reader = cx.update(|app| FailureReader::mount(FailureReaderProps::default(), &scope, app)).unwrap();
    reader.update(&mut cx, |reader, cx| reader.set_appearance(|_, style| {
        style.text.font_size = Some(px(FONT_SIZE).into());
        style.text.underline = Some(underline());
    }, cx));
    let window = cx.update(|app| app.open_window(Default::default(), |_, _| reader.clone())).unwrap();
    frame(&mut cx, window, &text, "idle", 0., OLD);
    let publications = Rc::new(RefCell::new(vec![reader.read_with(&cx, |reader, _| state(reader))]));
    let observed = publications.clone();
    let _observation = cx.update(|app| app.observe(&reader, move |entity, app| {
        observed.borrow_mut().push(state(entity.read(app)));
    }));

    let checking_old = format!("checking@{OLD}");
    let rejected = begin(&reader, &mut cx);
    frame(&mut cx, window, &text, &checking_old, 0., OLD);
    assert_eq!(files.len(), 1);
    let original = files.requests_for("A").pop().expect("missing original A request");
    document.update(&mut cx, |provider, cx| provider.publish(NEW.to_owned(), cx));
    frame(&mut cx, window, &text, &checking_old, 0., NEW);
    assert_eq!(original.returned(), None);
    assert_eq!(rejected.outcome(), None);

    original.deliver("old");
    frame(&mut cx, window, &text, &checking_old, 0., NEW);
    assert_eq!(original.returned().as_deref(), Some(OLD));
    let failure = TaskOutcome::Failed(SegmentFailure {
        reason: "document-changed", file: "packages/compiler/test/fixtures/backend-programs.ts", start: 0, end: 0,
    });
    assert_eq!(rejected.outcome(), Some(&failure));

    let checking_new = format!("checking@{NEW}");
    let retry = begin(&reader, &mut cx);
    frame(&mut cx, window, &text, &checking_new, 0., NEW);
    let [first, second]: [_; 2] = files.requests_for("A").try_into().unwrap_or_else(|_| panic!("expected two A requests"));
    assert!(first.same_request(&original) && !second.same_request(&original));
    assert_eq!(retry.outcome(), None);
    assert_eq!(second.returned(), None);
    second.deliver("new");
    frame(&mut cx, window, &text, NEW, 1., NEW);
    assert_eq!(second.returned().as_deref(), Some(NEW));
    assert_eq!(retry.outcome(), Some(&TaskOutcome::Completed(())));
    assert_eq!(rejected.outcome(), Some(&failure));
    assert_eq!(files.len(), 2);

    // Context changes can notify again with the same state. Keep every distinct observed pair.
    let mut published = publications.take();
    published.dedup();
    assert_eq!(published, [("idle".to_owned(), 0.), (checking_old, 0.), (checking_new, 0.), (NEW.to_owned(), 1.)]);
    cx.quit();
}
