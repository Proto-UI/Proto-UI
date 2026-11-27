use crate::{check::{Checked, Result}, component::{comparison, differs}, ir::{Data, Source, Type}, names::{self, Names}};
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};
use std::collections::{BTreeMap, BTreeSet, HashSet};

pub fn case(i: usize) -> Ident { format_ident!("Case{i}") }

fn item(items: &mut Vec<syn::Item>, tokens: TokenStream, source: &Source) -> Result<()> {
    items.push(syn::parse2(tokens).map_err(|e| format!("{source}: GPUI data declaration: {e}"))?);
    Ok(())
}

pub fn declarations(checked: &Checked<'_>, n: &Names) -> Result<Vec<syn::Item>> {
    let mut items = Vec::new();
    for (i, data) in checked.unit.types.iter().enumerate() {
        let name = &n.data[i];
        let (at, changed) = match data {
            Data::Presence { value, source } => {
                let payload = n.ty(*value);
                let doc = names::source_doc("presence", source);
                item(&mut items, quote!(#[doc = #doc] #[allow(non_camel_case_types)] pub type #name = ::core::option::Option<#payload>;), source)?;
                let delta = differs(*value, quote!(*left), quote!(*right));
                (source, quote!(match (left, right) {
                    (::core::option::Option::Some(left), ::core::option::Option::Some(right)) => #delta,
                    (::core::option::Option::None, ::core::option::Option::None) => false,
                    _ => true,
                }))
            }
            Data::Record { fields, source } => {
                let doc = names::source_doc("record", source);
                let mut decls = Vec::new();
                let mut checks = Vec::new();
                for (f, member) in fields.iter().zip(&n.members[i]) {
                    let ty = n.ty(f.ty);
                    let doc = names::source_doc(&f.name, &f.source);
                    decls.push(quote!(#[doc = #doc] pub #member: #ty));
                    checks.push(differs(f.ty, quote!(left.#member), quote!(right.#member)));
                }
                item(&mut items, quote!(#[doc = #doc] #[allow(non_camel_case_types, non_snake_case)] #[derive(Clone, Debug, PartialEq)] pub struct #name { #(#decls),* }), source)?;
                let delta = if checks.is_empty() { quote!(false) } else { quote!(#(#checks)||*) };
                (source, delta)
            }
            Data::TextLiteral { value, source } => {
                let doc = names::source_doc(value, source);
                item(&mut items, quote!(#[doc = #doc] #[allow(non_camel_case_types)] #[derive(Clone, Copy, Debug, Default, PartialEq, Eq)] pub struct #name { _private: () }), source)?;
                item(&mut items, quote!(impl #name { pub const fn as_str(&self) -> &'static ::core::primitive::str { #value } }), source)?;
                (source, quote!(false))
            }
            Data::Tagged { discriminant, cases, source } => {
                let doc = names::source_doc(discriminant, source);
                let mut variants = Vec::new();
                let mut tags = Vec::new();
                let mut checks = Vec::new();
                let mut methods = Vec::new();
                let mut used = HashSet::from([String::from("kind")]);
                for (j, c) in cases.iter().enumerate() {
                    let Type::Data(p) = c.payload else { unreachable!("checked tagged payload") };
                    let Data::Record { fields, .. } = &checked.unit.types[p] else { unreachable!("checked tagged record") };
                    let tag = &c.tag;
                    let variant = case(j);
                    let payload = &n.data[p];
                    variants.push(quote!(#variant(#payload)));
                    tags.push(quote!(Self::#variant(_) => #tag));
                    let delta = comparison(p);
                    checks.push(quote!((#name::#variant(left), #name::#variant(right)) => #delta(left, right)));
                    let getter = method(&format!("as_{tag}"), "payload", j, &mut used);
                    let constructor = method(tag, "new_case", j, &mut used);
                    let fields_out = &n.members[p];
                    let args: Vec<_> = (0..fields.len()).map(names::argument).collect();
                    let params = fields.iter().zip(&args).map(|(f, a)| { let t = n.ty(f.ty); quote!(#a: #t) });
                    methods.push(quote! {
                        pub fn #constructor(#(#params),*) -> Self { Self::#variant(#payload { #(#fields_out: #args),* }) }
                        pub fn #getter(&self) -> ::core::option::Option<&#payload> {
                            match self { Self::#variant(payload) => ::core::option::Option::Some(payload), #[allow(unreachable_patterns)] _ => ::core::option::Option::None }
                        }
                    });
                }
                item(&mut items, quote!(#[doc = #doc] #[allow(non_camel_case_types)] #[derive(Clone, Debug, PartialEq)] pub enum #name { #(#variants),* }), source)?;
                item(&mut items, quote!(#[allow(non_snake_case)] impl #name {
                    pub fn kind(&self) -> &'static ::core::primitive::str { match self { #(#tags),* } }
                    #(#methods)*
                }), source)?;
                (source, quote!(match (left, right) { #(#checks,)* #[allow(unreachable_patterns)] _ => true }))
            }
        };
        let compare = comparison(i);
        item(&mut items, quote!(#[allow(dead_code, unused_variables)] fn #compare(left: &#name, right: &#name) -> ::core::primitive::bool { #changed }), at)?;
    }
    Ok(items)
}

fn method(preferred: &str, role: &str, index: usize, used: &mut HashSet<String>) -> Ident {
    if let Some(id) = names::identifier(preferred) {
        if used.insert(id.to_string()) { return id; }
    }
    let mut fresh = format!("__pui_{role}_{index}");
    while !used.insert(fresh.clone()) { fresh.push('_'); }
    format_ident!("{fresh}")
}

fn pascal(name: &str) -> String {
    let mut text = String::new();
    for part in name.split(|c: char| !c.is_alphanumeric()).filter(|p| !p.is_empty()) {
        let mut chars = part.chars();
        text.extend(chars.next().unwrap().to_uppercase());
        if part.chars().all(|c| !c.is_lowercase()) { text.extend(chars.flat_map(char::to_lowercase)); }
        else { text.extend(chars); }
    }
    text
}

/// Publish stable compiler-generated boundary names; nested payload fields keep their concrete types.
pub fn aliases(bodies: &[Checked<'_>], reached: &BTreeSet<usize>) -> Result<Vec<syn::Item>> {
    let root = &bodies[0];
    if reached.is_empty() && root.unit.keys.iter().all(|key| key.export_name.is_none()) { return Ok(Vec::new()); }
    let n = Names::new(root)?;
    let mut table = BTreeMap::new();
    let mut reserved = names::generated_types(bodies);
    reserved.extend(bodies.iter().map(|b| b.ir.name.clone()));
    let mut add = |name: String, ty: Type, id: &str, source: &Source| -> Result<()> {
        let n = names::public(&name, id, source)?;
        if reserved.contains(&n.to_string()) || table.get(&name).is_some_and(|(_, prev, _)| *prev != ty) {
            return Err(names::host_name_error(id, source, format!("Native data alias {name:?} collides with a different type.")));
        }
        table.insert(name, (n, ty, names::source_doc(id, source)));
        Ok(())
    };
    for key in &root.unit.keys {
        if let Some(name) = &key.export_name { add(format!("{}Value", pascal(name)), key.binding.ty, &key.binding.id, &key.binding.source)?; }
    }
    for &index in reached {
        let e = &root.unit.externs[index];
        let base = format!("{}Result", pascal(&e.binding.name));
        add(base.clone(), e.binding.ty, &e.binding.id, &e.binding.source)?;
        let Type::Data(i) = e.binding.ty else { continue; };
        let Data::Tagged { cases, .. } = &root.unit.types[i] else { continue; };
        for (j,c) in cases.iter().enumerate() {
            let mut suffix = pascal(&c.tag);
            if suffix.is_empty() { suffix = format!("Case{j}"); }
            let payload = format!("{base}{suffix}");
            add(payload.clone(), c.payload, &e.binding.id, &c.source)?;
            let Type::Data(p) = c.payload else { unreachable!("checked tagged payload") };
            let Data::Record { fields, .. } = &root.unit.types[p] else { unreachable!("checked tagged record") };
            for f in fields.iter().filter(|f| matches!(f.ty, Type::Data(_))) {
                add(format!("{payload}{}", pascal(&f.name)), f.ty, &e.binding.id, &f.source)?;
            }
        }
    }
    let mut out = Vec::new();
    for (_, (alias, ty, doc)) in table { let ty = n.ty(ty); item(&mut out, quote!(#[doc = #doc] pub type #alias = #ty;), &root.ir.source)?; }
    Ok(out)
}
