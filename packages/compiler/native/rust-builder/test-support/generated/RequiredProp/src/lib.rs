use gpui::prelude::*;
pub struct RequiredPropProps {
    pub prop_required: Option<Option<String>>,
}
impl Default for RequiredPropProps {
    fn default() -> Self {
        Self { prop_required: None }
    }
}
pub struct RequiredProp {
    props: RequiredPropProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    resolved_prop_required: Option<String>,
    previous_prop_required: Option<String>,
    render_prop_required: Option<String>,
}
impl RequiredProp {
    pub fn read_prop_required(&self) -> Option<String> {
        self.resolved_prop_required.clone()
    }
    fn capture_render_snapshot(&mut self) -> () {
        self.render_prop_required = self.resolved_prop_required.clone();
    }
    pub fn new(props: RequiredPropProps) -> Result<Self, String> {
        let mut component = Self {
            props: RequiredPropProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            resolved_prop_required: None,
            previous_prop_required: None,
            render_prop_required: None,
        };
        component.update_props(props)?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: RequiredPropProps) -> Result<(), String> {
        self.props = props;
        let resolved_required = if let Some(raw) = self.props.prop_required.clone() {
            if let Some(value) = raw {
                if true {
                    self.previous_prop_required = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self.previous_prop_required.clone().or(None);
                    self.previous_prop_required = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self.previous_prop_required.clone().or(None);
                self.previous_prop_required = fallback.clone();
                fallback
            }
        } else {
            None
        };
        if resolved_required.is_none() {
            return Err("Prop has no non-empty fallback: required".to_owned());
        }
        self.resolved_prop_required = resolved_required;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: RequiredPropProps,
        cx: &mut gpui::Context<Self>,
    ) -> Result<(), String> {
        let result = self.update_props(props);
        let requested = self.take_update_request();
        let feedback = self.take_feedback_update();
        if result.is_ok() {
            self.capture_render_snapshot();
            cx.notify();
        } else {
            if requested || feedback {
                cx.notify();
            }
        };
        result
    }
    fn take_update_request(&mut self) -> bool {
        let requested = self.update_requested;
        self.update_requested = false;
        requested
    }
    fn take_feedback_update(&mut self) -> bool {
        let dirty = self.feedback_dirty;
        self.feedback_dirty = false;
        dirty
    }
    pub fn take_error(&mut self) -> Option<String> {
        self.last_error.take()
    }
}
impl gpui::Render for RequiredProp {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let root = gpui::div()
            .child(gpui::div().child("Hello".to_owned()))
            .id(("proto-root", cx.entity_id()));
        root.into_any_element()
    }
}
