// Placement is resolved from the pinned SDK's actual layout and clipping bounds.
export const gpuiNativePositioningSource = String.raw`
#[derive(Clone,Copy,PartialEq)]
struct PositionConfig {
    side:&'static str,align:&'static str,strategy:&'static str,
    side_offset:f32,align_offset:f32,padding:f32,collisions:bool,viewport:bool,exclude_translation:bool,
}
impl PositionConfig {
    fn read(value:&Value)->Self {
        let side=match value.member("side",false).text().as_str(){"top"=>"top","right"=>"right","bottom"=>"bottom","left"=>"left",_=>panic!("invalid anchored side")};
        let align=match value.member("align",false).text().as_str(){"start"=>"start","center"=>"center","end"=>"end",_=>panic!("invalid anchored alignment")};
        let strategy=match value.member("strategy",false).text().as_str(){"absolute"=>"absolute","fixed"=>"fixed",_=>panic!("invalid anchored strategy")};
        let viewport=match value.member("collisionBoundary",false).text().as_str(){"viewport"=>true,"clippingAncestors"=>false,_=>panic!("invalid anchored collision boundary")};
        let finite=|key:&str|{let number=value.member(key,false).num()as f32;assert!(number.is_finite(),"native anchored distance must be finite");number};
        Self{side,align,strategy,side_offset:finite("sideOffset"),align_offset:finite("alignOffset"),padding:finite("collisionPadding"),collisions:value.member("avoidCollisions",false).bool(),viewport,exclude_translation:bool_or(value.member("excludeAnchorTranslation",false),false)}
    }
}
#[derive(Clone,Copy,PartialEq)]
struct PositionGeometry {anchor:Bounds<Pixels>,floating:gpui::Size<Pixels>,clipping:Bounds<Pixels>}
struct PositionConnection {anchor:OwnerWeak,floating:OwnerWeak,config:PositionConfig,callback:Value,generation:u64,requested:bool,geometry:Option<PositionGeometry>}
#[derive(Default)]
pub struct PositioningModule {connection:Option<PositionConnection>,snapshot:Value,generation:u64}
thread_local!{static POSITION_DIRTY:Cell<bool>=Cell::new(false);static POSITION_CONTROLLERS:RefCell<Vec<OwnerWeak>>=RefCell::new(Vec::new());}
fn position_changed(){POSITION_DIRTY.with(|dirty|dirty.set(true));}
pub fn positioning_drive(window:&mut Window){if POSITION_DIRTY.with(|dirty|dirty.replace(false)){window.refresh();}}
pub fn positioning_connect(owner:&OwnerWeak,connection:Value)->Value {
    let owner=ensure(owner);assert!(!matches!(owner.borrow().phase,"render"|"before-dispose"),"positioning binding phase required");
    let anchor=connection.member("anchor",false).owner();let floating=connection.member("floating",false).owner();
    ensure(&anchor);ensure(&floating);let config=PositionConfig::read(&connection.member("config",false));let callback=connection.member("onResolved",false);
    assert!(matches!(callback,Value::Undefined|Value::Function(_)),"anchored resolution requires a callable");
    let weak=Rc::downgrade(&owner);let mut owner=owner.borrow_mut();let position=&mut owner.modules.positioning;
    let registered=position.connection.is_some();
    let same=position.connection.as_ref().is_some_and(|old|Weak::ptr_eq(&old.anchor,&anchor)&&Weak::ptr_eq(&old.floating,&floating));
    position.generation=position.generation.wrapping_add(1);
    if !same{position.snapshot=Value::Json(Json::Null);}
    position.connection=Some(PositionConnection{anchor,floating,config,callback,generation:position.generation,requested:true,geometry:None});
    drop(owner);if !registered{POSITION_CONTROLLERS.with(|controllers|controllers.borrow_mut().push(weak));}position_changed();Value::Undefined
}
pub fn positioning_update(owner:&OwnerWeak,config:Value)->Value {
    let owner=runtime(owner);if owner.borrow().modules.positioning.connection.is_none(){return Value::Undefined}
    let config=PositionConfig::read(&config);let mut owner=owner.borrow_mut();let position=&mut owner.modules.positioning;
    position.generation=position.generation.wrapping_add(1);let generation=position.generation;
    let connection=position.connection.as_mut().expect("connected anchored position");connection.config=config;connection.generation=generation;connection.requested=true;
    drop(owner);position_changed();Value::Undefined
}
pub fn positioning_request(owner:&OwnerWeak)->Value {
    let owner=runtime(owner);if let Some(connection)=owner.borrow_mut().modules.positioning.connection.as_mut(){connection.requested=true;position_changed();}Value::Undefined
}
pub fn positioning_detach(owner:&OwnerRef){let weak=Rc::downgrade(owner);let mut owner=owner.borrow_mut();let position=&mut owner.modules.positioning;let connected=position.connection.take().is_some();position.snapshot=Value::Json(Json::Null);position.generation=position.generation.wrapping_add(1);drop(owner);if connected{POSITION_CONTROLLERS.with(|controllers|controllers.borrow_mut().retain(|controller|!Weak::ptr_eq(controller,&weak)));position_changed();}}
pub fn positioning_disconnect(owner:&OwnerWeak)->Value{let owner=runtime(owner);positioning_detach(&owner);Value::Undefined}
pub fn positioning_snapshot(owner:&OwnerWeak)->Value{let owner=ensure(owner);let value=owner.borrow().modules.positioning.snapshot.clone();if matches!(value,Value::Undefined){Value::Json(Json::Null)}else{value}}
fn position_controller(floating:&OwnerRef)->Option<OwnerRef>{let floating=Rc::downgrade(floating);POSITION_CONTROLLERS.with(|controllers|{let mut controllers=controllers.borrow_mut();controllers.retain(|controller|controller.strong_count()!=0);controllers.iter().rev().filter_map(Weak::upgrade).find(|owner|{let owner=owner.borrow();!owner.disposed&&owner.modules.positioning.connection.as_ref().is_some_and(|connection|Weak::ptr_eq(&connection.floating,&floating))})})}
fn placed_origin(anchor:Bounds<Pixels>,floating:gpui::Size<Pixels>,config:PositionConfig,side:&str,align:&str)->gpui::Point<Pixels>{
    let vertical=side=="top"||side=="bottom";
    let mut origin=gpui::point(anchor.origin.x+(anchor.size.width-floating.width)/2.,anchor.origin.y+(anchor.size.height-floating.height)/2.);
    match side{"top"=>origin.y=anchor.top()-floating.height-gpui::px(config.side_offset),"bottom"=>origin.y=anchor.bottom()+gpui::px(config.side_offset),"left"=>origin.x=anchor.left()-floating.width-gpui::px(config.side_offset),"right"=>origin.x=anchor.right()+gpui::px(config.side_offset),_=>unreachable!()}
    if vertical{if align=="start"{origin.x=anchor.left();}else if align=="end"{origin.x=anchor.right()-floating.width;}origin.x+=gpui::px(config.align_offset);}
    else{if align=="start"{origin.y=anchor.top();}else if align=="end"{origin.y=anchor.bottom()-floating.height;}origin.y+=gpui::px(config.align_offset);}
    origin
}
fn overflow(bounds:Bounds<Pixels>,clipping:Bounds<Pixels>,side:&str,align:&str,reference:gpui::Size<Pixels>)->[f32;3]{
    let top:f32=(clipping.top()-bounds.top()).into();let right:f32=(bounds.right()-clipping.right()).into();let bottom:f32=(bounds.bottom()-clipping.bottom()).into();let left:f32=(clipping.left()-bounds.left()).into();
    let vertical=side=="top"||side=="bottom";
    let primary_end=(align=="start")^if vertical{reference.width>bounds.size.width}else{reference.height>bounds.size.height};
    let(cross,opposite)=if vertical{if primary_end{(right,left)}else{(left,right)}}else if primary_end{(bottom,top)}else{(top,bottom)};
    match side{"top"=>[top,cross,opposite],"bottom"=>[bottom,cross,opposite],"left"=>[left,cross,opposite],"right"=>[right,cross,opposite],_=>unreachable!()}
}
fn resolve_position(geometry:PositionGeometry,config:PositionConfig)->(gpui::Point<Pixels>,&'static str,&'static str){
    let mut side=config.side;let mut align=config.align;let mut origin=placed_origin(geometry.anchor,geometry.floating,config,side,align);
    if !config.collisions{return(origin,side,align)}
    let opposite=match side{"top"=>"bottom","bottom"=>"top","left"=>"right","right"=>"left",_=>unreachable!()};
    let alternate=match align{"start"=>"end","end"=>"start",_=>"center"};
    let candidates=if align=="center"{[(side,align),(opposite,align),(opposite,align),(opposite,align)]}else{[(side,align),(side,alternate),(opposite,align),(opposite,alternate)]};
    let count=if align=="center"{2}else{4};let mut best=f32::INFINITY;let mut main_fit=None;
    for(candidate_side,candidate_align)in candidates.into_iter().take(count) {
        let candidate=placed_origin(geometry.anchor,geometry.floating,config,candidate_side,candidate_align);let values=overflow(Bounds::new(candidate,geometry.floating),geometry.clipping,candidate_side,candidate_align,geometry.anchor.size);
        let score=values.iter().map(|value|value.max(0.)).sum::<f32>();
        if score<best{best=score;origin=candidate;side=candidate_side;align=candidate_align;}
        if values.iter().all(|value|*value<=0.){main_fit=None;break}
        if values[0]<=0.&&main_fit.as_ref().is_none_or(|(primary,_,_,_)|values[1]<*primary){main_fit=Some((values[1],candidate,candidate_side,candidate_align));}
    }
    // flip first prefers a fitting main axis and its primary alignment side;
    // total positive overflow is only the fallback when no main axis fits.
    if let Some((_,candidate,candidate_side,candidate_align))=main_fit{origin=candidate;side=candidate_side;align=candidate_align;}
    // Floating UI shift's default main axis is the axis along the alignment.
    if side=="top"||side=="bottom"{origin.x=origin.x.max(geometry.clipping.left()).min((geometry.clipping.right()-geometry.floating.width).max(geometry.clipping.left()));}
    else{origin.y=origin.y.max(geometry.clipping.top()).min((geometry.clipping.bottom()-geometry.floating.height).max(geometry.clipping.top()));}
    (origin,side,align)
}
struct PositionedRoot {element:AnyElement,owner:OwnerWeak,controller:OwnerWeak}
impl gpui::IntoElement for PositionedRoot{type Element=Self;fn into_element(self)->Self{self}}
impl gpui::Element for PositionedRoot {
    type RequestLayoutState=gpui::LayoutId;type PrepaintState=();
    fn id(&self)->Option<gpui::ElementId>{None}
    fn source_location(&self)->Option<&'static std::panic::Location<'static>>{None}
    fn request_layout(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,window:&mut Window,cx:&mut App)->(gpui::LayoutId,gpui::LayoutId){
        let child=self.element.request_layout(window,cx);let layout=window.request_layout(gpui::Style{position:gpui::Position::Absolute,display:gpui::Display::Flex,..Default::default()},[child],cx);(layout,child)
    }
    fn prepaint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,child:&mut gpui::LayoutId,window:&mut Window,cx:&mut App){
        let Some(controller)=self.controller.upgrade().filter(|owner|!owner.borrow().disposed)else{self.element.prepaint(window,cx);return};
        let Some(floating)=self.owner.upgrade()else{return};
        let Some((anchor,config,generation,callback))=controller.borrow().modules.positioning.connection.as_ref().filter(|connection|Weak::ptr_eq(&connection.floating,&self.owner)).map(|connection|(connection.anchor.clone(),connection.config,connection.generation,connection.callback.clone()))else{self.element.prepaint(window,cx);return};
        let Some(anchor)=anchor.upgrade().filter(ready)else{self.element.prepaint(window,cx);return};
        let mut anchor_bounds=anchor.borrow().bounds.expect("ready native anchor bounds");if config.exclude_translation{anchor_bounds.origin-=anchor.borrow().native_translation;}
        let child_bounds=window.layout_bounds(*child);let viewport=Bounds::new(gpui::Point::default(),window.viewport_size());
        let mut clipping=if config.viewport{viewport}else{window.content_mask().bounds.intersect(&viewport)};
        let padding=gpui::px(config.padding);clipping.origin+=gpui::point(padding,padding);clipping.size.width=(clipping.size.width-padding*2.).max(gpui::px(0.));clipping.size.height=(clipping.size.height-padding*2.).max(gpui::px(0.));
        let geometry=PositionGeometry{anchor:anchor_bounds,floating:child_bounds.size,clipping};let(origin,side,align)=resolve_position(geometry,config);
        window.with_element_offset(origin-child_bounds.origin,|window|self.element.prepaint(window,cx));
        let notify={let mut controller=controller.borrow_mut();let Some(connection)=controller.modules.positioning.connection.as_mut().filter(|connection|connection.generation==generation)else{return};let notify=connection.requested||connection.geometry!=Some(geometry);connection.requested=false;connection.geometry=Some(geometry);notify};
        if notify{let owner=self.controller.clone();let floating=Rc::downgrade(&floating);let anchor=Rc::downgrade(&anchor);let epoch=controller.borrow().epoch;window.defer(cx,move|window,cx|{
            let Some(controller)=owner.upgrade().filter(|owner|ready(owner)&&owner.borrow().epoch==epoch)else{return};
            if !floating.upgrade().is_some_and(|owner|ready(&owner))||!anchor.upgrade().is_some_and(|owner|ready(&owner)){return}
            if !controller.borrow().modules.positioning.connection.as_ref().is_some_and(|connection|connection.generation==generation){return}
            let snapshot=record(vec![("side",Value::string(side)),("align",Value::string(align)),("strategy",Value::string(config.strategy))]);controller.borrow_mut().modules.positioning.snapshot=snapshot.clone();
            if matches!(callback,Value::Function(_)){invoke(&controller,"positioning",&callback,vec![snapshot]);}
            let drive=controller.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx);}
        });}
    }
    fn paint(&mut self,_:Option<&gpui::GlobalElementId>,_:Option<&gpui::InspectorElementId>,_:Bounds<Pixels>,_:&mut gpui::LayoutId,_:&mut (),window:&mut Window,cx:&mut App){self.element.paint(window,cx)}
}
pub fn positioning_root(owner:&OwnerRef,element:AnyElement,source_fixed:bool)->(AnyElement,bool) {
    let Some(controller)=position_controller(owner)else{return(element,source_fixed)};
    let fixed=controller.borrow().modules.positioning.connection.as_ref().is_some_and(|connection|connection.config.strategy=="fixed");
    let element=PositionedRoot{element,owner:Rc::downgrade(owner),controller:Rc::downgrade(&controller)}.into_any_element();
    (if fixed{gpui::deferred(element).into_any_element()}else{element},false)
}
`;
