use super::{Component, Result};
use crate::{behavior, ir::{End, Instruction, Policy}, names};
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};
use std::collections::{BTreeSet, HashSet};

fn slot(f: usize) -> Ident { format_ident!("owned_task_{f}") }

impl Component<'_, '_> {
    pub(super) fn task_storage(&self, fields: &mut Vec<TokenStream>, initialized: &mut Vec<TokenStream>) -> Vec<TokenStream> {
        let mut retire = Vec::new();
        for declaration in &self.checked.ir.tasks {
            let f = self.checked.functions[declaration.function.as_str()];
            if !self.checked.tasks.contains(&f) { continue; }
            let name = slot(f);
            let value = self.names.ty(self.checked.ir.behaviors[f].binding.ty);
            let policy = match declaration.policy { Policy::Latest => quote!(Latest), Policy::Serial => quote!(Serial), Policy::Parallel => quote!(Parallel) };
            fields.push(quote!(#name: ::proto_ui_gpui_support::declared_task::DeclaredTask<Self, #value, ::proto_ui_gpui_support::SegmentFailure>));
            initialized.push(quote!(#name: ::proto_ui_gpui_support::declared_task::DeclaredTask::new(cx, ::proto_ui_gpui_support::owned_tasks::TaskPolicy::#policy)));
            retire.push(quote!(self.#name.retire(app);));
        }
        retire
    }

    pub(super) fn created(&self) -> TokenStream {
        if self.checked.ir.created.is_empty() { return TokenStream::new(); }
        let cmd = &self.names.command;
        let actions = self.checked.ir.created.iter().map(|id| {
            let f = self.checked.functions[id.as_str()];
            let action = names::command(f);
            let dispatch = quote!(owner.__pui_submit(#cmd::#action(), cx));
            if self.checked.bodies[f].facts.fallible { quote! {
                if let ::proto_ui_gpui_support::ActionOutcome::Failed(failure) = #dispatch {
                    cx.emit(failure); owner.publication.after_effects(cx, Self::__pui_resume);
                }
            } } else { quote!(#dispatch;) }
        });
        quote! {
            let weak = cx.weak_entity();
            cx.defer(move |app| {
                if let ::core::option::Option::Some(owner) = weak.upgrade() {
                    owner.update(app, |owner, cx| { #(#actions)* });
                }
            });
        }
    }

    pub(super) fn task_api(&mut self) -> Result<()> {
        let c = self.checked;
        if c.tasks.is_empty() { return Ok(()); }
        let owner = self.names.component.clone();
        let facade = format_ident!("{}Tasks", owner);
        let effect = behavior::effect_type(&self.names);
        let failure = quote!(::proto_ui_gpui_support::SegmentFailure);
        let mut fields = Vec::new();
        let mut variants = Vec::new();
        let mut arms = Vec::new();
        let mut names_used = HashSet::new();
        let mut starts = BTreeSet::new();
        let mut cancels = BTreeSet::new();
        let mut emits = false;
        for &f in &c.reached {
            for &b in &c.bodies[f].live_blocks {
                for op in &c.ir.behaviors[f].blocks[b].instructions {
                    match op {
                        Instruction::Start { task, .. } => { starts.insert(c.functions[task.as_str()]); },
                        Instruction::Cancel { task, .. } => { cancels.insert(c.functions[task.as_str()]); },
                        Instruction::Emit { .. } => emits = true,
                        _ => {},
                    }
                }
            }
        }
        if emits {
            let ty = &self.names.signal;
            variants.push(quote!(Signal(#ty)));
            arms.push(quote!(#effect::Signal(signal) => cx.emit(signal)));
        }
        for &f in &c.tasks {
            let fun = &c.ir.behaviors[f];
            let body = &c.bodies[f];
            let var = slot(f);
            let public = names::identifier(&fun.binding.name).filter(|n| names_used.insert(n.to_string())).unwrap_or_else(|| {
                let mut fresh = format!("__pui_task_{f}");
                while !names_used.insert(fresh.clone()) { fresh.push('_'); }
                format_ident!("{fresh}")
            });
            let ty = self.names.ty(fun.binding.ty);
            fields.push(quote! {
                pub fn #public(&self) -> ::core::option::Option<::proto_ui_gpui_support::owned_tasks::TaskHandle<#owner, #ty, #failure>> { self.owner.#var.latest() }
            });
            let layout = behavior::formals(c, f);
            if starts.contains(&f) {
                let variant = behavior::start(f);
                let params: Vec<_> = fun.params.iter().map(|p| self.names.ty(p.ty)).collect();
                let args: Vec<_> = (0..params.len()).map(names::argument).collect();
                let inputs: Vec<_> = layout[body.entry].iter().copied().map(names::argument).collect();
                let enter = behavior::segment(f, body.entry);
                variants.push(quote!(#variant(#(#params),*)));
                arms.push(quote!(#effect::#variant(#(#args),*) => self.#var.start(cx, move |owner, cx| owner.#enter(cx, #(#inputs),*))));
            }
            if cancels.contains(&f) {
                let variant = behavior::cancel(f);
                variants.push(quote!(#variant)); arms.push(quote!(#effect::#variant => self.#var.cancel(cx)));
            }
            let mut entries = BTreeSet::from([body.entry]);
            for &b in &body.live_blocks {
                if let End::Await { resume, .. } = &fun.blocks[b].end { entries.insert(body.blocks[resume.block.as_str()]); }
            }
            for b in entries {
                let method = behavior::segment(f, b);
                let mut signature = Vec::new();
                let mut params = Vec::new();
                for &i in &layout[b] {
                    let arg = names::argument(i);
                    let ty = fun.params[i].ty;
                    let native = self.names.ty(ty);
                    signature.push(quote!(#arg: #native));
                    params.push(quote!(#arg));
                }
                for (i,p) in fun.blocks[b].params.iter().enumerate() {
                    let arg = names::parameter(i);
                    let native = self.names.ty(p.ty);
                    signature.push(quote!(#arg: #native)); params.push(quote!(#arg));
                }
                let result = behavior::task_result(ty.clone());
                let transaction = self.transaction(f, b, params);
                self.methods.push(quote! {
                    #[allow(unused_variables)] fn #method(&mut self, cx: &mut ::gpui::Context<Self>, #(#signature),*) -> #result { #transaction }
                });
            }
        }
        self.item(quote!(pub struct #facade<'a> { owner: &'a #owner }))?;
        self.item(quote!(#[allow(non_snake_case)] impl #facade<'_> { #(#fields)* }))?;
        self.methods.push(quote!(pub fn tasks(&self) -> #facade<'_> { #facade { owner: self } }));
        if !variants.is_empty() {
            self.item(quote!(enum #effect { #(#variants),* }))?;
            self.methods.push(quote!(#[allow(unused_variables)] fn __pui_effect(&mut self, effect: #effect, cx: &mut ::gpui::Context<Self>) { match effect { #(#arms),* } }));
        }
        Ok(())
    }
}
