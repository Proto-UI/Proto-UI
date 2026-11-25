use crate::check::{Checked, Result};
use crate::ir::Type;
use crate::names::{self, Names};
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};

pub fn marker(i: usize) -> Ident { format_ident!("__PuiContextKey{i}") }
pub fn channel(i: usize) -> Ident { format_ident!("provider_{i}") }
pub fn child(i: usize) -> Ident { format_ident!("child_{i}") }
pub fn notification(i: usize) -> Ident { format_ident!("ProviderChanged{i}") }

pub fn scope(checked: &Checked<'_>) -> Result<Vec<syn::Item>> {
    let n = Names::new(checked)?;
    let mut declarations = Vec::new();
    let mut fields = Vec::new();
    let mut identities = Vec::new();
    let mut empty = Vec::new();
    let mut withdraw = Vec::new();
    for (i, key) in checked.unit.keys.iter().enumerate() {
        let tag = marker(i);
        let slot = channel(i);
        let ty = n.ty(key.binding.ty);
        let id = &key.binding.id;
        let doc = names::source_doc(&key.debug_name, &key.binding.source);
        let changed = match key.binding.ty {
            Type::Data(i) => { let f = crate::component::comparison(i); quote!(#f(previous, next)) }
            t => crate::component::differs(t, quote!(*previous), quote!(*next)),
        };
        declarations.push(quote! {
            #[doc = #doc] #[derive(Clone, Copy)] pub struct #tag { _private: () }
            impl ::proto_ui_gpui_support::context::NominalKey for #tag {
                type Value = #ty;
                fn changed(previous: &#ty, next: &#ty) -> ::core::primitive::bool { #changed }
            }
            impl #tag {
                pub(super) const KEY: Self = Self { _private: () };
                pub const fn binding_id(self) -> &'static ::core::primitive::str { #id }
                pub fn provider(self, value: #ty) -> ::proto_ui_gpui_support::context::Provider<Self> {
                    ::proto_ui_gpui_support::context::Provider::new(value)
                }
            }
            impl ScopeKey for #tag {
                fn bind(self, scope: &mut ContextScope, value: ::gpui::Entity<::proto_ui_gpui_support::context::Provider<Self>>) { scope.#slot = ::core::option::Option::Some(value); }
            }
        });
        fields.push(quote!(#slot: ::core::option::Option<::gpui::Entity<::proto_ui_gpui_support::context::Provider<#tag>>>));
        empty.push(quote!(#slot: ::core::option::Option::None));
        identities.push(quote!(self.#slot == other.#slot));
        withdraw.push(quote!(self.#slot.take();));
    }
    let construction = if checked.links.styled {
        fields.push(quote!(resolve_token: ::core::option::Option<::std::rc::Rc<dyn ::core::ops::Fn(&::core::primitive::str, &mut ::gpui::StyleRefinement)>>));
        identities.push(quote!((match (&self.resolve_token, &other.resolve_token) {
            (::core::option::Option::Some(a), ::core::option::Option::Some(b)) => ::std::rc::Rc::ptr_eq(a, b),
            (::core::option::Option::None, ::core::option::Option::None) => true,
            _ => false,
        })));
        withdraw.push(quote!(self.resolve_token.take();));
        quote! { impl ContextScope { pub fn new(resolve: impl ::core::ops::Fn(&::core::primitive::str, &mut ::gpui::StyleRefinement) + 'static) -> Self { Self { #(#empty,)* resolve_token: ::core::option::Option::Some(::std::rc::Rc::new(resolve)) } } } }
    } else { quote! { impl ::core::default::Default for ContextScope { fn default() -> Self { Self { #(#empty),* } } } } };
    let same = if identities.is_empty() { quote!(true) } else { quote!(#(#identities)&&*) };
    let keyed = (!checked.unit.keys.is_empty()).then(|| quote! {
        pub trait ScopeKey: ::proto_ui_gpui_support::context::NominalKey {
            fn bind(self, scope: &mut ContextScope, value: ::gpui::Entity<::proto_ui_gpui_support::context::Provider<Self>>);
        }
        impl ContextScope { pub fn with<K: ScopeKey>(&self, key: K, entity: ::gpui::Entity<::proto_ui_gpui_support::context::Provider<K>>) -> Self {
            let mut scope = self.clone(); key.bind(&mut scope, entity); scope
        } }
    });
    let collision = checked.links.children.iter().any(|sites| sites.len() > 1).then(|| quote!(
        #[derive(Clone, Debug, PartialEq, Eq)] pub struct ChildKeyConflict {
            pub key: ::gpui::SharedString, pub file: &'static ::core::primitive::str, pub start: ::core::primitive::u64, pub end: ::core::primitive::u64,
        }
    ));
    let style_binding = checked.links.styled.then(|| {
        let mut id = String::from("gpui:host/style-resolver");
        while checked.links.keys.contains_key(id.as_str()) { id.push('#'); }
        quote! { impl MissingContext { pub const GPUI_STYLE_RESOLVER: &'static ::core::primitive::str = #id; } }
    });
    let file = syn::parse2::<syn::File>(quote! {
        #[derive(Clone, Copy, Debug, PartialEq, Eq)] pub struct MissingContext {
            pub key: &'static ::core::primitive::str, pub file: &'static ::core::primitive::str, pub start: ::core::primitive::u64, pub end: ::core::primitive::u64,
        }
        #[derive(Clone)] pub struct ContextScope { #(#fields),* }
        #style_binding
        #construction #keyed #collision
        impl ContextScope {
            fn same(&self, other: &Self) -> ::core::primitive::bool { #same }
            fn withdraw(&mut self) { #(#withdraw)* }
        }
        #(#declarations)*
    }).map_err(|e| format!("{}: GPUI Context AST: {e}", checked.ir.source))?;
    Ok(file.items)
}

/// An authored exported constant can legally be named `props`, `cx` or `Some`.
/// Publish it outside the module containing Rust patterns and local bindings.
pub fn publish(checked: &Checked<'_>, items: Vec<syn::Item>) -> Result<syn::File> {
    let mut module_name = String::from("__pui_generated");
    while checked.unit.bodies.iter().any(|b| b.name == module_name) { module_name.push('_'); }
    let module = format_ident!("{module_name}");
    let mut keys = Vec::new();
    for (i, key) in checked.unit.keys.iter().enumerate() {
        let Some(name) = &key.export_name else { continue; };
        let tag = marker(i);
        let export = names::public(name, &key.binding.id, &key.binding.source)?;
        let doc = names::source_doc(&key.debug_name, &key.binding.source);
        keys.push(quote!(#[doc = #doc] #[allow(non_upper_case_globals)] pub const #export: #module::#tag = #module::#tag::KEY;));
    }
    syn::parse2(quote!(mod #module { #(#items)* } pub use self::#module::*; #(#keys)*))
        .map_err(|e| format!("{}: GPUI scoped module AST: {e}", checked.ir.source))
}

pub fn preflight(checked: &Checked<'_>) -> TokenStream {
    let tests = checked.links.required[checked.index].iter().map(|(&i, source)| {
        let slot = channel(i);
        let id = &checked.unit.keys[i].binding.id;
        let crate::ir::Source { file, start, end } = source;
        quote! { if scope.#slot.is_none() { return ::core::result::Result::Err(MissingContext { key: #id, file: #file, start: #start, end: #end }); } }
    });
    let style = checked.links.required_style[checked.index].map(|at| {
        let crate::ir::Source { file, start, end } = at;
        quote! { if scope.resolve_token.is_none() { return ::core::result::Result::Err(MissingContext {
            key: MissingContext::GPUI_STYLE_RESOLVER, file: #file, start: #start, end: #end,
        }); } }
    });
    quote!(#(#tests)* #style)
}

pub fn subscription(slot: &Ident, source: &Ident, dispatch: TokenStream) -> TokenStream {
    quote! {
        ::proto_ui_gpui_support::context::BoundContext::bind(
            scope.#source.as_ref().expect("validated required Context"), cx,
            |owner: &mut Self, provider, cx| {
                if owner.#slot.provider() == ::core::option::Option::Some(&provider) { #dispatch }
            },
        )
    }
}
