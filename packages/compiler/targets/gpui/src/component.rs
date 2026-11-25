use crate::behavior::{self, entry_call};
use crate::check::{Checked, Place, Result};
use crate::ir::{Role, Type};
use crate::names::{self, Names};
use proc_macro2::TokenStream;
use quote::quote;
use std::collections::BTreeSet;

struct Component<'c, 'a> {
    checked: &'c Checked<'a>,
    names: Names,
    observed: BTreeSet<Place>,
    items: Vec<syn::Item>,
    methods: Vec<TokenStream>,
}

pub fn generate(checked: &Checked<'_>) -> Result<syn::File> {
    let ir = checked.ir;
    let names = Names::new(checked)?;
    let observed = ir.projections.iter().map(|p| &p.function).chain([&ir.view.text]).chain(&ir.view.disabled)
        .flat_map(|id| checked.bodies[checked.functions[id.as_str()]].facts.reads.iter().copied()).collect();
    let methods = behavior::methods(checked, &names);
    let mut builder = Component { checked, names, observed, items: Vec::new(), methods };
    builder.data_types()?;
    builder.view_type()?;
    builder.public_projection();
    builder.props_update();
    builder.signal_type()?;
    if !checked.actions.is_empty() { builder.actions()?; }
    let owner = &builder.names.component;
    let methods = &builder.methods;
    builder.item(quote!(#[allow(non_snake_case)] impl #owner { #(#methods)* }))?;
    builder.render()?;
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
        }
    }

    fn pure(&self, id: &str, receiver: TokenStream) -> TokenStream {
        let f = self.checked.functions[id];
        entry_call(self.checked, f, vec![], |p| self.published(p, &receiver), |_| unreachable!("checked pure behavior"), TokenStream::new())
    }

    fn data_types(&mut self) -> Result<()> {
        let ir = self.checked.ir;
        let props = &self.names.props_type;
        let fields = ir.props.iter().zip(&self.names.props).map(|(b, n)| {
            let ty = names::ty(b.ty);
            let doc = names::source_doc(&b.name, &b.source);
            quote!(#[doc = #doc] pub #n: #ty)
        });
        self.item(quote! {
            #[derive(Clone, Debug)]
            #[allow(non_snake_case, non_camel_case_types)]
            pub struct #props { #(#fields),* }
        })?;
        let proj = &self.names.projection;
        let mut fields = Vec::new();
        let mut getters = Vec::new();
        for (p, n) in ir.projections.iter().zip(&self.names.projections) {
            let b = &ir.behaviors[self.checked.functions[p.function.as_str()]].binding;
            let ty = names::ty(b.ty);
            let result = names::input_ty(b.ty);
            let value = if b.ty == Type::Text { quote!(self.#n.as_str()) } else { quote!(self.#n) };
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
        let owner = &self.names.component;
        let props = &self.names.props_type;
        let projection = &self.names.projection;
        let command = &self.names.command;
        let mut fields = Vec::new();
        let mut initializers = Vec::new();
        let mut initialized = Vec::new();
        for (i, field) in ir.fields.iter().enumerate() {
            let n = names::field(i);
            let ty = names::ty(field.binding.ty);
            fields.push(quote!(#n: #ty));
            let f = self.checked.functions[field.init.as_str()];
            let init = entry_call(self.checked, f, vec![], |p| match p {
                Place::Prop(i) => { let name = &self.names.props[i]; quote!(&props.#name) }
                Place::Field(i) => { let name = names::field(i); quote!(&#name) }
            }, |_| unreachable!("checked initializer"), TokenStream::new());
            initializers.push(quote!(let #n = #init;));
            initialized.push(quote!(#n));
        }
        if !self.checked.actions.is_empty() {
            fields.push(quote!(publication: ::proto_ui_gpui_support::PublicationQueue<#command>));
            initialized.push(quote!(publication: ::core::default::Default::default()));
        }
        let doc = names::source_doc(&ir.name, &ir.source);
        let decl = quote! {
            #[doc = #doc]
            #[allow(non_camel_case_types)]
            pub struct #owner {
                props: #props,
                appearance: ::core::option::Option<::std::boxed::Box<dyn ::core::ops::Fn(&#projection, &mut ::gpui::StyleRefinement)>>,
                #(#fields,)*
            }
        };
        self.methods.push(quote! {
            pub fn new(props: #props) -> Self {
                #(#initializers)*
                Self { props, appearance: ::core::option::Option::None, #(#initialized,)* }
            }
        });
        self.methods.push(quote! {
            pub fn with_appearance(mut self, style: impl ::core::ops::Fn(&#projection, &mut ::gpui::StyleRefinement) + 'static) -> Self {
                self.appearance = ::core::option::Option::Some(::std::boxed::Box::new(style));
                self
            }
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

    fn props_update(&mut self) {
        let props = &self.names.props_type;
        let command = &self.names.command;
        let tests: Vec<_> = self.observed.iter().filter_map(|p| match *p {
            Place::Prop(i) => {
                let n = &self.names.props[i];
                Some(differs(self.checked.ir.props[i].ty, quote!(self.props.#n), quote!(props.#n)))
            }
            Place::Field(_) => None,
        }).collect();
        // Store all inputs. An action-only input must still be current even when
        // its replacement has no dependency in the host view or public projection.
        let changed = if tests.is_empty() { quote!(false) } else { quote!(#(#tests)||*) };
        if self.checked.actions.is_empty() {
            self.methods.push(quote! {
                pub fn set_props(&mut self, props: #props, cx: &mut ::gpui::Context<Self>) {
                    let changed = #changed;
                    self.props = props;
                    if changed { cx.notify(); }
                }
            });
        } else {
            self.methods.push(quote! {
                pub fn set_props(&mut self, props: #props, cx: &mut ::gpui::Context<Self>) -> ::proto_ui_gpui_support::ActionOutcome {
                    self.__pui_submit(#command::Props(props), cx)
                }
            });
            self.methods.push(quote! {
                fn __pui_props(&mut self, props: #props, cx: &mut ::gpui::Context<Self>) {
                    let changed = #changed;
                    self.props = props;
                    if changed {
                        cx.notify();
                        self.publication.after_effects(cx, Self::__pui_resume);
                    }
                }
            });
        }
    }

    fn signal_type(&mut self) -> Result<()> {
        let ir = self.checked.ir;
        if !ir.signals.is_empty() {
            let signal = &self.names.signal;
            let owner = &self.names.component;
            let variants = ir.signals.iter().zip(&self.names.signals).map(|(b, n)| {
                let ty = names::ty(b.ty);
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
        for &f in &self.checked.actions {
            let variant = names::command(f);
            let b = &self.checked.ir.behaviors[f];
            let params: Vec<_> = b.params.iter().map(|p| names::ty(p.ty)).collect();
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
                let args = names::formal_names(&b.params);
                let params = b.params.iter().zip(&args).map(|(p, n)| { let ty = names::ty(p.ty); quote!(#n: #ty) });
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
            if p.ty == Type::Text { quote!(#n.as_str()) } else { quote!(#n) }
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
        let notify = changes_view.then(|| quote!(if changed { cx.notify(); }));
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

    fn render(&mut self) -> Result<()> {
        let owner = &self.names.component;
        let ir = self.checked.ir;
        let text = self.pure(&ir.view.text, quote!(self));
        let root = if ir.view.role == Role::Button {
            let name = &ir.name;
            quote! {
                use ::gpui::{InteractiveElement as _, StatefulInteractiveElement as _};
                let label = ::gpui::SharedString::from(#text);
                let mut root = ::gpui::div().id((#name, cx.entity_id())).role(::gpui::Role::Button)
                    .aria_label(label.clone()).child(label);
            }
        } else { quote!(let mut root = ::gpui::div().child(#text);) };
        let availability = ir.view.disabled.as_ref().map(|id| {
            let value = self.pure(id, quote!(self));
            quote!(let disabled = #value;)
        });
        let element = if availability.is_some() { quote!(::proto_ui_gpui_support::button_availability(root, disabled)) } else { quote!(root) };
        let attachment = ir.view.activate.as_ref().map(|id| {
            let f = self.checked.functions[id.as_str()];
            let cmd = &self.names.command;
            let activate = names::command(f);
            let dispatch = quote!(view.__pui_submit(#cmd::#activate(), cx));
            let effect = if self.checked.bodies[f].facts.fallible {
                quote! {
                    if let ::proto_ui_gpui_support::ActionOutcome::Failed(failure) = #dispatch {
                        cx.emit(failure);
                        view.publication.after_effects(cx, Self::__pui_resume);
                    }
                }
            } else { quote!(#dispatch;) };
            let disabled = ir.view.disabled.as_ref();
            let guard = disabled.map(|id| { let value = self.pure(id, quote!(view)); quote!(if #value { return; }) });
            let listener = quote! {
                root = root.on_click(cx.listener(|view, _: &::gpui::ClickEvent, _, cx| { #guard #effect }));
            };
            if disabled.is_some() {
                quote!(if !disabled { #listener })
            } else { listener }
        });
        self.item(quote! {
            impl ::gpui::Render for #owner {
                #[allow(unused_variables)]
                fn render(&mut self, _window: &mut ::gpui::Window, cx: &mut ::gpui::Context<Self>) -> impl ::gpui::IntoElement {
                    use ::gpui::{ParentElement as _, Styled as _};
                    #root
                    #availability
                    if let ::core::option::Option::Some(style) = &self.appearance { style(&self.projection(), root.style()); }
                    #attachment
                    #element
                }
            }
        })
    }
}

fn differs(ty: Type, a: TokenStream, b: TokenStream) -> TokenStream {
    if ty == Type::Number {
        quote!(((#a).to_bits() != (#b).to_bits()) && !((#a).is_nan() && (#b).is_nan()))
    } else { quote!((#a) != (#b)) }
}
