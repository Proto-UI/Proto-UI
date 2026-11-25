use crate::check::{Checked, Facts, Place};
use crate::ir::*;
use crate::names::{self, Names};
use proc_macro2::{Ident, Span, TokenStream};
use quote::{format_ident, quote};
use std::collections::HashMap;

pub fn data(p: Place) -> Ident {
    match p { Place::Prop(i) => format_ident!("input_p{i}"), Place::Field(i) => format_ident!("input_f{i}"), Place::Context(i) => format_ident!("input_c{i}") }
}

/// The immutable parameters are exactly the reached reads. A writable location is
/// passed once as a typed pending write, shared by every ordinary action helper.
fn environment(
    facts: &Facts,
    read: impl Fn(Place) -> TokenStream,
    write: impl Fn(usize) -> TokenStream,
    signals: TokenStream,
) -> Vec<TokenStream> {
    let mut args: Vec<_> = facts.inputs().map(read).collect();
    args.extend(facts.writes.iter().copied().map(write));
    if !facts.signals.is_empty() { args.push(signals); }
    args
}

pub fn entry_call(
    checked: &Checked<'_>, f: usize, args: Vec<TokenStream>, read: impl Fn(Place) -> TokenStream,
    write: impl Fn(usize) -> TokenStream, signals: TokenStream,
) -> TokenStream {
    let body = &checked.bodies[f];
    let name = names::block(f, body.entry);
    let env = environment(&body.facts, read, write, signals);
    quote!(Self::#name(#(#args,)* #(#env),*))
}

struct Expression { code: TokenStream, ty: Type, owns_value: bool }
impl Expression {
    fn owned(self) -> TokenStream {
        let code = self.code;
        match (self.ty, self.owns_value) {
            (Type::Text, false) => quote!(::std::string::String::from(#code)),
            (Type::Tokens | Type::Data(_), false) => quote!(::core::clone::Clone::clone(#code)),
            _ => code,
        }
    }
    fn argument(self) -> TokenStream {
        if self.owns_value { names::as_input(self.ty, self.code) } else { self.code }
    }
}

fn literal(v: &Value) -> Expression {
    let (code, ty, owns_value) = match v {
        Value::Bool { value } => (quote!(#value), Type::Bool, false),
        Value::Number { bits } => {
            let number = syn::LitInt::new(&format!("0x{bits}_u64"), Span::call_site());
            (quote!(::core::primitive::f64::from_bits(#number)), Type::Number, false)
        }
        Value::Text { value } => (quote!(#value), Type::Text, false),
        Value::Tokens { values } => (quote!({
            static TOKENS: &[::gpui::SharedString] = &[#(::gpui::SharedString::new_static(#values)),*];
            ::gpui::ArcCow::Borrowed(TOKENS)
        }), Type::Tokens, true),
        _ => unreachable!("validated literal"),
    };
    Expression { code, ty, owns_value }
}

pub fn schema_default(v: &Value) -> TokenStream { literal(v).owned() }

// A move is valid when this entire instruction is the last, single use. Multiple
// operands of one call may hold a borrow until the last argument has evaluated.
fn count_uses<'a>(block: &'a Block) -> HashMap<&'a str, usize> {
    let mut counts = HashMap::new();
    let mut values = Vec::new();
    for step in &block.instructions {
        match step {
            Instruction::Let { value, .. } | Instruction::Write { value, .. } | Instruction::Emit { value, .. } => values.push(value),
            Instruction::Invoke { args, .. } => values.extend(args),
        }
    }
    match &block.end {
        End::Return { value, .. } => values.extend(value),
        End::Fail { .. } => {},
        End::Jump { to, .. } => values.extend(&to.args),
        End::Branch { condition, yes, no, .. } => { values.push(condition); values.extend(&yes.args); values.extend(&no.args); }
        End::Presence { value, present, omitted, .. } => { values.push(value); values.extend(&present.args); values.extend(&omitted.args); }
    }
    while let Some(v) = values.pop() {
        match v {
            Value::Local { id } => *counts.entry(id.as_str()).or_insert(0) += 1,
            Value::Not { value } | Value::HasValue { value } | Value::Member { value, .. } => values.push(value),
            Value::Record { fields, .. } => values.extend(fields.iter().map(|f| &f.value)),
            Value::Binary { left, right, .. } => { values.push(left); values.push(right); }
            Value::Call { args, .. } => values.extend(args),
            _ => {},
        }
    }
    counts
}

struct Lower<'c, 'a> {
    checked: &'c Checked<'a>, names: &'c Names, f: usize,
    locals: HashMap<&'a str, (Ident, Type, bool)>, uses: HashMap<&'a str, usize>,
    consumed: Vec<&'a str>,
}

impl<'c, 'a> Lower<'c, 'a> {
    fn read(&self, p: Place) -> TokenStream {
        if let Place::Field(i) = p {
            if self.checked.bodies[self.f].facts.writes.contains(&i) {
                let slot = names::pending(i);
                return quote!(#slot.read());
            }
        }
        let name = data(p);
        quote!(#name)
    }

    fn value(&mut self, value: &Value) -> Expression {
        let (code, ty, owns_value) = match value {
            Value::Bool { .. } | Value::Number { .. } | Value::Text { .. } | Value::Tokens { .. } => return literal(value),
            Value::Record { ty: Type::Data(i), fields } => {
                let mut values = Vec::with_capacity(fields.len());
                for field in fields {
                    let v = self.value(&field.value).owned();
                    let n = &self.names.members[*i][self.checked.members[*i][field.name.as_str()]];
                    values.push(quote!(#n: #v));
                }
                let record = &self.names.data[*i];
                (quote!(#record { #(#values),* }), Type::Data(*i), true)
            }
            Value::Record { .. } => unreachable!("checked record"),
            Value::Member { value, field } => {
                let base = self.value(value);
                let Type::Data(i) = base.ty else { unreachable!("checked record") };
                let Data::Record { fields, .. } = &self.checked.unit.types[i] else { unreachable!("checked record") };
                let j = self.checked.members[i][field.as_str()];
                let n = &self.names.members[i][j];
                let ty = fields[j].ty;
                let code = base.code;
                let selected = quote!((#code).#n);
                if base.owns_value { (selected, ty, true) } else { (names::as_input(ty, selected), ty, false) }
            }
            Value::HasValue { value } => {
                let value = self.value(value).code;
                (quote!((#value).is_some()), Type::Bool, false)
            }
            Value::Prop { id } | Value::Capture { id } | Value::State { id } | Value::Context { id } => {
                let p = self.checked.places[id.as_str()];
                let ty = self.checked.binding(p).ty;
                let read = self.read(p);
                let value = match ty {
                    Type::Text => quote!((#read).as_str()),
                    Type::Tokens | Type::Data(_) => read,
                    _ => quote!(*#read),
                };
                (value, ty, false)
            }
            Value::Local { id } => {
                let (&key, (name, ty, owned)) = self.locals.get_key_value(id.as_str()).expect("validated local");
                let last = self.uses.get(key) == Some(&1);
                self.consumed.push(key);
                if matches!(ty, Type::Text | Type::Tokens | Type::Data(_)) && *owned && !last { (names::as_input(*ty, quote!(#name)), *ty, false) }
                else { (quote!(#name), *ty, *owned) }
            }
            Value::Not { value } => {
                let v = self.value(value).code;
                (quote!(!(#v)), Type::Bool, false)
            }
            Value::Binary { op, left, right } => {
                let a = self.value(left);
                let b = self.value(right);
                if matches!(op, Op::Concat) {
                    let rhs = b.argument();
                    if a.owns_value {
                        let lhs = a.code;
                        (quote!((#lhs) + (#rhs)), Type::Text, true)
                    } else {
                        let lhs = a.argument();
                        (quote!([#lhs, #rhs].concat()), Type::Text, true)
                    }
                } else {
                    let lhs = a.argument();
                    let rhs = b.argument();
                    match op {
                        Op::Equal => (quote!((#lhs) == (#rhs)), Type::Bool, false),
                        Op::Add => (quote!((#lhs) + (#rhs)), Type::Number, false),
                        Op::Multiply => (quote!((#lhs) * (#rhs)), Type::Number, false),
                        Op::Concat => unreachable!("concatenation handled above"),
                    }
                }
            }
            Value::Call { function, args } => {
                let f = self.checked.functions[function.as_str()];
                let args = args.iter().map(|v| self.value(v).argument()).collect();
                let code = self.call(f, args);
                let ty = self.checked.ir.behaviors[f].binding.ty;
                (code, ty, matches!(ty, Type::Text | Type::Tokens | Type::Data(_)))
            }
        };
        Expression { code, ty, owns_value }
    }

    fn call(&self, target: usize, args: Vec<TokenStream>) -> TokenStream {
        entry_call(self.checked, target, args, |p| self.read(p), |i| { let n = names::pending(i); quote!(#n) }, quote!(signals))
    }

    fn edge(&mut self, to: &Edge, payload: Option<TokenStream>) -> TokenStream {
        let body = &self.checked.bodies[self.f];
        let dst = names::block(self.f, body.blocks[to.block.as_str()]);
        let args: Vec<_> = (0..self.checked.ir.behaviors[self.f].params.len()).map(names::argument).collect();
        // Edge values are evaluated in their original scope before the successor can write.
        let transferred: Vec<_> = payload.into_iter().chain(to.args.iter().map(|v| self.value(v).owned())).collect();
        let facts = &self.checked.bodies[self.f].facts;
        let env = environment(facts, |p| { let n = data(p); quote!(#n) }, |i| { let n = names::pending(i); quote!(#n) }, quote!(signals));
        quote!(Self::#dst(#(#args,)* #(#transferred,)* #(#env),*))
    }

    fn instruction(&mut self, index: usize, step: &'a Instruction) -> TokenStream {
        match step {
            Instruction::Let { binding, value, .. } => {
                let expr = self.value(value).owned();
                let n = names::local(index);
                let ty = self.names.ty(binding.ty);
                self.locals.insert(&binding.id, (n.clone(), binding.ty, true));
                quote!(let #n: #ty = #expr;)
            }
            Instruction::Write { target, value, .. } => {
                let Place::Field(i) = self.checked.places[target.as_str()] else { unreachable!("checked writable field") };
                let slot = names::pending(i);
                let value = self.value(value).owned();
                quote!({ let next = #value; #slot.write(next); })
            }
            Instruction::Emit { target, value, .. } => {
                let value = self.value(value).owned();
                let ty = &self.names.signal;
                let member = &self.names.signals[self.checked.signals[target.as_str()]];
                quote!(signals.push(#ty::#member(#value));)
            }
            Instruction::Invoke { function, args, .. } => {
                let callee = self.checked.functions[function.as_str()];
                let mut snapshots = Vec::new();
                let mut actuals = Vec::new();
                for (i, arg) in args.iter().enumerate() {
                    let value = self.value(arg);
                    // A borrowed value in a location writable by the callee must keep its
                    // argument-time value while the helper runs on the same pending write.
                    let mut origin = arg;
                    while let Value::Member { value, .. } = origin { origin = value; }
                    let aliases_write = matches!(origin, Value::State { id } if matches!(self.checked.places[id.as_str()], Place::Field(j) if self.checked.bodies[callee].facts.writes.contains(&j)));
                    if matches!(value.ty, Type::Text | Type::Tokens | Type::Data(_)) && aliases_write {
                        let snapshot = format_ident!("snapshot_{i}");
                        let ty = value.ty;
                        let value = value.owned();
                        snapshots.push(quote!(let #snapshot = #value;));
                        actuals.push(names::as_input(ty, quote!(#snapshot)));
                    } else { actuals.push(value.argument()); }
                }
                let call = self.call(callee, actuals);
                let propagate = self.checked.bodies[callee].facts.fallible.then(|| quote!(?));
                quote!({ #(#snapshots)* let _ = #call #propagate; })
            }
        }
    }

    fn end(&mut self, end: &End) -> TokenStream {
        match end {
            End::Return { value, .. } => {
                let value = value.as_ref().map(|v| self.value(v).owned()).unwrap_or_else(|| quote!(()));
                if self.checked.bodies[self.f].facts.fallible { quote!(::core::result::Result::Ok(#value)) } else { value }
            }
            End::Fail { reason, source } => {
                let Source { file, start, end } = source;
                quote!(::core::result::Result::Err(::proto_ui_gpui_support::SegmentFailure { reason: #reason, file: #file, start: #start, end: #end }))
            }
            End::Jump { to, .. } => self.edge(to, None),
            End::Branch { condition, yes, no, .. } => {
                let cond = self.value(condition).code;
                let yes = self.edge(yes, None);
                let no = self.edge(no, None);
                quote!(if #cond { #yes } else { #no })
            }
            End::Presence { value, present, omitted, .. } => {
                let input = self.value(value);
                let code = input.code;
                let payload = if input.owns_value { quote!(payload) } else { quote!(::core::clone::Clone::clone(payload)) };
                let some = self.edge(present, Some(payload));
                let none = self.edge(omitted, None);
                quote!(match #code { ::core::option::Option::Some(payload) => #some, ::core::option::Option::None => #none })
            }
        }
    }
}

pub fn methods(checked: &Checked<'_>, names: &Names) -> Vec<TokenStream> {
    let mut methods = Vec::new();
    for &f in &checked.reached {
        let behavior = &checked.ir.behaviors[f];
        let body = &checked.bodies[f];
        let facts = &body.facts;
        for &b in &body.live_blocks {
            let block = &behavior.blocks[b];
            let name = names::block(f, b);
            let mut lower = Lower { checked, names, f, locals: HashMap::new(), uses: count_uses(block), consumed: Vec::new() };
            let mut params = Vec::new();
            for (i, p) in behavior.params.iter().enumerate() {
                let n = names::argument(i);
                let ty = names.input_ty(p.ty);
                params.push(quote!(#n: #ty));
                lower.locals.insert(&p.id, (n, p.ty, false));
            }
            for (i, p) in block.params.iter().enumerate() {
                let n = names::parameter(i);
                let ty = names.ty(p.ty);
                params.push(quote!(#n: #ty));
                lower.locals.insert(&p.id, (n, p.ty, true));
            }
            let signal = &names.signal;
            params.extend(environment(facts, |p| { let n = data(p); let ty = names.ty(checked.binding(p).ty); quote!(#n: &#ty) },
                |i| { let n = names::pending(i); let ty = names.ty(checked.ir.fields[i].binding.ty); quote!(#n: &mut ::proto_ui_gpui_support::PendingWrite<'_, #ty>) },
                quote!(signals: &mut ::std::vec::Vec<#signal>)));
            let mut steps = Vec::new();
            for (index, instruction) in block.instructions.iter().enumerate() {
                steps.push(lower.instruction(index, instruction));
                for id in lower.consumed.drain(..) {
                    if let Some(remaining) = lower.uses.get_mut(id) { *remaining -= 1; }
                }
            }
            let end = lower.end(&block.end);
            let ty = names.ty(behavior.binding.ty);
            let result = if facts.fallible { quote!(::core::result::Result<#ty, ::proto_ui_gpui_support::SegmentFailure>) } else { ty };
            let doc = names::source_doc(&behavior.binding.name, block.end.source());
            methods.push(quote! {
                #[doc = #doc]
                #[allow(unused_variables)]
                fn #name(#(#params),*) -> #result { #(#steps)* #end }
            });
        }
    }
    methods
}
