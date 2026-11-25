use crate::check::{Checked, Facts, Place};
use crate::ir::*;
use crate::names::{self, Names};
use proc_macro2::{Ident, Span, TokenStream};
use quote::{format_ident, quote};
use std::collections::{BTreeSet, HashMap};

pub fn data(p: Place) -> Ident {
    match p { Place::Prop(i) => format_ident!("input_p{i}"), Place::Field(i) => format_ident!("input_f{i}"), Place::Context(i) => format_ident!("input_c{i}") }
}

/// The immutable parameters are exactly the reached reads. A writable location is
/// passed once as a typed pending write, shared by every ordinary action helper.
fn environment(
    checked: &Checked<'_>, facts: &Facts,
    read: impl Fn(Place) -> TokenStream,
    write: impl Fn(usize) -> TokenStream,
    signals: TokenStream,
) -> Vec<TokenStream> {
    let mut args: Vec<_> = facts.inputs().map(read).collect();
    args.extend(facts.writes.iter().copied().map(write));
    if effects(checked, facts) { args.push(signals); }
    args
}

pub fn entry_call(
    checked: &Checked<'_>, f: usize, args: Vec<TokenStream>, read: impl Fn(Place) -> TokenStream,
    write: impl Fn(usize) -> TokenStream, signals: TokenStream,
) -> TokenStream {
    block_call(checked, f, checked.bodies[f].entry, args, read, write, signals)
}

pub fn block_call(
    checked: &Checked<'_>, f: usize, b: usize, args: Vec<TokenStream>, read: impl Fn(Place) -> TokenStream,
    write: impl Fn(usize) -> TokenStream, signals: TokenStream,
) -> TokenStream {
    let body = &checked.bodies[f];
    let name = names::block(f, b);
    let env = environment(checked, &body.facts, read, write, signals);
    quote!(Self::#name(#(#args,)* #(#env),*))
}

struct Expression { code: TokenStream, ty: Type, owns_value: bool }
impl Expression {
    fn borrowed(ty: Type, reference: TokenStream) -> Self {
        let code = match ty {
            Type::Text => quote!((#reference).as_str()),
            Type::Tokens | Type::Data(_) => reference,
            _ => quote!(*#reference),
        };
        Self { code, ty, owns_value: false }
    }
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
            Instruction::Invoke { args, .. } | Instruction::Start { args, .. } => values.extend(args),
            Instruction::Cancel { .. } => {},
        }
    }
    match &block.end {
        End::Return { value, .. } => values.extend(value),
        End::Fail { .. } => {},
        End::Jump { to, .. } => values.extend(&to.args),
        End::Branch { condition, yes, no, .. } => { values.push(condition); values.extend(&yes.args); values.extend(&no.args); }
        End::Presence { value, present, omitted, .. } => { values.push(value); values.extend(&present.args); values.extend(&omitted.args); }
        End::Match { value, cases, .. } => { values.push(value); for case in cases { values.extend(&case.to.args); } }
        End::Await { args, resume, .. } => { values.extend(args); values.extend(&resume.args); }
    }
    while let Some(v) = values.pop() {
        match v {
            Value::Local { id } => *counts.entry(id.as_str()).or_insert(0) += 1,
            Value::Not { value } | Value::HasValue { value } | Value::Member { value, .. } | Value::WidenText { value } | Value::Tag { value } | Value::Tagged { payload: value, .. } => values.push(value),
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
    layout: &'c [Vec<usize>],
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
            Value::LiteralText { ty } => { let t = self.names.ty(*ty); (quote!(<#t as ::core::default::Default>::default()), *ty, true) }
            Value::WidenText { value } => { let v = self.value(value).code; (quote!((#v).as_str()), Type::Text, false) }
            Value::Tag { value } => { let v = self.value(value).code; (quote!((#v).kind()), Type::Text, false) }
            Value::Tagged { ty: Type::Data(i), tag, payload } => {
                let v = self.value(payload).owned();
                let name = &self.names.data[*i];
                let variant = self.case(*i, tag);
                (quote!(#name::#variant(#v)), Type::Data(*i), true)
            }
            Value::Tagged { .. } => unreachable!("checked tagged type"),
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
                return Expression::borrowed(ty, self.read(p));
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

    fn case(&self, i: usize, name: &str) -> Ident {
        let Data::Tagged { cases, .. } = &self.checked.unit.types[i] else { unreachable!("checked tagged value") };
        crate::native_data::case(cases.iter().position(|c| c.tag == name).expect("checked tag"))
    }

    fn edge(&mut self, to: &Edge, payload: Option<Expression>) -> TokenStream {
        let body = &self.checked.bodies[self.f];
        let dst = names::block(self.f, body.blocks[to.block.as_str()]);
        let args: Vec<_> = self.layout[body.blocks[to.block.as_str()]].iter().copied().map(names::argument).collect();
        // Edge values are evaluated in their original scope before the successor can write.
        let phase = self.checked.ir.behaviors[self.f].phase;
        let pure = matches!(phase, Phase::Pure | Phase::Init);
        let transferred: Vec<_> = payload.into_iter().chain(to.args.iter().map(|v| self.value(v)))
            .map(|v| if pure { v.argument() } else { v.owned() }).collect();
        let facts = &self.checked.bodies[self.f].facts;
        let env = environment(self.checked, facts, |p| { let n = data(p); quote!(#n) }, |i| { let n = names::pending(i); quote!(#n) }, quote!(signals));
        if phase != Phase::Task || args.is_empty() || transferred.is_empty() {
            return quote!(Self::#dst(#(#args,)* #(#transferred,)* #(#env),*));
        }
        // Explicit edge operands can read an owned formal transferred by the same edge.
        let values: Vec<_> = (0..transferred.len()).map(|i| format_ident!("edge_value_{i}")).collect();
        quote!({ #(let #values = #transferred;)* Self::#dst(#(#args,)* #(#values,)* #(#env),*) })
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
                let value = quote!(#ty::#member(#value));
                if self.checked.tasks.is_empty() { quote!(signals.push(#value);) }
                else { let effect = effect_type(self.names); quote!(signals.push(#effect::Signal(#value));) }
            }
            Instruction::Start { task, args, .. } => {
                let effect = effect_type(self.names);
                let start = start(self.checked.functions[task.as_str()]);
                let args: Vec<_> = args.iter().map(|v| self.value(v).owned()).collect();
                quote!(signals.push(#effect::#start(#(#args),*));)
            }
            Instruction::Cancel { task, .. } => {
                let target = self.checked.functions[task.as_str()];
                if !self.checked.tasks.contains(&target) { return TokenStream::new(); }
                let effect = effect_type(self.names);
                let variant = cancel(target);
                quote!(signals.push(#effect::#variant);)
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
                if self.checked.ir.behaviors[self.f].phase == Phase::Task {
                    quote!(::core::result::Result::Ok(::proto_ui_gpui_support::owned_tasks::TaskStep::complete(#value)))
                } else if self.checked.bodies[self.f].facts.fallible { quote!(::core::result::Result::Ok(#value)) } else { value }
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
                let ty = self.checked.payload(input.ty).expect("checked presence");
                let payload = if input.owns_value { Expression { code: quote!(payload), ty, owns_value: true } } else { Expression::borrowed(ty, quote!(payload)) };
                let some = self.edge(present, Some(payload));
                let none = self.edge(omitted, None);
                quote!(match #code { ::core::option::Option::Some(payload) => #some, ::core::option::Option::None => #none })
            }
            End::Match { value, cases, .. } => {
                let input = self.value(value);
                let Type::Data(i) = input.ty else { unreachable!("checked match domain") };
                let name = &self.names.data[i];
                let code = input.code;
                let mut arms = Vec::new();
                for c in cases {
                    let variant = self.case(i, &c.tag);
                    let destination = self.checked.bodies[self.f].blocks[c.to.block.as_str()];
                    let ty = self.checked.ir.behaviors[self.f].blocks[destination].params[0].ty;
                    let payload = if input.owns_value { Expression { code: quote!(payload), ty, owns_value: true } } else { Expression::borrowed(ty, quote!(payload)) };
                    let target = self.edge(&c.to, Some(payload));
                    arms.push(quote!(#name::#variant(payload) => #target));
                }
                quote!(match #code { #(#arms),* })
            }
            End::Await { external, args, resume, .. } => self.suspend(external, args, resume),
        }
    }

    fn suspend(&mut self, external: &str, args: &[Value], resume: &Edge) -> TokenStream {
        let host = crate::externs::ident(self.checked.unit, self.checked.links.externs[external]);
        let b = self.checked.bodies[self.f].blocks[resume.block.as_str()];
        let entry = segment(self.f, b);
        let mut snapshots = Vec::new();
        let mut call = Vec::new();
        for (i, arg) in args.iter().enumerate() {
            let name = format_ident!("host_arg_{i}");
            let value = self.value(arg).owned();
            snapshots.push(quote!(let #name = #value;)); call.push(name);
        }
        let retained: Vec<_> = self.layout[b].iter().copied().map(names::argument).collect();
        let mut edge = Vec::new();
        for (i, arg) in resume.args.iter().enumerate() {
            let name = format_ident!("across_await_{i}");
            let value = self.value(arg).owned();
            snapshots.push(quote!(let #name = #value;)); edge.push(name);
        }
        quote!({
            #(#snapshots)*
            ::core::result::Result::Ok(::proto_ui_gpui_support::owned_tasks::TaskStep::awaiting(
                move |app| super::#host(#(#call,)* app),
                move |owner: &mut Self, cx, result| owner.#entry(cx, #(#retained,)* result, #(#edge),*),
            ))
        })
    }
}

pub fn effect_type(n: &Names) -> Ident { format_ident!("{}CommittedEffect", n.component) }
pub fn effects(c: &Checked<'_>, facts: &Facts) -> bool { !facts.signals.is_empty() || (facts.task_effects && !c.tasks.is_empty()) }
pub fn start(f: usize) -> Ident { format_ident!("Start{f}") }
pub fn cancel(f: usize) -> Ident { format_ident!("Cancel{f}") }
pub fn segment(f: usize, b: usize) -> Ident { format_ident!("__pui_segment_{f}_{b}") }
pub fn task_result(ty: TokenStream) -> TokenStream {
    quote!(::core::result::Result<::proto_ui_gpui_support::owned_tasks::TaskStep<Self, #ty, ::proto_ui_gpui_support::SegmentFailure>, ::proto_ui_gpui_support::SegmentFailure>)
}

fn successors(end: &End, mut visit: impl FnMut(&Edge)) {
    match end {
        End::Jump { to, .. } => visit(to), End::Branch { yes, no, .. } => { visit(yes); visit(no); },
        End::Presence { present, omitted, .. } => { visit(present); visit(omitted); },
        End::Match { cases, .. } => { for c in cases { visit(&c.to); } }, End::Await { resume, .. } => visit(resume),
        End::Return { .. } | End::Fail { .. } => {},
    }
}

/// A resumed block owns only the behavior parameters its successor closure reads.
pub fn formals(checked: &Checked<'_>, f: usize) -> Vec<Vec<usize>> {
    let fun = &checked.ir.behaviors[f];
    if fun.phase != Phase::Task { return vec![(0..fun.params.len()).collect(); fun.blocks.len()]; }
    let mut layout = vec![Vec::new(); fun.blocks.len()];
    let facts = &checked.bodies[f];
    for &b in &facts.live_blocks {
        let block = &fun.blocks[b];
        let reads = count_uses(block);
        let mut live: BTreeSet<_> = fun.params.iter().enumerate().filter_map(|(i,p)| reads.contains_key(p.id.as_str()).then_some(i)).collect();
        successors(&block.end, |edge| live.extend(layout[facts.blocks[edge.block.as_str()]].iter().copied()));
        layout[b] = live.into_iter().collect();
    }
    layout
}

pub fn methods(checked: &Checked<'_>, names: &Names) -> Vec<TokenStream> {
    let mut methods = Vec::new();
    for &f in &checked.reached {
        let behavior = &checked.ir.behaviors[f];
        let body = &checked.bodies[f];
        let facts = &body.facts;
        let layout = formals(checked, f);
        for &b in &body.live_blocks {
            let block = &behavior.blocks[b];
            let name = names::block(f, b);
            let task = behavior.phase == Phase::Task;
            let mut uses = count_uses(block);
            if task {
                successors(&block.end, |edge| {
                    for &i in &layout[body.blocks[edge.block.as_str()]] { *uses.entry(behavior.params[i].id.as_str()).or_insert(0) += 1; }
                });
            }
            let mut lower = Lower { checked, names, f, layout: &layout, locals: HashMap::new(), uses, consumed: Vec::new() };
            let mut params = Vec::new();
            for &i in &layout[b] {
                let p = &behavior.params[i];
                let n = names::argument(i);
                let ty = if task { names.ty(p.ty) } else { names.input_ty(p.ty) };
                params.push(quote!(#n: #ty));
                lower.locals.insert(&p.id, (n, p.ty, task));
            }
            for (i, p) in block.params.iter().enumerate() {
                let n = names::parameter(i);
                let pure = matches!(behavior.phase, Phase::Pure | Phase::Init);
                let ty = if pure { names.input_ty(p.ty) } else { names.ty(p.ty) };
                params.push(quote!(#n: #ty));
                lower.locals.insert(&p.id, (n, p.ty, !pure));
            }
            let signal = if checked.tasks.is_empty() { names.signal.clone() } else { effect_type(names) };
            params.extend(environment(checked, facts, |p| { let n = data(p); let ty = names.ty(checked.binding(p).ty); quote!(#n: &#ty) },
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
            let result = if behavior.phase == Phase::Task { task_result(ty) } else if facts.fallible { quote!(::core::result::Result<#ty, ::proto_ui_gpui_support::SegmentFailure>) } else { ty };
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
