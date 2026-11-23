// Ordinary GPUI text/IME host. One logical owner; native input leases are view-scoped.
export const gpuiNativeTextSource = String.raw`
use std::ops::Range;
use unicode_segmentation::UnicodeSegmentation;
#[derive(Clone)]
struct TextListener {kind:&'static str,callback:Value,active:Rc<Cell<bool>>}
#[derive(Clone)]
struct TextEdit {value:gpui::SharedString,selection:Range<usize>,reversed:bool}
#[derive(Default)]
pub struct TextModule {
    supported:bool,multiline:bool,declared:bool,initialized:bool,controlled:bool,
    pub patch:BTreeMap<String,Value>,value:String,composing:bool,lease_epoch:u64,
    editor:gpui::SharedString,placeholder:gpui::SharedString,selection:Range<usize>,reversed:bool,marked:Option<Range<usize>>,
    listeners:Vec<TextListener>,geometry:Option<Rc<TextGeometry>>,drag_anchor:Option<usize>,
    undo:Vec<TextEdit>,redo:Vec<TextEdit>,changed:bool,
    viewport:gpui::Point<Pixels>,reveal_caret:bool,focused:bool,
    a11y:Option<Rc<TextA11yProjection>>,
}
pub struct TextGeometry {
    text:gpui::SharedString,style:gpui::TextStyle,font_size:Pixels,line_height:Pixels,
    wrap:Option<Pixels>,marked:Option<Range<usize>>,lines:Vec<gpui::WrappedLine>,
    bounds:Cell<Bounds<Pixels>>,viewport:Cell<gpui::Point<Pixels>>,content:gpui::Size<Pixels>,placeholder:bool,
}
pub fn text_declaration(owner:&OwnerWeak,multiline:bool){
    let owner=setup(owner);let mut o=owner.borrow_mut();assert!(!o.modules.image.supported,"one physical Root cannot be both TextControl and ImageView");let text=&mut o.modules.text;
    assert!(!text.supported,"duplicate TextControl declaration");text.supported=true;text.multiline=multiline;
}
pub fn text_setup(owner:&OwnerWeak)->Value{
    let owner_ref=setup(owner);{let mut o=owner_ref.borrow_mut();let text=&mut o.modules.text;
        assert!(text.supported,"TextControl requires a static declaration");assert!(!text.declared,"one TextControl per owner");text.declared=true;
        o.modules.hooks.insert("text-control");o.focusable=true;
    }Value::Handle(owner.clone(),"text-control")
}
fn canonical_text(value:&str,multiline:bool)->String{
    if !value.contains('\r')&&(multiline||!value.contains('\n')){return value.to_owned()}
    let mut result=String::with_capacity(value.len());let mut characters=value.chars().peekable();
    while let Some(character)=characters.next(){
        if character=='\r'{if characters.peek()==Some(&'\n'){characters.next();}if multiline{result.push('\n');}}
        else if character!='\n'||multiline{result.push(character);}
    }result
}
pub fn text_on(owner:&OwnerWeak,kind:Value,callback:Value)->Value{
    let owner=setup(owner);let kind=kind.text();
    let kind=match kind.as_str(){"input"=>"input","change"=>"change","compositionstart"=>"compositionstart","compositionupdate"=>"compositionupdate","compositionend"=>"compositionend",_=>panic!("invalid TextControl event")};
    let active=Rc::new(Cell::new(true));owner.borrow_mut().modules.text.listeners.push(TextListener{kind,callback,active:active.clone()});
    disposer(owner,active,true)
}
pub fn text_sync(owner:&OwnerWeak,patch:Value)->Value{
    let owner=runtime(owner);let Value::Record(entries)=patch else{panic!("TextControl patch required")};let entries=entries.fields.borrow();
    let mut o=owner.borrow_mut();let text=&mut o.modules.text;
    assert!(text.declared,"TextControl is not declared");
    let rows=entries.get("rows");let wrap=entries.get("wrap");
    assert!(text.multiline||!rows.is_some_and(|v|matches!(v,Value::Number(_)|Value::Json(Json::Number(_))))&&!wrap.is_some_and(|v|!matches!(v,Value::Undefined)),"rows/wrap require multiline TextControl");
    if !text.initialized {
        let mode=text_or(entries.get("valueMode").cloned().unwrap_or_default(),"uncontrolled");
        assert!(mode=="controlled"||mode=="uncontrolled","invalid TextControl value mode");text.controlled=mode=="controlled";
        let key=if text.controlled{"value"}else{"defaultValue"};
        text.value=canonical_text(&text_or(entries.get(key).cloned().unwrap_or_default(),""),text.multiline);
        text.initialized=true;text.editor=text.value.clone().into();text.selection=text.editor.len()..text.editor.len();
        text.reveal_caret=true;
    }
    for(key,value)in entries.iter(){
        if key=="valueMode"{continue}
        if key=="value"||key=="defaultValue" {
            if matches!(value,Value::Json(Json::String(_))){text.patch.insert(key.clone(),Value::string(&canonical_text(&value.text(),text.multiline)));}
        }else{text.patch.insert(key.clone(),value.clone());}
    }
    if text.controlled{text.value=text_or(field(&text.patch,"value"),"");}
    if entries.contains_key("placeholder"){text.placeholder=text_or(field(&text.patch,"placeholder"),"").into();}
    if !text.composing {project_text_value(text);}
    o.dirty=true;Value::Undefined
}
fn project_text_value(text:&mut TextModule){
    if text.editor.as_ref()!=text.value {
        let selection=byte_utf16(&text.editor,text.selection.start)..byte_utf16(&text.editor,text.selection.end);
        text.editor=text.value.clone().into();text.selection=utf16_range(&text.editor,selection);
        text.marked=None;text.geometry=None;
    }
}
pub fn text_snapshot(owner:&OwnerWeak)->Value{
    let owner=ensure(owner);let o=owner.borrow();let text=&o.modules.text;
    if !text.declared{return Value::Json(Json::Null)}
    record(vec![("value",Value::string(&text.value)),("composing",Value::boolean(text.composing))])
}
pub fn text_reset_value(owner:&OwnerWeak,value:Value)->Value{
    let owner=runtime(owner);
    if !ready(&owner){return Value::boolean(false)}
    if !matches!(value,Value::Undefined|Value::Json(Json::String(_))){return Value::boolean(false)}
    let mut o=owner.borrow_mut();let text=&mut o.modules.text;
    if !text.declared||!text.initialized{return Value::boolean(false)}
    let next=if text.controlled{text.value.clone()}else{
        canonical_text(&if matches!(value,Value::Undefined){text_or(field(&text.patch,"defaultValue"),"")}else{value.text()},text.multiline)
    };
    let accepted=!text.controlled;
    // A reset is an editing-lease replacement, not an input/change proposal.
    // Old IME handles and queued controlled restoration cannot write through.
    text.lease_epoch=text.lease_epoch.wrapping_add(1);text.value=next;
    text.editor=text.value.clone().into();text.selection=text.editor.len()..text.editor.len();
    text.reversed=false;text.marked=None;text.composing=false;text.drag_anchor=None;text.geometry=None;
    text.undo.clear();text.redo.clear();text.changed=false;text.viewport=Default::default();text.reveal_caret=true;text.a11y=None;
    o.dirty=true;Value::boolean(accepted)
}
pub fn text_detach(owner:&OwnerRef){
    let mut o=owner.borrow_mut();let text=&mut o.modules.text;
    text.lease_epoch=text.lease_epoch.wrapping_add(1);text.composing=false;text.marked=None;text.drag_anchor=None;text.geometry=None;
    text.viewport=Default::default();text.focused=false;text.reveal_caret=true;text.a11y=None;
    project_text_value(text);
}
pub fn text_supported(owner:&OwnerRef)->bool{owner.borrow().modules.text.supported}
pub fn text_disabled(owner:&OwnerRef)->bool{bool_or(field(&owner.borrow().modules.text.patch,"disabled"),false)}
/// Only the current mounted text owner can claim composition keys. A retired
/// view's retained editor is not an IME session in another native view.
pub fn text_is_composing(owner:&OwnerRef)->bool{
    if !ready(owner){return false}let o=owner.borrow();o.modules.text.supported&&o.modules.text.composing
}
fn text_notify_selection_changed(focus:&FocusHandle,window:&mut Window){
    #[cfg(feature="gpui-text-selection-notification")]
    window.notify_text_selection_changed(focus);
    #[cfg(not(feature="gpui-text-selection-notification"))]
    if focus.is_focused(window){
        // The default GPUI profile exposes its focused input handler through
        // the next-frame IME coordinate query. Re-query the accepted selection
        // without invalidating another editor or retaining this editing lease.
        window.invalidate_character_coordinates();
        window.refresh();
    }
}
/// Apply a source-authored UTF-16 selection request to this exact live editor.
/// Selection itself is permitted in readonly text, but cannot disturb a marked
/// range, a disabled owner, another window, or a detached editing lease.
pub fn text_select_utf16(owner:&OwnerRef,start:usize,end:usize,window:&mut Window,cx:&mut App)->bool{
    let selection={let o=owner.borrow();utf16_range(&o.modules.text.editor,start..end.max(start))};
    text_apply_selection(owner,selection,false,window,cx)
}
fn text_apply_selection(owner:&OwnerRef,selection:Range<usize>,reversed:bool,window:&mut Window,cx:&mut App)->bool{
    if !ready(owner)||!text_supported(owner)||text_disabled(owner){return false}
    let focus={let mut o=owner.borrow_mut();
        if o.window_id!=Some(window.window_handle().window_id()){return false}
        let text=&mut o.modules.text;if text.composing{return false}
        text.selection=selection;text.reversed=reversed;
        text.drag_anchor=None;text.reveal_caret=true;o.dirty=true;o.modules.focus.native.clone()
    };
    if let Some(focus)=focus{text_notify_selection_changed(&focus,window);}
    text_drive(owner,window,cx);true
}
pub fn text_accessible(owner:&OwnerRef,node:&mut gpui::accesskit::Node){
    let o=owner.borrow();let text=&o.modules.text;if !text.supported{return}
    node.set_value(text.editor.as_ref());
    if !text.placeholder.is_empty(){node.set_placeholder(text.placeholder.as_ref());}
    if bool_or(field(&text.patch,"required"),false){node.set_required();}
    if bool_or(field(&text.patch,"disabled"),false){node.set_disabled();}
    if bool_or(field(&text.patch,"readOnly"),false){node.set_read_only();}
    if text.multiline&&node.role()==gpui::accesskit::Role::TextInput{node.set_role(gpui::accesskit::Role::MultilineTextInput);}
}
// AccessKit's Text interface requires TextRun descendants. A value on the
// TextInput parent alone is not a text range. Keep one run per canonical LF
// line, including the hard break and an empty final run when needed. This
// projects text/selection; glyph geometry and visual soft-wrap runs are not
// manufactured from logical character positions.
struct TextA11yProjection {
    root:gpui::accesskit::NodeId,window:gpui::WindowId,owner_epoch:u64,lease_epoch:u64,frame:u64,
    hitbox:Option<gpui::HitboxId>,value:gpui::SharedString,
    runs:Vec<(gpui::accesskit::NodeId,Range<usize>)>,
    selection:gpui::accesskit::TextSelection,selectable:bool,
}
impl TextA11yProjection {
    fn position(&self,byte:usize)->gpui::accesskit::TextPosition {
        let byte=byte_boundary(&self.value,byte,false);
        let(_,(id,range))=self.runs.iter().enumerate().find(|(index,(_,range))|byte<range.end||*index+1==self.runs.len()).expect("at least one text run");
        gpui::accesskit::TextPosition{node:*id,character_index:self.value[range.start..byte.max(range.start).min(range.end)].chars().count()}
    }
    fn byte(&self,position:gpui::accesskit::TextPosition)->Option<usize>{
        let(_,range)=self.runs.iter().find(|(id,_)|*id==position.node)?;
        let run=&self.value[range.clone()];
        if position.character_index>run.chars().count(){return None}
        Some(range.start+run.char_indices().nth(position.character_index).map(|(byte,_)|byte).unwrap_or(run.len()))
    }
    fn nodes(&self)->Vec<(gpui::accesskit::NodeId,gpui::accesskit::Node)>{
        self.runs.iter().map(|(id,range)|{
            let value=&self.value[range.clone()];let mut node=gpui::accesskit::Node::new(gpui::accesskit::Role::TextRun);
            node.set_value(value);
            // Native IME/source UTF-16 requests can select Unicode scalar
            // boundaries. AccessKit indices address these UTF-8 lengths, not
            // UTF-16 units or bytes; platform adapters translate their indices.
            node.set_character_lengths(value.chars().map(|ch|ch.len_utf8() as u8).collect::<Vec<_>>());
            (*id,node)
        }).collect()
    }
    fn project_parent(&self,parent:&mut gpui::accesskit::Node){
        parent.set_text_selection(self.selection);
        if self.selectable{parent.add_action(gpui::accesskit::Action::SetTextSelection);}
    }
}
fn text_accessible_projection(owner:&OwnerRef,mut node_id:impl FnMut(u64,usize)->gpui::accesskit::NodeId)->Option<Rc<TextA11yProjection>>{
    let o=owner.borrow();let text=&o.modules.text;
    if o.disposed||!o.present||!text.supported||!text.declared||!text.initialized{return None}
    let root=o.modules.a11y_node?;let window=o.window_id?;
    let mut runs=Vec::new();let mut start=0;
    for line in text.editor.split_inclusive('\n'){
        let end=start+line.len();runs.push((node_id(text.lease_epoch,runs.len()),start..end));start=end;
    }
    if runs.is_empty()||text.editor.ends_with('\n'){runs.push((node_id(text.lease_epoch,runs.len()),start..start));}
    let initial=gpui::accesskit::TextPosition{node:runs[0].0,character_index:0};
    let mut projection=TextA11yProjection{root,window,owner_epoch:o.epoch,lease_epoch:text.lease_epoch,frame:o.modules.a11y_frame,
        hitbox:o.native_hitbox.as_ref().map(|hitbox|hitbox.id),value:text.editor.clone(),runs,
        selection:gpui::accesskit::TextSelection{anchor:initial,focus:initial},
        selectable:!bool_or(field(&text.patch,"disabled"),false)&&!text.composing};
    let start=projection.position(text.selection.start);let end=projection.position(text.selection.end);
    projection.selection=if text.reversed{gpui::accesskit::TextSelection{anchor:end,focus:start}}else{gpui::accesskit::TextSelection{anchor:start,focus:end}};
    Some(Rc::new(projection))
}
pub fn text_accessible_children(owner:&OwnerRef,builder:&mut gpui::A11ySubtreeBuilder){
    let Some(projection)=text_accessible_projection(owner,|lease,index|builder.synthetic_node_id(("proto-ui-text-control",lease,index)))else{return};
    let mut complete=true;for(id,node)in projection.nodes(){complete&=builder.push_child(id,node);}
    if complete{projection.project_parent(builder.parent_node());owner.borrow_mut().modules.text.a11y=Some(projection);}
    else{builder.parent_node().clear_text_selection();owner.borrow_mut().modules.text.a11y=None;}
}
fn text_a11y_current(owner:&OwnerRef,projection:&Rc<TextA11yProjection>,window:&Window)->bool{
    let o=owner.borrow();let text=&o.modules.text;
    !o.disposed&&o.present&&o.epoch==projection.owner_epoch&&text.lease_epoch==projection.lease_epoch
        &&o.window_id==Some(projection.window)&&projection.window==window.window_handle().window_id()
        &&o.modules.a11y_node==Some(projection.root)&&o.modules.a11y_frame==projection.frame&&o.modules.a11y_bindings==1
        &&projection.hitbox.is_some()&&o.native_hitbox.as_ref().map(|hitbox|hitbox.id)==projection.hitbox
        &&text.editor==projection.value&&text.a11y.as_ref().is_some_and(|current|Rc::ptr_eq(current,projection))
}
fn text_accessible_action(owner:&OwnerRef,projection:&Rc<TextA11yProjection>,data:Option<&gpui::accesskit::ActionData>,window:&mut Window,cx:&mut App)->bool{
    if !text_a11y_current(owner,projection,window){return false}
    let Some(gpui::accesskit::ActionData::SetTextSelection(selection))=data else{return false};
    let(Some(anchor),Some(focus))=(projection.byte(selection.anchor),projection.byte(selection.focus))else{return false};
    text_apply_selection(owner,anchor.min(focus)..anchor.max(focus),focus<anchor,window,cx)
}
fn text_bind_accessible_selection(owner:&OwnerRef,window:&mut Window){
    let Some(projection)=owner.borrow().modules.text.a11y.clone()else{return};
    if !projection.selectable||!text_a11y_current(owner,&projection,window){return}
    let owner=Rc::downgrade(owner);
    window.on_a11y_action(projection.root,gpui::accesskit::Action::SetTextSelection,move|data,window,cx|{
        if let Some(owner)=owner.upgrade(){if text_accessible_action(&owner,&projection,data,window,cx){window.prevent_default();}}
    });
}
fn text_editable(owner:&OwnerRef)->bool{
    let o=owner.borrow();let text=&o.modules.text;
    !bool_or(field(&text.patch,"disabled"),false)&&!bool_or(field(&text.patch,"readOnly"),false)
}
fn byte_boundary(text:&str,index:usize,ceil:bool)->usize{
    let mut index=index.min(text.len());while !text.is_char_boundary(index){if ceil{index+=1}else{index-=1}}index
}
fn utf16_byte(text:&str,index:usize,ceil:bool)->usize{
    let mut units=0;for(byte,ch)in text.char_indices(){if units==index{return byte}let next=units+ch.len_utf16();if next>index{return if ceil{byte+ch.len_utf8()}else{byte}}units=next;}text.len()
}
fn byte_utf16(text:&str,index:usize)->usize{text[..byte_boundary(text,index,false)].encode_utf16().count()}
fn utf16_range(text:&str,range:Range<usize>)->Range<usize>{
    let start=utf16_byte(text,range.start,false);let end=if range.is_empty(){start}else{utf16_byte(text,range.end,true).max(start)};start..end
}
fn text_event(owner:&OwnerRef,kind:&str,value:&str,composing:bool,data:Option<&str>,input_type:Option<&str>,window:&mut Window,cx:&mut App){
    let(epoch,controlled,listeners)={let mut o=owner.borrow_mut();let text=&mut o.modules.text;
        text.composing=composing;if !text.controlled&&kind=="input"{text.value=value.to_owned();}
        o.dirty=true;let text=&o.modules.text;(text.lease_epoch,text.controlled,text.listeners.len())};
    let event=record(vec![("type",Value::string(kind)),("value",Value::string(value)),("composing",Value::boolean(composing)),
        ("data",data.map(Value::string).unwrap_or(Value::Json(Json::Null))),("inputType",input_type.map(Value::string).unwrap_or(Value::Json(Json::Null)))]);
    for index in 0..listeners {
        if owner.borrow().disposed||!owner.borrow().mounted||!owner.borrow().present||owner.borrow().modules.text.lease_epoch!=epoch{break}
        let callback=owner.borrow().modules.text.listeners.get(index).filter(|listener|listener.active.get()&&listener.kind==kind).map(|listener|listener.callback.clone());
        if let Some(callback)=callback{if native_host_callback(owner,"text-event",||invoke(owner,"text-event",&callback,vec![capability(&Rc::downgrade(owner)),event.clone()])).is_none(){break}}
    }
    if controlled&&(kind=="input"&&!composing||kind=="compositionend") {
        let weak=Rc::downgrade(owner);window.defer(cx,move|window,cx|{
            if let Some(owner)=weak.upgrade().filter(|owner|{let o=owner.borrow();!o.disposed&&o.mounted&&o.present&&o.modules.text.lease_epoch==epoch}){
                {let mut o=owner.borrow_mut();if !o.modules.text.composing{project_text_value(&mut o.modules.text);}o.dirty=true;}
                text_drive(&owner,window,cx);
            }
        });
    }
}
fn text_drive(owner:&OwnerRef,window:&mut Window,cx:&mut App){let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx)}}
fn remember_text_edit(text:&mut TextModule){text.undo.push(TextEdit{value:text.editor.clone(),selection:text.selection.clone(),reversed:text.reversed});text.redo.clear();}
fn text_insertion(text:&TextModule,range:&Range<usize>,input:&str,marked:bool)->String{
    let mut input=canonical_text(input,text.multiline);
    let limit=field(&text.patch,"maxLength");
    if !marked&&!limit.nullish()&&limit.num()>=0. {
        let retained=text.editor[..range.start].encode_utf16().count()+text.editor[range.end..].encode_utf16().count();
        let available=(limit.num()as usize).saturating_sub(retained);let end=utf16_byte(&input,available,false);input.truncate(end);
    }
    input
}
fn replace_editor(text:&mut TextModule,range:Range<usize>,input:String)->String{
    let mut next=text.editor.to_string();next.replace_range(range.clone(),&input);text.editor=next.into();
    let caret=range.start+input.len();text.selection=caret..caret;text.reversed=false;text.geometry=None;text.changed=true;text.reveal_caret=true;input
}
pub fn text_blur(owner:&OwnerRef,window:&mut Window,cx:&mut App){
    if !text_supported(owner)||owner.borrow().disposed{return}
    let(value,composing,changed)={let mut o=owner.borrow_mut();let text=&mut o.modules.text;
        text.marked=None;text.drag_anchor=None;(text.editor.clone(),text.composing,std::mem::take(&mut text.changed))};
    if composing{text_event(owner,"compositionend",&value,false,None,None,window,cx);}
    if changed&&!owner.borrow().disposed&&owner.borrow().mounted&&owner.borrow().present{text_event(owner,"change",&value,false,None,None,window,cx);}
}
pub struct NativeTextInput {owner:OwnerWeak,epoch:u64}
/// Native consumer evidence can exercise the production InputHandler lease.
/// This does not create an editor, replace a lease, or change authored State.
#[cfg(feature="test-support")]
pub fn native_text_input_for_test(owner:&OwnerRef,window:&Window)->Option<NativeTextInput>{
    if !ready(owner){return None}
    let o=owner.borrow();let text=&o.modules.text;
    if o.window_id!=Some(window.window_handle().window_id())||!text.supported||!text.declared||!text.initialized{return None}
    Some(NativeTextInput{owner:Rc::downgrade(owner),epoch:text.lease_epoch})
}
impl NativeTextInput {
    fn replace(&mut self,range:Option<Range<usize>>,input:&str,input_type:Option<&str>,window:&mut Window,cx:&mut App){
        let Some(owner)=self.live().filter(text_editable)else{return};
        let(value,data,composing)={let mut o=owner.borrow_mut();let text=&mut o.modules.text;
            let range=range.map(|range|utf16_range(&text.editor,range)).or_else(||text.marked.clone()).unwrap_or_else(||text.selection.clone());
            let composing=text.composing;let data=text_insertion(text,&range,input,false);
            if data.is_empty()&&range.is_empty()&&!composing{return}
            if !composing{remember_text_edit(text);}let data=replace_editor(text,range,data);text.marked=None;
            (text.editor.clone(),data,composing)};
        if composing{text_event(&owner,"compositionend",&value,false,Some(&data),None,window,cx);}
        if self.live().is_some(){text_event(&owner,"input",&value,false,if data.is_empty(){None}else{Some(&data)},if composing{Some("insertCompositionText")}else{input_type.or(if data.is_empty(){None}else{Some("insertText")})},window,cx);}
        text_drive(&owner,window,cx);
    }
    fn live(&self)->Option<OwnerRef>{self.owner.upgrade().filter(|owner|{let o=owner.borrow();!o.disposed&&o.mounted&&o.present&&o.modules.text.lease_epoch==self.epoch})}
}
impl gpui::InputHandler for NativeTextInput {
    fn selected_text_range(&mut self,ignore_disabled:bool,_:&mut Window,_:&mut App)->Option<gpui::UTF16Selection>{
        let owner=self.live()?;let o=owner.borrow();let text=&o.modules.text;
        if !ignore_disabled&&bool_or(field(&text.patch,"disabled"),false){return None}
        Some(gpui::UTF16Selection{range:byte_utf16(&text.editor,text.selection.start)..byte_utf16(&text.editor,text.selection.end),reversed:text.reversed})
    }
    fn marked_text_range(&mut self,_:&mut Window,_:&mut App)->Option<Range<usize>>{
        let owner=self.live()?;let o=owner.borrow();let text=&o.modules.text;let range=text.marked.as_ref()?;
        Some(byte_utf16(&text.editor,range.start)..byte_utf16(&text.editor,range.end))
    }
    fn text_for_range(&mut self,range:Range<usize>,adjusted:&mut Option<Range<usize>>,_:&mut Window,_:&mut App)->Option<String>{
        let owner=self.live()?;let o=owner.borrow();let text=&o.modules.text;let range=utf16_range(&text.editor,range);
        *adjusted=Some(byte_utf16(&text.editor,range.start)..byte_utf16(&text.editor,range.end));Some(text.editor[range].to_owned())
    }
    fn replace_text_in_range(&mut self,range:Option<Range<usize>>,input:&str,window:&mut Window,cx:&mut App){
        self.replace(range,input,None,window,cx);
    }
    fn paste(&mut self,item:gpui::ClipboardItem,window:&mut Window,cx:&mut App){
        if let Some(input)=item.text(){self.replace(None,&input,Some("insertFromPaste"),window,cx);}
    }
    fn replace_and_mark_text_in_range(&mut self,range:Option<Range<usize>>,input:&str,selected:Option<Range<usize>>,window:&mut Window,cx:&mut App){
        let Some(owner)=self.live().filter(text_editable)else{return};
        let(value,data,started)={let mut o=owner.borrow_mut();let text=&mut o.modules.text;
            let range=range.map(|range|utf16_range(&text.editor,range)).or_else(||text.marked.clone()).unwrap_or_else(||text.selection.clone());
            let start=range.start;let started=!text.composing;if started{remember_text_edit(text);}
            let data=text_insertion(text,&range,input,true);let data=replace_editor(text,range,data);text.marked=Some(start..start+data.len());
            if let Some(selected)=selected{let selected=utf16_range(&data,selected);text.selection=start+selected.start..start+selected.end;}
            (text.editor.clone(),data,started)};
        if started{text_event(&owner,"compositionstart",&value,true,Some(&data),None,window,cx);}
        if self.live().is_some(){text_event(&owner,"compositionupdate",&value,true,Some(&data),None,window,cx);}
        if self.live().is_some(){text_event(&owner,"input",&value,true,Some(&data),Some("insertCompositionText"),window,cx);}
        text_drive(&owner,window,cx);
    }
    fn unmark_text(&mut self,window:&mut Window,cx:&mut App){
        let Some(owner)=self.live()else{return};let(value,composing,data)={let mut o=owner.borrow_mut();let text=&mut o.modules.text;let data=text.marked.take().map(|range|text.editor[range].to_owned());(text.editor.clone(),text.composing,data)};
        if composing{text_event(&owner,"compositionend",&value,false,data.as_deref(),None,window,cx);text_drive(&owner,window,cx);}
    }
    fn bounds_for_range(&mut self,range:Range<usize>,_:&mut Window,_:&mut App)->Option<Bounds<Pixels>>{
        let owner=self.live()?;let o=owner.borrow();let text=&o.modules.text;let geometry=text.geometry.as_ref()?;
        let range=utf16_range(&text.editor,range);let start=geometry.position(range.start);let end=geometry.position(range.end);
        Some(Bounds::from_corners(start,gpui::point(if start.y==end.y{end.x.max(start.x+gpui::px(1.))}else{geometry.bounds.get().right()},end.y+geometry.line_height)))
    }
    fn character_index_for_point(&mut self,point:gpui::Point<Pixels>,_:&mut Window,_:&mut App)->Option<usize>{
        let owner=self.live()?;let o=owner.borrow();let text=&o.modules.text;Some(byte_utf16(&text.editor,text.geometry.as_ref()?.index(point)))
    }
    fn set_selected_text_range(&mut self,range:Range<usize>,window:&mut Window,cx:&mut App){
        let Some(owner)=self.live()else{return};{let mut o=owner.borrow_mut();let text=&mut o.modules.text;text.selection=utf16_range(&text.editor,range);text.reversed=false;text.reveal_caret=true;o.dirty=true;}text_drive(&owner,window,cx);
    }
    fn element_bounds(&mut self,_:&mut Window,_:&mut App)->Option<Bounds<Pixels>>{let owner=self.live()?;let o=owner.borrow();Some(o.modules.text.geometry.as_ref()?.bounds.get())}
    fn text_length_utf16(&mut self,_:&mut Window,_:&mut App)->Option<usize>{Some(self.live()?.borrow().modules.text.editor.encode_utf16().count())}
    fn accepts_text_input(&mut self,_:&mut Window,_:&mut App)->bool{self.live().is_some_and(|owner|text_editable(&owner))}
    fn prefers_ime_for_printable_keys(&mut self,_:&mut Window,_:&mut App)->bool{true}
    fn text_input_configuration(&mut self,_:&mut Window,_:&mut App)->gpui::TextInputConfiguration{
        let Some(owner)=self.live()else{return gpui::TextInputConfiguration::default()};let o=owner.borrow();let text=&o.modules.text;
        let input_action=match text_or(field(&text.patch,"enterKeyHint"),"").as_str(){
            "enter"=>gpui::TextInputAction::Enter,"done"=>gpui::TextInputAction::Done,"go"=>gpui::TextInputAction::Go,"next"=>gpui::TextInputAction::Next,
            "previous"=>gpui::TextInputAction::Previous,"search"=>gpui::TextInputAction::Search,"send"=>gpui::TextInputAction::Send,_=>gpui::TextInputAction::Unspecified};
        gpui::TextInputConfiguration{input_action,..Default::default()}
    }
}
impl TextGeometry {
    fn content_position(&self,index:usize)->gpui::Point<Pixels>{
        let mut start=0;let mut y=gpui::px(0.);for line in &self.lines{
            if index<=start+line.len(){return line.position_for_index(index.saturating_sub(start),self.line_height).unwrap_or_default()+gpui::point(gpui::px(0.),y)}
            start+=line.len()+1;y+=line.size(self.line_height).height;
        }gpui::point(gpui::px(0.),y)
    }
    fn position(&self,index:usize)->gpui::Point<Pixels>{self.bounds.get().origin+self.content_position(index)-self.viewport.get()}
    fn index(&self,point:gpui::Point<Pixels>)->usize{
        if self.placeholder{return 0}let point=point-self.bounds.get().origin+self.viewport.get();let mut start=0;let mut y=gpui::px(0.);
        for(index,line)in self.lines.iter().enumerate(){let height=line.size(self.line_height).height;
            if point.y<y+height||index+1==self.lines.len(){return start+line.closest_index_for_position(gpui::point(point.x,point.y-y),self.line_height).unwrap_or_else(|index|index)}
            start+=line.len()+1;y+=height;
        }self.text.len()
    }
    fn clamp_viewport(&self,viewport:gpui::Point<Pixels>)->gpui::Point<Pixels>{
        let bounds=self.bounds.get();gpui::point(viewport.x.max(gpui::px(0.)).min((self.content.width+gpui::px(1.)-bounds.size.width).max(gpui::px(0.))),viewport.y.max(gpui::px(0.)).min((self.content.height-bounds.size.height).max(gpui::px(0.))))
    }
}
fn update_text_viewport(text:&mut TextModule,geometry:&Rc<TextGeometry>,bounds:Bounds<Pixels>,focused:bool){
    geometry.bounds.set(bounds);let mut viewport=geometry.clamp_viewport(text.viewport);
    if focused&&(text.reveal_caret||!text.focused){
        let caret=geometry.content_position(if text.reversed{text.selection.start}else{text.selection.end});
        if caret.x<viewport.x{viewport.x=caret.x}else if caret.x+gpui::px(1.)>viewport.x+bounds.size.width{viewport.x=caret.x+gpui::px(1.)-bounds.size.width}
        if caret.y<viewport.y{viewport.y=caret.y}else if caret.y+geometry.line_height>viewport.y+bounds.size.height{viewport.y=caret.y+geometry.line_height-bounds.size.height}
        viewport=geometry.clamp_viewport(viewport);text.reveal_caret=false;
    }
    text.focused=focused;text.viewport=viewport;geometry.viewport.set(viewport);
}
pub struct NativeTextElement {owner:OwnerWeak,focus:FocusHandle,fill_height:bool}
impl NativeTextElement {pub fn new(owner:&OwnerRef,focus:&FocusHandle,fill_height:bool)->Self{Self{owner:Rc::downgrade(owner),focus:focus.clone(),fill_height}}}
#[cfg(not(feature = "gpui-modern-element-api"))]
impl gpui::IntoElement for NativeTextElement {type Element=Self;fn into_element(self)->Self{self}}
impl gpui::Element for NativeTextElement {
    type RequestLayoutState=();type PrepaintState=Rc<TextGeometry>;
    fn id(&self)->Option<gpui::ElementId>{None}
    fn source_location(&self)->Option<&'static std::panic::Location<'static>>{None}
    fn request_layout(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,window:&mut Window,cx:&mut App)->(gpui::LayoutId,()){
        let owner=self.owner.upgrade().expect("live text owner");let o=owner.borrow();let text=&o.modules.text;
        let rows=if text.multiline{let rows=field(&text.patch,"rows");if rows.nullish(){2.}else{rows.num().floor().max(1.)}}else{1.};
        let mut style=gpui::Style::default();style.size.width=gpui::relative(1.).into();style.size.height=if self.fill_height{gpui::relative(1.).into()}else{(window.line_height()*rows as f32).into()};
        (window.request_layout(style,[],cx),())
    }
    fn prepaint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,bounds:Bounds<Pixels>,_:&mut (),window:&mut Window,_:&mut App)->Rc<TextGeometry>{
        let owner=self.owner.upgrade().expect("live text owner");let mut o=owner.borrow_mut();let text=&mut o.modules.text;
        let placeholder=text.editor.is_empty();let display=if placeholder{text.placeholder.clone()}else{text.editor.clone()};
        let style=window.text_style();let font_size=style.font_size.to_pixels(window.rem_size());let line_height=window.line_height();
        let wrap=if text.multiline{Some(bounds.size.width)}else{None};
        if let Some(cache)=text.geometry.clone(){if cache.text==display&&cache.style==style&&cache.font_size==font_size&&cache.line_height==line_height&&cache.wrap==wrap&&cache.marked==text.marked&&cache.placeholder==placeholder{update_text_viewport(text,&cache,bounds,self.focus.is_focused(window));return cache}}
        let run=gpui::TextRun{len:display.len(),font:style.font(),color:if placeholder{gpui::hsla(0.,0.,0.5,0.7)}else{style.color},background_color:None,underline:None,strikethrough:None};
        let mut runs=Vec::with_capacity(if text.marked.is_some(){3}else{1});
        if let Some(marked)=text.marked.as_ref().filter(|_|!placeholder){
            if marked.start>0{runs.push(gpui::TextRun{len:marked.start,..run.clone()});}
            if !marked.is_empty(){runs.push(gpui::TextRun{len:marked.end-marked.start,underline:Some(gpui::UnderlineStyle{color:Some(run.color),thickness:gpui::px(1.),wavy:false}),..run.clone()});}
            if marked.end<display.len(){runs.push(gpui::TextRun{len:display.len()-marked.end,..run});}
        }else{runs.push(run);}
        let lines=window.text_system().shape_text(display.clone(),font_size,&runs,wrap,None).expect("native text shaping").into_vec();
        let content=lines.iter().fold(gpui::size(gpui::px(0.),gpui::px(0.)),|content,line|{let size=line.size(line_height);gpui::size(content.width.max(size.width),content.height+size.height)});
        let geometry=Rc::new(TextGeometry{text:display,style,font_size,line_height,wrap,marked:text.marked.clone(),lines,bounds:Cell::new(bounds),viewport:Cell::new(text.viewport),content,placeholder});
        update_text_viewport(text,&geometry,bounds,self.focus.is_focused(window));
        text.geometry=Some(geometry.clone());geometry
    }
    fn paint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,bounds:Bounds<Pixels>,_:&mut (),geometry:&mut Rc<TextGeometry>,window:&mut Window,cx:&mut App){
        let owner=self.owner.upgrade().expect("live text owner");let(selection,epoch)={let o=owner.borrow();let text=&o.modules.text;(text.selection.clone(),text.lease_epoch)};
        text_bind_accessible_selection(&owner,window);
        window.handle_input(&self.focus,NativeTextInput{owner:self.owner.clone(),epoch},cx);
        let origin=bounds.origin-geometry.viewport.get();
        window.with_content_mask(Some(gpui::ContentMask{bounds}),|window|{
            if self.focus.is_focused(window) {
                if selection.is_empty(){let position=geometry.position(selection.end);window.paint_quad(gpui::fill(Bounds::new(position,gpui::size(gpui::px(1.),geometry.line_height)),geometry.style.color));}
                else{let mut offset=0;let mut y=origin.y;for line in &geometry.lines{
                    let start=selection.start.saturating_sub(offset).min(line.len());let end=selection.end.saturating_sub(offset).min(line.len());
                    if start<end{let mut row_start=start;let mut from=line.position_for_index(start,geometry.line_height).unwrap_or_default();
                        for(byte,_)in line.text.char_indices().filter(|(byte,_)|*byte>start&&*byte<end).chain(std::iter::once((end,'\0'))){
                            let to=line.position_for_index(byte,geometry.line_height).unwrap_or_default();
                            if to.y!=from.y{window.paint_quad(gpui::fill(Bounds::new(gpui::point(origin.x+from.x,y+from.y),gpui::size((bounds.size.width-from.x).max(gpui::px(1.)),geometry.line_height)),gpui::rgba(0x3366cc44)));row_start=byte;from=to;}
                            if byte==end&&row_start<end{window.paint_quad(gpui::fill(Bounds::new(gpui::point(origin.x+from.x,y+from.y),gpui::size((to.x-from.x).max(gpui::px(1.)),geometry.line_height)),gpui::rgba(0x3366cc44)));}
                        }
                    }offset+=line.len()+1;y+=line.size(geometry.line_height).height;
                }}
            }
            let mut y=origin.y;for line in &geometry.lines{line.paint(gpui::point(origin.x,y),geometry.line_height,gpui::TextAlign::Left,None,window,cx).expect("native text paint");y+=line.size(geometry.line_height).height;}
        });
    }
}
pub fn text_scroll(owner:&OwnerRef,event:&gpui::ScrollWheelEvent,window:&mut Window,cx:&mut App)->bool{
    let changed={let mut o=owner.borrow_mut();let text=&mut o.modules.text;
        let Some(geometry)=text.geometry.as_ref()else{return false};
        if !geometry.bounds.get().contains(&event.position)||bool_or(field(&text.patch,"disabled"),false){return false}
        let next=geometry.clamp_viewport(text.viewport-event.delta.pixel_delta(geometry.line_height));
        if next==text.viewport{false}else{text.viewport=next;geometry.viewport.set(next);text.reveal_caret=false;o.dirty=true;true}
    };if changed{text_drive(owner,window,cx);}changed
}
pub fn text_key_down(owner:&OwnerRef,event:&gpui::KeyDownEvent,window:&mut Window,cx:&mut App)->bool{
    text_key_stroke(owner,&event.keystroke,window,cx)
}
// The editing owner consumes only the stable keystroke fields. Platform-added
// KeyDownEvent transport fields do not alter editing policy or test fixtures.
fn text_key_stroke(owner:&OwnerRef,keystroke:&gpui::Keystroke,window:&mut Window,cx:&mut App)->bool{
    if !text_supported(owner)||text_disabled(owner){return false}
    // The platform IME owns candidate navigation, deletion and confirmation.
    // App-level editing must not rewrite the active provisional text.
    if text_is_composing(owner){return true}
    let named=crate::gpui_native_key::named_key(&keystroke.key);let key=named.as_deref().unwrap_or(keystroke.key.as_str());
    let command=keystroke.modifiers.platform||keystroke.modifiers.control;
    if command&&matches!(key,"c"|"C"|"x"|"X"){
        let selection={let o=owner.borrow();let text=&o.modules.text;text.editor[text.selection.clone()].to_owned()};
        if !selection.is_empty(){cx.write_to_clipboard(gpui::ClipboardItem::new_string(selection));if matches!(key,"x"|"X")&&text_editable(owner){let epoch=owner.borrow().modules.text.lease_epoch;NativeTextInput{owner:Rc::downgrade(owner),epoch}.replace(None,"",Some("deleteByCut"),window,cx);}}return true
    }
    if command&&matches!(key,"v"|"V"){
        if let Some(item)=cx.read_from_clipboard(){if let Some(input)=item.text(){let epoch=owner.borrow().modules.text.lease_epoch;NativeTextInput{owner:Rc::downgrade(owner),epoch}.replace(None,&input,Some("insertFromPaste"),window,cx);}}return true
    }
    if command&&matches!(key,"z"|"Z"|"y"|"Y")&&text_editable(owner){
        let redo=keystroke.modifiers.shift||matches!(key,"y"|"Y");let next={let mut o=owner.borrow_mut();let text=&mut o.modules.text;
            let next=if redo{text.redo.pop()}else{text.undo.pop()};if let Some(next)=next{let current=TextEdit{value:text.editor.clone(),selection:text.selection.clone(),reversed:text.reversed};if redo{text.undo.push(current)}else{text.redo.push(current)}text.editor=next.value;text.selection=next.selection;text.reversed=next.reversed;text.marked=None;text.composing=false;text.geometry=None;text.changed=true;text.reveal_caret=true;Some(text.editor.clone())}else{None}};
        if let Some(value)=next{text_event(owner,"input",&value,false,None,Some(if redo{"historyRedo"}else{"historyUndo"}),window,cx);text_drive(owner,window,cx);}return true
    }
    if key=="Enter"{
        if owner.borrow().modules.text.multiline {let epoch=owner.borrow().modules.text.lease_epoch;NativeTextInput{owner:Rc::downgrade(owner),epoch}.replace(None,"\n",Some("insertLineBreak"),window,cx);}
        else{let value={let mut o=owner.borrow_mut();let text=&mut o.modules.text;if std::mem::take(&mut text.changed){Some(text.editor.clone())}else{None}};if let Some(value)=value{text_event(owner,"change",&value,false,None,None,window,cx);text_drive(owner,window,cx);}}return true
    }
    if command&&matches!(key,"a"|"A"){let mut o=owner.borrow_mut();let text=&mut o.modules.text;text.selection=0..text.editor.len();text.reversed=false;text.reveal_caret=true;o.dirty=true;drop(o);text_drive(owner,window,cx);return true}
    if !matches!(key,"ArrowLeft"|"ArrowRight"|"ArrowUp"|"ArrowDown"|"Home"|"End"|"Backspace"|"Delete"){return false}
    let deleting=key=="Backspace"||key=="Delete";if deleting&&!text_editable(owner){return true}
    let range={let mut o=owner.borrow_mut();let text=&mut o.modules.text;
        let caret=if text.reversed{text.selection.start}else{text.selection.end};
        let previous=||text.editor[..caret].grapheme_indices(true).next_back().map(|(i,_)|i).unwrap_or(0);
        let next=||text.editor[caret..].grapheme_indices(true).nth(1).map(|(i,_)|caret+i).unwrap_or(text.editor.len());
        let target=match key{"ArrowLeft"|"Backspace"=>if command{text.editor[..caret].unicode_word_indices().next_back().map(|(i,_)|i).unwrap_or(0)}else{previous()},"ArrowRight"|"Delete"=>if command{text.editor[caret..].unicode_word_indices().next().map(|(i,word)|caret+i+word.len()).unwrap_or(text.editor.len())}else{next()},
            "Home"=>if command{0}else{text.editor[..caret].rfind('\n').map(|i|i+1).unwrap_or(0)},"End"=>if command{text.editor.len()}else{text.editor[caret..].find('\n').map(|i|caret+i).unwrap_or(text.editor.len())},
            "ArrowUp"|"ArrowDown"=>text.geometry.as_ref().map(|geometry|{let position=geometry.position(caret);geometry.index(position+gpui::point(gpui::px(0.),if key=="ArrowUp"{-geometry.line_height}else{geometry.line_height}))}).unwrap_or(caret),_=>caret};
        if deleting{if text.selection.is_empty(){Some(caret.min(target)..caret.max(target))}else{Some(text.selection.clone())}}
        else{let target=if !keystroke.modifiers.shift&&!text.selection.is_empty()&&matches!(key,"ArrowLeft"|"ArrowRight"){if key=="ArrowLeft"{text.selection.start}else{text.selection.end}}else{target};
            let anchor=if keystroke.modifiers.shift{if text.reversed{text.selection.end}else{text.selection.start}}else{target};text.selection=anchor.min(target)..anchor.max(target);text.reversed=target<anchor;text.reveal_caret=true;o.dirty=true;None}
    };
    if let Some(range)=range{let epoch=owner.borrow().modules.text.lease_epoch;let range={let o=owner.borrow();let text=&o.modules.text;byte_utf16(&text.editor,range.start)..byte_utf16(&text.editor,range.end)};NativeTextInput{owner:Rc::downgrade(owner),epoch}.replace(Some(range),"",Some(if key=="Delete"{"deleteContentForward"}else{"deleteContentBackward"}),window,cx);return true}
    text_drive(owner,window,cx);true
}
pub fn text_pointer_down(owner:&OwnerRef,event:&gpui::MouseDownEvent,window:&mut Window,cx:&mut App){
    if !text_supported(owner)||text_disabled(owner)||event.button!=gpui::MouseButton::Left{return}
    {let mut o=owner.borrow_mut();let text=&mut o.modules.text;let Some(geometry)=&text.geometry else{return};let target=geometry.index(event.position);
        let(anchor,target)=if event.click_count>=3{(text.editor[..target].rfind('\n').map(|i|i+1).unwrap_or(0),text.editor[target..].find('\n').map(|i|target+i).unwrap_or(text.editor.len()))}
        else if event.click_count==2{text.editor.unicode_word_indices().find(|(start,word)|target>=*start&&target<=start+word.len()).map(|(start,word)|(start,start+word.len())).unwrap_or((target,target))}
        else{(if event.modifiers.shift{if text.reversed{text.selection.end}else{text.selection.start}}else{target},target)};
        text.selection=anchor.min(target)..anchor.max(target);text.reversed=target<anchor;text.drag_anchor=Some(anchor);text.reveal_caret=true;o.dirty=true;
    }
    note_focus_intent_in(owner,Some(window.window_handle().window_id()));queue_focus(owner,"pointer",false,false);text_drive(owner,window,cx);
}
pub fn text_pointer_move(owner:&OwnerRef,event:&gpui::MouseMoveEvent,window:&mut Window,cx:&mut App){
    if !text_supported(owner){return}let changed={let mut o=owner.borrow_mut();let text=&mut o.modules.text;
        if event.pressed_button!=Some(gpui::MouseButton::Left){text.drag_anchor=None;false}
        else if let(Some(anchor),Some(geometry))=(text.drag_anchor,text.geometry.as_ref()){let target=geometry.index(event.position);text.selection=anchor.min(target)..anchor.max(target);text.reversed=target<anchor;text.reveal_caret=true;o.dirty=true;true}else{false}};
    if changed{text_drive(owner,window,cx);}
}
#[cfg(all(test, feature="test-support"))]
mod text_owner_tests {
    use super::*;
    use gpui::{AppContext, InputHandler, Render, Context, TestAppContext, WindowHandle};

    struct Empty;
    impl Render for Empty {
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{div()}
    }
    fn open(cx:&mut TestAppContext)->WindowHandle<Empty>{
        cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap())
    }
    fn text_owner(window:&Window,value:&str)->OwnerRef{
        text_owner_mode(window,value,false)
    }
    fn text_owner_mode(window:&Window,value:&str,controlled:bool)->OwnerRef{
        let owner=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        let weak=Rc::downgrade(&owner);text_declaration(&weak,false);text_setup(&weak);
        {let mut o=owner.borrow_mut();o.phase="callback";o.mounted=true;o.window_id=Some(window.window_handle().window_id());o.bounds=Some(Bounds::default());}
        text_sync(&weak,record(vec![(if controlled{"value"}else{"defaultValue"},Value::string(value)),("valueMode",Value::string(if controlled{"controlled"}else{"uncontrolled"}))]));owner
    }
    fn input(owner:&OwnerRef)->NativeTextInput{NativeTextInput{owner:Rc::downgrade(owner),epoch:owner.borrow().modules.text.lease_epoch}}

    // These are real AccessKit nodes consumed by the same text-range engine
    // that selects the AT-SPI Text interface. TestAppContext supplies the owner
    // lease; it does not activate a platform accessibility connection.
    fn text_a11y_tree(owner:&OwnerRef)->accesskit_consumer::Tree {
        use gpui::accesskit::{Node,NodeId,Role,Tree,TreeId,TreeUpdate};
        let root=owner.borrow().modules.a11y_node.unwrap_or(NodeId(100));
        owner.borrow_mut().modules.a11y_node=Some(root);
        let mut parent=Node::new(Role::TextInput);text_accessible(owner,&mut parent);
        let projection=text_accessible_projection(owner,|lease,index|NodeId(root.0.wrapping_add(1000+lease*100+index as u64))).unwrap();
        let mut nodes=projection.nodes();parent.set_children(nodes.iter().map(|(id,_)|*id).collect::<Vec<_>>());projection.project_parent(&mut parent);
        owner.borrow_mut().modules.text.a11y=Some(projection);nodes.push((root,parent));
        accesskit_consumer::Tree::new(TreeUpdate{nodes,tree:Some(Tree::new(root)),tree_id:TreeId::ROOT,focus:root},true)
    }
    #[gpui::test]
    fn text_a11y_exposes_the_complete_canonical_text_to_the_consumer(cx:&mut TestAppContext){
        let window=open(cx);window.update(cx,|_,window,_|{
            let owner=text_owner(window,"a😀候e\u{301}");
            let tree=text_a11y_tree(&owner);let node=tree.state().root();
            assert!(node.supports_text_ranges(),"entry role/value alone must not stand in for the platform Text interface");
            assert_eq!(node.document_range().text(),"a😀候e\u{301}");
            assert_eq!(node.document_range().end().to_global_usv_index(),5);
            Owner::dispose(&owner);
        }).unwrap();
    }
    #[gpui::test]
    fn text_a11y_projects_utf16_selection_and_direction(cx:&mut TestAppContext){
        let window=open(cx);window.update(cx,|_,window,cx|{
            let owner=text_owner(window,"a😀候b");
            assert!(text_select_utf16(&owner,1,4,window,cx));
            owner.borrow_mut().modules.text.reversed=true;
            let native=input(&owner).selected_text_range(false,window,cx).unwrap();
            assert_eq!(native.range,1..4);assert!(native.reversed);
            let tree=text_a11y_tree(&owner);let node=tree.state().root();
            assert!(node.has_text_selection(),"the current editing selection must reach AccessKit");
            assert_eq!(node.text_selection().unwrap().text(),"😀候");
            assert_eq!(node.text_selection_anchor().unwrap().to_global_usv_index(),3);
            assert_eq!(node.text_selection_focus().unwrap().to_global_usv_index(),1);
            Owner::dispose(&owner);
        }).unwrap();
    }
    #[gpui::test]
    fn text_a11y_keeps_empty_editors_readable_without_reading_the_placeholder(cx:&mut TestAppContext){
        let window=open(cx);window.update(cx,|_,window,_|{
            let owner=text_owner(window,"");
            text_sync(&Rc::downgrade(&owner),record(vec![("placeholder",Value::string("hint"))]));
            let tree=text_a11y_tree(&owner);let node=tree.state().root();
            assert!(node.supports_text_ranges(),"empty controls need an empty TextRun as well");
            assert_eq!(node.document_range().text(),"");
            assert_eq!(node.text_selection_focus().unwrap().to_global_usv_index(),0);
            Owner::dispose(&owner);
        }).unwrap();
    }

    struct AccessibleField{owner:OwnerRef,focus:FocusHandle}
    impl Render for AccessibleField{
        fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{
            crate::gpui_native_a11y::Semantics{
                element:div().id("native-text-a11y").role(gpui::Role::TextInput).track_focus(&self.focus)
                    .child(NativeTextElement::new(&self.owner,&self.focus,false)).into_element(),
                owner:Rc::downgrade(&self.owner),role:None,
            }
        }
    }
    fn accessible_field(cx:&mut TestAppContext,value:&str)->WindowHandle<AccessibleField>{
        let value=value.to_owned();
        let window=cx.open_window(gpui::size(gpui::px(180.),gpui::px(72.)),move|window,cx|{
            let owner=text_owner(window,&value);let focus=cx.focus_handle();
            owner.borrow_mut().modules.focus.native=Some(focus.clone());window.focus(&focus,cx);
            AccessibleField{owner,focus}
        });
        // The actual Semantics/NativeTextElement draw establishes the current
        // parent node, window, frame and hitbox. The consumer helper supplies
        // the accessibility publication because TestPlatform has no AT channel.
        cx.update_window(window.into(),|_,window,cx|{window.refresh();window.draw(cx).clear(cx);window.simulate_next_frame(cx);}).unwrap();
        window
    }
    fn selection_request(projection:&TextA11yProjection,anchor:usize,focus:usize)->gpui::accesskit::ActionData{
        gpui::accesskit::ActionData::SetTextSelection(gpui::accesskit::TextSelection{anchor:projection.position(anchor),focus:projection.position(focus)})
    }
    #[gpui::test]
    fn text_a11y_preserves_hard_breaks_and_the_empty_last_line(cx:&mut TestAppContext){
        let window=open(cx);window.update(cx,|_,window,cx|{
            let owner=text_owner(window,"");owner.borrow_mut().modules.text.multiline=true;
            assert!(text_reset_value(&Rc::downgrade(&owner),Value::string("a😀\n候e\u{301}\n")).bool());
            assert!(text_select_utf16(&owner,1,7,window,cx));
            let tree=text_a11y_tree(&owner);let node=tree.state().root();
            assert_eq!(node.role(),gpui::Role::MultilineTextInput);
            assert_eq!(node.document_range().text(),"a😀\n候e\u{301}\n");
            assert_eq!(node.text_selection().unwrap().text(),"😀\n候e\u{301}");
            let projection=owner.borrow().modules.text.a11y.clone().unwrap();assert_eq!(projection.runs.len(),3);
            assert_eq!(projection.nodes().last().unwrap().1.value(),Some(""));
            assert!(text_select_utf16(&owner,8,8,window,cx));
            let tree=text_a11y_tree(&owner);let node=tree.state().root();
            assert_eq!(node.text_selection_focus().unwrap().to_global_usv_index(),7);
            assert!(node.text_selection().unwrap().is_degenerate());
            Owner::dispose(&owner);
        }).unwrap();
    }
    #[gpui::test]
    fn text_a11y_selection_round_trips_through_the_live_native_editor(cx:&mut TestAppContext){
        let window=accessible_field(cx,"a😀候b");
        window.update(cx,|field,window,cx|{
            let owner=&field.owner;let _tree=text_a11y_tree(owner);let projection=owner.borrow().modules.text.a11y.clone().unwrap();
            let selection=selection_request(&projection,"a😀候".len(),1);
            assert!(text_accessible_action(owner,&projection,Some(&selection),window,cx));
            let actual=input(owner).selected_text_range(false,window,cx).unwrap();
            assert_eq!(actual.range,1..4);assert!(actual.reversed);
            let tree=text_a11y_tree(owner);let node=tree.state().root();
            assert_eq!(node.text_selection().unwrap().text(),"😀候");
            assert_eq!(node.text_selection_focus().unwrap().to_global_usv_index(),1);
            let projection=owner.borrow().modules.text.a11y.clone().unwrap();
            text_sync(&Rc::downgrade(owner),record(vec![("readOnly",Value::boolean(true))]));
            assert!(text_accessible_action(owner,&projection,Some(&selection),window,cx),"readonly editors remain selectable");
            text_sync(&Rc::downgrade(owner),record(vec![("disabled",Value::boolean(true))]));
            assert!(!text_accessible_action(owner,&projection,Some(&selection),window,cx));
            text_sync(&Rc::downgrade(owner),record(vec![("disabled",Value::boolean(false))]));
            let wrong_node=gpui::accesskit::ActionData::SetTextSelection(gpui::accesskit::TextSelection{
                anchor:gpui::accesskit::TextPosition{node:gpui::accesskit::NodeId(0),character_index:0},focus:projection.selection.focus});
            assert!(!text_accessible_action(owner,&projection,Some(&wrong_node),window,cx));
            let out_of_range=gpui::accesskit::ActionData::SetTextSelection(gpui::accesskit::TextSelection{
                anchor:gpui::accesskit::TextPosition{node:projection.runs[0].0,character_index:999},focus:projection.selection.focus});
            assert!(!text_accessible_action(owner,&projection,Some(&out_of_range),window,cx));
            assert!(!text_accessible_action(owner,&projection,Some(&gpui::accesskit::ActionData::NumericValue(1.)),window,cx));
            Owner::dispose(owner);
        }).unwrap();
    }
    #[gpui::test]
    fn text_a11y_rejects_another_window_composition_and_retired_publications(cx:&mut TestAppContext){
        let window=accessible_field(cx,"a😀候b");let other=open(cx);
        let(owner,projection,selection)=window.update(cx,|field,_,_|{
            let _tree=text_a11y_tree(&field.owner);let projection=field.owner.borrow().modules.text.a11y.clone().unwrap();
            let selection=selection_request(&projection,0,1);(field.owner.clone(),projection,selection)
        }).unwrap();
        other.update(cx,|_,window,cx|{assert!(!text_accessible_action(&owner,&projection,Some(&selection),window,cx));}).unwrap();
        window.update(cx,|_,window,cx|{
            let _tree=text_a11y_tree(&owner);
            assert!(!text_accessible_action(&owner,&projection,Some(&selection),window,cx),"an older publication cannot write after replacement");
            let projection=owner.borrow().modules.text.a11y.clone().unwrap();
            input(&owner).replace_and_mark_text_in_range(Some(0..1),"候",Some(1..1),window,cx);
            let _tree=text_a11y_tree(&owner);let composing=owner.borrow().modules.text.a11y.clone().unwrap();
            let request=selection_request(&composing,0,0);
            assert!(!composing.selectable);assert!(!text_accessible_action(&owner,&composing,Some(&request),window,cx));
            assert!(!text_accessible_action(&owner,&projection,Some(&selection),window,cx),"unpublished text changes invalidate old positions");
            assert!(text_reset_value(&Rc::downgrade(&owner),Value::string("fresh")).bool());
            assert!(!text_accessible_action(&owner,&composing,Some(&request),window,cx),"reset retires the composition's publication");
            let _tree=text_a11y_tree(&owner);let current=owner.borrow().modules.text.a11y.clone().unwrap();
            let request=selection_request(&current,0,1);
            assert!(text_accessible_action(&owner,&current,Some(&request),window,cx));
            detach_native_view(&owner);owner.borrow_mut().mounted=true;
            assert!(!text_accessible_action(&owner,&current,Some(&request),window,cx),"a remount cannot revive an old text publication");
            Owner::dispose(&owner);assert!(!text_accessible_action(&owner,&current,Some(&request),window,cx));
        }).unwrap();
    }

    #[cfg(not(feature="gpui-text-selection-notification"))]
    #[gpui::test]
    fn legacy_selection_notifies_the_live_native_input_and_respects_focus(cx:&mut TestAppContext){
        // Readiness and geometry are supplied by this host fixture. Selection
        // is read from NativeTextInput by GPUI's real deferred IME query.
        struct Probe{input:NativeTextInput,observed:Rc<RefCell<Vec<Range<usize>>>>}
        impl InputHandler for Probe{
            fn text_for_range(&mut self,r:Range<usize>,a:&mut Option<Range<usize>>,w:&mut Window,c:&mut App)->Option<String>{self.input.text_for_range(r,a,w,c)}
            fn selected_text_range(&mut self,disabled:bool,w:&mut Window,c:&mut App)->Option<gpui::UTF16Selection>{
                let selection=self.input.selected_text_range(disabled,w,c)?;self.observed.borrow_mut().push(selection.range.clone());Some(selection)
            }
            fn marked_text_range(&mut self,w:&mut Window,c:&mut App)->Option<Range<usize>>{self.input.marked_text_range(w,c)}
            fn unmark_text(&mut self,w:&mut Window,c:&mut App){self.input.unmark_text(w,c)}
            fn replace_text_in_range(&mut self,r:Option<Range<usize>>,s:&str,w:&mut Window,c:&mut App){self.input.replace_text_in_range(r,s,w,c)}
            fn replace_and_mark_text_in_range(&mut self,r:Option<Range<usize>>,s:&str,n:Option<Range<usize>>,w:&mut Window,c:&mut App){self.input.replace_and_mark_text_in_range(r,s,n,w,c)}
            fn bounds_for_range(&mut self,_:Range<usize>,_:&mut Window,_:&mut App)->Option<Bounds<Pixels>>{Some(Bounds::new(gpui::point(gpui::px(4.),gpui::px(3.)),gpui::size(gpui::px(1.),gpui::px(18.))))}
            fn character_index_for_point(&mut self,p:gpui::Point<Pixels>,w:&mut Window,c:&mut App)->Option<usize>{self.input.character_index_for_point(p,w,c)}
        }
        struct Field{owner:OwnerRef,focus:FocusHandle,observed:Rc<RefCell<Vec<Range<usize>>>>}
        impl Render for Field{
            fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{
                let owner=self.owner.clone();let focus=self.focus.clone();let observed=self.observed.clone();
                div().id("legacy-selection-field").track_focus(&self.focus).child(canvas(|_,_,_|(),move|_,_,window,cx|{
                    window.handle_input(&focus,Probe{input:input(&owner),observed},cx);
                }).size(gpui::px(24.)))
            }
        }
        let window=cx.open_window(gpui::size(gpui::px(96.),gpui::px(48.)),|window,cx|{
            let owner=text_owner(window,"a😀候b");let focus=cx.focus_handle();
            owner.borrow_mut().modules.focus.native=Some(focus.clone());window.focus(&focus,cx);
            Field{owner,focus,observed:Default::default()}
        });
        cx.update_window(window.into(),|_,window,cx|{window.refresh();window.draw(cx).clear(cx);window.simulate_next_frame(cx);}).unwrap();
        window.update(cx,|field,window,cx|{
            field.observed.borrow_mut().clear();
            assert!(text_select_utf16(&field.owner,1,3,window,cx));
            assert!(field.observed.borrow().is_empty(),"legacy notification queries on the frame boundary");
            window.simulate_next_frame(cx);
            assert_eq!(&*field.observed.borrow(),&[1..3],"the platform re-queries the accepted UTF-16 selection");
            let other=cx.focus_handle();window.focus(&other,cx);
            assert!(text_select_utf16(&field.owner,0,1,window,cx));
            window.simulate_next_frame(cx);
            assert_eq!(&*field.observed.borrow(),&[1..3],"an unfocused editor cannot invalidate another input's IME");
            window.focus(&field.focus,cx);
            assert!(text_select_utf16(&field.owner,3,4,window,cx));
            text_detach(&field.owner);
            window.simulate_next_frame(cx);
            assert_eq!(&*field.observed.borrow(),&[1..3],"queued native queries cannot read a retired editing lease");
            Owner::dispose(&field.owner);
        }).unwrap();
    }


    #[gpui::test]
    fn source_selection_snaps_utf16_and_obeys_exact_live_owner(cx:&mut TestAppContext){
        let window=open(cx);let other=open(cx);
        let owner=window.update(cx,|_,window,cx|{
            let owner=text_owner(window,"a😀候b");
            assert!(native_text_input_for_test(&owner,window).is_some());
            assert!(text_select_utf16(&owner,2,3,window,cx));
            assert_eq!(input(&owner).selected_text_range(false,window,cx).unwrap().range,1..3);
            assert!(text_select_utf16(&owner,2,2,window,cx));
            assert_eq!(input(&owner).selected_text_range(false,window,cx).unwrap().range,1..1);
            assert!(text_select_utf16(&owner,999,1000,window,cx));
            assert_eq!(input(&owner).selected_text_range(false,window,cx).unwrap().range,5..5);
            text_sync(&Rc::downgrade(&owner),record(vec![("readOnly",Value::boolean(true))]));
            assert!(text_select_utf16(&owner,0,5,window,cx),"readonly text remains selectable");
            text_sync(&Rc::downgrade(&owner),record(vec![("disabled",Value::boolean(true))]));
            assert!(!text_select_utf16(&owner,0,0,window,cx));
            text_sync(&Rc::downgrade(&owner),record(vec![("disabled",Value::boolean(false))]));
            owner
        }).unwrap();
        other.update(cx,|_,window,cx|{assert!(!text_select_utf16(&owner,0,0,window,cx));assert!(native_text_input_for_test(&owner,window).is_none());}).unwrap();
        window.update(cx,|_,window,cx|{
            owner.borrow_mut().mounted=false;
            assert!(!text_select_utf16(&owner,0,0,window,cx));
            assert!(native_text_input_for_test(&owner,window).is_none());
            owner.borrow_mut().mounted=true;Owner::dispose(&owner);
            assert!(!text_select_utf16(&owner,0,0,window,cx));
            assert!(native_text_input_for_test(&owner,window).is_none());
        }).unwrap();
    }

    #[gpui::test]
    fn composition_keys_cannot_edit_but_live_ime_can_replace(cx:&mut TestAppContext){
        let window=open(cx);
        window.update(cx,|_,window,cx|{
            let owner=text_owner(window,"old");let mut editor=input(&owner);
            editor.replace_and_mark_text_in_range(Some(0..3),"候😀",Some(3..3),window,cx);
            assert!(text_is_composing(&owner));
            let before=owner.borrow().modules.text.editor.clone();
            let selection=editor.selected_text_range(false,window,cx).unwrap().range;
            assert!(!text_select_utf16(&owner,0,0,window,cx));
            for key in ["enter","escape","left","right","home","end","backspace","delete","ctrl-z","ctrl-v"]{
                let key=gpui::Keystroke::parse(key).unwrap();
                assert!(text_key_stroke(&owner,&key,window,cx));
                assert_eq!(owner.borrow().modules.text.editor,before);
                assert_eq!(editor.selected_text_range(false,window,cx).unwrap().range,selection);
                assert!(text_is_composing(&owner));
            }
            editor.replace_text_in_range(None,"选😀",window,cx);
            assert!(!text_is_composing(&owner));
            assert_eq!(text_snapshot(&Rc::downgrade(&owner)).member("value",false).text(),"选😀");
            text_detach(&owner);owner.borrow_mut().mounted=false;
            assert!(!text_is_composing(&owner));
            owner.borrow_mut().mounted=true;
            editor.replace_text_in_range(None,"stale",window,cx);
            assert_eq!(text_snapshot(&Rc::downgrade(&owner)).member("value",false).text(),"选😀","retired IME lease cannot edit a remount");
            Owner::dispose(&owner);
        }).unwrap();
    }

    #[gpui::test]
    fn reset_replaces_editing_lease_and_keeps_controlled_authority(cx:&mut TestAppContext){
        let window=open(cx);
        window.update(cx,|_,window,cx|{
            let owner=text_owner(window,"seed");let mut old=input(&owner);
            old.replace_and_mark_text_in_range(Some(0..4),"候选",Some(2..2),window,cx);
            assert!(text_is_composing(&owner));
            assert!(text_reset_value(&Rc::downgrade(&owner),Value::string("fresh\r\n😀")).bool());
            assert!(!text_is_composing(&owner));
            assert_eq!(text_snapshot(&Rc::downgrade(&owner)).member("value",false).text(),"fresh😀");
            old.replace_text_in_range(None,"stale",window,cx);
            assert_eq!(text_snapshot(&Rc::downgrade(&owner)).member("value",false).text(),"fresh😀");
            let undo=gpui::Keystroke::parse("ctrl-z").unwrap();
            text_key_stroke(&owner,&undo,window,cx);
            assert_eq!(text_snapshot(&Rc::downgrade(&owner)).member("value",false).text(),"fresh😀","reset cannot undo into the retired draft");
            assert!(text_reset_value(&Rc::downgrade(&owner),Value::Undefined).bool());
            assert_eq!(text_snapshot(&Rc::downgrade(&owner)).member("value",false).text(),"seed");

            let controlled=text_owner_mode(window,"truth",true);let mut old_controlled=input(&controlled);
            old_controlled.replace_and_mark_text_in_range(Some(0..5),"candidate",Some(9..9),window,cx);
            assert!(!text_reset_value(&Rc::downgrade(&controlled),Value::string("ignored")).bool());
            assert!(!text_is_composing(&controlled));
            assert_eq!(text_snapshot(&Rc::downgrade(&controlled)).member("value",false).text(),"truth");
            old_controlled.replace_text_in_range(None,"stale",window,cx);
            assert_eq!(controlled.borrow().modules.text.editor.as_ref(),"truth");
            controlled.borrow_mut().mounted=false;
            assert!(!text_reset_value(&Rc::downgrade(&controlled),Value::string("detached")).bool());
            Owner::dispose(&owner);Owner::dispose(&controlled);
        }).unwrap();
    }
}

`;
