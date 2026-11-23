// Content-selection affordances are host input policy, not CSS paint fields.
export const gpuiNativeSelectionSource = String.raw`
// GPUI's ordinary Text/String elements have no content-selection range owner.
// None uses their actual nonselectable native behavior; Auto preserves that
// default. Consuming these properties does not intercept pointer/key defaults
// or touch TextControl's separate editable selection, IME and clipboard owner.
// Explicit text restoration needs a selectable-content host and is diagnosed.
fn take_native_content_selection(style:&mut crate::gpui_native_style::ResolvedStyle){
    let standard=style.declarations.remove("user-select");let prefixed=style.declarations.remove("-webkit-user-select");
    if let(Some(standard),Some(prefixed))=(&standard,&prefixed){assert_eq!(standard,prefixed,"conflicting native content-selection declarations");}
    if let Some(policy)=standard.or(prefixed){assert!(matches!(policy.as_str(),"none"|"auto"),"GPUI content-selection host prerequisite: explicit {policy} requires a native selectable-content host; TextControl selection remains independent");}
}
#[cfg(all(test,feature="test-support"))]
mod native_content_selection_tests {
    use super::*;
    fn declarations(standard:&str,prefixed:&str)->crate::gpui_native_style::ResolvedStyle {
        crate::gpui_native_style::ResolvedStyle{declarations:BTreeMap::from([
            ("user-select".into(),standard.into()),("-webkit-user-select".into(),prefixed.into()),("width".into(),"20px".into()),("position".into(),"relative".into())]),unknown:vec![]}
    }
    #[test]
    fn none_and_auto_use_native_text_defaults_without_becoming_unknown_paint(){
        for policy in ["none","auto"]{
            let mut style=declarations(policy,policy);take_native_content_selection(&mut style);
            let mapped=crate::gpui_native_style_mapping::map(&style,crate::gpui_native_style::LengthContext::default());
            assert!(mapped.is_complete(),"{policy}: {:?}",mapped.unmapped);
            assert!(mapped.refinement.size.width.is_some(),"ordinary paint still reaches the host");
            assert_eq!(style.declarations.len(),2);
        }
    }
    #[test]
    fn unsupported_selection_restoration_and_conflicting_aliases_are_explicit(){
        for(standard,prefixed)in [("text","text"),("all","all"),("none","auto")]{
            assert!(std::panic::catch_unwind(||take_native_content_selection(&mut declarations(standard,prefixed))).is_err());
        }
    }
}
`;
