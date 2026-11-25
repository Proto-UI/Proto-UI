use crate::check::Checked;
use crate::ir::{Binding, Source, Type};
use icu_normalizer::ComposingNormalizer;
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};
use std::collections::HashSet;

fn identifier(name: &str) -> Option<Ident> {
    if name.starts_with("r#") || (!name.is_ascii() && !ComposingNormalizer::new_nfc().is_normalized(name)) {
        return None;
    }
    if name != "gen" {
        if let Ok(ident) = syn::parse_str::<Ident>(name) {
            if ident.to_string() == name { return Some(ident); }
        }
    }
    let raw = format!("r#{name}");
    syn::parse_str::<Ident>(&raw).ok().filter(|id| id.to_string() == raw)
}

fn public(name: &str, id: &str, source: &Source) -> Result<Ident, String> {
    identifier(name).ok_or_else(|| serde_json::json!({
        "category": "backend-missing", "code": "host-name", "bindings": [id],
        "source": { "file": source.file, "start": source.start, "end": source.end },
        "message": format!("GPUI cannot expose {name:?} with its exact spelling as a Rust identifier. Use an NFC Rust identifier."),
    }).to_string())
}

/// Rust callers pass arguments by position. Preserve source names in the public
/// signature wherever possible, including when a private ID is not Rust syntax.
pub fn formal_names(params: &[Binding]) -> Vec<Ident> {
    let reserved: HashSet<_> = params.iter().map(|p| p.name.as_str()).collect();
    let mut used = HashSet::new();
    let mut serial = 0;
    params.iter().map(|p| {
        // These constructors are already in Rust's pattern namespace. A formal
        // with the same spelling would be interpreted as a pattern or rejected.
        if used.insert(&p.name) && !matches!(p.name.as_str(), "Some" | "None" | "Ok" | "Err") {
            if let Some(name) = identifier(&p.name) { return name; }
        }
        loop {
            let n = format_ident!("__pui_arg_{serial}");
            serial += 1;
            if !reserved.contains(n.to_string().as_str()) { return n; }
        }
    }).collect()
}

fn group<'a>(entries: impl Iterator<Item = (&'a str, &'a str, &'a Source)>) -> Result<Vec<Ident>, String> {
    let mut seen = HashSet::new();
    entries.map(|(name, id, source)| {
        if !seen.insert(name) { return Err(format!("{source}: invalid-ir: duplicate public name {name:?}")); }
        public(name, id, source)
    }).collect()
}

pub struct Names {
    pub component: Ident,
    pub props_type: Ident,
    pub projection: Ident,
    pub actions_type: Ident,
    pub signal: Ident,
    pub command: Ident,
    pub props: Vec<Ident>,
    pub projections: Vec<Ident>,
    pub actions: Vec<Ident>,
    pub signals: Vec<Ident>,
}

impl Names {
    pub fn new(checked: &Checked<'_>) -> Result<Self, String> {
        let ir = checked.ir;
        let component = public(&ir.name, &ir.name, &ir.source)?;
        let projections = group(ir.projections.iter().map(|p| (p.name.as_str(), p.function.as_str(), &ir.behaviors[checked.functions[p.function.as_str()]].binding.source)))?;
        let actions = group(ir.actions.iter().map(|a| (a.name.as_str(), a.function.as_str(), &ir.behaviors[checked.functions[a.function.as_str()]].binding.source)))?;
        Ok(Self {
            props_type: format_ident!("{}Props", component),
            projection: format_ident!("{}Projection", component),
            actions_type: format_ident!("{}Actions", component),
            signal: format_ident!("{}Signal", component),
            command: format_ident!("{}Command", component),
            props: group(ir.props.iter().map(|b| (b.name.as_str(), b.id.as_str(), &b.source)))?,
            signals: group(ir.signals.iter().map(|b| (b.name.as_str(), b.id.as_str(), &b.source)))?,
            projections, actions, component,
        })
    }
}

pub fn ty(t: Type) -> TokenStream {
    match t {
        Type::Bool => quote!(::core::primitive::bool), Type::Number => quote!(::core::primitive::f64),
        Type::Text => quote!(::std::string::String), Type::Unit => quote!(()),
    }
}

pub fn input_ty(t: Type) -> TokenStream {
    if t == Type::Text { quote!(&::core::primitive::str) } else { ty(t) }
}

pub fn source_doc(name: &str, source: &Source) -> String {
    // prettyplease prints documentation strings as Rust comments. A legal
    // source path or private name can contain a bare CR or a direction control.
    format!("Proto {name:?} at {:?}:{}-{}.", source.file, source.start, source.end)
}
pub fn field(n: usize) -> Ident { format_ident!("field_{n}") }
pub fn argument(n: usize) -> Ident { format_ident!("argument_{n}") }
pub fn parameter(n: usize) -> Ident { format_ident!("parameter_{n}") }
pub fn local(n: usize) -> Ident { format_ident!("local_{n}") }
pub fn pending(n: usize) -> Ident { format_ident!("pending_{n}") }
pub fn block(f: usize, b: usize) -> Ident { format_ident!("__pui_f{f}_b{b}") }
pub fn command(n: usize) -> Ident { format_ident!("Action{n}") }
