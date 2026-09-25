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

use std::collections::HashMap;

use gpui::{Context, FocusHandle, StyleRefinement, Window};
use proto_ui_host_protocol::messages::{
    FocusResult, HostToPeerMessage, InputSampleMessage, OpenStatus, PeerToHostMessage,
    ProjectionAckMessage, SessionOpen, WireRecord,
};
use proto_ui_host_protocol::model::{
    ActivationStatus, DeliveryResult, HostSessionModel, InstallOptions,
};
use proto_ui_host_protocol::wire::{
    A11ySnapshotWire, HostDiagnostic, InputSample, InstanceId, ProjectionAck, ProjectionAckStatus,
    ProjectionTransaction, SessionId,
};
use proto_ui_style::Theme;
use serde_json::json;

use crate::host::{ProtoHostView, SurfaceChild, SurfaceNode};
use crate::input::{SessionRoute, SurfaceId};
use crate::style::StyleIssue;
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
    /// The Expose states as the peer last reported them.
    states: WireRecord,
}

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
}

/// Session state the hub keeps inside the host view.
#[derive(Default)]
pub struct HostHub {
    /// In the order they were opened, which is the order they render in.
    sessions: Vec<(SessionId, HubSession)>,
    outbox: Vec<HostToPeerMessage>,
    notes: Vec<HubNote>,
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
                states: WireRecord::new(),
            },
        ));
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
                session.a11y = snapshot.snapshot;
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
                if let Some(index) = self
                    .hub
                    .sessions
                    .iter()
                    .position(|(id, _)| *id == disposed.session_id)
                {
                    let (_, mut session) = self.hub.sessions.remove(index);
                    session.model.dispose();
                    self.bridge
                        .borrow_mut()
                        .remove_session(&disposed.session_id);
                    self.publish_surfaces(window, cx);
                }
            }
            PeerToHostMessage::Diagnostic(message) => {
                self.hub.notes.push(HubNote::PeerDiagnostic {
                    session_id: message.session_id,
                    diagnostic: message.diagnostic,
                });
            }
            // Handshake, lifecycle, signals and call results are the peer's
            // own record; nothing on the host depends on them yet.
            PeerToHostMessage::PeerHello(_)
            | PeerToHostMessage::Lifecycle(_)
            | PeerToHostMessage::ExposeSignal(_)
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
        let (root, issues) = build(
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
        // The installed view's own snapshot, which may be `null`: a new view
        // does not inherit the old one's.
        session.a11y = transaction.a11y;
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

    /// Renders every session's surfaces, in the order they were opened.
    fn publish_surfaces(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.surfaces = self
            .hub
            .sessions
            .iter()
            .filter_map(|(_, session)| session.surface.clone())
            .collect();
        self.subscribe_focus(window, cx);
        cx.notify();
    }

    fn note_unknown(&mut self, session_id: &str, kind: &str) {
        self.hub.notes.push(HubNote::UnknownSession {
            session_id: session_id.to_string(),
            kind: kind.to_string(),
        });
    }
}
