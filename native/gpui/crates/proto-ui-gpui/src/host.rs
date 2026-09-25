//! Renders Proto surfaces into GPUI and turns GPUI input into routed samples.
//!
//! This is the half of the input path that knows about GPUI. It answers the
//! two questions [`crate::input::InputRouter`] needs answered for every input:
//! which surfaces physically contain the target, innermost first, and which
//! instance owns it. The router decides the rest.
//!
//! # How the hit path is collected
//!
//! Every surface registers bubble-phase mouse listeners, which GPUI calls only
//! while that surface's hitbox is hovered and in front-to-back order, so they
//! append themselves to a collector innermost first. The host registers one
//! raw listener before any surface paints: GPUI runs it first in the capture
//! phase, where it clears the collector, and last in the bubble phase, where
//! it hands the collected path to the router.
//!
//! This means a GPUI element that stops propagation hides the input from every
//! surface outside it, and from the router. That is deliberate: it is what
//! `stopPropagation` does to a Web root element's bubble-phase listeners.
//!
//! # Key input
//!
//! A key press targets the focused surface and its ancestors. When no surface
//! is focused the host keeps focus on its own root, which plays the part
//! `document.body` plays in a browser: key presses still arrive, reach every
//! global lease, and reach no root lease.
//!
//! # Focus facts
//!
//! The Focus module learns about focus from `host:focus` and `host:blur` on
//! its root, not from `nav.focus`. A session's focus target is its root
//! surface, the one opaque target the peer declares as `focus-root`. When GPUI
//! focus moves the host compares the focused surface before and after, and
//! reports the blur before the focus, in the order a browser dispatches them.
//! GPUI's per-handle focus callbacks are only the trigger for that comparison:
//! several of them fire for one change, in an order that is not guaranteed.
//!
//! # Accessibility
//!
//! A session's root surface carries the projection of its accessibility
//! snapshot, see [`crate::a11y`]. Text is rendered with an id, which GPUI
//! needs to report it: a button's name comes from the text beneath it. When
//! assistive technology activates the root, the host routes a click no
//! pointer made, which reaches the Prototype the way any activation does.

use std::cell::RefCell;
use std::collections::HashMap;
use std::panic::Location;
use std::rc::Rc;

use gpui::prelude::*;
use gpui::{
    accesskit, canvas, div, AccessibleAction, AnyElement, App, Bounds, Context, DispatchPhase, Div,
    ElementId, Empty, FocusHandle, GlobalElementId, InspectorElementId, KeyDownEvent, KeyUpEvent,
    LayoutId, MouseButton, MouseDownEvent, MouseExitEvent, MouseMoveEvent, MouseUpEvent, Pixels,
    SharedString, Stateful, StyleRefinement, Subscription, Text, Window,
};
use proto_ui_host_protocol::event_type::{EventType, ExtensionEvent};
use proto_ui_host_protocol::wire::SessionId;

use crate::a11y::{names_from_descendants, A11yProjection};
use crate::input::{
    HostInput, InputRouter, PointerPhase, RouteOwner, Routed, SessionRoute, SurfaceId, Target,
};
use crate::key::{from_key_down, from_key_up, PortableModifiers};

/// One surface to render.
#[derive(Clone)]
pub struct SurfaceNode {
    pub id: SurfaceId,
    /// The session rendering the instance this surface belongs to. A surface
    /// that is not a session's root belongs to the instance around it.
    pub session: SessionId,
    pub style: StyleRefinement,
    pub focus: Option<FocusHandle>,
    /// What the surface reports to accessibility. Only a session's root
    /// carries one: a snapshot describes the instance.
    pub a11y: Option<A11yProjection>,
    pub children: Vec<SurfaceChild>,
}

/// What a surface contains: more surfaces, or text.
///
/// Text is not a surface. It has no identity, takes no input of its own and
/// belongs to no session, exactly as a DOM text node is not an element. Like
/// a DOM text node it is still reported to accessibility.
#[derive(Clone)]
pub enum SurfaceChild {
    /// Boxed: a surface carries a whole style, and text is a handle.
    Surface(Box<SurfaceNode>),
    Text(SharedString),
    /// Another session's instance, rendered here: a part the host places in
    /// a slot of the instance it belongs to. The hub replaces it with that
    /// session's surfaces when it publishes, and drops it while that session
    /// has none.
    Session(SessionId),
}

impl From<SurfaceNode> for SurfaceChild {
    fn from(surface: SurfaceNode) -> Self {
        Self::Surface(Box::new(surface))
    }
}

impl SurfaceNode {
    /// The child surfaces, skipping text.
    pub fn child_surfaces(&self) -> impl Iterator<Item = &SurfaceNode> {
        self.children.iter().filter_map(|child| match child {
            SurfaceChild::Surface(surface) => Some(surface.as_ref()),
            SurfaceChild::Text(_) | SurfaceChild::Session(_) => None,
        })
    }

    /// The text beneath this surface, in document order, one space between
    /// separate pieces: what an accessible name computed from content reads.
    pub fn text_content(&self) -> String {
        fn collect(surface: &SurfaceNode, into: &mut Vec<String>) {
            for child in &surface.children {
                match child {
                    SurfaceChild::Surface(inner) => collect(inner, into),
                    SurfaceChild::Text(text) => {
                        let text = text.trim();
                        if !text.is_empty() {
                            into.push(text.to_string());
                        }
                    }
                    SurfaceChild::Session(_) => {}
                }
            }
        }
        let mut pieces = Vec::new();
        collect(self, &mut pieces);
        pieces.join(" ")
    }

    /// The sessions placed anywhere beneath this surface.
    pub fn placed_sessions(&self) -> Vec<SessionId> {
        let mut placed = Vec::new();
        for child in &self.children {
            match child {
                SurfaceChild::Surface(surface) => placed.extend(surface.placed_sessions()),
                SurfaceChild::Session(session) => placed.push(session.clone()),
                SurfaceChild::Text(_) => {}
            }
        }
        placed
    }
}

/// Input state shared by the host view and its listeners.
#[derive(Default)]
pub struct InputBridge {
    router: InputRouter,
    /// Surfaces whose listener saw the current mouse event, innermost first.
    collected: Vec<SurfaceId>,
    owner_of: HashMap<SurfaceId, SessionId>,
    parent_of: HashMap<SurfaceId, SurfaceId>,
    /// Each session's root surface: the outermost surface it renders.
    root_of: HashMap<SessionId, SurfaceId>,
    focusable: Vec<(FocusHandle, SurfaceId)>,
    /// The surface that held focus when focus was last compared.
    focused: Option<SurfaceId>,
    /// The hit path of the primary button's press, for the click that may
    /// follow its release.
    pressed_primary: Option<Vec<SurfaceId>>,
    output: Vec<Routed>,
    /// GPUI keys that reached the host without a web spelling. Reported
    /// rather than dropped: a Prototype would never have seen them, and
    /// knowing which ones arrived is how the key table grows.
    unmapped_keys: Vec<String>,
    /// For each session that is a trigger, the session anchoring its group.
    trigger_anchor: HashMap<SessionId, SessionId>,
}

impl InputBridge {
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds or updates the session a surface tree renders.
    pub fn upsert_session(&mut self, route: SessionRoute) {
        self.router.upsert_session(route);
    }

    pub fn remove_session(&mut self, session_id: &str) {
        self.router.remove_session(session_id);
        self.trigger_anchor.remove(session_id);
    }

    /// The session anchoring a trigger's group, if the session is a trigger.
    pub fn trigger_anchor(&self, session_id: &str) -> Option<&SessionId> {
        self.trigger_anchor.get(session_id)
    }

    /// Records whether a session is a trigger, and which session anchors its
    /// group if it is.
    pub fn set_trigger_anchor(&mut self, session_id: &str, anchor: Option<SessionId>) {
        match anchor {
            Some(anchor) => self.trigger_anchor.insert(session_id.to_string(), anchor),
            None => self.trigger_anchor.remove(session_id),
        };
    }

    /// Takes every sample routed since the last call, in routing order.
    pub fn drain(&mut self) -> Vec<Routed> {
        std::mem::take(&mut self.output)
    }

    /// GPUI key names that arrived with no web spelling.
    pub fn unmapped_keys(&self) -> &[String] {
        &self.unmapped_keys
    }

    fn index(&mut self, surfaces: &[SurfaceNode]) {
        self.owner_of.clear();
        self.parent_of.clear();
        self.root_of.clear();
        self.focusable.clear();
        // Reversed so the stack visits surfaces in document order, which makes
        // the first root recorded for a session the outermost one.
        let mut pending: Vec<(&SurfaceNode, Option<&SurfaceNode>)> = surfaces
            .iter()
            .rev()
            .map(|surface| (surface, None))
            .collect();
        while let Some((surface, parent)) = pending.pop() {
            self.owner_of
                .insert(surface.id.clone(), surface.session.clone());
            if let Some(parent) = parent {
                self.parent_of.insert(surface.id.clone(), parent.id.clone());
            }
            if parent.is_none_or(|parent| parent.session != surface.session) {
                self.root_of
                    .entry(surface.session.clone())
                    .or_insert_with(|| surface.id.clone());
            }
            if let Some(focus) = &surface.focus {
                self.focusable.push((focus.clone(), surface.id.clone()));
            }
            let children: Vec<&SurfaceNode> = surface.child_surfaces().collect();
            pending.extend(
                children
                    .into_iter()
                    .rev()
                    .map(|child| (child, Some(surface))),
            );
        }
    }

    /// Who owns an input on these surfaces, as the Web router decides it.
    ///
    /// `resolveOwningTrigger` first: the nearest trigger on the path owns the
    /// input for its group, so a click on a Switch's thumb belongs to the
    /// Switch. Without a trigger, `resolveOwningProtoInstance`: the innermost
    /// instance owns it.
    ///
    /// A group's input goes to the group's anchor. For a lone trigger that is
    /// the trigger itself, as in the Web. A group of several triggers routes
    /// differently there: to its deepest member, whose router every member
    /// shares. No Prototype this host runs forms such a group yet.
    fn target(&self, physical: Vec<SurfaceId>) -> Target {
        let trigger = physical.iter().find_map(|surface| {
            let session = self.owner_of.get(surface)?;
            self.trigger_anchor.get(session)
        });
        let owner = trigger
            .or_else(|| {
                physical
                    .first()
                    .and_then(|innermost| self.owner_of.get(innermost))
            })
            .map_or(RouteOwner::Unowned, |session| {
                RouteOwner::Session(session.clone())
            });
        Target { physical, owner }
    }

    fn focused_target(&self, window: &Window) -> Target {
        let Some(focused) = self
            .focusable
            .iter()
            .find(|(handle, _)| handle.is_focused(window))
            .map(|(_, surface)| surface.clone())
        else {
            return Target::nowhere();
        };
        self.surface_target(focused)
    }

    /// A surface and its ancestors, innermost first.
    fn surface_target(&self, surface: SurfaceId) -> Target {
        let mut physical = vec![surface];
        while let Some(parent) = physical.last().and_then(|last| self.parent_of.get(last)) {
            physical.push(parent.clone());
        }
        self.target(physical)
    }

    /// Assistive technology asked to activate a surface: a click no pointer
    /// made, as a browser dispatches one for an accessibility activation.
    fn activate(&mut self, surface: SurfaceId) {
        let target = self.surface_target(surface);
        self.route(HostInput::Click {
            target,
            detail: 0,
            modifiers: PortableModifiers::default(),
        });
    }

    /// Compares the focused surface with the last one seen, and reports the
    /// change as `host:blur` on the old surface followed by `host:focus` on
    /// the new one.
    ///
    /// Focus moving to something that is not a surface, such as an embedded
    /// GPUI text field inside one, blurs the surface: a browser fires `blur`
    /// on an element when focus moves to one of its descendants.
    ///
    /// An inactive window holds no focus here, although GPUI keeps its focused
    /// handle. A browser fires `blur` on the focused element when its window
    /// loses activation and `focus` when it regains it, and GPUI calls the
    /// focus callbacks at exactly those moments.
    fn sync_focus(&mut self, window: &Window) {
        let now = window
            .is_window_active()
            .then(|| {
                self.focusable
                    .iter()
                    .find(|(handle, _)| handle.is_focused(window))
                    .map(|(_, surface)| surface.clone())
            })
            .flatten();
        if now == self.focused {
            return;
        }
        let before = std::mem::replace(&mut self.focused, now.clone());
        if let Some(surface) = before {
            self.route(HostInput::HostEvent {
                surface,
                event: host_event("host:blur"),
            });
        }
        if let Some(surface) = now {
            self.route(HostInput::HostEvent {
                surface,
                event: host_event("host:focus"),
            });
        }
    }

    fn focus_handle_of(&self, surface: &SurfaceId) -> Option<FocusHandle> {
        self.focusable
            .iter()
            .find(|(_, candidate)| candidate == surface)
            .map(|(handle, _)| handle.clone())
    }

    fn route(&mut self, input: HostInput) {
        let routed = self.router.route(&input);
        self.output.extend(routed);
    }

    fn mouse_down(&mut self, event: &MouseDownEvent) {
        let path = std::mem::take(&mut self.collected);
        let modifiers = PortableModifiers::from(event.modifiers);
        let target = self.target(path.clone());
        self.route(HostInput::Pointer {
            phase: PointerPhase::Down,
            target: target.clone(),
            modifiers,
        });
        match event.button {
            MouseButton::Left => self.pressed_primary = Some(path),
            // macOS and Linux raise the context menu on the secondary press.
            MouseButton::Right => self.route(HostInput::ContextMenu { target, modifiers }),
            _ => {}
        }
    }

    fn mouse_up(&mut self, event: &MouseUpEvent) {
        let path = std::mem::take(&mut self.collected);
        let modifiers = PortableModifiers::from(event.modifiers);
        self.route(HostInput::Pointer {
            phase: PointerPhase::Up,
            target: self.target(path.clone()),
            modifiers,
        });
        // A click belongs to the primary button, and lands on the innermost
        // surface that contained both the press and the release: the browser
        // fires `click` on the nearest common ancestor of the two targets.
        if event.button != MouseButton::Left {
            return;
        }
        let Some(pressed) = self.pressed_primary.take() else {
            return;
        };
        let common = common_ancestors(&pressed, &path);
        if common.is_empty() {
            return;
        }
        self.route(HostInput::Click {
            target: self.target(common),
            detail: event.click_count as u32,
            modifiers,
        });
    }

    fn mouse_move(&mut self, event: &MouseMoveEvent) {
        let path = std::mem::take(&mut self.collected);
        self.route(HostInput::Pointer {
            phase: PointerPhase::Move,
            target: self.target(path),
            modifiers: PortableModifiers::from(event.modifiers),
        });
    }

    fn mouse_exit(&mut self, event: &MouseExitEvent) {
        self.collected.clear();
        self.route(HostInput::PointerExit {
            modifiers: PortableModifiers::from(event.modifiers),
        });
    }

    fn key_down(&mut self, event: &KeyDownEvent, window: &Window) {
        let Some(fields) = from_key_down(event) else {
            self.unmapped_keys.push(event.keystroke.key.clone());
            return;
        };
        let target = self.focused_target(window);
        self.route(HostInput::KeyDown { target, fields });
    }

    fn key_up(&mut self, event: &KeyUpEvent, window: &Window) {
        let Some(fields) = from_key_up(event) else {
            self.unmapped_keys.push(event.keystroke.key.clone());
            return;
        };
        let target = self.focused_target(window);
        self.route(HostInput::KeyUp { target, fields });
    }
}

fn host_event(name: &str) -> ExtensionEvent {
    match EventType::parse(name) {
        Ok(EventType::Extension(event)) => event,
        other => unreachable!("`{name}` is a host event type, got {other:?}"),
    }
}

/// The focus target the peer declares for a session: its root surface.
pub const FOCUS_ROOT_REF: &str = "focus-root";

/// What a `focus.request` asks for, and the `focus.result` status it gets.
///
/// These are the wire enums from the protocol crate, so what the host decides
/// is exactly what it can send. The statuses mean:
///
/// - `Applied`: focus is where the request asked for it.
/// - `NotReady`: the session's surface is not rendered yet. The peer keeps the
///   request and retries when the target becomes ready
///   (`HC-FOCUS-TARGET-0001-C`).
/// - `Rejected`: the target is not one this session declares, cannot take
///   focus, or GPUI did not move focus to it. Never reported as applied: a
///   focus request that did not land must say so (`HC-FOCUS-TARGET-0001-B`).
pub use proto_ui_host_protocol::messages::{FocusAction, FocusResultStatus};

/// The surfaces two innermost-first paths share, innermost first.
fn common_ancestors(a: &[SurfaceId], b: &[SurfaceId]) -> Vec<SurfaceId> {
    let mut common: Vec<SurfaceId> = a
        .iter()
        .rev()
        .zip(b.iter().rev())
        .take_while(|(x, y)| x == y)
        .map(|(x, _)| x.clone())
        .collect();
    common.reverse();
    common
}

/// A GPUI view rendering a forest of surfaces and feeding their input to an
/// [`InputBridge`].
pub struct ProtoHostView {
    pub(crate) bridge: Rc<RefCell<InputBridge>>,
    pub(crate) surfaces: Vec<SurfaceNode>,
    pub(crate) focus: FocusHandle,
    pub(crate) focus_subscriptions: Vec<Subscription>,
    pub(crate) hub: crate::hub::HostHub,
}

impl ProtoHostView {
    pub fn new(
        bridge: Rc<RefCell<InputBridge>>,
        surfaces: Vec<SurfaceNode>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Self {
        let mut view = Self {
            bridge,
            surfaces,
            focus: cx.focus_handle(),
            focus_subscriptions: Vec::new(),
            hub: crate::hub::HostHub::default(),
        };
        view.subscribe_focus(window, cx);
        view
    }

    /// Watches every focusable surface, and the host root, for focus moving.
    pub(crate) fn subscribe_focus(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let mut handles = vec![self.focus.clone()];
        let mut pending: Vec<&SurfaceNode> = self.surfaces.iter().collect();
        while let Some(surface) = pending.pop() {
            handles.extend(surface.focus.clone());
            pending.extend(surface.child_surfaces());
        }
        self.focus_subscriptions = handles
            .iter()
            .flat_map(|handle| {
                [
                    cx.on_focus(handle, window, |view, window, _| {
                        view.bridge.borrow_mut().sync_focus(window)
                    }),
                    cx.on_blur(handle, window, |view, window, _| {
                        view.bridge.borrow_mut().sync_focus(window)
                    }),
                ]
            })
            .collect();
    }

    /// Applies a `focus.request` to the session's focus target.
    ///
    /// Blurring moves focus to the host root rather than to nothing, so that
    /// key presses keep arriving, as they do at `document.body` in a browser.
    pub fn request_focus(
        &mut self,
        session_id: &str,
        target: &str,
        action: FocusAction,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> FocusResultStatus {
        if target != FOCUS_ROOT_REF {
            return FocusResultStatus::Rejected;
        }
        let handle = {
            let bridge = self.bridge.borrow();
            let Some(root) = bridge.root_of.get(session_id) else {
                return FocusResultStatus::NotReady;
            };
            let Some(handle) = bridge.focus_handle_of(root) else {
                return FocusResultStatus::Rejected;
            };
            handle
        };
        match action {
            FocusAction::Focus => {
                window.focus(&handle, cx);
                if handle.is_focused(window) {
                    FocusResultStatus::Applied
                } else {
                    FocusResultStatus::Rejected
                }
            }
            FocusAction::Blur => {
                if handle.is_focused(window) {
                    window.focus(&self.focus, cx);
                }
                FocusResultStatus::Applied
            }
        }
    }

    /// The host's own focus, held while no surface is focused.
    pub fn focus_handle(&self) -> &FocusHandle {
        &self.focus
    }

    pub fn set_surfaces(
        &mut self,
        surfaces: Vec<SurfaceNode>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        self.surfaces = surfaces;
        self.subscribe_focus(window, cx);
        cx.notify();
    }
}

impl Render for ProtoHostView {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        self.bridge.borrow_mut().index(&self.surfaces);
        let (down, up) = (self.bridge.clone(), self.bridge.clone());
        let mouse = self.bridge.clone();

        div()
            .id("proto-host")
            .track_focus(&self.focus)
            .relative()
            .size_full()
            // Capture phase: the host sees a key before any surface handles it.
            .capture_key_down(move |event, window, _| down.borrow_mut().key_down(event, window))
            .capture_key_up(move |event, window, _| up.borrow_mut().key_up(event, window))
            // Painted before every surface, so its listeners are registered
            // first: first in the capture phase, last in the bubble phase.
            .child(
                canvas(
                    |_, _, _| {},
                    move |_, _, window, _| register_mouse_listeners(&mouse, window),
                )
                .absolute()
                .size_full(),
            )
            .children(
                self.surfaces
                    .iter()
                    .map(|surface| render_surface(surface, &self.bridge)),
            )
    }
}

fn register_mouse_listeners(bridge: &Rc<RefCell<InputBridge>>, window: &mut Window) {
    fn listen<E: gpui::MouseEvent>(
        bridge: &Rc<RefCell<InputBridge>>,
        window: &mut Window,
        finish: fn(&mut InputBridge, &E),
    ) {
        let bridge = bridge.clone();
        window.on_mouse_event(move |event: &E, phase, _, _| {
            let mut bridge = bridge.borrow_mut();
            match phase {
                DispatchPhase::Capture => bridge.collected.clear(),
                DispatchPhase::Bubble => finish(&mut bridge, event),
            }
        });
    }
    listen::<MouseDownEvent>(bridge, window, InputBridge::mouse_down);
    listen::<MouseUpEvent>(bridge, window, InputBridge::mouse_up);
    listen::<MouseMoveEvent>(bridge, window, InputBridge::mouse_move);
    listen::<MouseExitEvent>(bridge, window, InputBridge::mouse_exit);
}

fn render_surface(surface: &SurfaceNode, bridge: &Rc<RefCell<InputBridge>>) -> AnyElement {
    let collector = || {
        let bridge = bridge.clone();
        let id = surface.id.clone();
        move || bridge.borrow_mut().collected.push(id.clone())
    };
    let (on_down, on_up, on_move) = (collector(), collector(), collector());

    let mut element = div().id(ElementId::Name(surface.id.clone().into()));
    *element.style() = surface.style.clone();
    if let Some(focus) = &surface.focus {
        element = element.track_focus(focus);
    }
    // Every button, in both directions. The fluent API offers a per-button
    // release only, so these go through the imperative one.
    let interactivity = element.interactivity();
    interactivity.on_any_mouse_down(move |_, _, _| on_down());
    interactivity.on_any_mouse_up(move |_, _, _| on_up());
    interactivity.on_mouse_move(move |_, _, _| on_move());
    if let Some(a11y) = &surface.a11y {
        element = element.role(a11y.role);
        if let Some(label) = &a11y.label {
            element = element.aria_label(label.clone());
        } else if a11y.name_from_content && !names_from_descendants(a11y.role) {
            // AccessKit does not name this role from the text beneath it, so
            // the host reads the text and names it.
            let text = surface.text_content();
            if !text.is_empty() {
                element = element.aria_label(text);
            }
        }
        if let Some(toggled) = a11y.toggled {
            element = element.aria_toggled(toggled);
        }
        if a11y.activatable {
            let bridge = bridge.clone();
            let id = surface.id.clone();
            element = element.on_a11y_action(AccessibleAction::Click, move |_, _, _| {
                bridge.borrow_mut().activate(id.clone())
            });
        }
    }
    let element = element.children(surface.children.iter().enumerate().map(|(index, child)| {
        match child {
            SurfaceChild::Surface(surface) => render_surface(surface, bridge),
            SurfaceChild::Text(text) => Text::new(
                ElementId::NamedInteger("text".into(), index as u64),
                text.clone(),
            )
            .into_any_element(),
            // Only a session with nothing to show yet is still a placeholder.
            SurfaceChild::Session(_) => Empty.into_any_element(),
        }
    }));
    match &surface.a11y {
        Some(a11y) if a11y.disabled => Disabled(element).into_any_element(),
        _ => element.into_any_element(),
    }
}

/// A surface reported to accessibility as disabled.
///
/// GPUI's element builders cannot mark an element disabled for
/// accessibility, so this wraps the surface and adds the flag to what it
/// reports. Everything else, layout and input included, is the surface's own.
struct Disabled(Stateful<Div>);

impl IntoElement for Disabled {
    type Element = Self;

    fn into_element(self) -> Self::Element {
        self
    }
}

impl Element for Disabled {
    type RequestLayoutState = <Stateful<Div> as Element>::RequestLayoutState;
    type PrepaintState = <Stateful<Div> as Element>::PrepaintState;

    fn id(&self) -> Option<ElementId> {
        Element::id(&self.0)
    }

    fn source_location(&self) -> Option<&'static Location<'static>> {
        Element::source_location(&self.0)
    }

    fn request_layout(
        &mut self,
        id: Option<&GlobalElementId>,
        inspector_id: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, Self::RequestLayoutState) {
        Element::request_layout(&mut self.0, id, inspector_id, window, cx)
    }

    fn prepaint(
        &mut self,
        id: Option<&GlobalElementId>,
        inspector_id: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        request_layout: &mut Self::RequestLayoutState,
        window: &mut Window,
        cx: &mut App,
    ) -> Self::PrepaintState {
        Element::prepaint(
            &mut self.0,
            id,
            inspector_id,
            bounds,
            request_layout,
            window,
            cx,
        )
    }

    fn paint(
        &mut self,
        id: Option<&GlobalElementId>,
        inspector_id: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        request_layout: &mut Self::RequestLayoutState,
        prepaint: &mut Self::PrepaintState,
        window: &mut Window,
        cx: &mut App,
    ) {
        Element::paint(
            &mut self.0,
            id,
            inspector_id,
            bounds,
            request_layout,
            prepaint,
            window,
            cx,
        )
    }

    fn a11y_role(&self) -> Option<accesskit::Role> {
        Element::a11y_role(&self.0)
    }

    fn write_a11y_info(&self, node: &mut accesskit::Node) {
        Element::write_a11y_info(&self.0, node);
        node.set_disabled();
    }

    fn a11y_synthetic_children(
        &mut self,
        prepaint: &mut Self::PrepaintState,
        builder: &mut gpui::A11ySubtreeBuilder,
    ) {
        Element::a11y_synthetic_children(&mut self.0, prepaint, builder)
    }
}
