use gpui::{
    accesskit, A11ySubtreeBuilder, App, Bounds, Element, ElementId, GlobalElementId,
    InspectorElementId, IntoElement, LayoutId, Pixels, Window,
};
use std::panic::Location;

/// The pinned Div supports roles, labels and click actions. Its disabled property
/// lives on the native AccessKit node. Forward the same element and its state
/// through every GPUI phase, adding only that property during node construction.
pub fn button_availability<E: Element>(button: E, disabled: bool) -> impl IntoElement {
    ButtonAvailability { button, disabled }
}

struct ButtonAvailability<E> {
    button: E,
    disabled: bool,
}

impl<E: Element> IntoElement for ButtonAvailability<E> {
    type Element = Self;
    fn into_element(self) -> Self { self }
}

impl<E: Element> Element for ButtonAvailability<E> {
    type RequestLayoutState = E::RequestLayoutState;
    type PrepaintState = E::PrepaintState;

    fn id(&self) -> Option<ElementId> { self.button.id() }
    fn source_location(&self) -> Option<&'static Location<'static>> { self.button.source_location() }
    fn a11y_role(&self) -> Option<accesskit::Role> { self.button.a11y_role() }

    fn write_a11y_info(&self, node: &mut accesskit::Node) {
        self.button.write_a11y_info(node);
        if self.disabled { node.set_disabled(); }
    }

    fn a11y_synthetic_children(&mut self, state: &mut Self::PrepaintState, builder: &mut A11ySubtreeBuilder) {
        self.button.a11y_synthetic_children(state, builder);
    }

    fn request_layout(
        &mut self, id: Option<&GlobalElementId>, inspector: Option<&InspectorElementId>,
        window: &mut Window, cx: &mut App,
    ) -> (LayoutId, Self::RequestLayoutState) {
        self.button.request_layout(id, inspector, window, cx)
    }

    fn prepaint(
        &mut self, id: Option<&GlobalElementId>, inspector: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>, layout: &mut Self::RequestLayoutState, window: &mut Window, cx: &mut App,
    ) -> Self::PrepaintState {
        self.button.prepaint(id, inspector, bounds, layout, window, cx)
    }

    fn paint(
        &mut self, id: Option<&GlobalElementId>, inspector: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>, layout: &mut Self::RequestLayoutState, prepaint: &mut Self::PrepaintState,
        window: &mut Window, cx: &mut App,
    ) {
        self.button.paint(id, inspector, bounds, layout, prepaint, window, cx);
    }
}
