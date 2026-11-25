use crate::ir::*;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

pub type Result<T, E = String> = std::result::Result<T, E>;

fn error(at: &Source, message: impl std::fmt::Display) -> String { format!("{at}: invalid-ir: {message}") }
fn source(at: &Source) -> Result<()> {
    if at.file.is_empty() || at.start > at.end || at.end > (1_u64 << 53) - 1 {
        Err(error(at, "a source span needs a file and ordered safe-integer offsets"))
    } else { Ok(()) }
}
fn type_bound(ty: Type, limit: usize, at: &Source) -> Result<()> {
    if let Type::Data(i) = ty { if i >= limit { return Err(error(at, format_args!("data:{i} must reference an earlier declared type (limit {limit})"))); } }
    Ok(())
}
fn binding(b: &Binding, type_count: usize) -> Result<()> {
    source(&b.source)?;
    type_bound(b.ty, type_count, &b.source)?;
    if b.id.is_empty() || b.name.is_empty() { Err(error(&b.source, "binding ID and name must be nonempty")) } else { Ok(()) }
}
fn expect(actual: Type, expected: Type, at: &Source, label: &str) -> Result<()> {
    if actual == expected { Ok(()) } else { Err(error(at, format_args!("{label}: expected {expected:?}, received {actual:?}"))) }
}
fn literal_type(v: &Value, at: &Source) -> Result<Option<Type>> {
    Ok(Some(match v {
        Value::Bool { .. } => Type::Bool,
        Value::Number { bits } => {
            if bits.len() != 16 || !bits.bytes().all(|b| b.is_ascii_hexdigit()) { return Err(error(at, "number bits must contain exactly sixteen hexadecimal digits")); }
            Type::Number
        }
        Value::Text { .. } => Type::Text,
        Value::Tokens { .. } => Type::Tokens,
        _ => return Ok(None),
    }))
}
fn lookup<T: Copy>(map: &HashMap<&str, T>, id: &str, at: &Source, kind: &str) -> Result<T> {
    map.get(id).copied().ok_or_else(|| error(at, format_args!("unknown {kind} {id:?}; supply a resolved {kind} binding")))
}
fn insert<'a, T>(map: &mut HashMap<&'a str, T>, id: &'a str, item: T, at: &Source, kind: &str) -> Result<()> {
    if id.is_empty() || map.insert(id, item).is_some() { Err(error(at, format_args!("empty or duplicate {kind} ID {id:?}"))) } else { Ok(()) }
}

#[derive(Clone, Copy, Eq, PartialEq, PartialOrd, Ord, Debug)]
pub enum Place { Prop(usize), Field(usize), Context(usize) }

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
    pub unit: &'a Unit,
    pub links: &'a Links<'a>,
    pub index: usize,
    pub places: HashMap<&'a str, Place>,
    pub signals: HashMap<&'a str, usize>,
    pub functions: HashMap<&'a str, usize>,
    pub bodies: Vec<Function<'a>>,
    pub reached: Vec<usize>,
    pub derived: BTreeSet<usize>,
    pub actions: BTreeSet<usize>,
    pub has_styles: bool,
    pub members: &'a [HashMap<&'a str, usize>],
}

pub struct Links<'a> {
    pub components: HashMap<&'a str, usize>,
    pub keys: HashMap<&'a str, usize>,
    pub children: Vec<Vec<&'a View>>,
    pub required: Vec<BTreeMap<usize, &'a Source>>,
    pub scoped: bool,
    pub styled: bool,
    members: Vec<HashMap<&'a str, usize>>,
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

impl<'a> Links<'a> {
    pub fn new(unit: &'a Unit) -> Result<Self> {
        if unit.version != 4 { return Err(error(&unit.bodies[0].source, "expected ComponentIR version 4")); }
        let mut members = Vec::with_capacity(unit.types.len());
        for (i, data) in unit.types.iter().enumerate() {
            let mut fields_by_name = HashMap::new();
            match data {
                Data::Presence { value, source: at } => { source(at)?; type_bound(*value, i, at)?; }
                Data::Record { fields, source: at } => {
                    source(at)?;
                    for (j, field) in fields.iter().enumerate() {
                        source(&field.source)?;
                        type_bound(field.ty, i, &field.source)?;
                        // Record keys are strings. Exact public Rust spelling is
                        // checked separately from record identity and uniqueness.
                        if fields_by_name.insert(field.name.as_str(), j).is_some() {
                            return Err(error(&field.source, format_args!("duplicate record field {:?}", field.name)));
                        }
                    }
                }
            }
            members.push(fields_by_name);
        }
        let mut keys = HashMap::new();
        let mut exports = HashSet::new();
        for (i, k) in unit.keys.iter().enumerate() {
            binding(&k.binding, unit.types.len())?;
            insert(&mut keys, &k.binding.id, i, &k.binding.source, "nominal key")?;
            if let Some(n) = &k.export_name {
                if n.is_empty() || !exports.insert(n) { return Err(error(&k.binding.source, format_args!("empty or duplicate export {n:?}"))); }
            }
        }
        let mut components = HashMap::new();
        for (i, b) in unit.bodies.iter().enumerate() {
            source(&b.source)?;
            insert(&mut components, &b.id, i, &b.source, "component")?;
            if b.name.is_empty() || !exports.insert(&b.name) { return Err(error(&b.source, format_args!("empty or duplicate exported component {:?}", b.name))); }
            if b.prototype_name.as_deref() == Some("") { return Err(error(&b.source, "prototype metadata name must be nonempty")); }
        }
        let mut children = Vec::new();
        let mut edges = Vec::new();
        let mut required = Vec::new();
        let mut provided = Vec::new();
        let mut styled = false;
        for b in &unit.bodies {
            let mut needs = BTreeMap::new();
            for c in &b.consumes {
                let k = lookup(&keys, &c.key, &c.binding.source, "Context key")?;
                expect(c.binding.ty, unit.keys[k].binding.ty, &c.binding.source, "consumed Context")?;
                needs.insert(k, &c.binding.source);
            }
            let mut own = BTreeSet::new();
            for p in &b.provides {
                source(&p.source)?;
                let k = lookup(&keys, &p.key, &p.source, "Context key")?;
                if !own.insert(k) { return Err(error(&p.source, format_args!("duplicate provider for {:?}", p.key))); }
            }
            let mut sites = Vec::new();
            let mut targets = Vec::new();
            let mut nodes = vec![&b.view];
            while let Some(node) = nodes.pop() {
                match node {
                    View::Child { component, source: at, .. } => { targets.push(lookup(&components, component, at, "child component")?); sites.push(node); }
                    View::Element { children, style, .. } => { styled |= style.is_some(); nodes.extend(children.iter().rev()); }
                    View::Text { .. } => {}
                }
            }
            children.push(sites); edges.push(targets); required.push(needs); provided.push(own);
        }
        let walk = postorder(0..unit.bodies.len(), &edges);
        if let Some(cycle) = walk.cycle {
            return Err(error(&unit.bodies[cycle[0]].source, format_args!("cyclic component composition: {}", cycle.iter().map(|&i| unit.bodies[i].id.as_str()).collect::<Vec<_>>().join(" -> "))));
        }
        for i in walk.order {
            for &child in &edges[i] {
                let inherited: Vec<_> = required[child].iter().filter(|(key, _)| !provided[i].contains(*key)).map(|(&k, &at)| (k, at)).collect();
                required[i].extend(inherited);
            }
        }
        Ok(Self { components, keys, children, required, scoped: unit.bodies.len() > 1 || !unit.keys.is_empty(), styled, members })
    }
}

impl<'a> Checked<'a> {
    pub fn new(unit: &'a Unit, links: &'a Links<'a>, index: usize) -> Result<Self> {
        let ir = &unit.bodies[index];
        let mut checked = Self { ir, unit, links, index, places: HashMap::new(), signals: HashMap::new(), functions: HashMap::new(), bodies: Vec::new(), reached: Vec::new(), derived: BTreeSet::new(), actions: BTreeSet::new(), has_styles: false, members: &links.members };
        let mut global = HashSet::new();
        for b in ir.props.iter().map(|p| &p.binding).chain(ir.fields.iter().map(|f| &f.binding)).chain(ir.consumes.iter().map(|c| &c.binding)).chain(&ir.signals).chain(ir.behaviors.iter().map(|f| &f.binding)) {
            binding(b, unit.types.len())?;
            if !global.insert(&b.id) { return Err(error(&b.source, format_args!("duplicate component binding {:?}", b.id))); }
        }
        for (i, prop) in ir.props.iter().enumerate() {
            let b = &prop.binding;
            if prop.control_mode.is_some() && checked.payload(b.ty).is_none() { return Err(error(&b.source, format_args!("fixed-instance input {:?} requires a presence type", b.id))); }
            if let Some(v) = &prop.default {
                let actual = literal_type(v, &b.source)?.ok_or_else(|| error(&b.source, "an input default must be a literal"))?;
                expect(actual, b.ty, &b.source, "input default")?;
            }
            checked.places.insert(&b.id, Place::Prop(i));
        }
        for (i, f) in ir.fields.iter().enumerate() { checked.places.insert(&f.binding.id, Place::Field(i)); }
        for (i, c) in ir.consumes.iter().enumerate() { checked.places.insert(&c.binding.id, Place::Context(i)); }
        for (i, b) in ir.signals.iter().enumerate() { checked.signals.insert(&b.id, i); }
        for (i, f) in ir.behaviors.iter().enumerate() { checked.functions.insert(&f.binding.id, i); }
        for f in &ir.behaviors { let body = checked.body(f)?; checked.bodies.push(body); }
        let mut roots = Vec::new();
        for p in &ir.provides {
            let ty = unit.keys[links.keys[p.key.as_str()]].binding.ty;
            checked.derived.insert(checked.endpoint(&p.function, Phase::Pure, Some(ty), true, &p.source)?);
        }
        for field in &ir.fields {
            roots.push(checked.endpoint(&field.init, Phase::Init, Some(field.binding.ty), true, &field.binding.source)?);
        }
        for projection in &ir.projections {
            let f = checked.endpoint(&projection.function, Phase::Pure, None, true, &ir.source)?;
            checked.derived.insert(f);
        }
        for action in &ir.actions {
            let f = checked.endpoint(&action.function, Phase::Action, None, false, &ir.source)?;
            if ir.behaviors[f].binding.ty != Type::Unit { return Err(format!("{}: backend-missing [action-result]: exposed action {:?} needs a queued result transport for its non-unit return", ir.behaviors[f].binding.source, action.name)); }
            checked.actions.insert(f);
        }
        checked.view(&ir.view)?;
        roots.extend(&checked.derived);
        roots.extend(&checked.actions);
        let graph: Vec<_> = checked.bodies.iter().map(|f| f.facts.calls.iter().copied().collect()).collect();
        let Walk { order, cycle } = postorder(roots, &graph);
        let mut recursive_helper = None;
        if let Some(first) = cycle {
            if first.iter().any(|node| checked.derived.contains(node)) {
                return Err(checked.cycle_error(&first, "source-invalid [derived-cycle]"));
            }
            if let Some(witness) = checked.derived.iter().find_map(|&root| cycle_through(root, &graph)) {
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
        match p { Place::Prop(i) => &self.ir.props[i].binding, Place::Field(i) => &self.ir.fields[i].binding, Place::Context(i) => &self.ir.consumes[i].binding }
    }

    pub fn payload(&self, ty: Type) -> Option<Type> {
        let Type::Data(i) = ty else { return None; };
        match self.unit.types.get(i)? { Data::Presence { value, .. } => Some(*value), _ => None }
    }

    pub fn record(&self, ty: Type, at: &Source) -> Result<(usize, &'a [DataField])> {
        if let Type::Data(i) = ty { if let Some(Data::Record { fields, .. }) = self.unit.types.get(i) { return Ok((i, fields)); } }
        Err(error(at, format_args!("expected a declared record, received {ty:?}")))
    }

    fn view(&mut self, root: &View) -> Result<()> {
        if !matches!(root, View::Element { .. }) { return Err(error(&self.ir.source, "the component view root must be an element")); }
        let mut nodes = vec![root];
        while let Some(node) = nodes.pop() {
            match node {
                View::Child { component, key, props, source: at } => {
                    source(at)?;
                    let f = self.endpoint(key, Phase::Pure, None, true, at)?;
                    let ty = self.ir.behaviors[f].binding.ty;
                    if ty == Type::Number {
                        return Err(format!("{at}: backend-missing [numeric-child-key]: child {component:?} key {key:?} requires numeric identity lowering"));
                    }
                    expect(ty, Type::Text, at, "child key")?;
                    self.derived.insert(f);
                    let child = &self.unit.bodies[self.links.components[component.as_str()]];
                    let mut supplied = HashSet::new();
                    for prop in props {
                        source(&prop.source)?;
                        let field = child.props.iter().find(|p| p.binding.name == prop.name).ok_or_else(|| error(&prop.source, format_args!("unknown child prop {:?} on {component:?}", prop.name)))?;
                        if !supplied.insert(prop.name.as_str()) { return Err(error(&prop.source, format_args!("duplicate child prop {:?}", prop.name))); }
                        let ty = self.payload(field.binding.ty).unwrap_or(field.binding.ty);
                        self.derived.insert(self.endpoint(&prop.function, Phase::Pure, Some(ty), true, &prop.source)?);
                    }
                    for field in &child.props {
                        if field.default.is_none() && self.payload(field.binding.ty).is_none() && !supplied.contains(field.binding.name.as_str()) { return Err(error(at, format_args!("missing required child prop {:?}", field.binding.name))); }
                    }
                }
                View::Text { value, source: at } => {
                    source(at)?;
                    self.derived.insert(self.endpoint(value, Phase::Pure, Some(Type::Text), true, at)?);
                }
                View::Element { tag, source: at, style, disabled, activate, children } => {
                    source(at)?;
                    if *tag != Tag::Button && (disabled.is_some() || activate.is_some()) {
                        return Err(format!("{at}: backend-missing [interactive-text]: non-button press or disabled lowering is unavailable"));
                    }
                    self.has_styles |= style.is_some();
                    for (id, ty) in [(style, Type::Tokens), (disabled, Type::Bool)] {
                        if let Some(id) = id { self.derived.insert(self.endpoint(id, Phase::Pure, Some(ty), true, at)?); }
                    }
                    if let Some(id) = activate { self.actions.insert(self.endpoint(id, Phase::Action, Some(Type::Unit), true, at)?); }
                    nodes.extend(children.iter().rev());
                }
            }
        }
        Ok(())
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
        for p in &f.params { binding(p, self.unit.types.len())?; insert(&mut params, &p.id, p.ty, &p.source, "parameter")?; }
        let mut blocks = HashMap::new();
        for (i, b) in f.blocks.iter().enumerate() { insert(&mut blocks, &b.id, i, b.end.source(), "block")?; }
        let entry = lookup(&blocks, &f.entry, at, "entry block")?;
        if !f.blocks[entry].params.is_empty() { return Err(error(at, "entry block cannot declare incoming edge parameters")); }
        let mut graph = Vec::new();
        let mut per_block = Vec::new();
        for b in &f.blocks {
            let mut block = BlockCheck { checked: self, function: f, locals: params.clone(), facts: Facts::default() };
            for p in &b.params { binding(p, self.unit.types.len())?; insert(&mut block.locals, &p.id, p.ty, &p.source, "block parameter")?; }
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
                End::Jump { to, .. } => vec![(to, None)],
                End::Branch { condition, yes, no, .. } => { expect(block.value(condition, at)?, Type::Bool, at, "branch condition")?; vec![(yes, None), (no, None)] }
                End::Presence { value, present, omitted, .. } => {
                    let ty = block.value(value, at)?;
                    let payload = self.payload(ty).ok_or_else(|| error(at, "presence terminator requires a presence value"))?;
                    vec![(present, Some(payload)), (omitted, None)]
                }
            };
            for (edge, payload) in targets {
                let dest = lookup(&blocks, &edge.block, at, "successor block")?;
                let mut params = f.blocks[dest].params.as_slice();
                if let Some(payload) = payload {
                    let (first, rest) = params.split_first().ok_or_else(|| error(at, "the present successor must declare a first payload parameter"))?;
                    expect(payload, first.ty, at, &first.name)?;
                    params = rest;
                }
                block.arguments(&edge.args, params, at, &edge.block)?;
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
            Value::Bool { .. } | Value::Number { .. } | Value::Text { .. } | Value::Tokens { .. } => literal_type(v, at)?.expect("literal variant"),
            Value::Record { ty, fields } => {
                let (i, declared) = self.checked.record(*ty, at)?;
                if fields.len() != declared.len() { return Err(error(at, format_args!("data:{i} requires exactly its declared fields"))); }
                let mut seen = HashSet::new();
                for field in fields {
                    let j = lookup(&self.checked.members[i], &field.name, at, "record field")?;
                    if !seen.insert(j) { return Err(error(at, format_args!("duplicate record field {:?}", field.name))); }
                    expect(self.value(&field.value, at)?, declared[j].ty, at, &field.name)?;
                }
                *ty
            }
            Value::Member { value, field } => {
                let ty = self.value(value, at)?;
                let (i, fields) = self.checked.record(ty, at)?;
                fields[lookup(&self.checked.members[i], field, at, "record field")?].ty
            }
            Value::HasValue { value } => {
                let ty = self.value(value, at)?;
                self.checked.payload(ty).ok_or_else(|| error(at, "has-value requires a presence value"))?;
                Type::Bool
            }
            Value::Local { id } => lookup(&self.locals, id, at, "local in this block")?,
            Value::Prop { id } | Value::State { id } | Value::Capture { id } | Value::Context { id } => {
                let p = lookup(&self.checked.places, id, at, "value")?;
                let correct = match (p, v) {
                    (Place::Prop(_), Value::Prop { .. }) => true,
                    (Place::Context(_), Value::Context { .. }) => true,
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
                binding(b, self.checked.unit.types.len())?;
                expect(self.value(value, at)?, b.ty, at, &b.name)?;
                insert(&mut self.locals, &b.id, b.ty, &b.source, "local")?;
            }
            Instruction::Write { target, value, .. } => {
                let p = lookup(&self.checked.places, target, at, "write target")?;
                let Place::Field(i) = p else { return Err(error(at, format_args!("only state can be written by an action: {target:?}"))); };
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
