// This is ordinary emitted Rust support, not an IR interpreter. Every authored
// function and semantic operation is compiled into Component.rs.
import { gpuiNativeModulesSource } from './gpui-native-modules';
import { gpuiNativeTopologySource } from './gpui-native-topology';
import { gpuiNativeTableSource } from './gpui-native-table';
import { gpuiNativeBoundarySource } from './gpui-native-boundary';
import { gpuiNativeScrollSource } from './gpui-native-scroll';
import { gpuiNativeTextSource } from './gpui-native-text';
import { gpuiNativeImageSource } from './gpui-native-image';
import { gpuiNativePositioningSource } from './gpui-native-positioning';
import { gpuiNativeOverlaySource } from './gpui-native-overlay';

export const gpuiNativeOwnerSource =
  String.raw`use std::{cell::{Cell, RefCell}, collections::{BTreeMap, BTreeSet, VecDeque}, rc::{Rc, Weak}};
use serde_json::{Value as Json, Map};
use gpui::{prelude::*, AnyElement, App, Bounds, FocusHandle, Pixels, Window, div, canvas};
pub type OwnerRef = Rc<RefCell<Owner>>;
pub type OwnerWeak = Weak<RefCell<Owner>>;
pub type Callback = Rc<dyn Fn(Vec<Value>) -> Value>;
#[derive(Clone)]
pub enum Value {
    Undefined, Number(f64), Json(Json), Record(Rc<BTreeMap<String, Value>>), Array(Rc<Vec<Value>>),
    Function(Callback), Owner(OwnerWeak), State(Rc<State>),
    Style(Vec<(String, String)>), Resource(Rc<Cell<bool>>), Template(Rc<Node>),
    Input(Rc<Input>), Native(gpui::AnyView),
    StaticCapability(&'static StaticDeclaration), Handle(OwnerWeak, &'static str),
    Observed(OwnerWeak, &'static str), Part(OwnerWeak, String), ObjectRef(OwnerWeak), HostTarget(OwnerWeak),
}
impl Value {
    pub fn json(value: Json) -> Self { match value { Json::Object(entries)=>Self::Record(Rc::new(entries.into_iter().map(|(key,value)|(key,Self::json(value))).collect())),Json::Array(items)=>Self::Array(Rc::new(items.into_iter().map(Self::json).collect())),Json::Number(number)=>Self::Number(number.as_f64().expect("JSON number")),other=>Self::Json(other) } }
    pub fn string(value: &str) -> Self { Self::Json(Json::String(value.into())) }
    pub fn boolean(value: bool) -> Self { Self::Json(Json::Bool(value)) }
    pub fn number(value: f64) -> Self { Self::Number(value) }
    pub fn data(&self) -> Json { match self {
        Self::Number(value)=>{assert!(value.is_finite(),"non-finite portable data");Json::from(*value)},Self::Json(value) => value.clone(),
        Self::Record(value) => Json::Object(value.iter().map(|(k,v)|(k.clone(),v.data())).collect()),
        Self::Array(value) => Json::Array(value.iter().map(Self::data).collect()),
        _ => panic!("semantic capability is not portable data"),
    } }
    pub fn member(&self, key: &str, optional: bool) -> Self { match self {
        Self::Undefined | Self::Json(Json::Null) if optional => Self::Undefined,
        Self::Json(Json::Object(value)) => value.get(key).cloned().map(Self::json).unwrap_or(Self::Undefined),
        Self::Record(value) => value.get(key).cloned().unwrap_or(Self::Undefined),
        Self::Array(value) => if key=="length"{Self::number(value.len()as f64)}else{key.parse::<usize>().ok().and_then(|index|value.get(index).cloned()).unwrap_or(Self::Undefined)},
        Self::Input(value) => value.fields.get(key).cloned().map(Self::Json).unwrap_or(Self::Undefined),
        Self::Handle(owner, kind) => capability_member(owner, kind, key),
        Self::Part(_, role) if key == "role" => Self::string(role),
        _ => panic!("member access requires a record"),
    } }
    pub fn text(&self) -> String { match self { Self::Json(Json::String(v))=>v.clone(), Self::Number(v)=>v.to_string(),Self::Json(Json::Number(v))=>v.to_string(), _=>panic!("expected string or number") } }
    pub fn bool(&self) -> bool { match self {Self::Json(Json::Bool(v))=>*v,_=>panic!("expected boolean")} }
    pub fn num(&self) -> f64 { match self {Self::Number(v)=>*v,Self::Json(Json::Number(v))=>v.as_f64().unwrap(),_=>panic!("expected number")} }
    pub fn truthy(&self)->bool{match self{Self::Undefined|Self::Json(Json::Null)=>false,Self::Json(Json::Bool(v))=>*v,Self::Number(v)=>*v!=0.&&!v.is_nan(),Self::Json(Json::Number(v))=>v.as_f64().is_some_and(|v|v!=0.&&!v.is_nan()),Self::Json(Json::String(v))=>!v.is_empty(),_=>true}}
    pub fn scalar_text(&self)->String{match self{Self::Undefined=>"undefined".into(),Self::Json(Json::Null)=>"null".into(),Self::Json(Json::Bool(v))=>v.to_string(),Self::Json(Json::String(v))=>v.clone(),Self::Number(v)=>v.to_string(),Self::Json(Json::Number(v))=>v.as_f64().unwrap().to_string(),_=>panic!("structured coercion is not admitted")}}
    pub fn scalar_number(&self)->f64{match self{Self::Number(v)=>*v,Self::Json(Json::Number(v))=>v.as_f64().unwrap(),Self::Json(Json::Null)=>0.,Self::Json(Json::Bool(v))=>if *v{1.}else{0.},Self::Json(Json::String(v))=>if v.trim().is_empty(){0.}else{v.trim().parse().unwrap_or(f64::NAN)},Self::Undefined=>f64::NAN,_=>panic!("structured coercion is not admitted")}}
    pub fn nullish(&self) -> bool { matches!(self,Self::Undefined|Self::Json(Json::Null)) }
    pub fn call(&self, args: Vec<Self>) -> Self { match self { Self::Function(f)=>f(args), _=>panic!("expected checked callable") } }
    pub fn get(&self) -> Self { match self { Self::State(state)=>{ensure(&state.owner);state.value.borrow().clone()}, Self::Observed(owner, key)=>observed(owner,key), _=>panic!("expected State handle") } }
    pub fn owner(&self) -> OwnerWeak { match self { Self::Owner(owner)|Self::Handle(owner,_)|Self::HostTarget(owner)|Self::Part(owner,_)|Self::ObjectRef(owner)=>owner.clone(), _=>panic!("expected owner capability") } }
    pub fn items(&self) -> Vec<Self> { match self {Self::Array(v)=>(**v).clone(),Self::Json(Json::Array(v))=>v.iter().cloned().map(Self::json).collect(),_=>panic!("expected array")} }
}
pub fn strict_equal(a:&Value,b:&Value)->bool {match (a,b){(Value::Undefined,Value::Undefined)=>true,(Value::Number(a),Value::Number(b))=>a==b,(Value::Json(a),Value::Json(b))=>match(a,b){(Json::Array(_)|Json::Object(_),_)=>false,(Json::Number(a),Json::Number(b))=>a.as_f64()==b.as_f64(),_=>a==b},(Value::Record(a),Value::Record(b))=>Rc::ptr_eq(a,b),(Value::Array(a),Value::Array(b))=>Rc::ptr_eq(a,b),(Value::State(a),Value::State(b))=>Rc::ptr_eq(a,b),(Value::Function(a),Value::Function(b))=>Rc::ptr_eq(a,b),(Value::StaticCapability(a),Value::StaticCapability(b))=>a.id==b.id,(Value::Handle(a,ak),Value::Handle(b,bk))=>ak==bk&&Weak::ptr_eq(a,b),(Value::Observed(a,ak),Value::Observed(b,bk))=>ak==bk&&Weak::ptr_eq(a,b),(Value::ObjectRef(a),Value::ObjectRef(b))|(Value::HostTarget(a),Value::HostTarget(b))=>Weak::ptr_eq(a,b),(Value::Part(a,ar),Value::Part(b,br))=>ar==br&&Weak::ptr_eq(a,b),_=>false}}
fn same_value(a:&Value,b:&Value)->bool{
    if matches!(a,Value::Number(_)|Value::Json(Json::Number(_)))&&matches!(b,Value::Number(_)|Value::Json(Json::Number(_))){
        let a=a.num();let b=b.num();a.to_bits()==b.to_bits()||(a.is_nan()&&b.is_nan())
    }else{strict_equal(a,b)}
}
pub fn add(a:Value,b:Value)->Value {if matches!(&a,Value::Json(Json::String(_)))||matches!(&b,Value::Json(Json::String(_))){Value::string(&(a.scalar_text()+&b.scalar_text()))}else{Value::number(a.scalar_number()+b.scalar_number())}}
pub fn record(entries:Vec<(&str,Value)>)->Value{Value::Record(Rc::new(entries.into_iter().map(|(k,v)|(k.to_owned(),v)).collect()))}
pub fn arg(args:&[Value],index:usize)->Value{args.get(index).cloned().unwrap_or(Value::Undefined)}
pub fn ensure(owner:&OwnerWeak)->OwnerRef{let owner=owner.upgrade().expect("owner released");assert!(!owner.borrow().disposed,"terminally disposed owner");owner}
pub fn setup(owner:&OwnerWeak)->OwnerRef{let owner=ensure(owner);assert!(owner.borrow().phase=="setup","setup-only capability");owner}
pub fn runtime(owner:&OwnerWeak)->OwnerRef{let owner=ensure(owner);assert!(owner.borrow().phase!="setup"&&owner.borrow().phase!="render"&&owner.borrow().phase!="before-dispose","callback capability required");owner}
pub fn capability(owner:&OwnerWeak)->Value{Value::Owner(owner.clone())}
#[derive(Clone)]
pub struct Node { pub tag:String, pub styles:Vec<(String,String)>, pub children:Vec<Value>, pub slot:bool }
pub struct State { pub value:RefCell<Value>, pub kind:&'static str, pub spec:Value, pub owner:OwnerWeak }
#[derive(Clone)]
struct Watcher { active:Rc<Cell<bool>>, keys:Option<Vec<String>>, raw:bool, callback:Value }
#[derive(Clone)]
struct Listener { active:Rc<Cell<bool>>, kind:String, global:bool, capture:bool, once:bool, consumed_epoch:Rc<Cell<Option<u64>>>,  passive:bool, callback:Value }
#[derive(Clone)]
struct Contribution {active:Rc<Cell<bool>>, predicate:Option<Value>, styles:Vec<(String,String)>}
#[derive(Clone)]
struct ContextSubscription {active:Rc<Cell<bool>>, key:String, optional:bool, callback:Value}
#[derive(Clone)]
pub struct Input {pub fields:Map<String,Json>,pub prevented:Cell<bool>,pub passive:bool,pub live:Cell<bool>}
#[derive(Default)]
struct NativePress{key:Option<String>,global_key:Option<String>,pointer:bool,global_pointer:bool,cancelled:bool,global_keyboard_click:bool,global_pointer_cancelled:bool}
thread_local! {static OWNERS:RefCell<Vec<OwnerWeak>>=RefCell::new(Vec::new());static CONTEXT_QUEUE:RefCell<VecDeque<(OwnerWeak,Value,Value,Value)>>=RefCell::new(VecDeque::new());static CONTEXT_DISPATCHING:Cell<bool>=Cell::new(false);}
pub struct Owner {
    pub phase:&'static str,pub disposed:bool,pub present:bool,pub mounted:bool,pub epoch:u64,
    pub dirty:bool,pub native_drive:Option<Drive>,pub window_id:Option<gpui::WindowId>,pub update_requested:bool,pub projection_revision:u64,pub committed_revision:u64,
    pub projection:Value,pub renderer:Value,pub raw:Json,pub raw_value:Value,pub props_value:Value,pub props:Json,pub schemas:BTreeMap<String,Value>,pub defaults:BTreeMap<String,Value>,
    pub states:BTreeMap<String,Rc<State>>,pub exposes:BTreeMap<String,Value>,pub declared_events:BTreeSet<String>,pub emitted:Vec<(String,Json)>,
    pub lifecycle:BTreeMap<String,Vec<Value>>,watchers:Vec<Watcher>,listeners:Vec<Listener>,contributions:Vec<Contribution>,patch:Vec<(String,String)>,suppressed:BTreeSet<String>,
    pub parent:OwnerWeak,pub providers:BTreeMap<String,Value>,subscriptions:Vec<ContextSubscription>,
    pub context_accepts:fn(&str,&Json)->bool,pub props_accepts:fn(&Json)->bool,pub prop_valid:fn(&str,&Json)->bool,pub previous_valid:BTreeMap<String,Json>,pub default_layers:Vec<BTreeMap<String,Value>>,
    pub focusable:bool,pub focus_disabled:bool,pub focus_requested:bool,pub focus_entry:bool,pub focused:bool,pub suppress_click:bool,
    pub accessible:bool,pub accessible_role:Value,pub accessible_states:BTreeMap<String,Value>,pub accessible_actions:BTreeSet<String>,pub name_content:bool,
    pub slot:Vec<Value>,pub bounds:Option<Bounds<Pixels>>,pub native_hitbox:Option<gpui::Hitbox>,pub native_translation:gpui::Point<Pixels>,pub theme:String,pub dark:bool,
    pub style_vocabulary:&'static crate::gpui_native_style::StyleVocabulary,
    pub modules:Modules,press:NativePress,press_global:bool,window_input_observed:Option<gpui::WeakFocusHandle>,
}
impl Owner {
    pub fn new(raw:Json,parent:OwnerWeak,context_accepts:fn(&str,&Json)->bool,props_accepts:fn(&Json)->bool,prop_valid:fn(&str,&Json)->bool,style_vocabulary:&'static crate::gpui_native_style::StyleVocabulary)->OwnerRef {
        assert!(raw.is_object(),"raw props must be a record");
        let owner=Rc::new(RefCell::new(Self{phase:"setup",disposed:false,present:true,mounted:false,epoch:0,dirty:true,native_drive:None,window_id:None,update_requested:false,projection_revision:0,committed_revision:0,projection:Value::Undefined,renderer:Value::Undefined,raw_value:Value::json(raw.clone()),props_value:Value::Undefined,raw,props:Json::Object(Map::new()),schemas:BTreeMap::new(),defaults:BTreeMap::new(),states:BTreeMap::new(),exposes:BTreeMap::new(),declared_events:BTreeSet::new(),emitted:Vec::new(),lifecycle:BTreeMap::new(),watchers:Vec::new(),listeners:Vec::new(),contributions:Vec::new(),patch:Vec::new(),suppressed:BTreeSet::new(),parent,providers:BTreeMap::new(),subscriptions:Vec::new(),context_accepts,props_accepts,prop_valid,previous_valid:BTreeMap::new(),default_layers:Vec::new(),focusable:false,focus_disabled:false,focus_requested:false,focus_entry:true,focused:false,suppress_click:false,accessible:false,accessible_role:Value::Undefined,accessible_states:BTreeMap::new(),accessible_actions:BTreeSet::new(),name_content:false,slot:Vec::new(),bounds:None,native_hitbox:None,native_translation:gpui::Point::default(),theme:"shadcn".into(),dark:false,style_vocabulary,modules:Modules::default(),press:NativePress::default(),press_global:false,window_input_observed:None}));
        OWNERS.with(|all|all.borrow_mut().push(Rc::downgrade(&owner)));owner
    }
    pub fn finish(owner:&OwnerRef,renderer:Value){owner.borrow_mut().renderer=renderer;owner.borrow_mut().phase="idle";resolve_props(owner);accessible_alive(owner);life(owner,"created");}
    pub fn project(owner:&OwnerRef){
        let needed={let o=owner.borrow();o.present&&!o.disposed&&(matches!(o.projection,Value::Undefined)||o.update_requested)};
        if !needed{return}
        let renderer={let mut o=owner.borrow_mut();o.update_requested=false;o.phase="render";o.renderer.clone()};
        let result=renderer.call(vec![capability(&Rc::downgrade(owner))]);
        assert!(valid_template_children(&result),"invalid template children");
        let mut o=owner.borrow_mut();o.projection=result;o.projection_revision+=1;o.phase="idle";
    }
    pub fn commit(owner:&OwnerRef,revision:u64){
        let(event,epoch)={let mut o=owner.borrow_mut();if o.disposed||!o.present||o.bounds.is_none()||o.projection_revision!=revision||o.committed_revision==revision{return}o.committed_revision=revision;let event=if !o.mounted{o.mounted=true;o.epoch+=1;"mounted"}else{"updated"};(event,o.epoch)};
        modules_commit(owner);
        {let o=owner.borrow();if o.disposed||!o.present||!o.mounted||o.epoch!=epoch||o.projection_revision!=revision||o.committed_revision!=revision{return}}
        life(owner,event);
    }
    pub fn dispose(owner:&OwnerRef){if owner.borrow().disposed{return}detach_native_view(owner);
        life(owner,"before-dispose");let mut o=owner.borrow_mut();o.disposed=true;o.present=false;o.bounds=None;o.native_hitbox=None;o.projection=Value::Undefined;o.renderer=Value::Undefined;o.watchers.clear();o.listeners.clear();o.contributions.clear();o.subscriptions.clear();o.providers.clear();o.exposes.clear();o.states.clear();o.lifecycle.clear();o.slot.clear();o.modules=Modules::default();drop(o);topology_refresh();poll_state_watchers();
    }
}
pub fn detach_native_view(owner:&OwnerRef){
    let mounted={let mut o=owner.borrow_mut();let mounted=o.mounted;o.mounted=false;o.bounds=None;o.native_hitbox=None;o.modules.a11y_node=None;o.modules.a11y_frame=0;o.modules.a11y_bindings=0;o.committed_revision=0;o.press=NativePress::default();mounted};
    text_detach(owner);image_detach(owner);positioning_detach(owner);overlay_detach(owner);
    if mounted{topology_refresh();life(owner,"unmounted");poll_state_watchers();}
}
struct PhaseGuard{owner:OwnerWeak,previous:&'static str}
impl Drop for PhaseGuard{fn drop(&mut self){if let Some(owner)=self.owner.upgrade(){owner.borrow_mut().phase=self.previous;}}}
pub fn invoke(owner:&OwnerRef,phase:&'static str,callback:&Value,args:Vec<Value>)->Value{assert!(!owner.borrow().disposed,"owner disposed");let previous=owner.borrow().phase;owner.borrow_mut().phase=phase;let guard=PhaseGuard{owner:Rc::downgrade(owner),previous};let result=callback.call(args);drop(guard);if phase!="before-dispose"{poll_state_watchers();}result}
pub fn life(owner:&OwnerRef,kind:&'static str){let callbacks=owner.borrow().lifecycle.get(kind).cloned().unwrap_or_default();for callback in callbacks{invoke(owner,kind,&callback,vec![capability(&Rc::downgrade(owner))]);}}
pub fn register_life(owner:&OwnerWeak,kind:&str,callback:Value)->Value{setup(owner).borrow_mut().lifecycle.entry(kind.into()).or_default().push(callback);Value::Undefined}
pub fn request_update(owner:&OwnerWeak)->Value{let owner=runtime(owner);let mut o=owner.borrow_mut();o.update_requested=true;o.dirty=true;Value::Undefined}
pub fn set_present(owner:&OwnerWeak,present:Value)->Value{let owner=runtime(owner);let present=present.bool();{let mut o=owner.borrow_mut();if o.present==present{return Value::Undefined}o.present=present;o.dirty=true;if present{o.projection=Value::Undefined;o.update_requested=true;}}if !present{detach_native_view(&owner);}Value::Undefined}
fn prop_json(value:&Value)->bool{match value{Value::Number(number)=>number.is_finite(),Value::Json(_)=>true,Value::Record(fields)=>fields.values().all(prop_json),Value::Array(values)=>values.iter().all(prop_json),_=>false}}
fn prop_empty_rank(spec:&BTreeMap<String,Value>)->u8{match spec.get("empty"){None=>1,Some(Value::Json(Json::String(value)))=>match value.as_str(){"accept"=>0,"fallback"=>1,"error"=>2,_=>panic!("invalid Props empty behavior")},_=>panic!("invalid Props empty behavior")}}
fn prop_range(spec:&BTreeMap<String,Value>)->Option<(f64,f64)>{match spec.get("range"){None|Some(Value::Json(Json::Null))=>None,Some(Value::Record(range))=>{let min=range.get("min").map_or(f64::NEG_INFINITY,Value::num);let max=range.get("max").map_or(f64::INFINITY,Value::num);assert!(!min.is_nan()&&!max.is_nan(),"invalid Props range");Some((min,max))},_=>panic!("checked Props range record")}}
pub fn props_define(owner:&OwnerWeak,schema:Value)->Value{
    let owner=setup(owner);let Value::Record(entries)=schema else{panic!("checked Props schema record")};
    let mut merged=owner.borrow().schemas.clone();let mut warnings=Vec::new();
    for(key,incoming)in entries.iter(){
        let Value::Record(fields)=incoming else{panic!("checked Props descriptor record")};
        let Some(Value::Json(Json::String(kind)))=fields.get("type") else{panic!("explicit Props type required")};
        assert!(["boolean","number","string","enum","object","any"].contains(&kind.as_str()),"invalid Props type");
        let rank=prop_empty_rank(fields);let range=prop_range(fields);
        let options=match fields.get("options"){Some(Value::Array(options))if kind=="enum"=>{assert!(!options.is_empty()&&options.iter().all(|value|matches!(value,Value::Json(Json::String(_)))),"nonempty string Props enum options required");Some(options)},None if kind!="enum"=>None,_=>panic!("Props options require type enum")};
        assert!(!fields.contains_key("enum"),"legacy Props enum descriptor field");
        assert!(fields.get("default").is_none_or(prop_json),"non-JSON Props default");
        if let Some(previous)=merged.get(key){
            let Value::Record(prior)=previous else{panic!("checked prior Props descriptor")};
            assert!(strict_equal(prior.get("type").unwrap(),fields.get("type").unwrap()),"conflicting Props type");
            let previous_rank=prop_empty_rank(prior);assert!(rank<=previous_rank||!fields.contains_key("empty"),"Props empty policy cannot become stricter");
            if fields.contains_key("empty")&&rank<previous_rank{warnings.push(format!("empty behavior relaxed; retaining established policy: {key}"));}
            if let Some(Value::Array(previous_options))=prior.get("options"){
                let options=options.expect("Props enum options cannot be removed");
                assert!(previous_options.iter().all(|previous|options.iter().any(|next|strict_equal(previous,next))),"Props enum options cannot narrow");
                if options.iter().any(|next|!previous_options.iter().any(|previous|strict_equal(previous,next))){warnings.push(format!("enum options widened: {key}"));}
            }
            if let(Some((previous_min,previous_max)),Some((min,max)))=(prop_range(prior),range){assert!(min<=previous_min&&max>=previous_max,"Props range cannot narrow");if min<previous_min||max>previous_max{warnings.push(format!("range widened: {key}"));}}
            let mut next=(**prior).clone();next.extend(fields.iter().map(|(key,value)|(key.clone(),value.clone())));
            if let Some(empty)=prior.get("empty"){next.insert("empty".into(),empty.clone());}else{next.insert("empty".into(),Value::string("fallback"));}
            if fields.get("range").is_none_or(Value::nullish){if let Some(range)=prior.get("range"){next.insert("range".into(),range.clone());}}
            if let Some(default)=prior.get("default"){
                if fields.get("default").is_some_and(|next|!strict_equal(default,next)){warnings.push(format!("default changed; retaining established default: {key}"));}
                next.insert("default".into(),default.clone());
            }
            merged.insert(key.clone(),Value::Record(Rc::new(next)));
        }else{merged.insert(key.clone(),incoming.clone());}
    }
    owner.borrow_mut().schemas=merged;resolve_props(&owner);for warning in warnings{eprintln!("[Props] {warning}");}Value::Undefined
}
pub fn set_defaults(owner:&OwnerWeak,defaults:Value)->Value{let owner=setup(owner);match defaults{Value::Record(entries)=>{let mut state=owner.borrow_mut();assert!(entries.iter().all(|(key,value)|state.schemas.contains_key(key)&&prop_json(value)),"undeclared or non-JSON Props default");state.default_layers.push((*entries).clone());},_=>panic!("checked defaults record")};resolve_props(&owner);Value::Undefined}
fn resolve_props(owner:&OwnerRef){
let(raw,schemas,layers,previous_valid,valid,strict)={let o=owner.borrow();(o.raw.clone(),o.schemas.clone(),o.default_layers.clone(),o.previous_valid.clone(),o.prop_valid,o.phase!="setup")};
let mut resolved=Map::new();let mut previous_valid=previous_valid;
for(key,schema)in schemas{
let provided=raw.get(&key);let empty_policy=schema.member("empty",false);let error=strict&&matches!(&empty_policy,Value::Json(Json::String(s))if s=="error");
let range=schema.member("range",false);let options=schema.member("options",false);
let accepts=|candidate:&Json|{if !(valid)(&key,candidate){return false}if let Value::Array(options)=&options{if !options.iter().any(|option|matches!(option,Value::Json(Json::String(value))if Some(value.as_str())==candidate.as_str())){return false}}if !range.nullish(){let min=range.member("min",false);let max=range.member("max",false);let Some(number)=candidate.as_f64()else{return false};if !min.nullish()&&number<min.num(){return false}if !max.nullish()&&number>max.num(){return false}}true};
let mut value=None;
if let Some(raw)=provided{if !raw.is_null()&&accepts(raw){value=Some(raw.clone());previous_valid.insert(key.clone(),raw.clone());}else if raw.is_null()&&matches!(&empty_policy,Value::Json(Json::String(s))if s=="accept"){value=Some(Json::Null);}else if let Some(previous)=previous_valid.get(&key){if !previous.is_null()&&accepts(previous){value=Some(previous.clone());}}}
if value.is_none(){for layer in layers.iter().rev(){if let Some(candidate)=layer.get(&key){let candidate=candidate.data();if candidate.is_null()&&!error||!candidate.is_null()&&accepts(&candidate){value=Some(candidate);break}}}}
if value.is_none(){let default=schema.member("default",false);if !matches!(default,Value::Undefined){let default=default.data();if default.is_null()&&!error||!default.is_null()&&accepts(&default){value=Some(default);}}}
let value=value.unwrap_or_else(||{assert!(!error,"missing, empty or invalid prop without nonempty fallback: {key}");Json::Null});if provided.is_some()&&!value.is_null(){previous_valid.insert(key.clone(),value.clone());}resolved.insert(key,value);
}
let props=Json::Object(resolved);let mut o=owner.borrow_mut();assert!((o.props_accepts)(&props),"invalid resolved Props value");o.previous_valid=previous_valid;o.props_value=Value::json(props.clone());o.props=props;
}
pub fn read_props(owner:&OwnerWeak,raw:bool)->Value{let owner=ensure(owner);let o=owner.borrow();if raw{o.raw_value.clone()}else{o.props_value.clone()}}
pub fn is_provided(owner:&OwnerWeak,key:Value)->Value{Value::boolean(ensure(owner).borrow().raw.get(key.text()).is_some())}
pub fn watch_props(owner:&OwnerWeak,keys:Option<Value>,raw:bool,callback:Value)->Value{let owner=setup(owner);let active=Rc::new(Cell::new(true));let keys=keys.map(|v|match v{Value::Json(Json::String(s))=>vec![s],_=>v.items().iter().map(Value::text).collect()});owner.borrow_mut().watchers.push(Watcher{active:active.clone(),keys,raw,callback});disposer(owner,active,false)}
pub fn replace_props(owner:&OwnerRef,raw:Json){
    assert!(raw.is_object(),"raw props must be a record");
    let (old_raw,old_props,watchers)={let o=owner.borrow();assert!(!o.disposed);(o.raw_value.clone(),o.props_value.clone(),o.watchers.clone())};
    {let mut o=owner.borrow_mut();o.raw_value=Value::json(raw.clone());o.raw=raw;o.dirty=true;}
    resolve_props(owner);
    if !watchers.iter().any(|watcher|watcher.active.get()){return}
    let (new_raw,new_props)={let o=owner.borrow();(o.raw_value.clone(),o.props_value.clone())};
    let changed=|previous:&Value,next:&Value|->Vec<String>{
        let(Value::Record(previous),Value::Record(next))=(previous,next)else{panic!("Props snapshots must be records")};
        let keys:BTreeSet<_>=previous.keys().chain(next.keys()).collect();
        keys.into_iter().filter(|key|!same_value(previous.get(*key).unwrap_or(&Value::Undefined),next.get(*key).unwrap_or(&Value::Undefined))).cloned().collect()
    };
    let raw_changed=if watchers.iter().any(|watcher|watcher.raw&&watcher.active.get()){changed(&old_raw,&new_raw)}else{Vec::new()};
    let resolved_changed=if watchers.iter().any(|watcher|!watcher.raw&&watcher.active.get()){changed(&old_props,&new_props)}else{Vec::new()};
    let raw_keys=Value::Array(Rc::new(raw_changed.iter().map(|key|Value::string(key)).collect()));
    let resolved_keys=Value::Array(Rc::new(resolved_changed.iter().map(|key|Value::string(key)).collect()));
    for group in 0..3{for watcher in &watchers{
        if !watcher.active.get()||group!=if watcher.raw{if watcher.keys.is_none(){0}else{1}}else{2}{continue}
        let(previous,next,changed,all)=if watcher.raw{(&old_raw,&new_raw,&raw_changed,&raw_keys)}else{(&old_props,&new_props,&resolved_changed,&resolved_keys)};
        if changed.is_empty(){continue}
        let matched=if let Some(keys)=&watcher.keys{
            let matched:Vec<Value>=keys.iter().filter(|key|changed.contains(key)).map(|key|Value::string(key)).collect();
            if matched.is_empty(){continue}Value::Array(Rc::new(matched))
        }else{all.clone()};
        let info=record(vec![("changedKeysAll",all.clone()),("changedKeysMatched",matched)]);
        if watcher.raw{eprintln!("[Props] raw watchers are an adapter-snapshot escape hatch; avoid in official prototypes.");}
        invoke(owner,"props-watch",&watcher.callback,vec![capability(&Rc::downgrade(owner)),next.clone(),previous.clone(),info]);
    }}
}
pub fn create_state(owner:&OwnerWeak,kind:&'static str,key:Value,value:Value,spec:Value)->Value{let owner_ref=setup(owner);let key=key.text();assert!(!key.is_empty()&&!owner_ref.borrow().states.contains_key(&key),"State name must be nonempty and same-frame unique");let state=Rc::new(State{value:RefCell::new(normalize_state(kind,value,&spec,true)),kind,spec,owner:owner.clone()});owner_ref.borrow_mut().states.insert(key,state.clone());Value::State(state)}
fn normalize_state(kind:&str,value:Value,spec:&Value,initial:bool)->Value{match kind{"bool"=>{value.bool();},"string"|"enum"=>{assert!(matches!(value,Value::Json(Json::String(_))),"State string required");let options=spec.member("options",true);assert!(!options.nullish()||kind!="enum","enum options required");if !options.nullish(){assert!(options.items().iter().any(|option|strict_equal(option,&value)),"State value outside options");}},"discrete"|"range"=>{let number=value.num();assert!(number.is_finite(),"State finite number required");let min=spec.member("min",true);let max=spec.member("max",true);if kind=="range"{assert!(!min.nullish()&&!max.nullish()&&min.num()<=max.num(),"invalid range");let clamp=spec.member("clamp",true);if initial&&!clamp.nullish()&&clamp.bool(){return Value::number(number.max(min.num()).min(max.num()))}assert!(number>=min.num()&&number<=max.num(),"State range violation");}else{if !min.nullish(){assert!(number>=min.num(),"State below min")}if !max.nullish(){assert!(number<=max.num(),"State above max")}let step=spec.member("step",true);if !step.nullish(){assert!(step.num()>0.,"State step must be positive");let origin=if min.nullish(){0.}else{min.num()};assert!(((number-origin)/step.num()).fract().abs()<1e-9,"State step violation");}}},_=>panic!("unknown State constructor")};let options=spec.member("options",true);if !options.nullish(){assert!(options.items().iter().any(|item|strict_equal(item,&value)),"State option violation")}value}
pub fn state_set(receiver:Value,value:Value,reason:Value)->Value{match receiver{Value::State(state)=>{runtime(&state.owner);write_state_value(&state,value,reason);},_=>panic!("State handle required")};Value::Undefined}
pub fn expose_state(owner:&OwnerWeak,key:Value,state:Value)->Value{setup(owner).borrow_mut().exposes.insert(key.text(),state);Value::Undefined}
pub fn expose_value(owner:&OwnerWeak,key:Value,value:Value)->Value{setup(owner).borrow_mut().exposes.insert(key.text(),value);Value::Undefined}
pub fn expose_method(owner:&OwnerWeak,key:Value,callback:Value)->Value{setup(owner).borrow_mut().exposes.insert(key.text(),callback);Value::Undefined}
pub fn expose_event(owner:&OwnerWeak,key:Value)->Value{setup(owner).borrow_mut().declared_events.insert(key.text());Value::Undefined}
pub fn emit(owner:&OwnerWeak,key:Value,payload:Value)->Value{let owner=runtime(owner);let key=key.text();assert!(owner.borrow().declared_events.contains(&key),"undeclared Expose event");let payload=if matches!(payload,Value::Undefined){Json::Null}else{payload.data()};owner.borrow_mut().emitted.push((key,payload));Value::Undefined}
pub fn disposer(owner:OwnerRef,active:Rc<Cell<bool>>,setup_only:bool)->Value{let owner=Rc::downgrade(&owner);Value::Function(Rc::new(move |_|{if setup_only{setup(&owner);}else{ensure(&owner);}active.set(false);Value::Undefined}))}
pub fn style_use(owner:&OwnerWeak,handles:Vec<Value>)->Value{let owner=setup(owner);let active=Rc::new(Cell::new(true));owner.borrow_mut().contributions.push(Contribution{active:active.clone(),predicate:None,styles:style_items(handles)});disposer(owner,active,true)}
pub fn rule(owner:&OwnerWeak,predicate:Value,handles:Vec<Value>)->Value{let owner=setup(owner);let active=Rc::new(Cell::new(true));owner.borrow_mut().contributions.push(Contribution{active:active.clone(),predicate:Some(predicate),styles:style_items(handles)});Value::Resource(active)}
pub fn rule_dispose(owner:&OwnerWeak,receiver:Value)->Value{setup(owner);match receiver{Value::Resource(active)=>active.set(false),_=>panic!("Rule handle required")};Value::Undefined}
pub fn style_items(handles:Vec<Value>)->Vec<(String,String)>{handles.into_iter().flat_map(|v|match v{Value::Style(items)=>items,_=>panic!("style handle required")}).collect()}
pub fn patch(owner:&OwnerWeak,handles:Vec<Value>,suppress:bool)->Value{let owner=runtime(owner);let items=style_items(handles);let mut o=owner.borrow_mut();o.dirty=true;for item in items{if suppress{o.patch.retain(|(_,group)|group!=&item.1);o.suppressed.insert(item.1);}else{o.suppressed.remove(&item.1);o.patch.retain(|(_,group)|group!=&item.1);o.patch.push(item);}}Value::Undefined}
pub fn clear_patch(owner:&OwnerWeak)->Value{let owner=runtime(owner);let mut o=owner.borrow_mut();o.patch.clear();o.suppressed.clear();o.dirty=true;Value::Undefined}
pub fn styles(owner:&OwnerRef)->Vec<String>{let(contributions,patch,suppressed)={let o=owner.borrow();(o.contributions.clone(),o.patch.clone(),o.suppressed.clone())};let mut merged=Vec::<(String,String)>::new();for contribution in contributions{if !contribution.active.get()||contribution.predicate.is_some_and(|predicate|!predicate.call(vec![]).bool()){continue}for item in contribution.styles{merged.retain(|(_,group)|group!=&item.1);merged.push(item)}}for item in patch{merged.retain(|(_,group)|group!=&item.1);merged.push(item)}merged.into_iter().filter(|(_,group)|!suppressed.contains(group)).map(|(token,_)|token).collect()}
pub fn element(tag:Value,props:Value,children:Value)->Value{let mut styles=Vec::new();let children=if matches!(&props,Value::Record(_)|Value::Json(Json::Object(_))){let style=props.member("style",false);if !style.nullish(){styles=style_items(vec![style]);}children}else if matches!(props,Value::Undefined){children}else{props};let children=match children{Value::Array(items)=>(*items).clone(),Value::Undefined=>vec![],other=>vec![other]};Value::Template(Rc::new(Node{tag:tag.text(),styles,children,slot:false}))}
pub fn slot()->Value{Value::Template(Rc::new(Node{tag:"slot".into(),styles:vec![],children:vec![],slot:true}))}
pub fn context_provide(owner:&OwnerWeak,key:Value,value:Value)->Value{let owner=setup(owner);let key=key.text();assert!((owner.borrow().context_accepts)(&key,&value.data()),"invalid Context data");assert!(!owner.borrow().providers.contains_key(&key),"duplicate Context provider");owner.borrow_mut().providers.insert(key,value);Value::Undefined}
fn provider(owner:&OwnerRef,key:&str)->Option<OwnerRef>{let mut current=Some(owner.clone());let mut visited=BTreeSet::new();while let Some(node)=current{assert!(visited.insert(Rc::as_ptr(&node)as usize),"cyclic Context ancestry");let o=node.borrow();if o.disposed{return None}if o.providers.contains_key(key){drop(o);return Some(node)}current=o.parent.upgrade();}None}
pub fn context_subscribe(owner:&OwnerWeak,key:Value,optional:bool,callback:Value)->Value{let owner=setup(owner);let key=key.text();assert!(optional||provider(&owner,&key).is_some(),"required Context provider missing");let active=Rc::new(Cell::new(true));owner.borrow_mut().subscriptions.push(ContextSubscription{active:active.clone(),key,optional,callback});disposer(owner,active,false)}
pub fn context_read(owner:&OwnerWeak,key:Value,optional:bool)->Value{let owner=ensure(owner);let key=key.text();assert!(owner.borrow().subscriptions.iter().any(|s|s.key==key&&s.optional==optional),"Context read requires corresponding subscription");match provider(&owner,&key){Some(provider)=>provider.borrow().providers[&key].clone(),None if optional=>Value::Json(Json::Null),None=>panic!("required Context provider missing")}}
pub fn context_update(owner:&OwnerWeak,key:Value,next:Value,optional:bool)->Value{let owner=runtime(owner);let key=key.text();assert!(owner.borrow().subscriptions.iter().any(|s|s.key==key&&s.optional==optional),"Context update requires corresponding subscription");let Some(bound)=provider(&owner,&key)else{if optional{return Value::boolean(false)}panic!("required Context provider missing")};let previous=bound.borrow().providers[&key].clone();let value=if matches!(next,Value::Function(_)){next.call(vec![previous.clone()])}else{next};ensure(&Rc::downgrade(&bound));assert!((owner.borrow().context_accepts)(&key,&value.data()),"invalid Context data");bound.borrow_mut().providers.insert(key.clone(),value.clone());OWNERS.with(|all|{for weak in all.borrow().iter(){if let Some(participant)=weak.upgrade(){if participant.borrow().disposed{continue}if provider(&participant,&key).is_some_and(|p|Rc::ptr_eq(&p,&bound)){let subscriptions=participant.borrow().subscriptions.clone();for subscription in subscriptions{if subscription.active.get()&&subscription.key==key&&!matches!(subscription.callback,Value::Undefined){CONTEXT_QUEUE.with(|q|q.borrow_mut().push_back((weak.clone(),subscription.callback,value.clone(),previous.clone())));}}}}}});let dispatch=CONTEXT_DISPATCHING.with(|flag|!flag.replace(true));if dispatch{loop{let task=CONTEXT_QUEUE.with(|q|q.borrow_mut().pop_front());let Some((weak,callback,next,previous))=task else{break};if let Some(owner)=weak.upgrade(){if !owner.borrow().disposed{invoke(&owner,"context-watch",&callback,vec![capability(&weak),next,previous]);}}}CONTEXT_DISPATCHING.with(|flag|flag.set(false));}if optional{Value::boolean(true)}else{Value::Undefined}}
fn trigger_parent(owner:&OwnerRef)->Option<OwnerRef>{if !owner.borrow().modules.hooks.contains("trigger"){return None}owner.borrow().parent.upgrade().filter(|parent|{let parent=parent.borrow();!parent.disposed&&parent.modules.hooks.contains("trigger")})}
fn trigger_child(owner:&OwnerRef)->Option<OwnerRef>{owner.borrow().modules.trigger_child.upgrade().filter(|child|{let child=child.borrow();!child.disposed&&child.modules.hooks.contains("trigger")&&child.parent.upgrade().is_some_and(|parent|Rc::ptr_eq(&parent,owner))})}
fn validate_trigger_child(parent:&OwnerRef,child:&OwnerRef)->Result<(),&'static str>{if trigger_child(parent).is_none_or(|current|Rc::ptr_eq(&current,child)){Ok(())}else{Err("Trigger group cannot branch into sibling surfaces")}}
pub fn as_trigger(owner:&OwnerWeak)->Value{let owner=setup(owner);let parent=owner.borrow().parent.upgrade().filter(|parent|parent.borrow().modules.hooks.contains("trigger"));if let Some(parent)=&parent{validate_trigger_child(parent,&owner).expect("invalid Trigger declaration");}owner.borrow_mut().modules.hooks.insert("trigger");if let Some(parent)=parent{parent.borrow_mut().modules.trigger_child=Rc::downgrade(&owner);}Value::Undefined}
pub fn set_native_parent(owner:&OwnerRef,parent:OwnerWeak)->Result<(),&'static str>{let next=parent.upgrade();if let Some(parent)=&next{if descendant(parent,owner){return Err("cyclic logical ancestry")}if owner.borrow().modules.hooks.contains("trigger")&&parent.borrow().modules.hooks.contains("trigger"){validate_trigger_child(parent,owner)?;}}if let Some(previous)=trigger_parent(owner){if previous.borrow().modules.trigger_child.ptr_eq(&Rc::downgrade(owner)){previous.borrow_mut().modules.trigger_child=Weak::new();}}owner.borrow_mut().parent=parent;if let Some(parent)=trigger_parent(owner){parent.borrow_mut().modules.trigger_child=Rc::downgrade(owner);}topology_refresh();Ok(())}
fn dispatch_root_route(target:&OwnerRef,kind:&str,fields:Map<String,Json>)->bool{if !ready(target)||trigger_child(target).is_some(){return false}let window=target.borrow().window_id;let mut current=Some(target.clone());let mut prevented=false;while let Some(owner)=current{current=trigger_parent(&owner);if owner.borrow().window_id==window{prevented|=dispatch(&owner,kind,false,fields.clone());}}prevented}
pub fn as_focusable(owner:&OwnerWeak)->Value{setup(owner).borrow_mut().focusable=true;module_handle(owner,"focus")}
pub fn as_accessible(owner:&OwnerWeak)->Value{setup(owner).borrow_mut().accessible=true;module_handle(owner,"accessible")}
pub fn focus_configure(owner:&OwnerWeak,config:Value)->Value{let owner=setup(owner);let disabled=config.member("disabled",false);let entry=config.member("entry",false);let mut o=owner.borrow_mut();if !disabled.nullish(){o.focus_disabled=disabled.bool()}if !entry.nullish(){o.focus_entry=entry.bool()}Value::Undefined}
pub fn focus_disabled(owner:&OwnerWeak,disabled:Value)->Value{let disabled=disabled.bool();{let owner=runtime(owner);let mut o=owner.borrow_mut();o.focus_disabled=disabled;o.dirty=true;}if disabled{focus_blur(owner);}Value::Undefined}
pub fn focus_self(owner:&OwnerWeak)->Value{{let owner=runtime(owner);let mut o=owner.borrow_mut();o.focus_requested=true;o.dirty=true;}Value::Undefined}
pub fn accessible_role(owner:&OwnerWeak,role:Value)->Value{setup(owner).borrow_mut().accessible_role=role;Value::Undefined}
pub fn accessible_state(owner:&OwnerWeak,key:Value,state:Value)->Value{setup(owner).borrow_mut().accessible_states.insert(key.text(),state);Value::Undefined}
pub fn accessible_action(owner:&OwnerWeak,key:Value)->Value{setup(owner).borrow_mut().accessible_actions.insert(key.text());Value::Undefined}
pub fn name_content(owner:&OwnerWeak)->Value{let owner=setup(owner);let mut o=owner.borrow_mut();o.name_content=true;o.modules.accessible_text.remove("name");Value::Undefined}
pub fn listen(owner:&OwnerWeak,key:Value,global:bool,callback:Value,options:Value)->Value{let owner=setup(owner);let active=Rc::new(Cell::new(true));let kind=key.text();if global&&kind.starts_with("press."){owner.borrow_mut().press_global=true;}let capture=options.member("capture",true);let once=options.member("once",true);let passive=options.member("passive",true);owner.borrow_mut().listeners.push(Listener{active:active.clone(),kind,global,capture:!capture.nullish()&&capture.bool(),once:!once.nullish()&&once.bool(),consumed_epoch:Rc::new(Cell::new(None)),passive:!passive.nullish()&&passive.bool(),callback});disposer(owner,active,false)}
pub fn prevent(input:Value)->Value{match input{Value::Input(input)=>{assert!(input.live.get(),"input control expired");if !input.passive{input.prevented.set(true)}},_=>panic!("input capability required")};Value::Undefined}
pub fn dispatch(owner:&OwnerRef,kind:&str,global:bool,fields:Map<String,Json>)->bool{dispatch_phase(owner,kind,global,false,fields)}
fn has_listener(owner:&OwnerRef,kind:&str,global:bool,capture:bool)->bool{let owner=owner.borrow();owner.listeners.iter().any(|listener|listener.active.get()&&listener.kind==kind&&listener.global==global&&listener.capture==capture&&(!listener.once||listener.consumed_epoch.get()!=Some(owner.epoch)))}
fn dispatch_phase(owner:&OwnerRef,kind:&str,global:bool,capture:bool,fields:Map<String,Json>)->bool{if owner.borrow().disposed||!owner.borrow().present||!owner.borrow().mounted{return false}if !global&&(kind.starts_with("pointer.")||kind=="press.commit"||kind=="context.menu")&&!hit_participates(owner){return false}let listeners=owner.borrow().listeners.clone();let mut prevented=false;for listener in listeners{if owner.borrow().disposed||!owner.borrow().mounted{break}if listener.active.get()&&listener.global==global&&listener.capture==capture&&listener.kind==kind{if listener.once{let epoch=owner.borrow().epoch;if listener.consumed_epoch.get()==Some(epoch){continue}listener.consumed_epoch.set(Some(epoch));}let input=Rc::new(Input{fields:fields.clone(),prevented:Cell::new(false),passive:listener.passive,live:Cell::new(true)});invoke(owner,"event",&listener.callback,vec![capability(&Rc::downgrade(owner)),Value::Input(input.clone())]);input.live.set(false);prevented|=input.prevented.get();}}prevented}
pub fn event_fields(kind:&str)->Map<String,Json>{let mut fields=Map::new();fields.insert("type".into(),Json::String(kind.into()));fields}
pub fn text_content(value:&Value,slot:&[Value])->String{match value{Value::Json(Json::String(s))=>s.clone(),Value::Number(n)=>n.to_string(),Value::Json(Json::Number(n))=>n.to_string(),Value::Template(node)=>if node.slot{slot.iter().map(|v|text_content(v,&[])).collect::<Vec<_>>().join("")}else{node.children.iter().map(|v|text_content(v,slot)).collect::<Vec<_>>().join("")},Value::Array(items)=>items.iter().map(|v|text_content(v,slot)).collect::<Vec<_>>().join(""),_=>String::new()}}
pub type Drive=Rc<dyn Fn(&mut Window,&mut App)>;
#[derive(Clone,Copy)]
struct NativeTranslation{x:crate::gpui_native_style::Dimension,y:crate::gpui_native_style::Dimension}
impl NativeTranslation{const ZERO:Self=Self{x:crate::gpui_native_style::Dimension::ZERO,y:crate::gpui_native_style::Dimension::ZERO};fn is_zero(self)->bool{self.x==Self::ZERO.x&&self.y==Self::ZERO.y}}
struct TranslatedElement{element:AnyElement,translation:NativeTranslation,owner:Option<OwnerWeak>}
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
fn translated_element(element:AnyElement,translation:NativeTranslation,owner:Option<OwnerWeak>)->AnyElement{if translation.is_zero(){element}else{TranslatedElement{element,translation,owner}.into_any_element()}}
fn native_presentation(owner:&OwnerRef,tokens:&[String])->(gpui::StyleRefinement,bool,NativeTranslation){
    use crate::gpui_native_style::{themes,ColorScheme,Substitution,LengthContext,evaluate_length};
    let(vocabulary,theme)={let o=owner.borrow();(o.style_vocabulary,themes().get(&o.theme,if o.dark{ColorScheme::Dark}else{ColorScheme::Light}).expect("unknown design language"))};
    let mut resolved=vocabulary.resolve_all(tokens.iter().map(String::as_str));assert!(resolved.unknown.is_empty(),"unmapped style tokens: {:?}",resolved.unknown);
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
fn valid_template_children(value:&Value)->bool{match value{Value::Template(node)=>node.children.iter().all(valid_template_children),Value::Array(items)=>items.iter().all(valid_template_children),Value::Json(Json::String(_)|Json::Number(_)|Json::Null)|Value::Number(_)=>true,_=>false}}
fn append_template_children(mut element:gpui::Stateful<gpui::Div>,value:&Value,owner:&OwnerRef,focus:&FocusHandle,path:&str,index:&mut usize,drive:&Drive)->gpui::Stateful<gpui::Div>{
match value{
Value::Json(Json::Null)=>{},
Value::Array(items)=>{for value in items.iter(){element=append_template_children(element,value,owner,focus,path,index,drive);}},
Value::Template(node)if node.slot=>{let owner_view=owner.borrow();for value in &owner_view.slot{element=append_template_children(element,value,owner,focus,path,index,drive);}},
_=>{let child=paint(value,owner,focus,false,format!("{path}-{index}"),drive.clone());*index+=1;element=element.child(child);}
}element
}
pub fn paint(value:&Value,owner:&OwnerRef,focus:&FocusHandle,root:bool,path:String,drive:Drive)->AnyElement{
// C-TEMPLATE-0001: the host Root owns component channels and feedback;
// authored nodes, text and sibling arrays stay inside that stable surface.
let node=if root{None}else{match value{
Value::Native(view)=>return view.clone().into_any_element(),Value::Json(Json::String(text))=>return text.clone().into_any_element(),Value::Number(number)=>return number.to_string().into_any_element(),Value::Json(Json::Number(number))=>return number.to_string().into_any_element(),
Value::Template(node)=>Some(node),_=>panic!("invalid semantic template child")}};
let mut native_role=None;let mut element=div().id(gpui::ElementId::Name(path.clone().into()));let mut tokens:Vec<String>=node.iter().flat_map(|node|node.styles.iter().map(|(token,_)|token.clone())).collect();if root{tokens.extend(styles(owner));owner.borrow_mut().native_translation=gpui::Point::default();}let(style,fixed,translation)=native_presentation(owner,&tokens);*element.style()=style;
if root&&image_supported(owner){element=element.role(gpui::Role::Image);}
if root&&owner.borrow().modules.hooks.contains("scroll"){let (axes,handle)={let o=owner.borrow();(text_or(field(&o.modules.scroll.config,"axes"),"both"),o.modules.scroll.handle.clone())};element=element.track_scroll(&handle);if axes!="vertical"{element=element.overflow_x_scroll();}if axes!="horizontal"{element=element.overflow_y_scroll();}let scrolled=owner.clone();let scroll_drive=drive.clone();element=element.on_scroll_wheel(move|_,window,cx|{scroll_input(&scrolled);scroll_drive(window,cx);});}
if root{let (accessible,role,name,actions,slot)={let o=owner.borrow();(o.accessible,o.accessible_role.clone(),o.name_content,o.accessible_actions.clone(),o.slot.clone())};if native_focus_surface(owner)&&!text_disabled(owner){element=element.track_focus(focus)}if text_supported(owner){element=element.role(gpui::Role::TextInput);}if accessible{let role=resolved(&role);if !role.nullish(){if let Some(role)=role_from_name(&role.text()){native_role=Some(role);if role!=gpui::Role::GenericContainer{element=element.role(role);}}}if name{element=element.aria_label(text_content(value,&slot));}for action in actions{let owner=owner.clone();let drive=drive.clone();let kind=action.clone();element=element.on_a11y_action(action_from_name(&action),move |_,window,cx|{let kind=owner.borrow().modules.action_events.get(&kind).cloned().unwrap_or_else(||format!("a11y:{kind}"));if dispatch(&owner,&kind,false,event_fields(&kind)){window.prevent_default()}drive(window,cx)});}}
let capture_down=owner.clone();let capture_drive=drive.clone();element.interactivity().capture_any_mouse_down(move|event,window,cx|{let mut fields=event_fields("host:mousedown");modifiers(&mut fields,event.modifiers);if dispatch_phase(&capture_down,"host:mousedown",false,true,fields){window.prevent_default()}capture_drive(window,cx)});
let on_down=owner.clone();let down_drive=drive.clone();element.interactivity().on_any_mouse_down(move|event,window,cx|{if claim_pointer(&on_down){let mut fields=event_fields("pointer.down");modifiers(&mut fields,event.modifiers);let mut prevented=dispatch_root_route(&on_down,"pointer.down",fields.clone());if event.button==gpui::MouseButton::Left{prevented|=pointer_intent(&on_down,"press.start",press_fields("press.start",&fields));}if prevented{window.prevent_default()}else if !window.default_prevented(){text_pointer_down(&on_down,event,window,cx);}if event.button==gpui::MouseButton::Right&&dispatch_root_route(&on_down,"context.menu",event_fields("context.menu")){window.prevent_default()}}let mut fields=event_fields("host:mousedown");modifiers(&mut fields,event.modifiers);if dispatch(&on_down,"host:mousedown",false,fields){window.prevent_default()}down_drive(window,cx)});
let capture_up=owner.clone();let capture_drive=drive.clone();element.interactivity().capture_any_mouse_up(move|event,window,cx|{let mut fields=event_fields("host:mouseup");modifiers(&mut fields,event.modifiers);if dispatch_phase(&capture_up,"host:mouseup",false,true,fields){window.prevent_default()}capture_drive(window,cx)});
let on_up=owner.clone();let up_drive=drive.clone();element.interactivity().on_any_mouse_up(move|event,window,cx|{if claim_pointer(&on_up){let mut fields=event_fields("pointer.up");modifiers(&mut fields,event.modifiers);let mut prevented=dispatch_root_route(&on_up,"pointer.up",fields.clone());if event.button==gpui::MouseButton::Left{prevented|=pointer_intent(&on_up,"press.end",press_fields("press.end",&fields));}if prevented{window.prevent_default()}}let mut fields=event_fields("host:mouseup");modifiers(&mut fields,event.modifiers);if dispatch(&on_up,"host:mouseup",false,fields){window.prevent_default()}up_drive(window,cx)});
let on_move=owner.clone();let move_drive=drive.clone();element=element.on_mouse_move(move|event,window,cx|{if claim_pointer(&on_move){let mut fields=event_fields("pointer.move");modifiers(&mut fields,event.modifiers);if dispatch_root_route(&on_move,"pointer.move",fields){window.prevent_default()}else if !window.default_prevented(){text_pointer_move(&on_move,event,window,cx);}}let mut fields=event_fields("host:mousemove");modifiers(&mut fields,event.modifiers);if dispatch(&on_move,"host:mousemove",false,fields){window.prevent_default()}move_drive(window,cx)});
let on_hover=owner.clone();let hover_drive=drive.clone();element=element.on_hover(move|hover,window,cx|{let kind=if *hover{"pointer.enter"}else{"pointer.leave"};let mut prevented=dispatch_root_route(&on_hover,kind,event_fields(kind));if !*hover{prevented|=pointer_intent(&on_hover,"press.cancel",event_fields("press.cancel"));}if prevented{window.prevent_default()}let kind=if *hover{"host:mouseenter"}else{"host:mouseleave"};if dispatch(&on_hover,kind,false,event_fields(kind)){window.prevent_default()}hover_drive(window,cx)});
let on_click=owner.clone();let click_drive=drive.clone();element=element.on_click(move|event,window,cx|{let(suppress,cancelled)={let mut o=on_click.borrow_mut();(std::mem::take(&mut o.suppress_click),std::mem::take(&mut o.press.cancelled))};if !cancelled&&!(suppress&&matches!(event,gpui::ClickEvent::Keyboard(_)))&&claim_click(&on_click)&&dispatch_root_route(&on_click,"press.commit",event_fields("press.commit")){window.prevent_default()}if dispatch(&on_click,"host:click",false,event_fields("host:click")){window.prevent_default()}global_native_click(event,window,cx);click_drive(window,cx)});

let capture_key=owner.clone();element=element.capture_key_down(move|event,window,_|{reset_key();let mut fields=event_fields("host:keydown");if let Some(key)=portable_key(&event.keystroke){fields.insert("key".into(),Json::String(key));}modifiers(&mut fields,event.keystroke.modifiers);if dispatch_phase(&capture_key,"host:keydown",false,true,fields){window.prevent_default()}});let capture_key=owner.clone();element=element.capture_key_up(move|event,window,_|{reset_key();let mut fields=event_fields("host:keyup");if let Some(key)=portable_key(&event.keystroke){fields.insert("key".into(),Json::String(key));}modifiers(&mut fields,event.keystroke.modifiers);if dispatch_phase(&capture_key,"host:keyup",false,true,fields){window.prevent_default()}});
let on_key=owner.clone();element=element.on_key_down(move|event,window,cx|{let mut fields=event_fields("host:keydown");fields.insert("key".into(),Json::String(portable_key(&event.keystroke).expect("portable key string")));modifiers(&mut fields,event.keystroke.modifiers);if dispatch(&on_key,"host:keydown",false,fields){window.prevent_default()}collect_key(&on_key);global_key_down(event,window,cx);});
let on_key=owner.clone();element=element.on_key_up(move|event,window,cx|{let mut fields=event_fields("host:keyup");fields.insert("key".into(),Json::String(portable_key(&event.keystroke).expect("portable key string")));modifiers(&mut fields,event.keystroke.modifiers);if dispatch(&on_key,"host:keyup",false,fields){window.prevent_default()}collect_key(&on_key);global_key_up(event,window,cx);});
let measured=owner.clone();let committed=owner.clone();let revision=owner.borrow().projection_revision;let commit_drive=drive.clone();element=element.child(canvas(move|_,window,_|{note_host_order(&measured);scroll_frame(&measured,window);},move|_,_,window,cx|{register_pointer_input(window,Some(Rc::downgrade(&committed)));window.on_mouse_event::<gpui::MouseDownEvent>(native_pointer_press);window.on_mouse_event::<gpui::ScrollWheelEvent>(overlay_modal_wheel);let owner=committed.clone();let drive=commit_drive.clone();window.defer(cx,move|window,cx|{Owner::commit(&owner,revision);poll_state_watchers();drive(window,cx)});}).absolute().size_full());
}
if root&&image_supported(owner){let fill_height=matches!(element.style().size.height,Some(gpui::Length::Definite(_)));element=element.child(image_element(owner,fill_height));}
if root&&text_supported(owner){let fill_height=matches!(element.style().size.height,Some(gpui::Length::Definite(_)));let scrolled=owner.clone();element=element.on_scroll_wheel(move|event,window,cx|{if text_scroll(&scrolled,event,window,cx){cx.stop_propagation();}}).child(NativeTextElement::new(owner,focus,fill_height));}
let mut child_index=0;if root{element=append_template_children(element,value,owner,focus,&path,&mut child_index,&drive);}else if let Some(node)=node{for value in &node.children{element=append_template_children(element,value,owner,focus,&path,&mut child_index,&drive);}}
if root{let element=translated_element(crate::gpui_native_a11y::Semantics{element:element.into_element(),owner:Rc::downgrade(owner),role:native_role}.into_any_element(),translation,Some(Rc::downgrade(owner)));let(element,fixed)=positioning_root(owner,element,fixed);overlay_root(owner,element,fixed)}else{let element=translated_element(element.into_any_element(),translation,None);if fixed{viewport_root(element)}else{element}}
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
pub fn action_from_name(name:&str)->gpui::AccessibleAction{match name{"click"|"press"=>gpui::AccessibleAction::Click,"focus"=>gpui::AccessibleAction::Focus,"increment"=>gpui::AccessibleAction::Increment,"decrement"=>gpui::AccessibleAction::Decrement,_=>panic!("unsupported native accessibility action: {name}")}}
thread_local!{static KEY_TARGET:RefCell<Option<OwnerWeak>>=RefCell::new(None);static KEY_DISPATCHED:Cell<bool>=Cell::new(false);static CLICK_TARGET:RefCell<Option<OwnerWeak>>=RefCell::new(None);static POINTER_TARGET:RefCell<Option<OwnerWeak>>=RefCell::new(None);static POINTER_DISPATCHED:Cell<bool>=Cell::new(false);static GLOBAL_CLICK_DISPATCHED:Cell<bool>=Cell::new(false);}
thread_local!{static KEY_SCOPES:RefCell<Vec<(gpui::WindowId,gpui::WeakFocusHandle)>>=RefCell::new(Vec::new());}
pub fn register_key_scope(focus:&FocusHandle,window:&Window){let id=window.window_handle().window_id();KEY_SCOPES.with(|scopes|{let mut scopes=scopes.borrow_mut();if scopes.iter().any(|(window,scope)|*window==id&&scope==focus){return}scopes.retain(|(_,scope)|scope.upgrade().is_some());scopes.push((id,focus.downgrade()));});}
// Resolve against the current physical tree, including cached or reparented views.
// Equal handles are excluded: SDK contains(h,h) is not a physical-presence check.
pub fn outer_key_scope(focus:&FocusHandle,window:&Window)->bool{let id=window.window_handle().window_id();KEY_SCOPES.with(|scopes|!scopes.borrow().iter().any(|(scope_window,scope)|*scope_window==id&&scope!=focus&&scope.upgrade().is_some_and(|parent|parent.contains(focus,window))))}
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
    let(root,global)={let mut o=owner.borrow_mut();let root=o.press.key.take().is_some()||o.press.pointer;let global=o.press.global_key.take().is_some()||o.press.global_pointer;let keyboard_click=o.press.global_keyboard_click;let pointer_cancelled=o.press.cancelled||o.press.pointer;let global_pointer_cancelled=o.press.global_pointer_cancelled||o.press.global_pointer;o.press=NativePress::default();o.press.global_keyboard_click=keyboard_click;o.press.cancelled=pointer_cancelled;o.press.global_pointer_cancelled=global_pointer_cancelled;(root,global)};
    let mut prevented=false;if root{prevented|=dispatch_root_route(owner,"press.cancel",event_fields("press.cancel"));}if global{prevented|=dispatch(owner,"press.cancel",true,event_fields("press.cancel"));}prevented
}
pub fn global_native_click(event:&gpui::ClickEvent,window:&mut Window,cx:&mut App){
    if matches!(event,gpui::ClickEvent::Mouse(event)if event.up.button!=gpui::MouseButton::Left){return}
    if GLOBAL_CLICK_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
    let keyboard=matches!(event,gpui::ClickEvent::Keyboard(_));let mut prevented=false;
    for owner in owners_in(window){if !owner.borrow().press_global{continue}let suppress={let mut owner=owner.borrow_mut();let suppress=if keyboard{owner.press.global_keyboard_click}else{owner.press.global_pointer_cancelled};owner.press.global_keyboard_click=false;owner.press.global_pointer_cancelled=false;suppress};if !suppress{prevented|=dispatch(&owner,"press.commit",true,event_fields("press.commit"));}}
    if prevented{window.prevent_default()}drive_owners(window,cx);
}
fn global_pointer(kind:&str,host_kind:&str,modifiers_value:gpui::Modifiers,primary:bool,phase:gpui::DispatchPhase,window:&mut Window,cx:&mut App){
    if phase.capture(){POINTER_TARGET.with(|target|*target.borrow_mut()=None);POINTER_DISPATCHED.with(|dispatched|dispatched.set(false));if kind=="pointer.up"{reset_click();GLOBAL_CLICK_DISPATCHED.with(|dispatched|dispatched.set(false));}return}
    if !phase.bubble()||POINTER_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
    let mut fields=event_fields(kind);modifiers(&mut fields,modifiers_value);let mut host_fields=event_fields(host_kind);modifiers(&mut host_fields,modifiers_value);let mut prevented=false;
    for owner in owners_in(window){
        prevented|=dispatch(&owner,kind,true,fields.clone());prevented|=dispatch(&owner,host_kind,true,host_fields.clone());
        if primary&&ready(&owner)&&owner.borrow().press_global{let intent={let mut owner=owner.borrow_mut();match kind{"pointer.down"=>{owner.press.global_keyboard_click=false;owner.press.global_pointer_cancelled=false;if owner.press.global_pointer{None}else{owner.press.global_pointer=true;Some("press.start")}},"pointer.up"=>if std::mem::take(&mut owner.press.global_pointer){Some("press.end")}else{None},_=>None}};if let Some(intent)=intent{prevented|=dispatch(&owner,intent,true,press_fields(intent,&fields));}}
        if primary&&kind=="pointer.up"&&owner.borrow().press.pointer{let intent=if native_host_hit(&owner,window.mouse_position(),window){"press.end"}else{"press.cancel"};prevented|=pointer_intent(&owner,intent,press_fields(intent,&fields));}
    }
    if prevented{window.prevent_default();}drive_owners(window,cx);
}
fn global_host_pointer_capture(owner:&Option<OwnerWeak>,kind:&str,modifiers_value:gpui::Modifiers,phase:gpui::DispatchPhase,window:&mut Window,cx:&mut App){if !phase.capture(){return}let Some(owner)=owner.as_ref().and_then(Weak::upgrade)else{return};if !ready(&owner)||owner.borrow().window_id!=Some(window.window_handle().window_id())||!has_listener(&owner,kind,true,true){return}let mut fields=event_fields(kind);modifiers(&mut fields,modifiers_value);if dispatch_phase(&owner,kind,true,true,fields){window.prevent_default()}let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx)}}
pub fn register_pointer_input(window:&mut Window,owner:Option<OwnerWeak>){
    let down=owner.clone();window.on_mouse_event::<gpui::MouseDownEvent>(move|event,phase,window,cx|{global_host_pointer_capture(&down,"host:mousedown",event.modifiers,phase,window,cx);global_pointer("pointer.down","host:mousedown",event.modifiers,event.button==gpui::MouseButton::Left,phase,window,cx);});
    let up=owner.clone();window.on_mouse_event::<gpui::MouseUpEvent>(move|event,phase,window,cx|{global_host_pointer_capture(&up,"host:mouseup",event.modifiers,phase,window,cx);global_pointer("pointer.up","host:mouseup",event.modifiers,event.button==gpui::MouseButton::Left,phase,window,cx);});
    window.on_mouse_event::<gpui::MouseMoveEvent>(move|event,phase,window,cx|{global_host_pointer_capture(&owner,"host:mousemove",event.modifiers,phase,window,cx);global_pointer("pointer.move","host:mousemove",event.modifiers,false,phase,window,cx);});
}
fn global_host_key_down_capture(owner:&OwnerRef,event:&gpui::KeystrokeEvent,window:&mut Window,cx:&mut App){if !ready(owner)||owner.borrow().window_id!=Some(window.window_handle().window_id())||!has_listener(owner,"host:keydown",true,true){return}let mut fields=event_fields("host:keydown");fields.insert("key".into(),Json::String(portable_key(&event.keystroke).expect("portable key string")));modifiers(&mut fields,event.keystroke.modifiers);if dispatch_phase(owner,"host:keydown",true,true,fields){window.prevent_default()}let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx)}}
pub fn subscribe_global_key_capture(owner:&OwnerRef,cx:&mut App)->Option<gpui::Subscription>{if !has_listener(owner,"host:keydown",true,true){return None}let owner=Rc::downgrade(owner);Some(cx.intercept_keystrokes(move|event,window,cx|{if let Some(owner)=owner.upgrade(){global_host_key_down_capture(&owner,event,window,cx);}}))}
pub fn global_host_key_up_capture(event:&gpui::KeyUpEvent,window:&mut Window,cx:&mut App){let mut fields=None;let mut prevented=false;for owner in owners_in(window){if !has_listener(&owner,"host:keyup",true,true){continue}let fields=fields.get_or_insert_with(||{let mut fields=event_fields("host:keyup");fields.insert("key".into(),Json::String(portable_key(&event.keystroke).expect("portable key string")));modifiers(&mut fields,event.keystroke.modifiers);fields});prevented|=dispatch_phase(&owner,"host:keyup",true,true,fields.clone());}if fields.is_some(){if prevented{window.prevent_default()}drive_owners(window,cx);}}
fn owners_in(window:&Window)->Vec<OwnerRef>{let id=window.window_handle().window_id();OWNERS.with(|owners|{let mut owners=owners.borrow_mut();owners.retain(|owner|owner.strong_count()!=0);owners.iter().filter_map(Weak::upgrade).filter(|owner|{let o=owner.borrow();!o.disposed&&o.mounted&&o.present&&o.window_id==Some(id)}).collect()})}
pub fn drive_owners(window:&mut Window,cx:&mut App){for owner in owners_in(window){let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx)}}}
pub fn global_key_down(event:&gpui::KeyDownEvent,window:&mut Window,cx:&mut App){
    if KEY_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
    let key=portable_key(&event.keystroke);let mut fields=event_fields("key.down");if let Some(key)=&key{fields.insert("key".into(),Json::String(key.clone()));}fields.insert("repeat".into(),Json::Bool(event.is_held));modifiers(&mut fields,event.keystroke.modifiers);
    let mut host_fields=None;
    let target=KEY_TARGET.with(|target|target.borrow().as_ref().and_then(Weak::upgrade));let mut prevented=false;
    for owner in owners_in(window){
        if !matches!(key.as_deref(),Some("Enter"|" ")){owner.borrow_mut().suppress_click=false;}
        if has_listener(&owner,"host:keydown",true,false){prevented|=dispatch(&owner,"host:keydown",true,host_fields.get_or_insert_with(||press_fields("host:keydown",&fields)).clone());}
        prevented|=dispatch(&owner,"key.down",true,fields.clone());
        if !ready(&owner)||!owner.borrow().press_global{continue}
        if let Some(key)=key.as_deref().filter(|key|matches!(*key,"Enter"|" ")){let start={let mut owner=owner.borrow_mut();let start=owner.press.global_key.is_none();if start{owner.press.global_key=Some(key.into());}owner.press.global_keyboard_click=true;start};if start{prevented|=dispatch(&owner,"press.start",true,press_fields("press.start",&fields));}prevented|=dispatch(&owner,"press.commit",true,press_fields("press.commit",&fields));}else{owner.borrow_mut().press.global_keyboard_click=false;}
    }
    if let Some(target)=&target{prevented|=dispatch_root_route(target,"key.down",fields.clone());}
    if prevented||window.default_prevented(){window.prevent_default();cx.stop_propagation();}
    else if focus_key_navigation(event,window){cx.stop_propagation();}
    else if let Some(target)=target.filter(ready){
        if text_supported(&target){if text_key_down(&target,event,window,cx){window.prevent_default();cx.stop_propagation();}}
        else if let Some(key)=key.filter(|key|key=="Enter"||key==" ").filter(|_|trigger_child(&target).is_none()){
            let start={let mut target=target.borrow_mut();let start=target.press.key.is_none();if start{target.press.key=Some(key.clone());}target.suppress_click=true;start};if start&&dispatch_root_route(&target,"press.start",press_fields("press.start",&fields)){window.prevent_default();}let mut fields=event_fields("press.commit");fields.insert("key".into(),Json::String(key));fields.insert("repeat".into(),Json::Bool(event.is_held));modifiers(&mut fields,event.keystroke.modifiers);
            if dispatch_root_route(&target,"press.commit",fields){window.prevent_default();cx.stop_propagation();}
        }
    }
    drive_owners(window,cx);
}
pub fn global_key_up(event:&gpui::KeyUpEvent,window:&mut Window,cx:&mut App){
    if KEY_DISPATCHED.with(|dispatched|dispatched.replace(true)){return}
    let key=portable_key(&event.keystroke);let mut fields=event_fields("key.up");if let Some(key)=&key{fields.insert("key".into(),Json::String(key.clone()));}fields.insert("repeat".into(),Json::Bool(false));modifiers(&mut fields,event.keystroke.modifiers);
    let mut host_fields=None;
    let target=KEY_TARGET.with(|target|target.borrow().as_ref().and_then(Weak::upgrade));let mut prevented=false;
    let owners=owners_in(window);
    for owner in &owners{if has_listener(owner,"host:keyup",true,false){prevented|=dispatch(owner,"host:keyup",true,host_fields.get_or_insert_with(||press_fields("host:keyup",&fields)).clone());}prevented|=dispatch(owner,"key.up",true,fields.clone());let end={let mut owner=owner.borrow_mut();if owner.press.global_key.as_deref()==key.as_deref(){owner.press.global_key.take().is_some()}else{false}};if end{prevented|=dispatch(owner,"press.end",true,press_fields("press.end",&fields));}}
    if let Some(target)=&target{prevented|=dispatch_root_route(target,"key.up",fields.clone());}
    for owner in &owners{let end={let mut owner=owner.borrow_mut();if owner.press.key.as_deref()==key.as_deref(){owner.press.key.take().is_some()}else{false}};if end{prevented|=dispatch_root_route(owner,"press.end",press_fields("press.end",&fields));}}
    if prevented{window.prevent_default();cx.stop_propagation();}drive_owners(window,cx);
}
` +
  gpuiNativeModulesSource +
  gpuiNativeTopologySource +
  gpuiNativeTableSource +
  gpuiNativeBoundarySource +
  gpuiNativeScrollSource +
  gpuiNativeTextSource +
  gpuiNativeImageSource +
  gpuiNativePositioningSource +
  gpuiNativeOverlaySource;
