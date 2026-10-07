// Pinned GPUI Element::write_a11y_info writes the actual AccessKit node.
export const gpuiNativeA11ySource = String.raw`use gpui::{App, Bounds, Element, ElementId, GlobalElementId, InspectorElementId, IntoElement, LayoutId, Pixels, Window};
use crate::gpui_native_owner::{OwnerWeak,Value,text_content,resolved,detach_native_view};
use std::hash::{Hash,Hasher};
struct LayoutFrame{serial:u64,names:std::collections::HashMap<String,Option<OwnerWeak>>}
thread_local!{
static A11Y_LAYOUT_FRAMES:std::cell::RefCell<std::collections::HashMap<gpui::WindowId,LayoutFrame>>=std::cell::RefCell::new(std::collections::HashMap::new());
static A11Y_NEXT_FRAME:std::cell::Cell<u64>=const{std::cell::Cell::new(0)};
}
// SDK semantics precede prepaint and mounted. Only this draw's layout bindings
// are targets; a still-mounted owner from the previous draw is not evidence.
fn layout_frame(window:&mut Window,cx:&mut App)->u64{
let window_id=window.window_handle().window_id();let(frame,started)=A11Y_LAYOUT_FRAMES.with(|frames|{let mut frames=frames.borrow_mut();if let Some(frame)=frames.get(&window_id){(frame.serial,false)}else{let frame=A11Y_NEXT_FRAME.with(|next|{let frame=next.get().checked_add(1).expect("native accessibility frame overflow");next.set(frame);frame});frames.insert(window_id,LayoutFrame{serial:frame,names:std::collections::HashMap::new()});(frame,true)}});
if started{window.defer(cx,move|_,_|A11Y_LAYOUT_FRAMES.with(|frames|{let mut frames=frames.borrow_mut();if frames.get(&window_id).is_some_and(|current|current.serial==frame){frames.remove(&window_id);}}));}frame
}
fn object_node(target:&OwnerWeak,frame:u64)->Option<gpui::accesskit::NodeId>{let target=target.upgrade()?;let target=target.borrow();if target.disposed||!target.present||target.modules.a11y_frame!=frame||target.modules.a11y_bindings!=1{return None}target.modules.a11y_node}
fn named_node(window:Option<gpui::WindowId>,frame:u64,name:&str)->Option<gpui::accesskit::NodeId>{let window=window?;let target=A11Y_LAYOUT_FRAMES.with(|frames|{let frames=frames.borrow();let current=frames.get(&window)?;if current.serial!=frame{return None}current.names.get(name)?.clone()})?;object_node(&target,frame)}
fn relation_nodes(target:&Value,frame:u64,window:Option<gpui::WindowId>)->Option<Vec<gpui::accesskit::NodeId>>{
let mut ids=Vec::new();match target{
Value::ObjectRef(target)=>ids.push(object_node(target,frame)?),
Value::Array(targets)=>{for target in targets.iter(){let Value::ObjectRef(target)=target else{return None};let id=object_node(target,frame)?;if !ids.contains(&id){ids.push(id);}}},
Value::Json(serde_json::Value::String(names))=>{for name in names.split_whitespace(){if let Some(id)=named_node(window,frame,name){if !ids.contains(&id){ids.push(id);}}}},
Value::Undefined|Value::Json(serde_json::Value::Null)=>{},_=>return None,
}if ids.is_empty(){None}else{Some(ids)}
}
fn project_relation(node:&mut gpui::accesskit::Node,key:&str,spec:&Value,frame:u64,window:Option<gpui::WindowId>){
if !matches!(key,"controls"|"describedBy"|"labelledBy"|"owns"|"flowTo"|"details"|"activeDescendant"|"errorMessage"){return}
let target=resolved(&spec.member("target",false));let Some(ids)=relation_nodes(&target,frame,window)else{return};let append=matches!(spec.member("mode",true),Value::Json(serde_json::Value::String(mode))if mode=="append");match key{
"controls"=>{if append{for id in ids{if !node.controls().contains(&id){node.push_controlled(id)}}}else{node.set_controls(ids)}},
"describedBy"=>{if append{for id in ids{if !node.described_by().contains(&id){node.push_described_by(id)}}}else{node.set_described_by(ids)}},
"labelledBy"=>{if append{for id in ids{if !node.labelled_by().contains(&id){node.push_labelled_by(id)}}}else{node.set_labelled_by(ids)}},
"owns"=>{if append{for id in ids{if !node.owns().contains(&id){node.push_owned(id)}}}else{node.set_owns(ids)}},
"flowTo"=>{if append{for id in ids{if !node.flow_to().contains(&id){node.push_flow_to(id)}}}else{node.set_flow_to(ids)}},
"details"=>{if append{for id in ids{if !node.details().contains(&id){node.push_detail(id)}}}else{node.set_details(ids)}},
"activeDescendant"=>node.set_active_descendant(ids[0]),"errorMessage"=>node.set_error_message(ids[0]),
// Unmapped relationships remain semantic IR rather than invented host fields.
_=>{},
}}
fn positive_integer(value:&Value)->Option<usize>{let number=match value{Value::Number(number)=>*number,Value::Json(serde_json::Value::Number(number))=>number.as_f64()?,_=>return None};if number>=1.&&number<=9007199254740991.&&number.fract()==0.{Some(number as usize)}else{None}}
fn token_is(value:&Value,token:&str)->bool{matches!(value,Value::Json(serde_json::Value::String(value))if value.eq_ignore_ascii_case(token))}
fn aria_boolean(value:&Value)->Option<bool>{match value{Value::Json(serde_json::Value::Bool(value))=>Some(*value),_ if token_is(value,"true")=>Some(true),_ if token_is(value,"false")=>Some(false),_=>None}}
struct NativeViewLease{owner:OwnerWeak,hitbox:gpui::HitboxId}
impl Drop for NativeViewLease{fn drop(&mut self){if let Some(owner)=self.owner.upgrade(){let live=owner.borrow().native_hitbox.as_ref().is_some_and(|hitbox|hitbox.id==self.hitbox);if live{detach_native_view(&owner);}}}}
pub struct Semantics<E:Element>{pub element:E,pub owner:OwnerWeak,pub role:Option<gpui::Role>}
impl<E:Element> IntoElement for Semantics<E>{type Element=Self;fn into_element(self)->Self{self}}
impl<E:Element> Element for Semantics<E>{
type RequestLayoutState=E::RequestLayoutState;
type PrepaintState=E::PrepaintState;
fn id(&self)->Option<ElementId>{self.element.id()}
fn source_location(&self)->Option<&'static std::panic::Location<'static>>{self.element.source_location()}
fn request_layout(&mut self,id:Option<&GlobalElementId>,inspector:Option<&InspectorElementId>,window:&mut Window,cx:&mut App)->(LayoutId,Self::RequestLayoutState){
if let Some(owner)=self.owner.upgrade(){let window_id=window.window_handle().window_id();owner.borrow_mut().window_id=Some(window_id);if self.a11y_role().is_some(){if let Some(id)=id{let frame=layout_frame(window,cx);let mut hasher=std::hash::DefaultHasher::default();id.hash(&mut hasher);{let mut owner=owner.borrow_mut();if owner.modules.a11y_frame!=frame{owner.modules.a11y_frame=frame;owner.modules.a11y_bindings=0;}owner.modules.a11y_bindings+=1;owner.modules.a11y_node=Some(gpui::accesskit::NodeId(hasher.finish()));}let name=owner.borrow().modules.accessible_text.get("id").map(resolved);if let Some(Value::Json(serde_json::Value::String(name)))=name{if !name.is_empty(){A11Y_LAYOUT_FRAMES.with(|frames|{let mut frames=frames.borrow_mut();let names=&mut frames.get_mut(&window_id).expect("current native layout frame").names;match names.entry(name){std::collections::hash_map::Entry::Vacant(entry)=>{entry.insert(Some(self.owner.clone()));},std::collections::hash_map::Entry::Occupied(mut entry)=>{entry.insert(None);}}});}}}}}self.element.request_layout(id,inspector,window,cx)
}
fn prepaint(&mut self,id:Option<&GlobalElementId>,inspector:Option<&InspectorElementId>,bounds:Bounds<Pixels>,layout:&mut Self::RequestLayoutState,window:&mut Window,cx:&mut App)->Self::PrepaintState{
if let Some(owner)=self.owner.upgrade(){let hitbox=window.insert_hitbox(bounds,gpui::HitboxBehavior::Normal);let hitbox_id=hitbox.id;{let mut owner=owner.borrow_mut();owner.bounds=Some(bounds);owner.native_hitbox=Some(hitbox);}
// GPUI retains accessed element state through cached frames and drops it when
// the actual native subtree disappears. No frame polling or owner disposal.
if let Some(id)=id{window.with_element_state(id,|state:Option<NativeViewLease>,_|{let mut state=state.filter(|state|std::rc::Weak::ptr_eq(&state.owner,&self.owner)).unwrap_or_else(||NativeViewLease{owner:self.owner.clone(),hitbox:hitbox_id});state.hitbox=hitbox_id;((),state)});}}
self.element.prepaint(id,inspector,bounds,layout,window,cx)
}
fn paint(&mut self,id:Option<&GlobalElementId>,inspector:Option<&InspectorElementId>,bounds:Bounds<Pixels>,layout:&mut Self::RequestLayoutState,prepaint:&mut Self::PrepaintState,window:&mut Window,cx:&mut App){self.element.paint(id,inspector,bounds,layout,prepaint,window,cx)}
fn a11y_role(&self)->Option<gpui::Role>{let owner=self.owner.upgrade()?;if !owner.borrow().accessible{return self.element.a11y_role()}self.role.or_else(||self.element.a11y_role()).or(Some(gpui::Role::GenericContainer))}
fn a11y_synthetic_children(&mut self,prepaint:&mut Self::PrepaintState,builder:&mut gpui::A11ySubtreeBuilder){self.element.a11y_synthetic_children(prepaint,builder);let Some(owner)=self.owner.upgrade()else{return};let merge=resolved(&owner.borrow().modules.accessible_tree.member("mergeChildren",true));if !merge.nullish()&&merge.bool(){builder.parent_node().clear_children();builder.parent_node().set_label(text_content(&owner.borrow().projection,&owner.borrow().slot));}}
fn write_a11y_info(&self,node:&mut gpui::accesskit::Node){
self.element.write_a11y_info(node);
let Some(owner_ref)=self.owner.upgrade()else{return};
crate::gpui_native_owner::text_accessible(&owner_ref,node);
crate::gpui_native_owner::image_accessible(&owner_ref,node);
let native_disabled=node.is_disabled();
let owner=owner_ref.borrow();
for(key,spec)in &owner.modules.accessible_relations{project_relation(node,key,spec,owner.modules.a11y_frame,owner.window_id);}
if owner.name_content{node.set_label(text_content(&owner.projection,&owner.slot));}
for(key,value)in &owner.modules.accessible_text{let value=resolved(value);if value.nullish(){continue}match key.as_str(){"name"=>node.set_label(value.text()),"description"=>node.set_description(value.text()),"id"=>{},_=>panic!("unmapped accessible text field")}}
if matches!(resolved(&owner.accessible_role),Value::Json(serde_json::Value::String(role))if role=="heading"){if let Some(level)=crate::gpui_native_owner::accessible_level_value(&owner.modules.accessible_level){node.set_level(level);}}
for(key,state)in &owner.accessible_states{let value=state.get();if value.nullish()||token_is(&value,""){continue}match key.as_str(){
"selected"=>{if let Some(value)=aria_boolean(&value){node.set_selected(value)}},"expanded"=>{if let Some(value)=aria_boolean(&value){node.set_expanded(value)}},
"checked"|"pressed"=>{if let Some(value)=aria_boolean(&value){node.set_toggled(if value{gpui::Toggled::True}else{gpui::Toggled::False});}else if token_is(&value,"mixed"){node.set_toggled(gpui::Toggled::Mixed);}},
"disabled"=>{if let Some(value)=aria_boolean(&value){if value{node.set_disabled()}else if !native_disabled{node.clear_disabled()}}},
"hidden"=>{if let Some(value)=aria_boolean(&value){if value{node.set_hidden()}else{node.clear_hidden()}}},
"busy"=>{if let Some(value)=aria_boolean(&value){if value{node.set_busy()}else{node.clear_busy()}}},
"atomic"=>{if let Some(value)=aria_boolean(&value){if value{node.set_live_atomic()}else{node.clear_live_atomic()}}},
"modal"=>{if let Some(value)=aria_boolean(&value){if value{node.set_modal()}else{node.clear_modal()}}},
"readOnly"=>{if let Some(value)=aria_boolean(&value){if value{node.set_read_only()}else{node.clear_read_only()}}},
"orientation"=>{if token_is(&value,"vertical"){node.set_orientation(gpui::Orientation::Vertical)}else if token_is(&value,"horizontal"){node.set_orientation(gpui::Orientation::Horizontal)}},
"rowCount"=>{if let Some(value)=positive_integer(&value){node.set_row_count(value)}},"columnCount"=>{if let Some(value)=positive_integer(&value){node.set_column_count(value)}},"rowIndex"=>{if let Some(value)=positive_integer(&value){node.set_row_index(value-1)}},"columnIndex"=>{if let Some(value)=positive_integer(&value){node.set_column_index(value-1)}},"rowSpan"=>{if let Some(value)=positive_integer(&value){node.set_row_span(value)}},"columnSpan"=>{if let Some(value)=positive_integer(&value){node.set_column_span(value)}},
"invalid"=>{if aria_boolean(&value)==Some(false){node.clear_invalid()}else{node.set_invalid(if token_is(&value,"grammar"){gpui::accesskit::Invalid::Grammar}else if token_is(&value,"spelling"){gpui::accesskit::Invalid::Spelling}else{gpui::accesskit::Invalid::True})}},
"live"=>{if token_is(&value,"off"){node.set_live(gpui::accesskit::Live::Off)}else if token_is(&value,"polite"){node.set_live(gpui::accesskit::Live::Polite)}else if token_is(&value,"assertive"){node.set_live(gpui::accesskit::Live::Assertive)}},
"hasPopup"=>{if aria_boolean(&value)==Some(false){node.clear_has_popup()}else if aria_boolean(&value)==Some(true)||token_is(&value,"menu"){node.set_has_popup(gpui::accesskit::HasPopup::Menu)}else if token_is(&value,"listbox"){node.set_has_popup(gpui::accesskit::HasPopup::Listbox)}else if token_is(&value,"tree"){node.set_has_popup(gpui::accesskit::HasPopup::Tree)}else if token_is(&value,"grid"){node.set_has_popup(gpui::accesskit::HasPopup::Grid)}else if token_is(&value,"dialog"){node.set_has_popup(gpui::accesskit::HasPopup::Dialog)}},
// State keys are open-ended semantic facts. Unmapped keys remain in the
// owner's IR without inventing an AccessKit property (C-A11Y-0001-G).
_=>{},
}}
let hidden=resolved(&owner.modules.accessible_tree.member("hidden",true));if !hidden.nullish(){if hidden.bool(){node.set_hidden()}else{node.clear_hidden()}}
}
}
`;
