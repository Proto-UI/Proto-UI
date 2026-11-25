use crate::behavior::{self, entry_call};
use crate::check::{Checked, Place, Result};
use crate::ir::{Data, Type};
use crate::names::{self, Names};
use proc_macro2::TokenStream;
use quote::quote;
use std::collections::BTreeSet;
#[path = "logical.rs"] mod logical;

struct Component<'c, 'a> {
    checked: &'c Checked<'a>,
    names: Names,
    observed: BTreeSet<Place>,
    items: Vec<syn::Item>,
    methods: Vec<TokenStream>,
}

pub fn generate(checked: &Checked<'_>) -> Result<syn::File> {
    let names = Names::new(checked)?;
    let observed = checked.derived.iter().flat_map(|&f| checked.bodies[f].facts.reads.iter().copied()).collect();
    let methods = behavior::methods(checked, &names);
    let mut builder = Component { checked, names, observed, items: Vec::new(), methods };
    builder.composites()?;
    builder.data_types()?;
    builder.view_type()?;
    builder.public_projection();
    builder.props_update()?;
    builder.signal_type()?;
    if !checked.actions.is_empty() { builder.actions()?; }
    let owner = &builder.names.component;
    let methods = &builder.methods;
    builder.item(quote!(#[allow(non_snake_case)] impl #owner { #(#methods)* }))?;
    let render = crate::view::render(checked, &builder.names, |id, receiver| builder.pure(id, receiver));
    builder.item(render)?;
    Ok(syn::File { shebang: None, attrs: vec![], items: builder.items })
}

impl Component<'_, '_> {
    fn item(&mut self, tokens: TokenStream) -> Result<()> {
        self.items.push(syn::parse2(tokens).map_err(|e| format!("{}: GPUI target AST construction failed: {e}", self.checked.ir.source))?);
        Ok(())
    }

    fn published(&self, p: Place, receiver: &TokenStream) -> TokenStream {
        match p {
            Place::Prop(i) => { let n = &self.names.props[i]; quote!(&#receiver.props.#n) }
            Place::Field(i) => { let n = names::field(i); quote!(&#receiver.#n) }
            Place::Context(i) => { let n = self.consumed(i); quote!(&*#receiver.#n.read()) }
        }
    }

    fn pure(&self, id: &str, receiver: TokenStream) -> TokenStream {
        let f = self.checked.functions[id];
        entry_call(self.checked, f, vec![], |p| self.published(p, &receiver), |_| unreachable!("checked pure behavior"), TokenStream::new())
    }

    fn composites(&mut self) -> Result<()> {
        if self.checked.index != 0 { return Ok(()); }
        for (i, data) in self.checked.unit.types.iter().enumerate() {
            let n = &self.names.data[i];
            let compare = comparison(i);
            let (decl, changed) = match data {
                Data::Presence { value, source } => {
                    let payload = self.names.ty(*value);
                    let doc = names::source_doc("presence", source);
                    let inner = differs(*value, quote!(*left), quote!(*right));
                    (quote!(#[doc = #doc] #[allow(non_camel_case_types)] pub type #n = ::core::option::Option<#payload>;), quote! {
                        match (left, right) {
                            (::core::option::Option::Some(left), ::core::option::Option::Some(right)) => #inner,
                            (::core::option::Option::None, ::core::option::Option::None) => false,
                            _ => true,
                        }
                    })
                }
                Data::Record { fields, source } => {
                    let doc = names::source_doc("record", source);
                    let mut members = Vec::new();
                    let mut checks = Vec::new();
                    for (f, member) in fields.iter().zip(&self.names.members[i]) {
                        let ty = self.names.ty(f.ty);
                        let doc = names::source_doc(&f.name, &f.source);
                        members.push(quote!(#[doc = #doc] pub #member: #ty));
                        checks.push(differs(f.ty, quote!(left.#member), quote!(right.#member)));
                    }
                    let changed = if checks.is_empty() { quote!(false) } else { quote!(#(#checks)||*) };
                    (quote!(#[doc = #doc] #[allow(non_camel_case_types, non_snake_case)] #[derive(Clone, Debug, PartialEq)] pub struct #n { #(#members),* }), changed)
                }
            };
            // Rust PartialEq implements language equality. Publication recurses through
            // this separate comparison so NaN and signed zero retain their reactive rules.
            let comparison = quote!(#[allow(dead_code, unused_variables)] fn #compare(left: &#n, right: &#n) -> ::core::primitive::bool { #changed });
            self.item(decl)?;
            self.item(comparison)?;
        }
        Ok(())
    }

    fn data_types(&mut self) -> Result<()> {
        let ir = self.checked.ir;
        let props = &self.names.props_type;
        let mut fields = Vec::new();
        let mut required = Vec::new();
        let mut values = Vec::new();
        let args = names::formal_names(ir.props.iter().map(|p| &p.binding));
        for ((prop, n), arg) in ir.props.iter().zip(&self.names.props).zip(args) {
            let b = &prop.binding;
            let ty = self.names.ty(b.ty);
            let doc = names::source_doc(&b.name, &b.source);
            fields.push(quote!(#[doc = #doc] pub #n: #ty));
            let value = match &prop.default {
                Some(v) => behavior::schema_default(v),
                None if self.checked.payload(b.ty).is_some() => quote!(::core::option::Option::None),
                None => { required.push(quote!(#arg: #ty)); quote!(#arg) }
            };
            values.push(quote!(#n: #value));
        }
        let decl = quote! {
            #[derive(Clone, Debug)]
            #[allow(non_snake_case, non_camel_case_types)]
            pub struct #props { #(#fields),* }
        };
        let constructor = quote! {
            #[allow(non_snake_case)] impl #props {
                pub fn new(#(#required),*) -> Self { Self { #(#values),* } }
            }
        };
        let default = required.is_empty().then(|| quote! {
            impl ::core::default::Default for #props { fn default() -> Self { Self::new() } }
        });
        self.item(decl)?;
        self.item(constructor)?;
        if let Some(default) = default { self.item(default)?; }
        let proj = &self.names.projection;
        let mut fields = Vec::new();
        let mut getters = Vec::new();
        for (p, n) in ir.projections.iter().zip(&self.names.projections) {
            let b = &ir.behaviors[self.checked.functions[p.function.as_str()]].binding;
            let ty = self.names.ty(b.ty);
            let (result, value) = match b.ty {
                Type::Text => (self.names.input_ty(b.ty), quote!(self.#n.as_str())),
                Type::Tokens => (quote!(&[::gpui::SharedString]), quote!(self.#n.as_ref())),
                Type::Data(_) => (quote!(&#ty), quote!(&self.#n)),
                _ => (ty.clone(), quote!(self.#n)),
            };
            let doc = names::source_doc(&p.name, &b.source);
            fields.push(quote!(#n: #ty));
            getters.push(quote!(#[doc = #doc] pub fn #n(&self) -> #result { #value }));
        }
        let decl = quote! {
            #[derive(Clone, Debug)]
            #[allow(non_snake_case, non_camel_case_types)]
            pub struct #proj { #(#fields),* }
        };
        let accessors = quote!(#[allow(non_snake_case)] impl #proj { #(#getters)* });
        self.item(decl)?;
        self.item(accessors)
    }

    fn view_type(&mut self) -> Result<()> {
        let ir = self.checked.ir;
        let command = &self.names.command;
        let mut fields = Vec::new();
        let mut initializers = Vec::new();
        let mut initialized = Vec::new();
        for (i, field) in ir.fields.iter().enumerate() {
            let n = names::field(i);
            let ty = self.names.ty(field.binding.ty);
            fields.push(quote!(#n: #ty));
            let f = self.checked.functions[field.init.as_str()];
            let init = entry_call(self.checked, f, vec![], |p| self.initial_input(p), |_| unreachable!("checked initializer"), TokenStream::new());
            initializers.push(quote!(let #n = #init;));
            initialized.push(quote!(#n));
        }
        if !self.checked.actions.is_empty() {
            fields.push(quote!(publication: ::proto_ui_gpui_support::PublicationQueue<#command>));
            initialized.push(quote!(publication: ::core::default::Default::default()));
        }
        let resolver = (self.checked.has_styles && !self.checked.links.scoped).then(|| {
            let signature = quote!(::core::ops::Fn(&::core::primitive::str, &mut ::gpui::StyleRefinement));
            fields.push(quote!(resolve_token: ::std::boxed::Box<dyn #signature>));
            initialized.push(quote!(resolve_token: ::std::boxed::Box::new(resolve_token)));
            quote!(, resolve_token: impl #signature + 'static)
        });
        let mut doc = names::source_doc(&ir.name, &ir.source);
        if let Some(authored) = &ir.prototype_name {
            use std::fmt::Write as _;
            write!(&mut doc, " Authored prototype {authored:?}.").expect("writing to String");
        }
        let appearance = quote!(appearance: ::core::option::Option::None);
        let create = if self.checked.links.scoped {
            self.logical_type(&mut fields, &mut initialized, &initializers, &appearance)?
        } else {
            let props = &self.names.props_type;
            quote! {
                pub fn new(props: #props #resolver) -> Self {
                    #(#initializers)* Self { props, #appearance, #(#initialized,)* }
                }
            }
        };
        let owner = &self.names.component;
        let props = &self.names.props_type;
        let projection = &self.names.projection;
        let decl = quote! {
            #[doc = #doc]
            #[allow(non_camel_case_types)]
            pub struct #owner {
                props: #props,
                appearance: ::core::option::Option<::std::boxed::Box<dyn ::core::ops::Fn(&#projection, &mut ::gpui::StyleRefinement)>>,
                #(#fields,)*
            }
        };
        self.methods.push(create);
        let style = quote!(impl ::core::ops::Fn(&#projection, &mut ::gpui::StyleRefinement) + 'static);
        let set = quote!(self.appearance = ::core::option::Option::Some(::std::boxed::Box::new(style)););
        self.methods.push(if self.checked.links.scoped {
            quote!(pub fn set_appearance(&mut self, style: #style, cx: &mut ::gpui::Context<Self>) { #set cx.notify(); })
        } else {
            quote!(pub fn with_appearance(mut self, style: #style) -> Self { #set self })
        });
        self.item(decl)
    }

    fn public_projection(&mut self) {
        let ty = &self.names.projection;
        let fields = self.checked.ir.projections.iter().zip(&self.names.projections).map(|(p, n)| {
            let value = self.pure(&p.function, quote!(self));
            quote!(#n: #value)
        });
        let method = quote!(pub fn projection(&self) -> #ty { #ty { #(#fields),* } });
        self.methods.push(method);
    }

    fn props_update(&mut self) -> Result<()> {
        let input_error = &self.names.input_error;
        let guard_fields: Vec<_> = self.checked.ir.props.iter().zip(&self.names.props).filter(|(p, _)| p.control_mode.is_some()).map(|(p, n)| {
            let field = &p.binding.name;
            quote! {
                if self.props.#n.is_some() != props.#n.is_some() {
                    return ::core::result::Result::Err(#input_error { field: #field, was_present: self.props.#n.is_some(), requested_present: props.#n.is_some() });
                }
            }
        }).collect();
        let fixed = !guard_fields.is_empty();
        let guards = fixed.then(|| quote!(self.__pui_check_input(&props)?;));
        let rejection = fixed.then(|| quote! {
            #[allow(non_camel_case_types)] #[derive(Clone, Copy, Debug, Eq, PartialEq)]
            pub struct #input_error { pub field: &'static ::core::primitive::str, pub was_present: ::core::primitive::bool, pub requested_present: ::core::primitive::bool }
        });
        let props = &self.names.props_type;
        if fixed {
            self.methods.push(quote! {
                fn __pui_check_input(&self, props: &#props) -> ::core::result::Result<(), #input_error> { #(#guard_fields)* ::core::result::Result::Ok(()) }
            });
        }
        let command = &self.names.command;
        let tests: Vec<_> = self.observed.iter().filter_map(|p| match *p {
            Place::Prop(i) => {
                let n = &self.names.props[i];
                Some(differs(self.checked.ir.props[i].binding.ty, quote!(self.props.#n), quote!(props.#n)))
            }
            Place::Field(_) | Place::Context(_) => None,
        }).collect();
        // Store all inputs. An action-only input must still be current even when
        // its replacement has no dependency in the host view or public projection.
        let changed = if tests.is_empty() { quote!(false) } else { quote!(#(#tests)||*) };
        let sync = self.checked.links.scoped.then(|| quote!(self.__pui_refresh(false, cx);));
        let mut linked_input_error = None;
        if self.checked.links.scoped {
            let reject = fixed.then(|| quote!(if let ::core::result::Result::Err(error) = self.__pui_check_input(&props) { cx.emit(error); return; }));
            let transactional = !self.checked.actions.is_empty();
            let enqueue = transactional.then(|| quote!(self.publication.after_effects(cx, Self::__pui_resume);));
            let submit = if transactional { quote!(self.__pui_submit(#command::Link(props, scope.clone()), cx);) } else { quote!(self.__pui_link_now(props, scope, cx);) };
            self.methods.push(quote! {
                fn __pui_link(&mut self, props: #props, scope: &ContextScope, cx: &mut ::gpui::Context<Self>) { #reject #submit }
                fn __pui_link_now(&mut self, props: #props, scope: &ContextScope, cx: &mut ::gpui::Context<Self>) {
                    let moved = self.__pui_swap_scope(scope, cx);
                    let changed = moved || (#changed);
                    self.props = props;
                    if changed { self.__pui_refresh(moved, cx); cx.notify(); #enqueue }
                }
            });
            let owner = &self.names.component;
            if fixed { linked_input_error = Some(quote!(impl ::gpui::EventEmitter<#input_error> for #owner {})); }
        }
        let outcome = quote!(::proto_ui_gpui_support::ActionOutcome);
        if self.checked.actions.is_empty() {
            let ret = fixed.then(|| quote!(-> ::core::result::Result<#outcome, #input_error>));
            let success = fixed.then(|| quote!(::core::result::Result::Ok(#outcome::Committed)));
            self.methods.push(quote! {
                pub fn set_props(&mut self, props: #props, cx: &mut ::gpui::Context<Self>) #ret {
                    #guards
                    let changed = #changed;
                    self.props = props;
                    if changed { #sync cx.notify(); }
                    #success
                }
            });
        } else {
            let dispatch = quote!(self.__pui_submit(#command::Props(props), cx));
            let (ret, body) = if fixed {
                (quote!(::core::result::Result<#outcome, #input_error>), quote!(#guards ::core::result::Result::Ok(#dispatch)))
            } else { (outcome, dispatch) };
            self.methods.push(quote! {
                pub fn set_props(&mut self, props: #props, cx: &mut ::gpui::Context<Self>) -> #ret { #body }
            });
            self.methods.push(quote! {
                fn __pui_props(&mut self, props: #props, cx: &mut ::gpui::Context<Self>) {
                    let changed = #changed;
                    self.props = props;
                    if changed {
                        #sync
                        cx.notify();
                        self.publication.after_effects(cx, Self::__pui_resume);
                    }
                }
            });
        }
        if let Some(item) = rejection { self.item(item)?; }
        if let Some(item) = linked_input_error { self.item(item)?; }
        Ok(())
    }

    fn signal_type(&mut self) -> Result<()> {
        let ir = self.checked.ir;
        if !ir.signals.is_empty() {
            let signal = &self.names.signal;
            let owner = &self.names.component;
            let variants = ir.signals.iter().zip(&self.names.signals).map(|(b, n)| {
                let ty = self.names.ty(b.ty);
                let doc = names::source_doc(&b.name, &b.source);
                quote!(#[doc = #doc] #n(#ty))
            });
            let decl = quote!(#[derive(Clone, Debug)] #[allow(non_camel_case_types)] pub enum #signal { #(#variants),* });
            let emitter = quote!(impl ::gpui::EventEmitter<#signal> for #owner {});
            self.item(decl)?;
            self.item(emitter)?;
        }
        if self.checked.actions.iter().any(|&f| self.checked.bodies[f].facts.fallible) {
            let owner = &self.names.component;
            self.item(quote!(impl ::gpui::EventEmitter<::proto_ui_gpui_support::SegmentFailure> for #owner {}))?;
        }
        Ok(())
    }

    fn actions(&mut self) -> Result<()> {
        let command = &self.names.command;
        let props = &self.names.props_type;
        let owner = &self.names.component;
        let actions = &self.names.actions_type;
        let outcome = quote!(::proto_ui_gpui_support::ActionOutcome);
        let mut variants = vec![quote!(Props(#props))];
        let mut arms = vec![quote!(#command::Props(props) => { self.__pui_props(props, cx); #outcome::Committed })];
        if self.checked.links.scoped {
            variants.extend([quote!(Rebind(ContextScope)), quote!(Link(#props, ContextScope))]);
            arms.extend([
                quote!(#command::Rebind(scope) => { self.__pui_move(&scope, cx); #outcome::Committed }),
                quote!(#command::Link(props, scope) => { self.__pui_link_now(props, &scope, cx); #outcome::Committed }),
            ]);
            let keys: BTreeSet<_> = self.checked.ir.consumes.iter().map(|c| self.checked.links.keys[c.key.as_str()]).collect();
            for k in keys {
                let tag = crate::context::marker(k);
                let slot = names::context(k);
                let variant = crate::context::notification(k);
                variants.push(quote!(#variant(::gpui::Entity<::proto_ui_gpui_support::context::Provider<#tag>>)));
                arms.push(quote!(#command::#variant(provider) => {
                    if self.#slot.provider == provider { self.__pui_context_changed(false, cx); }
                    #outcome::Committed
                }));
            }
        }
        for &f in &self.checked.actions {
            let variant = names::command(f);
            let b = &self.checked.ir.behaviors[f];
            let params: Vec<_> = b.params.iter().map(|p| self.names.ty(p.ty)).collect();
            let args: Vec<_> = (0..params.len()).map(names::argument).collect();
            variants.push(quote!(#variant(#(#params),*)));
            let body = self.action_body(f);
            arms.push(quote!(#command::#variant(#(#args),*) => { #body }));
        }
        let decl = quote!(#[allow(non_camel_case_types)] enum #command { #(#variants),* });
        let mut facade = None;
        if !self.checked.ir.actions.is_empty() {
            let mut entries = Vec::new();
            for (a, n) in self.checked.ir.actions.iter().zip(&self.names.actions) {
                let f = self.checked.functions[a.function.as_str()];
                let b = &self.checked.ir.behaviors[f];
                let variant = names::command(f);
                let args = names::formal_names(b.params.iter());
                let params = b.params.iter().zip(&args).map(|(p, n)| { let ty = self.names.ty(p.ty); quote!(#n: #ty) });
                let doc = names::source_doc(&a.name, &b.binding.source);
                entries.push(quote! {
                    #[doc = #doc]
                    pub fn #n(&mut self, #(#params),*) -> #outcome {
                        self.owner.__pui_submit(#command::#variant(#(#args),*), self.cx)
                    }
                });
            }
            facade = Some((quote! {
                #[allow(non_camel_case_types)]
                pub struct #actions<'a, 'app> { owner: &'a mut #owner, cx: &'a mut ::gpui::Context<'app, #owner> }
            }, quote! { #[allow(non_snake_case)] impl #actions<'_, '_> { #(#entries)* } }));
            self.methods.push(quote! {
                pub fn actions<'a, 'app>(&'a mut self, cx: &'a mut ::gpui::Context<'app, Self>) -> #actions<'a, 'app> {
                    #actions { owner: self, cx }
                }
            });
        }
        let consume = if self.checked.actions.iter().any(|&f| self.checked.bodies[f].facts.fallible) {
            quote! {
                if let #outcome::Failed(failure) = self.__pui_run(command, cx) {
                    cx.emit(failure);
                    self.publication.after_effects(cx, Self::__pui_resume);
                }
            }
        } else { quote!(self.__pui_run(command, cx);) };
        self.methods.push(quote! {
            fn __pui_submit(&mut self, command: #command, cx: &mut ::gpui::Context<Self>) -> #outcome {
                match self.publication.admit(command) {
                    ::core::option::Option::Some(command) => self.__pui_run(command, cx),
                    ::core::option::Option::None => #outcome::Queued,
                }
            }
        });
        self.methods.push(quote! {
            fn __pui_resume(&mut self, cx: &mut ::gpui::Context<Self>) {
                self.publication.resume();
                while let ::core::option::Option::Some(command) = self.publication.next_ready() { #consume }
            }
        });
        self.methods.push(quote! {
            fn __pui_run(&mut self, command: #command, cx: &mut ::gpui::Context<Self>) -> #outcome {
                match command { #(#arms),* }
            }
        });
        self.item(decl)?;
        if let Some((decl, methods)) = facade { self.item(decl)?; self.item(methods)?; }
        Ok(())
    }

    fn action_body(&self, f: usize) -> TokenStream {
        let ir = self.checked.ir;
        let facts = &self.checked.bodies[f].facts;
        let outcome = quote!(::proto_ui_gpui_support::ActionOutcome);
        let args = ir.behaviors[f].params.iter().enumerate().map(|(i, p)| {
            let n = names::argument(i);
            names::as_input(p.ty, quote!(#n))
        }).collect();
        let mut stage = Vec::new();
        let mut commit = Vec::new();
        let mut changes_view = false;
        for &i in &facts.writes {
            let slot = names::pending(i);
            let field = names::field(i);
            stage.push(quote!(let mut #slot = ::proto_ui_gpui_support::PendingWrite::new(&self.#field);));
            let observed = self.observed.contains(&Place::Field(i));
            changes_view |= observed;
            let check = observed.then(|| {
                let diff = differs(ir.fields[i].binding.ty, quote!(self.#field), quote!(next));
                quote!(changed |= #diff;)
            });
            commit.push(quote! {
                if let ::core::option::Option::Some(next) = #slot.finish() { #check self.#field = next; }
            });
        }
        let signals = !facts.signals.is_empty();
        if signals { stage.push(quote!(let mut signals = ::std::vec::Vec::new();)); }
        let call = entry_call(self.checked, f, args, |p| self.published(p, &quote!(self)), |i| { let n = names::pending(i); quote!(&mut #n) }, quote!(&mut signals));
        let run = if facts.fallible { quote!(if let ::core::result::Result::Err(failure) = #call { return #outcome::Failed(failure); }) } else { quote!(#call;) };
        let track = changes_view.then(|| quote!(let mut changed = false;));
        let sync = self.checked.links.scoped.then(|| quote!(self.__pui_refresh(false, cx);));
        let notify = changes_view.then(|| quote!(if changed { #sync cx.notify(); }));
        let emit = signals.then(|| quote!(for signal in signals { cx.emit(signal); }));
        let effects = match (changes_view, signals) {
            (true, true) => Some(quote!(changed || !signals.is_empty())),
            (true, false) => Some(quote!(changed)), (false, true) => Some(quote!(!signals.is_empty())),
            (false, false) => None,
        };
        let publish = effects.map(|active| quote! {
            if #active { #notify #emit self.publication.after_effects(cx, Self::__pui_resume); }
        });
        quote! { #(#stage)* #run #track #(#commit)* #publish #outcome::Committed }
    }

}

pub fn comparison(i: usize) -> proc_macro2::Ident { quote::format_ident!("__pui_data_changed_{i}") }

pub fn differs(ty: Type, a: TokenStream, b: TokenStream) -> TokenStream {
    match ty {
        Type::Number => quote!(((#a).to_bits() != (#b).to_bits()) && !((#a).is_nan() && (#b).is_nan())),
        Type::Data(i) => { let compare = comparison(i); quote!(#compare(&(#a), &(#b))) }
        _ => quote!((#a) != (#b)),
    }
}
