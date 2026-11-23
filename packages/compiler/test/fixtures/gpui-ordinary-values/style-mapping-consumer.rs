//! Exercise the emitted shared SDK's actual native style mapper. This does not
//! claim a text-selection controller or native text/auto restoration support.
use proto_ui_gpui_native::gpui_native_style::{LengthContext, ResolvedStyle};
use proto_ui_gpui_native::gpui_native_style_mapping::{map, Unmapped};

fn selection(property: &str, value: &str) -> ResolvedStyle {
    ResolvedStyle {
        declarations: [
            ("position".to_string(), "relative".to_string()),
            (property.to_string(), value.to_string()),
        ].into_iter().collect(),
        unknown: Vec::new(),
    }
}

#[test]
fn plain_text_selection_none_is_bounded_and_other_intents_remain_unmapped() {
    for property in ["user-select", "-webkit-user-select"] {
        let supported = map(&selection(property, "none"), LengthContext::default());
        assert!(supported.is_complete(), "{property}: none was not honored: {:?}", supported.unmapped);
        for value in ["auto", "text", "all", "contain", "unknown", ""] {
            let unsupported = map(&selection(property, value), LengthContext::default());
            assert_eq!(unsupported.unmapped, vec![(property.into(), value.into(), Unmapped::UnknownProperty)],
                "unsupported selection must remain explicit: {property}: {value}");
            assert!(!unsupported.is_complete());
        }
    }
    let unknown = map(&selection("unknown-property", "none"), LengthContext::default());
    assert_eq!(unknown.unmapped, vec![("unknown-property".into(), "none".into(), Unmapped::UnknownProperty)],
        "a value of none cannot admit an unknown property");
}
