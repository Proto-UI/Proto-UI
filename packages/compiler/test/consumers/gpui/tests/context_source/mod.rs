//! The authored owner renders its keyed reader. A separately mounted reader lets
//! a native host move the physical view and replace its logical provider independently.

use super::support::ObservedText;
use generated_gpui_consumer::context_owner::{
    ContextScope, LevelOwner, LevelOwnerProps, LevelReader, LevelReaderProps, MissingContext,
    LEVEL, OTHER,
};
use gpui::{
    div, prelude::*, px, rgb, AnyView, App, Entity, Hsla, NoopTextSystem, PlatformTextSystem, Point,
    TestAppContext, TestDispatcher, UnderlineStyle, Window, WindowHandle,
};
use proto_ui_gpui_support::ActionOutcome;
use std::{cell::Cell, rc::Rc, sync::Arc};

const FONT_SIZE: f32 = 20.;
const INK: u32 = 0x372d93;

struct Surface {
    view: Option<AnyView>,
}

impl Render for Surface {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        div()
            .size_full()
            .flex()
            .flex_col()
            .items_start()
            .text_size(px(FONT_SIZE))
            .underline()
            .text_decoration_color(rgb(INK))
            .children(self.view.clone())
    }
}

fn present(window: WindowHandle<Surface>, cx: &mut TestAppContext, view: Option<AnyView>) {
    window.update(cx, |surface, _, cx| {
        surface.view = view;
        cx.notify();
    }).unwrap();
}

// Identify the strings actually shaped and painted in this window, including
// cached runs. The headless font is monospace for the ASCII in these cases.
// A target may join adjacent runs; compare their full visible text in order.
fn assert_text(
    window: WindowHandle<Surface>,
    cx: &mut TestAppContext,
    text: &ObservedText,
    expected: &str,
) {
    cx.run_until_parked();
    cx.update_window(window.into(), |_, window, _| {
        let mut strokes = window.painted_underlines();
        strokes.retain(|stroke| stroke.color == Hsla::from(rgb(INK)));
        strokes.sort_unstable_by_key(|stroke| stroke.bounds.left());
        let style = UnderlineStyle { thickness: px(1.), color: Some(rgb(INK).into()), wavy: false };
        let char_width = NoopTextSystem.layout_line("M", px(FONT_SIZE), &[]).width;
        let mut remaining = expected;
        let mut previous = None;
        for stroke in strokes {
            let bounds = stroke.bounds;
            assert_eq!(bounds.intersect(&stroke.content_mask.bounds), bounds, "clipped reader text");
            if let Some((y, right)) = previous {
                assert_eq!(y, bounds.top(), "the reader text wrapped unexpectedly");
                assert!(right <= bounds.left(), "two painted pieces of the reader overlap");
            }
            let same_size = |advance| window.underline_bounds(Point::default(), advance, &style).size == bounds.size;
            let count = (1..=remaining.len()).find(|&n| same_size(char_width * n))
                .unwrap_or_else(|| panic!("unexpected painted width {:?} while reading {remaining:?}", bounds.size.width));
            let (run, rest) = remaining.split_at(count);
            text.expect_label_at_width(run, same_size);
            remaining = rest;
            previous = Some((bounds.top(), bounds.right()));
        }
        assert!(remaining.is_empty(), "missing painted text {remaining:?} in {expected:?}");
    }).unwrap();
}

fn mount_reader(cx: &TestAppContext, scope: &ContextScope) -> Entity<LevelReader> {
    cx.update(|app| LevelReader::mount(LevelReaderProps::default(), scope, app))
        .unwrap_or_else(|error| panic!("expected the logical scope to supply {}", error.key))
}

fn assert_reader(reader: &Entity<LevelReader>, cx: &TestAppContext, initial: &str, current: &str) {
    reader.read_with(cx, |reader, _| {
        let projection = reader.projection();
        assert_eq!(projection.initial(), initial);
        assert_eq!(projection.current(), current);
    });
}

fn count_notifications(reader: &Entity<LevelReader>, cx: &TestAppContext) -> (Rc<Cell<usize>>, gpui::Subscription) {
    let count = Rc::new(Cell::new(0));
    let observed = count.clone();
    let subscription = cx.update(|app| app.observe(reader, move |_, _| observed.set(observed.get() + 1)));
    (count, subscription)
}

fn select(owner: &Entity<LevelOwner>, app: &mut App, next: &str) {
    let outcome = owner.update(app, |owner, cx| owner.actions(cx).select(next.to_owned()));
    assert_eq!(outcome, ActionOutcome::Committed);
    assert_eq!(owner.read(app).projection().value(), next);
}

#[test]
fn authored_owner_keeps_the_keyed_reader_and_supplies_a_reader_in_another_window() {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let owner = cx.update(|app| LevelOwner::mount(LevelOwnerProps::default(), &ContextScope::default(), app))
        .unwrap_or_else(|error| panic!("the authored owner unexpectedly requires {}", error.key));
    let root = cx.add_window(|_, _| Surface { view: Some(owner.clone().into()) });
    owner.read_with(&cx, |owner, _| assert_eq!(owner.projection().value(), "first"));
    assert_text(root, &mut cx, &text, "first / first");

    cx.update(|app| select(&owner, app, "second-level"));
    assert_text(root, &mut cx, &text, "first / second-level");
    let scope = owner.read_with(&cx, |owner, _| owner.child_scope());
    let reader = mount_reader(&cx, &scope);
    let remote = cx.add_window(|_, _| Surface { view: Some(reader.clone().into()) });
    assert_reader(&reader, &cx, "second-level", "second-level");
    assert_text(remote, &mut cx, &text, "second-level / second-level");

    // The native windows have independent physical roots. Only the generated
    // owner supplies the logical LEVEL used by the reader in the other window.
    present(root, &mut cx, None);
    assert_text(root, &mut cx, &text, "");
    cx.update(|app| {
        select(&owner, app, "peak");
        // Read both entities after the native action commits, inside the same
        // App update. A later notification or frame cannot repair a stale read.
        let projection = reader.read(app).projection();
        assert_eq!((projection.initial(), projection.current()), ("second-level", "peak"));
    });
    assert_text(remote, &mut cx, &text, "second-level / peak");
    assert_text(root, &mut cx, &text, "");
    present(root, &mut cx, Some(owner.clone().into()));
    assert_text(root, &mut cx, &text, "first / peak");
    drop((reader, owner, scope));
    cx.quit();
}

#[gpui::test]
fn required_reader_rejects_absence_and_the_other_key_with_the_same_label(cx: &mut TestAppContext) {
    fn missing(cx: &TestAppContext, scope: &ContextScope) -> MissingContext {
        match cx.update(|app| LevelReader::mount(LevelReaderProps::default(), scope, app)) {
            Err(error) => error,
            Ok(_) => panic!("a reader acquired a scope without its required nominal key"),
        }
    }

    let empty = ContextScope::default();
    let absent = missing(cx, &empty);
    let unrelated = cx.new(|_| OTHER.provider("same value".to_owned()));
    let only_other = empty.with(OTHER, unrelated);
    let wrong_key = missing(cx, &only_other);
    assert_ne!(LEVEL.binding_id(), OTHER.binding_id());
    assert_eq!(absent.key, LEVEL.binding_id());
    assert_eq!(wrong_key.key, LEVEL.binding_id());

    let matching = cx.new(|_| LEVEL.provider("same value".to_owned()));
    let nearer_other = cx.new(|_| OTHER.provider("a nearer unrelated value".to_owned()));
    let supplied = only_other.with(LEVEL, matching).with(OTHER, nearer_other.clone());
    let reader = mount_reader(cx, &supplied);
    assert_reader(&reader, cx, "same value", "same value");
    nearer_other.update(cx, |provider, cx| provider.publish("changed OTHER".to_owned(), cx));
    assert_reader(&reader, cx, "same value", "same value");
}

#[test]
fn equal_replacement_withdraws_the_old_provider_and_a_physical_move_retains_the_reader() {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let original = cx.new(|_| LEVEL.provider("seed".to_owned()));
    let outer = ContextScope::default().with(LEVEL, original.clone());
    let reader = mount_reader(&cx, &outer);
    let id = reader.entity_id();
    let first_window = cx.add_window(|_, _| Surface { view: Some(reader.clone().into()) });
    let second_window = cx.add_window(|_, _| Surface { view: None });
    assert_text(first_window, &mut cx, &text, "seed / seed");
    assert_text(second_window, &mut cx, &text, "");

    original.update(&mut cx, |provider, cx| provider.publish("aligned".to_owned(), cx));
    assert_reader(&reader, &cx, "seed", "aligned");
    assert_text(first_window, &mut cx, &text, "seed / aligned");
    let replacement = cx.new(|_| LEVEL.provider("aligned".to_owned()));
    let nearer = outer.with(LEVEL, replacement.clone());
    reader.update(&mut cx, |reader, cx| reader.rebind(&nearer, cx))
        .unwrap_or_else(|error| panic!("replacement provider missing for {}", error.key));
    assert_reader(&reader, &cx, "seed", "aligned");
    assert_text(first_window, &mut cx, &text, "seed / aligned");

    let (notifications, subscription) = count_notifications(&reader, &cx);
    original.update(&mut cx, |provider, cx| provider.publish("retired provider".to_owned(), cx));
    assert_reader(&reader, &cx, "seed", "aligned");
    assert_text(first_window, &mut cx, &text, "seed / aligned");
    assert_eq!(notifications.get(), 0, "a retired provider notified the reader");
    replacement.update(&mut cx, |provider, cx| provider.publish("new-channel".to_owned(), cx));
    assert_reader(&reader, &cx, "seed", "new-channel");
    assert_text(first_window, &mut cx, &text, "seed / new-channel");
    assert!(notifications.get() > 0, "the replacement did not publish to the reader");

    present(first_window, &mut cx, None);
    assert_text(first_window, &mut cx, &text, "");
    replacement.update(&mut cx, |provider, cx| provider.publish("while-detached".to_owned(), cx));
    assert_reader(&reader, &cx, "seed", "while-detached");
    assert_text(first_window, &mut cx, &text, "");
    assert_text(second_window, &mut cx, &text, "");
    present(second_window, &mut cx, Some(reader.clone().into()));
    assert_eq!(reader.entity_id(), id);
    assert_text(second_window, &mut cx, &text, "seed / while-detached");
    assert_text(first_window, &mut cx, &text, "");

    let weak = reader.downgrade();
    present(second_window, &mut cx, None);
    assert_text(second_window, &mut cx, &text, "");
    drop((subscription, reader));
    cx.update(|_| {});
    assert!(weak.upgrade().is_none(), "a logical provider retained the released reader");
    drop((nearer, original, replacement));
    cx.quit();
}

#[gpui::test]
fn releasing_the_logical_parent_unsubscribes_its_host_retained_reader(cx: &mut TestAppContext) {
    let captured = Rc::new(Cell::new(None));
    let first_reader = captured.clone();
    let births = cx.update(|app| app.observe_new::<LevelReader>(move |_, _, cx| {
        assert!(first_reader.replace(Some(cx.entity())).is_none());
    }));
    let owner = cx.update(|app| LevelOwner::mount(LevelOwnerProps::default(), &ContextScope::default(), app)).unwrap();
    let child = captured.take().expect("the generated parent created its reader");
    drop(births);

    let provider = cx.new(|_| LEVEL.provider("shared".to_owned()));
    let scope = ContextScope::default().with(LEVEL, provider.clone());
    child.update(cx, |reader, cx| reader.rebind(&scope, cx)).unwrap();
    let independent = mount_reader(cx, &scope);
    let (child_events, _child_observer) = count_notifications(&child, cx);
    let (independent_events, _independent_observer) = count_notifications(&independent, cx);
    provider.update(cx, |provider, cx| provider.publish("both live".to_owned(), cx));
    cx.run_until_parked();
    assert!(child_events.get() > 0 && independent_events.get() > 0);

    let parent = owner.downgrade();
    drop(owner);
    cx.update(|_| {});
    cx.run_until_parked();
    assert!(parent.upgrade().is_none(), "the logical parent was released");
    let child_before = child_events.get();
    let independent_before = independent_events.get();
    provider.update(cx, |provider, cx| provider.publish("independent only".to_owned(), cx));
    cx.run_until_parked();
    assert!(independent_events.get() > independent_before);
    assert_reader(&independent, cx, "shared", "independent only");
    assert_eq!(child_events.get(), child_before, "the retained child still observes its provider after parent release");
}
