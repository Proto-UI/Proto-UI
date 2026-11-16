/** Native storage and ECMAScript value primitives. Authored algorithms stay in Component.rs. */
export const gpuiNativeValuesSource = String.raw`
// These are scalar conversion primitives, not an evaluator for authored IR.
// StringToNumber accepts the ECMAScript numeric-string grammar; Rust's FromStr
// additionally accepts inf/infinity and has a different whitespace predicate.
fn ecma_numeric_space(value:char)->bool { matches!(value,
    '\u{0009}'..='\u{000d}'|'\u{0020}'|'\u{00a0}'|'\u{1680}'|
    '\u{2000}'..='\u{200a}'|'\u{2028}'|'\u{2029}'|'\u{202f}'|'\u{205f}'|'\u{3000}'|'\u{feff}') }
fn ecma_radix_number(text:&str,radix:u8,width:u32)->f64 {
    if text.is_empty(){return f64::NAN}
    let(mut bits,mut significand,mut guard,mut sticky)=(0usize,0u64,false,false);
    for byte in text.bytes(){
        let digit=match byte{b'0'..=b'9'=>byte-b'0',b'a'..=b'f'=>byte-b'a'+10,b'A'..=b'F'=>byte-b'A'+10,_=>return f64::NAN};
        if digit>=radix{return f64::NAN}
        for shift in (0..width).rev(){
            let bit=(digit>>shift)&1;
            if bits==0&&bit==0{continue}
            bits=(bits+1).min(1025);
            if bits<=53{significand=(significand<<1)|u64::from(bit)}
            else if bits==54{guard=bit!=0}else{sticky|=bit!=0}
        }
    }
    if bits<=53{return significand as f64}
    if bits>1024{return f64::INFINITY}
    // Binary/octal/hexadecimal are powers of two. Round the exact integer once,
    // including halfway cases, instead of repeatedly rounding an f64 accumulator.
    if guard&&(sticky||significand&1!=0){significand+=1}
    (significand as f64)*2f64.powi((bits-53)as i32)
}
fn ecma_string_number(text:&str)->f64 {
    let text=text.trim_matches(ecma_numeric_space);
    if text.is_empty(){return 0.}
    match text{"Infinity"|"+Infinity"=>return f64::INFINITY,"-Infinity"=>return f64::NEG_INFINITY,_=>{}}
    if let Some(digits)=text.strip_prefix("0x").or_else(||text.strip_prefix("0X")){return ecma_radix_number(digits,16,4)}
    if let Some(digits)=text.strip_prefix("0b").or_else(||text.strip_prefix("0B")){return ecma_radix_number(digits,2,1)}
    if let Some(digits)=text.strip_prefix("0o").or_else(||text.strip_prefix("0O")){return ecma_radix_number(digits,8,3)}
    let bytes=text.as_bytes();let mut index=0;
    if matches!(bytes.first(),Some(b'+'|b'-')){index+=1}
    let mut digits=0;
    while bytes.get(index).is_some_and(u8::is_ascii_digit){index+=1;digits+=1}
    if bytes.get(index)==Some(&b'.'){
        index+=1;while bytes.get(index).is_some_and(u8::is_ascii_digit){index+=1;digits+=1}
    }
    if digits==0{return f64::NAN}
    if matches!(bytes.get(index),Some(b'e'|b'E')){
        index+=1;if matches!(bytes.get(index),Some(b'+'|b'-')){index+=1}
        let start=index;while bytes.get(index).is_some_and(u8::is_ascii_digit){index+=1}
        if index==start{return f64::NAN}
    }
    if index!=bytes.len(){return f64::NAN}
    text.parse().unwrap_or(f64::NAN)
}
fn ecma_number_text(value:f64)->String {
    if value.is_nan(){return "NaN".into()}
    if value==0.{return "0".into()}
    if value==f64::INFINITY{return "Infinity".into()}
    if value==f64::NEG_INFINITY{return "-Infinity".into()}
    // Use the existing JSON dependency's shortest correctly rounded digits.
    // Rust Display rounds decimal halfway cases away from zero (e.g. 2^-25),
    // whereas the source operator reference uses the even final decimal digit.
    // Only the digits are reused; apply Number::toString's own layout below.
    let shortest=serde_json::Number::from_f64(value.abs()).expect("finite native number").to_string();
    let (mantissa,exponent)=shortest.split_once('e').or_else(||shortest.split_once('E'))
        .map(|(digits,exponent)|(digits,exponent.parse::<i32>().expect("native float exponent")))
        .unwrap_or((&shortest,0));
    let decimal=mantissa.find('.').unwrap_or(mantissa.len())as i32+exponent;
    let all=mantissa.replace('.',"");let leading=all.bytes().take_while(|digit|*digit==b'0').count();
    let digits=all[leading..].trim_end_matches('0');let n=decimal-leading as i32;let k=digits.len()as i32;
    let text=if k<=n&&n<=21{format!("{digits}{}","0".repeat((n-k)as usize))}
        else if 0<n&&n<=21{format!("{}.{}",&digits[..n as usize],&digits[n as usize..])}
        else if -6<n&&n<=0{format!("0.{}{digits}","0".repeat((-n)as usize))}
        else{let fraction=if k==1{String::new()}else{format!(".{}",&digits[1..])};format!("{}{fraction}e{:+}",&digits[..1],n-1)};
    if value.is_sign_negative(){format!("-{text}")}else{text}
}
// Source descriptors are diagnostic/type-checking metadata, not key identity.
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
