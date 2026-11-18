// GPUI's retained ScrollHandle supplies native viewport geometry and scroll offsets.
export const gpuiNativeScrollSource = String.raw`
#[derive(Default)]
pub struct ScrollModule{pub config:BTreeMap<String,Value>,pub handle:Option<gpui::ScrollHandle>,pub last_input:Option<std::time::Instant>,pub following:bool,pub pending_end:Option<(bool,u64)>,pub request_status:String,pub previous_max:gpui::Point<Pixels>}
impl ScrollModule{fn handle(&self)->&gpui::ScrollHandle{self.handle.as_ref().expect("ScrollHandle requires reached scroll setup")}}
pub fn scroll_setup(owner:&OwnerWeak)->Value{let result=module_handle(owner,"scroll");setup(owner).borrow_mut().modules.scroll.handle.get_or_insert_with(gpui::ScrollHandle::default);result}
pub fn scroll_configure(owner:&OwnerWeak,patch:Value)->Value{let owner=setup(owner);let required=patch.member("requireProjection",false);assert!(required.nullish()||required.text()=="system","GPUI system ScrollHandle has no composed-chrome projection");let end=patch.member("endFollow",false);let mut o=owner.borrow_mut();if !end.nullish(){o.modules.scroll.following=text_or(end.member("mode",false),"off")=="while-at-end";}merge_config(&mut o.modules.scroll.config,patch);Value::Undefined}
fn scroll_axis(owner:&OwnerRef,horizontal:bool)->Value{let o=owner.borrow();let scroll=&o.modules.scroll;let offset=scroll.handle().offset();let max=scroll.handle().max_offset();let bounds=scroll.handle().bounds();let extent=f64::from(f32::from(if horizontal{max.x}else{max.y})).max(0.);let size=f64::from(f32::from(if horizontal{bounds.size.width}else{bounds.size.height}));let offset=-f64::from(f32::from(if horizontal{offset.x}else{offset.y}));record(vec![("position",Value::number(if extent>0.{(offset/extent).clamp(0.,1.)}else{0.})),("visibleRatio",Value::number(if size+extent>0.{(size/(size+extent)).clamp(0.,1.)}else{1.})),("canScrollBefore",Value::boolean(offset>0.5)),("canScrollAfter",Value::boolean(extent-offset>0.5)),("atEnd",Value::boolean(extent-offset<=1.))])}
pub fn scroll_snapshot(owner:&OwnerWeak)->Value{let owner=ensure(owner);let (axes,scrolling,state,status)={let o=owner.borrow();let s=&o.modules.scroll;let follow=field(&s.config,"endFollow");let enabled=!follow.nullish()&&text_or(follow.member("mode",false),"off")=="while-at-end";(text_or(field(&s.config,"axes"),"both"),s.last_input.is_some_and(|time|time.elapsed()<std::time::Duration::from_millis(120)),if !enabled{"off"}else if !o.mounted{"pending"}else if s.following{"following"}else{"paused"},if s.request_status.is_empty(){"idle".into()}else{s.request_status.clone()})};record(vec![("axes",Value::string(&axes)),("horizontal",scroll_axis(&owner,true)),("vertical",scroll_axis(&owner,false)),("scrolling",Value::boolean(scrolling)),("projection",Value::string(if ready(&owner){"system"}else{"unresolved"})),("endFollow",record(vec![("state",Value::string(state)),("requestStatus",Value::string(&status))]))])}
fn scroll_rejected(reason:&str)->Value{record(vec![("kind",Value::string("rejected")),("reason",Value::string(reason))])}
pub fn scroll_request(owner:&OwnerWeak,request:Value)->Value{
    let owner=runtime(owner);
    {
        let o=owner.borrow();
        if !o.modules.hooks.contains("scroll"){return scroll_rejected("not-declared")}
    }
    // Refusal paths inspect only a literal kind, without coercion or property errors.
    let to_end=match &request{
        Value::Record(record)=>record.fields.try_borrow().is_ok_and(|fields|matches!(fields.get("kind"),Some(Value::Json(Json::String(kind))) if kind=="to-end")),
        Value::Json(Json::Object(fields))=>fields.get("kind").and_then(Json::as_str)==Some("to-end"),
        _=>false,
    };
    {
        let mut o=owner.borrow_mut();
        if !o.mounted{
            if to_end{o.modules.scroll.request_status="rejected".into();}
            return scroll_rejected("not-mounted")
        }
    }
    if !ready(&owner){
        if to_end{owner.borrow_mut().modules.scroll.request_status="rejected".into();}
        return scroll_rejected("unavailable")
    }
    let axis=request.member("axis",false).text();
    assert!(axis=="horizontal"||axis=="vertical","invalid scroll axis");
    let horizontal=axis=="horizontal";
    let kind=request.member("kind",false).text();
    let mut o=owner.borrow_mut();
    let epoch=o.epoch;
    let s=&mut o.modules.scroll;
    let axes=text_or(field(&s.config,"axes"),"both");
    if axes!="both"&&axes!=axis||s.handle.is_none(){
        if kind=="to-end"{s.request_status="rejected".into();}
        return scroll_rejected("unavailable")
    }
    if kind=="to-end"{
        s.pending_end=Some((horizontal,epoch));
        s.request_status="pending".into();
    }else{
        let mut offset=s.handle().offset();
        let max=s.handle().max_offset();
        let bounds=s.handle().bounds();
        let max=f32::from(if horizontal{max.x}else{max.y}).max(0.);
        let current=-f32::from(if horizontal{offset.x}else{offset.y});
        let next=match kind.as_str(){
            "by"=>current+request.member("delta",false).num()as f32,
            "to"|"control-drag"=>request.member("position",false).num()as f32*max,
            "page"=>{
                let direction=request.member("direction",false).text();
                assert!(direction=="before"||direction=="after","invalid scroll page direction");
                current+if direction=="before"{-1.}else{1.}*f32::from(if horizontal{bounds.size.width}else{bounds.size.height})
            },
            _=>panic!("invalid native scroll request")
        }.clamp(0.,max);
        if horizontal{offset.x=gpui::px(-next)}else{offset.y=gpui::px(-next)}
        s.handle().set_offset(offset);
        s.following=max-next<=1.;
    }
    o.dirty=true;
    // Dispatch is delivery to this native engine, including its layout-ready
    // end movement. Queued is reserved for synchronous host attachment.
    record(vec![("kind",Value::string("dispatched"))])
}
pub fn scroll_frame(owner:&OwnerRef,window:&mut Window){
    let enabled=owner.borrow().modules.hooks.contains("scroll");
    if !enabled{return}
    let mut o=owner.borrow_mut();
    let epoch=o.epoch;
    let s=&mut o.modules.scroll;
    let max=s.handle().max_offset();
    let follow=field(&s.config,"endFollow");
    let configured=!follow.nullish()&&text_or(follow.member("mode",false),"off")=="while-at-end";
    let axis=if configured{text_or(follow.member("axis",false),"vertical")}else{"vertical".into()};
    let mut end=None;
    let mut retired_end=false;
    if let Some((horizontal,requested_epoch))=s.pending_end.take(){
        if requested_epoch==epoch{end=Some(horizontal)}else{s.request_status="rejected".into();retired_end=true;}
    }
    // Retirement discards this frame's growth observation; updating previous_max
    // below consumes it rather than deferring old-view movement to a later frame.
    if !retired_end&&end.is_none()&&configured&&s.following&&max!=s.previous_max{end=Some(axis=="horizontal");}
    if let Some(horizontal)=end{
        let mut offset=s.handle().offset();
        if horizontal{offset.x=-max.x}else{offset.y=-max.y}
        s.handle().set_offset(offset);
        s.request_status="applied".into();
        s.following=true;
        window.request_animation_frame();
    }
    s.previous_max=max;
    if s.last_input.is_some_and(|time|time.elapsed()<std::time::Duration::from_millis(120)){window.request_animation_frame();}else{s.last_input=None;}
}
pub fn scroll_input(owner:&OwnerRef){let mut o=owner.borrow_mut();o.modules.scroll.last_input=Some(std::time::Instant::now());o.modules.scroll.following=false;o.dirty=true;}
`;
