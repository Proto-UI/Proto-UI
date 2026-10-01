//! Routes host input to the leases that asked for it.
//!
//! This is the GPUI host's counterpart of
//! `packages/adapters/base/src/events/web-event-router.ts`, and it follows that
//! router rule for rule rather than re-deriving the semantics. The Web router
//! is the realization every Prototype has been exercised against; a host that
//! routed differently could pass its own tests and still break a Prototype
//! that depended on the difference.
//!
//! It is written against surfaces rather than GPUI types. The GPUI binding
//! reports where an input landed: the surfaces physically containing the
//! target, and which instance owns the target once portal links and trigger
//! marks are resolved. This module decides who hears about it. That split
//! keeps the rules testable without a window, and keeps GPUI's hit-testing out
//! of the part that has to match the Web.
//!
//! # What the Web router does, and so what this does
//!
//! Each Web router listens in two places, and the difference is observable:
//!
//! - **On its root element.** Pointer events, commit-key presses, clicks and
//!   context menus that bubble through the root. These fire innermost root
//!   first, because that is the order bubbling reaches them. Pointer events
//!   and context menus are emitted unconditionally here; clicks additionally
//!   require the click to be owned by this instance.
//! - **On the window.** Every key press and release, plus a fallback for
//!   pointer events, clicks and context menus whose target is outside the root
//!   but owned by it — a portaled overlay, typically. These fire in
//!   registration order, after every root listener.
//!
//! Only `key.down` and `key.up` reach the global scope. Every other semantic
//! event is root-scoped, so a global `pointer.down` lease never fires.
//!
//! `press.start`, `press.end` and `press.cancel` have no producer in the Web
//! router, so they have none here either.
//!
//! # Where the platform, not the router, differs
//!
//! After Enter or Space on a native button, a browser fires a `click` of its
//! own with `detail === 0`. The Web router has already committed on the key,
//! so it suppresses that click once. GPUI fires no such click for a key the
//! host routes itself, so here a zero-detail click is always an activation in
//! its own right, such as one an assistive technology requests. Suppressing it
//! would lose that activation. [`KeyboardClick`] says which platform the
//! router is running on; the rule for each is the Web router's.

use std::collections::HashSet;

use proto_ui_host_protocol::event_type::{CoreEvent, EventType, ExtensionEvent, OptionalEvent};
use proto_ui_host_protocol::model::{HostSessionSnapshot, SessionPhase};
use proto_ui_host_protocol::wire::{EventScope, InputSample, LeaseId, SessionId, ViewEpoch};

use crate::key::{PortableKeyFields, PortableModifiers};

/// Identifies one rendered surface in the host's element tree.
pub type SurfaceId = String;

/// Which instance owns an input's target, once portal links and trigger marks
/// are resolved by the host.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RouteOwner {
    /// The session rendering the owning instance.
    Session(SessionId),
    /// A trigger route matched the target and declined it. Anything that
    /// requires ownership reaches nobody. This is the Web router's
    /// `REJECTED_TRIGGER_ROUTE`.
    Rejected,
    /// No instance owns the target.
    Unowned,
}

/// Where an input landed.
#[derive(Debug, Clone)]
pub struct Target {
    /// Surfaces physically containing the target, innermost first. For
    /// pointer input this is the hit path; for key input, the focused
    /// element and its ancestors.
    ///
    /// Physical, not logical: a portaled overlay is not inside the surface it
    /// logically belongs to, exactly as a portaled DOM node is not inside the
    /// root element that rendered it.
    pub physical: Vec<SurfaceId>,
    /// The owning instance, following logical links the physical path does not.
    pub owner: RouteOwner,
}

impl Target {
    /// An input that landed on no surface, such as a key press with nothing
    /// focused.
    pub fn nowhere() -> Self {
        Self {
            physical: Vec::new(),
            owner: RouteOwner::Unowned,
        }
    }
}

/// The phase of a pointer input.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PointerPhase {
    Down,
    Move,
    Up,
    Cancel,
}

/// One input, as the GPUI binding reports it.
#[derive(Debug, Clone)]
pub enum HostInput {
    /// A pointer input at a position.
    Pointer {
        phase: PointerPhase,
        target: Target,
        modifiers: PortableModifiers,
    },
    /// The pointer left the window.
    PointerExit { modifiers: PortableModifiers },
    /// A completed click. `detail` is the click count, and `0` for a click
    /// that no pointer produced: one a browser synthesizes after a keyboard
    /// activation, or one an assistive technology requests.
    Click {
        target: Target,
        detail: u32,
        modifiers: PortableModifiers,
    },
    /// A context-menu request.
    ContextMenu {
        target: Target,
        modifiers: PortableModifiers,
    },
    /// A key press.
    KeyDown {
        target: Target,
        fields: PortableKeyFields,
    },
    /// A key release.
    KeyUp {
        target: Target,
        fields: PortableKeyFields,
    },
    /// A host-local event at one surface, such as `host:focus`.
    ///
    /// It reaches the root leases of that type on the session whose root is
    /// that surface, and nothing else. It does not bubble: the Web router binds
    /// a `host:*` listener on the root element itself, and `focus` and `blur`
    /// do not bubble to it from descendants. It never reaches a global lease,
    /// which the Web binds on the window rather than on any element.
    HostEvent {
        surface: SurfaceId,
        event: ExtensionEvent,
    },
}

/// A lease the router can deliver to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RoutedLease {
    pub lease_id: LeaseId,
    pub scope: EventScope,
    pub event: EventType,
}

/// One session as the router sees it: an instance, the surface it renders
/// into, and the leases that can receive input.
#[derive(Debug, Clone)]
pub struct SessionRoute {
    pub session_id: SessionId,
    pub root: SurfaceId,
    pub view_epoch: ViewEpoch,
    pub leases: Vec<RoutedLease>,
}

impl SessionRoute {
    /// The leases a host session model can deliver to right now, or `None`
    /// when it can deliver to none.
    ///
    /// Mirrors the conditions `HostSessionModel::deliver` checks, so the
    /// router does not build samples the model is certain to reject. A lease
    /// whose type is not an event type can never match a routed input and is
    /// left out; the TypeScript Event module rejects such a type before it
    /// could be registered.
    pub fn from_snapshot(
        snapshot: &HostSessionSnapshot,
        root: impl Into<SurfaceId>,
    ) -> Option<Self> {
        if snapshot.phase == SessionPhase::Disposed {
            return None;
        }
        let epoch = snapshot.active_epoch?;
        if snapshot.current_epoch != Some(epoch) {
            return None;
        }
        let leases = snapshot
            .leases
            .iter()
            .filter(|lease| lease.active && !lease.released && lease.view_epoch == epoch)
            .filter_map(|lease| {
                EventType::parse(&lease.kind).ok().map(|event| RoutedLease {
                    lease_id: lease.lease_id.clone(),
                    scope: lease.scope,
                    event,
                })
            })
            .collect();
        Some(Self {
            session_id: snapshot.session_id.clone(),
            root: root.into(),
            view_epoch: epoch,
            leases,
        })
    }
}

/// A sample for one session.
#[derive(Debug, Clone)]
pub struct Routed {
    pub session_id: SessionId,
    pub sample: InputSample,
}

struct SessionState {
    route: SessionRoute,
    /// The Web router's `suppressFollowupDirectClick`: armed by a keyboard
    /// commit so the zero-detail click a platform synthesizes afterwards does
    /// not commit a second time.
    suppress_followup_click: bool,
}

/// What an input carries onto the portable payload.
#[derive(Clone)]
enum Payload {
    /// Pointer and click input carry the modifier flags only.
    Pointer(PortableModifiers),
    /// Key input also carries `key` and `repeat`.
    Key(PortableKeyFields),
    /// A host event carries none of the portable fields. A focus change has no
    /// key and no modifiers, and writing `false` for them would put a claim on
    /// the wire the host never observed.
    Host,
}

/// Whether the platform follows a keyboard activation with a click of its own.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum KeyboardClick {
    /// Nothing follows, as in GPUI. A zero-detail click is an activation in
    /// its own right, and it commits.
    #[default]
    NotSynthesized,
    /// A zero-detail click follows, as in a browser. The key has already
    /// committed, so the router suppresses that click once.
    Synthesized,
}

/// Routes host input to sessions.
#[derive(Default)]
pub struct InputRouter {
    keyboard_click: KeyboardClick,
    sessions: Vec<SessionState>,
    /// Surfaces under the pointer after the last pointer input, innermost
    /// first, from which enter and leave are derived.
    hovered: Vec<SurfaceId>,
    next_sample: u64,
}

impl InputRouter {
    pub fn new() -> Self {
        Self::default()
    }

    /// A router for a platform that does, or does not, click after a key.
    pub fn with_keyboard_click(keyboard_click: KeyboardClick) -> Self {
        Self {
            keyboard_click,
            ..Self::default()
        }
    }

    /// Adds a session, or replaces its leases after a new projection.
    ///
    /// A reprojection of a live session keeps its place in the window-listener
    /// order and its click suppression. In the Web a reprojection reuses the
    /// same router, so its window listeners stay where they were registered,
    /// and a keyboard commit's follow-up click must still be suppressed.
    ///
    /// A new session for a surface another session renders replaces that
    /// session and, like a newly created Web router, registers after
    /// everything already live. The Web router keeps one live router per root
    /// element (`activeRouterByRoot`), and a newer one disables the older.
    pub fn upsert_session(&mut self, route: SessionRoute) {
        if let Some(index) = self
            .sessions
            .iter()
            .position(|state| state.route.session_id == route.session_id)
        {
            let session_id = route.session_id.clone();
            let root = route.root.clone();
            self.sessions[index].route = route;
            self.sessions
                .retain(|state| state.route.session_id == session_id || state.route.root != root);
            return;
        }
        self.sessions.retain(|state| state.route.root != route.root);
        self.sessions.push(SessionState {
            route,
            suppress_followup_click: false,
        });
    }

    /// Removes a session.
    pub fn remove_session(&mut self, session_id: &str) {
        self.sessions
            .retain(|state| state.route.session_id != session_id);
    }

    /// Decides who hears about one input, in the order they hear it.
    pub fn route(&mut self, input: &HostInput) -> Vec<Routed> {
        let mut routing = Routing::default();
        match input {
            HostInput::Pointer {
                phase,
                target,
                modifiers,
            } => self.pointer(*phase, target, *modifiers, &mut routing),
            HostInput::PointerExit { modifiers } => {
                self.update_hover(&[], *modifiers, &mut routing);
            }
            HostInput::Click {
                target,
                detail,
                modifiers,
            } => self.click(target, *detail, *modifiers, &mut routing),
            HostInput::ContextMenu { target, modifiers } => {
                self.context_menu(target, *modifiers, &mut routing)
            }
            HostInput::KeyDown { target, fields } => self.key_down(target, fields, &mut routing),
            HostInput::KeyUp { target, fields } => self.key_up(target, fields, &mut routing),
            HostInput::HostEvent { surface, event } => {
                if let Some(index) = self
                    .sessions
                    .iter()
                    .position(|state| &state.route.root == surface)
                {
                    routing.emit(
                        &self.sessions[index].route,
                        &EventType::Extension(event.clone()),
                        &[EventScope::Root],
                        &Payload::Host,
                    );
                }
            }
        }
        routing.finish(&mut self.next_sample)
    }

    fn pointer(
        &mut self,
        phase: PointerPhase,
        target: &Target,
        modifiers: PortableModifiers,
        routing: &mut Routing,
    ) {
        // Boundary events precede the pointer event at the new position. A
        // cancel does not move the pointer, so it leaves hover alone; if the
        // pointer really left, the binding reports that separately.
        if phase != PointerPhase::Cancel {
            self.update_hover(&target.physical, modifiers, routing);
        }
        let event = EventType::Optional(match phase {
            PointerPhase::Down => OptionalEvent::PointerDown,
            PointerPhase::Move => OptionalEvent::PointerMove,
            PointerPhase::Up => OptionalEvent::PointerUp,
            PointerPhase::Cancel => OptionalEvent::PointerCancel,
        });
        let payload = Payload::Pointer(modifiers);

        // Root listeners: unconditional for every root the event bubbles
        // through. `web-event-router.ts` emits `pointer.*` from the root with
        // no ownership check.
        for index in self.bubble_order(&target.physical) {
            if phase == PointerPhase::Down {
                self.sessions[index].suppress_followup_click = false;
            }
            routing.emit(
                &self.sessions[index].route,
                &event,
                &[EventScope::Root],
                &payload,
            );
        }
        // Window listeners: the portal fallback, without the focused-element
        // fallback (`includeActiveFallback: false`).
        for index in self.portal_fallback(target) {
            if phase == PointerPhase::Down {
                self.sessions[index].suppress_followup_click = false;
            }
            routing.emit(
                &self.sessions[index].route,
                &event,
                &[EventScope::Root],
                &payload,
            );
        }
    }

    fn click(
        &mut self,
        target: &Target,
        detail: u32,
        modifiers: PortableModifiers,
        routing: &mut Routing,
    ) {
        let commit = EventType::Core(CoreEvent::PressCommit);
        let payload = Payload::Pointer(modifiers);
        // Unlike pointer input, a click commits only the instance that owns
        // it, so activating a Button inside a Dialog does not commit the
        // Dialog as well.
        let owned_roots: Vec<usize> = self
            .bubble_order(&target.physical)
            .into_iter()
            .filter(|&index| routes_to(target, &self.sessions[index].route))
            .collect();
        for index in owned_roots.into_iter().chain(self.portal_fallback(target)) {
            if self.suppresses_followup(index, detail) {
                continue;
            }
            self.sessions[index].suppress_followup_click = false;
            routing.emit(
                &self.sessions[index].route,
                &commit,
                &[EventScope::Root],
                &payload,
            );
        }
    }

    fn context_menu(
        &mut self,
        target: &Target,
        modifiers: PortableModifiers,
        routing: &mut Routing,
    ) {
        let event = EventType::Optional(OptionalEvent::ContextMenu);
        let payload = Payload::Pointer(modifiers);
        let indices: Vec<usize> = self
            .bubble_order(&target.physical)
            .into_iter()
            .chain(self.portal_fallback(target))
            .collect();
        for index in indices {
            routing.emit(
                &self.sessions[index].route,
                &event,
                &[EventScope::Root],
                &payload,
            );
        }
    }

    fn key_down(&mut self, target: &Target, fields: &PortableKeyFields, routing: &mut Routing) {
        let commit_key = fields.key == "Enter" || fields.key == " ";
        let key_down = EventType::Core(CoreEvent::KeyDown);
        let payload = Payload::Key(fields.clone());

        // Root listeners fire first, innermost first, and only act on commit
        // keys. So an Enter pressed inside a root commits before any
        // `key.down` for that press is delivered.
        if commit_key {
            for index in self.bubble_order(&target.physical) {
                self.commit_once(index, &payload, routing);
            }
        }

        // Window listeners, in registration order.
        for index in 0..self.sessions.len() {
            let routed = routes_to(target, &self.sessions[index].route);
            // Global first, then root: the order the Web router emits them in.
            // One sample carries both, because they are one host input with
            // one default action.
            let scopes: &[EventScope] = if routed {
                &[EventScope::Global, EventScope::Root]
            } else {
                &[EventScope::Global]
            };
            routing.emit(&self.sessions[index].route, &key_down, scopes, &payload);

            if !commit_key {
                // Any other key disarms click suppression, in every session.
                self.sessions[index].suppress_followup_click = false;
                continue;
            }
            let within_root = target.physical.contains(&self.sessions[index].route.root);
            // `hasFocusedDescendant`: a key press targets the focused element,
            // so a target inside the root means the root has focus within it.
            if routed || within_root {
                self.commit_once(index, &payload, routing);
            }
        }
    }

    fn key_up(&mut self, target: &Target, fields: &PortableKeyFields, routing: &mut Routing) {
        let key_up = EventType::Core(CoreEvent::KeyUp);
        let payload = Payload::Key(fields.clone());
        for index in 0..self.sessions.len() {
            let scopes: &[EventScope] = if routes_to(target, &self.sessions[index].route) {
                &[EventScope::Global, EventScope::Root]
            } else {
                &[EventScope::Global]
            };
            routing.emit(&self.sessions[index].route, &key_up, scopes, &payload);
        }
    }

    /// The Web router's `emitPressCommitOnce`: at most one keyboard commit per
    /// input per session, and the first one arms click suppression on a
    /// platform that clicks after a key.
    fn commit_once(&mut self, index: usize, payload: &Payload, routing: &mut Routing) {
        let session_id = self.sessions[index].route.session_id.clone();
        if !routing.committed.insert(session_id) {
            return;
        }
        if self.keyboard_click == KeyboardClick::Synthesized {
            self.sessions[index].suppress_followup_click = true;
        }
        routing.emit(
            &self.sessions[index].route,
            &EventType::Core(CoreEvent::PressCommit),
            &[EventScope::Root],
            payload,
        );
    }

    /// The Web router's `shouldSuppressFollowupClick`. Either way the flag is
    /// spent: suppression covers exactly one click.
    fn suppresses_followup(&mut self, index: usize, detail: u32) -> bool {
        let state = &mut self.sessions[index];
        if !state.suppress_followup_click {
            return false;
        }
        state.suppress_followup_click = false;
        detail == 0
    }

    /// Emits leave and enter for every root the pointer crossed.
    ///
    /// Leave before enter, innermost first for leave and outermost first for
    /// enter: the order a browser dispatches `pointerleave` and
    /// `pointerenter` in when the pointer moves between elements.
    fn update_hover(
        &mut self,
        now: &[SurfaceId],
        modifiers: PortableModifiers,
        routing: &mut Routing,
    ) {
        let before = std::mem::replace(&mut self.hovered, now.to_vec());
        let payload = Payload::Pointer(modifiers);
        let leave = EventType::Optional(OptionalEvent::PointerLeave);
        let enter = EventType::Optional(OptionalEvent::PointerEnter);

        for index in self.bubble_order(&before) {
            if !now.contains(&self.sessions[index].route.root) {
                routing.emit(
                    &self.sessions[index].route,
                    &leave,
                    &[EventScope::Root],
                    &payload,
                );
            }
        }
        for index in self.bubble_order(now).into_iter().rev() {
            if !before.contains(&self.sessions[index].route.root) {
                routing.emit(
                    &self.sessions[index].route,
                    &enter,
                    &[EventScope::Root],
                    &payload,
                );
            }
        }
    }

    /// Sessions whose root the target is physically inside, innermost first.
    fn bubble_order(&self, physical: &[SurfaceId]) -> Vec<usize> {
        physical
            .iter()
            .filter_map(|surface| {
                self.sessions
                    .iter()
                    .position(|state| &state.route.root == surface)
            })
            .collect()
    }

    /// The Web router's `shouldRouteGlobalRootEvent`: sessions that own a
    /// target they do not physically contain.
    fn portal_fallback(&self, target: &Target) -> Vec<usize> {
        (0..self.sessions.len())
            .filter(|&index| {
                let route = &self.sessions[index].route;
                !target.physical.contains(&route.root) && routes_to(target, route)
            })
            .collect()
    }
}

/// The Web router's `shouldRouteToCurrentRoot`.
///
/// Ownership decides when it is known. Only an unowned target falls back to
/// physical containment, which is `isWithinRoot`.
fn routes_to(target: &Target, route: &SessionRoute) -> bool {
    match &target.owner {
        RouteOwner::Session(owner) => *owner == route.session_id,
        RouteOwner::Rejected => false,
        RouteOwner::Unowned => target.physical.contains(&route.root),
    }
}

/// The emissions for one input, before sample ids are assigned.
#[derive(Default)]
struct Routing {
    emissions: Vec<(SessionId, ViewEpoch, EventType, Vec<LeaseId>, Payload)>,
    /// Sessions that already received a keyboard commit for this input.
    committed: HashSet<SessionId>,
}

impl Routing {
    /// Queues one event for one session, carrying the session's leases of that
    /// type in the given scopes, scope by scope. Nothing is queued when no
    /// lease asked for it; the state changes that go with the event still
    /// happen, as they do in the Web router whether or not anyone listens.
    fn emit(
        &mut self,
        route: &SessionRoute,
        event: &EventType,
        scopes: &[EventScope],
        payload: &Payload,
    ) {
        let leases: Vec<LeaseId> = scopes
            .iter()
            .flat_map(|scope| {
                route
                    .leases
                    .iter()
                    .filter(move |lease| lease.scope == *scope && lease.event == *event)
                    .map(|lease| lease.lease_id.clone())
            })
            .collect();
        if leases.is_empty() {
            return;
        }
        self.emissions.push((
            route.session_id.clone(),
            route.view_epoch,
            event.clone(),
            leases,
            payload.clone(),
        ));
    }

    fn finish(self, next_sample: &mut u64) -> Vec<Routed> {
        self.emissions
            .into_iter()
            .map(|(session_id, view_epoch, event, lease_ids, payload)| {
                *next_sample += 1;
                let (key, modifiers, repeat) = match payload {
                    Payload::Pointer(modifiers) => (None, Some(modifiers), None),
                    Payload::Key(fields) => (
                        Some(fields.key),
                        Some(fields.modifiers),
                        Some(fields.repeat),
                    ),
                    Payload::Host => (None, None, None),
                };
                Routed {
                    session_id,
                    sample: InputSample {
                        sample_id: format!("sample-{next_sample}"),
                        view_epoch,
                        kind: event.as_str().to_string(),
                        lease_ids,
                        key,
                        ctrl_key: modifiers.map(|modifiers| modifiers.ctrl),
                        meta_key: modifiers.map(|modifiers| modifiers.meta),
                        alt_key: modifiers.map(|modifiers| modifiers.alt),
                        shift_key: modifiers.map(|modifiers| modifiers.shift),
                        repeat,
                    },
                }
            })
            .collect()
    }
}
