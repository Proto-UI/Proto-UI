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
//!
//! Relations name other objects, which on this host are other sessions. GPUI's
//! element builders at the pinned revision set no AccessKit relation, so a
//! relation is carried only where it changes what is announced: `labelledBy`
//! gives the object its name, which the hub resolves across sessions. Any other
//! relation, such as a tab's `controls`, comes back as an issue.

use gpui::{Orientation, Role, SharedString, Toggled};
use proto_ui_host_protocol::wire::{A11yNameWire, A11ySnapshotWire};
use serde_json::Value;

/// What an instance's root surface reports to AccessKit.
#[derive(Debug, Clone, PartialEq)]
pub struct A11yProjection {
    pub role: Role,
    /// The name the Prototype gives as text.
    pub label: Option<SharedString>,
    /// Whether the name comes from the text beneath the object. AccessKit
    /// derives it for some roles; for the rest the host supplies it, see
    /// [`names_from_descendants`].
    pub name_from_content: bool,
    pub disabled: bool,
    /// Whether a toggle button or a switch is on, when the object is one.
    pub toggled: Option<Toggled>,
    /// Whether a tab is the selected one, when the object says.
    pub selected: Option<bool>,
    /// Which way a tab list runs, when the object says.
    pub orientation: Option<Orientation>,
    /// The objects whose text names this one. The hub resolves them into
    /// `label` when it publishes, because they live in other sessions.
    pub labelled_by: Option<A11yReference>,
    /// Whether assistive technology may activate the object. It asks through
    /// AccessKit's default action, and the host treats that as a click.
    pub activatable: bool,
}

/// How a relation names its target objects.
#[derive(Debug, Clone, PartialEq)]
pub enum A11yReference {
    /// By the id an object is given, as a string relation names it.
    Id(String),
    /// By semantic object, as a structured relation names them.
    Objects(Vec<String>),
}

/// A fact in a snapshot that the projection does not carry.
#[derive(Debug, Clone, PartialEq)]
pub enum A11yIssue {
    /// The snapshot carries facts but names no role, so there is nothing to
    /// report them as.
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
/// issue is the one that prevented it. A snapshot with no role and nothing
/// else in it, as a presentational part sends, is not an issue: there is
/// nothing to report.
pub fn project(snapshot: &A11ySnapshotWire) -> (Option<A11yProjection>, Vec<A11yIssue>) {
    let role = match snapshot.role.as_deref() {
        None if is_empty(snapshot) => return (None, Vec::new()),
        None => return (None, vec![A11yIssue::NoRole]),
        Some(name) => match role(name) {
            Some(role) => role,
            None => return (None, vec![A11yIssue::Role(name.to_string())]),
        },
    };

    let mut issues = Vec::new();
    let (label, name_from_content) = match &snapshot.name {
        Some(A11yNameWire::Text { value }) => (Some(SharedString::from(value.clone())), false),
        Some(A11yNameWire::Content) => (None, true),
        None => (None, false),
    };

    let mut disabled = false;
    let mut toggled = None;
    let mut selected = None;
    let mut orientation = None;
    for (name, value) in &snapshot.states {
        match (name.as_str(), value) {
            // A hidden object is not reported, whatever else it says.
            ("hidden", Value::Bool(true)) => return (None, Vec::new()),
            ("hidden", Value::Bool(false)) => {}
            ("disabled", Value::Bool(value)) => disabled = *value,
            ("selected", Value::Bool(value)) => selected = Some(*value),
            ("orientation", Value::String(value)) if value == "horizontal" => {
                orientation = Some(Orientation::Horizontal)
            }
            ("orientation", Value::String(value)) if value == "vertical" => {
                orientation = Some(Orientation::Vertical)
            }
            // `pressed` makes a button a toggle button, on or off; `checked`
            // says whether a switch is on.
            ("pressed" | "checked", Value::Bool(value)) => {
                toggled = Some(if *value {
                    Toggled::True
                } else {
                    Toggled::False
                })
            }
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

    let mut labelled_by = None;
    for (name, target) in &snapshot.relations {
        match (name.as_str(), target) {
            // A `null` relation is the absence of one, which needs no projection.
            (_, Value::Null) => {}
            ("labelledBy", Value::String(id)) => labelled_by = Some(A11yReference::Id(id.clone())),
            ("labelledBy", Value::Array(objects)) if objects.iter().all(Value::is_string) => {
                labelled_by = Some(A11yReference::Objects(
                    objects
                        .iter()
                        .filter_map(|object| object.as_str().map(str::to_string))
                        .collect(),
                ))
            }
            _ => issues.push(A11yIssue::Relation(name.clone())),
        }
    }
    issues.extend(snapshot.level.map(A11yIssue::Level));

    let projection = A11yProjection {
        role,
        label,
        name_from_content,
        disabled,
        toggled,
        selected,
        orientation,
        labelled_by,
        activatable,
    };
    (Some(projection), issues)
}

fn is_empty(snapshot: &A11ySnapshotWire) -> bool {
    snapshot.name.is_none()
        && snapshot.states.is_empty()
        && snapshot.actions.is_empty()
        && snapshot.relations.values().all(Value::is_null)
        && snapshot.level.is_none()
}

/// The AccessKit role for a Proto UI role.
fn role(name: &str) -> Option<Role> {
    match name {
        "button" => Some(Role::Button),
        "switch" => Some(Role::Switch),
        "tablist" => Some(Role::TabList),
        "tab" => Some(Role::Tab),
        "tabpanel" => Some(Role::TabPanel),
        _ => None,
    }
}

/// Whether AccessKit names an object with this role from the labels beneath
/// it when it has no label of its own.
///
/// ARIA names more roles from their content than AccessKit does: a switch's
/// name comes from its content, but AccessKit leaves a switch unnamed. For
/// those roles the host computes the name from the text itself. The list is
/// `accesskit_consumer`'s `labelled_by`.
pub fn names_from_descendants(role: Role) -> bool {
    matches!(
        role,
        Role::Button
            | Role::CheckBox
            | Role::DefaultButton
            | Role::Link
            | Role::MenuItem
            | Role::MenuItemCheckBox
            | Role::MenuItemRadio
            | Role::RadioButton
    )
}
