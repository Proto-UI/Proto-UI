//! Drives sessions from the peer's messages.
//!
//! The hub is where the pieces meet. A `projection.install` is validated and
//! installed in the session's `HostSessionModel`, its template becomes
//! surfaces, and the model's acknowledgement goes back. An activation makes
//! the session's leases routable. A `focus.request` moves GPUI focus and
//! reports what happened. And every sample the router produces is checked
//! against the model before it is sent, so the peer only hears about input on
//! leases the model says are live.
//!
//! The hub never writes to a transport. Replies and samples collect in an
//! outbox the caller drains after each turn, which keeps framing and process
//! management a separate, replaceable concern.

use std::collections::{HashMap, HashSet};

use gpui::{Context, EventEmitter, FocusHandle, Refineable, StyleRefinement, Window};
use proto_ui_host_protocol::messages::{
    ExposeCall, FocusResult, HostToPeerMessage, InputSampleMessage, OpenStatus, PeerToHostMessage,
    ProjectionAckMessage, PropsSet, SessionDispose, SessionOpen, WireRecord,
};
use proto_ui_host_protocol::model::{
    ActivationStatus, DeliveryResult, HostSessionModel, InstallOptions,
};
use proto_ui_host_protocol::wire::{
    A11ySnapshotWire, HostDiagnostic, InputSample, InstanceId, ProjectionAck, ProjectionAckStatus,
    ProjectionTransaction, SessionId,
};
use proto_ui_style::length::LengthContext;
use proto_ui_style::Theme;
use serde_json::{json, Value};

use crate::a11y::{project, A11yIssue, A11yProjection};
use crate::host::{ProtoHostView, SurfaceChild, SurfaceNode};
use crate::input::{SessionRoute, SurfaceId};
use crate::style::{style_for_tokens, StyleIssue};
use crate::template::{build, parse, BuildContext, BuildIssue};

/// What the host application decides about one instance it opens.
pub struct SessionConfig {
    pub instance_id: InstanceId,
    /// The Prototype the peer should run, such as `base-button`.
    pub prototype_key: String,
    pub props: WireRecord,
    /// Host-owned content for each slot the template declares.
    pub slots: HashMap<String, Vec<SurfaceChild>>,
    /// The layout of the instance's root, which the application decides.
    pub root_style: StyleRefinement,
    /// The design language's theme, or `None` for the Base family.
    pub theme: Option<&'static Theme>,
    /// The session whose instance this one belongs to, such as a Switch for
    /// its thumb. Open that one first: the peer links the instance to it as
    /// it sets up. Where the instance renders is up to the slots: place it
    /// with [`SurfaceChild::Session`].
    pub parent: Option<SessionId>,
}

struct HubSession {
    config: SessionConfig,
    model: HostSessionModel,
    root_id: SurfaceId,
    focus: FocusHandle,
    /// The surfaces of the last projection that installed, if any.
    surface: Option<SurfaceNode>,
    /// The accessibility snapshot the peer last sent for this session.
    a11y: Option<A11ySnapshotWire>,
    /// What of that snapshot the root reports to accessibility.
    projection: Option<A11yProjection>,
    /// The root's feedback style, as the Prototype last set it.
    feedback: StyleRefinement,
    /// The Expose states as the peer last reported them.
    states: WireRecord,
}

/// A signal an instance emitted outward, for the host application.
///
/// The view emits it as it arrives, to whoever subscribes at that moment;
/// with no subscriber it goes nowhere. A signal is an event, not a record:
/// the host neither keeps nor replays it.
#[derive(Debug, Clone, PartialEq)]
pub struct ExposedSignal {
    pub session_id: SessionId,
    pub name: String,
    pub payload: Value,
}

impl EventEmitter<ExposedSignal> for ProtoHostView {}

/// Something the hub noticed that is not a message to send.
#[derive(Debug, Clone, PartialEq)]
pub enum HubNote {
    /// The peer reported a diagnostic.
    PeerDiagnostic {
        session_id: Option<SessionId>,
        diagnostic: HostDiagnostic,
    },
    /// A template built with issues; the projection still installed.
    Build {
        session_id: SessionId,
        issue: BuildIssue,
    },
    /// A routed sample the model refused, with the model's reason.
    SampleRefused {
        session_id: SessionId,
        kind: String,
        reason: String,
    },
    /// A message about a session this hub never opened.
    UnknownSession { session_id: SessionId, kind: String },
    /// An activation the model did not accept.
    ActivationRefused {
        session_id: SessionId,
        status: String,
    },
    /// An accessibility snapshot for a view other than the installed one.
    SnapshotRefused {
        session_id: SessionId,
        view_epoch: u64,
        installed: Option<u64>,
    },
    /// A feedback style for a view other than the installed one.
    StyleRefused {
        session_id: SessionId,
        view_epoch: u64,
        installed: Option<u64>,
    },
    /// A fact in an accessibility snapshot the host does not project. What it
    /// can project, it still does.
    A11y {
        session_id: SessionId,
        issue: A11yIssue,
    },
}

/// Session state the hub keeps inside the host view.
#[derive(Default)]
pub struct HostHub {
    /// In the order they were opened, which is the order they render in.
    sessions: Vec<(SessionId, HubSession)>,
    outbox: Vec<HostToPeerMessage>,
    notes: Vec<HubNote>,
    next_call: u64,
}

impl HostHub {
    fn session_mut(&mut self, session_id: &str) -> Option<&mut HubSession> {
        self.sessions
            .iter_mut()
            .find(|(id, _)| id == session_id)
            .map(|(_, session)| session)
    }

    fn session(&self, session_id: &str) -> Option<&HubSession> {
        self.sessions
            .iter()
            .find(|(id, _)| id == session_id)
            .map(|(_, session)| session)
    }

    /// Every session opened inside `session_id`, directly or not, each one
    /// before the session it was opened inside.
    fn opened_inside(&self, session_id: &str) -> Vec<SessionId> {
        let mut found: Vec<SessionId> = Vec::new();
        let mut pending = vec![session_id.to_string()];
        while let Some(outer) = pending.pop() {
            for (id, session) in &self.sessions {
                if session.config.parent.as_deref() == Some(outer.as_str())
                    && id != session_id
                    && !found.contains(id)
                {
                    found.push(id.clone());
                    pending.push(id.clone());
                }
            }
        }
        // A session is found only after the one it was opened inside.
        found.reverse();
        found
    }
}

/// Replaces each session placed beneath `surface` with that session's
/// surfaces, which may place more. `open` holds the sessions being placed,
/// so a session placed inside itself is dropped rather than followed.
fn place_sessions(
    mut surface: SurfaceNode,
    roots: &HashMap<&str, SurfaceNode>,
    open: &mut Vec<SessionId>,
) -> SurfaceNode {
    surface.children = std::mem::take(&mut surface.children)
        .into_iter()
        .filter_map(|child| match child {
            SurfaceChild::Surface(inner) => {
                Some(SurfaceChild::from(place_sessions(*inner, roots, open)))
            }
            SurfaceChild::Session(session) => {
                if open.contains(&session) {
                    return None;
                }
                let root = roots.get(session.as_str())?.clone();
                open.push(session);
                let placed = place_sessions(root, roots, open);
                open.pop();
                Some(SurfaceChild::from(placed))
            }
            text @ SurfaceChild::Text(_) => Some(text),
        })
        .collect();
    surface
}

fn diagnostic(code: &str, message: impl Into<String>) -> HostDiagnostic {
    HostDiagnostic {
        code: code.to_string(),
        message: message.into(),
        data: None,
    }
}

/// A build issue as the diagnostic the peer receives with its refusal.
fn issue_diagnostic(issue: &BuildIssue) -> HostDiagnostic {
    let (code, surface, detail) = match issue {
        BuildIssue::SvgNotRendered { surface, tag } => {
            ("svg-not-rendered", surface, json!({ "tag": tag }))
        }
        BuildIssue::Style { surface, issue } => {
            let detail = match issue {
                StyleIssue::UnknownToken(token) => json!({ "unknownToken": token }),
                StyleIssue::UnresolvedVariable { property, variable } => {
                    json!({ "property": property, "unresolvedVariable": variable })
                }
                StyleIssue::SubstitutionTooDeep { property } => {
                    json!({ "property": property, "substitution": "too-deep" })
                }
                StyleIssue::Unmapped {
                    property,
                    value,
                    reason,
                } => {
                    json!({ "property": property, "value": value, "reason": format!("{reason:?}") })
                }
            };
            ("style-not-rendered", surface, detail)
        }
    };
    HostDiagnostic {
        code: code.to_string(),
        message: format!("the host cannot render `{surface}` faithfully"),
        data: Some(json!({ "surface": surface, "detail": detail })),
    }
}

fn failed_ack(transaction: &ProjectionTransaction, diagnostic: HostDiagnostic) -> ProjectionAck {
    ProjectionAck {
        session_id: transaction.session_id.clone(),
        view_epoch: transaction.view_epoch,
        commit_id: transaction.commit_id,
        status: ProjectionAckStatus::Failed,
        ready_surfaces: Vec::new(),
        diagnostics: vec![diagnostic],
    }
}

impl ProtoHostView {
    /// Opens a session: asks the peer to run a Prototype for one instance.
    pub fn open_session(
        &mut self,
        session_id: impl Into<SessionId>,
        config: SessionConfig,
        cx: &mut Context<Self>,
    ) {
        let session_id = session_id.into();
        self.hub
            .outbox
            .push(HostToPeerMessage::SessionOpen(SessionOpen {
                session_id: session_id.clone(),
                instance_id: config.instance_id.clone(),
                prototype_key: config.prototype_key.clone(),
                props: config.props.clone(),
                parent_session_id: config.parent.clone(),
            }));
        let root_id = format!("{session_id}/proto-surface");
        self.hub.sessions.push((
            session_id.clone(),
            HubSession {
                config,
                model: HostSessionModel::new(session_id),
                root_id,
                focus: cx.focus_handle(),
                surface: None,
                a11y: None,
                projection: None,
                feedback: StyleRefinement::default(),
                states: WireRecord::new(),
            },
        ));
    }

    /// Replaces a session's props. The peer re-renders, which arrives as a
    /// new commit in the current view.
    pub fn set_props(&mut self, session_id: &str, props: WireRecord) {
        self.hub.outbox.push(HostToPeerMessage::PropsSet(PropsSet {
            session_id: session_id.to_string(),
            props,
        }));
    }

    /// Calls a method the instance exposes, returning the call's identifier;
    /// the peer answers with an `expose.result` carrying it.
    pub fn call_exposed(&mut self, session_id: &str, name: &str, args: Vec<Value>) -> String {
        self.hub.next_call += 1;
        let call_id = format!("{session_id}:call:{}", self.hub.next_call);
        self.hub
            .outbox
            .push(HostToPeerMessage::ExposeCall(ExposeCall {
                session_id: session_id.to_string(),
                call_id: call_id.clone(),
                name: name.to_string(),
                args,
            }));
        call_id
    }

    /// Asks the peer to end a session, and before it every session opened
    /// inside it. Their surfaces stay until the peer reports each one
    /// `session.disposed`, which is when the host tears it down.
    pub fn dispose_session(&mut self, session_id: &str) {
        self.hub
            .outbox
            .push(HostToPeerMessage::SessionDispose(SessionDispose {
                session_id: session_id.to_string(),
            }));
    }

    /// Handles one message from the peer.
    pub fn receive(
        &mut self,
        message: PeerToHostMessage,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        match message {
            PeerToHostMessage::ProjectionInstall(install) => {
                let ack = self.install(install.transaction, window, cx);
                self.hub
                    .outbox
                    .push(HostToPeerMessage::ProjectionAck(ProjectionAckMessage {
                        ack,
                    }));
            }
            PeerToHostMessage::ProjectionActivate(activate) => {
                let Some(session) = self.hub.session_mut(&activate.session_id) else {
                    self.note_unknown(&activate.session_id, "projection.activate");
                    return;
                };
                match session
                    .model
                    .activate(activate.view_epoch, activate.commit_id)
                {
                    ActivationStatus::Activated | ActivationStatus::AlreadyActive => {
                        self.refresh_route(&activate.session_id);
                    }
                    status => self.hub.notes.push(HubNote::ActivationRefused {
                        session_id: activate.session_id,
                        status: format!("{status:?}"),
                    }),
                }
            }
            PeerToHostMessage::LeaseRelease(release) => {
                let Some(session) = self.hub.session_mut(&release.session_id) else {
                    self.note_unknown(&release.session_id, "lease.release");
                    return;
                };
                session.model.release_leases(&release.lease_ids);
                self.refresh_route(&release.session_id);
            }
            PeerToHostMessage::DefaultActionPrevent(prevent) => {
                let session_id = prevent.request.session_id.clone();
                let Some(session) = self.hub.session_mut(&session_id) else {
                    self.note_unknown(&session_id, "default-action.prevent");
                    return;
                };
                // This host runs no default action for any input yet, so a
                // prevention can never arrive too late to be honoured. The
                // default-action slice makes this depend on the input.
                session
                    .model
                    .request_default_action_prevention(&prevent.request, true);
            }
            PeerToHostMessage::FocusRequest(request) => {
                if self.hub.session(&request.session_id).is_none() {
                    self.note_unknown(&request.session_id, "focus.request");
                    return;
                }
                let status = self.request_focus(
                    &request.session_id,
                    &request.target,
                    request.action,
                    window,
                    cx,
                );
                self.hub
                    .outbox
                    .push(HostToPeerMessage::FocusResult(FocusResult {
                        session_id: request.session_id,
                        request_id: request.request_id,
                        status,
                    }));
            }
            PeerToHostMessage::A11ySnapshot(snapshot) => {
                let Some(session) = self.hub.session_mut(&snapshot.session_id) else {
                    self.note_unknown(&snapshot.session_id, "a11y.snapshot");
                    return;
                };
                // A snapshot describes one view. The host shows the view it
                // installed last, so only a snapshot for that epoch applies; a
                // late one from a retired view must not overwrite, or with
                // `null` clear, the snapshot of the view on screen.
                let installed = session.model.snapshot().current_epoch;
                if installed != Some(snapshot.view_epoch) {
                    self.hub.notes.push(HubNote::SnapshotRefused {
                        session_id: snapshot.session_id,
                        view_epoch: snapshot.view_epoch,
                        installed,
                    });
                    return;
                }
                let (projection, issues) =
                    snapshot.snapshot.as_ref().map(project).unwrap_or_default();
                session.a11y = snapshot.snapshot;
                session.projection = projection;
                self.note_a11y(&snapshot.session_id, issues);
                self.publish_surfaces(window, cx);
            }
            PeerToHostMessage::StyleApply(style) => {
                let Some(session) = self.hub.session_mut(&style.session_id) else {
                    self.note_unknown(&style.session_id, "style.apply");
                    return;
                };
                // Like a snapshot, a style belongs to one view.
                let installed = session.model.snapshot().current_epoch;
                if installed != Some(style.view_epoch) {
                    self.hub.notes.push(HubNote::StyleRefused {
                        session_id: style.session_id,
                        view_epoch: style.view_epoch,
                        installed,
                    });
                    return;
                }
                let resolved = style_for_tokens(
                    style.tokens.iter().map(String::as_str),
                    session.config.theme,
                    LengthContext::default(),
                );
                if resolved.issues.is_empty() {
                    session.feedback = resolved.refinement;
                    self.publish_surfaces(window, cx);
                    return;
                }
                // There is no acknowledgement to refuse it with, so the view
                // keeps the last style it could show whole, and the host
                // notes why.
                let surface = session.root_id.clone();
                self.hub
                    .notes
                    .extend(resolved.issues.into_iter().map(|issue| HubNote::Build {
                        session_id: style.session_id.clone(),
                        issue: BuildIssue::Style {
                            surface: surface.clone(),
                            issue,
                        },
                    }));
            }
            PeerToHostMessage::ExposeDescriptor(descriptor) => {
                if let Some(session) = self.hub.session_mut(&descriptor.session_id) {
                    session.states = descriptor.states;
                }
            }
            PeerToHostMessage::ExposeState(state) => {
                if let Some(session) = self.hub.session_mut(&state.session_id) {
                    session.states.insert(state.name, state.value);
                }
            }
            PeerToHostMessage::SessionOpened(opened) => {
                if opened.status == OpenStatus::Failed {
                    for diagnostic in opened.diagnostics {
                        self.hub.notes.push(HubNote::PeerDiagnostic {
                            session_id: Some(opened.session_id.clone()),
                            diagnostic,
                        });
                    }
                }
            }
            PeerToHostMessage::SessionDisposed(disposed) => {
                if self.hub.session(&disposed.session_id).is_none() {
                    return;
                }
                // No instance outlives the one it belongs to. The peer reports
                // the sessions opened inside this one ended first; any it has
                // not, the host ends here and asks the peer to end as well.
                let inside = self.hub.opened_inside(&disposed.session_id);
                for session_id in &inside {
                    self.hub
                        .outbox
                        .push(HostToPeerMessage::SessionDispose(SessionDispose {
                            session_id: session_id.clone(),
                        }));
                }
                for session_id in inside.iter().chain([&disposed.session_id]) {
                    self.end_session(session_id);
                }
                self.publish_surfaces(window, cx);
            }
            PeerToHostMessage::Diagnostic(message) => {
                self.hub.notes.push(HubNote::PeerDiagnostic {
                    session_id: message.session_id,
                    diagnostic: message.diagnostic,
                });
            }
            PeerToHostMessage::ExposeSignal(signal) => {
                if self.hub.session(&signal.session_id).is_none() {
                    self.note_unknown(&signal.session_id, "expose.signal");
                    return;
                }
                cx.emit(ExposedSignal {
                    session_id: signal.session_id,
                    name: signal.name,
                    payload: signal.payload,
                });
            }
            // Handshake, lifecycle and call results are the peer's own record;
            // nothing on the host depends on them yet.
            PeerToHostMessage::PeerHello(_)
            | PeerToHostMessage::Lifecycle(_)
            | PeerToHostMessage::ExposeResult(_) => {}
        }
    }

    /// Takes everything to send to the peer: replies in the order they were
    /// made, then the input routed since the last call, as samples the model
    /// has accepted.
    pub fn take_outbox(&mut self) -> Vec<HostToPeerMessage> {
        let routed = self.bridge.borrow_mut().drain();
        for routed in routed {
            let Some(session) = self.hub.session_mut(&routed.session_id) else {
                continue;
            };
            match session.model.deliver(&routed.sample) {
                DeliveryResult::Delivered { lease_ids } => {
                    self.hub
                        .outbox
                        .push(HostToPeerMessage::InputSample(InputSampleMessage {
                            session_id: routed.session_id,
                            // Exactly the leases the model delivered to.
                            sample: InputSample {
                                lease_ids,
                                ..routed.sample
                            },
                        }));
                }
                DeliveryResult::Rejected { reason } => {
                    self.hub.notes.push(HubNote::SampleRefused {
                        session_id: routed.session_id,
                        kind: routed.sample.kind,
                        reason: format!("{reason:?}"),
                    });
                }
            }
        }
        std::mem::take(&mut self.hub.outbox)
    }

    /// Takes what the hub noticed since the last call.
    pub fn take_notes(&mut self) -> Vec<HubNote> {
        std::mem::take(&mut self.hub.notes)
    }

    /// The Expose states the peer last reported for a session.
    pub fn exposed_states(&self, session_id: &str) -> Option<&WireRecord> {
        self.hub.session(session_id).map(|session| &session.states)
    }

    /// The accessibility snapshot the peer last sent for a session.
    pub fn a11y_snapshot(&self, session_id: &str) -> Option<&A11ySnapshotWire> {
        self.hub.session(session_id)?.a11y.as_ref()
    }

    /// What a session's root reports to accessibility.
    pub fn a11y_projection(&self, session_id: &str) -> Option<&A11yProjection> {
        self.hub.session(session_id)?.projection.as_ref()
    }

    /// The sessions whose surfaces the view renders, in document order.
    pub fn rendered_sessions(&self) -> Vec<SessionId> {
        let mut sessions: Vec<SessionId> = Vec::new();
        let mut pending: Vec<&SurfaceNode> = self.surfaces.iter().rev().collect();
        while let Some(surface) = pending.pop() {
            if !sessions.contains(&surface.session) {
                sessions.push(surface.session.clone());
            }
            let children: Vec<&SurfaceNode> = surface.child_surfaces().collect();
            pending.extend(children.into_iter().rev());
        }
        sessions
    }

    /// Forgets a session: its model, its surfaces and its route.
    fn end_session(&mut self, session_id: &str) {
        let Some(index) = self
            .hub
            .sessions
            .iter()
            .position(|(id, _)| id == session_id)
        else {
            return;
        };
        let (_, mut session) = self.hub.sessions.remove(index);
        session.model.dispose();
        self.bridge.borrow_mut().remove_session(session_id);
    }

    /// Validates, installs and renders one projection.
    ///
    /// The template is parsed before the model allocates anything: a
    /// projection that cannot be rendered is refused whole, rather than
    /// installed with leases for surfaces that will never exist.
    fn install(
        &mut self,
        transaction: ProjectionTransaction,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> ProjectionAck {
        let session_id = transaction.session_id.clone();
        if self.hub.session(&session_id).is_none() {
            self.note_unknown(&session_id, "projection.install");
            return failed_ack(
                &transaction,
                diagnostic("unknown-session", "the host never opened this session"),
            );
        }
        let template = match parse(&transaction.template) {
            Ok(template) => template,
            Err(error) => {
                let mut refused = diagnostic("template-invalid", error.to_string());
                refused.data = Some(json!({ "path": error.path }));
                return failed_ack(&transaction, refused);
            }
        };

        let session = self.hub.session_mut(&session_id).expect("checked above");
        let (root, mut issues) = build(
            &template,
            BuildContext {
                session_id: &session_id,
                root_id: &session.root_id,
                root_style: session.config.root_style.clone(),
                focus: Some(session.focus.clone()),
                theme: session.config.theme,
                slots: &session.config.slots,
            },
        );
        // The root's feedback style is part of the view, so a token the host
        // cannot render refuses the projection as a template token does.
        let feedback = style_for_tokens(
            transaction.style.iter().map(String::as_str),
            session.config.theme,
            LengthContext::default(),
        );
        issues.extend(feedback.issues.into_iter().map(|issue| BuildIssue::Style {
            surface: session.root_id.clone(),
            issue,
        }));
        // A projection the host cannot render faithfully is refused whole,
        // before the model allocates anything and before anything is shown.
        // No governed rule lets a host drop an SVG or a style declaration and
        // still call the projection applied, so every build issue counts.
        if !issues.is_empty() {
            let diagnostics = issues.iter().map(issue_diagnostic).collect();
            self.hub
                .notes
                .extend(issues.into_iter().map(|issue| HubNote::Build {
                    session_id: session_id.clone(),
                    issue,
                }));
            return ProjectionAck {
                session_id: transaction.session_id.clone(),
                view_epoch: transaction.view_epoch,
                commit_id: transaction.commit_id,
                status: ProjectionAckStatus::Unsupported,
                ready_surfaces: Vec::new(),
                diagnostics,
            };
        }

        let ack = session
            .model
            .install_projection(&transaction, &InstallOptions::default());
        if ack.status != ProjectionAckStatus::Applied {
            return ack;
        }
        session.surface = Some(root);
        session.feedback = feedback.refinement;
        // The installed view's own snapshot, which may be `null`: a new view
        // does not inherit the old one's.
        let (projection, issues) = transaction.a11y.as_ref().map(project).unwrap_or_default();
        session.a11y = transaction.a11y;
        session.projection = projection;
        self.note_a11y(&session_id, issues);
        // A trigger owns input inside it on behalf of its group's anchor.
        self.bridge.borrow_mut().set_trigger_anchor(
            &session_id,
            transaction
                .events
                .trigger
                .as_ref()
                .map(|trigger| trigger.anchor.clone()),
        );
        self.publish_surfaces(window, cx);
        ack
    }

    /// Makes the router follow the model's current leases for a session.
    fn refresh_route(&mut self, session_id: &str) {
        let Some(session) = self.hub.session(session_id) else {
            return;
        };
        match SessionRoute::from_snapshot(&session.model.snapshot(), session.root_id.clone()) {
            Some(route) => self.bridge.borrow_mut().upsert_session(route),
            None => self.bridge.borrow_mut().remove_session(session_id),
        }
    }

    /// Renders every session's surfaces, each root carrying the instance's
    /// current accessibility projection.
    ///
    /// A session placed in another's slot renders there, inside the instance
    /// it belongs to; the rest render at the top level, in the order they
    /// were opened.
    fn publish_surfaces(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let roots: HashMap<&str, SurfaceNode> = self
            .hub
            .sessions
            .iter()
            .filter_map(|(id, session)| {
                let mut root = session.surface.clone()?;
                root.a11y = session.projection.clone();
                // The Prototype's feedback style first, then the application's
                // own root style over it: the consumer wins, as it does over
                // the Web's `@layer proto-ui` (C-PROTOTYPE-STYLE-CLOSURE-0001).
                let mut style = session.feedback.clone();
                style.refine(&session.config.root_style);
                root.style = style;
                Some((id.as_str(), root))
            })
            .collect();
        let placed: HashSet<SessionId> = roots
            .values()
            .flat_map(SurfaceNode::placed_sessions)
            .collect();
        self.surfaces = self
            .hub
            .sessions
            .iter()
            .filter(|(id, _)| !placed.contains(id))
            .filter_map(|(id, _)| {
                let root = roots.get(id.as_str())?.clone();
                Some(place_sessions(root, &roots, &mut vec![id.clone()]))
            })
            .collect();
        self.subscribe_focus(window, cx);
        cx.notify();
    }

    fn note_a11y(&mut self, session_id: &str, issues: Vec<A11yIssue>) {
        self.hub
            .notes
            .extend(issues.into_iter().map(|issue| HubNote::A11y {
                session_id: session_id.to_string(),
                issue,
            }));
    }

    fn note_unknown(&mut self, session_id: &str, kind: &str) {
        self.hub.notes.push(HubNote::UnknownSession {
            session_id: session_id.to_string(),
            kind: kind.to_string(),
        });
    }
}
