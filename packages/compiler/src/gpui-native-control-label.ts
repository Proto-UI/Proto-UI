// Shared native ownership for the explicitly admitted ControlLabel slice.
// This is emitted ordinary Rust, not a serialized protocol or component switch.
export const gpuiNativeControlLabelSource = String.raw`
#[derive(Clone)]
pub struct ControlLabelRef(Rc<ControlLabelGroup>);
struct ControlLabelGroup {
    participants: RefCell<Vec<OwnerWeak>>,
    revision: Cell<u64>,
}
impl ControlLabelRef {
    pub fn new() -> Self {
        Self(Rc::new(ControlLabelGroup { participants: RefCell::new(Vec::new()), revision: Cell::new(0) }))
    }
    fn same(&self, other: &Self) -> bool { Rc::ptr_eq(&self.0, &other.0) }
    fn advance(&self) { self.0.revision.set(self.0.revision.get().checked_add(1).expect("ControlLabel lease overflow")); }
}
impl Default for ControlLabelRef { fn default() -> Self { Self::new() } }
impl std::fmt::Debug for ControlLabelRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str("ControlLabelRef(..)") }
}
#[derive(Clone, Default)]
pub struct InstanceAssociations { pub control_label: Option<ControlLabelRef> }

#[derive(Clone, Copy, PartialEq, Eq)]
enum ControlLabelKind { Label, Target }
pub struct ControlLabelModule {
    association: Option<ControlLabelRef>,
    kind: Option<ControlLabelKind>,
    callback: Value,
    naming: bool,
    activation: bool,
    generation: u64,
    view: Option<ControlLabelView>,
    pointer: Option<ControlLabelPointer>,
    opaque_pointer_origin: bool,
    diagnostics: Vec<&'static str>,
    last_diagnostic: Option<&'static str>,
}
impl Default for ControlLabelModule {
    fn default() -> Self {
        Self { association: None, kind: None, callback: Value::Undefined, naming: true, activation: false,
            generation: 0, view: None, pointer: None, opaque_pointer_origin: false, diagnostics: Vec::new(), last_diagnostic: None }
    }
}
#[derive(Clone, Copy, PartialEq, Eq)]
struct ControlLabelView {
    window: gpui::WindowId,
    node: gpui::accesskit::NodeId,
    epoch: u64,
    generation: u64,
}
pub struct ControlLabelRequest {
    reference: ControlLabelRef,
    revision: u64,
    label: OwnerWeak,
    target: OwnerWeak,
    label_view: ControlLabelView,
    target_view: ControlLabelView,
    source: &'static str,
}
struct ControlLabelPointer {
    request: Rc<ControlLabelRequest>,
    origin: gpui::Point<Pixels>,
    released: bool,
}
fn control_label_diagnostic(owner: &OwnerRef, message: &'static str) {
    let mut owner = owner.borrow_mut();
    let state = &mut owner.modules.control_label;
    if state.last_diagnostic != Some(message) {
        state.last_diagnostic = Some(message);
        state.diagnostics.push(message);
        eprintln!("[Proto-UI:ControlLabel] {message}");
    }
}
pub fn take_control_label_diagnostics(owner: &OwnerRef) -> Vec<&'static str> {
    std::mem::take(&mut owner.borrow_mut().modules.control_label.diagnostics)
}
fn control_label_members(reference: &ControlLabelRef) -> Vec<OwnerRef> {
    let participants = {
        let mut participants = reference.0.participants.borrow_mut();
        participants.retain(|owner| owner.strong_count() > 0);
        participants.clone()
    };
    participants.into_iter().filter_map(|owner| owner.upgrade()).filter(|owner| {
        owner.borrow().modules.control_label.association.as_ref().is_some_and(|current| current.same(reference))
    }).collect()
}
fn control_label_changed(reference: &ControlLabelRef) {
    reference.advance();
    for owner in control_label_members(reference) {
        let mut owner = owner.borrow_mut();
        owner.modules.control_label.pointer = None;
        owner.dirty = true;
    }
}
pub fn initialize_instance_associations(owner: &OwnerRef, associations: InstanceAssociations) {
    // Construction is not published until setup has declared its recipient.
    owner.borrow_mut().modules.control_label.association = associations.control_label;
}
pub fn control_label_finish(owner: &OwnerRef) {
    let (reference, declared) = {
        let owner = owner.borrow();
        (owner.modules.control_label.association.clone(), owner.modules.control_label.kind.is_some())
    };
    if let Some(reference) = reference {
        if !declared { value_type_error("ControlLabel association requires declared Label or target participation"); }
        reference.0.participants.borrow_mut().push(Rc::downgrade(owner));
        control_label_changed(&reference);
    }
}
pub fn replace_instance_associations(owner: &OwnerRef, associations: InstanceAssociations) {
    ensure(&Rc::downgrade(owner));
    let declared = owner.borrow().modules.control_label.kind.is_some();
    if associations.control_label.is_some() && !declared {
        value_type_error("ControlLabel association requires declared Label or target participation");
    }
    let unchanged = {
        let owner = owner.borrow();
        match (&owner.modules.control_label.association, &associations.control_label) {
            (None, None) => true, (Some(a), Some(b)) => a.same(b), _ => false,
        }
    };
    if unchanged { return; }
    let previous = {
        let mut owner = owner.borrow_mut();
        let state = &mut owner.modules.control_label;
        state.pointer = None;
        state.generation = state.generation.checked_add(1).expect("ControlLabel generation overflow");
        state.last_diagnostic = None;
        std::mem::replace(&mut state.association, associations.control_label.clone())
    };
    if let Some(previous) = previous {
        previous.0.participants.borrow_mut().retain(|participant| !Weak::ptr_eq(participant, &Rc::downgrade(owner)));
        control_label_changed(&previous);
    }
    if let Some(reference) = associations.control_label {
        reference.0.participants.borrow_mut().push(Rc::downgrade(owner));
        control_label_changed(&reference);
    }
    owner.borrow_mut().dirty = true;
}
pub fn control_label_commit(owner: &OwnerRef) {
    // Layout has counted all physical occurrences before prepaint. A stable
    // unique or ambiguous view is one receipt, not a new lease every frame.
    // Replacing a node and restoring an old node must still retire old input.
    let view = if ready(owner) { control_label_view(owner) } else { None };
    let reference = {
        let mut owner = owner.borrow_mut();
        let state = &mut owner.modules.control_label;
        if state.view == view { return; }
        state.view = view;
        state.pointer = None;
        state.association.clone()
    };
    if let Some(reference) = reference { control_label_changed(&reference); }
}
pub fn control_label_detach(owner: &OwnerRef) {
    let reference = {
        let mut owner = owner.borrow_mut();
        owner.modules.control_label.pointer = None;
        owner.modules.control_label.view = None;
        owner.modules.control_label.association.clone()
    };
    if let Some(reference) = reference { control_label_changed(&reference); }
}
pub fn control_label_dispose(owner: &OwnerRef) {
    let previous = {
        let mut owner = owner.borrow_mut();
        let state = &mut owner.modules.control_label;
        state.pointer = None;
        state.kind = None;
        let callback = std::mem::take(&mut state.callback);
        (state.association.take(), callback)
    };
    if let Some(reference) = previous.0 {
        reference.0.participants.borrow_mut().retain(|participant| !Weak::ptr_eq(participant, &Rc::downgrade(owner)));
        control_label_changed(&reference);
    }
    drop(previous.1);
}
pub fn control_label_declare(owner: &OwnerWeak, target: bool, callback: Value, anatomy: Value) -> Value {
    if !matches!(anatomy, Value::Undefined) {
        value_type_error("GPUI ControlLabel Anatomy pairing has no admitted native domain lowering");
    }
    let owner_ref = setup(owner);
    let mut instance = owner_ref.borrow_mut();
    let state = &mut instance.modules.control_label;
    if state.kind.is_some() { value_type_error("ControlLabel permits one participation declaration per instance"); }
    if target && !matches!(callback, Value::Function(_)) { value_type_error("ControlLabel target callback required"); }
    state.kind = Some(if target { ControlLabelKind::Target } else { ControlLabelKind::Label });
    state.callback = callback;
    Value::Handle(owner.clone(), "control-label-handle")
}
pub fn control_label_sync(owner: &OwnerWeak, options: Value) -> Value {
    // The shared operation admits setup and callback use. The module facade
    // requires a live declaration, not a Base Label lifecycle convention.
    let owner = ensure(owner);
    let naming = options.member("naming", false).bool();
    let activation = options.member("activation", false).bool();
    let reference = {
        let mut owner = owner.borrow_mut();
        let state = &mut owner.modules.control_label;
        if state.kind.is_none() { value_type_error("ControlLabel sync requires declared participation"); }
        if (state.naming, state.activation) == (naming, activation) { return Value::Undefined; }
        state.naming = naming; state.activation = activation;
        // Target options are legal facade state, but pair naming and activation
        // belong to the Label. A target update cannot revoke a current request.
        if state.kind == Some(ControlLabelKind::Target) { return Value::Undefined; }
        state.pointer = None;
        state.generation = state.generation.checked_add(1).expect("ControlLabel generation overflow");
        let reference = state.association.clone();
        owner.dirty = true;
        reference
    };
    if let Some(reference) = reference { control_label_changed(&reference); }
    Value::Undefined
}
pub fn control_label_is_label(owner: &OwnerRef) -> bool {
    owner.borrow().modules.control_label.kind == Some(ControlLabelKind::Label)
}
pub fn control_label_action_enabled(owner: &OwnerRef) -> bool {
    let owner = owner.borrow();
    owner.modules.control_label.kind == Some(ControlLabelKind::Label) && owner.modules.control_label.activation
}
fn control_label_view(owner: &OwnerRef) -> Option<ControlLabelView> {
    let owner = owner.borrow();
    if owner.disposed || owner.disposing || !owner.present || owner.modules.a11y_bindings != 1 { return None; }
    Some(ControlLabelView { window: owner.window_id?, node: owner.modules.a11y_node?, epoch: owner.epoch,
        generation: owner.modules.control_label.generation })
}
fn control_label_pair(reference: &ControlLabelRef) -> Option<(OwnerRef, OwnerRef)> {
    let mut label = None;
    let mut target = None;
    for owner in control_label_members(reference) {
        // A live ambiguous participant cannot be skipped to elect another
        // participant as a winner in the same reference domain.
        if owner.borrow().modules.a11y_bindings > 1 { return None; }
        if control_label_view(&owner).is_none() { continue; }
        let kind = owner.borrow().modules.control_label.kind;
        match kind {
            Some(ControlLabelKind::Label) => { if label.replace(owner).is_some() { return None; } },
            Some(ControlLabelKind::Target) => { if target.replace(owner).is_some() { return None; } },
            None => {},
        }
    }
    let label = label?; let target = target?;
    let a = label.borrow(); let b = target.borrow();
    if a.window_id != b.window_id || a.modules.a11y_frame == 0 || a.modules.a11y_frame != b.modules.a11y_frame { return None; }
    drop(a); drop(b);
    Some((label, target))
}
impl ControlLabelRequest {
    fn is_current(&self) -> bool {
        if self.reference.0.revision.get() != self.revision { return false; }
        let Some((label, target)) = control_label_pair(&self.reference) else { return false; };
        Weak::ptr_eq(&self.label, &Rc::downgrade(&label)) && Weak::ptr_eq(&self.target, &Rc::downgrade(&target))
            && ready(&label) && ready(&target)
            && control_label_view(&label) == Some(self.label_view) && control_label_view(&target) == Some(self.target_view)
            && label.borrow().modules.control_label.activation
    }
}
pub fn control_label_request_current(value: Value) -> Value {
    let Value::ControlLabelRequest(request) = value else { value_type_error("expected nominal ControlLabel request"); };
    Value::boolean(request.is_current())
}
fn control_label_request(label: &OwnerRef, source: &'static str) -> Option<Rc<ControlLabelRequest>> {
    if !control_label_action_enabled(label) || !ready(label) { return None; }
    let reference = label.borrow().modules.control_label.association.clone()?;
    let Some((current_label, target)) = control_label_pair(&reference) else {
        control_label_diagnostic(label, "missing, duplicate or foreign-scope current ControlLabel pair");
        return None;
    };
    if !Rc::ptr_eq(label, &current_label) || !ready(&target) { return None; }
    Some(Rc::new(ControlLabelRequest { revision: reference.0.revision.get(), reference,
        label: Rc::downgrade(label), target: Rc::downgrade(&target),
        label_view: control_label_view(label)?, target_view: control_label_view(&target)?, source }))
}
fn control_label_activate(request: Rc<ControlLabelRequest>, window: &mut Window, cx: &mut App) {
    // A current pair does not authorize a host to invoke its retained callback
    // with another Window. Reject before authored work or native effects.
    if request.target_view.window != window.window_handle().window_id() || !request.is_current() { return; }
    let Some(target) = request.target.upgrade() else { return; };
    let callback = target.borrow().modules.control_label.callback.clone();
    native_host_callback(&target, "control-label", || {
        invoke(&target, "control-label", &callback, vec![capability(&Rc::downgrade(&target)), Value::ControlLabelRequest(request)]);
    });
    drive_owners(window, cx);
}
pub fn control_label_name(target: &OwnerRef) -> Option<gpui::accesskit::NodeId> {
    let (reference, frame, kind) = {
        let owner = target.borrow();
        (owner.modules.control_label.association.clone(), owner.modules.a11y_frame, owner.modules.control_label.kind)
    };
    if kind != Some(ControlLabelKind::Target) { return None; }
    let reference = reference?;
    let Some((label, current_target)) = control_label_pair(&reference) else {
        control_label_diagnostic(target, "missing, duplicate or foreign-scope current ControlLabel pair");
        return None;
    };
    if !Rc::ptr_eq(target, &current_target) || label.borrow().modules.a11y_frame != frame
        || !label.borrow().modules.control_label.naming { return None; }
    let conflict = {
        let owner = target.borrow();
        let text = owner.modules.accessible_text.get("name").map(resolved);
        let relation = owner.modules.accessible_relations.get("labelledBy").map(|spec| resolved(&spec.member("target", false)));
        text.is_some_and(|value| !value.nullish() && !value.text().is_empty())
            || relation.is_some_and(|value| match value {
                Value::Undefined | Value::Json(Json::Null) => false,
                Value::Json(Json::String(text)) => !text.trim().is_empty(),
                Value::Array(items) => !items.is_empty(), _ => true,
            })
    };
    if conflict { control_label_diagnostic(target, "explicit author name or labelledBy preserves its ownership"); return None; }
    target.borrow_mut().modules.control_label.last_diagnostic = None;
    control_label_view(&label).map(|view| view.node)
}
fn control_label_unmodified(modifiers: gpui::Modifiers) -> bool {
    !modifiers.alt && !modifiers.control && !modifiers.shift && !modifiers.platform && !modifiers.function
}
pub fn control_label_cancel(owner: &OwnerRef) { owner.borrow_mut().modules.control_label.pointer = None; }
pub fn control_label_pointer_capture(owner: &OwnerRef) {
    let mut owner = owner.borrow_mut();
    owner.modules.control_label.pointer = None;
    owner.modules.control_label.opaque_pointer_origin = false;
}
pub fn control_label_down(owner: &OwnerRef, event: &gpui::MouseDownEvent, eligible: bool, window: &Window) {
    if !control_label_is_label(owner) { return; }
    control_label_cancel(owner);
    if !eligible || owner.borrow().modules.control_label.opaque_pointer_origin || window.default_prevented() || event.button != gpui::MouseButton::Left || !control_label_unmodified(event.modifiers) { return; }
    let Some(request) = control_label_request(owner, "pointer") else { return; };
    owner.borrow_mut().modules.control_label.pointer = Some(ControlLabelPointer { request, origin: event.position, released: false });
}
pub fn control_label_pointer_sample(owner: &OwnerRef, position: gpui::Point<Pixels>, unmodified: bool, release: bool, window: &Window) {
    let pending = owner.borrow_mut().modules.control_label.pointer.take();
    if let Some(mut pending) = pending {
        let moved = f32::from(position.x - pending.origin.x).hypot(f32::from(position.y - pending.origin.y)) > 6.0;
        if moved || !unmodified || !native_host_hit(owner, position, window) || !pending.request.is_current() { return; }
        pending.released |= release;
        owner.borrow_mut().modules.control_label.pointer = Some(pending);
    }
}
pub fn control_label_click(owner: &OwnerRef, event: &gpui::ClickEvent, eligible: bool, window: &mut Window, cx: &mut App) {
    let pending = owner.borrow_mut().modules.control_label.pointer.take();
    let Some(pending) = pending else { return; };
    let gpui::ClickEvent::Mouse(event) = event else { return; };
    if !eligible || !pending.released || window.default_prevented() || event.down.button != gpui::MouseButton::Left
        || event.up.button != gpui::MouseButton::Left || !control_label_unmodified(event.down.modifiers)
        || !control_label_unmodified(event.up.modifiers) || event.down.position != pending.origin { return; }
    control_label_activate(pending.request, window, cx);
}
fn control_label_accessibility(owner: &OwnerRef, epoch: u64, generation: u64, window: &mut Window, cx: &mut App) {
    let current = { let owner = owner.borrow(); owner.epoch == epoch && owner.modules.control_label.generation == generation };
    if current { if let Some(request) = control_label_request(owner, "accessibility") { control_label_activate(request, window, cx); } }
}
#[derive(Clone)]
pub struct ControlLabelActionLease { owner: OwnerWeak, epoch: u64, generation: u64 }
impl ControlLabelActionLease {
    pub fn request(&self, window: &mut Window, cx: &mut App) {
        if let Some(owner) = self.owner.upgrade() {
            control_label_accessibility(&owner, self.epoch, self.generation, window, cx);
        }
    }
}
pub fn control_label_action_lease(owner: &OwnerRef) -> Option<ControlLabelActionLease> {
    if !control_label_action_enabled(owner) { return None; }
    let instance = owner.borrow();
    if instance.disposed || instance.disposing || !instance.present { return None; }
    Some(ControlLabelActionLease { owner: Rc::downgrade(owner),
        epoch: instance.epoch + u64::from(!instance.mounted), generation: instance.modules.control_label.generation })
}

// A native_view is opaque to the compiler. Input through that actual child
// boundary cannot be certified as noninteractive, so it cannot activate an
// enclosing Label. The child's own propagation and semantics remain untouched.
// There is no geometry/name inference of association or public host-object ABI.
struct ControlLabelNativeChild { element: AnyElement, owner: OwnerWeak }
#[cfg(not(feature = "gpui-modern-element-api"))]
impl gpui::IntoElement for ControlLabelNativeChild { type Element = Self; fn into_element(self) -> Self { self } }
impl gpui::Element for ControlLabelNativeChild {
    type RequestLayoutState = ();
    type PrepaintState = gpui::Hitbox;
    fn id(&self) -> Option<gpui::ElementId> { None }
    fn source_location(&self) -> Option<&'static std::panic::Location<'static>> { None }
    fn request_layout(&mut self, _: Option<&gpui::GlobalElementId>, _: Option<&gpui::InspectorElementId>, window: &mut Window, cx: &mut App) -> (gpui::LayoutId, ()) {
        (self.element.request_layout(window, cx), ())
    }
    fn prepaint(&mut self, _: Option<&gpui::GlobalElementId>, _: Option<&gpui::InspectorElementId>, bounds: Bounds<Pixels>, _: &mut (), window: &mut Window, cx: &mut App) -> gpui::Hitbox {
        let hitbox = window.insert_hitbox(bounds, gpui::HitboxBehavior::Normal);
        self.element.prepaint(window, cx);
        hitbox
    }
    fn paint(&mut self, _: Option<&gpui::GlobalElementId>, _: Option<&gpui::InspectorElementId>, _: Bounds<Pixels>, _: &mut (), hitbox: &mut gpui::Hitbox, window: &mut Window, cx: &mut App) {
        let owner = self.owner.clone(); let hitbox = hitbox.clone();
        window.on_mouse_event::<gpui::MouseDownEvent>(move |_, phase, window, _| {
            if !phase.capture() || !hitbox.is_hovered(window) { return; }
            let Some(owner) = owner.upgrade() else { return; };
            if !ready(&owner) || owner.borrow().window_id != Some(window.window_handle().window_id()) { return; }
            { let mut owner = owner.borrow_mut(); owner.modules.control_label.pointer = None; owner.modules.control_label.opaque_pointer_origin = true; }
            if control_label_action_enabled(&owner) {
                control_label_diagnostic(&owner, "Label activation from an opaque native_view child is unsupported; child input remains native");
            }
        });
        self.element.paint(window, cx);
    }
}
pub fn control_label_native_child(owner: &OwnerRef, element: AnyElement) -> AnyElement {
    if control_label_is_label(owner) { ControlLabelNativeChild { element, owner: Rc::downgrade(owner) }.into_any_element() } else { element }
}

#[cfg(all(test,feature="test-support"))]
mod control_label_view_tests {
    use super::*;
    use gpui::{AppContext,Context,Render,TestAppContext};
    struct Empty;
    impl Render for Empty { fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{div()} }
    fn owner(window:&Window,target:bool,reference:&ControlLabelRef,callback:Value,node:u64)->OwnerRef{
        let owner=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        initialize_instance_associations(&owner,InstanceAssociations{control_label:Some(reference.clone())});
        let weak=Rc::downgrade(&owner);control_label_declare(&weak,target,callback,Value::Undefined);
        if !target{control_label_sync(&weak,record(vec![("naming",Value::boolean(true)),("activation",Value::boolean(true))]));}
        Owner::finish(&owner,Value::Undefined);
        // The framework consumer covers physical layout. This SDK control
        // isolates exact request retirement from the already-observed facts.
        {let mut o=owner.borrow_mut();o.window_id=Some(window.window_handle().window_id());o.mounted=true;o.bounds=Some(Bounds::default());o.epoch=1;
            o.modules.a11y_frame=1;o.modules.a11y_bindings=1;o.modules.a11y_node=Some(gpui::accesskit::NodeId(node));}
        control_label_commit(&owner);owner
    }
    #[gpui::test]
    fn physical_replacement_and_ambiguity_cannot_revive_borrowed_requests(cx:&mut TestAppContext){
        let window=cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap());
        window.update(cx,|_,window,cx|{
            let reference=ControlLabelRef::new();let label=owner(window,false,&reference,Value::Undefined,1);
            let retained=Rc::new(RefCell::new(Value::Undefined));let capture=retained.clone();
            let target=owner(window,true,&reference,Value::Function(Rc::new(move|arguments|{*capture.borrow_mut()=arguments[1].clone();Value::Undefined})),2);
            control_label_action_lease(&label).unwrap().request(window,cx);let original=retained.borrow().clone();
            assert!(control_label_request_current(original.clone()).bool());
            target.borrow_mut().modules.a11y_node=Some(gpui::accesskit::NodeId(3));control_label_commit(&target);
            assert!(!control_label_request_current(original.clone()).bool());
            target.borrow_mut().modules.a11y_node=Some(gpui::accesskit::NodeId(2));control_label_commit(&target);
            assert!(!control_label_request_current(original).bool(),"restoring a physical node cannot restore a retired request");
            control_label_action_lease(&label).unwrap().request(window,cx);let unique=retained.borrow().clone();
            target.borrow_mut().modules.a11y_bindings=2;control_label_commit(&target);
            assert!(!control_label_request_current(unique.clone()).bool());assert!(control_label_request(&label,"accessibility").is_none());
            let revision=reference.0.revision.get();control_label_commit(&target);
            assert_eq!(reference.0.revision.get(),revision,"stable ambiguity must not repeatedly schedule work");
            target.borrow_mut().modules.a11y_bindings=1;control_label_commit(&target);
            assert!(!control_label_request_current(unique).bool());
            control_label_action_lease(&label).unwrap().request(window,cx);assert!(control_label_request_current(retained.borrow().clone()).bool());
            Owner::dispose(&label);Owner::dispose(&target);
        }).unwrap();
    }
}
`;
