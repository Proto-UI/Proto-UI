// This is ordinary emitted Rust support, not an IR interpreter. Every authored
// function and semantic operation is compiled into Component.rs.
import { gpuiNativeAsyncSource } from './gpui-native-async';
import { gpuiNativeAuthoredHooksSource } from './gpui-native-authored-hooks';
import { gpuiNativeValuesSource } from './gpui-native-values';
import { gpuiNativeModulesSource } from './gpui-native-modules';
import { gpuiNativeTopologySource } from './gpui-native-topology';
import { gpuiNativeTableSource } from './gpui-native-table';
import { gpuiNativeBoundarySource } from './gpui-native-boundary';
import { gpuiNativeScrollSource } from './gpui-native-scroll';
import { gpuiNativeTextSource } from './gpui-native-text';
import { gpuiNativeImageSource } from './gpui-native-image';
import { gpuiNativePositioningSource } from './gpui-native-positioning';
import { gpuiNativeOverlaySource } from './gpui-native-overlay';
import { gpuiNativeControlLabelSource } from './gpui-native-control-label';
import { gpuiNativeNotifySource } from './gpui-native-notify';
import { gpuiNativeHoverSource } from './gpui-native-hover';
import { gpuiNativeSelectionSource } from './gpui-native-selection';
import { gpuiNativeKeyBoundarySource } from './gpui-native-key-boundary';

export const gpuiNativeOwnerSource =
  String.raw`use std::{cell::{Cell, RefCell}, collections::{BTreeMap, BTreeSet, VecDeque}, rc::{Rc, Weak}};
use serde_json::{Value as Json, Map};
use gpui::{prelude::*, AnyElement, App, Bounds, FocusHandle, Pixels, Window, div, canvas};
pub type OwnerRef = Rc<RefCell<Owner>>;
pub type OwnerWeak = Weak<RefCell<Owner>>;
pub type Callback = Rc<dyn Fn(Vec<Value>) -> Value>;
// Native frame factories capture an authored-render snapshot; they do not store
// semantic tags or re-run the authored render function during native repaint.
pub type NativeRenderer = Rc<dyn Fn(Vec<Value>) -> NativeSnapshot>;
// Checked rendering is an additional use of the original authored callable.
// Keep its identity and scalar invocation separate from the native conversion;
// a hook's captured render field remains the same JavaScript function.
pub struct RendererAdapter { pub callable:Value, pub render:NativeRenderer, public_owner:Option<OwnerWeak> }
pub fn capture_renderer(callable:Value,render:NativeRenderer)->Value {
    Value::Renderer(Rc::new(RendererAdapter{callable,render,public_owner:None}))
}
// A native helper is an ordinary typed closure with its own runtime identity.
// Its identity is independent of both its FunctionIR declaration and child snapshots.
pub struct NativeCallable<F:?Sized> { pub identity:Rc<()>, pub call:Rc<F>, pub ordinary:Option<Value> }
impl<F:?Sized> Clone for NativeCallable<F> {
    fn clone(&self)->Self { Self { identity:self.identity.clone(), call:self.call.clone(), ordinary:self.ordinary.clone() } }
}
impl<F:?Sized> NativeCallable<F> {
    pub fn truthy(&self)->bool { true }
    pub fn nullish(&self)->bool { false }
    pub fn equals_native<G:?Sized>(&self,other:&NativeCallable<G>)->bool { Rc::ptr_eq(&self.identity,&other.identity) }
    pub fn equals_value(&self,other:&Value)->bool { self.ordinary.as_ref().map(|value|strict_equal(value,other)).unwrap_or_else(||matches!(other.callable_value(),Value::NativeFunction{identity,..} if Rc::ptr_eq(&self.identity,identity))) }
}
pub type NativeFrame = Rc<dyn Fn(&OwnerRef,&FocusHandle,&str,&Drive,&[NativeSnapshot],&mut usize)->Vec<AnyElement>>;
#[derive(Clone)]
pub struct NativeSnapshot { pub identity:Rc<()>, pub frame:NativeFrame, pub text:Rc<dyn Fn(&[NativeSnapshot])->String>, pub observation:Option<Value>, pub valid:bool, pub slot_count:u8, pub passive_content:bool }
impl NativeSnapshot {
    // C-TEMPLATE-0005: count authored insertion points, not external native
    // children. Saturating at two is sufficient to reject duplicates without
    // overflow. This is validation metadata, never a semantic node/tag plan.
    pub fn assert_children(&self) {
        if !self.valid{value_error("invalid template children")}
        if self.slot_count>1{value_error("a render output permits at most one anonymous slot")}
    }

    // Scalar observations preserve authored operations before a result is used
    // as children. No native node is boxed into Value or a semantic tree.
    pub fn scalar_value(&self)->Value{self.observation.clone().expect("structural template is not scalar data")}
    pub fn scalar_number(&self)->f64{self.scalar_value().scalar_number()}
    pub fn scalar_text(&self)->String{self.scalar_value().scalar_text()}
    pub fn text(&self)->String{self.scalar_value().text()}
    pub fn member(&self,key:&str,optional:bool)->Value{self.scalar_value().member(key,optional)}

    pub fn truthy(&self)->bool{self.observation.as_ref().map(Value::truthy).unwrap_or(true)}
    pub fn nullish(&self)->bool{self.observation.as_ref().is_some_and(Value::nullish)}
    pub fn equals(&self,other:&Self)->bool{match(&self.observation,&other.observation){(Some(a),Some(b))=>strict_equal(a,b),(None,None)=>Rc::ptr_eq(&self.identity,&other.identity),_=>false}}
    pub fn equals_value(&self,other:&Value)->bool{self.observation.as_ref().is_some_and(|value|strict_equal(value,other))}
    pub fn invalid(value:Value)->Self{let mut result=Self::empty();result.observation=Some(value);result.valid=false;result}
    pub fn text_value(value:Value)->Self{assert!(value.is_string()||matches!(&value,Value::Number(_)|Value::Json(Json::Number(_))),"native text children require string or number");let text=value.scalar_text();let frame_text=text.clone();Self{identity:Rc::new(()),observation:Some(value),valid:true,slot_count:0,passive_content:true,frame:Rc::new(move|_,_,_,_,_,index|{*index+=1;vec![frame_text.clone().into_any_element()]}),text:Rc::new(move|_|text.clone())}}
    // These are ordinary native child factories, not tagged template/IR nodes.
    pub fn sequence(children:Vec<Self>,observation:Option<Value>)->Self{let passive_content=children.iter().all(|child|child.passive_content);let valid=children.iter().all(|child|child.valid);let slot_count=children.iter().fold(0u8,|count,child|count.saturating_add(child.slot_count).min(2));let frame_children=children.clone();Self{identity:Rc::new(()),observation:Some(observation.unwrap_or_else(||Value::Opaque(Rc::new(())))),valid,slot_count,passive_content,
        frame:Rc::new(move|owner,focus,path,drive,slot,index|{let mut result=Vec::new();for child in &frame_children{result.extend((child.frame)(owner,focus,path,drive,slot,index));}result}),
        text:Rc::new(move|slot|children.iter().map(|child|(child.text)(slot)).collect::<Vec<_>>().join("")),}}

    pub fn empty()->Self { Self { identity:Rc::new(()),frame:Rc::new(|_,_,_,_,_,_|Vec::new()), text:Rc::new(|_|String::new()), observation:Some(Value::Json(Json::Null)),valid:true,slot_count:0,passive_content:true } }
    pub fn slot()->Self { Self { identity:Rc::new(()),observation:None,valid:true,slot_count:1,passive_content:true,
        frame:Rc::new(|owner,focus,path,drive,slot,index|{let mut result=Vec::new();for child in slot{result.extend((child.frame)(owner,focus,path,drive,&[],index));}result}),
        text:Rc::new(|slot|slot.iter().map(|child|(child.text)(&[])).collect::<Vec<_>>().join("")),
    } }
    pub fn native_view(view:gpui::AnyView)->Self { Self { identity:Rc::new(()),observation:None,valid:true,slot_count:0,passive_content:false, frame:Rc::new(move|owner,_,_,_,_,index|{*index+=1;vec![control_label_native_child(owner,view.clone().into_any_element())]}),text:Rc::new(|_|String::new()) } }
}
// External slot children are already native factories. Validate the whole
// incoming collection before replacing the retained slot; no semantic walk.
pub fn assert_native_slot_children(children:&[NativeSnapshot]) {
    for child in children {
        child.assert_children();
        if child.slot_count!=0{value_error("external native children cannot contain the receiving owner's slot marker")}
    }
}
#[derive(Clone)]
pub enum Value {
    Undefined, Opaque(Rc<()>), ContextKey(NativeContextKey), Number(f64), Json(Json), Record(Rc<NativeRecord>), Array(Rc<Vec<Value>>), CaughtStringUnit(u16), Utf16String(Rc<Vec<u16>>),
    Function(Callback), NativeFunction{identity:Rc<()>,render:NativeRenderer}, Renderer(Rc<RendererAdapter>), Owner(OwnerWeak), DefinitionOwner(OwnerWeak), RenderOwner(OwnerWeak), State(Rc<State>), BorrowedState(Rc<State>),
    Style(Vec<(String, String)>), Resource(Rc<Cell<bool>>),
    Input(Rc<Input>), ControlLabelRequest(Rc<ControlLabelRequest>),
    StaticCapability(&'static StaticDeclaration), Handle(OwnerWeak, &'static str),
    Observed(OwnerWeak, &'static str), Part(OwnerWeak, String), ObjectRef(OwnerWeak), HostTarget(OwnerWeak),
}
// Diagnostics must not recursively traverse arbitrary authored records or
// execute their callables. Public Result APIs can still use ordinary Rust
// expect/unwrap without requiring every capability to implement Debug.
impl std::fmt::Debug for Value {
    fn fmt(&self,output:&mut std::fmt::Formatter<'_>)->std::fmt::Result{match self{
        Self::Undefined=>output.write_str("undefined"),Self::Number(value)=>std::fmt::Debug::fmt(value,output),Self::Json(value)=>std::fmt::Debug::fmt(value,output),
        Self::Record(record)=>{let fields=record.fields.borrow();let scalars:Vec<_>=fields.iter().filter_map(|(name,value)|match value{Self::Undefined|Self::Number(_)|Self::Json(Json::Null|Json::Bool(_)|Json::Number(_)|Json::String(_))=>Some((name,value)),_=>None}).collect();output.debug_struct("AuthoredRecord").field("scalar_fields",&scalars).finish()},
        Self::Array(items)=>output.debug_struct("AuthoredArray").field("length",&items.len()).finish(),
        Self::Function(_)|Self::NativeFunction{..}|Self::Renderer(_)=>output.write_str("[authored callable]"),_=>output.write_str("[native capability]"),
    }}
}
#[derive(Debug)]
pub struct NativeFailure {pub phase:String,pub error:Value}
pub fn report_native_failure(owner:&OwnerRef,phase:&str,error:Value){
    eprintln!("[Proto-UI:{phase}] authored callback failed: {error:?}");
    owner.borrow_mut().failures.push(NativeFailure{phase:phase.into(),error});
}
// GPUI leases are not unwind-safe. Host callbacks without a Result return
// channel report exact authored errors while returning normally to GPUI.
pub fn native_host_callback<T>(owner:&OwnerRef,phase:&str,body:impl FnOnce()->T)->Option<T>{
    match catch_authored(body){Ok(value)=>Some(value),Err(error)=>{report_native_failure(owner,phase,error);None}}
}
pub fn take_native_failures(owner:&OwnerRef)->Vec<NativeFailure>{std::mem::take(&mut owner.borrow_mut().failures)}
impl Value {
    pub fn json(value: Json) -> Self { match value { Json::Object(entries)=>record_map(entries.into_iter().map(|(key,value)|(key,Self::json(value))).collect()),Json::Array(items)=>Self::Array(Rc::new(items.into_iter().map(Self::json).collect())),Json::Number(number)=>Self::Number(number.as_f64().expect("JSON number")),other=>Self::Json(other) } }
    pub fn string(value: &str) -> Self { Self::Json(Json::String(value.into())) }
    pub fn from_string_units(units:Vec<u16>)->Self{match String::from_utf16(&units){Ok(text)=>Self::string(&text),Err(_)=>Self::Utf16String(Rc::new(units))}}
    pub fn is_string(&self)->bool{matches!(self,Self::Json(Json::String(_))|Self::CaughtStringUnit(_)|Self::Utf16String(_))}
    pub fn boolean(value: bool) -> Self { Self::Json(Json::Bool(value)) }
    pub fn number(value: f64) -> Self { Self::Number(value) }
    pub fn try_data(&self) -> Option<Json> { match self {
        Self::Number(value) => value.is_finite().then(||Json::from(*value)),
        Self::Json(value) => Some(value.clone()),
        Self::Record(entries) => entries.fields.borrow().iter().map(|(key,value)|Some((key.clone(),value.try_data()?))).collect::<Option<Map<String,Json>>>().map(Json::Object),
        Self::Array(items) => items.iter().map(Self::try_data).collect::<Option<Vec<_>>>().map(Json::Array),
        Self::CaughtStringUnit(_)|Self::Utf16String(_) => String::from_utf16(&self.string_units()).ok().map(Json::String),
        _ => None,
    } }
    pub fn data(&self) -> Json { match self {
        Self::Number(value)=>{if !value.is_finite(){value_type_error("non-finite portable data")}Json::from(*value)},Self::Json(value) => value.clone(),
        Self::Record(value) => Json::Object(value.fields.borrow().iter().map(|(k,v)|(k.clone(),v.data())).collect()),
        Self::Array(value) => Json::Array(value.iter().map(Self::data).collect()),
        Self::CaughtStringUnit(_)|Self::Utf16String(_) => self.try_data().unwrap_or_else(||value_type_error("unpaired UTF-16 units cannot cross the native UTF-8 data boundary")),
        _ => value_type_error("semantic capability is not portable data"),
    } }
    pub fn member(&self, key: &str, optional: bool) -> Self { match self {
        Self::Undefined | Self::Json(Json::Null) if optional => Self::Undefined,
        Self::Json(Json::Object(value)) => value.get(key).cloned().map(Self::json).unwrap_or(Self::Undefined),
        Self::Record(value) => value.fields.borrow().get(key).cloned().unwrap_or(Self::Undefined),
        Self::Array(value) => if key=="length"{Self::number(value.len()as f64)}else{key.parse::<usize>().ok().and_then(|index|value.get(index).cloned()).unwrap_or(Self::Undefined)},
        Self::Input(_) if key=="control" => self.clone(),
        Self::Input(value) => value.fields.get(key).cloned().map(Self::Json).unwrap_or(Self::Undefined),
        Self::ControlLabelRequest(request) if key == "source" => Self::string(request.source),
        Self::ContextKey(_) if key=="__brand" => Self::string("ContextKey"),
        Self::Handle(owner, kind) => capability_member(owner, kind, key),
        Self::Part(_, role) if key == "role" => Self::string(role),
        _ => self.caught_member(key, optional),
    } }
    pub fn caught_member(&self, key:&str, optional:bool)->Self { match self {
        Self::Undefined | Self::Json(Json::Null) if optional => Self::Undefined,
        Self::Undefined | Self::Json(Json::Null) => throw_value(record(vec![("name",Self::string("TypeError")),("message",Self::string("Cannot read a property of a nullish value"))])),
        Self::Json(Json::String(value)) if key=="length" => Self::number(value.encode_utf16().count()as f64),
        Self::Json(Json::String(value)) => key.parse::<usize>().ok().filter(|index|index.to_string()==key).and_then(|index|value.encode_utf16().nth(index)).map(Self::CaughtStringUnit).unwrap_or(Self::Undefined),
        Self::CaughtStringUnit(_) if key=="length" => Self::number(1.),
        Self::CaughtStringUnit(value) if key=="0" => Self::CaughtStringUnit(*value),
        Self::Utf16String(units) if key=="length" => Self::number(units.len()as f64),
        Self::Utf16String(units) => key.parse::<usize>().ok().filter(|index|index.to_string()==key).and_then(|index|units.get(index)).map(|value|Self::CaughtStringUnit(*value)).unwrap_or(Self::Undefined),
        Self::Array(items) => if key=="length" { Self::number(items.len()as f64) } else { key.parse::<usize>().ok().filter(|index|index.to_string()==key).and_then(|index|items.get(index).cloned()).unwrap_or(Self::Undefined) },
        Self::Json(Json::Array(items)) => if key=="length" { Self::number(items.len()as f64) } else { key.parse::<usize>().ok().filter(|index|index.to_string()==key).and_then(|index|items.get(index).cloned()).map(Self::json).unwrap_or(Self::Undefined) },
        Self::Record(_) | Self::Json(Json::Object(_)) => self.member(key,optional),
        _ => Self::Undefined,
    } }
    pub fn text(&self) -> String { match self { Self::Json(Json::String(v))=>v.clone(),Self::CaughtStringUnit(_)|Self::Utf16String(_)=>String::from_utf16(&self.string_units()).unwrap_or_else(|_|value_type_error("unpaired UTF-16 units cannot cross the native UTF-8 text boundary")), Self::Number(v)=>ecma_number_text(*v),Self::Json(Json::Number(v))=>ecma_number_text(v.as_f64().unwrap()), _=>value_type_error("expected string or number") } }
    pub fn string_units(&self)->Vec<u16>{match self{Self::Json(Json::String(value))=>value.encode_utf16().collect(),Self::CaughtStringUnit(value)=>vec![*value],Self::Utf16String(units)=>(**units).clone(),_=>value_type_error("expected string")}}
    pub fn string_value(&self)->Self{if self.is_string(){self.clone()}else{Self::string(&self.scalar_text())}}
    pub fn scalar_units(&self)->Vec<u16>{if self.is_string(){self.string_units()}else{self.scalar_text().encode_utf16().collect()}}
    pub fn bool(&self) -> bool { match self {Self::Json(Json::Bool(v))=>*v,_=>value_type_error("expected boolean")} }
    pub fn num(&self) -> f64 { match self {Self::Number(v)=>*v,Self::Json(Json::Number(v))=>v.as_f64().unwrap(),_=>value_type_error("expected number")} }
    pub fn truthy(&self)->bool{match self{Self::Undefined|Self::Json(Json::Null)=>false,Self::Json(Json::Bool(v))=>*v,Self::Number(v)=>*v!=0.&&!v.is_nan(),Self::Json(Json::Number(v))=>v.as_f64().is_some_and(|v|v!=0.&&!v.is_nan()),Self::Json(Json::String(v))=>!v.is_empty(),Self::Utf16String(units)=>!units.is_empty(),_=>true}}
    pub fn scalar_text(&self)->String{match self{Self::Undefined=>"undefined".into(),Self::Json(Json::Null)=>"null".into(),Self::Json(Json::Bool(v))=>v.to_string(),Self::Json(Json::String(v))=>v.clone(),Self::CaughtStringUnit(_)|Self::Utf16String(_)=>self.text(),Self::Number(v)=>ecma_number_text(*v),Self::Json(Json::Number(v))=>ecma_number_text(v.as_f64().unwrap()),_=>panic!("structured coercion is not admitted")}}
    pub fn scalar_number(&self)->f64{match self{Self::Number(v)=>*v,Self::Json(Json::Number(v))=>v.as_f64().unwrap(),Self::Json(Json::Null)=>0.,Self::Json(Json::Bool(v))=>if *v{1.}else{0.},Self::Json(Json::String(v))=>ecma_string_number(v),Self::CaughtStringUnit(_)|Self::Utf16String(_)=>String::from_utf16(&self.string_units()).map(|text|ecma_string_number(&text)).unwrap_or(f64::NAN),Self::Undefined=>f64::NAN,_=>panic!("structured coercion is not admitted")}}
    pub fn nullish(&self) -> bool { matches!(self,Self::Undefined|Self::Json(Json::Null)) }
    pub fn call(&self,args:Vec<Self>)->Result<Self,Self>{catch_authored(||self.call_authored(args))}
    pub fn callable_value(&self)->&Self { match self { Self::Renderer(adapter)=>adapter.callable.callable_value(), _=>self } }
    pub fn is_callback(&self)->bool { matches!(self.callable_value(),Self::Function(_)) }
    // Compiler-emitted authored composition stays in one exception scope.
    // Native consumers use call(), which returns before any GPUI lease unwinds.
    pub fn call_authored(&self, args: Vec<Self>) -> Self { match self.callable_value() { Self::Function(f)=>f(args), _=>value_type_error("Value is not callable") } }
    pub fn get(&self) -> Self { match self { Self::State(state)|Self::BorrowedState(state)=>{ensure(&state.owner);state.value.borrow().clone()}, Self::Observed(owner, key)=>observed(owner,key), _=>value_type_error("expected State handle") } }
    pub fn owner(&self) -> OwnerWeak { match self { Self::Owner(owner)|Self::DefinitionOwner(owner)|Self::RenderOwner(owner)|Self::Handle(owner,_)|Self::HostTarget(owner)|Self::Part(owner,_)|Self::ObjectRef(owner)=>owner.clone(), _=>panic!("expected owner capability") } }
    pub fn items(&self) -> Vec<Self> { match self {Self::Array(v)=>(**v).clone(),Self::Json(Json::Array(v))=>v.iter().cloned().map(Self::json).collect(),_=>value_type_error("expected array")} }
}
pub fn strict_equal(a:&Value,b:&Value)->bool {
    let a=a.callable_value();let b=b.callable_value();
    if a.is_string()&&b.is_string(){return a.string_units()==b.string_units()}
    match (a,b){(Value::Undefined,Value::Undefined)=>true,(Value::Opaque(a),Value::Opaque(b))=>Rc::ptr_eq(a,b),(Value::ControlLabelRequest(a),Value::ControlLabelRequest(b))=>Rc::ptr_eq(a,b),(Value::ContextKey(a),Value::ContextKey(b))=>a==b,(Value::Owner(a),Value::Owner(b))|(Value::DefinitionOwner(a),Value::DefinitionOwner(b))|(Value::RenderOwner(a),Value::RenderOwner(b))=>Weak::ptr_eq(a,b),(Value::Number(a),Value::Number(b))=>a==b,(Value::Json(a),Value::Json(b))=>match(a,b){(Json::Array(_)|Json::Object(_),_)=>false,(Json::Number(a),Json::Number(b))=>a.as_f64()==b.as_f64(),_=>a==b},(Value::Record(a),Value::Record(b))=>Rc::ptr_eq(a,b),(Value::Array(a),Value::Array(b))=>Rc::ptr_eq(a,b),(Value::State(a),Value::State(b))|(Value::BorrowedState(a),Value::BorrowedState(b))=>Rc::ptr_eq(a,b),(Value::Function(a),Value::Function(b))=>Rc::ptr_eq(a,b),(Value::NativeFunction{identity:a,..},Value::NativeFunction{identity:b,..})=>Rc::ptr_eq(a,b),(Value::StaticCapability(a),Value::StaticCapability(b))=>a.identity()==b.identity(),(Value::Handle(a,ak),Value::Handle(b,bk))=>ak==bk&&Weak::ptr_eq(a,b),(Value::Observed(a,ak),Value::Observed(b,bk))=>ak==bk&&Weak::ptr_eq(a,b),(Value::ObjectRef(a),Value::ObjectRef(b))|(Value::HostTarget(a),Value::HostTarget(b))=>Weak::ptr_eq(a,b),(Value::Part(a,ar),Value::Part(b,br))=>ar==br&&Weak::ptr_eq(a,b),_=>false}}
fn same_value(a:&Value,b:&Value)->bool{
    if matches!(a,Value::Number(_)|Value::Json(Json::Number(_)))&&matches!(b,Value::Number(_)|Value::Json(Json::Number(_))){
        let a=a.num();let b=b.num();a.to_bits()==b.to_bits()||(a.is_nan()&&b.is_nan())
    }else{strict_equal(a,b)}
}
pub fn add(a:Value,b:Value)->Value {if a.is_string()||b.is_string(){let mut units=a.scalar_units();units.extend(b.scalar_units());Value::from_string_units(units)}else{Value::number(a.scalar_number()+b.scalar_number())}}
pub fn record(entries:Vec<(&str,Value)>)->Value{record_map(entries.into_iter().map(|(k,v)|(k.to_owned(),v)).collect())}
// The unwind payload is Send; authored values retain their original UI-thread
// identity in a private slot. Only this exact marker, on its creating thread,
// is an authored throw. Unrelated native panic payloads are never translated.
std::thread_local! { static AUTHORED_THROWS:RefCell<Vec<Option<Value>>> = const { RefCell::new(Vec::new()) }; }
struct AuthoredThrow { slot:usize, thread:std::thread::ThreadId, live:bool }
fn take_authored_throw(slot:usize)->Option<Value> {
    AUTHORED_THROWS.try_with(|values| {
        let mut values=values.borrow_mut();
        let value=values.get_mut(slot).and_then(Option::take);
        while values.last().is_some_and(Option::is_none) { values.pop(); }
        value
    }).ok().flatten()
}
impl Drop for AuthoredThrow {
    fn drop(&mut self) {
        if self.live&&self.thread==std::thread::current().id() { drop(take_authored_throw(self.slot)); }
    }
}
fn authored_payload(payload:&(dyn std::any::Any+Send))->bool {
    payload.downcast_ref::<AuthoredThrow>().is_some_and(|value|value.thread==std::thread::current().id())
}
pub fn throw_value(value:Value)->! {
    let slot=AUTHORED_THROWS.with(|values| {
        let mut values=values.borrow_mut();
        if let Some(slot)=values.iter().position(Option::is_none) { values[slot]=Some(value);slot }
        else { let slot=values.len();values.push(Some(value));slot }
    });
    // resume_unwind starts the authored unwind without changing or invoking
    // the process-wide native panic hook.
    std::panic::resume_unwind(Box::new(AuthoredThrow{slot,thread:std::thread::current().id(),live:true}))
}
pub fn throw_error(code:&str,message:&str)->! {
    throw_value(record(vec![("name",Value::string("Error")),("code",Value::string(code)),("message",Value::string(message))]))
}
pub fn catch_authored<T>(action:impl FnOnce()->T)->Result<T,Value> {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(action)) {
        Ok(value)=>Ok(value),
        Err(payload) if authored_payload(payload.as_ref())=> {
            let mut marker=payload.downcast::<AuthoredThrow>().unwrap_or_else(|_|unreachable!());
            marker.live=false;
            Err(take_authored_throw(marker.slot).expect("authored exception slot missing"))
        },
        Err(payload)=>std::panic::resume_unwind(payload),
    }
}
fn authored_finally_outcome<B,F>(body:impl FnOnce()->B,finalize:impl FnOnce()->F)->(std::thread::Result<B>,F) {
    let result=std::panic::catch_unwind(std::panic::AssertUnwindSafe(body));
    if result.as_ref().err().is_some_and(|payload|!authored_payload(payload.as_ref())) {
        // Cleanup still runs on an unrelated native failure. Its completion
        // cannot turn that failure into success or replace its payload.
        if let Err(secondary)=std::panic::catch_unwind(std::panic::AssertUnwindSafe(finalize)) {
            if let Err(destructor)=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||drop(secondary))) {
                std::mem::forget(destructor);
            }
        }
        match result { Err(payload)=>std::panic::resume_unwind(payload),Ok(_)=>unreachable!() }
    }
    let finalized=finalize();
    (result,finalized)
}
pub fn authored_finally<T>(body:impl FnOnce()->std::ops::ControlFlow<T>,finalize:impl FnOnce()->std::ops::ControlFlow<T>)->std::ops::ControlFlow<T> {
    let (result,finalized)=authored_finally_outcome(body,finalize);
    match finalized {
        std::ops::ControlFlow::Break(value)=>std::ops::ControlFlow::Break(value),
        std::ops::ControlFlow::Continue(())=>match result { Ok(value)=>value,Err(payload)=>std::panic::resume_unwind(payload) },
    }
}
pub fn authored_finally_override<B,T>(body:impl FnOnce()->B,finalize:impl FnOnce()->T)->T {
    let (_,finalized)=authored_finally_outcome(body,finalize);
    finalized
}
pub fn arg(args:&[Value],index:usize)->Value{args.get(index).cloned().unwrap_or(Value::Undefined)}
pub fn ensure(owner:&OwnerWeak)->OwnerRef{let owner=owner.upgrade().unwrap_or_else(||throw_error("OWNER_RELEASED","owner released"));if owner.borrow().disposed{throw_error("OWNER_DISPOSED","terminally disposed owner")}owner}
pub fn setup(owner:&OwnerWeak)->OwnerRef{let owner=ensure(owner);if owner.borrow().phase!="setup"{value_error("setup-only capability")}owner}
pub fn runtime(owner:&OwnerWeak)->OwnerRef{let owner=ensure(owner);if matches!(owner.borrow().phase,"setup"|"render"|"before-dispose"){value_error("callback capability required")}owner}
// Stable Run identity is shared by this owner's callbacks. Definition and
// rendering handles remain distinct objects even when they share that owner.
pub fn capability(owner:&OwnerWeak)->Value{Value::Owner(owner.clone())}
pub fn definition_capability(owner:&OwnerWeak)->Value{Value::DefinitionOwner(owner.clone())}
pub fn render_capability(owner:&OwnerWeak)->Value{Value::RenderOwner(owner.clone())}
pub struct State { pub value:RefCell<Value>, pub kind:&'static str, pub spec:Value, pub owner:OwnerWeak }
#[derive(Clone)]
struct Watcher { active:Rc<Cell<bool>>, keys:Option<Vec<String>>, raw:bool, callback:Value }
#[derive(Clone)]
struct Listener { active:Rc<Cell<bool>>, kind:String, global:bool, capture:bool, once:bool, consumed_epoch:Rc<Cell<Option<u64>>>, passive:bool, numeric_value:bool, callback:Value }
#[derive(Clone)]
struct Contribution {active:Rc<Cell<bool>>, predicate:Option<Value>, styles:Vec<(String,String)>}
#[derive(Clone)]
struct ContextSubscription {active:Rc<Cell<bool>>, key:NativeContextKey, optional:bool, callback:Value}
#[derive(Clone)]
pub struct Input {pub fields:Map<String,Json>,pub prevented:Cell<bool>,pub passive:bool,pub live:Cell<bool>}
#[derive(Default)]
struct NativePress{key:Option<String>,global_key:Option<String>,pointer:bool,global_pointer:bool,cancelled:bool,global_keyboard_click:bool,global_pointer_cancelled:bool}
struct ContextNotice {target:OwnerWeak,registration:ContextSubscription,next:Value,previous:Value}
#[derive(Default)]
struct ContextChannel {pending:VecDeque<ContextNotice>}
thread_local! {static OWNERS:RefCell<Vec<OwnerWeak>>=RefCell::new(Vec::new());static CONTEXT_CHANNELS:RefCell<BTreeMap<(usize,NativeContextKey),Rc<RefCell<ContextChannel>>>>=RefCell::new(BTreeMap::new());}
pub struct Owner {
    atoms:NativeHostAtoms,
    lexical_slots:Vec<Weak<dyn LexicalLifetime>>,
    authored:AuthoredHooks,
    public_values:PublicValues,
    failures:Vec<NativeFailure>,
    pub phase:&'static str,pub disposed:bool,pub disposing:bool,pub present:bool,pub mounted:bool,pub epoch:u64,
    pub dirty:bool,pub pending_native_events:bool,pub native_drive:Option<Drive>,pub window_id:Option<gpui::WindowId>,pub update_requested:bool,pub projection_revision:u64,pub committed_revision:u64,
    pub projection:Option<NativeSnapshot>,pub renderer:Value,pub raw:Json,pub raw_value:Value,pub props_value:Value,pub props:Json,pub schemas:BTreeMap<String,Value>,pub defaults:BTreeMap<String,Value>,
    pub states:BTreeMap<String,Rc<State>>,pub exposes:BTreeMap<String,Value>,pub declared_events:BTreeSet<String>,pub emitted:Vec<(String,Json)>,
    pub lifecycle:BTreeMap<String,Vec<Value>>,watchers:Vec<Watcher>,listeners:Vec<Listener>,contributions:Vec<Contribution>,patch:Vec<(String,String)>,suppressed:BTreeSet<String>,
    pub parent:OwnerWeak,pub providers:BTreeMap<NativeContextKey,Value>,subscriptions:Vec<ContextSubscription>,
    pub context_accepts:fn(&str,&Json)->bool,pub props_accepts:fn(&Json)->bool,pub prop_valid:fn(&str,&Json)->bool,pub previous_valid:BTreeMap<String,Json>,pub default_layers:Vec<BTreeMap<String,Value>>,
    pub focusable:bool,pub focus_disabled:bool,pub focus_requested:bool,pub focus_entry:bool,pub focused:bool,pub suppress_click:bool,
    pub accessible:bool,pub accessible_role:Value,pub accessible_states:BTreeMap<String,Value>,pub accessible_state_conditions:BTreeMap<String,Value>,pub accessible_actions:BTreeSet<String>,pub name_content:bool,
    pub slot:Vec<NativeSnapshot>,pub bounds:Option<Bounds<Pixels>>,pub native_hitbox:Option<gpui::Hitbox>,pub native_translation:gpui::Point<Pixels>,pub theme:String,pub dark:bool,
    pub style_vocabulary:&'static crate::gpui_native_style::StyleVocabulary,
    pub modules:Modules,press:NativePress,press_global:bool,window_input_observed:Option<gpui::WeakFocusHandle>,native_hover:NativeHoverState,
}
#[cfg(feature="test-support")]
pub fn native_owner_allocation_count()->usize{OWNERS.with(|owners|owners.borrow().iter().filter(|owner|owner.strong_count()>0).count())}
#[cfg(feature="test-support")]
pub fn native_resource_counts(owner:&OwnerRef)->Json{
    let o=owner.borrow();serde_json::json!({
        "states":o.states.len(),"hooks":o.modules.hooks.len(),"listeners":o.listeners.len(),
        "stateWatchers":o.modules.state_watchers.len(),"propsWatchers":o.watchers.len(),
        "contextSubscriptions":o.subscriptions.len(),"anatomySubscriptions":o.modules.topology.subscriptions.len(),
        "collectionStates":o.modules.topology.handles.len(),"scrollHandles":usize::from(o.modules.scroll.handle.is_some()),
        "boundaryRegions":o.modules.boundary.regions.len(),"boundaryCallbacks":o.modules.boundary.callbacks.len(),
        "metadataKeys":o.atoms.meta.len(),"schedulerBindings":usize::from(o.atoms.app.is_some()),
        "delays":o.atoms.delays.len(),"presenceOwners":o.atoms.presence.len(),
        "pointerInput":native_pointer_input_needed(owner),"keyInput":native_key_input_needed(owner),
        "boundaryInput":native_boundary_input_needed(owner),"focusObservation":native_focus_observation_needed(owner)
    })
}
impl Owner {
    pub fn new(raw:Json,parent:OwnerWeak,context_accepts:fn(&str,&Json)->bool,props_accepts:fn(&Json)->bool,prop_valid:fn(&str,&Json)->bool,style_vocabulary:&'static crate::gpui_native_style::StyleVocabulary)->OwnerRef {
        if !raw.is_object(){value_type_error("raw props must be a record")}
        let owner=Rc::new(RefCell::new(Self{atoms:NativeHostAtoms::default(),lexical_slots:Vec::new(),authored:AuthoredHooks::default(),public_values:PublicValues::default(),failures:Vec::new(),phase:"setup",disposed:false,disposing:false,present:true,mounted:false,epoch:0,dirty:true,pending_native_events:false,native_drive:None,window_id:None,update_requested:false,projection_revision:0,committed_revision:0,projection:None,renderer:Value::Undefined,raw_value:Value::json(raw.clone()),props_value:Value::Undefined,raw,props:Json::Object(Map::new()),schemas:BTreeMap::new(),defaults:BTreeMap::new(),states:BTreeMap::new(),exposes:BTreeMap::new(),declared_events:BTreeSet::new(),emitted:Vec::new(),lifecycle:BTreeMap::new(),watchers:Vec::new(),listeners:Vec::new(),contributions:Vec::new(),patch:Vec::new(),suppressed:BTreeSet::new(),parent,providers:BTreeMap::new(),subscriptions:Vec::new(),context_accepts,props_accepts,prop_valid,previous_valid:BTreeMap::new(),default_layers:Vec::new(),focusable:false,focus_disabled:false,focus_requested:false,focus_entry:true,focused:false,suppress_click:false,accessible:false,accessible_role:Value::Undefined,accessible_states:BTreeMap::new(),accessible_state_conditions:BTreeMap::new(),accessible_actions:BTreeSet::new(),name_content:false,slot:Vec::new(),bounds:None,native_hitbox:None,native_translation:gpui::Point::default(),theme:"shadcn".into(),dark:false,style_vocabulary,modules:Modules::default(),press:NativePress::default(),press_global:false,window_input_observed:None,native_hover:NativeHoverState::default()}));
        OWNERS.with(|all|all.borrow_mut().push(Rc::downgrade(&owner)));owner
    }
    pub fn finish(owner:&OwnerRef,renderer:Value){control_label_finish(owner);finish_public_exposes(owner);owner.borrow_mut().renderer=renderer;owner.borrow_mut().phase="idle";resolve_props(owner);accessible_alive(owner);
        if let Err(failure)=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||life(owner,"created"))){
            attempt_failed_created_cleanup(||Self::failed_created_cleanup(owner));
            std::panic::resume_unwind(failure);
        }
    }
    // C-LIFECYCLE-0002-J: only acquired synchronous created failure owns this recovery.
    fn failed_created_cleanup(owner:&OwnerRef){
        if owner.borrow().disposed{return}
        attempt_failed_created_cleanup(||begin_native_detach(owner));
        for release in NATIVE_VIEW_RELEASES{attempt_failed_created_cleanup(||release(owner));}
        let callbacks=owner.borrow().lifecycle.get("before-dispose").cloned().unwrap_or_default();
        for callback in callbacks{attempt_failed_created_cleanup(||invoke(owner,"before-dispose",&callback,vec![capability(&Rc::downgrade(owner))]));}
        attempt_failed_created_cleanup(||clear_lexicals(owner));
        attempt_failed_created_cleanup(||Self::failed_created_retire(owner));
        attempt_failed_created_cleanup(topology_refresh);
        attempt_failed_created_cleanup(poll_state_watchers);
    }
    pub fn project(owner:&OwnerRef){
        let needed={let o=owner.borrow();o.present&&!o.disposed&&(o.projection.is_none()||o.update_requested)};
        if !needed{return}
        let previous=owner.borrow().phase;
        let renderer={let mut o=owner.borrow_mut();o.update_requested=false;o.phase="render";o.renderer.clone()};
        // Retire the render phase even when the authored renderer or validation panics.
        let guard=PhaseGuard{owner:Rc::downgrade(owner),previous};
        // C-CORE-SYNTAX-0004-C: void setup projects one anonymous slot.
        let _lexical_owner=enter_lexical_owner(&Rc::downgrade(owner));
        let result=match renderer{Value::Undefined=>NativeSnapshot::slot(),Value::Renderer(adapter)=>(adapter.render)(vec![render_capability(&Rc::downgrade(owner))]),_=>panic!("expected compiled native renderer")};
        result.assert_children();
        {let mut o=owner.borrow_mut();o.projection=Some(result);o.projection_revision+=1;}
        drop(guard);
    }
    pub fn commit(owner:&OwnerRef,revision:u64){
        let(event,epoch)={let mut o=owner.borrow_mut();if o.disposed||!o.present||o.bounds.is_none()||o.projection_revision!=revision||o.committed_revision==revision{return}o.committed_revision=revision;let event=if !o.mounted{o.mounted=true;o.epoch+=1;let epoch=o.epoch;if let Some(projection)=o.modules.focus.entry_projection.as_mut(){projection.binding.epoch=epoch;}"mounted"}else{"updated"};(event,o.epoch)};
        modules_commit(owner);
        {let o=owner.borrow();if o.disposed||!o.present||!o.mounted||o.epoch!=epoch||o.projection_revision!=revision||o.committed_revision!=revision{return}}
        let outcome=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||life(owner,event)));
        native_hover_mounted(owner,epoch);
        if let Err(failure)=outcome{std::panic::resume_unwind(failure);}
    }
    pub fn dispose(owner:&OwnerRef){
        {let mut owner=owner.borrow_mut();if owner.disposed||owner.disposing{return}owner.disposing=true;}
        // The first authored failure stops its callback list, but cannot skip
        // terminal private cleanup. Keep the original payload, including 0/false.
        let mut failure=None;
        attempt_native_cleanup(&mut failure,||crate::gpui_native_move::move_dispose(owner));
        attempt_native_cleanup(&mut failure,||detach_native_view(owner));
        attempt_native_cleanup(&mut failure,||life(owner,"before-dispose"));
        attempt_native_cleanup(&mut failure,||clear_lexicals(owner));
        attempt_native_cleanup(&mut failure,||Self::failed_created_retire(owner));
        attempt_native_cleanup(&mut failure,topology_refresh);
        attempt_native_cleanup(&mut failure,poll_state_watchers);
        if let Some(failure)=failure{std::panic::resume_unwind(failure);}
    }
    fn retire(owner:&OwnerRef){
        control_label_dispose(owner);
        retire_entry_intent(owner);clear_scope_recipient(owner);
        let mut o=owner.borrow_mut();o.disposed=true;o.present=false;o.mounted=false;o.dirty=true;o.bounds=None;o.native_hitbox=None;o.native_hover=NativeHoverState::default();o.projection=None;o.renderer=Value::Undefined;o.watchers.clear();o.listeners.clear();o.contributions.clear();o.subscriptions.clear();o.providers.clear();o.exposes.clear();o.states.clear();o.lifecycle.clear();o.slot.clear();o.authored=AuthoredHooks::default();o.public_values=PublicValues::default();o.atoms=NativeHostAtoms::default();o.modules=Modules::default();
    }
    // Failed-created retirement extracts owned values inside one short borrow so
    // one destructor panic cannot abort the remaining terminal release attempts;
    // each drop runs under its own guard after the borrow ends. Reachable
    // acquired resources (including module-held tasks/leases inside Modules)
    // therefore retire even when a callback capture's destructor panics.
    fn failed_created_retire(owner:&OwnerRef){
        attempt_failed_created_cleanup(||control_label_dispose(owner));
        retire_entry_intent(owner);clear_scope_recipient(owner);
            let extracted={let mut o=owner.borrow_mut();o.disposed=true;o.present=false;o.mounted=false;o.dirty=true;o.bounds=None;o.native_hitbox=None;o.native_hover=NativeHoverState::default();
            (std::mem::take(&mut o.projection),std::mem::take(&mut o.renderer),std::mem::take(&mut o.watchers),std::mem::take(&mut o.listeners),std::mem::take(&mut o.contributions),std::mem::take(&mut o.subscriptions),std::mem::take(&mut o.providers),std::mem::take(&mut o.exposes),std::mem::take(&mut o.states),std::mem::take(&mut o.lifecycle),std::mem::take(&mut o.slot),std::mem::take(&mut o.modules))};
        let(projection,renderer,watchers,listeners,contributions,subscriptions,providers,exposes,states,lifecycle,slot,modules)=extracted;
        attempt_failed_created_cleanup(||drop(projection));
        attempt_failed_created_cleanup(||drop(renderer));
        attempt_failed_created_cleanup(||drop(watchers));
        attempt_failed_created_cleanup(||drop(listeners));
        attempt_failed_created_cleanup(||drop(contributions));
        attempt_failed_created_cleanup(||drop(subscriptions));
        attempt_failed_created_cleanup(||drop(providers));
        attempt_failed_created_cleanup(||drop(exposes));
        attempt_failed_created_cleanup(||drop(states));
        attempt_failed_created_cleanup(||drop(lifecycle));
        attempt_failed_created_cleanup(||drop(slot));
        attempt_failed_created_cleanup(||drop(modules));
        let (authored,atoms,public_values)={let mut owner=owner.borrow_mut();(std::mem::take(&mut owner.authored),std::mem::take(&mut owner.atoms),std::mem::take(&mut owner.public_values))};
        attempt_failed_created_cleanup(||drop(authored));attempt_failed_created_cleanup(||drop(atoms));attempt_failed_created_cleanup(||drop(public_values));
    }
}
impl Drop for Owner { fn drop(&mut self){for slot in self.lexical_slots.drain(..){if let Some(slot)=slot.upgrade(){slot.clear();}}} }
fn attempt_failed_created_cleanup<T>(operation:impl FnOnce()->T){
    if let Err(failure)=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||drop(operation()))){
        if let Err(drop_failure)=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||drop(failure))){
            // Quarantine the destructor's failure: dropping it could panic again and skip retirement.
            std::mem::forget(drop_failure);
        }
    }
}
fn attempt_native_cleanup<T>(failure:&mut Option<Box<dyn std::any::Any+Send>>,operation:impl FnOnce()->T){
    if let Err(next)=std::panic::catch_unwind(std::panic::AssertUnwindSafe(||drop(operation()))){
        if failure.is_none(){*failure=Some(next);}else{attempt_failed_created_cleanup(||drop(next));}
    }
}
const NATIVE_VIEW_RELEASES:[fn(&OwnerRef);8]=[control_label_detach,text_detach,image_detach,positioning_detach,overlay_detach,scroll_detach,atoms_detach,crate::gpui_native_move::move_detach];
fn begin_native_detach(owner:&OwnerRef)->bool{
    withdraw_entry_view(owner);
    let mut o=owner.borrow_mut();let mounted=o.mounted;o.epoch=o.epoch.wrapping_add(1);o.mounted=false;o.bounds=None;o.native_hitbox=None;o.native_hover=NativeHoverState::default();o.focused=false;o.modules.focus.visible=false;o.modules.focus.native=None;o.modules.a11y_node=None;o.modules.a11y_frame=0;o.modules.a11y_bindings=0;o.committed_revision=0;o.press=NativePress::default();mounted
}
pub fn bind_native_focus_window(owner:&OwnerRef,window:&Window){let id=window.window_handle().window_id();if owner.borrow().window_id==Some(id){return}crate::gpui_native_move::move_blur(owner);withdraw_entry_view(owner);let mut o=owner.borrow_mut();let hover_mounted=o.native_hover.mounted_epoch==Some(o.epoch);o.epoch=o.epoch.wrapping_add(1);o.modules.focus.native=None;o.native_hover=NativeHoverState{mounted_epoch:hover_mounted.then_some(o.epoch),needs_sync:hover_mounted,..NativeHoverState::default()};o.window_id=Some(id);}
pub fn detach_native_view(owner:&OwnerRef){
    let mounted=begin_native_detach(owner);
    let mut failure=None;
    for release in NATIVE_VIEW_RELEASES{attempt_native_cleanup(&mut failure,||release(owner));}
    if mounted{attempt_native_cleanup(&mut failure,topology_refresh);attempt_native_cleanup(&mut failure,||life(owner,"unmounted"));}
    // An unmounted callback may create another task. Cancellation after that
    // callback pass is unconditional, including an authored thrown value.
    attempt_native_cleanup(&mut failure,||atoms_detach(owner));
    if mounted{attempt_native_cleanup(&mut failure,poll_state_watchers);}
    if let Some(failure)=failure{std::panic::resume_unwind(failure);}
}
struct PhaseGuard{owner:OwnerWeak,previous:&'static str}
impl Drop for PhaseGuard{fn drop(&mut self){if let Some(owner)=self.owner.upgrade(){owner.borrow_mut().phase=self.previous;}}}
fn invoke_scoped<T>(owner:&OwnerRef,phase:&'static str,body:impl FnOnce()->T)->T{if owner.borrow().disposed{throw_error("OWNER_DISPOSED","owner disposed")}let previous=owner.borrow().phase;owner.borrow_mut().phase=phase;let guard=PhaseGuard{owner:Rc::downgrade(owner),previous};let _lexical_owner=enter_lexical_owner(&Rc::downgrade(owner));let result=body();drop(guard);if phase!="before-dispose"{poll_state_watchers();}result}
pub fn invoke(owner:&OwnerRef,phase:&'static str,callback:&Value,args:Vec<Value>)->Value{invoke_scoped(owner,phase,||callback.call_authored(args))}
pub fn life(owner:&OwnerRef,kind:&'static str){let callbacks=owner.borrow().lifecycle.get(kind).cloned().unwrap_or_default();for callback in callbacks{invoke(owner,kind,&callback,vec![capability(&Rc::downgrade(owner))]);}}
pub fn register_life(owner:&OwnerWeak,kind:&str,callback:Value)->Value{setup(owner).borrow_mut().lifecycle.entry(kind.into()).or_default().push(callback);Value::Undefined}
pub fn request_update(owner:&OwnerWeak)->Value{let owner=runtime(owner);let mut o=owner.borrow_mut();o.update_requested=true;o.dirty=true;Value::Undefined}
pub fn set_present(owner:&OwnerWeak,present:Value)->Value{let owner=runtime(owner);let present=present.bool();{let mut o=owner.borrow_mut();if o.present==present{return Value::Undefined}o.present=present;o.dirty=true;if present{o.projection=None;o.update_requested=true;}}Value::Undefined}
pub fn props_define(owner:&OwnerWeak,schema:Value)->Value{let owner=setup(owner);match schema{Value::Record(entries)=>{owner.borrow_mut().schemas.extend(entries.fields.borrow().iter().map(|(k,v)|(k.clone(),v.clone())));},_=>panic!("checked Props schema record")};resolve_props(&owner);Value::Undefined}
pub fn set_defaults(owner:&OwnerWeak,defaults:Value)->Value{let owner=setup(owner);match defaults{Value::Record(entries)=>owner.borrow_mut().default_layers.push(entries.fields.borrow().clone()),_=>panic!("checked defaults record")};resolve_props(&owner);Value::Undefined}
fn resolve_props(owner:&OwnerRef){
let(raw,schemas,layers,previous_valid,valid,strict)={let o=owner.borrow();(o.raw.clone(),o.schemas.clone(),o.default_layers.clone(),o.previous_valid.clone(),o.prop_valid,o.phase!="setup")};
let mut resolved=Map::new();let mut previous_valid=previous_valid;
for(key,schema)in schemas{
let provided=raw.get(&key);let empty_policy=schema.member("empty",false);let error=strict&&matches!(&empty_policy,Value::Json(Json::String(s))if s=="error");
let range=schema.member("range",false);
let accepts=|candidate:&Json|{if !(valid)(&key,candidate){return false}if !range.nullish(){let min=range.member("min",false);let max=range.member("max",false);let Some(number)=candidate.as_f64()else{return false};if !min.nullish()&&number<min.num(){return false}if !max.nullish()&&number>max.num(){return false}}true};
let mut value=None;
if let Some(raw)=provided{if !raw.is_null()&&accepts(raw){value=Some(raw.clone());previous_valid.insert(key.clone(),raw.clone());}else if raw.is_null()&&matches!(&empty_policy,Value::Json(Json::String(s))if s=="accept"){value=Some(Json::Null);}else if let Some(previous)=previous_valid.get(&key){if !previous.is_null()&&accepts(previous){value=Some(previous.clone());}}}
if value.is_none(){for layer in &layers{if let Some(candidate)=layer.get(&key){let candidate=candidate.data();if candidate.is_null()&&!error||!candidate.is_null()&&accepts(&candidate){value=Some(candidate);break}}}}
if value.is_none(){let default=schema.member("default",false);if !matches!(default,Value::Undefined){let default=default.data();if default.is_null()&&!error||!default.is_null()&&accepts(&default){value=Some(default);}}}
let value=value.unwrap_or_else(||{if error{value_error(&format!("missing, empty or invalid prop without nonempty fallback: {key}"))}Json::Null});if provided.is_some()&&!value.is_null(){previous_valid.insert(key.clone(),value.clone());}resolved.insert(key,value);
}
let props=Json::Object(resolved);let mut o=owner.borrow_mut();if !(o.props_accepts)(&props){value_type_error("invalid resolved Props value")}o.previous_valid=previous_valid;o.props_value=Value::json(props.clone());o.props=props;
}
pub fn read_props(owner:&OwnerWeak,raw:bool)->Value{let owner=ensure(owner);let o=owner.borrow();if raw{o.raw_value.clone()}else{o.props_value.clone()}}
pub fn is_provided(owner:&OwnerWeak,key:Value)->Value{Value::boolean(ensure(owner).borrow().raw.get(key.text()).is_some())}
pub fn watch_props(owner:&OwnerWeak,keys:Option<Value>,raw:bool,callback:Value)->Value{let owner=setup(owner);let active=Rc::new(Cell::new(true));let keys=keys.map(|v|match v{Value::Json(Json::String(s))=>vec![s],_=>v.items().iter().map(Value::text).collect()});owner.borrow_mut().watchers.push(Watcher{active:active.clone(),keys,raw,callback});disposer(owner,active,false)}
pub fn replace_props(owner:&OwnerRef,raw:Json){if !raw.is_object(){value_type_error("raw props must be a record")}let (old_raw,old_props,watchers)={let o=owner.borrow();if o.disposed{throw_error("OWNER_DISPOSED","terminally disposed owner")}(o.raw.clone(),o.props.clone(),o.watchers.clone())};{let mut o=owner.borrow_mut();o.raw_value=Value::json(raw.clone());o.raw=raw;o.dirty=true;}resolve_props(owner);let (new_raw,new_props)={let o=owner.borrow();(o.raw.clone(),o.props.clone())};let mut pending=Vec::new();for watcher in watchers{let(previous,next)=if watcher.raw{(&old_raw,&new_raw)}else{(&old_props,&new_props)};let all:BTreeSet<String>=previous.as_object().unwrap().keys().chain(next.as_object().unwrap().keys()).cloned().collect();let changed:Vec<String>=all.into_iter().filter(|key|previous.get(key)!=next.get(key)).collect();if changed.is_empty()||watcher.keys.as_ref().is_some_and(|keys|!changed.iter().any(|key|keys.contains(key))){continue}let info=record(vec![("changedKeys",Value::Array(Rc::new(changed.iter().map(|k|Value::string(k)).collect())))]);pending.push((watcher,next.clone(),previous.clone(),info));}for(watcher,next,previous,info)in pending{if watcher.active.get(){invoke(owner,"props-watch",&watcher.callback,vec![capability(&Rc::downgrade(owner)),Value::json(next),Value::json(previous),info]);}}}
// Scalar domain validation is a compiler-profile policy. Its failures are
// authored errors, never Rust invariants: source try/catch and native Result
// boundaries must be able to recover without unwinding a GPUI entity lease.
pub fn create_state(owner:&OwnerWeak,kind:&'static str,key:Value,value:Value,spec:Value)->Value{
    let owner_ref=setup(owner);
    let Value::Json(Json::String(key))=key else{value_error("[State] state name must be a non-empty string.")};
    let value=normalize_state(kind,value,&spec,true);
    // Failed validation must not reserve the name in this capture frame.
    let storage_key=claim_state_name(&owner_ref,&key);
    let state=Rc::new(State{value:RefCell::new(value),kind,spec,owner:owner.clone()});
    owner_ref.borrow_mut().states.insert(storage_key,state.clone());capture_state(&owner_ref,key,state.clone());Value::State(state)
}
fn normalize_state(kind:&str,value:Value,spec:&Value,initial:bool)->Value{
    match kind{
        "bool"=>{value.bool();},
        "string"|"enum"=>{
            if !value.is_string(){value_error("State string required")}
            let options=spec.member("options",true);
            if options.nullish()&&kind=="enum"{value_error("enum options required")}
            if !options.nullish()&&!options.items().iter().any(|option|strict_equal(option,&value)){value_error("State value outside options")}
        },
        "discrete"|"range"=>{
            let number=value.num();if !number.is_finite(){value_error("State finite number required")}
            let min=spec.member("min",true);let max=spec.member("max",true);
            if kind=="range"{
                if min.nullish()||max.nullish()||!(min.num()<=max.num()){value_error("invalid range")}
                let clamp=spec.member("clamp",true);
                if initial&&!clamp.nullish()&&clamp.bool(){return Value::number(number.max(min.num()).min(max.num()))}
                if !(number>=min.num()&&number<=max.num()){value_error("State range violation")}
            }else{
                if !min.nullish()&&!(number>=min.num()){value_error("State below min")}
                if !max.nullish()&&!(number<=max.num()){value_error("State above max")}
                let step=spec.member("step",true);
                if !step.nullish(){
                    if !(step.num()>0.){value_error("State step must be positive")}
                    let origin=if min.nullish(){0.}else{min.num()};
                    if !(((number-origin)/step.num()).fract().abs()<1e-9){value_error("State step violation")}
                }
            }
        },
        _=>panic!("unknown State constructor"),
    }
    let options=spec.member("options",true);
    if !options.nullish()&&!options.items().iter().any(|item|strict_equal(item,&value)){value_error("State option violation")}
    value
}
pub fn state_set(receiver:Value,value:Value,reason:Value)->Value{match receiver{Value::State(state)=>{runtime(&state.owner);write_state_value(&state,value,reason);},_=>panic!("State handle required")};Value::Undefined}
fn expose_key(owner:&OwnerRef,key:Value)->String{
    let key=key.text();if key.is_empty(){throw_error("EXPOSE_KEY_INVALID","Expose key must be nonempty")}
    let owner=owner.borrow();if owner.exposes.contains_key(&key)||owner.declared_events.contains(&key){throw_error("EXPOSE_DUPLICATE",&format!("duplicate Expose key: {key}"))}key
}
pub fn expose_state(owner:&OwnerWeak,key:Value,state:Value)->Value{
    let owner_ref=setup(owner);let key=expose_key(&owner_ref,key);
    let mut owner=owner_ref.borrow_mut();
    if let Value::Observed(_,observation)=&state {
        let name=match *observation {
            "focus.focused"=>Some("focused"),
            "focus.visible"=>Some("focusVisible"),
            "focus.ready"=>Some("focusable"),
            _=>None,
        };
        if let (Some(name),Some(frame))=(name,owner.authored.frames.last_mut()) {
            frame.states.insert(name.into(),state.clone());
        }
    }
    owner.exposes.insert(key,state);Value::Undefined
}
pub fn expose_value(owner:&OwnerWeak,key:Value,value:Value)->Value{let owner_ref=setup(owner);let key=expose_key(&owner_ref,key);owner_ref.borrow_mut().exposes.insert(key,value);Value::Undefined}
pub fn expose_method(owner:&OwnerWeak,key:Value,callback:Value)->Value{let owner_ref=setup(owner);let key=expose_key(&owner_ref,key);capture_method(&owner_ref,key.clone(),callback.clone());owner_ref.borrow_mut().exposes.insert(key,callback);Value::Undefined}
pub fn expose_event(owner:&OwnerWeak,key:Value)->Value{let owner_ref=setup(owner);let key=expose_key(&owner_ref,key);owner_ref.borrow_mut().declared_events.insert(key);Value::Undefined}
pub fn emit(owner:&OwnerWeak,key:Value,payload:Value)->Value{let owner=runtime(owner);let key=key.text();assert!(owner.borrow().declared_events.contains(&key),"undeclared Expose event");let payload=if matches!(payload,Value::Undefined){Json::Null}else{payload.data()};{let mut o=owner.borrow_mut();o.emitted.push((key,payload));o.pending_native_events=true;o.dirty=true;}Value::Undefined}
// Event publication wakes the retained native consumer without requesting an
// authored render. Event-only controls must not wait for unrelated State writes.
#[cfg(all(test,feature="test-support"))]
mod event_notification_tests {
    use super::*;
    #[test]
    fn stable_callback_owner_identity_preserves_distinct_handle_kinds() {
        let first=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        let second=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        let a=Rc::downgrade(&first);let b=Rc::downgrade(&second);
        assert!(strict_equal(&capability(&a),&capability(&a)));
        assert!(!strict_equal(&capability(&a),&capability(&b)));
        assert!(strict_equal(&definition_capability(&a),&definition_capability(&a)));
        assert!(strict_equal(&render_capability(&a),&render_capability(&a)));
        assert!(!strict_equal(&capability(&a),&definition_capability(&a)));
        assert!(!strict_equal(&capability(&a),&render_capability(&a)));
        assert!(!strict_equal(&definition_capability(&a),&render_capability(&a)));
        Owner::dispose(&first);Owner::dispose(&second);
    }

    #[test]
    fn event_only_publication_notifies_without_reexecuting_the_authored_renderer() {
        let owner=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        let weak=Rc::downgrade(&owner);
        expose_event(&weak,Value::string("chosen"));
        let renders=Rc::new(Cell::new(0));let observed=renders.clone();
        Owner::finish(&owner,capture_renderer(Value::Function(Rc::new(|_|Value::Json(Json::Null))),Rc::new(move |_|{observed.set(observed.get()+1);NativeSnapshot::empty()})));
        Owner::project(&owner);let revision=owner.borrow().projection_revision;
        {let mut o=owner.borrow_mut();o.phase="callback";o.mounted=true;o.dirty=false;}
        emit(&weak,Value::string("chosen"),Value::number(7.));
        assert!(owner.borrow().dirty,"event consumers need a native observer notification");
        assert!(!owner.borrow().update_requested,"publication is not source render intent");
        assert_eq!(owner.borrow().emitted,vec![("chosen".into(),serde_json::json!(7.))]);
        Owner::project(&owner);
        assert_eq!(renders.get(),1);assert_eq!(owner.borrow().projection_revision,revision);
        Owner::dispose(&owner);
    }
}
pub fn disposer(owner:OwnerRef,active:Rc<Cell<bool>>,setup_only:bool)->Value{let owner=Rc::downgrade(&owner);Value::Function(Rc::new(move |_|{if setup_only{setup(&owner);}else{ensure(&owner);}active.set(false);Value::Undefined}))}
pub fn style_use(owner:&OwnerWeak,handles:Vec<Value>)->Value{let owner=setup(owner);let active=Rc::new(Cell::new(true));owner.borrow_mut().contributions.push(Contribution{active:active.clone(),predicate:None,styles:style_items(handles)});disposer(owner,active,true)}
pub fn rule(owner:&OwnerWeak,predicate:Value,handles:Vec<Value>)->Value{let owner=setup(owner);let active=Rc::new(Cell::new(true));owner.borrow_mut().contributions.push(Contribution{active:active.clone(),predicate:Some(predicate),styles:style_items(handles)});Value::Resource(active)}
pub fn rule_dispose(owner:&OwnerWeak,receiver:Value)->Value{setup(owner);match receiver{Value::Resource(active)=>active.set(false),_=>panic!("Rule handle required")};Value::Undefined}
pub fn style_items(handles:Vec<Value>)->Vec<(String,String)>{handles.into_iter().flat_map(|v|match v{Value::Style(items)=>items,_=>panic!("style handle required")}).collect()}
pub fn patch(owner:&OwnerWeak,handles:Vec<Value>,suppress:bool)->Value{let owner=runtime(owner);let items=style_items(handles);let mut o=owner.borrow_mut();o.dirty=true;for item in items{if suppress{o.patch.retain(|(_,group)|group!=&item.1);o.suppressed.insert(item.1);}else{o.suppressed.remove(&item.1);o.patch.retain(|(_,group)|group!=&item.1);o.patch.push(item);}}Value::Undefined}
pub fn clear_patch(owner:&OwnerWeak)->Value{let owner=runtime(owner);let mut o=owner.borrow_mut();o.patch.clear();o.suppressed.clear();o.dirty=true;Value::Undefined}
pub fn styles(owner:&OwnerRef)->Vec<String>{let(contributions,patch,suppressed)={let o=owner.borrow();(o.contributions.clone(),o.patch.clone(),o.suppressed.clone())};let mut merged=Vec::<(String,String)>::new();for contribution in contributions{if !contribution.active.get()||contribution.predicate.is_some_and(|predicate|!predicate.call_authored(vec![]).bool()){continue}for item in contribution.styles{merged.retain(|(_,group)|group!=&item.1);merged.push(item)}}for item in patch{merged.retain(|(_,group)|group!=&item.1);merged.push(item)}merged.into_iter().filter(|(_,group)|!suppressed.contains(group)).map(|(token,_)|token).collect()}
pub fn context_provide(owner:&OwnerWeak,key:Value,value:Value)->Value {
    let owner=setup(owner);let key=context_identity(key);
    let data=value.try_data().unwrap_or_else(||throw_error("CONTEXT_VALUE_INVALID","invalid Context data"));
    if !(owner.borrow().context_accepts)(&key.descriptor,&data) { throw_error("CONTEXT_VALUE_INVALID","invalid Context data"); }
    if owner.borrow().providers.contains_key(&key) { throw_error("CONTEXT_DUPLICATE_PROVIDE","duplicate Context provider"); }
    owner.borrow_mut().providers.insert(key,value);Value::Undefined
}
fn provider(owner:&OwnerRef,key:&NativeContextKey)->Option<OwnerRef>{let mut current=Some(owner.clone());let mut visited=BTreeSet::new();while let Some(node)=current{assert!(visited.insert(Rc::as_ptr(&node)as usize),"cyclic Context ancestry");let o=node.borrow();if o.disposed{return None}if o.providers.contains_key(key){drop(o);return Some(node)}current=o.parent.upgrade();}None}
pub fn context_subscribe(owner:&OwnerWeak,key:Value,optional:bool,callback:Value)->Value {
    let owner=setup(owner);let key=context_identity(key);
    if !optional&&provider(&owner,&key).is_none() { throw_error("CONTEXT_PROVIDER_MISSING","required Context provider missing"); }
    let active=Rc::new(Cell::new(true));
    owner.borrow_mut().subscriptions.push(ContextSubscription{active:active.clone(),key,optional,callback});
    disposer(owner,active,false)
}
pub fn context_read(owner:&OwnerWeak,key:Value,optional:bool)->Value {
    let owner=ensure(owner);let key=context_identity(key);
    if !owner.borrow().subscriptions.iter().any(|s|s.key==key&&s.optional==optional) { throw_error("CONTEXT_SUBSCRIPTION_REQUIRED","Context read requires corresponding subscription"); }
    match provider(&owner,&key) {
        Some(provider)=>provider.borrow().providers[&key].clone(),
        None if optional=>Value::Json(Json::Null),
        None=>throw_error("CONTEXT_DISCONNECTED","required Context provider missing"),
    }
}
struct ContextDispatchReset {key:(usize,NativeContextKey)}
impl Drop for ContextDispatchReset {
    fn drop(&mut self) {CONTEXT_CHANNELS.with(|channels|channels.borrow_mut().remove(&self.key));}
}
pub fn context_update(owner:&OwnerWeak,key:Value,next:Value,optional:bool)->Value {
    let owner=runtime(owner);let key=context_identity(key);
    if !owner.borrow().subscriptions.iter().any(|s|s.key==key&&s.optional==optional) { throw_error("CONTEXT_SUBSCRIPTION_REQUIRED","Context update requires corresponding subscription"); }
    let Some(bound)=provider(&owner,&key) else {
        if optional { return Value::boolean(false); }
        throw_error("CONTEXT_DISCONNECTED","required Context provider missing")
    };
    let previous=bound.borrow().providers[&key].clone();
    let value=if next.is_callback(){next.call_authored(vec![previous.clone()])}else{next};
    ensure(&Rc::downgrade(&bound));
    let data=value.try_data().unwrap_or_else(||throw_error("CONTEXT_VALUE_INVALID","invalid Context data"));
    if !(owner.borrow().context_accepts)(&key.descriptor,&data) { throw_error("CONTEXT_VALUE_INVALID","invalid Context data"); }
    bound.borrow_mut().providers.insert(key.clone(),value.clone());
    let mut recorded=Vec::new();
    for participant in all_owners(){
        if provider(&participant,&key).is_some_and(|current|Rc::ptr_eq(&current,&bound)){
            let subscriptions=participant.borrow().subscriptions.clone();
            for registration in subscriptions{
                if registration.active.get()&&registration.key==key&&!matches!(registration.callback,Value::Undefined){
                    recorded.push(ContextNotice{target:Rc::downgrade(&participant),registration,next:value.clone(),previous:previous.clone()});
                }
            }
        }
    }
    if !recorded.is_empty(){
        // Core Context channels serialize reentry only for the same provider/key.
        // A different channel remains an ordinary nested callback delivery.
        let channel_key=(Rc::as_ptr(&bound)as usize,key.clone());
        let (channel,dispatch)=CONTEXT_CHANNELS.with(|channels|{
            let mut channels=channels.borrow_mut();
            if let Some(channel)=channels.get(&channel_key){(channel.clone(),false)}else{
                let channel=Rc::new(RefCell::new(ContextChannel::default()));channels.insert(channel_key.clone(),channel.clone());(channel,true)
            }
        });
        channel.borrow_mut().pending.extend(recorded);
        if dispatch{
            let reset=ContextDispatchReset{key:channel_key};let mut failures=Vec::new();
            loop{
                let notice=channel.borrow_mut().pending.pop_front();let Some(notice)=notice else{break};
                if !notice.registration.active.get(){continue}
                let Some(target)=notice.target.upgrade().filter(|owner|!owner.borrow().disposed)else{continue};
                if !provider(&target,&key).is_some_and(|current|Rc::ptr_eq(&current,&bound)){continue}
                if let Err(error)=catch_authored(||invoke(&target,"context-watch",&notice.registration.callback,vec![capability(&notice.target),notice.next,notice.previous])){failures.push(error);}
            }
            drop(reset);
            if failures.len()==1{throw_value(failures.pop().unwrap());}
            if !failures.is_empty(){throw_value(record(vec![("name",Value::string("AggregateError")),("message",Value::string("[Context] callback delivery failed")),("errors",Value::Array(Rc::new(failures)))]));}
        }
    }
    if optional { Value::boolean(true) } else { Value::Undefined }
}
fn trigger_parent(owner:&OwnerRef)->Option<OwnerRef>{if !owner.borrow().modules.hooks.contains("trigger"){return None}owner.borrow().parent.upgrade().filter(|parent|{let parent=parent.borrow();!parent.disposed&&parent.modules.hooks.contains("trigger")})}
fn trigger_child(owner:&OwnerRef)->Option<OwnerRef>{owner.borrow().modules.trigger_child.upgrade().filter(|child|{let child=child.borrow();!child.disposed&&child.modules.hooks.contains("trigger")&&child.parent.upgrade().is_some_and(|parent|Rc::ptr_eq(&parent,owner))})}
fn validate_trigger_child(parent:&OwnerRef,child:&OwnerRef)->Result<(),&'static str>{if trigger_child(parent).is_none_or(|current|Rc::ptr_eq(&current,child)){Ok(())}else{Err("Trigger group cannot branch into sibling surfaces")}}
pub fn as_trigger(owner:&OwnerWeak)->Value{let owner=setup(owner);let parent=owner.borrow().parent.upgrade().filter(|parent|parent.borrow().modules.hooks.contains("trigger"));if let Some(parent)=&parent{validate_trigger_child(parent,&owner).expect("invalid Trigger declaration");}owner.borrow_mut().modules.hooks.insert("trigger");if let Some(parent)=parent{parent.borrow_mut().modules.trigger_child=Rc::downgrade(&owner);}Value::Undefined}
pub fn set_native_parent(owner:&OwnerRef,parent:OwnerWeak)->Result<(),&'static str>{let next=parent.upgrade();if let Some(parent)=&next{if descendant(parent,owner){return Err("cyclic logical ancestry")}if owner.borrow().modules.hooks.contains("trigger")&&parent.borrow().modules.hooks.contains("trigger"){validate_trigger_child(parent,owner)?;}}if let Some(previous)=trigger_parent(owner){if previous.borrow().modules.trigger_child.ptr_eq(&Rc::downgrade(owner)){previous.borrow_mut().modules.trigger_child=Weak::new();}}owner.borrow_mut().parent=parent;if let Some(parent)=trigger_parent(owner){parent.borrow_mut().modules.trigger_child=Rc::downgrade(owner);}topology_refresh();Ok(())}
fn dispatch_root_route(target:&OwnerRef,kind:&str,fields:Map<String,Json>)->bool{if !ready(target)||trigger_child(target).is_some(){return false}let window=target.borrow().window_id;let mut current=Some(target.clone());let mut prevented=false;while let Some(owner)=current{current=trigger_parent(&owner);if owner.borrow().window_id==window{prevented|=dispatch(&owner,kind,false,fields.clone());}}prevented}
pub fn as_focusable(owner:&OwnerWeak)->Value{setup(owner).borrow_mut().focusable=true;module_handle(owner,"focus")}
pub fn as_accessible(owner:&OwnerWeak)->Value{setup(owner).borrow_mut().accessible=true;module_handle(owner,"accessible")}
pub fn focus_configure(owner:&OwnerWeak,config:Value)->Value{let owner=setup(owner);let disabled=config.member("disabled",false);let entry=config.member("entry",false);let mut o=owner.borrow_mut();if !disabled.nullish(){o.focus_disabled=disabled.bool()}if !entry.nullish(){o.focus_entry=entry.bool()}Value::Undefined}
pub fn focus_disabled(owner:&OwnerWeak,disabled:Value)->Value{let owner=runtime(owner);let disabled=disabled.bool();let mut o=owner.borrow_mut();o.focus_disabled=disabled;o.dirty=true;if disabled{o.focus_requested=false;o.modules.focus.request_source=None;o.focused=false;o.modules.focus.visible=false;o.modules.focus.module_active=false;o.modules.focus.blur_requested=true;}Value::Undefined}
pub fn focus_self(owner:&OwnerWeak)->Value{focus_request(owner,Value::Undefined,false)}
pub fn accessible_role(owner:&OwnerWeak,role:Value)->Value{setup(owner).borrow_mut().accessible_role=role;Value::Undefined}
pub fn accessible_state(owner:&OwnerWeak,key:Value,state:Value,options:Value)->Value{
    let owner=setup(owner);let condition=options.member("when",true);
    // Omission alone is unconditional. Null, raw booleans and non-State values
    // cannot become an applicability sentinel or bypass State ownership.
    if !matches!(condition,Value::Undefined){condition.get().bool();}
    let mut owner=owner.borrow_mut();let key=key.text();
    owner.accessible_states.insert(key.clone(),state);
    owner.accessible_state_conditions.remove(&key);
    if !matches!(condition,Value::Undefined){owner.accessible_state_conditions.insert(key,condition);}
    Value::Undefined
}
pub fn accessible_action(owner:&OwnerWeak,key:Value)->Value{accessible_action_spec(owner,key,Value::Undefined)}
pub fn name_content(owner:&OwnerWeak)->Value{let owner=setup(owner);let mut o=owner.borrow_mut();o.name_content=true;o.modules.accessible_text.remove("name");Value::Undefined}
pub fn listen(owner:&OwnerWeak,key:Value,global:bool,callback:Value,options:Value)->Value{listen_with_schema(owner,key,global,callback,options,false)}
pub fn listen_numeric_value(owner:&OwnerWeak,key:Value,global:bool,callback:Value,options:Value)->Value{assert!(!global,"numeric accessibility actions are owner-local");listen_with_schema(owner,key,global,callback,options,true)}
fn listen_with_schema(owner:&OwnerWeak,key:Value,global:bool,callback:Value,options:Value,numeric_value:bool)->Value{let owner=setup(owner);let active=Rc::new(Cell::new(true));let kind=key.text();if global&&kind.starts_with("press."){owner.borrow_mut().press_global=true;}let capture=options.member("capture",true);let once=options.member("once",true);let passive=options.member("passive",true);owner.borrow_mut().listeners.push(Listener{active:active.clone(),kind,global,capture:!capture.nullish()&&capture.bool(),once:!once.nullish()&&once.bool(),consumed_epoch:Rc::new(Cell::new(None)),passive:!passive.nullish()&&passive.bool(),numeric_value,callback});disposer(owner,active,false)}
pub fn prevent(input:Value)->Value{match input{Value::Input(input)=>{if !input.live.get(){throw_error("INPUT_CONTROL_EXPIRED","input control expired")}if !input.passive{input.prevented.set(true)}},_=>panic!("input capability required")};Value::Undefined}
struct InputLifetime<'a>(&'a Input);
impl Drop for InputLifetime<'_>{fn drop(&mut self){self.0.live.set(false);}}
pub fn dispatch(owner:&OwnerRef,kind:&str,global:bool,fields:Map<String,Json>)->bool{dispatch_phase(owner,kind,global,false,fields)}
fn has_listener(owner:&OwnerRef,kind:&str,global:bool,capture:bool)->bool{let owner=owner.borrow();owner.listeners.iter().any(|listener|listener.active.get()&&listener.kind==kind&&listener.global==global&&listener.capture==capture&&(!listener.once||listener.consumed_epoch.get()!=Some(owner.epoch)))}
fn dispatch_phase(owner:&OwnerRef,kind:&str,global:bool,capture:bool,fields:Map<String,Json>)->bool{
    if owner.borrow().disposed||!owner.borrow().present||!owner.borrow().mounted{return false}
    if !global&&(kind.starts_with("pointer.")||kind=="press.commit"||kind=="context.menu")&&!hit_participates(owner){return false}
    let listeners=owner.borrow().listeners.clone();let mut prevented=false;
    for listener in listeners{
        if owner.borrow().disposed||!owner.borrow().mounted{break}
        if !listener.active.get()||listener.global!=global||listener.capture!=capture||listener.kind!=kind{continue}
        if listener.numeric_value&&!fields.get("value").and_then(Json::as_f64).is_some_and(f64::is_finite){continue}
        if listener.once{let epoch=owner.borrow().epoch;if listener.consumed_epoch.get()==Some(epoch){continue}listener.consumed_epoch.set(Some(epoch));}
        let input=Rc::new(Input{fields:fields.clone(),prevented:Cell::new(false),passive:listener.passive,live:Cell::new(true)});
        let delivered=native_host_callback(owner,kind,||invoke_scoped(owner,"event",||{
            let _lifetime=InputLifetime(input.as_ref());listener.callback.call_authored(vec![capability(&Rc::downgrade(owner)),Value::Input(input.clone())])
        }));
        // A prevention request already made by the callback survives its error.
        prevented|=input.prevented.get();if delivered.is_none(){break}
    }
    prevented
}
pub fn event_fields(kind:&str)->Map<String,Json>{let mut fields=Map::new();fields.insert("type".into(),Json::String(kind.into()));fields}
pub fn default_accessibility_event(action:&str)->String{if action=="setValue"{"host:a11y-set-value".into()}else{format!("a11y:{action}")}}
/// One bridge shared by the actual GPUI callback and native consumer tests.
/// A SetValue request carries finite numeric input; policy and State stay authored.
pub fn dispatch_accessibility_action(owner:&OwnerRef,action:&str,data:Option<&gpui::accesskit::ActionData>)->bool{
    let kind={let o=owner.borrow();if o.disposed||!o.present||!o.mounted||!o.accessible||!o.accessible_actions.contains(action){return false}o.modules.action_events.get(action).cloned().unwrap_or_else(||default_accessibility_event(action))};
    // C-EVENT-TYPE-0002: assistive activation enters the same portable intent
    // route as a click. The activate event names the outward signal authored by
    // the Prototype; emitting it here would bypass disabled/selection policy.
    // Explicit host:* input routes retain their authored meaning (for example,
    // changing a multi-axis editor's active axis instead of pressing it).
    if action=="activate"&&!kind.starts_with("host:"){return dispatch_root_route(owner,"press.commit",event_fields("press.commit"))}
    let mut fields=event_fields(&kind);
    if action=="setValue"{
        let Some(gpui::accesskit::ActionData::NumericValue(value))=data else{return false};
        if !value.is_finite(){return false}
        fields.insert("value".into(),Json::from(*value));
    }
    dispatch(owner,&kind,false,fields)
}
pub fn text_content(value:&Option<NativeSnapshot>,slot:&[NativeSnapshot])->String{value.as_ref().map(|snapshot|(snapshot.text)(slot)).unwrap_or_default()}
pub type Drive=Rc<dyn Fn(&mut Window,&mut App)>;
#[derive(Clone,Copy)]
pub struct NativeTranslation{x:crate::gpui_native_style::Dimension,y:crate::gpui_native_style::Dimension}
impl NativeTranslation{const ZERO:Self=Self{x:crate::gpui_native_style::Dimension::ZERO,y:crate::gpui_native_style::Dimension::ZERO};fn is_zero(self)->bool{self.x==Self::ZERO.x&&self.y==Self::ZERO.y}}
struct TranslatedElement{element:AnyElement,translation:NativeTranslation,owner:Option<OwnerWeak>}
#[cfg(not(feature = "gpui-modern-element-api"))]
impl gpui::IntoElement for TranslatedElement{type Element=Self;fn into_element(self)->Self{self}}
impl gpui::Element for TranslatedElement{
    type RequestLayoutState=();type PrepaintState=();
    fn id(&self)->Option<gpui::ElementId>{None}
    fn source_location(&self)->Option<&'static std::panic::Location<'static>>{None}
    fn request_layout(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,window:&mut Window,cx:&mut App)->(gpui::LayoutId,()){(self.element.request_layout(window,cx),())}
    fn prepaint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,bounds:Bounds<Pixels>,_:&mut (),window:&mut Window,cx:&mut App){
        let offset=gpui::point(gpui::px(self.translation.x.resolve(bounds.size.width.into())),gpui::px(self.translation.y.resolve(bounds.size.height.into())));
        if let Some(owner)=self.owner.as_ref().and_then(Weak::upgrade){owner.borrow_mut().native_translation=offset;}
        window.with_element_offset(offset,|window|self.element.prepaint(window,cx));
    }
    fn paint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut (),_:&mut (),window:&mut Window,cx:&mut App){self.element.paint(window,cx)}
}
pub fn translated_element(element:AnyElement,translation:NativeTranslation,owner:Option<OwnerWeak>)->AnyElement{if translation.is_zero(){element}else{TranslatedElement{element,translation,owner}.into_any_element()}}
pub fn native_presentation(owner:&OwnerRef,tokens:&[String])->(gpui::StyleRefinement,bool,NativeTranslation){
    use crate::gpui_native_style::{themes,ColorScheme,Substitution,LengthContext,evaluate_length};
    let(vocabulary,theme)={let o=owner.borrow();(o.style_vocabulary,themes().get(&o.theme,if o.dark{ColorScheme::Dark}else{ColorScheme::Light}).expect("unknown design language"))};
    let mut resolved=vocabulary.resolve_all(tokens.iter().map(String::as_str));assert!(resolved.unknown.is_empty(),"unmapped style tokens: {:?}",resolved.unknown);
    take_native_content_selection(&mut resolved);
    let local:BTreeMap<_,_>=resolved.declarations.extract_if(..,|property,_|property.starts_with("--")).collect();
    let substitute=|value:&str|match theme.substitute_with(value,&local){Substitution::Resolved(text)=>text,other=>panic!("unresolved style declaration: {:?}",other)};
    for value in resolved.declarations.values_mut(){*value=substitute(value);}
    let translation=if resolved.declarations.remove("transform").is_some(){
        for property in ["--pui-scale-x","--pui-scale-y"]{if let Some(value)=local.get(property){assert!(substitute(value).parse::<f32>().is_ok_and(|value|value==1.),"GPUI scale style requires its physical transformed surface");}}
        let dimension=|property:&str|local.get(property).map(|value|evaluate_length(&substitute(value),LengthContext::default()).expect("native translation length")).unwrap_or(crate::gpui_native_style::Dimension::ZERO);
        NativeTranslation{x:dimension("--pui-translate-x"),y:dimension("--pui-translate-y")}
    }else{NativeTranslation::ZERO};
    // A viewport wrapper, rather than Absolute alone, realizes fixed positioning.
    let fixed=resolved.declarations.get("position").is_some_and(|position|position=="fixed");if fixed{resolved.declarations.insert("position".into(),"absolute".into());}resolved.declarations.entry("position".into()).or_insert_with(||"relative".into());
    let mapped=crate::gpui_native_style_mapping::map(&resolved,LengthContext::default());assert!(mapped.unmapped_properties().is_empty(),"GPUI style host prerequisite: {:?}",mapped.unmapped);(mapped.refinement,fixed,translation)
}
pub fn native_style(owner:&OwnerRef,tokens:&[String])->gpui::StyleRefinement{let(style,fixed,translation)=native_presentation(owner,tokens);assert!(!fixed,"fixed style requires its physical viewport surface");assert!(translation.is_zero(),"translation style requires its physical element surface");style}
pub fn paint_native_root(value:&NativeSnapshot,owner:&OwnerRef,focus:&FocusHandle,path:String,drive:Drive)->AnyElement{
// The stable native host Root retains channels, feedback and commit ownership.
// Authored children are captured native factories, never semantic tag dispatch.
let mut native_role=None;let mut element=div().id(gpui::ElementId::Name(path.clone().into()));let tokens=styles(owner);owner.borrow_mut().native_translation=gpui::Point::default();let(style,fixed,translation)=native_presentation(owner,&tokens);*element.style()=style;
if control_label_is_label(owner){native_role=Some(gpui::Role::Label);element=element.role(gpui::Role::Label);}
if image_supported(owner){element=element.role(gpui::Role::Image);}
if owner.borrow().modules.hooks.contains("scroll")&&owner.borrow().modules.scroll.builtin_projection(){let (axes,handle)={let o=owner.borrow();(text_or(field(&o.modules.scroll.config,"axes"),"both"),o.modules.scroll.handle().clone())};element=element.track_scroll(&handle);if axes!="vertical"{element=element.overflow_x_scroll();}if axes!="horizontal"{element=element.overflow_y_scroll();}let scrolled=owner.clone();let scroll_drive=drive.clone();let scroll_epoch=owner.borrow().epoch;element=element.on_scroll_wheel(move|event,window,cx|{if scroll_input(&scrolled,event,window,scroll_epoch){scroll_drive(window,cx);}});}
let (accessible,role,name,actions,slot)={let o=owner.borrow();(o.accessible,o.accessible_role.clone(),o.name_content,o.accessible_actions.clone(),o.slot.clone())};if native_focus_available(owner)&&!text_disabled(owner){element=element.track_focus(focus)}if text_supported(owner){element=element.role(gpui::Role::TextInput);}if accessible{let role=resolved(&role);if !role.nullish(){if let Some(role)=role_from_name(&role.text()){native_role=Some(role);if role!=gpui::Role::GenericContainer{element=element.role(role);}}}if name{element=element.aria_label((value.text)(&slot));}for action in actions{let native_action=action_from_name(&action);if let Some(lease)=native_accessible_action_lease(owner,&action){element=element.on_a11y_action(native_action,move |data,window,cx|lease.request_data(data,window,cx));}}}
if control_label_is_label(owner){
    element=element.role(gpui::Role::Label);
    if let Some(lease)=control_label_action_lease(owner){
        element=element.on_a11y_action(gpui::AccessibleAction::Click,move|_,window,cx|lease.request(window,cx));
    }
}
let hover_view=Rc::new(Cell::new(None));
if native_pointer_input_needed(owner){
let capture_down=owner.clone();let capture_drive=drive.clone();element.interactivity().capture_any_mouse_down(move|event,window,cx|{control_label_pointer_capture(&capture_down);let mut fields=event_fields("host:mousedown");modifiers(&mut fields,event.modifiers);if dispatch_phase(&capture_down,"host:mousedown",false,true,fields){window.prevent_default()}capture_drive(window,cx)});
let on_down=owner.clone();let down_drive=drive.clone();element.interactivity().on_any_mouse_down(move|event,window,cx|{let eligible=claim_pointer(&on_down);control_label_down(&on_down,event,eligible,window);if eligible{let mut fields=event_fields("pointer.down");modifiers(&mut fields,event.modifiers);let mut prevented=dispatch_root_route(&on_down,"pointer.down",fields.clone());if event.button==gpui::MouseButton::Left{prevented|=pointer_intent(&on_down,"press.start",press_fields("press.start",&fields));}if prevented{window.prevent_default()}else if !window.default_prevented(){text_pointer_down(&on_down,event,window,cx);}if event.button==gpui::MouseButton::Right&&dispatch_root_route(&on_down,"context.menu",event_fields("context.menu")){window.prevent_default()}}let mut fields=event_fields("host:mousedown");modifiers(&mut fields,event.modifiers);if dispatch(&on_down,"host:mousedown",false,fields){window.prevent_default()}if window.default_prevented(){control_label_cancel(&on_down);}down_drive(window,cx)});
let capture_up=owner.clone();let capture_drive=drive.clone();element.interactivity().capture_any_mouse_up(move|event,window,cx|{let mut fields=event_fields("host:mouseup");modifiers(&mut fields,event.modifiers);if dispatch_phase(&capture_up,"host:mouseup",false,true,fields){window.prevent_default()}capture_drive(window,cx)});
let on_up=owner.clone();let up_drive=drive.clone();element.interactivity().on_any_mouse_up(move|event,window,cx|{if claim_pointer(&on_up){let mut fields=event_fields("pointer.up");modifiers(&mut fields,event.modifiers);let mut prevented=dispatch_root_route(&on_up,"pointer.up",fields.clone());if event.button==gpui::MouseButton::Left{prevented|=pointer_intent(&on_up,"press.end",press_fields("press.end",&fields));}if prevented{window.prevent_default()}}let mut fields=event_fields("host:mouseup");modifiers(&mut fields,event.modifiers);if dispatch(&on_up,"host:mouseup",false,fields){window.prevent_default()}up_drive(window,cx)});
let on_move=owner.clone();let move_drive=drive.clone();let hover_motion=hover_view.clone();element=element.on_mouse_move(move|event,window,cx|{control_label_pointer_sample(&on_move,event.position,event.pressed_button==Some(gpui::MouseButton::Left)&&control_label_unmodified(event.modifiers),false,window);if claim_pointer(&on_move){let mut fields=event_fields("pointer.move");modifiers(&mut fields,event.modifiers);if dispatch_root_route(&on_move,"pointer.move",fields){window.prevent_default()}else if !window.default_prevented(){text_pointer_move(&on_move,event,window,cx);}}let mut fields=event_fields("host:mousemove");modifiers(&mut fields,event.modifiers);if dispatch(&on_move,"host:mousemove",false,fields){window.prevent_default()}if native_hover_motion(&on_move,hover_motion.get(),window,cx){window.prevent_default()}move_drive(window,cx)});
let on_hover=owner.clone();let hover_drive=drive.clone();let hover_input=hover_view.clone();element=element.on_hover(move|hover,window,cx|{if let Some(view)=hover_input.get(){if native_hover_input(&on_hover,view,*hover,window,cx){window.prevent_default()}}hover_drive(window,cx)});
let on_click=owner.clone();let click_drive=drive.clone();element=element.on_click(move|event,window,cx|{let(suppress,cancelled)={let mut o=on_click.borrow_mut();(std::mem::take(&mut o.suppress_click),std::mem::take(&mut o.press.cancelled))};let eligible=claim_click(&on_click);if !cancelled&&!(suppress&&matches!(event,gpui::ClickEvent::Keyboard(_)))&&eligible&&dispatch_root_route(&on_click,"press.commit",event_fields("press.commit")){window.prevent_default()}if dispatch(&on_click,"host:click",false,event_fields("host:click")){window.prevent_default()}control_label_click(&on_click,event,eligible&&!cancelled,window,cx);global_native_click(event,window,cx);click_drive(window,cx)});

}
if native_key_input_needed(owner){
let capture_key=owner.clone();element=element.capture_key_down(move|event,window,_|{reset_key();let mut fields=event_fields("host:keydown");if let Some(key)=portable_key(&event.keystroke){fields.insert("key".into(),Json::String(key));}modifiers(&mut fields,event.keystroke.modifiers);if dispatch_phase(&capture_key,"host:keydown",false,true,fields){window.prevent_default()}});let capture_key=owner.clone();element=element.capture_key_up(move|event,window,_|{reset_key();let mut fields=event_fields("host:keyup");if let Some(key)=portable_key(&event.keystroke){fields.insert("key".into(),Json::String(key));}modifiers(&mut fields,event.keystroke.modifiers);if dispatch_phase(&capture_key,"host:keyup",false,true,fields){window.prevent_default()}});
let on_key=owner.clone();element=element.on_key_down(move|event,window,cx|{let mut fields=event_fields("host:keydown");fields.insert("key".into(),Json::String(portable_key(&event.keystroke).expect("portable key string")));modifiers(&mut fields,event.keystroke.modifiers);if dispatch(&on_key,"host:keydown",false,fields){window.prevent_default()}collect_key(&on_key);global_key_down(event,window,cx);});
let on_key=owner.clone();element=element.on_key_up(move|event,window,cx|{let mut fields=event_fields("host:keyup");fields.insert("key".into(),Json::String(portable_key(&event.keystroke).expect("portable key string")));modifiers(&mut fields,event.keystroke.modifiers);if dispatch(&on_key,"host:keyup",false,fields){window.prevent_default()}collect_key(&on_key);global_key_up(event,window,cx);});
}
let measured=owner.clone();let committed=owner.clone();let revision=owner.borrow().projection_revision;let commit_drive=drive.clone();let commit_focus=focus.clone();
element=element.child(canvas(move|_,window,_|{
    note_host_order(&measured);
    let external_scroll=!measured.borrow().modules.scroll.builtin_projection();
    if !external_scroll{scroll_frame(&measured,window);}
    hover_view.set(native_hover_view(&measured,window));
},move|_,_,window,cx|{
    // A bound child viewport commits and clamps its real ScrollHandle during
    // prepaint. Observe it after the whole prepaint pass, never its raw wheel
    // offset while the parent canvas is traversed ahead of that child.
    let external_scroll=!committed.borrow().modules.scroll.builtin_projection();
    if external_scroll{scroll_frame(&committed,window);}
    if native_pointer_input_needed(&committed){register_pointer_input(window,Some(Rc::downgrade(&committed)));}
    if crate::gpui_native_move::move_owner_has_binding(&committed){crate::gpui_native_move::register_move_input(window,Rc::downgrade(&committed));}
    if native_boundary_input_needed(&committed){window.on_mouse_event::<gpui::MouseDownEvent>(native_pointer_press);}
    if committed.borrow().modules.hooks.contains("overlay"){window.on_mouse_event::<gpui::ScrollWheelEvent>(overlay_modal_wheel);}
    let owner=committed.clone();let drive=commit_drive.clone();let focus=commit_focus.clone();let epoch=owner.borrow().epoch;
    window.defer(cx,move|window,cx|{
        // A mounted/updated callback may publish before it throws. Preserve
        // the reported error and stopped callback list; only deliver events
        // already published, without retrying commit or authored projection.
        if native_host_callback(&owner,"commit",||{
            let current={let o=owner.borrow();!o.disposed&&o.present&&o.bounds.is_some()&&o.epoch==epoch&&o.window_id==Some(window.window_handle().window_id())&&o.projection_revision==revision};
            if !current{return}if native_focus_observation_needed(&owner){owner.borrow_mut().modules.focus.native=Some(focus);}
            #[cfg(feature="experimental-focus-tree")]refresh_native_entry(&owner,window);
            Owner::commit(&owner,revision);if owner.borrow().disposed||!owner.borrow().present{return}
            if native_hover_reconcile(&owner,window,cx){window.prevent_default()}
            poll_state_watchers();if !owner.borrow().disposed&&owner.borrow().present{drive(window,cx)}
        }).is_none(){drive_pending_native_events(&owner,window,cx); }
    });
}).absolute().size_full());
if image_supported(owner){let fill_height=matches!(element.style().size.height,Some(gpui::Length::Definite(_)));element=element.child(image_element(owner,fill_height));}
if text_supported(owner){let fill_height=matches!(element.style().size.height,Some(gpui::Length::Definite(_)));let scrolled=owner.clone();element=element.on_scroll_wheel(move|event,window,cx|{if text_scroll(&scrolled,event,window,cx){cx.stop_propagation();}}).child(NativeTextElement::new(owner,focus,fill_height));}
let slot=owner.borrow().slot.clone();let mut child_index=0;for child in (value.frame)(owner,focus,&path,&drive,&slot,&mut child_index){element=element.child(child);}
// External virtual surfaces establish their real extents while prepainting the
// slot. Observe and apply deferred requests after those children, not before.
if owner.borrow().modules.hooks.contains("scroll"){let scrolled=owner.clone();element=element.child(canvas(move|_,window,_|scroll_frame(&scrolled,window),|_,_,_,_|{}).absolute().size_full());}
let element=translated_element(crate::gpui_native_a11y::Semantics{element:element.into_element(),owner:Rc::downgrade(owner),role:native_role}.into_any_element(),translation,Some(Rc::downgrade(owner)));let(element,fixed)=positioning_root(owner,element,fixed);overlay_root(owner,element,fixed)
}
pub fn modifiers(fields:&mut Map<String,Json>,modifiers:gpui::Modifiers){fields.insert("altKey".into(),Json::Bool(modifiers.alt));fields.insert("ctrlKey".into(),Json::Bool(modifiers.control));fields.insert("shiftKey".into(),Json::Bool(modifiers.shift));fields.insert("metaKey".into(),Json::Bool(modifiers.platform));}
pub fn portable_key(key:&gpui::Keystroke)->Option<String>{Some(crate::gpui_native_key::portable_key(key).unwrap_or_else(||"Unidentified".into()))}
pub fn role_from_name(name:&str)->Option<gpui::Role>{
    // ARIA role tokens use the first recognized ASCII-case-insensitive token.
    // Unknown tokens preserve the physical host's native role.
    for token in name.split_ascii_whitespace(){
        if token.len()>32{continue}
        let mut folded=[0u8;32];for(output,input)in folded.iter_mut().zip(token.bytes()){*output=input.to_ascii_lowercase();}
        let token=std::str::from_utf8(&folded[..token.len()]).expect("ASCII case folding preserves UTF-8");
        let role=match token{
            "alert"=>gpui::Role::Alert,
            "alertdialog"=>gpui::Role::AlertDialog,
            "application"=>gpui::Role::Application,
            "article"=>gpui::Role::Article,
            "banner"=>gpui::Role::Banner,
            "blockquote"=>gpui::Role::Blockquote,
            "button"=>gpui::Role::Button,
            "caption"=>gpui::Role::Caption,
            "cell"=>gpui::Role::Cell,
            "checkbox"=>gpui::Role::CheckBox,
            "code"=>gpui::Role::Code,
            "columnheader"=>gpui::Role::ColumnHeader,
            "combobox"=>gpui::Role::ComboBox,
            "comment"=>gpui::Role::Comment,
            "complementary"=>gpui::Role::Complementary,
            "contentinfo"=>gpui::Role::ContentInfo,
            "definition"=>gpui::Role::Definition,
            "deletion"=>gpui::Role::ContentDeletion,
            "dialog"=>gpui::Role::Dialog,
            "directory"=>gpui::Role::List,
            "document"=>gpui::Role::Document,
            "emphasis"=>gpui::Role::Emphasis,
            "feed"=>gpui::Role::Feed,
            "figure"=>gpui::Role::Figure,
            "form"=>gpui::Role::Form,
            "generic"=>gpui::Role::GenericContainer,
            "grid"=>gpui::Role::Grid,
            "gridcell"=>gpui::Role::GridCell,
            "group"=>gpui::Role::Group,
            "heading"=>gpui::Role::Heading,
            "img"=>gpui::Role::Image,
            "insertion"=>gpui::Role::ContentInsertion,
            "link"=>gpui::Role::Link,
            "list"=>gpui::Role::List,
            "listbox"=>gpui::Role::ListBox,
            "listitem"=>gpui::Role::ListItem,
            "log"=>gpui::Role::Log,
            "main"=>gpui::Role::Main,
            "mark"=>gpui::Role::Mark,
            "marquee"=>gpui::Role::Marquee,
            "math"=>gpui::Role::Math,
            "menu"=>gpui::Role::Menu,
            "menubar"=>gpui::Role::MenuBar,
            "menuitem"=>gpui::Role::MenuItem,
            "menuitemcheckbox"=>gpui::Role::MenuItemCheckBox,
            "menuitemradio"=>gpui::Role::MenuItemRadio,
            "meter"=>gpui::Role::Meter,
            "navigation"=>gpui::Role::Navigation,
            "none"=>gpui::Role::GenericContainer,
            "note"=>gpui::Role::Note,
            "option"=>gpui::Role::ListBoxOption,
            "paragraph"=>gpui::Role::Paragraph,
            "presentation"=>gpui::Role::GenericContainer,
            "progressbar"=>gpui::Role::ProgressIndicator,
            "radio"=>gpui::Role::RadioButton,
            "radiogroup"=>gpui::Role::RadioGroup,
            "region"=>gpui::Role::Region,
            "row"=>gpui::Role::Row,
            "rowgroup"=>gpui::Role::RowGroup,
            "rowheader"=>gpui::Role::RowHeader,
            "scrollbar"=>gpui::Role::ScrollBar,
            "search"=>gpui::Role::Search,
            "searchbox"=>gpui::Role::SearchInput,
            "separator"=>gpui::Role::Splitter,
            "slider"=>gpui::Role::Slider,
            "spinbutton"=>gpui::Role::SpinButton,
            "status"=>gpui::Role::Status,
            "strong"=>gpui::Role::Strong,
            "suggestion"=>gpui::Role::Suggestion,
            "switch"=>gpui::Role::Switch,
            "tab"=>gpui::Role::Tab,
            "table"=>gpui::Role::Table,
            "tablist"=>gpui::Role::TabList,
            "tabpanel"=>gpui::Role::TabPanel,
            "term"=>gpui::Role::Term,
            "time"=>gpui::Role::Time,
            "timer"=>gpui::Role::Timer,
            "toolbar"=>gpui::Role::Toolbar,
            "tooltip"=>gpui::Role::Tooltip,
            "tree"=>gpui::Role::Tree,
            "treegrid"=>gpui::Role::TreeGrid,
            "treeitem"=>gpui::Role::TreeItem,
            "graphics-document"=>gpui::Role::GraphicsDocument,
            "graphics-object"=>gpui::Role::GraphicsObject,
            "graphics-symbol"=>gpui::Role::GraphicsSymbol,
            "doc-abstract"=>gpui::Role::DocAbstract,
            "doc-acknowledgements"=>gpui::Role::DocAcknowledgements,
            "doc-afterword"=>gpui::Role::DocAfterword,
            "doc-appendix"=>gpui::Role::DocAppendix,
            "doc-backlink"=>gpui::Role::DocBackLink,
            "doc-biblioentry"=>gpui::Role::DocBiblioEntry,
            "doc-bibliography"=>gpui::Role::DocBibliography,
            "doc-biblioref"=>gpui::Role::DocBiblioRef,
            "doc-chapter"=>gpui::Role::DocChapter,
            "doc-colophon"=>gpui::Role::DocColophon,
            "doc-conclusion"=>gpui::Role::DocConclusion,
            "doc-cover"=>gpui::Role::DocCover,
            "doc-credit"=>gpui::Role::DocCredit,
            "doc-credits"=>gpui::Role::DocCredits,
            "doc-dedication"=>gpui::Role::DocDedication,
            "doc-endnote"=>gpui::Role::DocEndnote,
            "doc-endnotes"=>gpui::Role::DocEndnotes,
            "doc-epigraph"=>gpui::Role::DocEpigraph,
            "doc-epilogue"=>gpui::Role::DocEpilogue,
            "doc-errata"=>gpui::Role::DocErrata,
            "doc-example"=>gpui::Role::DocExample,
            "doc-footnote"=>gpui::Role::DocFootnote,
            "doc-foreword"=>gpui::Role::DocForeword,
            "doc-glossary"=>gpui::Role::DocGlossary,
            "doc-glossref"=>gpui::Role::DocGlossRef,
            "doc-index"=>gpui::Role::DocIndex,
            "doc-introduction"=>gpui::Role::DocIntroduction,
            "doc-noteref"=>gpui::Role::DocNoteRef,
            "doc-notice"=>gpui::Role::DocNotice,
            "doc-pagebreak"=>gpui::Role::DocPageBreak,
            "doc-pagefooter"=>gpui::Role::DocPageFooter,
            "doc-pageheader"=>gpui::Role::DocPageHeader,
            "doc-pagelist"=>gpui::Role::DocPageList,
            "doc-part"=>gpui::Role::DocPart,
            "doc-preface"=>gpui::Role::DocPreface,
            "doc-prologue"=>gpui::Role::DocPrologue,
            "doc-pullquote"=>gpui::Role::DocPullquote,
            "doc-qna"=>gpui::Role::DocQna,
            "doc-subtitle"=>gpui::Role::DocSubtitle,
            "doc-tip"=>gpui::Role::DocTip,
            "doc-toc"=>gpui::Role::DocToc,
            _=>continue,
        };return Some(role)
    }None
}
pub fn action_from_name(name:&str)->gpui::AccessibleAction{match name{"activate"|"click"|"press"=>gpui::AccessibleAction::Click,"focus"=>gpui::AccessibleAction::Focus,"increment"=>gpui::AccessibleAction::Increment,"decrement"=>gpui::AccessibleAction::Decrement,"setValue"=>gpui::AccessibleAction::SetValue,_=>panic!("unsupported native accessibility action: {name}")}}
// A native action callback belongs to one declaration and one committed view.
// It does not keep the owner alive or regain authority after same-key setup
// replacement, detach/remount, disposal or migration to another Window.
#[derive(Clone)]
pub struct NativeAccessibleActionLease {
    owner:OwnerWeak, key:String, event:String, identity:Rc<()>, epoch:u64, window:gpui::WindowId,
}
impl NativeAccessibleActionLease {
    pub fn request(&self,window:&mut Window,cx:&mut App) {
        self.request_data(None,window,cx)
    }
    pub fn request_data(&self,data:Option<&gpui::accesskit::ActionData>,window:&mut Window,cx:&mut App) {
        let Some(owner)=self.owner.upgrade() else{return};
        let current={let o=owner.borrow();!o.disposed&&!o.disposing&&o.present&&o.mounted&&o.bounds.is_some()
            &&o.accessible&&o.epoch==self.epoch&&o.window_id==Some(self.window)
            &&window.window_handle().window_id()==self.window&&o.accessible_actions.contains(&self.key)
            &&o.modules.action_identities.get(&self.key).is_some_and(|identity|Rc::ptr_eq(identity,&self.identity))
            &&o.modules.action_events.get(&self.key)==Some(&self.event)};
        if !current{return}
        let prevented=dispatch_accessibility_action(&owner,&self.key,data);
        if prevented{window.prevent_default()}
        drive_owners(window,cx);
    }
}
pub fn native_accessible_action_lease(owner:&OwnerRef,key:&str)->Option<NativeAccessibleActionLease> {
    let o=owner.borrow();
    if o.disposed||o.disposing||!o.present||!o.accessible||!o.accessible_actions.contains(key){return None}
    // Paint precedes first commit; bind to the epoch that this view will commit.
    Some(NativeAccessibleActionLease {owner:Rc::downgrade(owner),key:key.into(),
        event:o.modules.action_events.get(key)?.clone(),identity:o.modules.action_identities.get(key)?.clone(),
        epoch:o.epoch+u64::from(!o.mounted),window:o.window_id?})
}
thread_local!{static KEY_TARGET:RefCell<Option<OwnerWeak>>=RefCell::new(None);static KEY_DISPATCHED:Cell<bool>=Cell::new(false);static CLICK_TARGET:RefCell<Option<OwnerWeak>>=RefCell::new(None);static POINTER_TARGET:RefCell<Option<OwnerWeak>>=RefCell::new(None);static POINTER_DISPATCHED:Cell<bool>=Cell::new(false);static GLOBAL_CLICK_DISPATCHED:Cell<bool>=Cell::new(false);}
thread_local!{static KEY_SCOPES:RefCell<Vec<(gpui::WindowId,gpui::WeakFocusHandle)>>=RefCell::new(Vec::new());}
pub fn register_key_scope(focus:&FocusHandle,window:&Window){let id=window.window_handle().window_id();KEY_SCOPES.with(|scopes|{let mut scopes=scopes.borrow_mut();if scopes.iter().any(|(window,scope)|*window==id&&scope==focus){return}scopes.retain(|(_,scope)|scope.upgrade().is_some());scopes.push((id,focus.downgrade()));});}
// Resolve against the current physical tree, including cached or reparented views.
// Equal handles are excluded: SDK contains(h,h) is not a physical-presence check.
pub fn outer_key_scope(focus:&FocusHandle,window:&Window)->bool{let id=window.window_handle().window_id();KEY_SCOPES.with(|scopes|!scopes.borrow().iter().any(|(scope_window,scope)|*scope_window==id&&scope!=focus&&scope.upgrade().is_some_and(|parent|parent.contains(focus,window))))}
// Hooks and listeners are installed during checked setup; these direct host
// predicates acquire only the native input resources actually requested.
pub fn native_focus_observation_needed(owner:&OwnerRef)->bool{let o=owner.borrow();o.focusable||o.modules.hooks.iter().any(|hook|matches!(*hook,"focus"|"focus-entry"|"focus-scope"|"focus-roving"|"trigger"|"text-control"))||o.listeners.iter().any(|listener|matches!(listener.kind.as_str(),"host:focus"|"host:blur"|"focus"|"blur")||listener.kind.starts_with("press."))}
// A visible Label borrows pointer activation without becoming a focus target.
// Its pending request must still retire when this native window deactivates.
pub fn native_window_observation_needed(owner:&OwnerRef)->bool{native_focus_observation_needed(owner)||crate::gpui_native_move::move_owner_has_binding(owner)||control_label_action_enabled(owner)}
pub fn native_pointer_input_needed(owner:&OwnerRef)->bool{
    // An attached MoveGesture owns this physical target even when the source
    // consumes only its exposed sampling methods. Its root must claim the
    // ordinary pointer/click route so an ancestor Trigger cannot also activate.
    if crate::gpui_native_move::move_owner_has_binding(owner){return true}
    let o=owner.borrow();o.modules.control_label.kind==Some(ControlLabelKind::Label)||o.modules.hooks.contains("trigger")||o.modules.hooks.contains("text-control")||o.listeners.iter().any(|listener|listener.kind.starts_with("pointer.")||listener.kind.starts_with("press.")||listener.kind.starts_with("host:mouse")||matches!(listener.kind.as_str(),"host:click"|"context.menu"))
}
pub fn native_key_input_needed(owner:&OwnerRef)->bool{let o=owner.borrow();o.focusable||o.modules.hooks.iter().any(|hook|matches!(*hook,"focus-scope"|"focus-roving"|"trigger"|"text-control"))||o.listeners.iter().any(|listener|listener.kind.starts_with("key.")||listener.kind.starts_with("press.")||matches!(listener.kind.as_str(),"host:keydown"|"host:keyup"))}
pub fn native_boundary_input_needed(owner:&OwnerRef)->bool{let o=owner.borrow();o.modules.boundary.observing||o.modules.hooks.contains("overlay")}
pub fn window_input_needed(owner:&OwnerRef)->bool{let owner=owner.borrow();owner.modules.hooks.contains("focus-scope")||owner.modules.focus.roving_declared||owner.listeners.iter().any(|listener|listener.global&&(listener.kind.starts_with("key.")||listener.kind.starts_with("press.")||matches!(listener.kind.as_str(),"host:keydown"|"host:keyup")))}
pub fn restore_window_input(owner:&OwnerRef,focus:&FocusHandle,window:&mut Window,cx:&mut App){
    if !ready(owner){return}
    // Focus-lost also fires when a retained handle's native node disappears.
    // Respect any earlier native fallback that already chose a different handle.
    let current=window.focused(cx);let unchanged={let owner=owner.borrow();match(current.as_ref(),owner.window_input_observed.as_ref()){(None,None)=>true,(Some(current),Some(observed))=>observed==current,_=>false}};
    if current.is_none()||unchanged{focus.focus(window,cx);}
}
// A non-tab-stop dispatch carrier, not the component's authored Focus or Root.
// Its listeners run only while no actual control owns native keyboard focus.
struct WindowInput{element:AnyElement,focus:FocusHandle,owner:OwnerWeak}
#[cfg(not(feature = "gpui-modern-element-api"))]
impl IntoElement for WindowInput{type Element=Self;fn into_element(self)->Self{self}}
impl gpui::Element for WindowInput{
    type RequestLayoutState=();type PrepaintState=();
    fn id(&self)->Option<gpui::ElementId>{None}
    fn source_location(&self)->Option<&'static std::panic::Location<'static>>{None}
    fn request_layout(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,window:&mut Window,cx:&mut App)->(gpui::LayoutId,()){(self.element.request_layout(window,cx),())}
    fn prepaint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut (),window:&mut Window,cx:&mut App){register_key_scope(&self.focus,window);if window.focused(cx).is_none(){self.focus.focus(window,cx);}window.set_focus_handle(&self.focus,cx);if let Some(owner)=self.owner.upgrade(){owner.borrow_mut().window_input_observed=window.focused(cx).map(|focus|focus.downgrade());}self.element.prepaint(window,cx);}
    fn paint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut (),_:&mut (),window:&mut Window,cx:&mut App){
        // SDK focus-lost fallback runs after paint. Test the lease at delivery,
        // so restoring a carrier does not require an unrelated component redraw.
        let down=self.focus.clone();window.on_key_event::<gpui::KeyDownEvent>(move|event,phase,window,cx|{if !down.is_focused(window){return}if phase.capture(){reset_key();}else{global_key_down(event,window,cx);}});
        let up=self.focus.clone();window.on_key_event::<gpui::KeyUpEvent>(move|event,phase,window,cx|{if phase.capture(){if up.is_focused(window){reset_key();}if outer_key_scope(&up,window){global_host_key_up_capture(event,window,cx);}}else if up.is_focused(window){global_key_up(event,window,cx);}});
        self.element.paint(window,cx);
    }
}
pub fn window_input_scope(element:AnyElement,focus:&FocusHandle,owner:&OwnerRef)->AnyElement{WindowInput{element,focus:focus.clone(),owner:Rc::downgrade(owner)}.into_any_element()}
pub fn reset_key(){GLOBAL_CLICK_DISPATCHED.with(|dispatched|dispatched.set(false));KEY_TARGET.with(|target|*target.borrow_mut()=None);KEY_DISPATCHED.with(|dispatched|dispatched.set(false));}
pub fn reset_click(){CLICK_TARGET.with(|target|*target.borrow_mut()=None);}
pub fn collect_key(owner:&OwnerRef){KEY_TARGET.with(|target|{if target.borrow().is_none(){*target.borrow_mut()=Some(Rc::downgrade(owner));}});}
pub fn claim_click(owner:&OwnerRef)->bool{CLICK_TARGET.with(|target|{if target.borrow().is_none(){*target.borrow_mut()=Some(Rc::downgrade(owner));}target.borrow().as_ref().and_then(Weak::upgrade).is_some_and(|target|Rc::ptr_eq(&target,owner))})}
fn claim_pointer(owner:&OwnerRef)->bool{POINTER_TARGET.with(|target|{let mut target=target.borrow_mut();if target.is_some(){false}else{*target=Some(Rc::downgrade(owner));true}})}
fn press_fields(kind:&str,fields:&Map<String,Json>)->Map<String,Json>{let mut fields=fields.clone();fields.insert("type".into(),Json::String(kind.into()));fields}
fn pointer_intent(owner:&OwnerRef,kind:&str,fields:Map<String,Json>)->bool{
    if !ready(owner)||trigger_child(owner).is_some()||!hit_participates(owner){return false}
    let emit={let mut owner=owner.borrow_mut();match kind{
        "press.start"=>{let start=!owner.press.pointer;owner.press.pointer=true;owner.press.cancelled=false;start},
        "press.end"=>std::mem::take(&mut owner.press.pointer),
        "press.cancel"=>{let held=std::mem::take(&mut owner.press.pointer);owner.press.cancelled|=held;held},_=>false,
    }};emit&&dispatch_root_route(owner,kind,fields)
}
pub fn native_press_blur(owner:&OwnerRef)->bool{let held=owner.borrow_mut().press.key.take().is_some();held&&dispatch_root_route(owner,"press.cancel",event_fields("press.cancel"))}
pub fn native_window_blur(owner:&OwnerRef)->bool{
    control_label_cancel(owner);
    crate::gpui_native_move::move_blur(owner);
    let(root,global)={let mut o=owner.borrow_mut();let root=o.press.key.take().is_some()||o.press.pointer;let global=o.press.global_key.take().is_some()||o.press.global_pointer;let keyboard_click=o.press.global_keyboard_click;let pointer_cancelled=o.press.cancelled||o.press.pointer;let global_pointer_cancelled=o.press.global_pointer_cancelled||o.press.global_pointer;o.press=NativePress::default();o.press.global_keyboard_click=keyboard_click;o.press.cancelled=pointer_cancelled;o.press.global_pointer_cancelled=global_pointer_cancelled;(root,global)};
    let mut prevented=false;if root{prevented|=dispatch_root_route(owner,"press.cancel",event_fields("press.cancel"));}if global{prevented|=dispatch(owner,"press.cancel",true,event_fields("press.cancel"));}prevented
}
pub fn click_event_fields(kind:&str,event:&gpui::ClickEvent)->Map<String,Json>{
    let mut fields=event_fields(kind);modifiers(&mut fields,event.modifiers());fields
}
pub fn global_native_click(event:&gpui::ClickEvent,window:&mut Window,cx:&mut App){
    if matches!(event,gpui::ClickEvent::Mouse(event)if event.up.button!=gpui::MouseButton::Left){return}
    if GLOBAL_CLICK_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
    let keyboard=matches!(event,gpui::ClickEvent::Keyboard(_));let mut prevented=false;
    for owner in owners_in(window,cx){if !owner.borrow().press_global{continue}let suppress={let mut owner=owner.borrow_mut();let suppress=if keyboard{owner.press.global_keyboard_click}else{owner.press.global_pointer_cancelled};owner.press.global_keyboard_click=false;owner.press.global_pointer_cancelled=false;suppress};if !suppress{prevented|=dispatch(&owner,"press.commit",true,click_event_fields("press.commit",event));}}
    if prevented{window.prevent_default()}drive_owners(window,cx);
}
fn global_pointer(kind:&str,host_kind:&str,modifiers_value:gpui::Modifiers,primary:bool,phase:gpui::DispatchPhase,window:&mut Window,cx:&mut App){
    if phase.capture(){POINTER_TARGET.with(|target|*target.borrow_mut()=None);POINTER_DISPATCHED.with(|dispatched|dispatched.set(false));if kind=="pointer.up"{reset_click();GLOBAL_CLICK_DISPATCHED.with(|dispatched|dispatched.set(false));}return}
    if !phase.bubble()||POINTER_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
    let mut fields=event_fields(kind);modifiers(&mut fields,modifiers_value);let mut host_fields=event_fields(host_kind);modifiers(&mut host_fields,modifiers_value);let mut prevented=false;
    for owner in owners_in(window,cx){
        prevented|=dispatch(&owner,kind,true,fields.clone());prevented|=dispatch(&owner,host_kind,true,host_fields.clone());
        if primary&&ready(&owner)&&owner.borrow().press_global{let intent={let mut owner=owner.borrow_mut();match kind{"pointer.down"=>{owner.press.global_keyboard_click=false;owner.press.global_pointer_cancelled=false;if owner.press.global_pointer{None}else{owner.press.global_pointer=true;Some("press.start")}},"pointer.up"=>if std::mem::take(&mut owner.press.global_pointer){Some("press.end")}else{None},_=>None}};if let Some(intent)=intent{prevented|=dispatch(&owner,intent,true,press_fields(intent,&fields));}}
        if primary&&kind=="pointer.up"&&owner.borrow().press.pointer{let intent=if native_host_hit(&owner,window.mouse_position(),window){"press.end"}else{"press.cancel"};prevented|=pointer_intent(&owner,intent,press_fields(intent,&fields));}
    }
    if prevented{window.prevent_default();}drive_owners(window,cx);
}
fn global_host_pointer_capture(owner:&Option<OwnerWeak>,kind:&str,modifiers_value:gpui::Modifiers,phase:gpui::DispatchPhase,window:&mut Window,cx:&mut App){if !phase.capture(){return}let Some(owner)=owner.as_ref().and_then(Weak::upgrade)else{return};if !ready(&owner)||owner.borrow().window_id!=Some(window.window_handle().window_id())||!has_listener(&owner,kind,true,true){return}let mut fields=event_fields(kind);modifiers(&mut fields,modifiers_value);if dispatch_phase(&owner,kind,true,true,fields){window.prevent_default()}let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx)}}
pub fn register_pointer_input(window:&mut Window,owner:Option<OwnerWeak>){
    let down=owner.clone();window.on_mouse_event::<gpui::MouseDownEvent>(move|event,phase,window,cx|{if phase.capture(){for owner in owners_in(window,cx){control_label_cancel(&owner);}}global_host_pointer_capture(&down,"host:mousedown",event.modifiers,phase,window,cx);global_pointer("pointer.down","host:mousedown",event.modifiers,event.button==gpui::MouseButton::Left,phase,window,cx);});
    let up=owner.clone();window.on_mouse_event::<gpui::MouseUpEvent>(move|event,phase,window,cx|{if phase.capture(){for owner in owners_in(window,cx){control_label_pointer_sample(&owner,event.position,event.button==gpui::MouseButton::Left&&control_label_unmodified(event.modifiers),true,window);}}global_host_pointer_capture(&up,"host:mouseup",event.modifiers,phase,window,cx);global_pointer("pointer.up","host:mouseup",event.modifiers,event.button==gpui::MouseButton::Left,phase,window,cx);});
    window.on_mouse_event::<gpui::MouseMoveEvent>(move|event,phase,window,cx|{if phase.capture(){for owner in owners_in(window,cx){control_label_pointer_sample(&owner,event.position,event.pressed_button==Some(gpui::MouseButton::Left)&&control_label_unmodified(event.modifiers),false,window);}}global_host_pointer_capture(&owner,"host:mousemove",event.modifiers,phase,window,cx);global_pointer("pointer.move","host:mousemove",event.modifiers,false,phase,window,cx);});
    window.on_mouse_event::<gpui::MouseExitEvent>(move|_,phase,window,cx|{if phase.capture(){for owner in owners_in(window,cx){control_label_cancel(&owner);}}});
}
fn global_host_key_down_capture(owner:&OwnerRef,event:&gpui::KeystrokeEvent,window:&mut Window,cx:&mut App){if !ready(owner)||owner.borrow().window_id!=Some(window.window_handle().window_id())||!has_listener(owner,"host:keydown",true,true){return}let mut fields=event_fields("host:keydown");fields.insert("key".into(),Json::String(portable_key(&event.keystroke).expect("portable key string")));modifiers(&mut fields,event.keystroke.modifiers);if dispatch_phase(owner,"host:keydown",true,true,fields){window.prevent_default()}let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx)}}
pub fn subscribe_global_key_capture(owner:&OwnerRef,cx:&mut App)->Option<gpui::Subscription>{if !has_listener(owner,"host:keydown",true,true){return None}let owner=Rc::downgrade(owner);Some(cx.intercept_keystrokes(move|event,window,cx|{if let Some(owner)=owner.upgrade(){global_host_key_down_capture(&owner,event,window,cx);}}))}
pub fn global_host_key_up_capture(event:&gpui::KeyUpEvent,window:&mut Window,cx:&mut App){let mut fields=None;let mut prevented=false;for owner in owners_in(window,cx){if !has_listener(&owner,"host:keyup",true,true){continue}let fields=fields.get_or_insert_with(||{let mut fields=event_fields("host:keyup");fields.insert("key".into(),Json::String(portable_key(&event.keystroke).expect("portable key string")));modifiers(&mut fields,event.keystroke.modifiers);fields});prevented|=dispatch_phase(&owner,"host:keyup",true,true,fields.clone());}if fields.is_some(){if prevented{window.prevent_default()}drive_owners(window,cx);}}
fn owners_in(window:&Window,cx:&App)->Vec<OwnerRef>{
    // WindowId/FocusId are local to each App. The generated constructors
    // register ownership before subscribing to any native input route.
    if !cx.has_global::<SequentialFocusInput>(){return Vec::new()}
    let id=window.window_handle().window_id();
    cx.global::<SequentialFocusInput>().owners.iter().filter_map(Weak::upgrade)
        .filter(|owner|{let o=owner.borrow();!o.disposed&&o.mounted&&o.present&&o.window_id==Some(id)}).collect()
}
pub fn drive_owners(window:&mut Window,cx:&mut App){for owner in owners_in(window,cx){let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx)}}}
pub fn global_key_down(event:&gpui::KeyDownEvent,window:&mut Window,cx:&mut App){
    if KEY_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
    let key=portable_key(&event.keystroke);let mut fields=event_fields("key.down");if let Some(key)=&key{fields.insert("key".into(),Json::String(key.clone()));}fields.insert("repeat".into(),Json::Bool(event.is_held));modifiers(&mut fields,event.keystroke.modifiers);
    let mut host_fields=None;
    let target=native_root_key_target(window);let mut prevented=false;
    for owner in owners_in(window,cx){
        if !matches!(key.as_deref(),Some("Enter"|" ")){owner.borrow_mut().suppress_click=false;}
        if has_listener(&owner,"host:keydown",true,false){prevented|=dispatch(&owner,"host:keydown",true,host_fields.get_or_insert_with(||press_fields("host:keydown",&fields)).clone());}
        prevented|=dispatch(&owner,"key.down",true,fields.clone());
        if !ready(&owner)||!owner.borrow().press_global{continue}
        if let Some(key)=key.as_deref().filter(|key|matches!(*key,"Enter"|" ")){let start={let mut owner=owner.borrow_mut();let start=owner.press.global_key.is_none();if start{owner.press.global_key=Some(key.into());}owner.press.global_keyboard_click=true;start};if start{prevented|=dispatch(&owner,"press.start",true,press_fields("press.start",&fields));}prevented|=dispatch(&owner,"press.commit",true,press_fields("press.commit",&fields));}else{owner.borrow_mut().press.global_keyboard_click=false;}
    }
    if let Some(target)=&target{prevented|=dispatch_root_route(target,"key.down",fields.clone());}
    let native_default_prevented=prevented||window.default_prevented();
    if native_default_prevented{window.prevent_default();cx.stop_propagation();}
    // A portable key default-prevention request (e.g. Button's Space scroll
    // prevention) does not cancel its semantic press intent. Text/IME editing
    // and focus navigation still obey the native default-action boundary.
    if let Some(target)=target.filter(ready){
        if !text_supported(&target){if let Some(key)=key.filter(|key|key=="Enter"||key==" ").filter(|_|trigger_child(&target).is_none()){
            let start={let mut target=target.borrow_mut();let start=target.press.key.is_none();if start{target.press.key=Some(key.clone());}target.suppress_click=true;start};if start&&dispatch_root_route(&target,"press.start",press_fields("press.start",&fields)){window.prevent_default();}let mut fields=event_fields("press.commit");fields.insert("key".into(),Json::String(key));fields.insert("repeat".into(),Json::Bool(event.is_held));modifiers(&mut fields,event.keystroke.modifiers);
            if dispatch_root_route(&target,"press.commit",fields){window.prevent_default();cx.stop_propagation();}
        }else if !native_default_prevented&&focus_key_navigation(event,window,cx){cx.stop_propagation();}}
        else if !native_default_prevented{
            if !text_is_composing(&target)&&focus_key_navigation(event,window,cx){cx.stop_propagation();}
            else if text_key_down(&target,event,window,cx){window.prevent_default();cx.stop_propagation();}
        }
    }else if !native_default_prevented&&focus_key_navigation(event,window,cx){cx.stop_propagation();}
    drive_owners(window,cx);
}
pub fn global_key_up(event:&gpui::KeyUpEvent,window:&mut Window,cx:&mut App){
    if KEY_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
    let key=portable_key(&event.keystroke);let mut fields=event_fields("key.up");if let Some(key)=&key{fields.insert("key".into(),Json::String(key.clone()));}fields.insert("repeat".into(),Json::Bool(false));modifiers(&mut fields,event.keystroke.modifiers);
    let mut host_fields=None;
    let target=KEY_TARGET.with(|target|target.borrow().as_ref().and_then(Weak::upgrade));let mut prevented=false;
    let owners=owners_in(window,cx);
    for owner in &owners{if has_listener(owner,"host:keyup",true,false){prevented|=dispatch(owner,"host:keyup",true,host_fields.get_or_insert_with(||press_fields("host:keyup",&fields)).clone());}prevented|=dispatch(owner,"key.up",true,fields.clone());let end={let mut owner=owner.borrow_mut();if owner.press.global_key.as_deref()==key.as_deref(){owner.press.global_key.take().is_some()}else{false}};if end{prevented|=dispatch(owner,"press.end",true,press_fields("press.end",&fields));}}
    if let Some(target)=&target{prevented|=dispatch_root_route(target,"key.up",fields.clone());}
    for owner in &owners{let end={let mut owner=owner.borrow_mut();if owner.press.key.as_deref()==key.as_deref(){owner.press.key.take().is_some()}else{false}};if end{prevented|=dispatch_root_route(owner,"press.end",press_fields("press.end",&fields));}}
    if prevented{window.prevent_default();cx.stop_propagation();}drive_owners(window,cx);
}

#[cfg(all(test,feature="test-support"))]
mod callback_handle_identity_tests {
    use super::*;
    #[test]
    fn retained_callback_handles_keep_identity_without_reviving_disposed_authority(){
        let first=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        let second=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        let handle=capability(&Rc::downgrade(&first));let retained=handle.clone();
        assert!(strict_equal(&handle,&retained));
        assert!(strict_equal(&handle,&capability(&Rc::downgrade(&first))));
        assert!(!strict_equal(&handle,&capability(&Rc::downgrade(&second))));
        assert!(!strict_equal(&handle,&Value::HostTarget(Rc::downgrade(&first))));
        let definition=definition_capability(&Rc::downgrade(&first));let renderer=render_capability(&Rc::downgrade(&first));
        assert!(strict_equal(&definition,&definition.clone()));assert!(strict_equal(&renderer,&renderer.clone()));
        assert!(!strict_equal(&definition,&handle));assert!(!strict_equal(&renderer,&handle));assert!(!strict_equal(&definition,&renderer));
        Owner::finish(&first,Value::Undefined);Owner::dispose(&first);
        assert!(strict_equal(&handle,&retained),"reference identity survives retirement");
        assert!(catch_authored(||runtime(&handle.owner())).is_err(),"identity is not callback authority");
    }
}
` +
  gpuiNativeValuesSource +
  gpuiNativeAuthoredHooksSource +
  gpuiNativeAsyncSource +
  gpuiNativeModulesSource +
  gpuiNativeTopologySource +
  gpuiNativeTableSource +
  gpuiNativeBoundarySource +
  gpuiNativeScrollSource +
  gpuiNativeTextSource +
  gpuiNativeImageSource +
  gpuiNativePositioningSource +
  gpuiNativeOverlaySource +
  gpuiNativeControlLabelSource +
  gpuiNativeNotifySource +
  gpuiNativeHoverSource +
  gpuiNativeSelectionSource +
  gpuiNativeKeyBoundarySource;
