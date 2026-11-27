use crate::{check::{Checked, Result}, ir::{End, Instruction, Source}, names};
use proc_macro2::Ident;
use quote::{format_ident, quote};
use std::{collections::{BTreeMap, BTreeSet, VecDeque}, ffi::OsString};

pub fn ident(unit: &crate::ir::Unit, i: usize) -> Ident {
    let mut name = format!("__pui_native_extern_{i}");
    while unit.keys.iter().any(|k| k.export_name.as_ref() == Some(&name)) { name.push('_'); }
    format_ident!("{name}")
}

pub fn arguments(args: impl IntoIterator<Item = OsString>) -> Result<BTreeMap<String, String>> {
    let mut registrations = BTreeMap::new();
    let mut args = args.into_iter();
    while let Some(flag) = args.next() {
        if flag != "--extern" { return Err("native GPUI generator accepts repeated --extern NAME PATH arguments".into()); }
        let mut next = || args.next().and_then(|s| s.into_string().ok()).ok_or_else(|| "--extern requires a UTF-8 registration name and Rust path".to_owned());
        let name = next()?;
        if registrations.insert(name.clone(), next()?).is_some() { return Err(format!("duplicate native extern registration {name:?}")); }
    }
    Ok(registrations)
}

fn diagnostic(c: &Checked<'_>, site: usize, external: &str, at: &Source, code: &str, message: String) -> String {
    let mut parent = vec![None; c.bodies.len()];
    let mut queue: VecDeque<_> = c.actions.iter().copied().collect();
    for &f in &queue { parent[f] = Some(f); }
    while let Some(f) = queue.pop_front() {
        if f == site { break; }
        let body = &c.bodies[f];
        let starts = body.live_blocks.iter().flat_map(|&b| &c.ir.behaviors[f].blocks[b].instructions)
            .filter_map(|i| match i { Instruction::Start { task, .. } => Some(c.functions[task.as_str()]), _ => None });
        for next in body.facts.calls.iter().copied().chain(starts) {
            if parent[next].is_none() { parent[next] = Some(f); queue.push_back(next); }
        }
    }
    let mut bindings = vec![external];
    let mut f = site;
    loop {
        bindings.push(c.ir.behaviors[f].binding.id.as_str());
        let Some(next) = parent[f].filter(|&next| next != f) else { break; };
        f = next;
    }
    bindings.push(&c.ir.id); bindings.reverse();
    let category = if code == "extern-unbound" { code } else { "backend-missing" };
    serde_json::json!({"category":category, "code":code, "source":{"file":at.file,"start":at.start,"end":at.end}, "bindings":bindings, "message":message}).to_string()
}

pub fn bindings(bodies: &[Checked<'_>], registrations: &BTreeMap<String,String>) -> Result<(BTreeSet<usize>,Vec<syn::Item>)> {
    let mut reached = BTreeSet::new();
    let mut natives = Vec::new();
    if bodies.iter().all(|b| b.tasks.is_empty()) { return Ok((reached, natives)); }
    let types = names::Names::new(&bodies[0])?;
    for body in bodies {
        for &f in &body.reached {
            let function = &body.ir.behaviors[f];
            for &b in &body.bodies[f].live_blocks {
                let End::Await { external, source, .. } = &function.blocks[b].end else { continue; };
                let i = body.links.externs[external.as_str()];
                if !reached.insert(i) { continue; }
                let e = &body.unit.externs[i];
                let path = registrations.get(&e.name).filter(|_| e.targets.iter().any(|t| t == "gpui"))
                    .ok_or_else(|| diagnostic(body, f, external, source, "extern-unbound", format!("Reached external operation {:?} requires a registered GPUI target function.", e.name)))?;
                let p = syn::parse_str::<syn::Path>(path).ok().filter(|p| !p.segments.is_empty() && p.segments.iter().all(|s| matches!(s.arguments, syn::PathArguments::None)))
                    .ok_or_else(|| diagnostic(body, f, external, source, "host-name", format!("GPUI external {:?} needs a Rust function path without generic arguments, received {path:?}.", e.name)))?;
                let alias = ident(body.unit, i);
                let args = e.params.iter().map(|p| types.ty(p.ty));
                let result = types.ty(e.binding.ty);
                natives.push(syn::parse2(quote! {
                    #[allow(non_upper_case_globals)] const #alias: fn(#(#args,)* &mut ::gpui::AsyncApp) -> ::proto_ui_gpui_support::owned_tasks::TaskOperation<#result> = #p;
                }).map_err(|e| format!("{source}: GPUI extern function binding: {e}"))?);
            }
        }
    }
    Ok((reached, natives))
}
