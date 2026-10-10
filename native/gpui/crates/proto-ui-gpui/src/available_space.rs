//! Root-content geometry from the exact GPUI Window and rendering entity.
use gpui::{div, px, AnyElement, EntityId, IntoElement, ParentElement, Styled, Window};
use proto_ui_host_protocol::messages::AvailableSpaceRect;

use crate::host::ProtoHostView;

pub fn root_region(window: &Window, entity: EntityId) -> Option<AvailableSpaceRect> {
    // A nested ProtoHostView has another coordinate/clip chain. Never label
    // the window's viewport as its available region without that translation.
    if !window
        .root::<ProtoHostView>()
        .flatten()
        .is_some_and(|root| root.entity_id() == entity)
    {
        return None;
    }
    let bounds = window.fully_visible_bounds();
    let rect = AvailableSpaceRect {
        x: bounds.origin.x.as_f32(),
        y: bounds.origin.y.as_f32(),
        width: bounds.size.width.as_f32(),
        height: bounds.size.height.as_f32(),
    };
    rect.is_valid().then_some(rect)
}

/// Actual GPUI layout for the admitted fixed-center recipe. The child's
/// `flex_shrink=0` is part of the lowering, so a 600px root stays 600px in a
/// 390px region and centers at x=-105 until its authored max-width constrains it.
pub fn centered_root(element: AnyElement, rect: AvailableSpaceRect) -> AnyElement {
    div()
        .absolute()
        .left(px(rect.x))
        .top(px(rect.y))
        .w(px(rect.width))
        .h(px(rect.height))
        .flex()
        .items_center()
        .justify_center()
        .child(element)
        .into_any_element()
}
