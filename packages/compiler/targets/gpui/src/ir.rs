use serde::{Deserialize, Deserializer};
use serde::de::{DeserializeSeed, MapAccess, Visitor, value::{BorrowedStrDeserializer, MapAccessDeserializer, StrDeserializer}};
use std::fmt;

// Internally tagged enum derives buffer nested values. Serde's buffered
// identifier reader accepts integer variant indices, which this wire forbids.
// Require an actual string before forwarding each discriminator to the derive.
struct TextSeed<'a, S> { seed: S, is_kind: Option<&'a mut bool> }

impl<'de, S: DeserializeSeed<'de>> DeserializeSeed<'de> for TextSeed<'_, S> {
    type Value = S::Value;
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<Self::Value, D::Error> {
        d.deserialize_str(self)
    }
}

impl<'de, S: DeserializeSeed<'de>> Visitor<'de> for TextSeed<'_, S> {
    type Value = S::Value;
    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str("a string field name or kind") }
    fn visit_str<E: serde::de::Error>(self, text: &str) -> Result<S::Value, E> {
        if let Some(flag) = self.is_kind { *flag = text == "kind"; }
        self.seed.deserialize(StrDeserializer::new(text))
    }
    fn visit_borrowed_str<E: serde::de::Error>(self, text: &'de str) -> Result<S::Value, E> {
        if let Some(flag) = self.is_kind { *flag = text == "kind"; }
        self.seed.deserialize(BorrowedStrDeserializer::new(text))
    }
}

struct Fields<M> { inner: M, is_kind: bool }

impl<'de, M: MapAccess<'de>> MapAccess<'de> for Fields<M> {
    type Error = M::Error;
    fn next_key_seed<S: DeserializeSeed<'de>>(&mut self, seed: S) -> Result<Option<S::Value>, M::Error> {
        self.inner.next_key_seed(TextSeed { seed, is_kind: Some(&mut self.is_kind) })
    }
    fn next_value_seed<S: DeserializeSeed<'de>>(&mut self, seed: S) -> Result<S::Value, M::Error> {
        if self.is_kind { self.inner.next_value_seed(TextSeed { seed, is_kind: None }) }
        else { self.inner.next_value_seed(seed) }
    }
    fn size_hint(&self) -> Option<usize> { self.inner.size_hint() }
}

// Serde's ordinary struct derives also accept positional sequences. Keep their
// field and duplicate checks while requiring an object at every record boundary.
macro_rules! object_only {
    ($($ty:ident),+ $(,)?) => { $(
        impl<'de> Deserialize<'de> for $ty {
            fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                struct Object;
                impl<'de> serde::de::Visitor<'de> for Object {
                    type Value = $ty;
                    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                        write!(f, "a {} object", stringify!($ty))
                    }
                    fn visit_map<M: serde::de::MapAccess<'de>>(self, map: M) -> Result<$ty, M::Error> {
                        $ty::deserialize(MapAccessDeserializer::new(Fields { inner: map, is_kind: false }))
                    }
                }
                d.deserialize_map(Object)
            }
        }
    )+ };
}

object_only!(Source, DataField, Data, TagCase, RecordValue, Binding, InputFields, Value, Instruction, Edge, MatchCase, End, Block, Behavior, Named, Field, View, ChildProp, Component, RootFields, Key, Consume, Provide, Extern, TaskDef);

// An externally tagged Serde unit variant normally also accepts {"tag":null}.
// The IR spells types, phases, operators and element tags exclusively as strings.
macro_rules! string_only {
    ($($ty:ident),+ $(,)?) => { $(
        impl<'de> Deserialize<'de> for $ty {
            fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                // Bind the module's enum explicitly. A generated visitor name
                // must never capture the wire type, including the `Tag` enum.
                struct StringVisitor;
                impl<'de> serde::de::Visitor<'de> for StringVisitor {
                    type Value = self::$ty;
                    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                        write!(f, "a {} string", stringify!($ty))
                    }
                    fn visit_str<E: serde::de::Error>(self, text: &str) -> Result<Self::Value, E> {
                        self::$ty::deserialize(serde::de::value::StrDeserializer::new(text))
                    }
                }
                d.deserialize_str(StringVisitor)
            }
        }
    )+ };
}

string_only!(Op, Phase, FieldKind, Tag, ControlMode, Policy);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Type { Bool, Number, Text, Unit, Tokens, Data(usize) }

impl<'de> Deserialize<'de> for Type {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct TypeName;
        impl<'de> Visitor<'de> for TypeName {
            type Value = Type;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str("a scalar name or a canonical data:<index> reference") }
            fn visit_str<E: serde::de::Error>(self, name: &str) -> Result<Type, E> {
                Ok(match name {
                    "bool" => Type::Bool, "number" => Type::Number, "text" => Type::Text, "unit" => Type::Unit, "tokens" => Type::Tokens,
                    _ => {
                        let index = name.strip_prefix("data:").filter(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()) && (!s.starts_with('0') || *s == "0"))
                            .and_then(|s| s.parse::<usize>().ok()).ok_or_else(|| E::invalid_value(serde::de::Unexpected::Str(name), &self))?;
                        Type::Data(index)
                    }
                })
            }
        }
        d.deserialize_str(TypeName)
    }
}

#[derive(Deserialize)]
#[serde(remote = "Self", tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum Data {
    Presence { value: Type, source: Source },
    Record { fields: Vec<DataField>, source: Source },
    #[serde(rename = "text-literal")] TextLiteral { value: String, source: Source },
    Tagged { discriminant: String, cases: Vec<TagCase>, source: Source },
}

#[derive(Deserialize)] #[serde(remote = "Self", deny_unknown_fields)]
pub struct TagCase { pub tag: String, pub payload: Type, pub source: Source }

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct DataField { pub name: String, #[serde(rename = "type")] pub ty: Type, pub source: Source }

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct RecordValue { pub name: String, pub value: Value }

#[derive(Debug, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct Source {
    pub file: String,
    pub start: u64,
    pub end: u64,
}

impl fmt::Display for Source {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}-{}", self.file, self.start, self.end)
    }
}

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct Binding {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub ty: Type,
    pub source: Source,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(remote = "Self", rename_all = "kebab-case")]
pub enum ControlMode { FixedInstance }

pub struct Input { pub binding: Binding, pub default: Option<Value>, pub control_mode: Option<ControlMode> }

// The public wire places `default` beside the ordinary binding members. Keep
// other binding roles strict and preserve duplicate-key checks on every input.
#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
struct InputFields {
    id: String,
    name: String,
    #[serde(rename = "type")]
    ty: Type,
    source: Source,
    #[serde(default, deserialize_with = "present")]
    default: Option<Value>,
    #[serde(default, rename = "controlMode", deserialize_with = "present")]
    control_mode: Option<ControlMode>,
}

impl<'de> Deserialize<'de> for Input {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let InputFields { id, name, ty, source, default, control_mode } = <InputFields as Deserialize>::deserialize(d)?;
        Ok(Self { binding: Binding { id, name, ty, source }, default, control_mode })
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(remote = "Self", rename_all = "lowercase")]
pub enum Op { Add, Multiply, Equal, Concat }

#[derive(Deserialize)]
#[serde(remote = "Self", tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum Value {
    Bool { value: bool },
    Number { bits: String },
    Text { value: String },
    #[serde(rename = "literal-text")] LiteralText { #[serde(rename = "type")] ty: Type },
    #[serde(rename = "widen-text")] WidenText { value: Box<Value> },
    Tagged { #[serde(rename = "type")] ty: Type, tag: String, payload: Box<Value> },
    Tag { value: Box<Value> },
    Tokens { values: Vec<String> },
    Record { #[serde(rename = "type")] ty: Type, fields: Vec<RecordValue> },
    Member { value: Box<Value>, field: String },
    #[serde(rename = "has-value")]
    HasValue { value: Box<Value> },
    Prop { id: String },
    Context { id: String },
    State { id: String },
    Capture { id: String },
    Local { id: String },
    Not { value: Box<Value> },
    Binary { op: Op, left: Box<Value>, right: Box<Value> },
    Call { #[serde(rename = "fn")] function: String, args: Vec<Value> },
}

#[derive(Deserialize)]
#[serde(remote = "Self", tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum Instruction {
    Let { binding: Binding, value: Value, source: Source },
    Write { target: String, value: Value, source: Source },
    Emit { target: String, value: Value, source: Source },
    Invoke { #[serde(rename = "fn")] function: String, args: Vec<Value>, source: Source },
    Start { task: String, args: Vec<Value>, source: Source },
    Cancel { task: String, source: Source },
}

impl Instruction {
    pub fn source(&self) -> &Source {
        match self {
            Self::Let { source, .. } | Self::Write { source, .. } | Self::Emit { source, .. }
            | Self::Invoke { source, .. } | Self::Start { source, .. } | Self::Cancel { source, .. } => source,
        }
    }
}

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct Edge { pub block: String, pub args: Vec<Value> }

#[derive(Deserialize)] #[serde(remote = "Self", deny_unknown_fields)]
pub struct MatchCase { pub tag: String, pub to: Edge }

// Missing optional properties are distinct from JSON null on this wire.
fn present<'de, D: Deserializer<'de>, T: Deserialize<'de>>(d: D) -> Result<Option<T>, D::Error> {
    T::deserialize(d).map(Some)
}

#[derive(Deserialize)]
#[serde(remote = "Self", tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum End {
    Return { #[serde(default, deserialize_with = "present")] value: Option<Value>, source: Source },
    Jump { to: Edge, source: Source },
    Branch { condition: Value, yes: Edge, no: Edge, source: Source },
    Presence { value: Value, present: Edge, omitted: Edge, source: Source },
    Match { value: Value, cases: Vec<MatchCase>, source: Source },
    Await { #[serde(rename = "extern")] external: String, args: Vec<Value>, resume: Edge, source: Source },
    Fail { reason: String, source: Source },
}

impl End {
    pub fn source(&self) -> &Source {
        match self {
            Self::Return { source, .. } | Self::Jump { source, .. } | Self::Branch { source, .. }
            | Self::Presence { source, .. } | Self::Fail { source, .. } | Self::Match { source, .. } | Self::Await { source, .. } => source,
        }
    }
}

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct Block {
    pub id: String,
    pub params: Vec<Binding>,
    pub instructions: Vec<Instruction>,
    pub end: End,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(remote = "Self", rename_all = "lowercase")]
pub enum Phase { Init, Pure, Action, Task }

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct Behavior {
    pub binding: Binding,
    pub phase: Phase,
    pub params: Vec<Binding>,
    pub dependencies: Vec<String>,
    pub entry: String,
    pub blocks: Vec<Block>,
}

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct Named {
    pub name: String,
    #[serde(rename = "fn")]
    pub function: String,
}

#[derive(Clone, Copy, Deserialize, Eq, PartialEq)]
#[serde(remote = "Self", rename_all = "lowercase")]
pub enum FieldKind { State, Capture }

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct Field { pub kind: FieldKind, pub binding: Binding, pub init: String }

#[derive(Clone, Copy, Deserialize, Eq, PartialEq)]
#[serde(remote = "Self", rename_all = "lowercase")]
pub enum Tag { Span, I, Section, Div, Button }

#[derive(Deserialize)]
#[serde(remote = "Self", tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum View {
    Text { value: String, source: Source },
    Child { component: String, key: String, props: Vec<ChildProp>, source: Source },
    Element {
        tag: Tag,
        source: Source,
        children: Vec<View>,
        #[serde(default, deserialize_with = "present")]
        style: Option<String>,
        #[serde(default, deserialize_with = "present")]
        disabled: Option<String>,
        #[serde(default, deserialize_with = "present")]
        activate: Option<String>,
    },
}

#[derive(Deserialize)] #[serde(remote = "Self", deny_unknown_fields)]
pub struct ChildProp { pub name: String, #[serde(rename = "fn")] pub function: String, pub source: Source }
#[derive(Deserialize)] #[serde(remote = "Self", deny_unknown_fields)]
pub struct Key {
    pub binding: Binding, #[serde(rename = "debugName")] pub debug_name: String,
    #[serde(default, rename = "exportName", deserialize_with = "present")] pub export_name: Option<String>,
}
#[derive(Deserialize)] #[serde(remote = "Self", deny_unknown_fields)]
pub struct Consume { pub key: String, pub binding: Binding }
#[derive(Deserialize)] #[serde(remote = "Self", deny_unknown_fields)]
pub struct Provide { pub key: String, #[serde(rename = "fn")] pub function: String, pub source: Source }

#[derive(Clone, Copy, Deserialize)] #[serde(remote = "Self", rename_all = "lowercase")]
pub enum Policy { Latest, Parallel, Serial }

#[derive(Deserialize)] #[serde(remote = "Self", deny_unknown_fields)]
pub struct TaskDef { #[serde(rename = "fn")] pub function: String, pub policy: Policy, pub source: Source }

#[derive(Deserialize)] #[serde(remote = "Self", deny_unknown_fields)]
pub struct Extern {
    pub binding: Binding, pub name: String, pub params: Vec<Binding>, pub effect: String,
    pub lifetime: String, #[serde(rename = "async")] pub asynchronous: bool, pub targets: Vec<String>,
}

// Flattening through a generic JSON map would lose duplicate-field diagnostics.
// Both legal record shapes use the same strict, map-only wire decoder.
macro_rules! component_record {
    ($name:ident { $($extra:tt)* }) => {
        #[derive(Deserialize)] #[serde(remote = "Self", deny_unknown_fields)]
        pub struct $name {
            $($extra)*
            pub id: String, pub name: String,
            #[serde(default, rename = "prototypeName", deserialize_with = "present")]
            pub prototype_name: Option<String>,
            pub source: Source, pub props: Vec<Input>, pub fields: Vec<Field>, pub signals: Vec<Binding>,
            pub behaviors: Vec<Behavior>, pub projections: Vec<Named>, pub actions: Vec<Named>,
            pub consumes: Vec<Consume>, pub provides: Vec<Provide>, pub view: View,
            pub tasks: Vec<TaskDef>, pub created: Vec<String>,
        }
    };
}
component_record!(Component {});
component_record!(RootFields { pub version: u32, pub types: Vec<Data>, pub keys: Vec<Key>, pub externs: Vec<Extern>, pub components: Vec<Component>, });

pub struct Unit { pub version: u32, pub types: Vec<Data>, pub keys: Vec<Key>, pub externs: Vec<Extern>, pub bodies: Vec<Component> }
impl<'de> Deserialize<'de> for Unit {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let RootFields { version, types, keys, externs, components, id, name, prototype_name, source, props, fields, signals, behaviors, projections, actions, consumes, provides, tasks, created, view } = <RootFields as Deserialize>::deserialize(d)?;
        let mut bodies = Vec::with_capacity(components.len() + 1);
        bodies.push(Component { id, name, prototype_name, source, props, fields, signals, behaviors, projections, actions, consumes, provides, tasks, created, view });
        bodies.extend(components);
        Ok(Self { version, types, keys, externs, bodies })
    }
}
