//! The generated PairReader awaits two real files in one task.

use super::support::ObservedText;
use generated_gpui_consumer::{
    keyed_loader::{FileRequest, KeyedFiles},
    pair_reader::{ContextScope, PairReader, PairReaderProps, PAIR_ZONE},
};
use gpui::{div, prelude::*, px, rgb, size, Entity, Hsla, Point, TestAppContext, TestDispatcher, UnderlineStyle, Window, WindowHandle};
use proto_ui_gpui_support::{owned_tasks::{TaskHandle, TaskOutcome}, ActionOutcome, SegmentFailure};
use std::{cell::RefCell, rc::Rc, sync::Arc};

const INK: u32 = 0x3d5174;
const FONT_SIZE: f32 = 16.;
type Receipt = TaskHandle<PairReader, (), SegmentFailure>;

struct Surface(Option<Entity<PairReader>>);

impl Render for Surface {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        div().size_full().flex().flex_col().items_start().text_size(px(FONT_SIZE))
            .underline().text_decoration_color(rgb(INK)).children(self.0.clone())
    }
}

struct Fixture { window: WindowHandle<Surface>, text: Arc<ObservedText>, files: KeyedFiles }

impl Fixture {
    fn show(&self, cx: &mut TestAppContext, reader: Option<Entity<PairReader>>) {
        self.window.update(cx, |surface, _, cx| { surface.0 = reader; cx.notify(); }).unwrap();
    }

    fn mount(&self, cx: &mut TestAppContext, scope: ContextScope) -> Entity<PairReader> {
        let reader = cx.update(|app| PairReader::mount(PairReaderProps::default(), &scope, app)).unwrap();
        self.show(cx, Some(reader.clone()));
        reader
    }

    fn frame(&self, cx: &mut TestAppContext, expected: Option<&str>) {
        cx.run_until_parked();
        self.window.update(cx, |surface, window, app| {
            let ink = Hsla::from(rgb(INK));
            let strokes = window.painted_underlines();
            let mut labels = strokes.iter().filter(|stroke| stroke.color == ink);
            if let Some(stage) = expected {
                let reader = surface.0.as_ref().expect("a reader must be mounted");
                assert_eq!(reader.read(app).projection().stage(), stage);
                let line = labels.next().unwrap_or_else(|| panic!("missing painted stage {stage:?}"));
                assert_eq!(line.bounds.intersect(&line.content_mask.bounds), line.bounds);
                let underline = UnderlineStyle { thickness: px(1.), color: Some(ink), wavy: false };
                self.text.expect_painted_label(stage, |size, width| size == px(FONT_SIZE) &&
                    window.underline_bounds(Point::default(), width, &underline).size == line.bounds.size);
            }
            assert!(labels.next().is_none(), "unexpected additional painted stage");
        }).unwrap();
    }

    fn requests<const N: usize>(&self, key: &str) -> [FileRequest; N] {
        self.files.requests_for(key).try_into().unwrap_or_else(|found: Vec<FileRequest>| {
            panic!("expected {N} native requests for {key}, got {}", found.len())
        })
    }
}

fn with_window(test: impl FnOnce(&mut TestAppContext, &Fixture)) {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let files = KeyedFiles::default();
    cx.set_global(files.clone());
    let window = cx.open_window(size(px(1100.), px(120.)), |_, _| Surface(None));
    test(&mut cx, &Fixture { window, text, files });
    cx.quit();
}

fn begin(reader: &Entity<PairReader>, first: &str, second: &str, cx: &mut TestAppContext) -> Receipt {
    assert_eq!(reader.update(cx, |reader, cx| reader.actions(cx).begin(first.into(), second.into())), ActionOutcome::Committed);
    cx.run_until_parked();
    reader.read_with(cx, |reader, _| reader.tasks().readPair().expect("missing readPair receipt"))
}

// Stop at the recorded native return so the caller can sample the public stage and receipt.
fn return_file(file: &FileRequest, revision: &'static str, text: &str, cx: &TestAppContext) {
    assert_eq!(file.returned(), None);
    file.deliver(revision);
    while file.returned().is_none() { assert!(cx.dispatcher.tick(false), "file producer was not runnable"); }
    assert_eq!(file.returned().as_deref(), Some(text));
}

#[test]
fn two_file_awaits_publish_each_stage_and_read_current_context() {
    with_window(|cx, ui| {
        let zone = cx.new(|_| PAIR_ZONE.provider("left".into()));
        let reader = ui.mount(cx, ContextScope::default().with(PAIR_ZONE, zone.clone()));
        ui.frame(cx, Some("idle"));

        // The observer can read each changed stage and count externs already started at that commit.
        let initial = reader.read_with(cx, |reader, _| reader.projection().stage().to_owned());
        let stages = Rc::new(RefCell::new(vec![(initial, ui.files.len())]));
        let changes = stages.clone();
        let files = ui.files.clone();
        let _subscription = cx.update(|app| app.observe(&reader, move |reader, app| {
            let stage = reader.read(app).projection().stage().to_owned();
            let mut changes = changes.borrow_mut();
            if changes.last().map(|(previous, _)| previous) != Some(&stage) {
                changes.push((stage, files.len()));
            }
        }));
        let task = begin(&reader, "A", "B", cx);
        let first = "first@left";
        ui.frame(cx, Some(first));
        let [a] = ui.requests::<1>("A");
        assert_eq!(ui.files.len(), 1);
        zone.update(cx, |zone, cx| zone.publish("middle".into(), cx));
        return_file(&a, "new", "Apricot replacement", cx);
        reader.read_with(cx, |reader, _| assert_eq!(reader.projection().stage(), first));
        assert_eq!(task.outcome(), None);
        assert!(ui.files.requests_for("B").is_empty());

        let second = "second@left>middle=Apricot replacement";
        ui.frame(cx, Some(second));
        let [b] = ui.requests::<1>("B");
        zone.update(cx, |zone, cx| zone.publish("right".into(), cx));
        return_file(&b, "original", "Blue retained file", cx);
        reader.read_with(cx, |reader, _| assert_eq!(reader.projection().stage(), second));
        assert_eq!(task.outcome(), None);

        let final_stage = "left>middle>right=Apricot replacement/Blue retained file";
        ui.frame(cx, Some(final_stage));
        assert_eq!(task.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(&*stages.borrow(), &[
            ("idle".to_owned(), 0), (first.to_owned(), 0), (second.to_owned(), 1), (final_stage.to_owned(), 2),
        ]);
        assert_eq!(ui.files.len(), 2);
    });
}

#[test]
fn ending_the_owner_during_the_second_await_isolates_its_replacement() {
    with_window(|cx, ui| {
        let left = cx.new(|_| PAIR_ZONE.provider("left".into()));
        let original = ui.mount(cx, ContextScope::default().with(PAIR_ZONE, left));
        let weak = original.downgrade();
        let old_task = begin(&original, "C", "A", cx);
        ui.frame(cx, Some("first@left"));
        let [first_c] = ui.requests::<1>("C");
        first_c.deliver("temporary");
        ui.frame(cx, Some("second@left>left=Temporary chart"));
        let [late_a] = ui.requests::<1>("A");

        ui.show(cx, None);
        ui.frame(cx, None);
        assert!(weak.upgrade().is_some());
        assert_eq!(old_task.outcome(), None);
        drop(original);
        cx.update(|_| {});
        assert!(weak.upgrade().is_none());
        assert_eq!(old_task.outcome(), Some(&TaskOutcome::OwnerEnded));
        assert_eq!(late_a.returned(), None);

        let right = cx.new(|_| PAIR_ZONE.provider("right".into()));
        let replacement = ui.mount(cx, ContextScope::default().with(PAIR_ZONE, right));
        ui.frame(cx, Some("idle"));
        let new_task = begin(&replacement, "C", "A", cx);
        ui.frame(cx, Some("first@right"));
        let [original_c, new_c] = ui.requests::<2>("C");
        assert!(original_c.same_request(&first_c) && !new_c.same_request(&first_c));
        new_c.deliver("temporary");
        let pending = "second@right>right=Temporary chart";
        ui.frame(cx, Some(pending));
        let [original_a, new_a] = ui.requests::<2>("A");
        assert!(original_a.same_request(&late_a) && !new_a.same_request(&late_a));

        late_a.deliver("old");
        ui.frame(cx, Some(pending));
        assert_eq!(late_a.returned().as_deref(), Some("Obsolete amber record"));
        assert_eq!(new_a.returned(), None);
        assert_eq!(new_task.outcome(), None);
        new_a.deliver("new");
        ui.frame(cx, Some("right>right>right=Temporary chart/Apricot replacement"));
        assert_eq!(new_a.returned().as_deref(), Some("Apricot replacement"));
        assert_eq!(new_task.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(old_task.outcome(), Some(&TaskOutcome::OwnerEnded));
        assert_eq!(ui.files.len(), 4);
    });
}
