// Ordinary GPUI image host. Source/status live with the owner; completions carry a view lease.
export const gpuiNativeImageSource = String.raw`
#[derive(Clone)]
struct ImageListener {callback:Value,active:Rc<Cell<bool>>}
#[derive(Clone)]
enum ImageLocation {Resource(gpui::Resource),Inline(std::sync::Arc<gpui::Image>),Invalid(gpui::ImageCacheError)}
pub struct ImageModule {
    pub supported:bool,declared:bool,requested:String,pub source:String,alternative:String,mode:&'static str,
    pub fit:&'static str,pub status:&'static str,generation:u64,lease_epoch:u64,attached:bool,
    last_hosted:Option<u64>,scheduled:Option<(u64,u64)>,location:Option<ImageLocation>,last_diagnostic:String,
    pub rendered:Option<std::sync::Arc<gpui::RenderImage>>,listeners:Vec<ImageListener>,
}
impl Default for ImageModule {fn default()->Self{Self{supported:false,declared:false,requested:String::new(),source:String::new(),alternative:String::new(),mode:"informative",fit:"contain",status:"idle",generation:0,lease_epoch:0,attached:false,last_hosted:None,scheduled:None,location:None,last_diagnostic:String::new(),rendered:None,listeners:Vec::new()}}}
struct InlineImageAsset;
impl gpui::Asset for InlineImageAsset {
    type Source=std::sync::Arc<gpui::Image>;
    type Output=Result<std::sync::Arc<gpui::RenderImage>,gpui::ImageCacheError>;
    fn load(source:Self::Source,cx:&mut App)->impl std::future::Future<Output=Self::Output>+Send+'static{
        let renderer=cx.svg_renderer();async move{source.to_image_data(renderer).map_err(Into::into)}
    }
}
fn image_location(source:&str)->ImageLocation {
    if source.get(..5).is_some_and(|prefix|prefix.eq_ignore_ascii_case("data:")){
        let decoded=(||{
            let data=data_url::DataUrl::process(source).map_err(|error|gpui::ImageCacheError::Asset(error.to_string().into()))?;
            let(bytes,_)=data.decode_to_vec().map_err(|error|gpui::ImageCacheError::Asset(error.to_string().into()))?;
            // Match the pinned GPUI resource loader: content recognition, then real SVG decoding.
            let format=image::guess_format(&bytes).ok().and_then(|format|gpui::ImageFormat::from_mime_type(format.to_mime_type())).unwrap_or(gpui::ImageFormat::Svg);
            Ok(std::sync::Arc::new(gpui::Image::from_bytes(format,bytes)))
        })();return match decoded{Ok(image)=>ImageLocation::Inline(image),Err(error)=>ImageLocation::Invalid(error)}
    }
    if std::path::Path::new(source).is_absolute(){return ImageLocation::Resource(gpui::Resource::Path(std::path::PathBuf::from(source).into()))}
    let gpui::ImageSource::Resource(resource)=gpui::ImageSource::from(source)else{unreachable!()};ImageLocation::Resource(resource)
}
fn image_has_alternative(value:&str)->bool {
    !value.trim_matches(|character|matches!(character,'\u{0009}'..='\u{000d}'|'\u{0020}'|'\u{00a0}'|'\u{1680}'|'\u{2000}'..='\u{200a}'|'\u{2028}'|'\u{2029}'|'\u{202f}'|'\u{205f}'|'\u{3000}'|'\u{feff}')).is_empty()
}
fn image_source_valid(image:&mut ImageModule)->bool {
    if image.requested.is_empty(){image.last_diagnostic.clear();return false}
    let alternative=image_has_alternative(&image.alternative);
    if image.mode=="informative"&&alternative||image.mode=="decorative"&&!alternative{image.last_diagnostic.clear();return true}
    let diagnostic=format!("{}:{}:{}",image.mode,image.requested,image.alternative);
    if diagnostic!=image.last_diagnostic{image.last_diagnostic=diagnostic;eprintln!("[ImageView] rejected contradictory or missing accessibility input; source failed closed to idle.");}
    false
}
fn image_fit(value:Value)->&'static str{match value.text().as_str(){"contain"=>"contain","cover"=>"cover","fill"=>"fill",_=>panic!("invalid ImageView fit")}}
fn image_mode(value:Value)->&'static str{match value.text().as_str(){"informative"=>"informative","decorative"=>"decorative",_=>panic!("invalid ImageView accessibility mode")}}
pub fn image_declaration(owner:&OwnerWeak,config:Value){
    let owner=setup(owner);let mut o=owner.borrow_mut();assert!(!o.modules.text.supported,"one physical Root cannot be both TextControl and ImageView");let image=&mut o.modules.image;
    assert!(!image.supported,"duplicate ImageView declaration");image.supported=true;image.requested=config.member("source",false).text();image.alternative=config.member("alternativeText",false).text();image.mode=image_mode(config.member("a11yMode",false));image.fit=image_fit(config.member("fit",false));
    if image_source_valid(image){image.source=image.requested.clone();image.generation=1;image.status="loading";image.location=Some(image_location(&image.source));}
}
pub fn image_setup(owner:&OwnerWeak)->Value{
    let owner_ref=setup(owner);{let mut o=owner_ref.borrow_mut();let image=&mut o.modules.image;assert!(image.supported,"ImageView requires a static declaration");assert!(!image.declared,"one ImageView per owner");image.declared=true;o.modules.hooks.insert("image-view");}Value::Handle(owner.clone(),"image-view")
}
pub fn image_on(owner:&OwnerWeak,kind:Value,callback:Value)->Value{
    let owner=setup(owner);assert!(kind.text()=="loadingStatusChange","invalid ImageView event");let active=Rc::new(Cell::new(true));owner.borrow_mut().modules.image.listeners.push(ImageListener{callback,active:active.clone()});disposer(owner,active,true)
}
fn image_transition(owner:&OwnerRef,status:&'static str){
    let event={let mut o=owner.borrow_mut();let image=&mut o.modules.image;if image.status==status{return}let previous=image.status;image.status=status;o.dirty=true;let image=&o.modules.image;record(vec![("status",Value::string(status)),("previousStatus",Value::string(previous)),("source",Value::string(&image.source))])};
    let listeners=owner.borrow().modules.image.listeners.len();for index in 0..listeners{
        if owner.borrow().disposed{break}
        let callback=owner.borrow().modules.image.listeners.get(index).filter(|listener|listener.active.get()).map(|listener|listener.callback.clone());
        if let Some(callback)=callback{invoke(owner,"image-event",&callback,vec![capability(&Rc::downgrade(owner)),event.clone()]);}
    }
}
pub fn image_sync(owner:&OwnerWeak,patch:Value)->Value{
    let owner=runtime(owner);assert!(matches!(patch,Value::Record(_)|Value::Json(Json::Object(_))),"ImageView patch required");
    let source=patch.member("source",true);let alternative=patch.member("alternativeText",true);let mode=patch.member("a11yMode",true);let fit=patch.member("fit",true);
    let changed={let mut o=owner.borrow_mut();let image=&mut o.modules.image;assert!(image.declared,"ImageView is not declared");
        if matches!(source,Value::Json(Json::String(_))){image.requested=source.text();}if matches!(alternative,Value::Json(Json::String(_))){image.alternative=alternative.text();}if !mode.nullish(){image.mode=image_mode(mode);}if !fit.nullish(){image.fit=image_fit(fit);}
        let valid=image_source_valid(image);let source=if valid{image.requested.as_str()}else{""};let changed=source!=image.source;
        if changed{image.source=source.to_owned();image.generation=image.generation.wrapping_add(1);image.location=if image.source.is_empty(){None}else{Some(image_location(&image.source))};image.rendered=None;image.scheduled=None;}
        if image.attached{image.last_hosted=Some(image.generation);}o.dirty=true;changed
    };
    // loadingStatus is a module observation, never an authored status override.
    if changed{let status=if owner.borrow().modules.image.source.is_empty(){"idle"}else{"loading"};image_transition(&owner,status);}Value::Undefined
}
pub fn image_snapshot(owner:&OwnerWeak)->Value{
    let owner=ensure(owner);let o=owner.borrow();let image=&o.modules.image;if !image.declared{return Value::Json(Json::Null)}
    record(vec![("source",Value::string(&image.source)),("loadingStatus",Value::string(image.status)),("fit",Value::string(image.fit))])
}
pub fn image_mount(owner:&OwnerRef){
    let reload={let mut o=owner.borrow_mut();let image=&mut o.modules.image;if !image.declared||image.attached{return}image.attached=true;image.lease_epoch=image.lease_epoch.wrapping_add(1);image.scheduled=None;
        let reload=!image.source.is_empty()&&image.last_hosted==Some(image.generation);if reload{image.generation=image.generation.wrapping_add(1);}image.last_hosted=Some(image.generation);o.dirty=true;reload};
    if reload{image_transition(owner,"loading");}
}
pub fn image_detach(owner:&OwnerRef){let mut o=owner.borrow_mut();let image=&mut o.modules.image;image.attached=false;image.lease_epoch=image.lease_epoch.wrapping_add(1);image.scheduled=None;}
pub fn image_supported(owner:&OwnerRef)->bool{owner.borrow().modules.image.supported}
pub fn image_accessible(owner:&OwnerRef,node:&mut gpui::accesskit::Node){
    let o=owner.borrow();let image=&o.modules.image;if !image.supported{return}
    if image.mode=="decorative"{node.clear_label();node.set_hidden();}else{node.set_label(image.alternative.as_str());}
}
fn image_complete(owner:&OwnerWeak,generation:u64,epoch:u64,status:&'static str,window:&mut Window,cx:&mut App){
    let Some(owner)=owner.upgrade().filter(|owner|{let o=owner.borrow();let image=&o.modules.image;!o.disposed&&o.mounted&&o.present&&image.attached&&image.generation==generation&&image.lease_epoch==epoch&&!image.source.is_empty()&&image.status=="loading"})else{return};
    image_transition(&owner,status);let drive=owner.borrow().native_drive.clone();if let Some(drive)=drive{drive(window,cx)}
}
pub fn image_element(owner:&OwnerRef,fill_height:bool)->AnyElement{
    use gpui::StyledImage as _;
    let(location,generation,epoch,fit)={let o=owner.borrow();let image=&o.modules.image;(image.location.clone(),image.generation,image.lease_epoch,image.fit)};
    let Some(location)=location else{return div().into_any_element()};let owner=Rc::downgrade(owner);
    let mut element=gpui::img(move|window:&mut Window,cx:&mut App|{
        let owner_ref=owner.upgrade().filter(|owner|{let o=owner.borrow();let image=&o.modules.image;!o.disposed&&o.mounted&&o.present&&image.attached&&image.generation==generation&&image.lease_epoch==epoch})?;
        let result=match &location{ImageLocation::Resource(resource)=>window.use_asset::<gpui::ImgResourceLoader>(resource,cx),ImageLocation::Inline(image)=>window.use_asset::<InlineImageAsset>(image,cx),ImageLocation::Invalid(error)=>Some(Err(error.clone()))};
        if let Some(result)=&result{
            let schedule={let mut o=owner_ref.borrow_mut();let image=&mut o.modules.image;image.rendered=result.as_ref().ok().cloned();if image.status=="loading"&&image.scheduled!=Some((generation,epoch)){image.scheduled=Some((generation,epoch));true}else{false}};
            if schedule{let owner=owner.clone();let status=if result.is_ok(){"loaded"}else{"error"};window.defer(cx,move|window,cx|image_complete(&owner,generation,epoch,status,window,cx));}
        }result
    }).object_fit(match fit{"contain"=>gpui::ObjectFit::Contain,"cover"=>gpui::ObjectFit::Cover,"fill"=>gpui::ObjectFit::Fill,_=>unreachable!()}).w_full();
    if fill_height{element=element.h_full();}element.into_any_element()
}
`;
