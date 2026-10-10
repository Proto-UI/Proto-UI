//! Native association identity and qualified label input. These operations only
//! request the peer's semantic activation; they never change a control value.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};

use proto_ui_host_protocol::messages::{ControlLabelActivate, ControlLabelActivationSource};

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

/// A native renderer association, passed outside Prototype JSON Props.
/// Clone the value to associate exactly one label and one control.
#[derive(Clone, Debug)]
pub struct ControlLabelRef(u64);

impl Default for ControlLabelRef {
    fn default() -> Self {
        Self(NEXT_ID.fetch_add(1, Ordering::Relaxed))
    }
}

impl ControlLabelRef {
    pub fn new() -> Self {
        Self::default()
    }

    pub(crate) fn wire_key(&self) -> String {
        format!("native-label:{}", self.0)
    }
}

/// A unique host tree lifetime. The actual GPUI WindowId is also part of its
/// published scope; a logical session parent is never used as that scope.
#[derive(Debug)]
pub(crate) struct NativeTreeIdentity(pub u64);

impl Default for NativeTreeIdentity {
    fn default() -> Self {
        Self(NEXT_ID.fetch_add(1, Ordering::Relaxed))
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct LabelRoute {
    pub session_id: String,
    pub view_epoch: u64,
    pub lease_id: String,
    pub view_revision: u64,
}

struct PendingPointer {
    route: LabelRoute,
    origin: (f32, f32),
}

#[derive(Default)]
pub(crate) struct LabelInput {
    routes: HashMap<String, LabelRoute>,
    interactive: HashSet<String>,
    pending: Option<PendingPointer>,
    next_sequence: u64,
    output: Vec<ControlLabelActivate>,
}

impl LabelInput {
    pub fn replace_routes(&mut self, routes: HashMap<String, LabelRoute>) {
        self.routes = routes;
        if self
            .pending
            .as_ref()
            .is_some_and(|pending| !self.routes.values().any(|route| route == &pending.route))
        {
            self.pending = None;
        }
    }

    pub fn set_interactive(&mut self, interactive: HashSet<String>) {
        self.interactive = interactive;
    }

    pub fn route_for_session(&self, session: &str) -> Option<LabelRoute> {
        self.routes
            .values()
            .find(|route| route.session_id == session)
            .cloned()
    }

    fn eligible_route(&self, path: &[String]) -> Option<LabelRoute> {
        for surface in path {
            // A nested button/link/text control consumes its own operation;
            // it must never also activate an enclosing label's target.
            if self.interactive.contains(surface) {
                return None;
            }
            if let Some(route) = self.routes.get(surface) {
                return Some(route.clone());
            }
        }
        None
    }

    pub fn pointer_down(&mut self, path: &[String], position: (f32, f32), eligible: bool) {
        self.pending = if eligible {
            self.eligible_route(path).map(|route| PendingPointer {
                route,
                origin: position,
            })
        } else {
            None
        };
    }

    pub fn pointer_move(&mut self, position: (f32, f32)) {
        if self.pending.as_ref().is_some_and(|pending| {
            let dx = position.0 - pending.origin.0;
            let dy = position.1 - pending.origin.1;
            dx.hypot(dy) > 6.0
        }) {
            self.pending = None;
        }
    }

    pub fn pointer_up(&mut self, path: &[String], position: (f32, f32), eligible: bool) {
        self.pointer_move(position);
        let Some(pending) = self.pending.take() else {
            return;
        };
        if eligible && self.eligible_route(path).as_ref() == Some(&pending.route) {
            self.emit(pending.route, ControlLabelActivationSource::Pointer);
        }
    }

    pub fn cancel(&mut self) {
        self.pending = None;
    }

    pub fn accessibility(&mut self, expected: &LabelRoute) {
        if self.routes.values().any(|route| route == expected) {
            self.emit(
                expected.clone(),
                ControlLabelActivationSource::Accessibility,
            );
        }
    }

    fn emit(&mut self, route: LabelRoute, source: ControlLabelActivationSource) {
        self.next_sequence += 1;
        self.output.push(ControlLabelActivate {
            session_id: route.session_id,
            view_epoch: route.view_epoch,
            lease_id: route.lease_id,
            view_revision: route.view_revision,
            sequence: self.next_sequence,
            source,
        });
    }

    pub fn drain(&mut self) -> Vec<ControlLabelActivate> {
        std::mem::take(&mut self.output)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> (LabelInput, LabelRoute, Vec<String>) {
        let route = LabelRoute {
            session_id: "label".into(),
            view_epoch: 1,
            lease_id: "lease:1".into(),
            view_revision: 2,
        };
        let mut input = LabelInput::default();
        input.replace_routes(HashMap::from([("caption".into(), route.clone())]));
        (input, route, vec!["caption/text".into(), "caption".into()])
    }

    #[test]
    fn qualifies_one_primary_short_action_and_never_replays_release() {
        let (mut input, _, path) = fixture();
        input.pointer_down(&path, (1.0, 2.0), true);
        input.pointer_up(&path, (3.0, 4.0), true);
        input.pointer_up(&path, (3.0, 4.0), true);
        let output = input.drain();
        assert_eq!(output.len(), 1);
        assert_eq!(output[0].source, ControlLabelActivationSource::Pointer);
        assert_eq!(output[0].view_revision, 2);
    }

    #[test]
    fn rejects_modified_drag_cancel_nested_interactive_and_retired_actions() {
        let (mut input, old, path) = fixture();
        input.pointer_down(&path, (0.0, 0.0), false);
        input.pointer_up(&path, (0.0, 0.0), true);
        input.pointer_down(&path, (0.0, 0.0), true);
        input.pointer_move((7.0, 0.0));
        input.pointer_up(&path, (0.0, 0.0), true);
        input.pointer_down(&path, (0.0, 0.0), true);
        input.cancel();
        input.pointer_up(&path, (0.0, 0.0), true);
        input.set_interactive(HashSet::from(["caption/text".into()]));
        input.pointer_down(&path, (0.0, 0.0), true);
        input.pointer_up(&path, (0.0, 0.0), true);
        input.replace_routes(HashMap::new());
        input.accessibility(&old);
        assert!(input.drain().is_empty());
    }

    #[test]
    fn accessibility_is_bound_to_current_native_lease_and_has_its_own_source() {
        let (mut input, current, _) = fixture();
        let mut stale = current.clone();
        stale.view_revision -= 1;
        input.accessibility(&stale);
        input.accessibility(&current);
        let output = input.drain();
        assert_eq!(output.len(), 1);
        assert_eq!(
            output[0].source,
            ControlLabelActivationSource::Accessibility
        );
    }
}
