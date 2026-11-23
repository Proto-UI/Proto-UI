//! Freshly generated authored capture facades in an ordinary GPUI host.
//! These are real framework consumers; no OS accessibility claim is made here.
use gpui::{prelude::*, px, size, Context, Entity, Render, TestAppContext, Window, WindowHandle};
use proto_ui_gpui_native::gpui_native_owner::{text_content, Owner, Value};
use serde_json::json;

struct FacadeHost {
    first: Entity<capture_facade::CompiledComponent>,
    second: Entity<capture_facade::CompiledComponent>,
}
impl Render for FacadeHost {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div()
            .size_full()
            .child(self.first.clone())
            .child(self.second.clone())
    }
}
fn frames<T: Render + 'static>(window: WindowHandle<T>, cx: &mut TestAppContext) {
    for _ in 0..3 {
        cx.update_window(window.into(), |_, window, cx| {
            window.refresh();
            window.draw(cx).clear(cx);
        })
        .unwrap();
        cx.run_until_parked();
    }
}
#[gpui::test]
fn projected_capture_retains_public_identity_rendering_events_and_owner_lifetime(
    cx: &mut TestAppContext,
) {
    let window = cx.open_window(size(px(240.), px(120.)), |window, cx| FacadeHost {
        first: capture_facade::CompiledComponent::create(json!({}), None, window, cx).unwrap(),
        second: capture_facade::CompiledComponent::create(json!({}), None, window, cx).unwrap(),
    });
    frames(window, cx);
    window
        .update(cx, |host, window, cx| {
            let first = host.first.read(cx).handle();
            let second = host.second.read(cx).handle();
            for handle in [&first, &second] {
                {
                    let owner = handle.owner.borrow();
                    assert!(owner.mounted && owner.present);
                    assert_eq!(owner.committed_revision, owner.projection_revision);
                    assert_eq!(text_content(&owner.projection, &owner.slot), "seed");
                    for name in ["same", "sameChild", "sameRaw", "sameState", "sameMethod"] {
                        assert_eq!(
                            owner.exposes[name].data(),
                            json!(true),
                            "capture identity: {name}"
                        );
                    }
                }
                for method in ["readAlias", "readState", "read"] {
                    assert_eq!(
                        handle.call(method, vec![], window, cx).unwrap(),
                        json!("seed"),
                        "capture call: {method}"
                    );
                }
                assert_eq!(
                    handle.take_events(),
                    vec![("changed".into(), json!({"value":"seed"}))]
                );
                assert!(handle.take_failures().is_empty());
            }
            let retained: Value = first.owner.borrow().exposes["readAlias"].clone();
            assert_eq!(retained.call(vec![]).unwrap().data(), json!("seed"));
            Owner::dispose(&first.owner);
            assert!(
                retained.call(vec![]).is_err(),
                "retained alias cannot outlive its original owner"
            );
            assert!(first.call("readState", vec![], window, cx).is_err());
            assert_eq!(
                second.call("readAlias", vec![], window, cx).unwrap(),
                json!("seed")
            );
            second.dispose(window, cx).unwrap();
        })
        .unwrap();
}

struct ProjectionHost<T: Render + 'static> {
    target: Entity<T>,
}
impl<T: Render + 'static> Render for ProjectionHost<T> {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        gpui::div().size_full().child(self.target.clone())
    }
}
macro_rules! projected_renderer_case {
    ($test:ident, $module:ident, $expected:literal) => {
        #[gpui::test]
        fn $test(cx: &mut TestAppContext) {
            let window = cx.open_window(size(px(180.), px(72.)), |window, cx| ProjectionHost {
                target: $module::CompiledComponent::create(json!({}), None, window, cx).unwrap(),
            });
            frames(window, cx);
            window
                .update(cx, |host, window, cx| {
                    let handle = host.target.read(cx).handle();
                    {
                        let owner = handle.owner.borrow();
                        assert!(
                            owner.mounted && owner.present,
                            "projected renderer reaches a native commit"
                        );
                        assert_eq!(owner.committed_revision, owner.projection_revision);
                        assert_eq!(text_content(&owner.projection, &owner.slot), $expected);
                    }
                    assert!(
                        handle.take_failures().is_empty(),
                        "compilation cannot hide an unreachable scalar renderer branch"
                    );
                    handle.dispose(window, cx).unwrap();
                })
                .unwrap();
        }
    };
}
projected_renderer_case!(
    projected_null_renderer_mounts_without_a_fallback_panic,
    capture_null,
    ""
);
projected_renderer_case!(
    projected_string_renderer_paints_its_actual_source_value,
    capture_text,
    "projected text"
);
projected_renderer_case!(
    projected_number_renderer_paints_its_actual_source_value,
    capture_number,
    "42"
);
