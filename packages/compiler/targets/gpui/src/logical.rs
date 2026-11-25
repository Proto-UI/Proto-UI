use super::{Component, Place, Result};
use crate::{behavior, context, ir::{Component as Body, View}, names};
use proc_macro2::TokenStream;
use quote::{format_ident, quote};
use std::collections::{BTreeMap, BTreeSet};

impl Component<'_, '_> {
    pub(super) fn consumed(&self, i: usize) -> proc_macro2::Ident {
        names::context(self.checked.links.keys[self.checked.ir.consumes[i].key.as_str()])
    }

    pub(super) fn initial_input(&self, p: Place) -> TokenStream {
        match p {
            Place::Prop(i) => { let name = &self.names.props[i]; quote!(&props.#name) }
            Place::Field(i) => { let name = names::field(i); quote!(&#name) }
            Place::Context(i) => { let name = self.consumed(i); quote!(&*#name.read()) }
        }
    }

    pub(super) fn logical_type(&mut self, fields: &mut Vec<TokenStream>, initialized: &mut Vec<TokenStream>, initializers: &[TokenStream], appearance: &TokenStream) -> Result<TokenStream> {
        let mut bind = Vec::new();
        let mut rebind = Vec::new();
        let mut creation = Vec::new();
        let mut publish = Vec::new();
        let mut provided = BTreeSet::new();
        fields.push(quote!(scope: ContextScope));
        initialized.push(quote!(scope: scope.clone()));
        fields.push(quote!(retired: ::core::primitive::bool));
        initialized.push(quote!(retired: false));
        let transactional = super::transactional(self.checked);
        let mut retire = self.task_storage(fields, initialized);
        let mut subscriptions = BTreeSet::new();
        for (i, read) in self.checked.ir.consumes.iter().enumerate() {
            let k = self.checked.links.keys[read.key.as_str()];
            if !subscriptions.insert(k) { continue; }
            let tag = context::marker(k);
            let source = context::channel(k);
            let slot = self.consumed(i);
            let dispatch = if transactional {
                let command = &self.names.command;
                let variant = context::notification(k);
                quote!(owner.__pui_submit(#command::#variant(provider), cx);)
            } else { quote!(owner.__pui_context_changed(false, cx);) };
            let subscription = context::subscription(&slot, &source, dispatch);
            fields.push(quote!(#slot: ::proto_ui_gpui_support::context::BoundContext<#tag>));
            retire.push(quote!(self.#slot.retire();));
            initialized.push(quote!(#slot));
            bind.push(quote!(let #slot = #subscription;));
            rebind.push(quote! {
                if self.#slot.provider() != scope.#source.as_ref() { self.#slot = #subscription; }
            });
        }
        for projection in &self.checked.ir.provides {
            let k = self.checked.links.keys[projection.key.as_str()];
            let tag = context::marker(k);
            let slot = context::channel(k);
            let f = self.checked.functions[projection.function.as_str()];
            let first = behavior::entry_call(self.checked, f, vec![], |p| self.initial_input(p), |_| unreachable!("pure provider"), TokenStream::new());
            let next = self.pure(&projection.function, quote!(self));
            fields.push(quote!(#slot: ::core::option::Option<::gpui::Entity<::proto_ui_gpui_support::context::Provider<#tag>>>));
            creation.push(quote! { let #slot = { let first = #first; cx.new(|_| #tag::KEY.provider(first)) }; });
            if !self.checked.bodies[f].facts.reads.is_empty() {
                publish.push(quote! { { let next = #next; self.#slot.as_ref().expect("live logical Context provider").update(cx, |provider, cx| provider.publish(next, cx)); } });
            }
            provided.insert(k);
            initialized.push(quote!(#slot: ::core::option::Option::Some(#slot)));
            retire.push(quote!(self.#slot.take();));
        }
        let scope_fields = (0..self.checked.unit.keys.len()).map(|k| {
            let slot = context::channel(k);
            if provided.contains(&k) { quote!(#slot: self.#slot.clone()) }
            else { quote!(#slot: self.scope.#slot.clone()) }
        });
        let resolver = self.checked.links.styled.then(|| quote!(resolve_token: self.scope.resolve_token.clone(),));
        let children = self.logical_children(fields, initialized)?;
        let sites = &self.checked.links.children[self.checked.index];
        if !sites.is_empty() {
            fields.push(quote!(_retirement: ::gpui::Subscription));
            initialized.push(quote!(_retirement: cx.on_release(|owner: &mut Self, app| owner.__pui_retire(app))));
        }
        let children_owned = (0..sites.len()).map(context::child).map(|slot| quote! {
            if let ::core::option::Option::Some((_, child)) = self.#slot.take() {
                child.update(app, |owner, cx| owner.__pui_retire(cx));
            }
        });
        let clear = transactional.then(|| quote!(self.publication.retire();));
        self.methods.push(quote! {
            #[allow(unused_variables)] fn __pui_retire(&mut self, app: &mut ::gpui::App) {
                if ::core::mem::replace(&mut self.retired, true) { return; }
                #clear #(#retire)*
                self.scope.withdraw();
                self.appearance.take();
                #(#children_owned)*
            }
        });
        let reactive = sites.iter().any(|site| match site {
            View::Child { key, props, .. } => std::iter::once(key).chain(props.iter().map(|p| &p.function)).any(|id| {
                !self.checked.bodies[self.checked.functions[id.as_str()]].facts.reads.is_empty()
            }),
            _ => unreachable!("linked child site"),
        });
        let sync_children = if reactive { quote!(self.__pui_children(cx);) }
            else if sites.is_empty() { TokenStream::new() }
            else { quote!(if scope_changed { self.__pui_children(cx); }) };
        let owner = &self.names.component;
        let props = &self.names.props_type;
        let needs = context::preflight(self.checked);
        let created = self.created();
        let enqueue = transactional.then(|| quote!(self.publication.after_effects(cx, Self::__pui_resume);));
        let move_scope = if transactional {
            let cmd = &self.names.command;
            quote!(self.__pui_submit(#cmd::Rebind(scope.clone()), cx);)
        } else { quote!(self.__pui_move(scope, cx);) };
        self.methods.push(quote! {
            pub fn child_scope(&self) -> ContextScope { ContextScope { #resolver #(#scope_fields),* } }
            pub fn rebind(&mut self, scope: &ContextScope, cx: &mut ::gpui::Context<Self>) -> ::core::result::Result<(), MissingContext> {
                #needs
                if self.retired { return ::core::result::Result::Ok(()); }
                #move_scope ::core::result::Result::Ok(())
            }
            fn __pui_swap_scope(&mut self, scope: &ContextScope, cx: &mut ::gpui::Context<Self>) -> ::core::primitive::bool {
                if self.scope.same(scope) { return false; }
                #(#rebind)* self.scope = scope.clone(); true
            }
            fn __pui_move(&mut self, scope: &ContextScope, cx: &mut ::gpui::Context<Self>) {
                if self.retired { return; }
                if self.__pui_swap_scope(scope, cx) { self.__pui_context_changed(true, cx); }
            }
            fn __pui_context_changed(&mut self, scope_changed: ::core::primitive::bool, cx: &mut ::gpui::Context<Self>) {
                if self.retired { return; }
                self.__pui_refresh(scope_changed, cx); cx.notify(); #enqueue
            }
            #[allow(unused_variables)] fn __pui_refresh(&mut self, scope_changed: ::core::primitive::bool, cx: &mut ::gpui::Context<Self>) { if self.retired { return; } #(#publish)* #sync_children }
            #[allow(unused_variables)] fn __pui_children(&mut self, cx: &mut ::gpui::Context<Self>) { if self.retired { return; } #children }
        });
        Ok(quote! {
            pub fn mount(props: #props, scope: &ContextScope, app: &mut ::gpui::App) -> ::core::result::Result<::gpui::Entity<#owner>, MissingContext> {
                #needs ::core::result::Result::Ok(Self::__pui_mount(props, scope, app))
            }
            fn __pui_mount(props: #props, scope: &ContextScope, app: &mut ::gpui::App) -> ::gpui::Entity<Self> {
                use ::gpui::AppContext as _;
                app.new(|cx| {
                    #(#bind)* #(#initializers)* #(#creation)*
                    let mut owner = Self { props, #appearance, #(#initialized,)* };
                    owner.__pui_children(cx);
                    #created
                    owner
                })
            }
        })
    }

    fn logical_children(&mut self, fields: &mut Vec<TokenStream>, initialized: &mut Vec<TokenStream>) -> Result<TokenStream> {
        let sites = &self.checked.links.children[self.checked.index];
        if sites.is_empty() { return Ok(TokenStream::new()); }
        let mut keys = Vec::new();
        let mut resolved = Vec::new();
        let mut by_type = BTreeMap::<usize, Vec<usize>>::new();
        let mut attach = Vec::new();
        for (i, site) in sites.iter().enumerate() {
            let View::Child { component, key, props, source } = site else { unreachable!("linked child site") };
            let target = self.checked.links.components[component.as_str()];
            let body = &self.checked.unit.bodies[target];
            let owner = names::public(&body.name, &body.id, &body.source)?;
            let slot = context::child(i);
            let key_var = format_ident!("key_{i}");
            let value = self.pure(key, quote!(self));
            keys.push(quote!(let #key_var = ::gpui::SharedString::from(#value);));
            let crate::ir::Source { file, start, end } = source;
            resolved.push(quote!((& #key_var, #file, #start, #end)));
            by_type.entry(target).or_default().push(i);
            fields.push(quote!(#slot: ::core::option::Option<(::gpui::SharedString, ::gpui::Entity<#owner>)>));
            initialized.push(quote!(#slot: ::core::option::Option::None));
            let properties = self.child_props(body, props)?;
            let previous = format_ident!("previous_{target}");
            attach.push(quote! {
                {
                    let props = #properties;
                    let retained = #previous.iter_mut().find(|entry| entry.as_ref().is_some_and(|(key, _)| *key == #key_var)).and_then(::core::option::Option::take);
                    let child = if let ::core::option::Option::Some((_, child)) = retained {
                        child.update(cx, |view, cx| view.__pui_link(props, &scope, cx));
                        child
                    } else { #owner::__pui_mount(props, &scope, cx) };
                    self.#slot = ::core::option::Option::Some((#key_var, child));
                }
            });
        }
        let mut previous = Vec::new();
        let mut removed = Vec::new();
        for (target, sites) in by_type {
            let local = format_ident!("previous_{target}");
            let source = sites.into_iter().map(context::child);
            previous.push(quote!(let mut #local = [#(self.#source.take()),*];));
            removed.push(quote! { for (_, child) in #local.into_iter().flatten() { child.update(cx, |owner,cx| owner.__pui_retire(cx)); } });
        }
        let duplicates = if resolved.len() > 1 {
            let owner = &self.names.component;
            self.item(quote!(impl ::gpui::EventEmitter<ChildKeyConflict> for #owner {}))?;
            Some(quote! {
                let keys = [#(#resolved),*];
                for (i, &(key, file, start, end)) in keys.iter().enumerate() {
                    if keys[..i].iter().any(|entry| entry.0 == key) {
                        cx.emit(ChildKeyConflict { key: key.clone(), file, start, end }); return;
                    }
                }
            })
        } else { None };
        Ok(quote!(#(#keys)* #duplicates let scope = self.child_scope(); #(#previous)* #(#attach)* #(#removed)*))
    }

    fn child_props(&self, child: &Body, inputs: &[crate::ir::ChildProp]) -> Result<TokenStream> {
        let owner = names::public(&child.name, &child.id, &child.source)?;
        let props = format_ident!("{}Props", owner);
        let mut values = Vec::new();
        for input in inputs {
            let b = &child.props.iter().find(|p| p.binding.name == input.name).expect("checked child prop").binding;
            let field = names::public(&b.name, &b.id, &b.source)?;
            let v = self.pure(&input.function, quote!(self));
            let v = if self.checked.payload(b.ty).is_some() { quote!(::core::option::Option::Some(#v)) } else { v };
            values.push(quote!(#field: #v));
        }
        for prop in &child.props {
            let b = &prop.binding;
            if inputs.iter().any(|p| p.name == b.name) { continue; }
            let field = names::public(&b.name, &b.id, &b.source)?;
            let v = prop.default.as_ref().map(behavior::schema_default).unwrap_or_else(|| quote!(::core::option::Option::None));
            values.push(quote!(#field: #v));
        }
        Ok(quote!(#props { #(#values),* }))
    }
}
