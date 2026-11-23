import { rustStringToNumberSource, rustNumberToStringSource } from './rust-scalar-semantics';
/** Native storage and ECMAScript value primitives. Authored algorithms stay in Component.rs. */
export const gpuiNativeValuesSource = String.raw`
${rustStringToNumberSource}${rustNumberToStringSource}// Source descriptors are diagnostic/type-checking metadata, not key identity.
// Each generated Rust module owns one OnceLock token per declaration; two
// independent crates with the same source ID cannot accidentally share Context.
#[derive(Clone)]
pub struct NativeContextKey { token:std::sync::Arc<()>, descriptor:String }
impl PartialEq for NativeContextKey {fn eq(&self,other:&Self)->bool{std::sync::Arc::ptr_eq(&self.token,&other.token)}}
impl Eq for NativeContextKey {}
impl PartialOrd for NativeContextKey {fn partial_cmp(&self,other:&Self)->Option<std::cmp::Ordering>{Some(self.cmp(other))}}
impl Ord for NativeContextKey {fn cmp(&self,other:&Self)->std::cmp::Ordering{(std::sync::Arc::as_ptr(&self.token)as usize).cmp(&(std::sync::Arc::as_ptr(&other.token)as usize))}}
pub fn native_context_key(slot:&'static std::sync::OnceLock<NativeContextKey>,descriptor:&str)->Value {
    Value::ContextKey(slot.get_or_init(||NativeContextKey{token:std::sync::Arc::new(()),descriptor:descriptor.into()}).clone())
}
fn context_identity(key:Value)->NativeContextKey {match key{Value::ContextKey(key)=>key,_=>value_type_error("Expected a nominal ContextKey")}}
// A structural record type describes fields, not ownership. Cloning a Value
// preserves its allocation; only an explicit host snapshot copies the fields.
pub struct NativeRecord { pub fields:RefCell<BTreeMap<String,Value>>, frozen:Cell<bool> }
pub fn record_map(fields:BTreeMap<String,Value>)->Value {
    Value::Record(Rc::new(NativeRecord{fields:RefCell::new(fields),frozen:Cell::new(false)}))
}
pub fn freeze(value:Value)->Value { if let Value::Record(record)=&value{record.frozen.set(true);}value }
pub fn set_member(object:Value,key:&str,value:Value)->Value {
    let Value::Record(record)=object else { value_type_error("Property assignment requires an object") };
    if record.frozen.get(){value_type_error("Cannot assign to a frozen object")}
    record.fields.borrow_mut().insert(key.into(),value.clone());value
}
pub fn value_type_error(message:&str)->! {
    throw_value(record(vec![("name",Value::string("TypeError")),("message",Value::string(message))]))
}
pub fn value_error(message:&str)->! {
    throw_value(record(vec![("name",Value::string("Error")),("message",Value::string(message))]))
}
pub fn typeof_value(value:&Value)->Value { Value::string(match value {
    Value::Undefined=>"undefined",Value::Number(_)|Value::Json(Json::Number(_))=>"number",
    Value::Json(Json::Bool(_))=>"boolean",Value::Json(Json::String(_))|Value::CaughtStringUnit(_)=>"string",
    Value::Function(_)|Value::NativeFunction{..}|Value::Renderer(_)=>"function",_=>"object",
}) }
pub fn property_key(value:&Value)->String { match value {
    Value::Number(value) if *value==0.=>"0".into(),Value::Number(value) if *value==f64::INFINITY=>"Infinity".into(),
    Value::Number(value) if *value==f64::NEG_INFINITY=>"-Infinity".into(),_=>value.scalar_text(),
} }
impl Value { pub fn error_message(&self)->String{if matches!(self,Self::Undefined){String::new()}else{self.scalar_text()}} }
pub fn number_is_finite(value:&Value)->Value { Value::boolean(match value {
    Value::Number(value)=>value.is_finite(),Value::Json(Json::Number(value))=>value.as_f64().is_some_and(f64::is_finite),_=>false,
}) }
// ECMAScript's nearest integer ties toward positive infinity. Rust round()
// rounds ties away from zero; adding 0.5 first also loses adjacent-double cases.
pub fn math_round(value:Value)->Value {
    let value=value.num();
    let result=if !value.is_finite()||value==0.{value}
        else if value>=-0.5&&value<0.{-0.0}
        else {let floor=value.floor();if value-floor<0.5{floor}else{floor+1.}};
    Value::number(result)
}
pub fn has_own(value:&Value,key:&Value)->Value {
    let key=property_key(key);Value::boolean(match value {
        Value::Record(record)=>record.fields.borrow().contains_key(&key),
        Value::Json(Json::Object(record))=>record.contains_key(&key),
        Value::Array(items)=>key=="length"||key.parse::<usize>().ok().is_some_and(|index|index.to_string()==key&&index<items.len()),
        Value::Json(Json::String(text))=>key=="length"||key.parse::<usize>().ok().is_some_and(|index|index.to_string()==key&&index<text.encode_utf16().count()),
        Value::Undefined|Value::Json(Json::Null)=>value_type_error("Cannot inspect own properties of a nullish value"),_=>false,
    })
}
pub fn own_entries(value:Value)->BTreeMap<String,Value> { match value {
    Value::Record(record)=>record.fields.borrow().clone(),
    Value::Json(Json::Object(record))=>record.into_iter().map(|(key,value)|(key,Value::json(value))).collect(),
    Value::Array(items)=>items.iter().enumerate().map(|(index,value)|(index.to_string(),value.clone())).collect(),
    Value::Json(Json::String(text))=>text.encode_utf16().enumerate().map(|(index,value)|(index.to_string(),Value::CaughtStringUnit(value))).collect(),
    _=>BTreeMap::new(),
} }
pub fn array_every(value:Value,callback:Value)->Value {
    let values=value.items();let mut all=true;
    for(index,item)in values.into_iter().enumerate(){if !callback.call_authored(vec![item,Value::number(index as f64),value.clone()]).truthy(){all=false;break}}
    Value::boolean(all)
}
// Captured declarations are allocated before initializers. Reading a slot is
// delayed until execution, so forward and mutually recursive closures observe
// the same binding and the source temporal dead zone.
pub trait LexicalLifetime { fn clear(&self); }
struct LexicalStorage<T:Clone> { value:RefCell<Option<T>> }
impl<T:Clone> LexicalLifetime for LexicalStorage<T> { fn clear(&self){self.value.borrow_mut().take();} }
pub struct LexicalBinding<T:Clone> { storage:Rc<LexicalStorage<T>> }
impl<T:Clone> Clone for LexicalBinding<T> { fn clone(&self)->Self{Self{storage:self.storage.clone()}} }
impl<T:Clone> LexicalBinding<T> {
    pub fn initialize(&self,value:T){let mut current=self.storage.value.borrow_mut();assert!(current.is_none(),"lexical binding initialized twice");*current=Some(value);}
    pub fn read(&self)->T{self.storage.value.borrow().as_ref().cloned().unwrap_or_else(||throw_value(record(vec![("name",Value::string("ReferenceError")),("message",Value::string("Cannot access a binding before initialization"))])))}
}
thread_local!{static LEXICAL_OWNERS:RefCell<Vec<OwnerWeak>>=const{RefCell::new(Vec::new())};}
pub struct LexicalOwnerGuard;
pub fn enter_lexical_owner(owner:&OwnerWeak)->LexicalOwnerGuard{LEXICAL_OWNERS.with(|owners|owners.borrow_mut().push(owner.clone()));LexicalOwnerGuard}
impl Drop for LexicalOwnerGuard{fn drop(&mut self){LEXICAL_OWNERS.with(|owners|{owners.borrow_mut().pop();});}}
pub fn lexical_binding<T:Clone+'static>()->LexicalBinding<T> {
    let storage=Rc::new(LexicalStorage{value:RefCell::new(None)});
    let owner=LEXICAL_OWNERS.with(|owners|owners.borrow().last().cloned()).expect("captured lexical allocation requires its native invocation owner");
    let erased:Rc<dyn LexicalLifetime>=storage.clone();let owner=ensure(&owner);let mut owner=owner.borrow_mut();
    owner.lexical_slots.retain(|slot|slot.strong_count()>0);owner.lexical_slots.push(Rc::downgrade(&erased));
    LexicalBinding{storage}
}
fn clear_lexicals(owner:&OwnerRef){let slots=std::mem::take(&mut owner.borrow_mut().lexical_slots);for slot in slots{if let Some(slot)=slot.upgrade(){slot.clear();}}}
`;
