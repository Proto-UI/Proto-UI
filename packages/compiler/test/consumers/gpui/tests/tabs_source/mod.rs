//! Native consumers of both exports of the original context-owned-async-tabs source.

use super::support::ObservedText;
use generated_gpui_consumer::{async_tab_panel as panel, tabs_loader::{Delivery, TabsLoader}, tabs_owner};
use gpui::{
    div, prelude::*, px, rgb, AnyView, Display, Entity, FlexDirection, Hsla, Point,
    StyleRefinement, TestAppContext, TestDispatcher, UnderlineStyle, Window, WindowHandle,
};
use proto_ui_gpui_support::{
    owned_tasks::{TaskHandle, TaskOutcome}, with_owner, ActionOutcome, SegmentFailure,
};
use std::{cell::Cell, rc::Rc, sync::Arc};

const OWNER_INK: u32 = 0x304b69;
const PANEL_INK: u32 = 0x562847;
const ALPHA: &str = "Amber field notes";
const BETA: &str = "Blue archive";
const STALE: &str = "Selection changed; reload requested content";
const MISSING: &str = "No document for missing";
type Receipt = TaskHandle<panel::AsyncTabPanel, (), SegmentFailure>;

fn ink(color: u32) -> UnderlineStyle {
    UnderlineStyle { thickness: px(1.), color: Some(rgb(color).into()), wavy: false }
}

// Both theme entries are constant across task states. Only the generated text
// supplies each shaped and painted label, including on a repeated cached frame.
fn theme(token: &str, style: &mut StyleRefinement) {
    let (color, font_size) = match token {
        "authoring-tabs" => (OWNER_INK, 16.),
        "authoring-tab-panel" => (PANEL_INK, 21.),
        _ => panic!("unexpected Tabs style token {token:?}"),
    };
    style.display = Some(Display::Flex);
    style.flex_direction = Some(FlexDirection::Column);
    style.size.width = Some(px(640.).into());
    style.text.font_size = Some(px(font_size).into());
    style.text.color = Some(rgb(color).into());
    style.text.underline = Some(ink(color));
}

struct Surface { view: Option<AnyView> }

impl Render for Surface {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        div().size_full().flex().flex_col().items_start().children(self.view.clone())
    }
}

fn open<T: Render>(cx: &mut TestAppContext, view: &Entity<T>) -> WindowHandle<Surface> {
    cx.add_window(|_, _| Surface { view: Some(view.clone().into()) })
}

fn present(window: WindowHandle<Surface>, cx: &mut TestAppContext, view: Option<AnyView>) {
    window.update(cx, |surface, _, cx| { surface.view = view; cx.notify(); }).unwrap();
}

fn assert_paint(
    window: WindowHandle<Surface>, cx: &mut TestAppContext, text: &ObservedText,
    owner_label: Option<&str>, panel_label: Option<&str>,
) {
    cx.run_until_parked();
    cx.update_window(window.into(), |_, window, _| {
        let strokes = window.painted_underlines();
        for (color, expected) in [(OWNER_INK, owner_label), (PANEL_INK, panel_label)] {
            let mut visible = strokes.iter().filter(|line| line.color == Hsla::from(rgb(color)));
            if let Some(label) = expected {
                let line = visible.next().unwrap_or_else(|| panic!("missing painted label {label:?}"));
                assert_eq!(line.bounds.intersect(&line.content_mask.bounds), line.bounds);
                text.expect_label_at_width(label, |advance| {
                    window.underline_bounds(Point::default(), advance, &ink(color)).size == line.bounds.size
                });
            }
            assert!(visible.next().is_none(), "an extra owner or panel label painted");
        }
    }).unwrap();
}

fn with_app(test: impl FnOnce(&mut TestAppContext, &TabsLoader, &ObservedText)) {
    let text = Arc::new(ObservedText::default());
    let mut cx = TestAppContext::build_with_text_system(TestDispatcher::new(0), None, text.clone());
    let loader = TabsLoader::default();
    cx.update(|app| app.set_global(loader.clone()));
    test(&mut cx, &loader, &text);
    cx.quit();
}

fn selection(value: &str) -> panel::TabSelectionValue {
    panel::TabSelectionValue { value: value.to_owned() }
}

fn scope_for(cx: &mut TestAppContext, selected: &str) -> panel::ContextScope {
    let channel = cx.new(|_| panel::TAB_SELECTION.provider(selection(selected)));
    panel::ContextScope::new(theme).with(panel::TAB_SELECTION, channel)
}

fn mount(cx: &TestAppContext, scope: &panel::ContextScope) -> Entity<panel::AsyncTabPanel> {
    cx.update(|app| panel::AsyncTabPanel::mount(panel::AsyncTabPanelProps::default(), scope, app)).unwrap()
}

fn handle(view: &Entity<panel::AsyncTabPanel>, cx: &TestAppContext) -> Receipt {
    view.read_with(cx, |view, _| view.tasks().load().expect("the declared task was submitted"))
}

fn reload(view: &Entity<panel::AsyncTabPanel>, cx: &mut TestAppContext) {
    assert_eq!(view.update(cx, |view, cx| view.actions(cx).reload()), ActionOutcome::Committed);
    cx.run_until_parked();
}

fn cancel(view: &Entity<panel::AsyncTabPanel>, cx: &mut TestAppContext) {
    assert_eq!(view.update(cx, |view, cx| view.actions(cx).cancel()), ActionOutcome::Committed);
    cx.run_until_parked();
}

fn assert_loading(view: &panel::AsyncTabPanel, selected: &str) {
    let projection = view.projection();
    assert_eq!(projection.panel().kind(), "loading");
    assert_eq!(projection.panel().as_loading().unwrap().requested, selected);
    assert_eq!(projection.label(), "Loading");
}

fn observe_loading(loader: &TabsLoader, view: &Entity<panel::AsyncTabPanel>, expected: &'static str) -> Rc<Cell<bool>> {
    let observed = Rc::new(Cell::new(false));
    let at_start = observed.clone();
    let owner = view.downgrade();
    loader.observe_next_start(move |selected, app| {
        assert_eq!(selected, expected);
        let owner = owner.upgrade().expect("loader started after owner release");
        assert_loading(owner.read(app), selected);
        assert!(!at_start.replace(true));
    });
    observed
}

fn assert_ready(view: &Entity<panel::AsyncTabPanel>, cx: &TestAppContext, selected: &str, content: &str) {
    view.read_with(cx, |view, _| {
        let projection = view.projection();
        assert_eq!(projection.panel().kind(), "ready");
        let ready = projection.panel().as_ready().unwrap();
        assert_eq!(ready.selected, selected);
        assert_eq!(ready.text, content);
        assert_eq!(projection.label(), content);
    });
}

fn assert_cancelled(view: &Entity<panel::AsyncTabPanel>, cx: &TestAppContext) {
    view.read_with(cx, |view, _| {
        let projection = view.projection();
        assert_eq!(projection.panel().kind(), "cancelled");
        assert_eq!(projection.label(), "Cancelled");
    });
}

#[test]
fn default_owner_keeps_its_pending_panel_through_select_and_physical_reattachment() {
    with_app(|cx, loader, text| {
        loader.plan(Delivery::Uncancellable);
        let scope = tabs_owner::ContextScope::new(theme);
        let owner = cx.update(|app| tabs_owner::AsyncTabsOwner::mount(
            tabs_owner::AsyncTabsOwnerProps::default(), &scope, app,
        )).unwrap();
        cx.run_until_parked();
        let window = open(cx, &owner);
        owner.read_with(cx, |owner, _| assert_eq!(owner.projection().value(), "alpha"));
        assert_paint(window, cx, text, Some("alpha"), Some("Loading"));
        assert_eq!(loader.call_count(), 1);
        let request = loader.request(0);
        assert_eq!(request.selected(), "alpha");
        assert_eq!(request.result(), None);

        // This additional instance comes from the same emitted unit as the
        // owner. Its real logical provider is independent of its native window.
        loader.plan(Delivery::Cancellable);
        let owner_scope = owner.read_with(cx, |owner, _| owner.child_scope());
        let remote = cx.update(|app| tabs_owner::AsyncTabPanel::mount(
            tabs_owner::AsyncTabPanelProps::default(), &owner_scope, app,
        )).unwrap();
        cx.run_until_parked();
        let remote_window = open(cx, &remote);
        assert_paint(remote_window, cx, text, None, Some("Loading"));
        let remote_request = loader.request(1);
        let remote_task = remote.read_with(cx, |view, _| view.tasks().load().unwrap());
        assert_eq!(remote_request.selected(), "alpha");
        assert_eq!(remote_task.outcome(), None);

        present(window, cx, None);
        assert_paint(window, cx, text, None, None);
        let outcome = owner.update(cx, |owner, cx| owner.actions(cx).select("beta".to_owned()));
        assert_eq!(outcome, ActionOutcome::Committed);
        owner.read_with(cx, |owner, _| assert_eq!(owner.projection().value(), "beta"));
        assert!(!remote_request.was_withdrawn());
        remote_request.release();
        assert_paint(remote_window, cx, text, None, Some(STALE));
        remote.read_with(cx, |view, _| {
            let projection = view.projection();
            let stale = projection.panel().as_stale().expect("the remote panel read its current logical provider");
            assert_eq!(stale.requested, "alpha");
            assert_eq!(stale.current, "beta");
            assert_eq!(projection.label(), STALE);
        });
        assert_eq!(remote_request.result(), Some(Ok(ALPHA.to_owned())));
        assert_eq!(remote_task.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(request.result(), None, "the nested panel has its own pending read");
        assert_paint(window, cx, text, None, None);
        present(window, cx, Some(owner.clone().into()));
        assert_paint(window, cx, text, Some("beta"), Some("Loading"));
        assert_eq!(loader.call_count(), 2);
        assert!(!request.was_withdrawn());

        request.release();
        assert_paint(window, cx, text, Some("beta"), Some(STALE));
        assert_eq!(request.result(), Some(Ok(ALPHA.to_owned())));
        assert_eq!(loader.call_count(), 2);
    });
}

#[test]
fn ready_file_and_business_error_publish_after_the_loading_commit() {
    with_app(|cx, loader, text| {
        let empty = panel::ContextScope::new(theme);
        match cx.update(|app| panel::AsyncTabPanel::mount(panel::AsyncTabPanelProps::default(), &empty, app)) {
            Err(error) => assert_eq!(error.key, panel::TAB_SELECTION.binding_id()),
            Ok(_) => panic!("the standalone authored panel requires TAB_SELECTION"),
        }
        cx.run_until_parked();
        assert_eq!(loader.call_count(), 0);

        let scope = scope_for(cx, "alpha");
        loader.plan(Delivery::Ready);
        let (view, committed_loading) = cx.update(|app| {
            let view = panel::AsyncTabPanel::mount(panel::AsyncTabPanelProps::default(), &scope, app).unwrap();
            let observation = observe_loading(loader, &view, "alpha");
            (view, observation)
        });
        cx.run_until_parked();
        assert!(committed_loading.get(), "an already-ready extern did not see its loading commit");
        assert_eq!(loader.request(0).result(), Some(Ok(ALPHA.to_owned())));
        let first = handle(&view, cx);
        assert_eq!(first.outcome(), Some(&TaskOutcome::Completed(())));
        assert_ready(&view, cx, "alpha", ALPHA);
        let window = open(cx, &view);
        assert_paint(window, cx, text, None, Some(ALPHA));

        let missing = scope_for(cx, "missing");
        view.update(cx, |view, cx| view.rebind(&missing, cx)).unwrap();
        assert_paint(window, cx, text, None, Some(ALPHA));
        assert_eq!(loader.call_count(), 1);
        loader.plan(Delivery::Ready);
        let loading_missing = observe_loading(loader, &view, "missing");
        reload(&view, cx);
        assert!(loading_missing.get());
        assert_eq!(loader.request(1).result(), Some(Err(MISSING.to_owned())));
        view.read_with(cx, |view, _| {
            let projection = view.projection();
            assert_eq!(projection.panel().kind(), "failed");
            let failed = projection.panel().as_failed().unwrap();
            assert_eq!(failed.selected, "missing");
            assert_eq!(failed.failure.kind.as_str(), "unavailable");
            assert_eq!(failed.failure.message, MISSING);
            assert_eq!(projection.label(), MISSING);
        });
        assert_paint(window, cx, text, None, Some(MISSING));
        assert_eq!(handle(&view, cx).outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(first.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(loader.call_count(), 2);
    });
}

#[test]
fn pending_panel_reads_the_current_provider_after_an_equal_rebind() {
    with_app(|cx, loader, text| {
        let outer = cx.new(|_| panel::TAB_SELECTION.provider(selection("alpha")));
        let nearer = cx.new(|_| panel::TAB_SELECTION.provider(selection("alpha")));
        let original_scope = panel::ContextScope::new(theme).with(panel::TAB_SELECTION, outer.clone());
        let replacement_scope = original_scope.with(panel::TAB_SELECTION, nearer.clone());
        loader.plan(Delivery::Cancellable);
        let view = mount(cx, &original_scope);
        cx.run_until_parked();
        let window = open(cx, &view);
        let task = handle(&view, cx);
        let request = loader.request(0);
        assert_eq!(request.selected(), "alpha");
        assert_paint(window, cx, text, None, Some("Loading"));
        view.update(cx, |view, cx| view.rebind(&replacement_scope, cx)).unwrap();
        outer.update(cx, |channel, cx| channel.publish(selection("retired"), cx));
        nearer.update(cx, |channel, cx| channel.publish(selection("beta"), cx));
        view.read_with(cx, |view, _| assert_loading(view, "alpha"));
        assert_paint(window, cx, text, None, Some("Loading"));
        assert_eq!(task.outcome(), None);
        assert!(!request.was_withdrawn());
        assert_eq!(loader.call_count(), 1);

        request.release();
        cx.run_until_parked();
        assert_eq!(request.result(), Some(Ok(ALPHA.to_owned())));
        assert_eq!(task.outcome(), Some(&TaskOutcome::Completed(())));
        view.read_with(cx, |view, _| {
            let projection = view.projection();
            assert_eq!(projection.panel().kind(), "stale");
            let stale = projection.panel().as_stale().unwrap();
            assert_eq!(stale.requested, "alpha");
            assert_eq!(stale.current, "beta");
            assert_eq!(projection.label(), STALE);
        });
        assert_paint(window, cx, text, None, Some(STALE));
        assert_eq!(loader.call_count(), 1);
    });
}

#[test]
fn latest_reload_and_explicit_cancel_have_distinct_terminal_outcomes() {
    with_app(|cx, loader, text| {
        let scope = scope_for(cx, "alpha");
        loader.plan(Delivery::Uncancellable);
        let view = mount(cx, &scope);
        cx.run_until_parked();
        let window = open(cx, &view);
        let first = handle(&view, cx);
        let obsolete = loader.request(0);
        assert_eq!(obsolete.selected(), "alpha");
        assert_eq!(first.outcome(), None);

        let next_scope = scope_for(cx, "beta");
        view.update(cx, |view, cx| view.rebind(&next_scope, cx)).unwrap();
        loader.plan(Delivery::Cancellable);
        reload(&view, cx);
        let second = handle(&view, cx);
        let latest = loader.request(1);
        assert_eq!(latest.selected(), "beta");
        assert_eq!(first.outcome(), Some(&TaskOutcome::Superseded));
        assert_eq!(second.outcome(), None);
        view.read_with(cx, |view, _| assert_loading(view, "beta"));
        latest.release();
        cx.run_until_parked();
        assert_eq!(latest.result(), Some(Ok(BETA.to_owned())));
        assert_eq!(second.outcome(), Some(&TaskOutcome::Completed(())));
        assert_ready(&view, cx, "beta", BETA);
        assert_eq!(obsolete.result(), None);
        obsolete.release();
        cx.run_until_parked();
        assert_eq!(obsolete.result(), Some(Ok(ALPHA.to_owned())));
        assert!(!obsolete.was_withdrawn());
        assert_eq!(first.outcome(), Some(&TaskOutcome::Superseded));
        assert_ready(&view, cx, "beta", BETA);
        assert_paint(window, cx, text, None, Some(BETA));

        for (index, mode, supports_cancellation) in [
            (2, Delivery::Cancellable, true), (3, Delivery::Uncancellable, false),
        ] {
            loader.plan(mode);
            reload(&view, cx);
            let task = handle(&view, cx);
            let request = loader.request(index);
            assert_eq!(request.selected(), "beta");
            assert_eq!(request.result(), None);
            assert_eq!(task.outcome(), None);
            cancel(&view, cx);
            assert_eq!(task.outcome(), Some(&TaskOutcome::Cancelled));
            assert_eq!(request.was_withdrawn(), supports_cancellation);
            assert_cancelled(&view, cx);
            request.release();
            cx.run_until_parked();
            let returned = if supports_cancellation { None } else { Some(Ok(BETA.to_owned())) };
            assert_eq!(request.result(), returned);
            assert_eq!(task.outcome(), Some(&TaskOutcome::Cancelled));
            assert_cancelled(&view, cx);
            assert_paint(window, cx, text, None, Some("Cancelled"));
        }
        assert_eq!(loader.call_count(), 4);
    });
}

#[test]
fn released_panel_cannot_submit_a_late_file_result_to_its_replacement() {
    with_app(|cx, loader, text| {
        let original_scope = scope_for(cx, "alpha");
        loader.plan(Delivery::Uncancellable);
        let original = mount(cx, &original_scope);
        cx.run_until_parked();
        let window = open(cx, &original);
        assert_paint(window, cx, text, None, Some("Loading"));
        let weak = original.downgrade();
        let original_id = original.entity_id();
        let ended = handle(&original, cx);
        let late = loader.request(0);
        present(window, cx, None);
        assert_paint(window, cx, text, None, None);
        assert!(weak.upgrade().is_some());
        assert_eq!(ended.outcome(), None, "physical removal terminated the logical task");
        drop(original);
        cx.update(|_| {});
        assert!(weak.upgrade().is_none());
        assert_eq!(ended.outcome(), Some(&TaskOutcome::OwnerEnded));
        assert_eq!(late.result(), None);

        let fresh_scope = scope_for(cx, "beta");
        loader.plan(Delivery::Ready);
        let replacement = mount(cx, &fresh_scope);
        assert_ne!(original_id, replacement.entity_id());
        present(window, cx, Some(replacement.clone().into()));
        assert_paint(window, cx, text, None, Some(BETA));
        assert_ready(&replacement, cx, "beta", BETA);
        let completed = handle(&replacement, cx);
        assert_eq!(completed.outcome(), Some(&TaskOutcome::Completed(())));
        let obsolete_dispatch = cx.update(|app| with_owner(&weak, app, |view, cx| view.actions(cx).reload()));
        assert_eq!(obsolete_dispatch, ActionOutcome::Disposed);
        late.release();
        cx.run_until_parked();
        assert_eq!(late.result(), Some(Ok(ALPHA.to_owned())));
        assert!(!late.was_withdrawn());
        assert_ready(&replacement, cx, "beta", BETA);
        assert_paint(window, cx, text, None, Some(BETA));
        assert_eq!(ended.outcome(), Some(&TaskOutcome::OwnerEnded));

        loader.plan(Delivery::Cancellable);
        reload(&replacement, cx);
        let active = handle(&replacement, cx);
        let last = loader.request(2);
        present(window, cx, None);
        assert_paint(window, cx, text, None, None);
        drop(replacement);
        cx.update(|_| {});
        assert_eq!(active.outcome(), Some(&TaskOutcome::OwnerEnded));
        assert!(last.was_withdrawn());
        last.release();
        cx.run_until_parked();
        assert_eq!(last.result(), None);
        assert_eq!(completed.outcome(), Some(&TaskOutcome::Completed(())));
        assert_eq!(loader.call_count(), 3);
    });
}
