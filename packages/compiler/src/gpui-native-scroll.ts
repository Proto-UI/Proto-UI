// GPUI's retained ScrollHandle supplies native viewport geometry and scroll offsets.
export const gpuiNativeScrollSource = String.raw`
/// A retained physical target. Native content keeps using its original handle
/// (including virtual-list item reveal); Proto observes and requests on it.
/// This type is a host API and is never exposed to authored prototype code.
#[derive(Clone)]
pub struct NativeScrollTarget(Rc<NativeScrollTargetState>);
struct NativeScrollTargetState{handle:gpui::ScrollHandle,claim:RefCell<Option<(OwnerWeak,u64)>>}
impl NativeScrollTarget{
    pub fn new(handle:gpui::ScrollHandle)->Self{Self(Rc::new(NativeScrollTargetState{handle,claim:RefCell::new(None)}))}
    pub fn same_target(&self,other:&Self)->bool{Rc::ptr_eq(&self.0,&other.0)}
}
struct NativeScrollBinding{target:NativeScrollTarget,generation:u64,window:gpui::WindowId}
/// Dropping an old lease cannot detach a replacement or write foreign offsets.
pub struct NativeScrollLease{owner:OwnerWeak,generation:u64}
impl NativeScrollLease{
    pub fn is_current(&self)->bool{self.owner.upgrade().is_some_and(|owner|{let o=owner.borrow();!o.disposed&&o.modules.scroll.external.as_ref().is_some_and(|binding|binding.generation==self.generation)})}
    /// Native wheels/touch may be consumed inside a virtualized child. This
    /// reports physical input only; it makes no authored navigation decision.
    pub fn note_input(&self,window:&mut Window)->bool{
        let Some(owner)=self.owner.upgrade()else{return false};
        if !self.is_current()||!scroll_ready(&owner)||owner.borrow().window_id!=Some(window.window_handle().window_id()){return false}
        scroll_input(&owner);window.request_animation_frame();true
    }
}
impl Drop for NativeScrollLease{fn drop(&mut self){if let Some(owner)=self.owner.upgrade(){let current=owner.borrow().modules.scroll.external.as_ref().is_some_and(|binding|binding.generation==self.generation);if current{scroll_release_external(&owner);}}}}
#[derive(Default)]
pub struct ScrollModule{pub config:BTreeMap<String,Value>,pub handle:Option<gpui::ScrollHandle>,pub last_input:Option<std::time::Instant>,pub following:bool,pub pending_end:Option<(bool,u64)>,pub request_status:String,pub previous_max:gpui::Point<Pixels>,external:Option<NativeScrollBinding>,external_expected:bool,binding_generation:u64}
impl ScrollModule{
    fn current_handle(&self)->Option<&gpui::ScrollHandle>{if self.external_expected{self.external.as_ref().map(|binding|&binding.target.0.handle)}else{self.handle.as_ref()}}
    fn handle(&self)->&gpui::ScrollHandle{self.current_handle().expect("ScrollHandle requires a current scroll target")}
    fn builtin_projection(&self)->bool{!self.external_expected}
}
fn scroll_release_external(owner:&OwnerRef){
    let binding={let mut o=owner.borrow_mut();let s=&mut o.modules.scroll;if s.pending_end.take().is_some(){s.request_status="rejected".into();}s.last_input=None;s.previous_max=gpui::Point::default();let binding=s.external.take();o.dirty=true;binding};
    if let Some(binding)=binding{let mut claim=binding.target.0.claim.borrow_mut();if claim.as_ref().is_some_and(|(claimed,generation)|claimed.ptr_eq(&Rc::downgrade(owner))&&*generation==binding.generation){*claim=None;}}
}
/// Attach an existing native surface instead of creating a second scroll box.
/// The caller retains the target identity and lease for the physical view life.
pub fn attach_scroll_surface(owner:&OwnerWeak,target:NativeScrollTarget,window:&Window)->Result<NativeScrollLease,&'static str>{
    let owner=owner.upgrade().ok_or("owner-disposed")?;
    {let o=owner.borrow();if o.disposed{return Err("owner-disposed")}if !o.modules.hooks.contains("scroll"){return Err("not-declared")}}
    let busy=target.0.claim.borrow().as_ref().is_some_and(|(claimed,generation)|claimed.upgrade().is_some_and(|claimed|{let o=claimed.borrow();!o.disposed&&o.modules.scroll.external.as_ref().is_some_and(|binding|binding.generation==*generation)}));
    if busy{return Err("target-already-attached")}
    scroll_release_external(&owner);
    let generation={let mut o=owner.borrow_mut();let s=&mut o.modules.scroll;s.binding_generation=s.binding_generation.checked_add(1).expect("scroll binding generation exhausted");s.external_expected=true;let generation=s.binding_generation;s.external=Some(NativeScrollBinding{target:target.clone(),generation,window:window.window_handle().window_id()});o.dirty=true;generation};
    *target.0.claim.borrow_mut()=Some((Rc::downgrade(&owner),generation));
    Ok(NativeScrollLease{owner:Rc::downgrade(&owner),generation})
}
/// Explicitly restore the compiler root as the physical scroll surface.
pub fn use_builtin_scroll_surface(owner:&OwnerWeak)->Result<(),&'static str>{
    let owner=owner.upgrade().ok_or("owner-disposed")?;
    {let o=owner.borrow();if o.disposed{return Err("owner-disposed")}if !o.modules.hooks.contains("scroll"){return Err("not-declared")}}
    scroll_release_external(&owner);owner.borrow_mut().modules.scroll.external_expected=false;Ok(())
}
pub fn scroll_detach(owner:&OwnerRef){if owner.borrow().modules.scroll.external.is_some(){scroll_release_external(owner);}}
fn scroll_ready(owner:&OwnerRef)->bool{
    if !ready(owner){return false}let o=owner.borrow();let s=&o.modules.scroll;
    if s.external_expected{s.external.as_ref().is_some_and(|binding|Some(binding.window)==o.window_id&&binding.target.0.handle.bounds().size.width>gpui::px(0.)&&binding.target.0.handle.bounds().size.height>gpui::px(0.))}else{s.handle.is_some()}
}
pub fn scroll_setup(owner:&OwnerWeak)->Value{let result=module_handle(owner,"scroll");setup(owner).borrow_mut().modules.scroll.handle.get_or_insert_with(gpui::ScrollHandle::default);result}
pub fn scroll_configure(owner:&OwnerWeak,patch:Value)->Value{let owner=setup(owner);let required=patch.member("requireProjection",false);assert!(required.nullish()||required.text()=="system","GPUI system ScrollHandle has no composed-chrome projection");let end=patch.member("endFollow",false);let mut o=owner.borrow_mut();if !end.nullish(){o.modules.scroll.following=text_or(end.member("mode",false),"off")=="while-at-end";}merge_config(&mut o.modules.scroll.config,patch);Value::Undefined}
pub fn scroll_sync(owner:&OwnerWeak,patch:Value)->Value{
    let owner=runtime(owner);let axes=patch.member("axes",true);if axes.nullish(){return Value::Undefined}
    let axes=axes.text();assert!(matches!(axes.as_str(),"horizontal"|"vertical"|"both"),"invalid scroll axes");
    let mut o=owner.borrow_mut();let s=&mut o.modules.scroll;if text_or(field(&s.config,"axes"),"both")==axes{return Value::Undefined}
    s.config.insert("axes".into(),Value::string(&axes));
    if s.pending_end.is_some_and(|(horizontal,_)|axes!="both"&&horizontal!=(axes=="horizontal")){s.pending_end=None;s.request_status="rejected".into();}
    o.dirty=true;Value::Undefined
}
fn scroll_axis(owner:&OwnerRef,horizontal:bool)->Value{let o=owner.borrow();let scroll=&o.modules.scroll;let (offset,max,bounds)=scroll.current_handle().map(|handle|(handle.offset(),handle.max_offset(),handle.bounds())).unwrap_or_default();let extent=f64::from(f32::from(if horizontal{max.x}else{max.y})).max(0.);let size=f64::from(f32::from(if horizontal{bounds.size.width}else{bounds.size.height}));let offset=-f64::from(f32::from(if horizontal{offset.x}else{offset.y}));record(vec![("position",Value::number(if extent>0.{(offset/extent).clamp(0.,1.)}else{0.})),("visibleRatio",Value::number(if size+extent>0.{(size/(size+extent)).clamp(0.,1.)}else{1.})),("canScrollBefore",Value::boolean(offset>0.5)),("canScrollAfter",Value::boolean(extent-offset>0.5)),("atEnd",Value::boolean(extent-offset<=1.))])}
pub fn scroll_snapshot(owner:&OwnerWeak)->Value{let owner=ensure(owner);let (axes,scrolling,state,status)={let o=owner.borrow();let s=&o.modules.scroll;let follow=field(&s.config,"endFollow");let enabled=!follow.nullish()&&text_or(follow.member("mode",false),"off")=="while-at-end";(text_or(field(&s.config,"axes"),"both"),s.last_input.is_some_and(|time|time.elapsed()<std::time::Duration::from_millis(120)),if !enabled{"off"}else if !o.mounted{"pending"}else if s.following{"following"}else{"paused"},if s.request_status.is_empty(){"idle".into()}else{s.request_status.clone()})};record(vec![("axes",Value::string(&axes)),("horizontal",scroll_axis(&owner,true)),("vertical",scroll_axis(&owner,false)),("scrolling",Value::boolean(scrolling)),("projection",Value::string(if scroll_ready(&owner){"system"}else{"unresolved"})),("endFollow",record(vec![("state",Value::string(state)),("requestStatus",Value::string(&status))]))])}
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
    if !scroll_ready(&owner){
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
    if axes!="both"&&axes!=axis||s.current_handle().is_none(){
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
    if owner.borrow().modules.scroll.current_handle().is_none(){return}
    {let o=owner.borrow();if o.modules.scroll.external.as_ref().is_some_and(|binding|binding.window!=window.window_handle().window_id()||Some(binding.window)!=o.window_id){return}}
    let mut o=owner.borrow_mut();
    let epoch=o.epoch;
    let s=&mut o.modules.scroll;
    let max=s.handle().max_offset();
    let follow=field(&s.config,"endFollow");
    let configured=!follow.nullish()&&text_or(follow.member("mode",false),"off")=="while-at-end";
    let axis=if configured{text_or(follow.member("axis",false),"vertical")}else{"vertical".into()};
    let axes=text_or(field(&s.config,"axes"),"both");
    let mut end=None;
    let mut retired_end=false;
    if let Some((horizontal,requested_epoch))=s.pending_end.take(){
        if requested_epoch==epoch&&(axes=="both"||horizontal==(axes=="horizontal")){end=Some(horizontal)}else{s.request_status="rejected".into();retired_end=true;}
    }
    // Retirement discards this frame's growth observation; updating previous_max
    // below consumes it rather than deferring old-view movement to a later frame.
    // Axis sync suspends this projection without rewriting authored follow
    // policy. Consume unavailable-axis growth so re-enabling cannot replay it.
    if !retired_end&&end.is_none()&&configured&&(axes=="both"||axes==axis)&&s.following&&max!=s.previous_max{end=Some(axis=="horizontal");}
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
