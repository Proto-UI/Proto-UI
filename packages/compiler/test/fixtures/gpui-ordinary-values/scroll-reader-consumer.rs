//! Separate real-geometry reader controls for GPUI end-follow pause.
//! Native framework input/paint evidence only; not a physical OS input claim.
//! This draft must first run against the combined, unmodified S7 SDK.
//! No observation, following flag, max extent, or ScrollHandle offset is assigned.
use gpui::{
    prelude::*, point, px, size, Bounds, Context, Entity, InputEvent, Pixels,
    Point, Render, TestAppContext, Window, WindowHandle,
};
use proto_ui_gpui_native::gpui_native_owner::{scroll_snapshot, NativeSnapshot};
use serde_json::json;
use std::{cell::Cell, rc::Rc};

const ROW_HEIGHT: f32 = 40.;
const CONTENT_WIDTH: f32 = 640.;

struct Rows {
    count: usize,
    measured: Rc<Cell<Option<Bounds<Pixels>>>>,
}

impl Render for Rows {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let measured = self.measured.clone();
        // This is actual laid-out content, not a fabricated Scroll observation.
        // Fixed row heights and a fixed content width make both overflow axes
        // independent of font metrics. Appending also appends real row elements.
        gpui::div()
            .id("scroll-reader-content")
            .relative()
            .flex()
            .flex_col()
            .flex_none()
            .w(px(CONTENT_WIDTH))
            .h(px(self.count as f32 * ROW_HEIGHT))
            .children((0..self.count).map(|index| {
                gpui::div()
                    .flex_none()
                    .w(px(CONTENT_WIDTH))
                    .h(px(ROW_HEIGHT))
                    .child(format!("Actual row {index}"))
            }))
            .child(
                gpui::canvas(
                    move |bounds, _, _| measured.set(Some(bounds)),
                    |_, _, _, _| {},
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
    }
}

struct ReaderHarness {
    component: Entity<scroll_reader::CompiledComponent>,
    rows: Entity<Rows>,
    measured: Rc<Cell<Option<Bounds<Pixels>>>>,
}

impl Render for ReaderHarness {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full().child(self.component.clone())
    }
}

#[derive(Debug)]
struct Observation {
    offset: Point<Pixels>,
    max: Point<Pixels>,
    viewport: Bounds<Pixels>,
    content: Bounds<Pixels>,
    row_count: usize,
    state: String,
    at_end: bool,
}

fn frames(window: WindowHandle<ReaderHarness>, cx: &mut TestAppContext) {
    for _ in 0..3 {
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        }).unwrap();
        cx.run_until_parked();
    }
}

fn observe(window: WindowHandle<ReaderHarness>, cx: &mut TestAppContext) -> Observation {
    window.update(cx, |host, _, cx| {
        let owner = host.component.read(cx).owner.clone();
        let (offset, max, viewport) = {
            let o = owner.borrow();
            assert!(o.mounted && o.present && o.bounds.is_some(), "actual attached owner");
            let handle = o.modules.scroll.handle.as_ref().expect("real ScrollHandle");
            (handle.offset(), handle.max_offset(), handle.bounds())
        };
        let snapshot = scroll_snapshot(&Rc::downgrade(&owner));
        Observation {
            offset,
            max,
            viewport,
            content: host.measured.get().expect("actual native child prepaint"),
            row_count: host.rows.read(cx).count,
            state: snapshot.member("endFollow", false).member("state", false).text(),
            at_end: snapshot.member("vertical", false).member("atEnd", false).truthy(),
        }
    }).unwrap()
}

fn invoke(window: WindowHandle<ReaderHarness>, cx: &mut TestAppContext, name: &str) {
    window.update(cx, |host, _, cx| {
        let owner = host.component.read(cx).owner.clone();
        let method = owner.borrow().exposes.get(name).expect("authored method").clone();
        assert_eq!(method.call(vec![]).expect("authored Scroll callback").text(), "dispatched");
    }).unwrap();
}

fn open(cx: &mut TestAppContext) -> WindowHandle<ReaderHarness> {
    let window = cx.open_window(size(px(600.), px(400.)), |window, cx| {
        let measured = Rc::new(Cell::new(None));
        let rows = cx.new(|_| Rows { count: 24, measured: measured.clone() });
        let component = scroll_reader::CompiledComponent::create(json!({}), None, window, cx)
            .expect("compile and construct the authored Scroll fixture");
        component.update(cx, |view, cx| {
            view.set_slot(vec![NativeSnapshot::native_view(rows.clone().into())], cx).unwrap();
        });
        ReaderHarness { component, rows, measured }
    });
    window.update(cx, |_, window, _| window.activate_window()).unwrap();
    frames(window, cx);
    let initial = observe(window, cx);
    assert!(initial.viewport.size.width > px(16.) && initial.viewport.size.height > px(16.));
    assert!(initial.content.size.width > initial.viewport.size.width, "real horizontal overflow");
    assert!(initial.content.size.height > initial.viewport.size.height, "real vertical overflow");
    assert!(initial.max.x > px(100.) && initial.max.y > px(100.), "positive real extent on both axes");
    assert_eq!(initial.row_count, 24);
    invoke(window, cx, "followEnd");
    frames(window, cx);
    let at_end = observe(window, cx);
    assert_eq!(at_end.state, "following");
    assert!(at_end.at_end);
    assert_eq!(at_end.offset.y, -at_end.max.y);
    assert_eq!(at_end.offset.x, px(0.));
    window
}

fn pause(window: WindowHandle<ReaderHarness>, cx: &mut TestAppContext) -> Observation {
    let before = observe(window, cx);
    invoke(window, cx, "pause");
    let after = observe(window, cx);
    assert_eq!(after.state, "paused");
    assert_eq!(after.offset, before.offset, "authored pause cannot move the view");
    assert_eq!(after.max, before.max);
    after
}

fn append(window: WindowHandle<ReaderHarness>, cx: &mut TestAppContext, count: usize) {
    window.update(cx, |host, _, cx| {
        host.rows.update(cx, |rows, cx| {
            rows.count += count;
            cx.notify();
        });
    }).unwrap();
    frames(window, cx);
}

fn wheel(window: WindowHandle<ReaderHarness>, cx: &mut TestAppContext, delta: Point<Pixels>) {
    window.update(cx, |host, window, cx| {
        let owner = host.component.read(cx).owner.clone();
        let viewport = owner.borrow().modules.scroll.handle.as_ref().unwrap().bounds();
        let position = viewport.origin + point(px(8.), px(8.));
        assert!(viewport.contains(&position), "input sample is within the real viewport");
        assert!(owner.borrow().bounds.unwrap().contains(&position), "input sample is within the current owner");
        // Real platform-event entry runs GPUI hit testing/default scrolling and
        // the emitted owner's wheel callback. No direct scroll_input call.
        window.dispatch_event(gpui::MouseMoveEvent { position, ..Default::default() }.to_platform_input(), cx);
        window.dispatch_event(gpui::ScrollWheelEvent {
            position,
            delta: gpui::ScrollDelta::Pixels(delta),
            touch_phase: gpui::TouchPhase::Started,
            ..Default::default()
        }.to_platform_input(), cx);
        assert!(owner.borrow().modules.scroll.last_input.is_some(),
            "the actual emitted owner wheel callback must receive the sample");
    }).unwrap();
    // The GPUI default callback writes raw offset first; parent prepaint clamps
    // it before the emitted observation. Assertions use only that final result.
    frames(window, cx);
}

#[gpui::test]
fn reader_arrival_after_paused_append_resumes_following_for_next_append(cx: &mut TestAppContext) {
    let window = open(cx);
    let paused = pause(window, cx);
    append(window, cx, 8);
    let grown = observe(window, cx);
    assert_eq!(grown.row_count, paused.row_count + 8);
    assert!(grown.content.size.height > paused.content.size.height);
    assert!(grown.max.y > paused.max.y);
    assert_eq!(grown.viewport.size, paused.viewport.size);
    assert_eq!(grown.offset, paused.offset, "append while paused must not move the reader");
    assert_eq!(grown.state, "paused");
    assert!(!grown.at_end, "real appended rows now extend past the paused position");

    wheel(window, cx, point(px(0.), px(-4096.)));
    let arrived = observe(window, cx);
    assert_eq!(arrived.max, grown.max, "reader arrival uses stable content geometry");
    assert_eq!(arrived.viewport.size, grown.viewport.size);
    assert!(arrived.offset.y < grown.offset.y, "the followed axis must actually move");
    assert_eq!(arrived.offset.x, grown.offset.x);
    assert!(arrived.at_end);
    assert_eq!(arrived.offset.y, -arrived.max.y);
    assert_eq!(arrived.state, "following", "actual followed-axis reader arrival resumes");

    append(window, cx, 5);
    let following = observe(window, cx);
    assert!(following.max.y > arrived.max.y);
    assert_eq!(following.viewport.size, arrived.viewport.size);
    assert!(following.offset.y < arrived.offset.y, "next actual append must follow");
    assert_eq!(following.offset.y, -following.max.y);
    assert!(following.at_end);
    assert_eq!(following.state, "following");
}

#[gpui::test]
fn clamped_wheel_at_end_cannot_revoke_pause_or_follow_later_append(cx: &mut TestAppContext) {
    let window = open(cx);
    let paused = pause(window, cx);
    wheel(window, cx, point(px(0.), px(-4096.)));
    let clamped = observe(window, cx);
    assert_eq!(clamped.max, paused.max);
    assert_eq!(clamped.viewport.size, paused.viewport.size);
    assert_eq!(clamped.offset, paused.offset, "boundary wheel has no applied motion");
    assert!(clamped.at_end);
    assert_eq!(clamped.state, "paused", "raw overscroll is not a reader arrival");

    append(window, cx, 5);
    let grown = observe(window, cx);
    assert!(grown.max.y > clamped.max.y);
    assert_eq!(grown.offset, clamped.offset);
    assert_eq!(grown.state, "paused");
    assert!(!grown.at_end);
}

#[gpui::test]
fn other_axis_wheel_motion_cannot_revoke_vertical_pause(cx: &mut TestAppContext) {
    let window = open(cx);
    let paused = pause(window, cx);
    wheel(window, cx, point(px(-4096.), px(0.)));
    let horizontal = observe(window, cx);
    assert_eq!(horizontal.max, paused.max);
    assert_eq!(horizontal.viewport.size, paused.viewport.size);
    assert!(horizontal.offset.x < paused.offset.x, "the non-followed axis really moves");
    assert_eq!(horizontal.offset.x, -horizontal.max.x);
    assert_eq!(horizontal.offset.y, paused.offset.y);
    assert!(horizontal.at_end);
    assert_eq!(horizontal.state, "paused", "only followed-axis motion can establish arrival");

    append(window, cx, 5);
    let grown = observe(window, cx);
    assert!(grown.max.y > horizontal.max.y);
    assert_eq!(grown.offset, horizontal.offset);
    assert_eq!(grown.state, "paused");
    assert!(!grown.at_end);
}
