//! T-COMPILER-FOUNDATION-0001-CASE-KEYED-LIFETIME through the authored two-child owner.

use super::support::ObservedText;
use generated_gpui_consumer::{
    keyed_loader::KeyedFiles,
    keyed_task_owner::{ContextScope, KeyedTaskItem, KeyedTaskOwner, KeyedTaskOwnerProps, ITEM_ZONE},
};
use gpui::{
    div, prelude::*, px, rgb, AnyView, Display, Entity, FlexDirection, Hsla, Pixels, Point,
    StyleRefinement, TestAppContext, TestDispatcher, UnderlineStyle, Window, WindowHandle,
};
use proto_ui_gpui_support::{owned_tasks::{TaskHandle, TaskOutcome}, SegmentFailure};
use std::{cell::RefCell, rc::Rc, sync::Arc};

struct Surface(Option<AnyView>);

impl Render for Surface {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        div().size_full().flex().flex_col().children(self.0.clone())
    }
}

fn present(window: WindowHandle<Surface>, cx: &mut TestAppContext, view: Option<AnyView>) {
    window.update(cx, |surface, _, cx| { surface.0 = view; cx.notify(); }).unwrap();
}

fn theme(token: &str, style: &mut StyleRefinement) {
    assert_eq!(token, "keyed-task-item");
    style.display = Some(Display::Flex);
}

struct NativeItem { entity: Entity<KeyedTaskItem>, color: Hsla, font_size: Pixels }

fn underline(color: Hsla) -> UnderlineStyle {
    UnderlineStyle { thickness: px(1.), color: Some(color), wavy: false }
}

struct Recorder {
    text: Arc<ObservedText>,
    births: Rc<RefCell<Vec<NativeItem>>>,
}

impl Recorder {
    /// The SDK reports the entities the generated parent actually creates. Give each birth
    /// a fixed color and font size, independently of its key, state and physical position.
    fn attach(text: Arc<ObservedText>, cx: &TestAppContext) -> (Self, gpui::Subscription) {
        let births = Rc::new(RefCell::new(Vec::new()));
        let capture = Rc::clone(&births);
        let subscription = cx.update(|app| app.observe_new::<KeyedTaskItem>(move |item, _, cx| {
            let mut items = capture.borrow_mut();
            let inks = [0x345671, 0x684339, 0x293c56, 0x567142];
            let index = items.len();
            let color = Hsla::from(rgb(*inks.get(index).expect("an extra authored child was created")));
            let font_size = px(15. + 2. * index as f32);
            item.set_appearance(move |_, style| {
                style.text.font_size = Some(font_size.into());
                style.text.underline = Some(underline(color));
            }, cx);
            items.push(NativeItem { entity: cx.entity(), color, font_size });
        }));
        (Self { text, births }, subscription)
    }

    /// Match each painted underlined run to the text shaped at that entity's font size.
    /// Reordering two equal-length labels must move their actual entity-colored runs.
    fn frame(&self, window: WindowHandle<Surface>, cx: &mut TestAppContext, expected: &[&str]) -> Vec<Entity<KeyedTaskItem>> {
        cx.run_until_parked();
        cx.update_window(window.into(), |_, window, _| {
            let items = self.births.borrow();
            let mut strokes = window.painted_underlines();
            strokes.sort_unstable_by_key(|line| line.bounds.top());
            assert_eq!(strokes.len(), expected.len(), "unexpected number of painted item labels");
            let mut order = Vec::new();
            let mut previous_bottom = None;
            for (stroke, &label) in strokes.iter().zip(expected) {
                let item = items.iter().find(|item| item.color == stroke.color).expect("paint belongs to an observed entity");
                assert_eq!(stroke.bounds.intersect(&stroke.content_mask.bounds), stroke.bounds, "clipped item text");
                if let Some(bottom) = previous_bottom { assert!(bottom <= stroke.bounds.top(), "overlapping item rows"); }
                previous_bottom = Some(stroke.bounds.bottom());
                self.text.expect_painted_label(label, |size, advance| {
                    size == item.font_size && window.underline_bounds(Point::default(), advance, &underline(item.color)).size == stroke.bounds.size
                });
                order.push(item.entity.clone());
            }
            order
        }).unwrap()
    }
}

fn keys(owner: &Entity<KeyedTaskOwner>, cx: &mut TestAppContext, first: &str, second: &str) {
    owner.update(cx, |view, cx| view.set_props(KeyedTaskOwnerProps { first: first.into(), second: second.into() }, cx));
}

fn load(item: &Entity<KeyedTaskItem>, cx: &TestAppContext) -> TaskHandle<KeyedTaskItem, (), SegmentFailure> {
    item.read_with(cx, |item, _| item.tasks().load().expect("onCreated submitted the item load"))
}

fn state(item: &Entity<KeyedTaskItem>, cx: &TestAppContext, initial: &str, answer: &str) {
    item.read_with(cx, |item, _| {
        let projection = item.projection();
        assert_eq!(projection.initialZone(), initial);
        assert_eq!(projection.answer(), answer);
    });
}

fn mount_owner(scope: &ContextScope, cx: &mut TestAppContext) -> Entity<KeyedTaskOwner> {
    let owner = cx.update(|app| KeyedTaskOwner::mount(KeyedTaskOwnerProps::default(), scope, app)).unwrap();
    owner.update(cx, |owner, cx| owner.set_appearance(|_, style| {
        style.display = Some(Display::Flex);
        style.flex_direction = Some(FlexDirection::Column);
        style.size.width = Some(px(920.).into());
    }, cx));
    owner
}

#[test]
fn reorder_removal_and_physical_move_preserve_the_correct_owned_task() {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let (paint, _subscription) = Recorder::attach(text, &cx);
    let files = KeyedFiles::default();
    cx.set_global(files.clone());
    let left = cx.new(|_| ITEM_ZONE.provider("left".into()));
    let right = cx.new(|_| ITEM_ZONE.provider("right".into()));
    let scope = ContextScope::new(theme).with(ITEM_ZONE, left.clone());
    let owner = mount_owner(&scope, &mut cx);
    let first = cx.add_window(|_, _| Surface(Some(owner.clone().into())));
    let second = cx.add_window(|_, _| Surface(None));
    let [a, b]: [_; 2] = paint.frame(first, &mut cx, &["A:left/left/pending", "B:left/left/pending"]).try_into().unwrap();
    assert_ne!(a, b);
    assert_eq!(files.len(), 2);
    let [old_file]: [_; 1] = files.requests_for("A").try_into().unwrap_or_else(|_| panic!("expected one A request"));
    let [b_file]: [_; 1] = files.requests_for("B").try_into().unwrap_or_else(|_| panic!("expected one B request"));
    let old_a = load(&a, &cx);
    let retained_b = load(&b, &cx);
    assert_eq!(old_a.outcome(), None);
    assert_eq!(retained_b.outcome(), None);

    keys(&owner, &mut cx, "B", "A");
    assert_eq!(paint.frame(first, &mut cx, &["B:left/left/pending", "A:left/left/pending"]), [b.clone(), a.clone()]);
    assert_eq!(files.len(), 2);
    assert_eq!(old_a.outcome(), None);
    assert_eq!(retained_b.outcome(), None);
    keys(&owner, &mut cx, "B", "C");
    let [still_b, c]: [_; 2] = paint.frame(first, &mut cx, &["B:left/left/pending", "C:left/left/pending"]).try_into().unwrap();
    assert_eq!(still_b, b);
    assert_ne!(c, a);
    let c_task = load(&c, &cx);
    assert_eq!(old_a.outcome(), Some(&TaskOutcome::OwnerEnded));
    assert_eq!(old_file.returned(), None);
    assert_eq!(files.len(), 3);

    present(first, &mut cx, None);
    paint.frame(first, &mut cx, &[]);
    paint.frame(second, &mut cx, &[]);
    let moved_scope = scope.with(ITEM_ZONE, right.clone());
    owner.update(&mut cx, |view, cx| view.rebind(&moved_scope, cx)).unwrap();
    left.update(&mut cx, |provider, cx| provider.publish("retired provider".into(), cx));
    state(&b, &cx, "left", "pending");
    assert_eq!(retained_b.outcome(), None);
    present(second, &mut cx, Some(b.clone().into()));
    assert_eq!(paint.frame(second, &mut cx, &["B:left/right/pending"]), [b.clone()]);
    right.update(&mut cx, |provider, cx| provider.publish("right annex".into(), cx));
    assert_eq!(paint.frame(second, &mut cx, &["B:left/right annex/pending"]), [b.clone()]);
    right.update(&mut cx, |provider, cx| provider.publish("right".into(), cx));
    assert_eq!(paint.frame(second, &mut cx, &["B:left/right/pending"]), [b.clone()]);
    assert_eq!(retained_b.outcome(), None);
    assert_eq!(files.len(), 3);

    keys(&owner, &mut cx, "B", "A");
    present(second, &mut cx, Some(owner.clone().into()));
    let [still_b, new_a]: [_; 2] = paint.frame(second, &mut cx, &["B:left/right/pending", "A:right/right/pending"]).try_into().unwrap();
    assert_eq!(still_b, b);
    assert_ne!(new_a, a);
    assert_ne!(new_a, c);
    assert_eq!(c_task.outcome(), Some(&TaskOutcome::OwnerEnded));
    let fresh_a = load(&new_a, &cx);
    assert_eq!(fresh_a.outcome(), None);
    let [original, replacement]: [_; 2] = files.requests_for("A").try_into().unwrap_or_else(|_| panic!("expected distinct original and replacement A requests"));
    assert!(original.same_request(&old_file));
    assert!(!replacement.same_request(&old_file));
    assert!(files.requests_for("B")[0].same_request(&b_file));
    assert_eq!(files.len(), 4);

    old_file.deliver("old");
    let [c_file]: [_; 1] = files.requests_for("C").try_into().unwrap_or_else(|_| panic!("expected one temporary C request"));
    c_file.deliver("temporary");
    paint.frame(second, &mut cx, &["B:left/right/pending", "A:right/right/pending"]);
    assert_eq!(old_file.returned().as_deref(), Some("Obsolete amber record"));
    assert_eq!(c_file.returned().as_deref(), Some("Temporary chart"));
    assert_eq!(old_a.outcome(), Some(&TaskOutcome::OwnerEnded));
    assert_eq!(fresh_a.outcome(), None);
    state(&a, &cx, "left", "pending");
    state(&new_a, &cx, "right", "pending");
    assert_eq!(replacement.returned(), None);

    b_file.deliver("original");
    assert_eq!(paint.frame(second, &mut cx, &["B:left/right/Blue retained file@left>right", "A:right/right/pending"]), [b.clone(), new_a.clone()]);
    assert_eq!(b_file.returned().as_deref(), Some("Blue retained file"));
    assert_eq!(retained_b.outcome(), Some(&TaskOutcome::Completed(())));
    state(&b, &cx, "left", "Blue retained file@left>right");
    replacement.deliver("new");
    assert_eq!(paint.frame(second, &mut cx, &["B:left/right/Blue retained file@left>right", "A:right/right/Apricot replacement@right>right"]), [b, new_a.clone()]);
    assert_eq!(replacement.returned().as_deref(), Some("Apricot replacement"));
    assert_eq!(fresh_a.outcome(), Some(&TaskOutcome::Completed(())));
    state(&new_a, &cx, "right", "Apricot replacement@right>right");
    assert_eq!(paint.births.borrow().len(), 4);
    assert_eq!(files.len(), 4);
    paint.frame(first, &mut cx, &[]);
    cx.quit();
}

#[test]
fn releasing_the_parent_ends_retained_keyed_tasks_before_their_files_can_publish() {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let (paint, _births) = Recorder::attach(text, &cx);
    let files = KeyedFiles::default();
    cx.set_global(files.clone());
    let latest_request = |key: &str| files.requests_for(key).pop().unwrap_or_else(|| panic!("missing {key} request"));
    let left = cx.new(|_| ITEM_ZONE.provider("left".into()));
    let owner = mount_owner(&ContextScope::new(theme).with(ITEM_ZONE, left), &mut cx);
    let owner_id = owner.entity_id();
    let weak_owner = owner.downgrade();
    let window = cx.add_window(|_, _| Surface(Some(owner.clone().into())));
    let [a, b]: [_; 2] = paint.frame(window, &mut cx, &["A:left/left/pending", "B:left/left/pending"]).try_into().unwrap();
    assert_ne!(a, b);
    assert_eq!(files.len(), 2);
    let (a_file, b_file) = (latest_request("A"), latest_request("B"));
    let (a_task, b_task) = (load(&a, &cx), load(&b, &cx));
    let _old_answers = [&a, &b].map(|entity| cx.update(|app| app.observe(entity, |item, app| {
        assert_eq!(item.read(app).projection().answer(), "pending", "an original child published a file result");
    })));

    present(window, &mut cx, None);
    paint.frame(window, &mut cx, &[]);
    assert!(weak_owner.upgrade().is_some());
    assert_eq!(a_task.outcome(), None);
    assert_eq!(b_task.outcome(), None);
    assert_eq!(a_file.returned(), None);
    assert_eq!(b_file.returned(), None);

    // Advance one runnable at a time and stop as soon as the native file records its return.
    a_file.deliver("old");
    while a_file.returned().is_none() {
        assert!(cx.dispatcher.tick(false), "the released A file had no runnable producer");
    }
    assert_eq!(a_file.returned().as_deref(), Some("Obsolete amber record"));
    assert_eq!(a_task.outcome(), None, "A's generated receipt was already terminal when the file returned");
    state(&a, &cx, "left", "pending");
    assert_eq!(b_file.returned(), None);
    assert_eq!(b_task.outcome(), None);
    state(&b, &cx, "left", "pending");

    drop(owner);
    cx.update(|_| {});
    assert!(weak_owner.upgrade().is_none(), "the SDK did not release the original parent");
    assert_eq!(a_task.outcome(), Some(&TaskOutcome::OwnerEnded));
    assert_eq!(b_task.outcome(), Some(&TaskOutcome::OwnerEnded));
    assert_eq!(b_file.returned(), None);

    let right = cx.new(|_| ITEM_ZONE.provider("right".into()));
    let replacement = mount_owner(&ContextScope::new(theme).with(ITEM_ZONE, right), &mut cx);
    assert_ne!(replacement.entity_id(), owner_id);
    present(window, &mut cx, Some(replacement.into()));
    let [fresh_a, fresh_b]: [_; 2] = paint.frame(window, &mut cx, &["A:right/right/pending", "B:right/right/pending"]).try_into().unwrap();
    assert_ne!(fresh_a, fresh_b);
    for child in [&fresh_a, &fresh_b] { assert!(child != &a && child != &b); }
    assert_eq!(files.len(), 4);
    let (new_a_file, new_b_file) = (latest_request("A"), latest_request("B"));
    assert!(!new_a_file.same_request(&a_file) && !new_b_file.same_request(&b_file));
    let (new_a_task, new_b_task) = (load(&fresh_a, &cx), load(&fresh_b, &cx));
    assert_eq!(new_a_task.outcome(), None);
    assert_eq!(new_b_task.outcome(), None);
    state(&a, &cx, "left", "pending");

    let a_ready = "A:right/right/Apricot replacement@right>right";
    new_a_file.deliver("new");
    assert_eq!(paint.frame(window, &mut cx, &[a_ready, "B:right/right/pending"]), [fresh_a.clone(), fresh_b.clone()]);
    assert_eq!(new_a_file.returned().as_deref(), Some("Apricot replacement"));
    assert_eq!(new_a_task.outcome(), Some(&TaskOutcome::Completed(())));
    state(&fresh_a, &cx, "right", "Apricot replacement@right>right");

    b_file.deliver("original");
    assert_eq!(paint.frame(window, &mut cx, &[a_ready, "B:right/right/pending"]), [fresh_a.clone(), fresh_b.clone()]);
    assert_eq!(b_file.returned().as_deref(), Some("Blue retained file"));
    assert_eq!(new_b_file.returned(), None);
    assert_eq!(new_b_task.outcome(), None);
    state(&b, &cx, "left", "pending");
    state(&fresh_b, &cx, "right", "pending");

    new_b_file.deliver("original");
    assert_eq!(paint.frame(window, &mut cx, &[a_ready, "B:right/right/Blue retained file@right>right"]), [fresh_a, fresh_b.clone()]);
    assert_eq!(new_b_file.returned().as_deref(), Some("Blue retained file"));
    assert_eq!(new_b_task.outcome(), Some(&TaskOutcome::Completed(())));
    state(&fresh_b, &cx, "right", "Blue retained file@right>right");
    state(&a, &cx, "left", "pending");
    state(&b, &cx, "left", "pending");
    assert_eq!(a_task.outcome(), Some(&TaskOutcome::OwnerEnded));
    assert_eq!(b_task.outcome(), Some(&TaskOutcome::OwnerEnded));
    assert_eq!(files.len(), 4);
    cx.quit();
}
