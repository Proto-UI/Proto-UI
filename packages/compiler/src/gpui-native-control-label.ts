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
// Both integrated native consumers use this same typed, opaque association.
// The compatibility name adds no JSON or structural reference admission.
pub type NativeInstanceAssociations = InstanceAssociations;

#[derive(Clone, Copy, PartialEq, Eq)]
enum ControlLabelKind { Label, Target }
pub struct ControlLabelModule {
    association: Option<ControlLabelRef>,
    kind: Option<ControlLabelKind>,
    callback: Value,
    naming: bool,
    activation: bool,
    generation: u64,
    view: Option<(u64, gpui::WindowId, Option<gpui::accesskit::NodeId>)>,
    native_views: Vec<Weak<ControlLabelNativeView>>,
    native_view_serial: u64,
    physical_observed: bool,
    pointer: Option<ControlLabelPointer>,
    opaque_pointer_origin: bool,
    diagnostics: Vec<&'static str>,
    last_diagnostic: Option<&'static str>,
}
impl Default for ControlLabelModule {
    fn default() -> Self {
        Self { association: None, kind: None, callback: Value::Undefined, naming: true, activation: false,
            generation: 0, view: None, native_views: Vec::new(), native_view_serial: 0, physical_observed: false, pointer: None, opaque_pointer_origin: false, diagnostics: Vec::new(), last_diagnostic: None }
    }
}
#[derive(Clone, Copy, PartialEq, Eq)]
struct ControlLabelView {
    physical: Option<u64>,
    window: gpui::WindowId,
    node: gpui::accesskit::NodeId,
    epoch: u64,
    generation: u64,
}
// A physical receipt is owned by GPUI's retained NativeViewLease, not by the
// logical Owner or an action callback. Module storage is Weak, and release
// clears live before inspecting the remaining set.
pub struct ControlLabelNativeView {
    owner: OwnerWeak,
    serial: u64,
    epoch: u64,
    window: gpui::WindowId,
    node: Option<gpui::accesskit::NodeId>,
    live: Cell<bool>,
    geometry: RefCell<(gpui::Hitbox, Bounds<Pixels>)>,
    app: gpui::AsyncApp,
    window_handle: gpui::AnyWindowHandle,
}
fn control_label_native_views(owner: &OwnerRef) -> Vec<Rc<ControlLabelNativeView>> {
    let (views, epoch) = {
        let instance = owner.borrow();
        (instance.modules.control_label.native_views.clone(),
            instance.epoch.checked_add(u64::from(!instance.mounted)).expect("ControlLabel epoch overflow"))
    };
    let weak = Rc::downgrade(owner);
    views.into_iter().filter_map(|view| view.upgrade()).filter(|view| {
        view.live.get() && view.epoch == epoch && Weak::ptr_eq(&view.owner, &weak)
    }).collect()
}
fn control_label_physical_unique(owner: &OwnerRef) -> Option<Rc<ControlLabelNativeView>> {
    let mut views = control_label_native_views(owner);
    if views.len() != 1 { return None; }
    views.pop()
}


fn control_label_native_context_current(view: &ControlLabelNativeView) -> bool {
    if !view.live.get() { return false; }
    let Some(owner) = view.owner.upgrade() else { return false; };
    let instance = owner.borrow();
    !instance.disposed && !instance.disposing && instance.present
        && instance.epoch.checked_add(u64::from(!instance.mounted)) == Some(view.epoch)
}
fn control_label_schedule_native_members(reference: &ControlLabelRef, members: &[OwnerRef]) {
    let members: Vec<OwnerWeak> = members.iter().map(Rc::downgrade).collect();
    let mut scheduled = Vec::new();
    for member in &members {
        let Some(owner) = member.upgrade() else { continue; };
        for view in control_label_native_views(&owner) {
            if !control_label_native_context_current(&view) || scheduled.contains(&view.window) { continue; }
            scheduled.push(view.window);
            let context = Rc::downgrade(&view);
            let reference = Rc::downgrade(&reference.0);
            let members = members.clone();
            let window_id = view.window;
            // Scheduling never borrows App/Window from element-state Drop.
            // AsyncApp itself holds a weak App; this task additionally requires
            // the actual retained element-state context to remain live.
            view.app.foreground_executor().spawn(async move {
                let Some(view) = context.upgrade().filter(|view| control_label_native_context_current(view)) else { return; };
                let mut app = view.app.clone();
                let handle = view.window_handle;
                drop(view);
                let _ = handle.update(&mut app, move |_, window, cx| {
                    if window.window_handle().window_id() != window_id { return; }
                    let Some(reference) = reference.upgrade().map(ControlLabelRef) else { return; };
                    for member in &members {
                        if !context.upgrade().is_some_and(|view| control_label_native_context_current(&view)) { break; }
                        let Some(owner) = member.upgrade() else { continue; };
                        if !ready(&owner) { continue; }
                        let drive = {
                            let instance = owner.borrow();
                            if instance.disposed || instance.disposing || !instance.dirty
                                || instance.window_id != Some(window_id)
                                || !instance.modules.control_label.association.as_ref()
                                    .is_some_and(|current| current.same(&reference)) { None }
                            else { instance.native_drive.clone() }
                        };
                        if let Some(drive) = drive { drive(window, cx); }
                    }
                });
            }).detach();
        }
    }
}
fn control_label_observed_view(owner: &OwnerRef)
    -> Option<(u64, gpui::WindowId, Option<gpui::accesskit::NodeId>)> {
    if !ready(owner) { return None; }
    let instance = owner.borrow();
    let node = if instance.modules.control_label.physical_observed {
        control_label_view(owner).map(|view| view.node)
    } else if instance.modules.a11y_frame != 0 && instance.modules.a11y_bindings == 1 {
        instance.modules.a11y_node
    } else { None };
    Some((instance.epoch, instance.window_id?, node))
}
pub(crate) fn control_label_manages_native_view(owner: &OwnerRef) -> bool {
    let instance = owner.borrow();
    let state = &instance.modules.control_label;
    state.kind.is_some() || state.physical_observed
}
pub fn control_label_retain_native_view(
    owner: &OwnerRef,
    previous: Option<Rc<ControlLabelNativeView>>,
    node: Option<gpui::accesskit::NodeId>,
    hitbox: gpui::Hitbox,
    bounds: Bounds<Pixels>,
    window: &Window,
    cx: &App,
) -> Option<Rc<ControlLabelNativeView>> {
    let (epoch, admitted) = {
        let instance = owner.borrow();
        (instance.epoch.checked_add(u64::from(!instance.mounted)).expect("ControlLabel epoch overflow"),
            !instance.disposed && !instance.disposing && instance.present
                && instance.modules.control_label.kind.is_some())
    };
    if !admitted {
        if let Some(previous) = previous { control_label_release_native_view(&previous); }
        return None;
    }
    let window_id = window.window_handle().window_id();
    let weak = Rc::downgrade(owner);
    if let Some(previous) = previous.as_ref() {
        if previous.live.get() && previous.epoch == epoch && previous.window == window_id
            && previous.node == node && Weak::ptr_eq(&previous.owner, &weak) {
            *previous.geometry.borrow_mut() = (hitbox, bounds);
            return Some(previous.clone());
        }
    }
    let (serial, reference) = {
        let mut instance = owner.borrow_mut();
        let state = &mut instance.modules.control_label;
        state.physical_observed = true;
        state.native_views.retain(|view| view.upgrade().is_some_and(|view| view.live.get()));
        state.native_view_serial = state.native_view_serial.checked_add(1)
            .expect("ControlLabel physical binding overflow");
        (state.native_view_serial, state.association.clone())
    };
    let view = Rc::new(ControlLabelNativeView {
        owner: weak, serial, epoch, window: window_id, node, live: Cell::new(true),
        geometry: RefCell::new((hitbox, bounds)), app: cx.to_async(),
        window_handle: window.window_handle(),
    });
    owner.borrow_mut().modules.control_label.native_views.push(Rc::downgrade(&view));
    let observed = control_label_observed_view(owner);
    owner.borrow_mut().modules.control_label.view = observed;
    if let Some(reference) = reference { control_label_changed(&reference); }
    // Publish the successor before withdrawing its old same-state receipt, so
    // replacement cannot transiently unmount a still-physical logical owner.
    if let Some(previous) = previous { control_label_release_native_view(&previous); }
    Some(view)
}
pub fn control_label_release_native_view(view: &ControlLabelNativeView) {
    // GPUI's element state owns liveness. An in-flight upgraded Weak must not
    // keep a removed occurrence active while its NativeViewLease is dropping.
    if !view.live.replace(false) { return; }
    let Some(owner) = view.owner.upgrade() else { return; };
    let current = {
        let instance = owner.borrow();
        !instance.disposed && !instance.disposing
            && instance.epoch.checked_add(u64::from(!instance.mounted)) == Some(view.epoch)
    };
    if !current { return; } // An old epoch's destructor cannot clear a new view.
    let remaining = control_label_native_views(&owner);
    if remaining.is_empty() {
        // This is the original physical terminal path, including authored
        // unmounted and all module retirement. It is never used for a survivor.
        detach_native_view(&owner);
        return;
    }
    if remaining.len() == 1 {
        let remaining = &remaining[0];
        let (hitbox, bounds) = remaining.geometry.borrow().clone();
        let mut instance = owner.borrow_mut();
        instance.window_id = Some(remaining.window);
        instance.native_hitbox = Some(hitbox);
        instance.bounds = Some(bounds);
        // Never set mounted or epoch to manufacture a new logical lifetime.
    }
    // More than one actual occurrence remains ambiguous; do not elect one.
    let observed = control_label_observed_view(&owner);
    let reference = {
        let mut instance = owner.borrow_mut();
        instance.modules.control_label.view = observed;
        instance.modules.control_label.association.clone()
    };
    if let Some(reference) = reference { control_label_changed(&reference); }
}
impl Drop for ControlLabelNativeView {
    fn drop(&mut self) { control_label_release_native_view(self); }
}
fn control_label_participant_present(owner: &OwnerRef) -> bool {
    let instance = owner.borrow();
    if instance.disposed || instance.disposing || !instance.present { return false; }
    if instance.modules.control_label.physical_observed {
        !control_label_native_views(owner).is_empty()
    } else {
        instance.mounted || instance.modules.a11y_frame != 0
    }
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
fn record_control_label_diagnostic(owner: &OwnerRef, message: &'static str) {
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
    let members = control_label_members(reference);
    for owner in &members {
        let mut owner = owner.borrow_mut();
        owner.modules.control_label.pointer = None;
        owner.dirty = true;
    }
    control_label_schedule_native_members(reference, &members);
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
// Preserve the physical-view observation from the other integrated native
// implementation. A stable layout is not a new lease; a changed or ambiguous
// node retires pending work even when the logical Owner never remounts.
pub fn control_label_commit(owner: &OwnerRef) -> bool {
    let view = control_label_observed_view(owner);
    let reference = {
        let mut instance = owner.borrow_mut();
        let state = &mut instance.modules.control_label;
        if state.view == view { return false; }
        state.view = view;
        state.pointer = None;
        state.association.clone()
    };
    if let Some(reference) = reference { control_label_changed(&reference); true } else { false }
}
pub fn set_instance_associations(owner: &OwnerRef, associations: NativeInstanceAssociations) {
    ensure(&Rc::downgrade(owner));
    if owner.borrow().phase == "setup" {
        initialize_instance_associations(owner, associations);
    } else {
        replace_instance_associations(owner, associations);
    }
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
    let instance = owner.borrow();
    if instance.disposed || instance.disposing || !instance.present { return None; }
    if instance.modules.control_label.physical_observed {
        // Count all retained occurrences, including foreign-window occurrences.
        // The last written window or node must never elect a winner.
        let view = control_label_physical_unique(owner)?;
        if instance.window_id != Some(view.window) { return None; }
        return Some(ControlLabelView { window: view.window, node: view.node?, epoch: view.epoch,
            generation: instance.modules.control_label.generation, physical: Some(view.serial) });
    }
    // Keep the original fresh-layout receipt protocol until GPUI has actually
    // registered a retained physical view. Once observed, this fallback is closed.
    if instance.modules.a11y_bindings != 1 { return None; }
    Some(ControlLabelView { window: instance.window_id?, node: instance.modules.a11y_node?, epoch: instance.epoch,
        generation: instance.modules.control_label.generation, physical: None })
}
fn control_label_pair(reference: &ControlLabelRef) -> Option<(OwnerRef, OwnerRef)> {
    let mut label = None;
    let mut target = None;
    for owner in control_label_members(reference) {
        if !control_label_participant_present(&owner) { continue; }
        // A physically present but ambiguous participant is a refusal, not an
        // absent candidate to skip while choosing another logical winner.
        control_label_view(&owner)?;
        let kind = owner.borrow().modules.control_label.kind;
        match kind {
            Some(ControlLabelKind::Label) => { if label.replace(owner).is_some() { return None; } },
            Some(ControlLabelKind::Target) => { if target.replace(owner).is_some() { return None; } },
            None => {},
        }
    }
    let label = label?; let target = target?;
    let label_view = control_label_view(&label)?;
    let target_view = control_label_view(&target)?;
    if label_view.window != target_view.window { return None; }
    if label_view.physical.is_none() || target_view.physical.is_none() {
        let a = label.borrow(); let b = target.borrow();
        if a.modules.a11y_frame == 0 || a.modules.a11y_frame != b.modules.a11y_frame { return None; }
    }
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
        record_control_label_diagnostic(label, "missing, duplicate or foreign-scope current ControlLabel pair");
        return None;
    };
    if !Rc::ptr_eq(label, &current_label) || !ready(&target) { return None; }
    Some(Rc::new(ControlLabelRequest { revision: reference.0.revision.get(), reference,
        label: Rc::downgrade(label), target: Rc::downgrade(&target),
        label_view: control_label_view(label)?, target_view: control_label_view(&target)?, source }))
}
fn control_label_activate(request: Rc<ControlLabelRequest>, window: &mut Window, cx: &mut App) -> bool {
    // A current pair does not authorize a host to invoke its retained callback
    // with another Window. Reject before authored work or native effects.
    if request.target_view.window != window.window_handle().window_id() || !request.is_current() { return false; }
    let Some(target) = request.target.upgrade() else { return false; };
    let callback = target.borrow().modules.control_label.callback.clone();
    native_host_callback(&target, "control-label", || {
        invoke(&target, "control-label", &callback, vec![capability(&Rc::downgrade(&target)), Value::ControlLabelRequest(request)]);
    });
    drive_owners(window, cx);
    true
}
pub fn control_label_name(target: &OwnerRef) -> Option<gpui::accesskit::NodeId> {
    let (reference, kind) = {
        let owner = target.borrow();
        (owner.modules.control_label.association.clone(), owner.modules.control_label.kind)
    };
    if kind != Some(ControlLabelKind::Target) { return None; }
    let reference = reference?;
    let Some((label, current_target)) = control_label_pair(&reference) else {
        record_control_label_diagnostic(target, "missing, duplicate or foreign-scope current ControlLabel pair");
        return None;
    };
    // pair() already checked either both retained physical proofs or the
    // original common layout-frame protocol; do not re-reject a cached label.
    if !Rc::ptr_eq(target, &current_target) || !label.borrow().modules.control_label.naming { return None; }
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
    if conflict { record_control_label_diagnostic(target, "explicit author name or labelledBy preserves its ownership"); return None; }
    target.borrow_mut().modules.control_label.last_diagnostic = None;
    control_label_view(&label).map(|view| view.node)
}
// Retain the direct native consumer queries from the integrated SDK. They
// resolve the same nominal pair used by pointer and action leases.
fn control_label_passive_content(owner: &OwnerRef) -> bool {
    let owner = owner.borrow();
    owner.projection.as_ref().is_some_and(|projection| projection.passive_content)
        && owner.slot.iter().all(|child| child.passive_content)
}
pub fn control_label_diagnostic(owner: &OwnerRef) -> Option<&'static str> {
    let reference = owner.borrow().modules.control_label.association.clone();
    let Some(reference) = reference else { return Some("missing-binding"); };
    let mut labels = Vec::new();
    let mut targets = Vec::new();
    for member in control_label_members(&reference) {
        if !control_label_participant_present(&member) { continue; }
        let instance = member.borrow();
        match instance.modules.control_label.kind {
            Some(ControlLabelKind::Label) => labels.push(member.clone()),
            Some(ControlLabelKind::Target) => targets.push(member.clone()),
            None => {}
        }
    }
    if labels.len() > 1 || targets.len() > 1 { return Some("duplicate-binding"); }
    if labels.len() != 1 || targets.len() != 1 { return Some("missing-binding"); }
    let label = &labels[0];
    let target = &targets[0];
    {
        let a = label.borrow();
        let b = target.borrow();
        if a.window_id.is_none() || a.window_id != b.window_id { return Some("foreign-tree-scope"); }
        let label_ambiguous = if a.modules.control_label.physical_observed {
            control_label_native_views(label).len() > 1
        } else { a.modules.a11y_bindings > 1 };
        let target_ambiguous = if b.modules.control_label.physical_observed {
            control_label_native_views(target).len() > 1
        } else { b.modules.a11y_bindings > 1 };
        if label_ambiguous || target_ambiguous { return Some("ambiguous-view"); }
        let Some(label_view) = control_label_view(label) else { return Some("missing-view"); };
        let Some(target_view) = control_label_view(target) else { return Some("missing-view"); };
        if label_view.window != target_view.window { return Some("foreign-tree-scope"); }
        if (label_view.physical.is_none() || target_view.physical.is_none())
            && (a.modules.a11y_frame == 0 || a.modules.a11y_frame != b.modules.a11y_frame) {
            return Some("missing-view");
        }
        if a.modules.control_label.naming {
            let name = b.modules.accessible_text.get("name").map(resolved);
            let relation = b.modules.accessible_relations.get("labelledBy")
                .map(|spec| resolved(&spec.member("target", false)));
            let conflict = name.is_some_and(|value| !value.nullish() && !value.text().is_empty())
                || relation.is_some_and(|value| match value {
                    Value::Undefined | Value::Json(Json::Null) => false,
                    Value::Json(Json::String(text)) => !text.trim().is_empty(),
                    Value::Array(items) => !items.is_empty(), _ => true,
                });
            if conflict { return Some("name-conflict"); }
        }
    }
    if control_label_action_enabled(label) && !control_label_passive_content(label) {
        return Some("unsupported-pointer-content");
    }
    None
}
pub fn control_label_action_available(owner: &OwnerRef) -> bool {
    if !control_label_action_enabled(owner) || !ready(owner) { return false; }
    let reference = owner.borrow().modules.control_label.association.clone();
    reference.and_then(|reference| control_label_pair(&reference))
        .is_some_and(|(label, target)| Rc::ptr_eq(owner, &label) && ready(&target))
}
pub fn control_label_accessibility_action(owner: &OwnerRef, window: &mut Window, cx: &mut App) -> bool {
    let Some(request) = control_label_request(owner, "accessibility") else { return false; };
    control_label_activate(request, window, cx)
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
// An installed action owns the exact pair captured by that paint. It cannot
// obtain fresh authority by asking the same logical Owner for a replacement
// physical target when an older native callback is delivered.
#[derive(Clone)]
pub struct ControlLabelActionLease { request: Option<Rc<ControlLabelRequest>> }
impl ControlLabelActionLease {
    pub fn request(&self, window: &mut Window, cx: &mut App) {
        if let Some(request) = &self.request { control_label_activate(request.clone(), window, cx); }
    }
}
pub fn control_label_action_lease(owner: &OwnerRef) -> Option<ControlLabelActionLease> {
    if !control_label_action_enabled(owner) { return None; }
    {
        let instance = owner.borrow();
        if instance.disposed || instance.disposing || !instance.present { return None; }
    }
    // Preserve an enabled Label's callable bridge even when no pair exists.
    // An empty construction-time snapshot remains permanently inactive.
    Some(ControlLabelActionLease { request: control_label_request(owner, "accessibility") })
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
                record_control_label_diagnostic(&owner, "Label activation from an opaque native_view child is unsupported; child input remains native");
            }
        });
        self.element.paint(window, cx);
    }
}
pub fn control_label_native_child(owner: &OwnerRef, element: AnyElement) -> AnyElement {
    if control_label_is_label(owner) { ControlLabelNativeChild { element, owner: Rc::downgrade(owner) }.into_any_element() } else { element }
}

// Restored from bd5800; use the canonical nominal request and association types.
#[cfg(all(test,feature="test-support"))]
mod control_label_lease_tests {
    use super::*;
    use gpui::{AppContext,Render,Context,TestAppContext};
    struct Empty;
    impl Render for Empty {fn render(&mut self,_:&mut Window,_:&mut Context<Self>)->impl IntoElement{div()}}
    fn owner(window:&Window,kind:&'static str,reference:&ControlLabelRef,callback:Value)->OwnerRef{
        let owner=Owner::new(serde_json::json!({}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        let weak=Rc::downgrade(&owner);control_label_declare(&weak,kind=="target",callback,Value::Undefined);
        control_label_sync(&weak,record(vec![("naming",Value::boolean(true)),("activation",Value::boolean(true))]));
        set_instance_associations(&owner,NativeInstanceAssociations{control_label:Some(reference.clone())});Owner::finish(&owner,Value::Undefined);
        {let mut o=owner.borrow_mut();o.window_id=Some(window.window_handle().window_id());o.mounted=true;o.bounds=Some(Bounds::default());o.epoch=1;
            o.modules.a11y_frame=1;o.modules.a11y_bindings=1;o.modules.a11y_node=Some(gpui::accesskit::NodeId(if kind=="label"{1}else{2}));}
        control_label_commit(&owner);
        owner
    }
    #[gpui::test]
    fn reentrant_rebinding_retires_the_old_request_even_if_identity_is_restored(cx:&mut TestAppContext){
        let window=cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap());
        window.update(cx,|_,window,cx|{
            let reference=ControlLabelRef::new();let label=owner(window,"label",&reference,Value::Undefined);
            let label_weak=Rc::downgrade(&label);let same=reference.clone();let calls=Rc::new(Cell::new(0));let called=calls.clone();
            let callback=Value::Function(Rc::new(move|arguments|{
                let request=arguments[1].clone();assert_eq!(request.member("source",false).text(),"accessibility");
                assert!(control_label_request_current(request.clone()).bool());
                let label=label_weak.upgrade().unwrap();set_instance_associations(&label,NativeInstanceAssociations::default());
                assert!(!control_label_request_current(request.clone()).bool());
                set_instance_associations(&label,NativeInstanceAssociations{control_label:Some(same.clone())});
                assert!(!control_label_request_current(request).bool(),"restoring the ref cannot restore an old request turn");
                called.set(called.get()+1);Value::Undefined
            }));
            let target=owner(window,"target",&reference,callback);
            assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(calls.get(),1);
            assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(calls.get(),2);
            let stale=control_label_request(&label,"accessibility").unwrap();detach_native_view(&target);assert!(!stale.is_current());
            {let mut o=target.borrow_mut();o.mounted=true;o.bounds=Some(Bounds::default());o.epoch+=1;
                o.modules.a11y_frame=1;o.modules.a11y_bindings=1;o.modules.a11y_node=Some(gpui::accesskit::NodeId(2));}
            control_label_commit(&target);
            assert!(!stale.is_current());assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(calls.get(),3);
            Owner::dispose(&label);Owner::dispose(&target);
        }).unwrap();
    }
    #[gpui::test]
    fn explicit_name_conflict_keeps_activation_and_drops_only_association_name(cx:&mut TestAppContext){
        let window=cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap());
        window.update(cx,|_,window,cx|{
            let reference=ControlLabelRef::new();let label=owner(window,"label",&reference,Value::Undefined);
            let calls=Rc::new(Cell::new(0));let called=calls.clone();let target=owner(window,"target",&reference,Value::Function(Rc::new(move|_|{called.set(called.get()+1);Value::Undefined})));
            target.borrow_mut().modules.accessible_text.insert("name".into(),Value::string("Consumer name"));
            assert_eq!(control_label_diagnostic(&label),Some("name-conflict"));assert!(control_label_accessibility_action(&label,window,cx));assert_eq!(calls.get(),1);
            set_instance_associations(&target,NativeInstanceAssociations::default());assert_eq!(target.borrow().modules.accessible_text["name"].text(),"Consumer name");
            assert!(!control_label_accessibility_action(&label,window,cx));Owner::dispose(&label);Owner::dispose(&target);
        }).unwrap();
    }
    #[gpui::test]
    fn pending_requests_cannot_revive_after_unique_node_replacement_or_physical_ambiguity(cx:&mut TestAppContext){
        let window=cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap());
        window.update(cx,|_,window,cx|{
            let reference=ControlLabelRef::new();let label=owner(window,"label",&reference,Value::Undefined);
            let retained=Rc::new(RefCell::new(Value::Undefined));let captured=retained.clone();
            let target=owner(window,"target",&reference,Value::Function(Rc::new(move|arguments|{
                *captured.borrow_mut()=arguments[1].clone();Value::Undefined
            })));
            assert!(control_label_accessibility_action(&label,window,cx));let original=retained.borrow().clone();
            assert!(control_label_request_current(original.clone()).bool());
            target.borrow_mut().modules.a11y_node=Some(gpui::accesskit::NodeId(3));control_label_commit(&target);
            assert!(!control_label_request_current(original.clone()).bool(),"a new physical node is a new view lease even if its owner and window stay the same");
            assert!(control_label_accessibility_action(&label,window,cx));let replaced=retained.borrow().clone();
            target.borrow_mut().modules.a11y_node=Some(gpui::accesskit::NodeId(2));control_label_commit(&target);
            assert!(!control_label_request_current(original).bool());assert!(!control_label_request_current(replaced).bool());
            assert!(control_label_accessibility_action(&label,window,cx));let unique=retained.borrow().clone();
            target.borrow_mut().modules.a11y_bindings=2;control_label_commit(&target);
            assert_eq!(control_label_diagnostic(&label),Some("ambiguous-view"));
            assert!(!control_label_accessibility_action(&label,window,cx));assert!(!control_label_request_current(unique.clone()).bool());
            let ambiguous_revision=reference.0.revision.get();control_label_commit(&target);
            assert_eq!(reference.0.revision.get(),ambiguous_revision,"stable ambiguity does not repeatedly notify or invalidate");
            target.borrow_mut().modules.a11y_bindings=1;control_label_commit(&target);
            assert!(!control_label_request_current(unique).bool());
            assert!(control_label_accessibility_action(&label,window,cx));assert!(control_label_request_current(retained.borrow().clone()).bool());
            Owner::dispose(&label);Owner::dispose(&target);
        }).unwrap();
    }
    // Append inside control_label_lease_tests, which already owns owner(...) and Empty.
    // This is an SDK test with a real GPUI Window and host receipt injection.
    // It does not claim native accessibility platform delivery or physical input.
    #[gpui::test]
    fn retained_action_leases_cannot_acquire_replacement_physical_nodes(cx: &mut TestAppContext) {
        let window = cx.update(|cx| {
            cx.open_window(Default::default(), |_, cx| cx.new(|_| Empty)).unwrap()
        });
        window.update(cx, |_, window, cx| {
            for replace_target in [true, false] {
                let reference = ControlLabelRef::new();
                let label = owner(window, "label", &reference, Value::Undefined);
                let calls = Rc::new(Cell::new(0));
                let called = calls.clone();
                let target = owner(window, "target", &reference, Value::Function(Rc::new(move |arguments| {
                    assert_eq!(arguments[1].member("source", false).text(), "accessibility");
                    assert!(control_label_request_current(arguments[1].clone()).bool());
                    called.set(called.get() + 1);
                    Value::Undefined
                })));
                let original = control_label_action_lease(&label).expect("current Label action lease");
                original.request(window, cx);
                assert_eq!(calls.get(), 1, "a current lease must reach the authored target");

                // A repeated observation of the same physical pair is not retirement.
                control_label_commit(&label);
                control_label_commit(&target);
                original.request(window, cx);
                assert_eq!(calls.get(), 2, "stable physical identity keeps the current lease live");

                let changed = if replace_target { target.clone() } else { label.clone() };
                let initial_node = changed.borrow().modules.a11y_node.expect("initial physical node");
                changed.borrow_mut().modules.a11y_node = Some(gpui::accesskit::NodeId(3));
                control_label_commit(&changed);

                original.request(window, cx);
                assert_eq!(calls.get(), 2,
                    "an old action lease must not acquire a replacement physical node; target={replace_target}");
                let replacement = control_label_action_lease(&label).expect("replacement Label action lease");
                replacement.request(window, cx);
                assert_eq!(calls.get(), 3, "a fresh lease must activate the replacement pair");

                // Restoring the old node ID must not resurrect either retired receipt.
                changed.borrow_mut().modules.a11y_node = Some(initial_node);
                control_label_commit(&changed);
                original.request(window, cx);
                replacement.request(window, cx);
                assert_eq!(calls.get(), 3,
                    "restoring node identity must not revive retained action leases; target={replace_target}");
                let restored = control_label_action_lease(&label).expect("restored current Label action lease");
                restored.request(window, cx);
                assert_eq!(calls.get(), 4, "a newly acquired lease remains usable after restoration");
                Owner::dispose(&label);
                Owner::dispose(&target);
            }
        }).unwrap();
    }

    #[gpui::test]
    fn label_accessibility_click_requires_a_current_unique_physical_pair(cx: &mut TestAppContext) {
        let window=cx.update(|cx|cx.open_window(Default::default(),|_,cx|cx.new(|_|Empty)).unwrap());
        window.update(cx,|_,window,_|{
            let reference=ControlLabelRef::new();
            let label=owner(window,"label",&reference,Value::Undefined);
            let project=||{
                let element=crate::gpui_native_a11y::Semantics{
                    element:gpui::div().id("control-label-projection").role(gpui::Role::Label),
                    owner:Rc::downgrade(&label),role:Some(gpui::Role::Label),
                };
                let mut node=gpui::accesskit::Node::new(gpui::accesskit::Role::Label);
                node.add_action(gpui::accesskit::Action::Click);
                gpui::Element::write_a11y_info(&element,&mut node);
                node
            };
            assert!(!project().supports_action(gpui::accesskit::Action::Click),
                "a missing physical target cannot advertise a Label action");
            let target=owner(window,"target",&reference,Value::Function(Rc::new(|_|Value::Undefined)));
            assert!(project().supports_action(gpui::accesskit::Action::Click),
                "a unique current physical pair advertises its existing action");
            target.borrow_mut().modules.a11y_bindings=2;control_label_commit(&target);
            assert!(!project().supports_action(gpui::accesskit::Action::Click),
                "ambiguous physical target bindings cannot advertise activation");
            target.borrow_mut().modules.a11y_bindings=1;control_label_commit(&target);
            assert!(project().supports_action(gpui::accesskit::Action::Click),
                "a restored current pair can advertise a newly available action");
            Owner::dispose(&target);
            assert!(!project().supports_action(gpui::accesskit::Action::Click),
                "a retired physical target cannot leave an advertised action");
            Owner::dispose(&label);
        }).unwrap();
    }


    #[gpui::test]
    fn inactive_action_bridge_never_acquires_a_later_valid_pair(cx: &mut TestAppContext) {
        let window = cx.update(|cx| cx.open_window(Default::default(),
            |_, cx| cx.new(|_| Empty)).unwrap());
        let foreign = cx.update(|cx| cx.open_window(Default::default(),
            |_, cx| cx.new(|_| Empty)).unwrap());
        let foreign_id = foreign.update(cx, |_, window, _|
            window.window_handle().window_id()).unwrap();
        window.update(cx, |_, window, cx| {
            for case in ["missing", "ambiguous", "foreign-window"] {
                let reference = ControlLabelRef::new();
                let label = owner(window, "label", &reference, Value::Undefined);
                let calls = Rc::new(Cell::new(0));
                let called = calls.clone();
                let callback = Value::Function(Rc::new(move |arguments| {
                    assert!(control_label_request_current(arguments[1].clone()).bool());
                    called.set(called.get() + 1);
                    Value::Undefined
                }));
                let mut target = if case == "missing" { None } else {
                    Some(owner(window, "target", &reference, callback.clone()))
                };
                let duplicate = if case == "ambiguous" {
                    Some(owner(window, "target", &reference, callback.clone()))
                } else { None };
                if case == "foreign-window" {
                    target.as_ref().unwrap().borrow_mut().window_id = Some(foreign_id);
                    control_label_commit(target.as_ref().unwrap());
                }
                let inactive = control_label_action_lease(&label)
                    .expect("an enabled live Label preserves its callable bridge");
                inactive.request(window, cx);
                assert_eq!(calls.get(), 0, "unresolved {case} bridge is initially inactive");
                match case {
                    "missing" => target = Some(owner(window, "target", &reference, callback)),
                    "ambiguous" => set_instance_associations(duplicate.as_ref().unwrap(),
                        NativeInstanceAssociations::default()),
                    _ => {
                        target.as_ref().unwrap().borrow_mut().window_id =
                            Some(window.window_handle().window_id());
                        control_label_commit(target.as_ref().unwrap());
                    }
                }
                assert!(control_label_action_available(&label), "the repaired {case} pair really resolves");
                inactive.request(window, cx);
                assert_eq!(calls.get(), 0, "restoring {case} cannot upgrade an inactive old bridge");
                control_label_action_lease(&label).unwrap().request(window, cx);
                assert_eq!(calls.get(), 1, "a newly captured {case} bridge may activate");
                inactive.request(window, cx);
                assert_eq!(calls.get(), 1, "an inactive bridge never lazily captures authority");
                Owner::dispose(&label);
                Owner::dispose(target.as_ref().unwrap());
                if let Some(duplicate) = duplicate { Owner::dispose(&duplicate); }
            }
        }).unwrap();
    }

    #[test]
    fn undeclared_recipient_is_rejected_without_touching_json_props(){
        let owner=Owner::new(serde_json::json!({"business":3}),Default::default(),|_,_|true,|_|true,|_,_|true,crate::gpui_native_style::vocabulary());
        set_instance_associations(&owner,NativeInstanceAssociations{control_label:Some(ControlLabelRef::new())});
        assert!(catch_authored(||control_label_finish(&owner)).is_err());assert_eq!(owner.borrow().raw,serde_json::json!({"business":3}));Owner::dispose(&owner);
    }
}

// Exercise the production ControlLabel lease at native render boundaries.
// Uses real GPUI Entities, layout, prepaint, commit and deferred notifications.
// Captures the production factory at the paint_native_root call site.
// Invoking that captured bridge is framework evidence, not OS/AT delivery.
#[cfg(all(test, feature = "test-support"))]
mod control_label_render_lease_tests {
    use super::*;
    use gpui::{AppContext, Context, Entity, Render, TestAppContext, WindowHandle, px, size};

    struct RenderedNode {
        owner: OwnerRef,
        focus: FocusHandle,
        is_label: bool,
        native_role: Option<Option<gpui::Role>>,
        path_generation: usize,
        renders: Rc<Cell<usize>>,
        captures: Rc<RefCell<Vec<Option<ControlLabelActionLease>>>>,
    }
    impl RenderedNode {
        fn new(
            reference: ControlLabelRef,
            is_label: bool,
            calls: Rc<Cell<usize>>,
            renders: Rc<Cell<usize>>,
            captures: Rc<RefCell<Vec<Option<ControlLabelActionLease>>>>,
            window: &mut Window,
            cx: &mut Context<Self>,
        ) -> Self {
            Self::with_native_role(reference, is_label, calls, renders, captures, None, window, cx)
        }
        fn with_native_role(
            reference: ControlLabelRef,
            is_label: bool,
            calls: Rc<Cell<usize>>,
            renders: Rc<Cell<usize>>,
            captures: Rc<RefCell<Vec<Option<ControlLabelActionLease>>>>,
            native_role: Option<Option<gpui::Role>>,
            window: &mut Window,
            cx: &mut Context<Self>,
        ) -> Self {
            let owner = Owner::new(serde_json::json!({}), Default::default(),
                |_, _| true, |_| true, |_, _| true, crate::gpui_native_style::vocabulary());
            let weak = Rc::downgrade(&owner);
            initialize_instance_associations(&owner, InstanceAssociations {
                control_label: Some(reference),
            });
            if native_role.is_none() { as_accessible(&weak); }
            let callback = if is_label { Value::Undefined } else {
                Value::Function(Rc::new(move |arguments| {
                    assert_eq!(arguments[1].member("source", false).text(), "accessibility");
                    assert!(control_label_request_current(arguments[1].clone()).bool());
                    calls.set(calls.get() + 1);
                    Value::Undefined
                }))
            };
            control_label_declare(&weak, !is_label, callback, Value::Undefined);
            control_label_sync(&weak, record(vec![
                ("naming", Value::boolean(true)), ("activation", Value::boolean(true)),
            ]));
            owner.borrow_mut().slot = vec![NativeSnapshot::text_value(
                Value::string(if is_label { "Visible caption" } else { "Target" }),
            )];

            // Same weak Entity / coalesced deferred notification boundary as
            // the generated CompiledComponent constructor and drive().
            let focus = cx.focus_handle();
            let drive_owner = weak.clone();
            let drive_focus = focus.clone();
            let view = cx.entity().downgrade();
            let driving = Rc::new(Cell::new(false));
            let drive_pending = Rc::new(Cell::new(false));
            let drive: Drive = Rc::new(move |window, cx| {
                if !driving.replace(true) {
                    if let Some(owner) = drive_owner.upgrade() {
                        native_host_callback(&owner, "drive", || {
                            modules_drive(&owner, &drive_focus, window, cx);
                            drive_queued_focus(&owner, window, cx);
                        });
                    }
                    driving.set(false);
                }
                if drive_pending.replace(true) { return; }
                let view = view.clone();
                let pending = drive_pending.clone();
                window.defer(cx, move |window, cx| {
                    pending.set(false);
                    let _ = view.update(cx, |view, cx| view.drive(window, cx));
                });
            });
            {
                let mut instance = owner.borrow_mut();
                instance.native_drive = Some(drive);
                instance.window_id = Some(window.window_handle().window_id());
            }
            Owner::finish(&owner, Value::Undefined);
            register_sequential_focus_owner(&owner, cx);
            Self { owner, focus, is_label, native_role, path_generation: 0, renders, captures }
        }
        fn drive(&mut self, window: &mut Window, cx: &mut Context<Self>) {
            if self.owner.borrow().disposed { return; }
            modules_drive(&self.owner, &self.focus, window, cx);
            drive_queued_focus(&self.owner, window, cx);
            let dirty = std::mem::take(&mut self.owner.borrow_mut().dirty);
            if !notify_native_events(&self.owner, cx) && dirty {
                notify_native_change(cx);
            }
        }
    }
    impl Render for RenderedNode {
        fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
            self.renders.set(self.renders.get() + 1);
            Owner::project(&self.owner);
            self.owner.borrow_mut().dirty = false;
            let snapshot = self.owner.borrow().projection.clone().expect("actual projection");
            let drive = self.owner.borrow().native_drive.clone().expect("native drive");
            let path = format!("lease-node-{}-{}", Rc::as_ptr(&self.owner) as usize,
                self.path_generation);
            if self.is_label {
                // Deliberately before layout and immediately beside production
                // paint: never fetch a fresh factory after the test settles.
                self.captures.borrow_mut().push(control_label_action_lease(&self.owner));
            }
            if let Some(role) = self.native_role {
                // This focused host exposes a real inner Element role while
                // accessible stays false. Semantics owns layout and retention;
                // the canvas delivers the same guarded deferred Owner commit
                // boundary as paint_native_root, with no hand-made node/frame.
                let mut element = div().id(gpui::ElementId::Name(path.into())).size_full();
                if let Some(role) = role { element = element.role(role); }
                let owner = self.owner.clone();
                let revision = owner.borrow().projection_revision;
                let epoch = owner.borrow().epoch;
                element = element.child(canvas(|_, _, _| (), move |_, _, window, cx| {
                    let owner = owner.clone();
                    let drive = drive.clone();
                    window.defer(cx, move |window, cx| {
                        if native_host_callback(&owner, "commit", || {
                            let current = {
                                let instance = owner.borrow();
                                !instance.disposed && instance.present && instance.bounds.is_some()
                                    && instance.epoch == epoch
                                    && instance.window_id == Some(window.window_handle().window_id())
                                    && instance.projection_revision == revision
                            };
                            if !current { return; }
                            Owner::commit(&owner, revision);
                            if !owner.borrow().disposed && owner.borrow().present {
                                drive(window, cx);
                            }
                        }).is_none() { drive_pending_native_events(&owner, window, cx); }
                    });
                }).absolute().size_full());
                return crate::gpui_native_a11y::Semantics {
                    element: element.into_element(), owner: Rc::downgrade(&self.owner), role: None,
                }.into_any_element();
            }
            paint_native_root(&snapshot, &self.owner, &self.focus, path, drive)
        }
    }
    impl Drop for RenderedNode {
        fn drop(&mut self) { Owner::dispose(&self.owner); }
    }
    struct Host { label: Entity<RenderedNode>, target: Entity<RenderedNode> }
    fn cached_style() -> gpui::StyleRefinement {
        let mut surface = div().w(px(220.)).h(px(40.));
        surface.style().clone()
    }
    impl Render for Host {
        fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
            div().flex().flex_col().size_full()
                .child(self.label.clone().cached(cached_style()))
                .child(self.target.clone().cached(cached_style()))
        }
    }
    fn frames(window: WindowHandle<Host>, cx: &mut TestAppContext) {
        // Bounded delivery, with no window.refresh() / host or Label notify.
        // GPUI may reuse cached views unless their actual Entity was notified.
        for _ in 0..8 {
            cx.run_until_parked();
            cx.update_window(window.into(), |_, window, cx| {
                window.draw(cx).clear(cx);
            }).unwrap();
        }
        cx.run_until_parked();
    }
    fn latest(captures: &Rc<RefCell<Vec<Option<ControlLabelActionLease>>>>)
        -> ControlLabelActionLease {
        captures.borrow().last().expect("Label rendered").clone()
            .expect("the lease captured at the latest paint must be available")
    }

    #[gpui::test]
    fn captured_paint_lease_recovers_after_cold_mount_and_target_only_node_replacement(
        cx: &mut TestAppContext,
    ) {
        let calls = Rc::new(Cell::new(0));
        let label_renders = Rc::new(Cell::new(0));
        let target_renders = Rc::new(Cell::new(0));
        let captures = Rc::new(RefCell::new(Vec::new()));
        let window = cx.open_window(size(px(240.), px(100.)), {
            let calls = calls.clone();
            let label_renders = label_renders.clone();
            let target_renders = target_renders.clone();
            let captures = captures.clone();
            move |window, cx| {
                let reference = ControlLabelRef::new();
                let label = cx.new(|cx| RenderedNode::new(reference.clone(), true,
                    calls.clone(), label_renders, captures.clone(), window, cx));
                let target = cx.new(|cx| RenderedNode::new(reference, false,
                    calls, target_renders, Rc::new(RefCell::new(Vec::new())), window, cx));
                Host { label, target }
            }
        });
        frames(window, cx);
        assert!(label_renders.get() >= 2,
            "cold mount must obtain a usable paint-time lease through its own deferred drive");
        let original = latest(&captures);
        let original_node = window.update(cx, |host, window, cx| {
            assert!(ready(&host.label.read(cx).owner));
            assert!(ready(&host.target.read(cx).owner));
            original.request(window, cx);
            assert_eq!(calls.get(), 1, "initial installed-time capture activates the real target");
            host.target.read(cx).owner.borrow().modules.a11y_node.expect("real target node")
        }).unwrap();

        let before_label = label_renders.get();
        let before_target = target_renders.get();
        window.update(cx, |host, _, cx| {
            host.target.update(cx, |_, cx| cx.notify());
        }).unwrap();
        frames(window, cx);
        assert!(target_renders.get() > before_target, "control really redrew only the target");
        assert_eq!(label_renders.get(), before_label,
            "unrelated sibling notify must not cause a blanket Label render");
        window.update(cx, |_, window, cx| original.request(window, cx)).unwrap();
        assert_eq!(calls.get(), 2,
            "a same-path target redraw must preserve the already-captured physical authority");
        window.update(cx, |host, _, cx| {
            let label = host.label.read(cx).owner.clone();
            let target = host.target.read(cx).owner.clone();
            assert_eq!(physical_projection(&target).labelled_by(),
                &[label.borrow().modules.a11y_node.expect("cached actual Label node")]);
        }).unwrap();

        // Change the target's actual native ElementId path; do not mutate
        // Owner epoch, a11y node, bounds, frame or mounted state in the test.
        let before_replacement_label = label_renders.get();
        window.update(cx, |host, _, cx| {
            host.target.update(cx, |target, cx| {
                target.path_generation += 1;
                cx.notify();
            });
        }).unwrap();
        frames(window, cx);
        assert!(label_renders.get() > before_replacement_label,
            "physical target replacement must deliver the dirty Label notification");
        let replacement = latest(&captures);
        window.update(cx, |host, window, cx| {
            let changed_node = host.target.read(cx).owner.borrow().modules.a11y_node
                .expect("replacement target node");
            assert_ne!(changed_node, original_node, "the target truly acquired a different native node");
            original.request(window, cx);
            assert_eq!(calls.get(), 2, "a retained old paint lease cannot acquire the replacement");
            replacement.request(window, cx);
            assert_eq!(calls.get(), 3, "the newly painted Label lease restores current activation");
        }).unwrap();

        // A stable cached frame retains the newly captured immutable authority.
        let stable_renders = label_renders.get();
        frames(window, cx);
        assert_eq!(label_renders.get(), stable_renders, "stable pair must not form a repaint loop");
        window.update(cx, |_, window, cx| replacement.request(window, cx)).unwrap();
        assert_eq!(calls.get(), 4, "stable cached frames must preserve the current lease");
    }
    struct PhysicalHost {
        label: Entity<RenderedNode>,
        target: Entity<RenderedNode>,
        reference: ControlLabelRef,
        show_target: bool,
        duplicate_target: bool,
        duplicate_label: bool,
        extra_label: Option<Entity<RenderedNode>>,
    }
    impl Render for PhysicalHost {
        fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
            let mut root = div().flex().flex_col().size_full()
                .child(self.label.clone().cached(cached_style()));
            if self.show_target {
                root = root.child(self.target.clone().cached(cached_style()));
            }
            if self.duplicate_target {
                root = root.child(div().id("second-physical-target")
                    .child(self.target.clone().cached(cached_style())));
            }
            if self.duplicate_label {
                root = root.child(div().id("second-physical-label")
                    .child(self.label.clone().cached(cached_style())));
            }
            if let Some(extra) = &self.extra_label {
                root = root.child(extra.clone().cached(cached_style()));
            }
            root
        }
    }
    fn physical_frames(window: WindowHandle<PhysicalHost>, cx: &mut TestAppContext) {
        for _ in 0..8 {
            cx.run_until_parked();
            cx.update_window(window.into(), |_, window, cx| {
                window.draw(cx).clear(cx);
            }).unwrap();
        }
        cx.run_until_parked();
    }
    fn physical_projection(owner: &OwnerRef) -> gpui::accesskit::Node {
        let semantics = crate::gpui_native_a11y::Semantics {
            element: div().id("physical-proof-projection").into_element(),
            owner: Rc::downgrade(owner), role: Some(gpui::Role::GenericContainer),
        };
        let mut node = gpui::accesskit::Node::new(gpui::Role::GenericContainer);
        gpui::Element::write_a11y_info(&semantics, &mut node);
        node
    }
    #[gpui::test]
    fn retained_cached_occurrences_refuse_duplicates_and_withdraw_without_false_unmount(
        cx: &mut TestAppContext,
    ) {
        let calls = Rc::new(Cell::new(0));
        let label_renders = Rc::new(Cell::new(0));
        let target_renders = Rc::new(Cell::new(0));
        let captures = Rc::new(RefCell::new(Vec::new()));
        let window = cx.open_window(size(px(240.), px(260.)), {
            let calls = calls.clone();
            let label_renders = label_renders.clone();
            let target_renders = target_renders.clone();
            let captures = captures.clone();
            move |window, cx| {
                let reference = ControlLabelRef::new();
                let label = cx.new(|cx| RenderedNode::new(reference.clone(), true,
                    calls.clone(), label_renders, captures, window, cx));
                let target = cx.new(|cx| RenderedNode::new(reference.clone(), false,
                    calls, target_renders, Rc::new(RefCell::new(Vec::new())), window, cx));
                PhysicalHost { label, target, reference, show_target: true,
                    duplicate_target: false, duplicate_label: false, extra_label: None }
            }
        });
        physical_frames(window, cx);
        let original = latest(&captures);
        let (label, target, epoch, node, serial) = window.update(cx, |host, window, cx| {
            let label = host.label.read(cx).owner.clone();
            let target = host.target.read(cx).owner.clone();
            let view = control_label_view(&target).expect("actual unique physical target");
            original.request(window, cx);
            assert_eq!(calls.get(), 1);
            assert_eq!(physical_projection(&target).labelled_by(),
                &[label.borrow().modules.a11y_node.expect("actual Label node")]);
            (label, target, view.epoch, view.node, view.physical.expect("retained physical receipt"))
        }).unwrap();

        window.update(cx, |host, _, cx| {
            host.duplicate_target = true;
            cx.notify();
        }).unwrap();
        physical_frames(window, cx);
        window.update(cx, |_, window, cx| {
            assert_eq!(control_label_native_views(&target).len(), 2,
                "cached A and newly rendered B both own live element-state receipts");
            assert_eq!(control_label_diagnostic(&label), Some("ambiguous-view"));
            assert!(!control_label_action_available(&label));
            assert!(physical_projection(&target).labelled_by().is_empty());
            assert!(!physical_projection(&label).supports_action(gpui::accesskit::Action::Click));
            original.request(window, cx);
            assert_eq!(calls.get(), 1, "two physical target occurrences cannot choose a winner");
        }).unwrap();

        let renders_before_withdrawal = target_renders.get();
        window.update(cx, |host, _, cx| {
            host.duplicate_target = false;
            cx.notify();
        }).unwrap();
        // Inspect immediately after the one real draw, before the deferred
        // native wake is pumped. Surviving A must not need a manufactured mount
        // or a fresh prepaint to prove that its actual retained view still exists.
        let survivor = cx.update_window(window.into(), |_, window, cx| {
            window.draw(cx).clear(cx);
            assert_eq!(target_renders.get(), renders_before_withdrawal,
                "the original target A stayed cached while B was removed");
            assert!(ready(&target));
            assert_eq!(target.borrow().epoch, epoch, "removing B cannot unmount surviving A");
            let view = control_label_view(&target).expect("the actual retained A becomes unique");
            assert_eq!((view.node, view.physical), (node, Some(serial)));
            assert_eq!(control_label_diagnostic(&label), None);
            original.request(window, cx);
            assert_eq!(calls.get(), 1, "A -> A+B -> A cannot revive the old request");
            let survivor = control_label_action_lease(&label).unwrap();
            survivor.request(window, cx);
            assert_eq!(calls.get(), 2, "new authority can use the physically retained A");
            survivor
        }).unwrap();
        physical_frames(window, cx);

        // One ambiguous logical Label plus another unique Label is still a
        // duplicate group, never permission to silently skip the first Label.
        window.update(cx, |host, window, cx| {
            host.duplicate_label = true;
            let reference = host.reference.clone();
            host.extra_label = Some(cx.new(|cx| RenderedNode::new(reference, true,
                calls.clone(), Rc::new(Cell::new(0)),
                Rc::new(RefCell::new(Vec::new())), window, cx)));
            cx.notify();
        }).unwrap();
        physical_frames(window, cx);
        window.update(cx, |host, window, cx| {
            let extra = host.extra_label.as_ref().unwrap().read(cx).owner.clone();
            assert_eq!(control_label_native_views(&label).len(), 2);
            assert_eq!(control_label_native_views(&extra).len(), 1);
            assert_eq!(control_label_diagnostic(&label), Some("duplicate-binding"));
            assert_eq!(control_label_diagnostic(&extra), Some("duplicate-binding"));
            assert!(!control_label_action_available(&label));
            assert!(!control_label_action_available(&extra));
            assert!(physical_projection(&target).labelled_by().is_empty());
            assert!(!physical_projection(&extra).supports_action(gpui::accesskit::Action::Click));
            control_label_action_lease(&extra).unwrap().request(window, cx);
            assert_eq!(calls.get(), 2, "a unique extra Label cannot bypass an ambiguous participant");
            host.duplicate_label = false;
            if let Some(extra) = host.extra_label.take() {
                set_instance_associations(&extra.read(cx).owner, NativeInstanceAssociations::default());
            }
            cx.notify();
        }).unwrap();
        physical_frames(window, cx);

        window.update(cx, |host, _, cx| {
            host.show_target = false;
            cx.notify();
        }).unwrap();
        physical_frames(window, cx);
        window.update(cx, |_, window, cx| {
            assert!(target.borrow().modules.control_label.physical_observed);
            assert!(control_label_native_views(&target).is_empty());
            assert!(!ready(&target), "zero actual retained occurrences take the terminal detach path");
            assert!(!control_label_action_available(&label));
            assert!(!physical_projection(&label).supports_action(gpui::accesskit::Action::Click));
            original.request(window, cx);
            survivor.request(window, cx);
            assert_eq!(calls.get(), 2, "removed physical views cannot regain legacy-field authority");
        }).unwrap();
        window.update(cx, |host, _, cx| {
            host.show_target = true;
            cx.notify();
        }).unwrap();
        physical_frames(window, cx);
        window.update(cx, |_, window, cx| {
            let restored = control_label_view(&target).expect("new actual target occurrence");
            assert_eq!(restored.node, node, "the same native path restores the same node ID");
            assert_ne!(restored.physical, Some(serial), "restoration acquires a new physical receipt");
            assert_ne!(restored.epoch, epoch, "true terminal detach advances the logical lifetime");
            original.request(window, cx);
            survivor.request(window, cx);
            assert_eq!(calls.get(), 2, "neither old bridge revives after node-ID restoration");
            latest(&captures).request(window, cx);
            assert_eq!(calls.get(), 3, "the newly painted current bridge activates");
            assert_eq!(physical_projection(&target).labelled_by(),
                &[label.borrow().modules.a11y_node.expect("current actual Label node")]);
        }).unwrap();
    }


    #[gpui::test]
    fn retained_target_requires_an_actual_semantics_role_and_never_revives_old_bridges(
        cx: &mut TestAppContext,
    ) {
        let calls = Rc::new(Cell::new(0));
        let captures = Rc::new(RefCell::new(Vec::new()));
        let label_renders = Rc::new(Cell::new(0));
        let window = cx.open_window(size(px(240.), px(100.)), {
            let calls = calls.clone();
            let captures = captures.clone();
            let label_renders = label_renders.clone();
            move |window, cx| {
                let reference = ControlLabelRef::new();
                let label = cx.new(|cx| RenderedNode::new(reference.clone(), true,
                    calls.clone(), label_renders, captures, window, cx));
                let target = cx.new(|cx| RenderedNode::with_native_role(reference, false,
                    calls, Rc::new(Cell::new(0)), Rc::new(RefCell::new(Vec::new())),
                    Some(None), window, cx));
                Host { label, target }
            }
        });
        frames(window, cx);
        let missing = latest(&captures);
        let (label, target, epoch, missing_serial) = window.update(cx, |host, window, cx| {
            let label = host.label.read(cx).owner.clone();
            let target = host.target.read(cx).owner.clone();
            assert!(ready(&target), "a physically mounted target may legitimately lack an a11y node");
            assert!(!target.borrow().accessible);
            let physical = control_label_physical_unique(&target).expect("actual retained occurrence");
            assert_eq!(physical.node, None, "ElementId alone cannot manufacture an AccessKit node");
            assert!(control_label_view(&target).is_none());
            assert!(control_label_name(&target).is_none());
            assert!(!control_label_action_available(&label));
            assert!(physical_projection(&target).labelled_by().is_empty());
            assert!(!physical_projection(&label).supports_action(gpui::accesskit::Action::Click));
            missing.request(window, cx);
            assert_eq!(calls.get(), 0);
            let epoch = target.borrow().epoch;
            (label, target, epoch, physical.serial)
        }).unwrap();

        let before_role = label_renders.get();
        window.update(cx, |host, _, cx| {
            host.target.update(cx, |target, cx| {
                target.native_role = Some(Some(gpui::Role::Button));
                cx.notify();
            });
        }).unwrap();
        frames(window, cx);
        assert!(label_renders.get() > before_role,
            "the actual target role acquisition wakes the associated Label");
        let valid = latest(&captures);
        let (valid_node, valid_serial) = window.update(cx, |_, window, cx| {
            assert!(ready(&target));
            assert_eq!(target.borrow().epoch, epoch);
            assert!(!target.borrow().accessible,
                "the actual inner native role is sufficient without a synthetic accessible flag");
            let physical = control_label_physical_unique(&target).unwrap();
            let node = physical.node.expect("the real Semantics role exposes its node");
            assert_ne!(physical.serial, missing_serial);
            assert_eq!(physical_projection(&target).labelled_by(),
                &[control_label_view(&label).unwrap().node]);
            assert!(physical_projection(&label).supports_action(gpui::accesskit::Action::Click));
            missing.request(window, cx);
            assert_eq!(calls.get(), 0, "an empty immutable bridge cannot gain the now-valid pair");
            valid.request(window, cx);
            assert_eq!(calls.get(), 1);
            (node, physical.serial)
        }).unwrap();

        window.update(cx, |host, _, cx| {
            host.target.update(cx, |target, cx| {
                target.native_role = Some(None);
                cx.notify();
            });
        }).unwrap();
        frames(window, cx);
        window.update(cx, |_, window, cx| {
            assert!(ready(&target), "removing the role must not detach a still-retained physical view");
            assert_eq!(target.borrow().epoch, epoch);
            let physical = control_label_physical_unique(&target).unwrap();
            assert_eq!(physical.node, None);
            assert_ne!(physical.serial, valid_serial);
            assert!(control_label_name(&target).is_none());
            assert!(physical_projection(&target).labelled_by().is_empty());
            assert!(!physical_projection(&label).supports_action(gpui::accesskit::Action::Click));
            valid.request(window, cx);
            missing.request(window, cx);
            assert_eq!(calls.get(), 1);
        }).unwrap();

        window.update(cx, |host, _, cx| {
            host.target.update(cx, |target, cx| {
                target.native_role = Some(Some(gpui::Role::Button));
                cx.notify();
            });
        }).unwrap();
        frames(window, cx);
        let restored = latest(&captures);
        window.update(cx, |_, window, cx| {
            assert!(ready(&target));
            assert_eq!(target.borrow().epoch, epoch);
            let physical = control_label_physical_unique(&target).unwrap();
            assert_eq!(physical.node, Some(valid_node), "same native path is a real ABA control");
            assert_ne!(physical.serial, valid_serial);
            valid.request(window, cx);
            missing.request(window, cx);
            assert_eq!(calls.get(), 1, "neither old bridge can reacquire the returned node");
            restored.request(window, cx);
            assert_eq!(calls.get(), 2);
            assert_eq!(physical_projection(&target).labelled_by(),
                &[control_label_view(&label).unwrap().node]);
        }).unwrap();
    }
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
