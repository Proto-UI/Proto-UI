//! Projects a Proto UI accessibility snapshot onto AccessKit.
//!
//! The peer sends one snapshot per instance: a role, a name, states, actions
//! and relations. GPUI reports an element to AccessKit when the element has
//! an id and a role, so the projection is what an instance's root surface
//! needs to be reported as that object.
//!
//! The mapping covers what the Prototypes this host runs have needed, and
//! says what it does not cover. A fact outside it comes back as an issue
//! rather than a guess: the A11y contract lets an Adapter project a subset of
//! the snapshot, or keep a fact as diagnostics only, but a wrong projection
//! tells assistive technology something the Prototype never said. For the
//! same reason a role this layer does not map leaves the object unreported
//! instead of reporting it under a nearby role.

use gpui::{Role, SharedString};
use proto_ui_host_protocol::wire::{A11yNameWire, A11ySnapshotWire};
use serde_json::Value;

/// What an instance's root surface reports to AccessKit.
#[derive(Debug, Clone, PartialEq)]
pub struct A11yProjection {
    pub role: Role,
    /// The name the Prototype gives as text. `None` when the name comes from
    /// the content: AccessKit names a button from the text beneath it.
    pub label: Option<SharedString>,
    pub disabled: bool,
    /// Whether assistive technology may activate the object. It asks through
    /// AccessKit's default action, and the host treats that as a click.
    pub activatable: bool,
}

/// A fact in a snapshot that the projection does not carry.
#[derive(Debug, Clone, PartialEq)]
pub enum A11yIssue {
    /// The snapshot names no role, so there is nothing to report it as.
    NoRole,
    /// A role this layer does not map. Nothing about the object is reported.
    Role(String),
    /// A state this layer does not map, or a value it does not understand for
    /// a state it does.
    State { name: String, value: Value },
    /// An action this layer does not map.
    Action(String),
    /// A relation this layer does not map.
    Relation(String),
    /// A heading level. No role this layer maps carries one.
    Level(u8),
}

/// Projects a snapshot, returning what it could not carry alongside it.
///
/// Without a projection the object is not reported at all, and the only
/// issue is the one that prevented it.
pub fn project(snapshot: &A11ySnapshotWire) -> (Option<A11yProjection>, Vec<A11yIssue>) {
    let role = match snapshot.role.as_deref() {
        None => return (None, vec![A11yIssue::NoRole]),
        Some(name) => match role(name) {
            Some(role) => role,
            None => return (None, vec![A11yIssue::Role(name.to_string())]),
        },
    };

    let mut issues = Vec::new();
    let label = match &snapshot.name {
        Some(A11yNameWire::Text { value }) => Some(SharedString::from(value.clone())),
        Some(A11yNameWire::Content) | None => None,
    };

    let mut disabled = false;
    for (name, value) in &snapshot.states {
        match (name.as_str(), value) {
            ("disabled", Value::Bool(value)) => disabled = *value,
            _ => issues.push(A11yIssue::State {
                name: name.clone(),
                value: value.clone(),
            }),
        }
    }

    let mut activatable = false;
    for name in snapshot.actions.keys() {
        // `activate` names the Expose event its invocation leads to, but the
        // action does not route that event: the activation takes the path any
        // activation takes, and the Prototype emits the event itself.
        match name.as_str() {
            "activate" => activatable = true,
            _ => issues.push(A11yIssue::Action(name.clone())),
        }
    }

    // A `null` relation is the absence of one, which needs no projection.
    issues.extend(
        snapshot
            .relations
            .iter()
            .filter(|(_, target)| !target.is_null())
            .map(|(name, _)| A11yIssue::Relation(name.clone())),
    );
    issues.extend(snapshot.level.map(A11yIssue::Level));

    let projection = A11yProjection {
        role,
        label,
        disabled,
        activatable,
    };
    (Some(projection), issues)
}

/// The AccessKit role for a Proto UI role.
fn role(name: &str) -> Option<Role> {
    match name {
        "button" => Some(Role::Button),
        _ => None,
    }
}
