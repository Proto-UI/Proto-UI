//! The real peer, over real stdio, answered by the real host model.
//!
//! Ignored by default because it starts Node: it needs the repository's
//! `node_modules` (`pnpm install`), which the Rust CI jobs do not install.
//! Run it with `cargo test -p proto-ui-host-protocol --test t0_peer -- --ignored`.

use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

use proto_ui_host_protocol::messages::{
    HostToPeerMessage, InputSampleMessage, OpenStatus, PeerToHostMessage, ProjectionAckMessage,
    SessionDispose, SessionOpen,
};
use proto_ui_host_protocol::model::{DeliveryResult, HostSessionModel, InstallOptions};
use proto_ui_host_protocol::t0::PeerProcess;
use proto_ui_host_protocol::wire::{InputSample, ProjectionAckStatus};
use serde_json::json;

const WAIT: Duration = Duration::from_secs(30);
const SESSION: &str = "t0-button";

fn repository_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../..")
        .canonicalize()
        .expect("the repository root")
}

fn spawn_peer() -> PeerProcess {
    let root = repository_root();
    let mut command = Command::new(root.join("node_modules/.bin/tsx"));
    command
        .arg(root.join("packages/adapters/gpui-peer/src/stdio.ts"))
        .current_dir(&root);
    PeerProcess::spawn(command).expect("the peer starts; run `pnpm install` first")
}

#[test]
#[ignore = "starts the Node peer; needs `pnpm install`, run with --ignored"]
fn the_real_peer_runs_a_base_button_over_stdio() {
    let mut peer = spawn_peer();

    // The peer introduces itself first, and names what it can run.
    let hello = peer
        .until(WAIT, |message| {
            matches!(message, PeerToHostMessage::PeerHello(_))
        })
        .expect("a hello");
    match hello.last() {
        Some(PeerToHostMessage::PeerHello(hello)) => {
            assert!(hello.bundle.entries.contains(&"base-button".to_string()))
        }
        _ => unreachable!(),
    }

    peer.send(&HostToPeerMessage::SessionOpen(SessionOpen {
        session_id: SESSION.into(),
        instance_id: format!("{SESSION}:instance"),
        prototype_key: "base-button".into(),
        props: Default::default(),
        parent_session_id: None,
    }))
    .expect("session.open is sent");

    let opened = peer
        .until(WAIT, |message| {
            matches!(message, PeerToHostMessage::ProjectionInstall(_))
        })
        .expect("the peer projects");
    assert!(opened.iter().any(|message| matches!(
        message,
        PeerToHostMessage::SessionOpened(opened) if opened.status == OpenStatus::Ok
    )));
    let transaction = match opened.last() {
        Some(PeerToHostMessage::ProjectionInstall(install)) => install.transaction.clone(),
        _ => unreachable!(),
    };

    // The host's half: install in the real model and send its acknowledgement.
    let mut model = HostSessionModel::new(SESSION);
    let ack = model.install_projection(&transaction, &InstallOptions::default());
    assert_eq!(ack.status, ProjectionAckStatus::Applied);
    peer.send(&HostToPeerMessage::ProjectionAck(ProjectionAckMessage {
        ack,
    }))
    .expect("the ack is sent");

    let activated = peer
        .until(WAIT, |message| {
            matches!(message, PeerToHostMessage::ProjectionActivate(_))
        })
        .expect("the peer activates after the ack");
    let (view_epoch, commit_id) = match activated.last() {
        Some(PeerToHostMessage::ProjectionActivate(activate)) => {
            (activate.view_epoch, activate.commit_id)
        }
        _ => unreachable!(),
    };
    model.activate(view_epoch, commit_id);

    // Hover the Button on the lease the peer registered for it.
    let enter_lease = transaction
        .events
        .registrations
        .iter()
        .find(|registration| {
            registration.kind.as_deref() == Some("pointer.enter")
                && registration.scope.as_deref() == Some("root")
        })
        .and_then(|registration| registration.lease_id.clone())
        .expect("Base Button listens for pointer.enter");
    let sample = InputSample {
        sample_id: "t0-sample-1".into(),
        view_epoch,
        kind: "pointer.enter".into(),
        lease_ids: vec![enter_lease],
        key: None,
        ctrl_key: Some(false),
        meta_key: Some(false),
        alt_key: Some(false),
        shift_key: Some(false),
        repeat: None,
    };
    let DeliveryResult::Delivered { lease_ids } = model.deliver(&sample) else {
        panic!("the model refused the sample");
    };
    peer.send(&HostToPeerMessage::InputSample(InputSampleMessage {
        session_id: SESSION.into(),
        sample: InputSample {
            lease_ids,
            ..sample
        },
    }))
    .expect("the sample is sent");

    // The Prototype ran its pointer handling in the peer and reports the
    // result back as an Expose state change.
    peer.until(WAIT, |message| matches!(
        message,
        PeerToHostMessage::ExposeState(state) if state.name == "hovered" && state.value == json!(true)
    ))
    .expect("the peer reports hovered: true");

    peer.send(&HostToPeerMessage::SessionDispose(SessionDispose {
        session_id: SESSION.into(),
    }))
    .expect("session.dispose is sent");
    peer.until(WAIT, |message| {
        matches!(message, PeerToHostMessage::SessionDisposed(_))
    })
    .expect("the peer disposes");

    peer.shutdown(Duration::from_secs(5))
        .expect("the peer exits");
}
