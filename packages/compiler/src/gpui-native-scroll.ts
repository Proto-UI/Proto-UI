// GPUI's retained ScrollHandle supplies native viewport geometry and scroll offsets.
export const gpuiNativeScrollSource = String.raw`
#[derive(Clone,Copy)]
struct NativeScrollObservation{
    epoch:u64,
    offset:gpui::Point<Pixels>,
    max:gpui::Point<Pixels>,
    viewport:gpui::Size<Pixels>,
}
#[derive(Default)]
pub struct ScrollModule{
    pub external_engine:u64,
    pub next_engine:u64,
    pub config:BTreeMap<String,Value>,
    pub handle:Option<gpui::ScrollHandle>,
    pub last_input:Option<std::time::Instant>,
    pub following:bool,
    pub pending_end:Option<(bool,u64)>,
    pub request_status:String,
    pub previous_max:gpui::Point<Pixels>,
    explicit_pause_epoch:Option<u64>,
    observation:Option<NativeScrollObservation>,
    reader_input:Option<NativeScrollObservation>,
}
impl ScrollModule{fn handle(&self)->&gpui::ScrollHandle{self.handle.as_ref().expect("ScrollHandle requires reached scroll setup")}}
fn scroll_observation(scroll:&ScrollModule,epoch:u64)->NativeScrollObservation{
    let handle=scroll.handle();
    NativeScrollObservation{epoch,offset:handle.offset(),max:handle.max_offset(),viewport:handle.bounds().size}
}
/// The host engine remains attached to its actual viewport (including virtual
/// lists). This lease gives the declared Proto ScrollSurface that exact engine;
/// the compiler root must not also track it as a second viewport.
pub struct ScrollEngineLease{owner:OwnerWeak,id:u64,fallback:gpui::ScrollHandle}
pub fn attach_scroll_engine(target:OwnerWeak,handle:gpui::ScrollHandle)->Result<ScrollEngineLease,String>{
    let owner=target.upgrade().ok_or("scroll target is no longer available")?;
    let mut o=owner.try_borrow_mut().map_err(|_|"scroll target is currently borrowed")?;
    if o.disposed||o.disposing{return Err("scroll target is disposed".into())}
    if !o.modules.hooks.contains("scroll"){return Err("scroll target did not declare ScrollSurface".into())}
    let epoch=o.epoch;
    let s=&mut o.modules.scroll;
    if s.external_engine!=0{return Err("scroll target already has an external engine".into())}
    let fallback=s.handle.as_ref().ok_or("scroll target has no initialized engine")?.clone();
    let id=s.next_engine.checked_add(1).ok_or("scroll engine generation exhausted")?;
    s.next_engine=id;s.external_engine=id;
    if s.pending_end.take().is_some(){s.request_status="rejected".into();}
    s.previous_max=handle.max_offset();s.last_input=None;
    let axis=text_or(field(&s.config,"endFollow").member("axis",true),"vertical");
    let (offset,max)=(handle.offset(),handle.max_offset());
    s.following=s.explicit_pause_epoch!=Some(epoch)&&if axis=="horizontal"{f32::from(offset.x+max.x)<=1.}else{f32::from(offset.y+max.y)<=1.};
    s.handle=Some(handle);s.reader_input=None;s.observation=Some(scroll_observation(s,epoch));
    o.dirty=true;o.update_requested=true;
    Ok(ScrollEngineLease{owner:target,id,fallback})
}
impl ScrollEngineLease{
    pub fn is_attached(&self)->bool{self.owner.upgrade().is_some_and(|owner|{let o=owner.borrow();!o.disposed&&!o.disposing&&o.modules.scroll.external_engine==self.id})}
    /// Report physical input after it reaches this engine, never copy offsets
    /// into a second ScrollHandle or invent a portable scroll event.
    pub fn notify_input(&self,window:&mut Window,cx:&mut App)->bool{
        let Some(owner)=self.owner.upgrade()else{return false};
        if !ready(&owner)||owner.borrow().modules.scroll.external_engine!=self.id||owner.borrow().window_id!=Some(window.window_handle().window_id()){return false}
        if !scroll_external_input(&owner,window){return false}let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx)}window.refresh();true
    }
    pub fn dispose(&self){
        let Some(owner)=self.owner.upgrade()else{return};let mut o=owner.borrow_mut();
        if o.modules.scroll.external_engine!=self.id{return}
        let epoch=o.epoch;
        let s=&mut o.modules.scroll;s.external_engine=0;s.handle=Some(self.fallback.clone());
        if s.pending_end.take().is_some(){s.request_status="rejected".into();}
        s.previous_max=self.fallback.max_offset();s.last_input=None;s.following=false;
        s.reader_input=None;s.observation=Some(scroll_observation(s,epoch));
        o.dirty=true;o.update_requested=true;
    }
}
impl Drop for ScrollEngineLease{fn drop(&mut self){self.dispose()}}

pub fn scroll_setup(owner:&OwnerWeak)->Value{let result=module_handle(owner,"scroll");setup(owner).borrow_mut().modules.scroll.handle.get_or_insert_with(gpui::ScrollHandle::default);result}
pub fn scroll_configure(owner:&OwnerWeak,patch:Value)->Value{let owner=setup(owner);let required=patch.member("requireProjection",false);assert!(required.nullish()||required.text()=="system","GPUI system ScrollHandle has no composed-chrome projection");let end=patch.member("endFollow",false);let mut o=owner.borrow_mut();if !end.nullish(){o.modules.scroll.following=text_or(end.member("mode",false),"off")=="while-at-end";}merge_config(&mut o.modules.scroll.config,patch);Value::Undefined}
fn scroll_axis(owner:&OwnerRef,horizontal:bool)->Value{let o=owner.borrow();let scroll=&o.modules.scroll;let offset=scroll.handle().offset();let max=scroll.handle().max_offset();let bounds=scroll.handle().bounds();let extent=f64::from(f32::from(if horizontal{max.x}else{max.y})).max(0.);let size=f64::from(f32::from(if horizontal{bounds.size.width}else{bounds.size.height}));let offset=-f64::from(f32::from(if horizontal{offset.x}else{offset.y}));record(vec![("position",Value::number(if extent>0.{(offset/extent).clamp(0.,1.)}else{0.})),("visibleRatio",Value::number(if size+extent>0.{(size/(size+extent)).clamp(0.,1.)}else{1.})),("canScrollBefore",Value::boolean(offset>0.5)),("canScrollAfter",Value::boolean(extent-offset>0.5)),("atEnd",Value::boolean(extent-offset<=1.))])}
pub fn scroll_snapshot(owner:&OwnerWeak)->Value{let owner=ensure(owner);let (axes,scrolling,state,status)={let o=owner.borrow();let s=&o.modules.scroll;let follow=field(&s.config,"endFollow");let enabled=!follow.nullish()&&text_or(follow.member("mode",false),"off")=="while-at-end";(text_or(field(&s.config,"axes"),"both"),s.last_input.is_some_and(|time|time.elapsed()<std::time::Duration::from_millis(120)),if !enabled{"off"}else if !o.mounted{"pending"}else if s.following{"following"}else{"paused"},if s.request_status.is_empty(){"idle".into()}else{s.request_status.clone()})};record(vec![("axes",Value::string(&axes)),("horizontal",scroll_axis(&owner,true)),("vertical",scroll_axis(&owner,false)),("scrolling",Value::boolean(scrolling)),("projection",Value::string(if ready(&owner){"system"}else{"unresolved"})),("endFollow",record(vec![("state",Value::string(state)),("requestStatus",Value::string(&status))]))])}
fn scroll_rejected(reason:&str)->Value{record(vec![("kind",Value::string("rejected")),("reason",Value::string(reason))])}
pub fn scroll_pause_following(owner:&OwnerWeak)->Value{
    let owner=runtime(owner);
    let mut o=owner.borrow_mut();
    if !o.modules.hooks.contains("scroll"){return scroll_rejected("not-declared")}
    if !o.mounted{return scroll_rejected("not-mounted")}
    if o.disposed||!o.present||o.bounds.is_none(){return scroll_rejected("unavailable")}
    let epoch=o.epoch;
    let s=&mut o.modules.scroll;
    let policy=field(&s.config,"endFollow");
    if policy.nullish(){return scroll_rejected("unavailable")}
    let axis=text_or(policy.member("axis",false),"vertical");
    let axes=text_or(field(&s.config,"axes"),"both");
    if policy.nullish()||text_or(policy.member("mode",false),"off")!="while-at-end"||s.handle.is_none()||axes!="both"&&axes!=axis{return scroll_rejected("unavailable")}
    if s.pending_end.take().is_some(){s.request_status="rejected".into();}
    s.explicit_pause_epoch=Some(epoch);
    s.reader_input=None;
    s.observation=Some(scroll_observation(s,epoch));
    s.following=false;
    o.dirty=true;
    record(vec![("kind",Value::string("dispatched"))])
}
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
    let follow=field(&s.config,"endFollow");
    let follows_axis=!follow.nullish()&&text_or(follow.member("mode",false),"off")=="while-at-end"&&text_or(follow.member("axis",false),"vertical")==axis;
    if kind=="to-end"{
        if follows_axis{s.reader_input=None;}
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
        if follows_axis{
            // A semantic position request is not a reader-input credential.
            s.reader_input=None;
            s.following=s.explicit_pause_epoch!=Some(epoch)&&max-next<=1.;
        }
        s.observation=Some(scroll_observation(s,epoch));
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
    if o.disposed||!o.present||o.window_id!=Some(window.window_handle().window_id()){return}
    let epoch=o.epoch;
    let s=&mut o.modules.scroll;
    let max=s.handle().max_offset();
    let follow=field(&s.config,"endFollow");
    let configured=!follow.nullish()&&text_or(follow.member("mode",false),"off")=="while-at-end";
    let axis=if configured{text_or(follow.member("axis",false),"vertical")}else{"vertical".into()};
    if s.explicit_pause_epoch.is_some_and(|paused_epoch|paused_epoch!=epoch){s.explicit_pause_epoch=None;}
    // The native wheel callback runs after raw offset mutation. GPUI parent
    // prepaint clamps that offset before this canvas observation. Consume one
    // current-epoch input mark only against stable followed-axis geometry.
    let current=scroll_observation(s,epoch);
    if let Some(before)=s.reader_input.take(){
        if configured&&before.epoch==epoch{
            let horizontal=axis=="horizontal";
            let (old_offset,new_offset,old_max,new_max,old_view,new_view)=if horizontal{
                (before.offset.x,current.offset.x,before.max.x,current.max.x,before.viewport.width,current.viewport.width)
            }else{
                (before.offset.y,current.offset.y,before.max.y,current.max.y,before.viewport.height,current.viewport.height)
            };
            if old_max==new_max&&old_view==new_view&&old_offset!=new_offset{
                s.following=f32::from(new_max+new_offset)<=1.;
                if s.following{
                    s.explicit_pause_epoch=None;
                }else if s.pending_end.is_some_and(|(pending_horizontal,pending_epoch)|pending_horizontal==horizontal&&pending_epoch==epoch){
                    s.pending_end=None;
                    s.request_status="rejected".into();
                }
            }
        }
    }
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
        if configured&&horizontal==(axis=="horizontal"){
            s.following=true;
            s.explicit_pause_epoch=None;
            s.reader_input=None;
        }
        window.request_animation_frame();
    }
    s.previous_max=max;
    s.observation=Some(scroll_observation(s,epoch));
    if s.last_input.is_some_and(|time|time.elapsed()<std::time::Duration::from_millis(120)){window.request_animation_frame();}else{s.last_input=None;}
}
// A bound physical engine reports input after applying it. Preserve the
// followed-axis displacement check instead of treating input alone as a pause.
fn scroll_external_input(owner:&OwnerRef,window:&Window)->bool{
    let mut o=owner.borrow_mut();
    if o.disposed||!o.mounted||!o.present||o.bounds.is_none()||o.window_id!=Some(window.window_handle().window_id())||!o.modules.hooks.contains("scroll"){return false}
    let epoch=o.epoch;
    let s=&mut o.modules.scroll;
    if s.handle.is_none()||s.external_engine==0{return false}
    s.last_input=Some(std::time::Instant::now());
    let follow=field(&s.config,"endFollow");
    if !follow.nullish()&&text_or(follow.member("mode",false),"off")=="while-at-end"&&s.reader_input.is_none(){
        s.reader_input=s.observation.filter(|before|before.epoch==epoch);
    }
    o.dirty=true;
    true
}
pub fn scroll_input(owner:&OwnerRef,event:&gpui::ScrollWheelEvent,window:&Window,epoch:u64)->bool{
    let mut o=owner.borrow_mut();
    if o.disposed||!o.mounted||!o.present||o.bounds.is_none()||o.epoch!=epoch||o.window_id!=Some(window.window_handle().window_id())||!o.modules.hooks.contains("scroll"){return false}
    let s=&mut o.modules.scroll;
    if s.handle.is_none(){return false}
    s.last_input=Some(std::time::Instant::now());
    let follow=field(&s.config,"endFollow");
    if !follow.nullish()&&text_or(follow.member("mode",false),"off")=="while-at-end"{
        let horizontal=text_or(follow.member("axis",false),"vertical")=="horizontal";
        let axes=text_or(field(&s.config,"axes"),"both");
        let (x,y)=match event.delta{
            gpui::ScrollDelta::Pixels(delta)=>(delta.x!=gpui::px(0.),delta.y!=gpui::px(0.)),
            gpui::ScrollDelta::Lines(delta)=>(delta.x!=0.,delta.y!=0.),
        };
        // A single-axis GPUI surface may route the other wheel dimension into
        // its sole scrollable axis. Actual applied motion is still required.
        let on_axis=if horizontal{x||axes=="horizontal"&&y}else{y||axes=="vertical"&&x};
        if on_axis&&s.reader_input.is_none(){
            s.reader_input=s.observation.filter(|before|before.epoch==epoch);
        }
    }
    o.dirty=true;
    true
}

#[cfg(all(test,feature="test-support"))]
mod scroll_engine_tests {
    use super::*;
    fn owner()->OwnerRef{Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary())}
    struct Empty;
    impl gpui::Render for Empty {fn render(&mut self,_:&mut Window,_:&mut gpui::Context<Self>)->impl IntoElement{gpui::div()}}
    #[gpui::test]
    fn bound_engine_notifies_input_from_the_native_event_loop(cx:&mut gpui::TestAppContext){
        use gpui::AppContext;
        let window=cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap());
        window.update(cx,|_,window,cx|{
            let owner=owner();scroll_setup(&Rc::downgrade(&owner));
            let lease=attach_scroll_engine(Rc::downgrade(&owner),gpui::ScrollHandle::new()).unwrap();
            // Inject the already-committed mount facts: this fixture targets
            // event-loop scheduling, while consumer tests mount the real view.
            {let mut o=owner.borrow_mut();o.phase="callback";o.mounted=true;o.bounds=Some(gpui::Bounds::new(gpui::point(gpui::px(0.),gpui::px(0.)),gpui::size(gpui::px(100.),gpui::px(100.))));o.window_id=Some(window.window_handle().window_id());}
            assert!(ready(&owner));
            assert!(lease.notify_input(window,cx));assert!(owner.borrow().dirty);
            lease.dispose();assert!(!lease.notify_input(window,cx));Owner::dispose(&owner);
        }).unwrap();
    }
    #[test]
    fn explicit_engine_lease_binds_one_handle_and_retires_queued_requests(){
        let owner=owner();scroll_setup(&Rc::downgrade(&owner));
        let fallback=owner.borrow().modules.scroll.handle().clone();fallback.set_offset(gpui::point(gpui::px(0.),gpui::px(-7.)));
        let engine=gpui::ScrollHandle::new();let first=attach_scroll_engine(Rc::downgrade(&owner),engine.clone()).unwrap();
        assert!(first.is_attached());assert!(attach_scroll_engine(Rc::downgrade(&owner),gpui::ScrollHandle::new()).is_err());
        engine.set_offset(gpui::point(gpui::px(0.),gpui::px(-32.)));
        assert_eq!(owner.borrow().modules.scroll.handle().offset(),engine.offset(),"exact engine, not mirrored offsets");
        owner.borrow_mut().modules.scroll.pending_end=Some((false,0));first.dispose();
        assert!(!first.is_attached());assert_eq!(owner.borrow().modules.scroll.handle().offset(),fallback.offset());
        assert_eq!(owner.borrow().modules.scroll.request_status,"rejected");assert!(owner.borrow().modules.scroll.pending_end.is_none());
        let second=attach_scroll_engine(Rc::downgrade(&owner),engine).unwrap();drop(first);
        assert!(second.is_attached(),"retired lease cannot detach the new binding");drop(second);assert_eq!(owner.borrow().modules.scroll.external_engine,0);
        Owner::dispose(&owner);assert!(attach_scroll_engine(Rc::downgrade(&owner),gpui::ScrollHandle::new()).is_err());
    }
    #[test]
    fn missing_source_declaration_cannot_gain_scroll_semantics_from_binding(){
        let owner=owner();assert!(attach_scroll_engine(Rc::downgrade(&owner),gpui::ScrollHandle::new()).is_err());Owner::dispose(&owner);
    }
}
`;
