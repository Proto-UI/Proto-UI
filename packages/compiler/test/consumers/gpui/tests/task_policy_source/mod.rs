//! T-COMPILER-FOUNDATION-0001-CASE-TASKS with the shared authored PolicyReader and native files.

use super::support::ObservedText;
use generated_gpui_consumer::{
    keyed_loader::{FileRequest, KeyedFiles},
    policy_reader::{ContextScope, PolicyReader, PolicyReaderProps, POLICY_ZONE},
};
use gpui::{
    div, prelude::*, px, rgb, size, Entity, Hsla, Point, TestAppContext, TestDispatcher,
    UnderlineStyle, Window, WindowHandle,
};
use proto_ui_gpui_support::{owned_tasks::{TaskHandle, TaskOutcome}, ActionOutcome, SegmentFailure};
use std::sync::Arc;

const FONT_SIZE: f32 = 14.;
const INK: u32 = 0x425679;
type Receipt = TaskHandle<PolicyReader, (), SegmentFailure>;

struct Surface(Option<Entity<PolicyReader>>);

impl Render for Surface {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        div().size_full().flex().flex_col().items_start()
            .text_size(px(FONT_SIZE)).underline().text_decoration_color(rgb(INK))
            .children(self.0.clone())
    }
}

struct PolicyWindow {
    window: WindowHandle<Surface>,
    text: Arc<ObservedText>,
}

impl PolicyWindow {
    fn show(&self, cx: &mut TestAppContext, reader: Option<&Entity<PolicyReader>>) {
        self.window.update(cx, |surface, _, cx| { surface.0 = reader.cloned(); cx.notify(); }).unwrap();
    }

    fn paint(&self, cx: &mut TestAppContext, expected: Option<&str>) {
        cx.run_until_parked();
        cx.update_window(self.window.into(), |_, window, _| {
            let ink = Hsla::from(rgb(INK));
            let strokes = window.painted_underlines();
            let mut painted = strokes.iter().filter(|line| line.color == ink);
            if let Some(label) = expected {
                let line = painted.next().unwrap_or_else(|| panic!("missing painted policy log {label:?}"));
                assert_eq!(line.bounds.intersect(&line.content_mask.bounds), line.bounds, "clipped policy log");
                let style = UnderlineStyle { thickness: px(1.), color: Some(ink), wavy: false };
                self.text.expect_painted_label(label, |font_size, width| {
                    font_size == px(FONT_SIZE) && window.underline_bounds(Point::default(), width, &style).size == line.bounds.size
                });
            }
            assert!(painted.next().is_none(), "unexpected additional policy log painted");
        }).unwrap();
    }

    fn logs(&self, cx: &mut TestAppContext, reader: &Entity<PolicyReader>, ordered: &str, parallel: &str) {
        self.paint(cx, Some(&format!("{ordered} | {parallel}")));
        reader.read_with(cx, |reader, _| {
            let projection = reader.projection();
            assert_eq!(projection.orderedLog(), ordered);
            assert_eq!(projection.parallelLog(), parallel);
        });
    }
}

fn with_window(test: impl FnOnce(&mut TestAppContext, &PolicyWindow, &KeyedFiles)) {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let files = KeyedFiles::default();
    cx.set_global(files.clone());
    let window = cx.open_window(size(px(1600.), px(140.)), |_, _| Surface(None));
    test(&mut cx, &PolicyWindow { window, text }, &files);
    cx.quit();
}

fn mount(cx: &TestAppContext, scope: ContextScope) -> Entity<PolicyReader> {
    cx.update(|app| PolicyReader::mount(PolicyReaderProps::default(), &scope, app)).unwrap()
}

// Read the public receipt after each individual submission, before the next action replaces it.
fn queue(reader: &Entity<PolicyReader>, id: &str, cx: &mut TestAppContext) -> Receipt {
    assert_eq!(reader.update(cx, |reader, cx| reader.actions(cx).queue(id.to_owned())), ActionOutcome::Committed);
    cx.run_until_parked();
    reader.read_with(cx, |reader, _| reader.tasks().ordered().expect("missing ordered receipt"))
}

fn submit(reader: &Entity<PolicyReader>, id: &str, cx: &mut TestAppContext) -> Receipt {
    assert_eq!(reader.update(cx, |reader, cx| reader.actions(cx).submit(id.to_owned())), ActionOutcome::Committed);
    cx.run_until_parked();
    reader.read_with(cx, |reader, _| reader.tasks().concurrent().expect("missing concurrent receipt"))
}

fn requests<const N: usize>(files: &KeyedFiles, id: &str) -> [FileRequest; N] {
    files.requests_for(id).try_into().unwrap_or_else(|found: Vec<FileRequest>| {
        panic!("expected {N} native requests for {id}, got {}", found.len())
    })
}

#[test]
fn declared_serial_and_parallel_tasks_capture_context_at_their_own_start() {
    with_window(|cx, ui, files| {
        let zone = cx.new(|_| POLICY_ZONE.provider("left".into()));
        let reader = mount(cx, ContextScope::default().with(POLICY_ZONE, zone.clone()));
        ui.show(cx, Some(&reader));
        ui.logs(cx, &reader, "", "");
        assert_eq!(files.len(), 0);

        let serial_a = queue(&reader, "A", cx);
        let [ordered_file] = requests::<1>(files, "A");
        let serial_b = queue(&reader, "B", cx);
        assert!(files.requests_for("B").is_empty(), "the queued first segment ran before A completed");
        let parallel_c = submit(&reader, "C", cx);
        let parallel_a = submit(&reader, "A", cx);
        let [c_file] = requests::<1>(files, "C");
        let [first_a_file, parallel_file] = requests::<2>(files, "A");
        assert!(first_a_file.same_request(&ordered_file));
        assert!(!parallel_file.same_request(&ordered_file));
        assert_eq!(files.len(), 3);
        for task in [&serial_a, &serial_b, &parallel_c, &parallel_a] { assert_eq!(task.outcome(), None); }

        zone.update(cx, |zone, cx| zone.publish("right".into(), cx));
        parallel_file.deliver("new");
        let parallel_first = "A@left>right=Apricot replacement;";
        ui.logs(cx, &reader, "", parallel_first);
        assert_eq!(parallel_file.returned().as_deref(), Some("Apricot replacement"));
        assert_eq!(parallel_a.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(parallel_c.outcome(), None);
        assert_eq!(c_file.returned(), None);
        assert_eq!(serial_a.outcome(), None);
        assert_eq!(ordered_file.returned(), None);
        assert!(files.requests_for("B").is_empty());

        ordered_file.deliver("old");
        while serial_a.outcome().is_none() {
            assert!(files.requests_for("B").is_empty(), "serial B began before A's terminal receipt");
            assert!(cx.dispatcher.tick(false), "serial A did not reach its terminal receipt");
        }
        assert_eq!(serial_a.outcome(), Some(&TaskOutcome::Completed(())));
        let ordered_first = "A@left>right=Obsolete amber record;";
        ui.logs(cx, &reader, ordered_first, parallel_first);
        assert_eq!(ordered_file.returned().as_deref(), Some("Obsolete amber record"));
        let [b_file] = requests::<1>(files, "B");
        assert_eq!(serial_b.outcome(), None);
        assert_eq!(b_file.returned(), None);
        assert_eq!(files.len(), 4);

        c_file.deliver("temporary");
        let parallel_both = format!("{parallel_first}C@left>right=Temporary chart;");
        ui.logs(cx, &reader, ordered_first, &parallel_both);
        assert_eq!(c_file.returned().as_deref(), Some("Temporary chart"));
        assert_eq!(parallel_c.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(serial_b.outcome(), None);

        zone.update(cx, |zone, cx| zone.publish("left".into(), cx));
        b_file.deliver("original");
        let ordered_both = format!("{ordered_first}B@right>left=Blue retained file;");
        ui.logs(cx, &reader, &ordered_both, &parallel_both);
        assert_eq!(b_file.returned().as_deref(), Some("Blue retained file"));
        for task in [&serial_a, &serial_b, &parallel_c, &parallel_a] {
            assert_eq!(task.outcome(), Some(&TaskOutcome::Completed(())));
        }
        assert_eq!(files.len(), 4);
    });
}

#[test]
fn cancelling_serial_reads_keeps_parallel_work_live_and_allows_a_fresh_read() {
    const ORDERED: &str = "B@left>left=Blue retained file;";
    const PARALLEL: &str = "C@left>left=Temporary chart;";

    with_window(|cx, ui, files| {
        let zone = cx.new(|_| POLICY_ZONE.provider("left".into()));
        let reader = mount(cx, ContextScope::default().with(POLICY_ZONE, zone));
        ui.show(cx, Some(&reader));
        ui.logs(cx, &reader, "", "");
        let _observation = cx.update(|app| app.observe(&reader, |entity, app| {
            let projection = entity.read(app).projection();
            let logs = (projection.orderedLog(), projection.parallelLog());
            assert!(matches!(logs, ("", "") | (ORDERED, "") | (ORDERED, PARALLEL)),
                "unexpected published policy logs {logs:?}");
        }));

        let active_a = queue(&reader, "A", cx);
        let queued_b = queue(&reader, "B", cx);
        let parallel_c = submit(&reader, "C", cx);
        let [old_a] = requests::<1>(files, "A");
        let [c_file] = requests::<1>(files, "C");
        assert!(files.requests_for("B").is_empty());
        assert_eq!(files.len(), 2);
        for task in [&active_a, &queued_b, &parallel_c] { assert_eq!(task.outcome(), None); }

        assert_eq!(reader.update(cx, |reader, cx| reader.actions(cx).cancelOrdered()), ActionOutcome::Committed);
        ui.logs(cx, &reader, "", "");
        assert_eq!(active_a.outcome(), Some(&TaskOutcome::Cancelled));
        assert_eq!(queued_b.outcome(), Some(&TaskOutcome::Cancelled));
        assert_eq!(parallel_c.outcome(), None);
        assert_eq!(old_a.returned(), None);
        assert_eq!(c_file.returned(), None);
        assert!(files.requests_for("B").is_empty(), "the cancelled queued read reached the host");
        assert_eq!(files.len(), 2);

        let fresh_b = queue(&reader, "B", cx);
        let [b_file] = requests::<1>(files, "B");
        assert!(!b_file.same_request(&old_a));
        assert_eq!(files.len(), 3);
        assert_eq!(fresh_b.outcome(), None);
        assert_eq!(queued_b.outcome(), Some(&TaskOutcome::Cancelled));

        old_a.deliver("old");
        ui.logs(cx, &reader, "", "");
        assert_eq!(old_a.returned().as_deref(), Some("Obsolete amber record"));
        assert_eq!(active_a.outcome(), Some(&TaskOutcome::Cancelled));
        assert_eq!(b_file.returned(), None);
        assert_eq!(c_file.returned(), None);
        assert_eq!(fresh_b.outcome(), None);
        assert_eq!(parallel_c.outcome(), None);

        b_file.deliver("original");
        ui.logs(cx, &reader, ORDERED, "");
        assert_eq!(b_file.returned().as_deref(), Some("Blue retained file"));
        assert_eq!(fresh_b.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(c_file.returned(), None);
        assert_eq!(parallel_c.outcome(), None);

        c_file.deliver("temporary");
        ui.logs(cx, &reader, ORDERED, PARALLEL);
        assert_eq!(c_file.returned().as_deref(), Some("Temporary chart"));
        assert_eq!(parallel_c.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(fresh_b.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(active_a.outcome(), Some(&TaskOutcome::Cancelled));
        assert_eq!(queued_b.outcome(), Some(&TaskOutcome::Cancelled));
        assert_eq!(files.len(), 3);
    });
}

#[test]
fn disposing_a_reader_retires_its_active_and_queued_serial_submissions() {
    with_window(|cx, ui, files| {
        let left = cx.new(|_| POLICY_ZONE.provider("left".into()));
        let original = mount(cx, ContextScope::default().with(POLICY_ZONE, left));
        let original_id = original.entity_id();
        let weak = original.downgrade();
        ui.show(cx, Some(&original));
        let active = queue(&original, "A", cx);
        let queued = queue(&original, "B", cx);
        let [late] = requests::<1>(files, "A");
        assert!(files.requests_for("B").is_empty());
        ui.logs(cx, &original, "", "");
        ui.show(cx, None);
        ui.paint(cx, None);
        assert!(weak.upgrade().is_some());
        assert_eq!(active.outcome(), None);
        assert_eq!(queued.outcome(), None);

        drop(original);
        cx.update(|_| {});
        assert!(weak.upgrade().is_none());
        assert_eq!(active.outcome(), Some(&TaskOutcome::OwnerEnded));
        assert_eq!(queued.outcome(), Some(&TaskOutcome::OwnerEnded));
        assert_eq!(late.returned(), None);
        assert_eq!(files.len(), 1);

        let right = cx.new(|_| POLICY_ZONE.provider("right".into()));
        let replacement = mount(cx, ContextScope::default().with(POLICY_ZONE, right));
        assert_ne!(replacement.entity_id(), original_id);
        ui.show(cx, Some(&replacement));
        let fresh_a = queue(&replacement, "A", cx);
        let fresh_b = queue(&replacement, "B", cx);
        let [original_a, new_a] = requests::<2>(files, "A");
        assert!(original_a.same_request(&late) && !new_a.same_request(&late));
        assert!(files.requests_for("B").is_empty());

        late.deliver("old");
        ui.logs(cx, &replacement, "", "");
        assert_eq!(late.returned().as_deref(), Some("Obsolete amber record"));
        assert_eq!(new_a.returned(), None);
        assert_eq!(fresh_a.outcome(), None);
        assert_eq!(fresh_b.outcome(), None);
        assert!(files.requests_for("B").is_empty(), "the old completion started queued work");

        new_a.deliver("new");
        let first = "A@right>right=Apricot replacement;";
        ui.logs(cx, &replacement, first, "");
        assert_eq!(new_a.returned().as_deref(), Some("Apricot replacement"));
        assert_eq!(fresh_a.outcome(), Some(&TaskOutcome::Completed(())));
        let [new_b] = requests::<1>(files, "B");
        assert_eq!(fresh_b.outcome(), None);
        new_b.deliver("original");
        ui.logs(cx, &replacement, &format!("{first}B@right>right=Blue retained file;"), "");
        assert_eq!(new_b.returned().as_deref(), Some("Blue retained file"));
        assert_eq!(fresh_b.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(active.outcome(), Some(&TaskOutcome::OwnerEnded));
        assert_eq!(queued.outcome(), Some(&TaskOutcome::OwnerEnded));
        assert_eq!(files.len(), 3);
    });
}
