// C-SCROLL-COMPOSED-CHROME-0001 / C-SCROLL-COMPOSED-CONTROL-0001.
// The declaration selects logical parts. GPUI owns physical views, layout,
// paint and Move leases; neither geometry nor resources enter Context data.
export const gpuiNativeScrollChromeSource = String.raw`
#[derive(Clone)]
struct ScrollChromeDeclaration {
    identity:Value,
    scope:NativeContextKey, family:&'static StaticDeclaration,
    scrollbar_role:String, thumb_role:String, orientation_expose:String,
}
#[derive(Clone,Copy,PartialEq,Eq)]
struct ScrollChromeView { epoch:u64,window:gpui::WindowId,serial:u64,generation:u64 }
#[derive(Default)]
struct ScrollChromePhysical {
    serial:u64,generation:u64,observed:bool,
    views:Vec<Weak<ScrollChromeNativeView>>,style:Option<Box<gpui::StyleRefinement>>,
    #[cfg(feature="test-support")]
    painted:Option<Bounds<Pixels>>,
}
// Only an actual retained GPUI element state owns a strong receipt. Cached
// occurrences stay live without another authored render or layout-frame guess.
pub struct ScrollChromeNativeView {
    owner:OwnerWeak,serial:u64,epoch:u64,window:gpui::WindowId,live:Cell<bool>,
    geometry:RefCell<(gpui::Hitbox,Bounds<Pixels>)>,
    app:gpui::AsyncApp,window_handle:gpui::AnyWindowHandle,
}
#[derive(Clone,Copy,PartialEq)]
struct ScrollChromeGeometry { start:f32,available:f32,extent:f32,travel:f32,offset:f32 }
struct ScrollChromeControl {
    source:OwnerWeak,track:OwnerWeak,thumb:OwnerWeak,
    source_view:ScrollChromeView,track_view:ScrollChromeView,thumb_view:ScrollChromeView,
    binding_generation:u64,external_engine:u64,external_expected:bool,
    horizontal:bool,active:Cell<bool>,press:Cell<Option<f32>>,
    geometry:Cell<Option<ScrollChromeGeometry>>,
    movement:RefCell<Option<crate::gpui_native_move::MoveGestureLease>>,
}
impl Drop for ScrollChromeControl {
    fn drop(&mut self){self.active.set(false);self.press.set(None);self.movement.get_mut().take();}
}

pub fn scroll_bind_composed_chrome(owner:&OwnerWeak,binding:Value)->Value {
    let owner=setup(owner);
    if let Some(previous)=owner.borrow().modules.scroll.chrome_declaration.as_ref(){
        assert!(strict_equal(&previous.identity,&binding),"Scroll composed chrome may be bound only once per logical surface");
        return Value::Undefined;
    }
    let declaration=ScrollChromeDeclaration {
        identity:binding.clone(),
        scope:context_identity(binding.member("scope",false)),
        family:declaration(&binding.member("anatomy",false),"anatomy-family"),
        scrollbar_role:binding.member("scrollbarRole",false).text(),
        thumb_role:binding.member("thumbRole",false).text(),
        orientation_expose:binding.member("orientationExpose",false).text(),
    };
    let mut o=owner.borrow_mut();
    o.modules.scroll.chrome_declaration=Some(declaration);
    Value::Undefined
}
fn scroll_projection(scroll:&ScrollModule)->&'static str {
    let required=field(&scroll.config,"requireProjection");
    let preference=if required.nullish(){field(&scroll.config,"projection")}else{required};
    // The pinned GPUI session prefers native system chrome for auto. Explicit
    // composed and required composed keep the same native scrolling engine.
    if !preference.nullish()&&preference.text()=="composed"{"composed"}else{"system"}
}
fn scroll_chrome_scope(owner:&OwnerRef,binding:&ScrollChromeDeclaration)->Option<OwnerRef> {
    let root=anatomy_root(owner,binding.family.identity())?;
    let provider=provider(owner,&binding.scope)?;
    Rc::ptr_eq(&root,&provider).then_some(root)
}
fn scroll_chrome_same_scope(part:&OwnerRef,root:&OwnerRef,binding:&ScrollChromeDeclaration)->bool {
    anatomy_root(part,binding.family.identity()).is_some_and(|candidate|Rc::ptr_eq(&candidate,root))
        &&provider(part,&binding.scope).is_some_and(|candidate|Rc::ptr_eq(&candidate,root))
}
fn scroll_chrome_part_sources(part:&OwnerRef)->Vec<(OwnerRef,ScrollChromeDeclaration)> {
    if part.borrow().modules.topology.claims.is_empty(){return vec![]}
    all_owners().into_iter().filter_map(|source|{
        let binding=source.borrow().modules.scroll.chrome_declaration.clone()?;
        let role=part.borrow().modules.topology.claims.get(&binding.family.identity())?.role.clone();
        if role!=binding.scrollbar_role&&role!=binding.thumb_role{return None}
        let root=scroll_chrome_scope(&source,&binding)?;
        scroll_chrome_same_scope(part,&root,&binding).then_some((source,binding))
    }).collect()
}
pub fn scroll_chrome_observed(owner:&OwnerRef)->bool {
    let o=owner.borrow();
    let observed=o.modules.scroll.chrome_declaration.is_some()||o.modules.scroll.chrome_physical.observed;
    drop(o);observed||!scroll_chrome_part_sources(owner).is_empty()
}
pub(crate) fn scroll_chrome_manages_native_view(owner:&OwnerRef)->bool {scroll_chrome_observed(owner)}
fn scroll_chrome_native_views(owner:&OwnerRef)->Vec<Rc<ScrollChromeNativeView>> {
    let (views,epoch)={let o=owner.borrow();(o.modules.scroll.chrome_physical.views.clone(),
        o.epoch.checked_add(u64::from(!o.mounted)).expect("Scroll view epoch exhausted"))};
    let weak=Rc::downgrade(owner);
    views.into_iter().filter_map(|view|view.upgrade()).filter(|view|{
        view.live.get()&&view.epoch==epoch&&Weak::ptr_eq(&view.owner,&weak)
    }).collect()
}
fn scroll_chrome_native_context_current(view:&ScrollChromeNativeView)->bool {
    if !view.live.get(){return false}
    let Some(owner)=view.owner.upgrade()else{return false};let o=owner.borrow();
    !o.disposed&&!o.disposing&&o.present&&o.epoch.checked_add(u64::from(!o.mounted))==Some(view.epoch)
}
fn scroll_chrome_schedule() {
    let mut scheduled=Vec::new();
    for owner in all_owners(){
        for view in scroll_chrome_native_views(&owner){
            if !scroll_chrome_native_context_current(&view)||scheduled.contains(&view.window){continue}
            scheduled.push(view.window);let context=Rc::downgrade(&view);let window_id=view.window;
            // Element-state Drop has no borrowed App/Window. Use only a weak
            // retained context, then recheck it before acquiring native work.
            view.app.foreground_executor().spawn(async move{
                let Some(view)=context.upgrade().filter(|view|scroll_chrome_native_context_current(view))else{return};
                let mut app=view.app.clone();let handle=view.window_handle;drop(view);
                let _=handle.update(&mut app,move|_,window,cx|{
                    let Some(view)=context.upgrade().filter(|view|scroll_chrome_native_context_current(view))else{return};
                    if window.window_handle().window_id()!=window_id{return}
                    let Some(owner)=view.owner.upgrade()else{return};drop(view);
                    scroll_chrome_frame(&owner,window,cx);
                    for owner in all_owners(){
                        let drive={let o=owner.borrow();if !o.disposed&&!o.disposing&&o.dirty
                            &&o.window_id==Some(window_id)&&o.modules.scroll.chrome_physical.observed{o.native_drive.clone()}else{None}};
                        if let Some(drive)=drive{drive(window,cx);}
                    }
                });
            }).detach();
        }
    }
}
pub fn scroll_chrome_retain_native_view(owner:&OwnerRef,previous:Option<Rc<ScrollChromeNativeView>>,
    hitbox:gpui::Hitbox,bounds:Bounds<Pixels>,window:&Window,cx:&App)->Option<Rc<ScrollChromeNativeView>> {
    let (epoch,alive)={let o=owner.borrow();(o.epoch.checked_add(u64::from(!o.mounted)).expect("Scroll view epoch exhausted"),
        !o.disposed&&!o.disposing&&o.present)};
    if !alive||!scroll_chrome_observed(owner){
        if let Some(previous)=previous{scroll_chrome_release_native_view(&previous);}return None;
    }
    let weak=Rc::downgrade(owner);let window_id=window.window_handle().window_id();
    if let Some(previous)=previous.as_ref(){
        if previous.live.get()&&previous.epoch==epoch&&previous.window==window_id&&Weak::ptr_eq(&previous.owner,&weak){
            let changed=previous.geometry.borrow().1!=bounds;
            *previous.geometry.borrow_mut()=(hitbox,bounds);
            if changed{scroll_chrome_schedule();}
            return Some(previous.clone());
        }
    }
    let serial={let mut o=owner.borrow_mut();let physical=&mut o.modules.scroll.chrome_physical;
        physical.observed=true;physical.views.retain(|view|view.upgrade().is_some_and(|view|view.live.get()));
        physical.serial=physical.serial.checked_add(1).expect("Scroll physical serial exhausted");
        physical.generation=physical.generation.checked_add(1).expect("Scroll physical generation exhausted");physical.serial};
    let view=Rc::new(ScrollChromeNativeView{owner:weak,serial,epoch,window:window_id,live:Cell::new(true),
        geometry:RefCell::new((hitbox,bounds)),app:cx.to_async(),window_handle:window.window_handle()});
    owner.borrow_mut().modules.scroll.chrome_physical.views.push(Rc::downgrade(&view));
    scroll_chrome_invalidate(owner);
    // Retain the successor first: replacement at the same physical occurrence
    // cannot manufacture an unmount before its new receipt is registered.
    if let Some(previous)=previous{scroll_chrome_release_native_view(&previous);}
    scroll_chrome_schedule();Some(view)
}
pub fn scroll_chrome_release_native_view(view:&ScrollChromeNativeView) {
    if !view.live.replace(false){return}
    let Some(owner)=view.owner.upgrade()else{return};
    let current={let o=owner.borrow();!o.disposed&&!o.disposing
        &&o.epoch.checked_add(u64::from(!o.mounted))==Some(view.epoch)};
    if !current{return}
    {let mut o=owner.borrow_mut();let physical=&mut o.modules.scroll.chrome_physical;
        physical.generation=physical.generation.checked_add(1).expect("Scroll physical generation exhausted");}
    scroll_chrome_invalidate(&owner);
    let remaining=scroll_chrome_native_views(&owner);
    if remaining.is_empty(){detach_native_view(&owner);scroll_chrome_schedule();return}
    if remaining.len()==1{
        let survivor=&remaining[0];let(hitbox,bounds)=survivor.geometry.borrow().clone();
        let mut o=owner.borrow_mut();o.window_id=Some(survivor.window);o.native_hitbox=Some(hitbox);o.bounds=Some(bounds);
    }
    // Multiple retained physical occurrences are ambiguous. No last-writer
    // election, and A -> A+B -> A cannot revive the original Move control.
    scroll_chrome_schedule();
}
impl Drop for ScrollChromeNativeView {
    fn drop(&mut self){scroll_chrome_release_native_view(self);}
}
fn scroll_chrome_view(owner:&OwnerRef)->Option<ScrollChromeView> {
    if !ready(owner){return None}
    let mut views=scroll_chrome_native_views(owner);if views.len()!=1{return None}let view=views.pop()?;
    let o=owner.borrow();
    (!o.disposing&&o.epoch==view.epoch&&o.window_id==Some(view.window)).then_some(ScrollChromeView{
        epoch:view.epoch,window:view.window,serial:view.serial,generation:o.modules.scroll.chrome_physical.generation,
    })
}
fn scroll_chrome_axis(track:&OwnerRef,binding:&ScrollChromeDeclaration)->bool {
    let value=track.borrow().exposes.get(&binding.orientation_expose).cloned().unwrap_or_default();
    matches!(resolved(&value),Value::Json(Json::String(value)) if value=="horizontal")
}
fn scroll_chrome_unique_source(source:&OwnerRef,root:&OwnerRef,binding:&ScrollChromeDeclaration)->bool {
    let mut sources=all_owners().into_iter().filter(|candidate|{
        if !ready(candidate){return false}
        let current=candidate.borrow().modules.scroll.chrome_declaration.clone();
        current.is_some_and(|current|current.family.identity()==binding.family.identity()&&current.scope==binding.scope
            &&scroll_chrome_scope(candidate,&current).is_some_and(|candidate_root|Rc::ptr_eq(&candidate_root,root)))
    });
    sources.next().is_some_and(|candidate|Rc::ptr_eq(&candidate,source))&&sources.next().is_none()
}
fn scroll_chrome_current(control:&ScrollChromeControl)->bool {
    if !control.active.get(){return false}
    let(Some(source),Some(track),Some(thumb))=(control.source.upgrade(),control.track.upgrade(),control.thumb.upgrade())else{return false};
    if scroll_chrome_view(&source)!=Some(control.source_view)||scroll_chrome_view(&track)!=Some(control.track_view)
        ||scroll_chrome_view(&thumb)!=Some(control.thumb_view)||!scroll_ready(&source){return false}
    let binding={let o=source.borrow();let scroll=&o.modules.scroll;
        if scroll_projection(scroll)!="composed"||scroll.binding_generation!=control.binding_generation
            ||scroll.external_engine!=control.external_engine||scroll.external_expected!=control.external_expected{return false}
        scroll.chrome_declaration.clone()
    };
    let Some(binding)=binding else{return false};let Some(root)=scroll_chrome_scope(&source,&binding)else{return false};
    scroll_chrome_same_scope(&track,&root,&binding)&&scroll_chrome_same_scope(&thumb,&root,&binding)
        &&descendant(&thumb,&track)&&!Rc::ptr_eq(&thumb,&track)
        &&scroll_chrome_axis(&track,&binding)==control.horizontal&&scroll_chrome_unique_source(&source,&root,&binding)
}
fn scroll_chrome_geometry(control:&ScrollChromeControl,rem:Pixels)->Option<ScrollChromeGeometry> {
    if !scroll_chrome_current(control){return None}
    let source=control.source.upgrade()?;let track=control.track.upgrade()?;let thumb=control.thumb.upgrade()?;
    {let o=thumb.borrow();let style=o.modules.scroll.chrome_physical.style.as_ref()?;
        if style.display==Some(gpui::Display::None)||style.visibility==Some(gpui::Visibility::Hidden){return None}}
    let o=track.borrow();let bounds=o.bounds?;let style=o.modules.scroll.chrome_physical.style.as_ref()?;
    if style.display==Some(gpui::Display::None)||style.visibility==Some(gpui::Visibility::Hidden){return None}
    let (extent,start,pad_before,pad_after,border_before,border_after)=if control.horizontal{
        (bounds.size.width,bounds.origin.x,style.padding.left,style.padding.right,style.border_widths.left,style.border_widths.right)
    }else{
        (bounds.size.height,bounds.origin.y,style.padding.top,style.padding.bottom,style.border_widths.top,style.border_widths.bottom)
    };
    // GPUI resolves native padding against the containing block's width, as its
    // layout engine does. Border and rem values stay in the host coordinate space.
    let padding=|value:Option<gpui::DefiniteLength>|value.map(|value|f32::from(value.to_pixels(bounds.size.width.into(),rem))).unwrap_or(0.).max(0.);
    let border=|value:Option<gpui::AbsoluteLength>|value.map(|value|f32::from(value.to_pixels(rem))).unwrap_or(0.).max(0.);
    let before=padding(pad_before)+border(border_before);let after=padding(pad_after)+border(border_after);
    let available=(f32::from(extent)-before-after).max(0.);drop(o);
    let axes=text_or(field(&source.borrow().modules.scroll.config,"axes"),"both");
    if axes!="both"&&control.horizontal!=(axes=="horizontal"){return None}
    let facts=scroll_axis(&source,control.horizontal);let ratio=facts.member("visibleRatio",false).num()as f32;
    let position=facts.member("position",false).num()as f32;
    if !available.is_finite()||available<=0.||!ratio.is_finite()||ratio>=1.||!position.is_finite(){return None}
    let extent=(available*ratio.clamp(0.,1.)).max(18.).min(available);
    let travel=(available-extent).max(0.);
    if travel<=0.{return None}
    Some(ScrollChromeGeometry{start:f32::from(start)+before,available,extent,travel,offset:travel*position.clamp(0.,1.)})
}
fn scroll_chrome_wake(owner:&OwnerRef,window:&mut Window,cx:&mut App) {
    let drive={let mut o=owner.borrow_mut();o.dirty=true;o.native_drive.clone()};
    if let Some(drive)=drive{drive(window,cx)}else{window.refresh()}
}
fn scroll_chrome_retire(control:&Rc<ScrollChromeControl>) {
    control.active.set(false);control.press.set(None);
    let movement=control.movement.borrow_mut().take();drop(movement);
    if let Some(thumb)=control.thumb.upgrade(){thumb.borrow_mut().dirty=true;}
}
fn scroll_chrome_release_surface(source:&OwnerRef) {
    let controls=std::mem::take(&mut source.borrow_mut().modules.scroll.chrome_controls);
    let changed=!controls.is_empty();
    for control in controls{scroll_chrome_retire(&control);}
    if changed{scroll_chrome_schedule();}
}
fn scroll_chrome_invalidate(owner:&OwnerRef) {
    scroll_chrome_release_surface(owner);
    let weak=Rc::downgrade(owner);
    for source in all_owners(){
        let previous=std::mem::take(&mut source.borrow_mut().modules.scroll.chrome_controls);
        let mut current=Vec::new();
        for control in previous{
            if control.source.ptr_eq(&weak)||control.track.ptr_eq(&weak)||control.thumb.ptr_eq(&weak){scroll_chrome_retire(&control)}else{current.push(control)}
        }
        source.borrow_mut().modules.scroll.chrome_controls=current;
    }
}
fn scroll_chrome_detach(owner:&OwnerRef) {
    if !scroll_chrome_observed(owner){return}
    scroll_chrome_invalidate(owner);
    let views=std::mem::take(&mut owner.borrow_mut().modules.scroll.chrome_physical.views);
    for view in views.into_iter().filter_map(|view|view.upgrade()){view.live.set(false);}
}
fn scroll_chrome_refresh(source:&OwnerRef,window:&mut Window,cx:&mut App) {
    let Some(binding)=source.borrow().modules.scroll.chrome_declaration.clone()else{return};
    let previous=std::mem::take(&mut source.borrow_mut().modules.scroll.chrome_controls);
    let mut remaining=previous;let mut current=Vec::new();
    let source_view=scroll_chrome_view(source);
    let root=scroll_chrome_scope(source,&binding);
    if let(Some(source_view),Some(root))=(source_view,root){
        if scroll_ready(source)&&source_view.window==window.window_handle().window_id()
            &&scroll_projection(&source.borrow().modules.scroll)=="composed"&&scroll_chrome_unique_source(source,&root,&binding){
            for track in anatomy_members(source,binding.family.identity(),Some(&binding.scrollbar_role),false){
                if !scroll_chrome_same_scope(&track,&root,&binding){continue}
                let Some(track_view)=scroll_chrome_view(&track)else{continue};
                let thumb=anatomy_members(source,binding.family.identity(),Some(&binding.thumb_role),false).into_iter()
                    .find(|thumb|!Rc::ptr_eq(thumb,&track)&&descendant(thumb,&track)&&scroll_chrome_same_scope(thumb,&root,&binding));
                let Some(thumb)=thumb else{continue};let Some(thumb_view)=scroll_chrome_view(&thumb)else{continue};
                if track_view.window!=source_view.window||thumb_view.window!=source_view.window{continue}
                let horizontal=scroll_chrome_axis(&track,&binding);
                let (binding_generation,external_engine,external_expected)={let o=source.borrow();let s=&o.modules.scroll;(s.binding_generation,s.external_engine,s.external_expected)};
                let existing=remaining.iter().position(|control|control.source_view==source_view&&control.track_view==track_view
                    &&control.thumb_view==thumb_view&&control.horizontal==horizontal&&control.binding_generation==binding_generation
                    &&control.external_engine==external_engine&&control.external_expected==external_expected);
                let control=if let Some(index)=existing{remaining.remove(index)}else{
                    let control=Rc::new(ScrollChromeControl{source:Rc::downgrade(source),track:Rc::downgrade(&track),thumb:Rc::downgrade(&thumb),
                        source_view,track_view,thumb_view,binding_generation,external_engine,external_expected,horizontal,
                        active:Cell::new(true),press:Cell::new(None),geometry:Cell::new(None),movement:RefCell::new(None)});
                    let movement=crate::gpui_native_move::attach_move_gesture(Rc::downgrade(&thumb),Box::new(ScrollChromeMove{control:Rc::downgrade(&control)}));
                    // A foreign Move owner is a physical acquisition conflict;
                    // do not steal its lease or publish a false active control.
                    if let Ok(movement)=movement{*control.movement.borrow_mut()=Some(movement);}else{control.active.set(false);continue}
                    thumb.borrow_mut().modules.scroll.chrome_paint=Rc::downgrade(&control);
                    scroll_chrome_wake(&thumb,window,cx);control
                };
                let geometry=scroll_chrome_geometry(&control,window.rem_size());
                if control.geometry.replace(geometry)!=geometry{
                    if geometry.is_none(){if let Some(movement)=control.movement.borrow().as_ref(){movement.cancel(crate::gpui_native_move::MoveGestureCancelReason::LostOwnership,window,cx);}}
                    scroll_chrome_wake(&thumb,window,cx);
                }
                current.push(control);
            }
        }
    }
    for control in remaining{let thumb=control.thumb.upgrade();scroll_chrome_retire(&control);if let Some(thumb)=thumb{scroll_chrome_wake(&thumb,window,cx);}}
    source.borrow_mut().modules.scroll.chrome_controls=current;
}
pub fn scroll_chrome_frame(owner:&OwnerRef,window:&mut Window,cx:&mut App) {
    if !scroll_chrome_observed(owner){return}
    for source in all_owners(){if source.borrow().window_id==Some(window.window_handle().window_id()){
        scroll_chrome_refresh(&source,window,cx);
    }}
}
fn scroll_chrome_style(owner:&OwnerRef,style:&mut gpui::StyleRefinement) {
    if !scroll_chrome_observed(owner){return}
    owner.borrow_mut().modules.scroll.chrome_physical.style=Some(Box::new(style.clone()));
    let control=owner.borrow().modules.scroll.chrome_paint.upgrade();
    let Some(control)=control.filter(|control|scroll_chrome_current(control))else{return};
    let Some(geometry)=control.geometry.get()else{return};
    let extent:gpui::Length=gpui::px(geometry.extent).into();
    style.flex_grow=Some(0.);style.flex_shrink=Some(0.);style.flex_basis=Some(gpui::Length::Auto);
    if control.horizontal{style.size.width=Some(extent);style.min_size.width=Some(extent);style.max_size.width=Some(extent);}
    else{style.size.height=Some(extent);style.min_size.height=Some(extent);style.max_size.height=Some(extent);}
}
fn scroll_chrome_owns_position(owner:&OwnerRef)->bool {
    scroll_chrome_part_sources(owner).iter().any(|(_,binding)|owner.borrow().modules.topology.claims[&binding.family.identity()].role==binding.thumb_role)
}
struct ScrollChromeElement{element:AnyElement,owner:OwnerWeak}
#[cfg(not(feature="gpui-modern-element-api"))]
impl gpui::IntoElement for ScrollChromeElement{type Element=Self;fn into_element(self)->Self{self}}
impl gpui::Element for ScrollChromeElement {
    type RequestLayoutState=();type PrepaintState=(bool,Bounds<Pixels>);
    fn id(&self)->Option<gpui::ElementId>{None}
    fn source_location(&self)->Option<&'static std::panic::Location<'static>>{None}
    fn request_layout(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,window:&mut Window,cx:&mut App)->(gpui::LayoutId,()){
        (self.element.request_layout(window,cx),())
    }
    fn prepaint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,bounds:Bounds<Pixels>,_:&mut (),window:&mut Window,cx:&mut App)->Self::PrepaintState {
        let mut hidden=false;let mut offset=gpui::Point::default();
        if let Some(owner)=self.owner.upgrade(){
            let sources=scroll_chrome_part_sources(&owner);
            for(source,binding)in &sources{
                let role=owner.borrow().modules.topology.claims[&binding.family.identity()].role.clone();
                if scroll_projection(&source.borrow().modules.scroll)!="composed"||role==binding.thumb_role{hidden=true;}
            }
            if let Some(control)=owner.borrow().modules.scroll.chrome_paint.upgrade(){
                if let Some(geometry)=scroll_chrome_geometry(&control,window.rem_size()){
                    let measured=f32::from(if control.horizontal{bounds.size.width}else{bounds.size.height});
                    if (measured-geometry.extent).abs()<0.5{
                        let start=if control.horizontal{bounds.origin.x}else{bounds.origin.y};
                        let delta=gpui::px(geometry.start+geometry.offset)-start;
                        if control.horizontal{offset.x=delta}else{offset.y=delta}hidden=false;
                    }
                }
            }
        }
        let mask=hidden.then_some(gpui::ContentMask{bounds:Bounds::default()});
        window.with_content_mask(mask,|window|window.with_element_offset(offset,|window|self.element.prepaint(window,cx)));
        let mut painted=bounds;painted.origin+=offset;(hidden,painted)
    }
    fn paint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut (),prepaint:&mut Self::PrepaintState,window:&mut Window,cx:&mut App){
        let mut hidden=prepaint.0;
        if let Some(owner)=self.owner.upgrade(){
            // A later cached occurrence can be discovered after this one's
            // prepaint. Recheck the physical proof before painting either copy.
            if scroll_chrome_owns_position(&owner){
                hidden|=!owner.borrow().modules.scroll.chrome_paint.upgrade()
                    .is_some_and(|control|scroll_chrome_current(&control));
            }
            #[cfg(feature="test-support")]
            {owner.borrow_mut().modules.scroll.chrome_physical.painted=(!hidden).then_some(prepaint.1);}
        }
        window.with_content_mask(hidden.then_some(gpui::ContentMask{bounds:Bounds::default()}),|window|self.element.paint(window,cx));
    }
}
fn scroll_chrome_root(owner:&OwnerRef,element:AnyElement)->AnyElement {
    if scroll_chrome_part_sources(owner).is_empty(){element}else{ScrollChromeElement{element,owner:Rc::downgrade(owner)}.into_any_element()}
}
struct ScrollChromeMove{control:Weak<ScrollChromeControl>}
impl ScrollChromeMove {
    fn apply(&self,sample:&crate::gpui_native_move::MoveGestureSample,window:&mut Window,cx:&mut App){
        let Some(control)=self.control.upgrade()else{return};let Some(press)=control.press.get()else{return};
        let Some(geometry)=scroll_chrome_geometry(&control,window.rem_size()).filter(|geometry|geometry.travel>0.)else{control.press.set(None);return};
        let Some(thumb)=control.thumb.upgrade()else{return};let Some(bounds)=thumb.borrow().bounds else{return};
        let point=if control.horizontal{f32::from(bounds.origin.x)+sample.position.x as f32}else{f32::from(bounds.origin.y)+sample.position.y as f32};
        let position=((point-geometry.start-press)/geometry.travel).clamp(0.,1.);
        let Some(source)=control.source.upgrade()else{return};
        let outcome=scroll_request(&control.source,record(vec![("kind",Value::string("control-drag")),("axis",Value::string(if control.horizontal{"horizontal"}else{"vertical"})),("position",Value::number(position as f64))]));
        if outcome.member("kind",false).text()=="dispatched"{scroll_chrome_wake(&source,window,cx);window.refresh();}
    }
}
impl crate::gpui_native_move::MoveGestureBinding for ScrollChromeMove {
    fn axis(&self)->crate::gpui_native_move::MoveGestureAxis{if self.control.upgrade().is_some_and(|control|control.horizontal){crate::gpui_native_move::MoveGestureAxis::Horizontal}else{crate::gpui_native_move::MoveGestureAxis::Vertical}}
    fn should_start(&self,_:&crate::gpui_native_move::MoveGestureSample,window:&mut Window,_:&mut App)->bool{
        self.control.upgrade().and_then(|control|scroll_chrome_geometry(&control,window.rem_size())).is_some_and(|geometry|geometry.travel>0.)
    }
    fn on_start(&self,sample:&crate::gpui_native_move::MoveGestureSample,_:&mut Window,_:&mut App){
        if let Some(control)=self.control.upgrade(){control.press.set(Some(if control.horizontal{sample.position.x as f32}else{sample.position.y as f32}));}
    }
    fn on_move(&self,sample:&crate::gpui_native_move::MoveGestureSample,window:&mut Window,cx:&mut App){self.apply(sample,window,cx)}
    fn on_end(&self,sample:&crate::gpui_native_move::MoveGestureSample,window:&mut Window,cx:&mut App){self.apply(sample,window,cx);if let Some(control)=self.control.upgrade(){control.press.set(None);}}
    fn on_cancel(&self,_:crate::gpui_native_move::MoveGestureCancelReason,_:Option<crate::gpui_native_move::MoveGestureCancelContext<'_>>){if let Some(control)=self.control.upgrade(){control.press.set(None);}}
}
#[cfg(feature="test-support")]
pub fn native_scroll_chrome_observation(owner:&OwnerRef)->Json {
    let bindings=scroll_chrome_native_views(owner).len();
    let o=owner.borrow();let s=&o.modules.scroll;
    let painted=s.chrome_physical.painted.map(|bounds|serde_json::json!({
        "x":f32::from(bounds.origin.x),"y":f32::from(bounds.origin.y),
        "width":f32::from(bounds.size.width),"height":f32::from(bounds.size.height),
    }));
    serde_json::json!({"controls":s.chrome_controls.len(),"painted":painted,"physicalBindings":bindings})
}
`;
