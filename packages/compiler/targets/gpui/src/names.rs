use crate::check::Checked;
use crate::ir::{Binding, Data, Source, Type};
use icu_normalizer::ComposingNormalizer;
use proc_macro2::{Ident, TokenStream};
use quote::{format_ident, quote};
use std::collections::HashSet;

pub fn identifier(name: &str) -> Option<Ident> {
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

pub fn public(name: &str, id: &str, source: &Source) -> Result<Ident, String> {
    identifier(name).ok_or_else(|| host_name_error(id, source, format!("GPUI cannot expose {name:?} with its exact spelling as a Rust identifier. Use an NFC Rust identifier.")))
}

pub fn host_name_error(id: &str, source: &Source, message: String) -> String {
    serde_json::json!({
        "category": "backend-missing", "code": "host-name", "bindings": [id],
        "source": { "file": source.file, "start": source.start, "end": source.end },
        "message": message,
    }).to_string()
}

pub fn generated_types(bodies: &[Checked<'_>]) -> HashSet<String> {
    let root = &bodies[0];
    let mut generated = HashSet::new();
    if root.links.scoped { generated.extend(["ContextScope".to_owned(), "MissingContext".to_owned()]); }
    if !root.unit.keys.is_empty() { generated.insert("ScopeKey".to_owned()); }
    if root.links.children.iter().any(|sites| sites.len() > 1) { generated.insert("ChildKeyConflict".to_owned()); }
    for i in 0..root.unit.keys.len() { generated.insert(crate::context::marker(i).to_string()); }
    for i in 0..root.unit.types.len() { generated.insert(format!("{}Data{i}", root.ir.name)); }
    for b in bodies {
        let n = &b.ir.name;
        generated.extend([format!("{n}Props"), format!("{n}Projection")]);
        if !b.ir.signals.is_empty() { generated.insert(format!("{n}Signal")); }
        if !b.ir.actions.is_empty() { generated.insert(format!("{n}Actions")); }
        if crate::component::transactional(b) { generated.insert(format!("{n}Command")); }
        if !b.tasks.is_empty() { generated.extend([format!("{n}Tasks"), format!("{n}CommittedEffect")]); }
        if b.ir.props.iter().any(|p| p.control_mode.is_some()) { generated.insert(format!("{n}InputError")); }
    }
    generated
}

pub fn check_linked_names(bodies: &[Checked<'_>]) -> Result<(), String> {
    let generated = generated_types(bodies);
    for b in bodies {
        if generated.contains(&b.ir.name) {
            return Err(host_name_error(&b.ir.id, &b.ir.source, format!("The linked component {:?} and a generated GPUI type need the same Rust identifier. Give the component a distinct export name.", b.ir.name)));
        }
    }
    Ok(())
}

/// Rust callers pass arguments by position. Preserve source names in the public
/// signature wherever possible, including when a private ID is not Rust syntax.
pub fn formal_names<'a>(params: impl Iterator<Item = &'a Binding> + Clone) -> Vec<Ident> {
    let reserved: HashSet<_> = params.clone().map(|p| p.name.as_str()).collect();
    let mut used = HashSet::new();
    let mut serial = 0;
    params.map(|p| {
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
    pub input_error: Ident,
    pub data: Vec<Ident>,
    pub members: Vec<Vec<Ident>>,
    pub props: Vec<Ident>,
    pub projections: Vec<Ident>,
    pub actions: Vec<Ident>,
    pub signals: Vec<Ident>,
}

impl Names {
    pub fn new(checked: &Checked<'_>) -> Result<Self, String> {
        let ir = checked.ir;
        let component = public(&ir.name, &ir.id, &ir.source)?;
        let projections = group(ir.projections.iter().map(|p| (p.name.as_str(), p.function.as_str(), &ir.behaviors[checked.functions[p.function.as_str()]].binding.source)))?;
        let actions = group(ir.actions.iter().map(|a| (a.name.as_str(), a.function.as_str(), &ir.behaviors[checked.functions[a.function.as_str()]].binding.source)))?;
        let mut members = Vec::with_capacity(checked.unit.types.len());
        let root = &checked.unit.bodies[0];
        let shared_owner = public(&root.name, &root.id, &root.source)?;
        for (index, data) in checked.unit.types.iter().enumerate() {
            let mut native_fields = Vec::new();
            if let Data::Record { fields, .. } = data {
                for field in fields { native_fields.push(public(&field.name, &format!("data:{index}.{}", field.name), &field.source)?); }
            }
            members.push(native_fields);
        }
        Ok(Self {
            props_type: format_ident!("{}Props", component),
            projection: format_ident!("{}Projection", component),
            actions_type: format_ident!("{}Actions", component),
            signal: format_ident!("{}Signal", component),
            command: format_ident!("{}Command", component),
            input_error: format_ident!("{}InputError", component),
            data: (0..checked.unit.types.len()).map(|i| format_ident!("{}Data{i}", shared_owner)).collect(),
            members,
            props: group(ir.props.iter().map(|p| { let b = &p.binding; (b.name.as_str(), b.id.as_str(), &b.source) }))?,
            signals: group(ir.signals.iter().map(|b| (b.name.as_str(), b.id.as_str(), &b.source)))?,
            projections, actions, component,
        })
    }

    pub fn ty(&self, t: Type) -> TokenStream {
        match t {
            Type::Bool => quote!(::core::primitive::bool), Type::Number => quote!(::core::primitive::f64),
            Type::Text => quote!(::std::string::String), Type::Unit => quote!(()),
            Type::Tokens => quote!(::gpui::ArcCow<'static, [::gpui::SharedString]>),
            Type::Data(i) => { let n = &self.data[i]; quote!(#n) }
        }
    }

    pub fn input_ty(&self, t: Type) -> TokenStream {
        let native = self.ty(t);
        match t {
            Type::Text => quote!(&::core::primitive::str),
            Type::Tokens | Type::Data(_) => quote!(&#native),
            _ => native,
        }
    }
}

pub fn as_input(t: Type, value: TokenStream) -> TokenStream {
    match t {
        Type::Text => quote!((#value).as_str()),
        Type::Tokens | Type::Data(_) => quote!(&(#value)),
        _ => value,
    }
}

pub fn source_doc(name: &str, source: &Source) -> String {
    // prettyplease prints documentation strings as Rust comments. A legal
    // source path or private name can contain a bare CR or a direction control.
    format!("Proto {name:?} at {:?}:{}-{}.", source.file, source.start, source.end)
}
pub fn field(n: usize) -> Ident { format_ident!("field_{n}") }
pub fn context(n: usize) -> Ident { format_ident!("context_{n}") }
pub fn argument(n: usize) -> Ident { format_ident!("argument_{n}") }
pub fn parameter(n: usize) -> Ident { format_ident!("parameter_{n}") }
pub fn local(n: usize) -> Ident { format_ident!("local_{n}") }
pub fn pending(n: usize) -> Ident { format_ident!("pending_{n}") }
pub fn block(f: usize, b: usize) -> Ident { format_ident!("__pui_f{f}_b{b}") }
pub fn command(n: usize) -> Ident { format_ident!("Action{n}") }
