use crate::ir::*;
use std::collections::{BTreeSet, HashMap, HashSet};

pub type Result<T, E = String> = std::result::Result<T, E>;

fn error(at: &Source, message: impl std::fmt::Display) -> String { format!("{at}: invalid-ir: {message}") }
fn source(at: &Source) -> Result<()> {
    if at.file.is_empty() || at.start > at.end || at.end > (1_u64 << 53) - 1 {
        Err(error(at, "a source span needs a file and ordered safe-integer offsets"))
    } else { Ok(()) }
}
fn binding(b: &Binding) -> Result<()> {
    source(&b.source)?;
    if b.id.is_empty() || b.name.is_empty() { Err(error(&b.source, "binding ID and name must be nonempty")) } else { Ok(()) }
}
fn expect(actual: Type, expected: Type, at: &Source, label: &str) -> Result<()> {
    if actual == expected { Ok(()) } else { Err(error(at, format_args!("{label}: expected {expected:?}, received {actual:?}"))) }
}
fn lookup<T: Copy>(map: &HashMap<&str, T>, id: &str, at: &Source, kind: &str) -> Result<T> {
    map.get(id).copied().ok_or_else(|| error(at, format_args!("unknown {kind} {id:?}; supply a resolved {kind} binding")))
}
fn insert<'a, T>(map: &mut HashMap<&'a str, T>, id: &'a str, item: T, at: &Source, kind: &str) -> Result<()> {
    if id.is_empty() || map.insert(id, item).is_some() { Err(error(at, format_args!("empty or duplicate {kind} ID {id:?}"))) } else { Ok(()) }
}

#[derive(Clone, Copy, Eq, PartialEq, PartialOrd, Ord, Debug)]
pub enum Place { Prop(usize), Field(usize) }

#[derive(Default)]
pub struct Facts {
    pub reads: BTreeSet<Place>,
    pub writes: BTreeSet<usize>,
    pub signals: BTreeSet<usize>,
    pub calls: BTreeSet<usize>,
    pub fallible: bool,
}

impl Facts {
    fn include_effects(&mut self, other: &Facts) {
        self.writes.extend(&other.writes);
        self.signals.extend(&other.signals);
        self.fallible |= other.fallible;
    }

    pub fn inputs(&self) -> impl Iterator<Item = Place> + '_ {
        self.reads.iter().copied().filter(|p| !matches!(p, Place::Field(i) if self.writes.contains(i)))
    }
}

pub struct Function<'a> {
    pub blocks: HashMap<&'a str, usize>,
    pub entry: usize,
    pub live_blocks: Vec<usize>,
    pub facts: Facts,
    missing: Option<String>,
}

pub struct Checked<'a> {
    pub ir: &'a Component,
    pub places: HashMap<&'a str, Place>,
    pub signals: HashMap<&'a str, usize>,
    pub functions: HashMap<&'a str, usize>,
    pub bodies: Vec<Function<'a>>,
    pub reached: Vec<usize>,
    pub actions: BTreeSet<usize>,
}

struct Walk {
    order: Vec<usize>,
    cycle: Option<Vec<usize>>,
}

// Visit the whole closure even for an unsupported loop. Its read dependencies
// are still part of the wire contract, including on an unused behavior.
fn postorder(roots: impl IntoIterator<Item = usize>, edges: &[Vec<usize>]) -> Walk {
    let mut marks = vec![0; edges.len()];
    let mut order = Vec::new();
    let mut cycle = None;
    for root in roots {
        if marks[root] != 0 { continue; }
        marks[root] = 1;
        let mut path = vec![(root, 0)];
        while let Some((id, next)) = path.last_mut() {
            if let Some(&child) = edges[*id].get(*next) {
                *next += 1;
                match marks[child] {
                    0 => { marks[child] = 1; path.push((child, 0)); }
                    1 if cycle.is_none() => {
                        let mut witness: Vec<_> = path.iter().map(|(n, _)| *n).skip_while(|n| *n != child).collect();
                        witness.push(child);
                        cycle = Some(witness);
                    }
                    _ => {}
                }
            } else {
                marks[*id] = 2;
                order.push(*id);
                path.pop();
            }
        }
    }
    Walk { order, cycle }
}

// A helper reached by a projection may recurse without the projection being
// cyclic itself. Conversely, a separate helper cycle must not hide a genuine
// circular public derivation. Search for a return edge to the named root.
fn cycle_through(root: usize, edges: &[Vec<usize>]) -> Option<Vec<usize>> {
    let mut parents = vec![None; edges.len()];
    let mut nodes = vec![root];
    parents[root] = Some(root);
    let mut next = 0;
    while next < nodes.len() {
        let caller = nodes[next];
        next += 1;
        for &callee in &edges[caller] {
            if callee == root {
                let mut cycle = vec![root];
                let mut node = caller;
                while node != root {
                    cycle.push(node);
                    node = parents[node]?;
                }
                cycle.push(root);
                cycle.reverse();
                return Some(cycle);
            }
            if parents[callee].is_none() {
                parents[callee] = Some(caller);
                nodes.push(callee);
            }
        }
    }
    None
}

impl<'a> Checked<'a> {
    pub fn new(ir: &'a Component) -> Result<Self> {
        source(&ir.source)?;
        if ir.version != 1 || ir.name.is_empty() { return Err(error(&ir.source, "expected a named ComponentIR version 1")); }
        let mut checked = Self { ir, places: HashMap::new(), signals: HashMap::new(), functions: HashMap::new(), bodies: Vec::new(), reached: Vec::new(), actions: BTreeSet::new() };
        let mut global = HashSet::new();
        for b in ir.props.iter().chain(ir.fields.iter().map(|f| &f.binding)).chain(&ir.signals).chain(ir.behaviors.iter().map(|f| &f.binding)) {
            binding(b)?;
            if !global.insert(&b.id) { return Err(error(&b.source, format_args!("duplicate component binding {:?}", b.id))); }
        }
        for (i, b) in ir.props.iter().enumerate() { checked.places.insert(&b.id, Place::Prop(i)); }
        for (i, f) in ir.fields.iter().enumerate() { checked.places.insert(&f.binding.id, Place::Field(i)); }
        for (i, b) in ir.signals.iter().enumerate() { checked.signals.insert(&b.id, i); }
        for (i, f) in ir.behaviors.iter().enumerate() { checked.functions.insert(&f.binding.id, i); }
        for f in &ir.behaviors { let body = checked.body(f)?; checked.bodies.push(body); }
        let mut roots = Vec::new();
        for field in &ir.fields {
            roots.push(checked.endpoint(&field.init, Phase::Init, Some(field.binding.ty), true, &field.binding.source)?);
        }
        for projection in &ir.projections { roots.push(checked.endpoint(&projection.function, Phase::Pure, None, true, &ir.source)?); }
        for action in &ir.actions {
            let f = checked.endpoint(&action.function, Phase::Action, None, false, &ir.source)?;
            if ir.behaviors[f].binding.ty != Type::Unit { return Err(format!("{}: backend-missing [action-result]: exposed action {:?} needs a queued result transport for its non-unit return", ir.behaviors[f].binding.source, action.name)); }
            checked.actions.insert(f);
        }
        roots.push(checked.endpoint(&ir.view.text, Phase::Pure, Some(Type::Text), true, &ir.source)?);
        if let Some(id) = &ir.view.disabled { roots.push(checked.endpoint(id, Phase::Pure, Some(Type::Bool), true, &ir.source)?); }
        if let Some(id) = &ir.view.activate { checked.actions.insert(checked.endpoint(id, Phase::Action, Some(Type::Unit), true, &ir.source)?); }
        if ir.view.role == Role::Text {
            if let Some(id) = ir.view.disabled.as_ref().or(ir.view.activate.as_ref()) {
                return Err(format!("{}: backend-missing [interactive-text]: the native text carrier cannot realize interactive behavior {id:?}", ir.behaviors[checked.functions[id.as_str()]].binding.source));
            }
        }
        roots.extend(&checked.actions);
        let graph: Vec<_> = checked.bodies.iter().map(|f| f.facts.calls.iter().copied().collect()).collect();
        let Walk { order, cycle } = postorder(roots, &graph);
        let mut recursive_helper = None;
        if let Some(first) = cycle {
            let derived: BTreeSet<_> = ir.projections.iter().map(|p| &p.function)
                .chain([&ir.view.text]).chain(&ir.view.disabled)
                .map(|key| checked.functions[key.as_str()]).collect();
            if first.iter().any(|node| derived.contains(node)) {
                return Err(checked.cycle_error(&first, "source-invalid [derived-cycle]"));
            }
            if let Some(witness) = derived.into_iter().find_map(|root| cycle_through(root, &graph)) {
                return Err(checked.cycle_error(&witness, "source-invalid [derived-cycle]"));
            }
            recursive_helper = Some(first);
        }
        checked.check_read_dependencies(&graph)?;
        if let Some(witness) = recursive_helper {
            return Err(checked.cycle_error(&witness, "backend-missing [recursive-helper]"));
        }
        checked.reached = order;
        for &i in &checked.reached {
            if let Some(missing) = checked.bodies[i].missing.take() { return Err(missing); }
            let mut facts = std::mem::take(&mut checked.bodies[i].facts);
            for &callee in &graph[i] { facts.include_effects(&checked.bodies[callee].facts); }
            checked.bodies[i].facts = facts;
        }
        for (i, field) in ir.fields.iter().enumerate() {
            let f = checked.functions[field.init.as_str()];
            for &read in &checked.bodies[f].facts.reads {
                if matches!(read, Place::Field(j) if j >= i) { return Err(format!("{}: source-invalid [initialization-order]: {:?} reads {:?} before initialization", field.binding.source, field.binding.id, checked.binding(read).id)); }
            }
        }
        Ok(checked)
    }

    fn cycle_error(&self, path: &[usize], category: &str) -> String {
        let names: Vec<_> = path.iter().map(|&i| {
            let binding = &self.ir.behaviors[i].binding;
            if binding.id == binding.name { format!("{:?}", binding.id) }
            else { format!("{:?} ({:?})", binding.name, binding.id) }
        }).collect();
        format!("{}: {category}: {}", self.ir.behaviors[path[0]].binding.source, names.join(" -> "))
    }

    fn check_read_dependencies(&mut self, graph: &[Vec<usize>]) -> Result<()> {
        let mut callers = vec![Vec::new(); graph.len()];
        let mut pending = Vec::new();
        let mut declared = Vec::new();
        for (f, callees) in graph.iter().enumerate() {
            for &callee in callees { callers[callee].push(f); }
            pending.extend(self.bodies[f].facts.reads.iter().map(|&place| (f, place)));
            declared.push(self.ir.behaviors[f].dependencies.iter()
                .map(|id| self.places[id.as_str()]).collect::<BTreeSet<_>>());
        }
        // A (behavior, location) enters the worklist only once. This also checks
        // metadata for recursive, unexposed helpers without needing to emit them.
        while let Some((f, place)) = pending.pop() {
            if !declared[f].contains(&place) {
                let owner = &self.ir.behaviors[f].binding;
                let value = self.binding(place);
                return Err(error(&owner.source, format_args!(
                    "[dependency-missing] {:?} omits read dependency {:?}; include the binding in its dependency summary",
                    owner.id, value.id,
                )));
            }
            for &caller in &callers[f] {
                if self.bodies[caller].facts.reads.insert(place) { pending.push((caller, place)); }
            }
        }
        Ok(())
    }

    pub fn binding(&self, p: Place) -> &'a Binding {
        match p { Place::Prop(i) => &self.ir.props[i], Place::Field(i) => &self.ir.fields[i].binding }
    }

    fn endpoint(&self, id: &str, phase: Phase, ty: Option<Type>, no_args: bool, at: &Source) -> Result<usize> {
        let i = lookup(&self.functions, id, at, "behavior")?;
        let f = &self.ir.behaviors[i];
        if f.phase != phase || (no_args && !f.params.is_empty()) { return Err(error(at, format_args!("invalid signature of {id:?}: expected phase {phase:?}{}", if no_args { " and zero arguments" } else { "" }))); }
        if let Some(ty) = ty { expect(f.binding.ty, ty, at, id)?; }
        Ok(i)
    }

    fn body(&self, f: &'a Behavior) -> Result<Function<'a>> {
        let at = &f.binding.source;
        let mut deps = HashSet::new();
        for id in &f.dependencies {
            lookup(&self.places, id, at, "dependency")?;
            if !deps.insert(id) { return Err(error(at, format_args!("duplicate dependency {id:?}"))); }
        }
        let mut params = HashMap::new();
        for p in &f.params { binding(p)?; insert(&mut params, &p.id, p.ty, &p.source, "parameter")?; }
        let mut blocks = HashMap::new();
        for (i, b) in f.blocks.iter().enumerate() { insert(&mut blocks, &b.id, i, b.end.source(), "block")?; }
        let entry = lookup(&blocks, &f.entry, at, "entry block")?;
        if !f.blocks[entry].params.is_empty() { return Err(error(at, "entry block cannot declare incoming edge parameters")); }
        let mut graph = Vec::new();
        let mut per_block = Vec::new();
        for b in &f.blocks {
            let mut block = BlockCheck { checked: self, function: f, locals: params.clone(), facts: Facts::default() };
            for p in &b.params { binding(p)?; insert(&mut block.locals, &p.id, p.ty, &p.source, "block parameter")?; }
            for instruction in &b.instructions { block.instruction(instruction)?; }
            let at = b.end.source();
            source(at)?;
            let mut edges = Vec::new();
            let targets = match &b.end {
                End::Return { value, .. } => {
                    let ty = match value { Some(v) => block.value(v, at)?, None => Type::Unit };
                    expect(ty, f.binding.ty, at, "return")?;
                    vec![]
                }
                End::Fail { .. } => { block.facts.fallible = true; vec![] }
                End::Jump { to, .. } => vec![to],
                End::Branch { condition, yes, no, .. } => { expect(block.value(condition, at)?, Type::Bool, at, "branch condition")?; vec![yes, no] }
            };
            for edge in targets {
                let dest = lookup(&blocks, &edge.block, at, "successor block")?;
                block.arguments(&edge.args, &f.blocks[dest].params, at, &edge.block)?;
                edges.push(dest);
            }
            graph.push(edges);
            per_block.push(block.facts);
        }
        let Walk { order: live_blocks, cycle } = postorder([entry], &graph);
        let mut missing = cycle.map(|cycle| {
            let names: Vec<_> = cycle.iter().map(|&i| f.blocks[i].id.as_str()).collect();
            format!("{}: backend-missing [cyclic-cfg]: {:?} requires loop lowering for {}", f.blocks[cycle[0]].end.source(), f.binding.id, names.join(" -> "))
        });
        let mut facts = Facts::default();
        for &i in &live_blocks {
            if per_block[i].fallible && f.phase != Phase::Action {
                missing = Some(format!("{}: backend-missing [failing-value]: {:?} needs a typed failure transport for its {:?} result", f.blocks[i].end.source(), f.binding.id, f.phase));
            }
            facts.reads.extend(&per_block[i].reads);
            facts.include_effects(&per_block[i]);
            facts.calls.extend(&per_block[i].calls);
        }
        Ok(Function { blocks, entry, live_blocks, facts, missing })
    }
}

struct BlockCheck<'c, 'a> {
    checked: &'c Checked<'a>, function: &'a Behavior,
    locals: HashMap<&'a str, Type>, facts: Facts,
}

impl<'a> BlockCheck<'_, 'a> {
    fn arguments(&mut self, args: &[Value], params: &[Binding], at: &Source, target: &str) -> Result<()> {
        if args.len() != params.len() { return Err(error(at, format_args!("{target:?} expects {} arguments, received {}", params.len(), args.len()))); }
        for (arg, p) in args.iter().zip(params) { expect(self.value(arg, at)?, p.ty, at, &p.name)?; }
        Ok(())
    }

    fn call(&mut self, id: &str, args: &[Value], at: &Source, invoke: bool) -> Result<Type> {
        let i = lookup(&self.checked.functions, id, at, "behavior")?;
        let f = &self.checked.ir.behaviors[i];
        if invoke != (f.phase == Phase::Action) || (f.phase == Phase::Action && self.function.phase != Phase::Action) || (f.phase == Phase::Init && self.function.phase != Phase::Init) {
            return Err(error(at, format_args!("{:?} cannot call {id:?} ({:?}) in this position", self.function.binding.id, f.phase)));
        }
        self.arguments(args, &f.params, at, id)?;
        self.facts.calls.insert(i);
        Ok(f.binding.ty)
    }

    fn value(&mut self, v: &Value, at: &Source) -> Result<Type> {
        Ok(match v {
            Value::Bool { .. } => Type::Bool,
            Value::Number { bits } => {
                if bits.len() != 16 || !bits.bytes().all(|b| b.is_ascii_hexdigit()) { return Err(error(at, "number bits must contain exactly sixteen hexadecimal digits")); }
                Type::Number
            }
            Value::Text { .. } => Type::Text,
            Value::Local { id } => lookup(&self.locals, id, at, "local in this block")?,
            Value::Prop { id } | Value::State { id } | Value::Capture { id } => {
                let p = lookup(&self.checked.places, id, at, "value")?;
                let correct = match (p, v) {
                    (Place::Prop(_), Value::Prop { .. }) => true,
                    (Place::Field(i), Value::State { .. }) => self.checked.ir.fields[i].kind == FieldKind::State,
                    (Place::Field(i), Value::Capture { .. }) => self.checked.ir.fields[i].kind == FieldKind::Capture,
                    _ => false,
                };
                if !correct { return Err(error(at, format_args!("reference kind does not match {id:?}"))); }
                self.facts.reads.insert(p);
                self.checked.binding(p).ty
            }
            Value::Not { value } => { expect(self.value(value, at)?, Type::Bool, at, "not")?; Type::Bool }
            Value::Binary { op, left, right } => {
                let lhs = self.value(left, at)?;
                let rhs = self.value(right, at)?;
                expect(rhs, lhs, at, "binary operands")?;
                match op {
                    Op::Equal => Type::Bool,
                    Op::Add | Op::Multiply => { expect(lhs, Type::Number, at, "arithmetic")?; Type::Number }
                    Op::Concat => { expect(lhs, Type::Text, at, "concat")?; Type::Text }
                }
            }
            Value::Call { function, args } => self.call(function, args, at, false)?,
        })
    }

    fn instruction(&mut self, op: &'a Instruction) -> Result<()> {
        let at = op.source();
        source(at)?;
        match op {
            Instruction::Let { binding: b, value, .. } => {
                binding(b)?;
                expect(self.value(value, at)?, b.ty, at, &b.name)?;
                insert(&mut self.locals, &b.id, b.ty, &b.source, "local")?;
            }
            Instruction::Write { target, value, .. } => {
                let p = lookup(&self.checked.places, target, at, "write target")?;
                let Place::Field(i) = p else { return Err(error(at, "a prop cannot be written by an action")); };
                if self.function.phase != Phase::Action || self.checked.ir.fields[i].kind != FieldKind::State { return Err(error(at, format_args!("only actions can write mutable state: {target:?}"))); }
                expect(self.value(value, at)?, self.checked.binding(p).ty, at, target)?;
                self.facts.writes.insert(i);
            }
            Instruction::Emit { target, value, .. } => {
                let i = lookup(&self.checked.signals, target, at, "signal")?;
                if self.function.phase != Phase::Action { return Err(error(at, "signals are post-commit effects and require an action")); }
                expect(self.value(value, at)?, self.checked.ir.signals[i].ty, at, target)?;
                self.facts.signals.insert(i);
            }
            Instruction::Invoke { function, args, .. } => { self.call(function, args, at, true)?; }
        }
        Ok(())
    }
}
