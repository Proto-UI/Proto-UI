//! Pins the input router to the Web router's behaviour, rule by rule.
//!
//! Every case names the behaviour of
//! `packages/adapters/base/src/events/web-event-router.ts` it reproduces. The
//! last case feeds routed samples to the real `HostSessionModel`, so the
//! router's output is checked against the model that will receive it rather
//! than against expectations written next to the router.
//!
//! The cases about the follow-up click run on a router told that the platform
//! clicks after a key, as a browser does, because that click is what the Web
//! router suppresses. GPUI sends no such click; the case that says so runs on
//! the default router.

use proto_ui_gpui::input::{
    HostInput, InputRouter, KeyboardClick, PointerPhase, RouteOwner, Routed, RoutedLease,
    SessionRoute, Target,
};
use proto_ui_gpui::key::{PortableKeyFields, PortableModifiers};
use proto_ui_host_protocol::event_type::EventType;
use proto_ui_host_protocol::model::{DeliveryResult, HostSessionModel, InstallOptions};
use proto_ui_host_protocol::wire::{EventScope, ProjectionAckStatus, ProjectionTransaction};
use serde_json::json;

fn lease(id: &str, scope: EventScope, event: &str) -> RoutedLease {
    RoutedLease {
        lease_id: id.into(),
        scope,
        event: EventType::parse(event).expect("a valid event type"),
    }
}

/// A router on a platform that clicks after a key, as a browser does.
fn web_router() -> InputRouter {
    InputRouter::with_keyboard_click(KeyboardClick::Synthesized)
}

fn session(id: &str, root: &str, leases: Vec<RoutedLease>) -> SessionRoute {
    SessionRoute {
        session_id: id.into(),
        root: root.into(),
        view_epoch: 1,
        leases,
    }
}

fn at(physical: &[&str], owner: RouteOwner) -> Target {
    Target {
        physical: physical.iter().map(|surface| surface.to_string()).collect(),
        owner,
    }
}

fn owned_by(session_id: &str) -> RouteOwner {
    RouteOwner::Session(session_id.into())
}

fn key(name: &str) -> PortableKeyFields {
    PortableKeyFields {
        key: name.into(),
        modifiers: PortableModifiers::default(),
        repeat: false,
    }
}

fn pointer(phase: PointerPhase, target: Target) -> HostInput {
    HostInput::Pointer {
        phase,
        target,
        modifiers: PortableModifiers::default(),
    }
}

fn click(target: Target, detail: u32) -> HostInput {
    HostInput::Click {
        target,
        detail,
        modifiers: PortableModifiers::default(),
    }
}

fn key_down(target: Target, name: &str) -> HostInput {
    HostInput::KeyDown {
        target,
        fields: key(name),
    }
}

/// `(session, type, leases)` for each sample, in delivery order.
fn summary(routed: &[Routed]) -> Vec<(String, String, Vec<String>)> {
    routed
        .iter()
        .map(|routed| {
            (
                routed.session_id.clone(),
                routed.sample.kind.clone(),
                routed.sample.lease_ids.clone(),
            )
        })
        .collect()
}

fn entry(session: &str, kind: &str, leases: &[&str]) -> (String, String, Vec<String>) {
    (
        session.into(),
        kind.into(),
        leases.iter().map(|lease| lease.to_string()).collect(),
    )
}

#[test]
fn only_key_events_reach_the_global_scope() {
    // `emit(protoGlobalBus, ...)` appears for keydown and keyup only. A global
    // lease for anything else is registered and never fires.
    let mut router = InputRouter::new();
    router.upsert_session(session(
        "a",
        "a",
        vec![
            lease("g-down", EventScope::Global, "pointer.down"),
            lease("g-commit", EventScope::Global, "press.commit"),
            lease("g-menu", EventScope::Global, "context.menu"),
            lease("g-key-down", EventScope::Global, "key.down"),
            lease("g-key-up", EventScope::Global, "key.up"),
        ],
    ));
    let inside = || at(&["a"], owned_by("a"));

    let mut delivered = Vec::new();
    for input in [
        pointer(PointerPhase::Down, inside()),
        click(inside(), 1),
        HostInput::ContextMenu {
            target: inside(),
            modifiers: PortableModifiers::default(),
        },
        key_down(inside(), "x"),
        HostInput::KeyUp {
            target: inside(),
            fields: key("x"),
        },
    ] {
        delivered.extend(summary(&router.route(&input)));
    }
    assert_eq!(
        delivered,
        vec![
            entry("a", "key.down", &["g-key-down"]),
            entry("a", "key.up", &["g-key-up"]),
        ]
    );
}

#[test]
fn a_root_key_event_reaches_only_the_owner_while_the_global_one_reaches_everyone() {
    let mut router = InputRouter::new();
    for (id, root) in [("outer", "a"), ("inner", "b")] {
        router.upsert_session(session(
            id,
            root,
            vec![
                lease(&format!("{id}-global"), EventScope::Global, "key.down"),
                lease(&format!("{id}-root"), EventScope::Root, "key.down"),
            ],
        ));
    }
    let routed = router.route(&key_down(at(&["b", "a"], owned_by("inner")), "x"));
    // Window listeners run in registration order; within one session the
    // global emission precedes the root one, and both ride one sample.
    assert_eq!(
        summary(&routed),
        vec![
            entry("outer", "key.down", &["outer-global"]),
            entry("inner", "key.down", &["inner-global", "inner-root"]),
        ]
    );
}

#[test]
fn enter_commits_before_its_key_down_and_the_synthetic_click_is_suppressed_once() {
    let mut router = web_router();
    router.upsert_session(session(
        "a",
        "a",
        vec![
            lease("commit", EventScope::Root, "press.commit"),
            lease("key", EventScope::Root, "key.down"),
        ],
    ));
    let inside = || at(&["a"], owned_by("a"));

    // The root listener sees the bubbling keydown before the window listener
    // does, so the commit comes first.
    let routed = router.route(&key_down(inside(), "Enter"));
    assert_eq!(
        summary(&routed),
        vec![
            entry("a", "press.commit", &["commit"]),
            entry("a", "key.down", &["key"]),
        ]
    );

    // A platform activating a focused control synthesizes a click with
    // `detail === 0`. Committing it would activate twice.
    assert!(router.route(&click(inside(), 0)).is_empty());

    // Suppression covers exactly one click.
    let routed = router.route(&click(inside(), 0));
    assert_eq!(
        summary(&routed),
        vec![entry("a", "press.commit", &["commit"])]
    );
}

#[test]
fn a_real_click_after_a_keyboard_commit_spends_the_suppression_and_commits() {
    let mut router = web_router();
    router.upsert_session(session(
        "a",
        "a",
        vec![lease("commit", EventScope::Root, "press.commit")],
    ));
    let inside = || at(&["a"], owned_by("a"));
    router.route(&key_down(inside(), " "));

    // `shouldSuppressFollowupClick`: a non-zero detail is a real click. It
    // commits and disarms, so a later zero-detail click commits too.
    assert_eq!(router.route(&click(inside(), 1)).len(), 1);
    assert_eq!(router.route(&click(inside(), 0)).len(), 1);
}

#[test]
fn any_other_key_disarms_suppression_in_every_session() {
    let mut router = web_router();
    router.upsert_session(session(
        "a",
        "a",
        vec![lease("a-commit", EventScope::Root, "press.commit")],
    ));
    router.upsert_session(session("b", "b", vec![]));

    router.route(&key_down(at(&["a"], owned_by("a")), "Enter"));
    // The window listener of every router sees every keydown, and a non-commit
    // key disarms each of them — even a Tab pressed inside another instance.
    router.route(&key_down(at(&["b"], owned_by("b")), "Tab"));

    let routed = router.route(&click(at(&["a"], owned_by("a")), 0));
    assert_eq!(
        summary(&routed),
        vec![entry("a", "press.commit", &["a-commit"])]
    );
}

#[test]
fn where_nothing_clicks_after_a_key_a_zero_detail_click_is_its_own_activation() {
    // GPUI sends no click for a key the host routes. A zero-detail click after
    // a keyboard commit is then a second activation, such as an assistive
    // technology's press, and suppressing it would lose that activation.
    let mut router = InputRouter::new();
    router.upsert_session(session(
        "a",
        "a",
        vec![lease("commit", EventScope::Root, "press.commit")],
    ));
    let inside = || at(&["a"], owned_by("a"));
    let commit = vec![entry("a", "press.commit", &["commit"])];

    assert_eq!(summary(&router.route(&key_down(inside(), "Enter"))), commit);
    assert_eq!(summary(&router.route(&click(inside(), 0))), commit);
}

#[test]
fn a_held_commit_key_commits_on_every_repeat() {
    // Each auto-repeat is a new native keydown, and "once" is per native
    // event, so a held Enter keeps committing — as a held Enter keeps
    // clicking a native button.
    let mut router = InputRouter::new();
    router.upsert_session(session(
        "a",
        "a",
        vec![lease("commit", EventScope::Root, "press.commit")],
    ));
    let mut repeats = Vec::new();
    for repeat in [false, true, true] {
        let routed = router.route(&HostInput::KeyDown {
            target: at(&["a"], owned_by("a")),
            fields: PortableKeyFields {
                repeat,
                ..key("Enter")
            },
        });
        assert_eq!(routed.len(), 1);
        repeats.push(routed[0].sample.repeat);
    }
    assert_eq!(repeats, vec![Some(false), Some(true), Some(true)]);
}

#[test]
fn enter_inside_a_nested_instance_commits_every_root_it_bubbles_through_once_each() {
    let mut router = InputRouter::new();
    for (id, root) in [("outer", "a"), ("inner", "b")] {
        router.upsert_session(session(
            id,
            root,
            vec![lease(
                &format!("{id}-commit"),
                EventScope::Root,
                "press.commit",
            )],
        ));
    }
    let routed = router.route(&key_down(at(&["b", "a"], owned_by("inner")), "Enter"));
    // Both root listeners fire, innermost first. The window listeners then try
    // again (the outer one because focus is within its root) and are
    // deduplicated per native event.
    assert_eq!(
        summary(&routed),
        vec![
            entry("inner", "press.commit", &["inner-commit"]),
            entry("outer", "press.commit", &["outer-commit"]),
        ]
    );
}

#[test]
fn a_click_commits_only_its_owner_while_pointer_input_reaches_every_root_it_crosses() {
    let mut router = InputRouter::new();
    for (id, root) in [("outer", "a"), ("inner", "b")] {
        router.upsert_session(session(
            id,
            root,
            vec![
                lease(&format!("{id}-commit"), EventScope::Root, "press.commit"),
                lease(&format!("{id}-down"), EventScope::Root, "pointer.down"),
            ],
        ));
    }
    let target = || at(&["b", "a"], owned_by("inner"));

    // `pointerdown` on a root is emitted with no ownership check.
    assert_eq!(
        summary(&router.route(&pointer(PointerPhase::Down, target()))),
        vec![
            entry("inner", "pointer.down", &["inner-down"]),
            entry("outer", "pointer.down", &["outer-down"]),
        ]
    );
    // `click` on a root requires `shouldRouteToCurrentRoot`: activating a
    // Button inside a Dialog does not also commit the Dialog.
    assert_eq!(
        summary(&router.route(&click(target(), 1))),
        vec![entry("inner", "press.commit", &["inner-commit"])]
    );
}

#[test]
fn a_rejected_trigger_route_commits_nobody_but_still_reports_pointer_input() {
    let mut router = InputRouter::new();
    router.upsert_session(session(
        "a",
        "a",
        vec![
            lease("commit", EventScope::Root, "press.commit"),
            lease("down", EventScope::Root, "pointer.down"),
        ],
    ));
    let rejected = || at(&["a"], RouteOwner::Rejected);
    assert!(router.route(&click(rejected(), 1)).is_empty());
    assert_eq!(
        summary(&router.route(&pointer(PointerPhase::Down, rejected()))),
        vec![entry("a", "pointer.down", &["down"])]
    );
}

#[test]
fn portaled_input_reaches_its_owner_through_the_window_fallback() {
    // The overlay surface is not inside the owner's root, as a portaled node
    // is not inside the element that rendered it.
    let mut router = InputRouter::new();
    router.upsert_session(session(
        "a",
        "a",
        vec![
            lease("down", EventScope::Root, "pointer.down"),
            lease("commit", EventScope::Root, "press.commit"),
            lease("menu", EventScope::Root, "context.menu"),
        ],
    ));
    let overlay = || at(&["overlay"], owned_by("a"));
    assert_eq!(
        summary(&router.route(&pointer(PointerPhase::Down, overlay()))),
        vec![entry("a", "pointer.down", &["down"])]
    );
    assert_eq!(
        summary(&router.route(&click(overlay(), 1))),
        vec![entry("a", "press.commit", &["commit"])]
    );
    assert_eq!(
        summary(&router.route(&HostInput::ContextMenu {
            target: overlay(),
            modifiers: PortableModifiers::default(),
        })),
        vec![entry("a", "context.menu", &["menu"])]
    );

    // Without ownership there is no fallback: an unowned target outside the
    // root reaches nobody.
    assert!(router
        .route(&pointer(
            PointerPhase::Down,
            at(&["overlay"], RouteOwner::Unowned)
        ))
        .is_empty());
}

#[test]
fn enter_and_leave_follow_the_roots_the_pointer_crosses() {
    let mut router = InputRouter::new();
    for (id, root) in [("outer", "a"), ("inner", "b")] {
        router.upsert_session(session(
            id,
            root,
            vec![
                lease(&format!("{id}-enter"), EventScope::Root, "pointer.enter"),
                lease(&format!("{id}-leave"), EventScope::Root, "pointer.leave"),
                lease(&format!("{id}-move"), EventScope::Root, "pointer.move"),
            ],
        ));
    }

    // Entering: boundary events first, outermost first, then the move
    // bubbling innermost first.
    let routed = router.route(&pointer(
        PointerPhase::Move,
        at(&["b", "a"], owned_by("inner")),
    ));
    assert_eq!(
        summary(&routed),
        vec![
            entry("outer", "pointer.enter", &["outer-enter"]),
            entry("inner", "pointer.enter", &["inner-enter"]),
            entry("inner", "pointer.move", &["inner-move"]),
            entry("outer", "pointer.move", &["outer-move"]),
        ]
    );

    // Moving out of the inner root only.
    let routed = router.route(&pointer(PointerPhase::Move, at(&["a"], owned_by("outer"))));
    assert_eq!(
        summary(&routed),
        vec![
            entry("inner", "pointer.leave", &["inner-leave"]),
            entry("outer", "pointer.move", &["outer-move"]),
        ]
    );

    // Leaving the window.
    let routed = router.route(&HostInput::PointerExit {
        modifiers: PortableModifiers::default(),
    });
    assert_eq!(
        summary(&routed),
        vec![entry("outer", "pointer.leave", &["outer-leave"])]
    );
}

#[test]
fn samples_carry_the_fields_a_web_payload_would() {
    let mut router = InputRouter::new();
    router.upsert_session(session(
        "a",
        "a",
        vec![
            lease("down", EventScope::Root, "pointer.down"),
            lease("commit", EventScope::Root, "press.commit"),
            lease("key", EventScope::Root, "key.down"),
        ],
    ));
    let inside = || at(&["a"], owned_by("a"));
    let shift = PortableModifiers {
        shift: true,
        ..Default::default()
    };

    // A pointer event has modifier flags and no `key` or `repeat`, which is
    // what copying the portable fields off a PointerEvent yields.
    let routed = router.route(&HostInput::Pointer {
        phase: PointerPhase::Down,
        target: inside(),
        modifiers: shift,
    });
    let sample = &routed[0].sample;
    assert_eq!(sample.key, None);
    assert_eq!(sample.repeat, None);
    assert_eq!(sample.shift_key, Some(true));
    assert_eq!(sample.ctrl_key, Some(false));

    // A click commit carries the click's modifiers, not a key.
    let routed = router.route(&HostInput::Click {
        target: inside(),
        detail: 1,
        modifiers: shift,
    });
    assert_eq!(routed[0].sample.kind, "press.commit");
    assert_eq!(routed[0].sample.key, None);

    // A keyboard commit carries the key that caused it.
    let routed = router.route(&key_down(inside(), "Enter"));
    let commit = routed
        .iter()
        .find(|routed| routed.sample.kind == "press.commit")
        .expect("Enter commits");
    assert_eq!(commit.sample.key.as_deref(), Some("Enter"));
    assert_eq!(commit.sample.repeat, Some(false));

    // Sample ids never repeat, and each carries its session's epoch.
    let ids: std::collections::HashSet<_> = [&routed[0], &routed[1]]
        .iter()
        .map(|routed| routed.sample.sample_id.clone())
        .collect();
    assert_eq!(ids.len(), 2);
    assert!(routed.iter().all(|routed| routed.sample.view_epoch == 1));
}

#[test]
fn nothing_is_sampled_without_a_lease_but_the_suppression_still_arms() {
    // The Web router arms suppression inside `emitPressCommitOnce`, whether or
    // not anyone listens for the commit.
    let mut router = web_router();
    router.upsert_session(session("a", "a", vec![]));
    let inside = || at(&["a"], owned_by("a"));
    assert!(router.route(&key_down(inside(), "Enter")).is_empty());

    // A reprojection that adds a commit lease keeps the armed suppression, so
    // the synthetic click still does not commit.
    router.upsert_session(session(
        "a",
        "a",
        vec![lease("commit", EventScope::Root, "press.commit")],
    ));
    assert!(router.route(&click(inside(), 0)).is_empty());
}

#[test]
fn a_reprojection_keeps_its_place_and_a_new_session_for_the_same_surface_replaces_the_old() {
    let key_lease = |id: &str| lease(id, EventScope::Global, "key.down");
    let order = |router: &mut InputRouter| -> Vec<String> {
        router
            .route(&key_down(Target::nowhere(), "x"))
            .into_iter()
            .map(|routed| routed.session_id)
            .collect()
    };

    let mut router = InputRouter::new();
    router.upsert_session(session("a", "a", vec![key_lease("a-key")]));
    router.upsert_session(session("b", "b", vec![key_lease("b-key")]));
    assert_eq!(order(&mut router), vec!["a", "b"]);

    // Same session, new leases: the same Web router, so its window listener
    // keeps its registration position.
    router.upsert_session(session("a", "a", vec![key_lease("a-key-2")]));
    assert_eq!(order(&mut router), vec!["a", "b"]);

    // A different session for surface `a`: a new router for the same root
    // element, which disables the old one and registers last.
    router.upsert_session(session("c", "a", vec![key_lease("c-key")]));
    assert_eq!(order(&mut router), vec!["b", "c"]);

    router.remove_session("b");
    assert_eq!(order(&mut router), vec!["c"]);
}

#[test]
fn press_start_end_and_cancel_are_never_produced() {
    // No Web producer exists for these, so producing them here would make the
    // GPUI host the only Adapter a Prototype could observe them on.
    let mut router = InputRouter::new();
    router.upsert_session(session(
        "a",
        "a",
        vec![
            lease("start", EventScope::Root, "press.start"),
            lease("end", EventScope::Root, "press.end"),
            lease("cancel", EventScope::Root, "press.cancel"),
        ],
    ));
    let inside = || at(&["a"], owned_by("a"));
    for input in [
        pointer(PointerPhase::Down, inside()),
        pointer(PointerPhase::Up, inside()),
        click(inside(), 1),
        key_down(inside(), "Enter"),
        pointer(PointerPhase::Cancel, inside()),
    ] {
        assert!(router.route(&input).is_empty());
    }
}

#[test]
fn routed_samples_are_accepted_by_the_host_session_model() {
    let mut model = HostSessionModel::new("s-1");
    let transaction: ProjectionTransaction = serde_json::from_value(json!({
        "protocolVersion": 0,
        "sessionId": "s-1",
        "instanceId": "button-1",
        "viewEpoch": 1,
        "commitId": 1,
        // Every field the TypeScript type requires, including the nullable
        // `a11y`: the wire refuses a transaction that omits one.
        "template": { "kind": "root", "children": [] },
        "slots": { "slots": [] },
        "focus": { "targets": [] },
        "a11y": null,
        "events": {
            "registrations": [
                { "leaseId": "l-commit", "scope": "root", "type": "press.commit" },
                { "leaseId": "l-global-key", "scope": "global", "type": "key.down" },
                { "leaseId": "l-root-key", "scope": "root", "type": "key.down" }
            ]
        }
    }))
    .expect("a valid transaction");
    let ack = model.install_projection(&transaction, &InstallOptions::default());
    assert_eq!(ack.status, ProjectionAckStatus::Applied);

    // Installed but not active: the model would reject every sample, so the
    // router is given nothing to route to.
    assert!(SessionRoute::from_snapshot(&model.snapshot(), "button").is_none());

    model.activate(1, 1);
    let route =
        SessionRoute::from_snapshot(&model.snapshot(), "button").expect("an active session routes");

    let mut router = InputRouter::new();
    router.upsert_session(route);
    let routed = router.route(&key_down(at(&["button"], owned_by("s-1")), "Enter"));
    assert_eq!(routed.len(), 2, "a commit and a key press");

    for routed in routed {
        match model.deliver(&routed.sample) {
            DeliveryResult::Delivered { lease_ids } => {
                assert_eq!(lease_ids, routed.sample.lease_ids);
            }
            other => panic!("the model rejected {:?}: {other:?}", routed.sample),
        }
    }
}

#[test]
fn a_host_event_reaches_only_the_root_lease_of_the_session_rendering_that_surface() {
    // A Web `host:*` root listener is bound on the root element itself, and
    // `focus` does not bubble. So an event at the inner root reaches the inner
    // session and not the outer one, a surface that is no session's root
    // reaches nobody, and a global lease never hears it.
    let focus = match EventType::parse("host:focus") {
        Ok(EventType::Extension(event)) => event,
        other => panic!("`host:focus` is a host event type, got {other:?}"),
    };
    let mut router = InputRouter::new();
    for (id, root) in [("outer", "a"), ("inner", "b")] {
        router.upsert_session(session(
            id,
            root,
            vec![
                lease(&format!("{id}-root"), EventScope::Root, "host:focus"),
                lease(&format!("{id}-global"), EventScope::Global, "host:focus"),
            ],
        ));
    }

    let routed = router.route(&HostInput::HostEvent {
        surface: "b".into(),
        event: focus.clone(),
    });
    assert_eq!(
        summary(&routed),
        vec![entry("inner", "host:focus", &["inner-root"])]
    );
    let sample = &routed[0].sample;
    assert_eq!(
        (sample.key.clone(), sample.ctrl_key, sample.repeat),
        (None, None, None)
    );

    assert!(router
        .route(&HostInput::HostEvent {
            surface: "part-of-b".into(),
            event: focus,
        })
        .is_empty());
}
