import { rustNumberToStringSource, rustStringToNumberSource } from './rust-scalar-semantics';

export type RustDataSupportFeature = 'array' | 'string-number' | 'number-text';

/** Reached Rust language primitives; no generic Value, object map or IR evaluator. */
export function rustDataSupport(features: ReadonlySet<RustDataSupportFeature>): string {
  return String.raw`
use std::rc::Rc;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DataError {
    InvalidType(&'static str),
    NonFiniteNumber,
    InvalidString,
    NullishProperty,
}
impl std::fmt::Display for DataError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{self:?}") }
}
impl std::error::Error for DataError {}

/// The source language's undefined value, distinct from null and an omitted optional field.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Undefined;

${
  features.has('array')
    ? String.raw`
/// Typed immutable array. Clones preserve the authored array's reference identity.
#[derive(Clone, Debug)]
pub struct DataArray<T> { items: Rc<Vec<T>>, identity: Rc<()> }
impl<T> DataArray<T> {
    pub fn new(items: Vec<T>) -> Self { Self { items: Rc::new(items), identity: Rc::new(()) } }
    pub fn as_slice(&self) -> &[T] { self.items.as_slice() }
}
impl<T> From<Vec<T>> for DataArray<T> { fn from(items: Vec<T>) -> Self { Self::new(items) } }
impl<T> std::ops::Deref for DataArray<T> {
    type Target = [T];
    fn deref(&self) -> &[T] { self.as_slice() }
}
`
    : ''
}
${features.has('string-number') ? rustStringToNumberSource : ''}
${features.has('number-text') ? rustNumberToStringSource : ''}
`;
}
