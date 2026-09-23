//! Host half of the Proto UI GPUI host protocol, version 0.
//!
//! This crate is a port of `packages/host-protocol` and is kept honest by the
//! shared conformance vectors in `packages/host-protocol/vectors/`, which both
//! implementations replay. It has no GPUI dependency and performs no I/O.

pub mod model;
pub mod wire;

pub use model::{
    ActivationStatus, DefaultActionStatus, DeliveryRejection, DeliveryResult, DisposeResult,
    HostSessionModel, HostSessionSnapshot, InstallOptions, LeaseRecord, ReleaseResult,
    RetainedLogicalState, SessionPhase,
};
pub use wire::{
    A11yNameWire, A11ySnapshotWire, DefaultActionRequest, EventBindingPlan, EventRegistration,
    EventScope, FocusPlan, FocusTargetPlan, HostDiagnostic, InputSample, ProjectionAck,
    ProjectionAckStatus, ProjectionTransaction, RawEventRegistration, SlotPlan,
    HOST_PROTOCOL_VERSION,
};
