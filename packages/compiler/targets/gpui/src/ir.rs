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

object_only!(Source, Binding, Value, Instruction, Edge, End, Block, Behavior, Named, Field, View, Component);

// An externally tagged Serde unit variant normally also accepts {"tag":null}.
// The IR spells types, phases, operators and roles exclusively as strings.
macro_rules! string_only {
    ($($ty:ident),+ $(,)?) => { $(
        impl<'de> Deserialize<'de> for $ty {
            fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                struct Tag;
                impl<'de> serde::de::Visitor<'de> for Tag {
                    type Value = $ty;
                    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                        write!(f, "a {} string", stringify!($ty))
                    }
                    fn visit_str<E: serde::de::Error>(self, text: &str) -> Result<$ty, E> {
                        $ty::deserialize(serde::de::value::StrDeserializer::new(text))
                    }
                }
                d.deserialize_str(Tag)
            }
        }
    )+ };
}

string_only!(Type, Op, Phase, FieldKind, Role);

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(remote = "Self", rename_all = "lowercase")]
pub enum Type { Bool, Number, Text, Unit }

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
#[serde(remote = "Self", rename_all = "lowercase")]
pub enum Op { Add, Multiply, Equal, Concat }

#[derive(Deserialize)]
#[serde(remote = "Self", tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum Value {
    Bool { value: bool },
    Number { bits: String },
    Text { value: String },
    Prop { id: String },
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
}

impl Instruction {
    pub fn source(&self) -> &Source {
        match self {
            Self::Let { source, .. } | Self::Write { source, .. } | Self::Emit { source, .. }
            | Self::Invoke { source, .. } => source,
        }
    }
}

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct Edge { pub block: String, pub args: Vec<Value> }

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
    Fail { reason: String, source: Source },
}

impl End {
    pub fn source(&self) -> &Source {
        match self {
            Self::Return { source, .. } | Self::Jump { source, .. } | Self::Branch { source, .. }
            | Self::Fail { source, .. } => source,
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
pub enum Phase { Init, Pure, Action }

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
pub enum Role { Text, Button }

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct View {
    pub role: Role,
    pub text: String,
    #[serde(default, deserialize_with = "present")]
    pub disabled: Option<String>,
    #[serde(default, deserialize_with = "present")]
    pub activate: Option<String>,
}

#[derive(Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub struct Component {
    pub version: u32,
    pub name: String,
    pub source: Source,
    pub props: Vec<Binding>,
    pub fields: Vec<Field>,
    pub signals: Vec<Binding>,
    pub behaviors: Vec<Behavior>,
    pub projections: Vec<Named>,
    pub actions: Vec<Named>,
    pub view: View,
}
