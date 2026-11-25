use gpui::prelude::*;
pub struct CreatedFailureProps {}
impl Default for CreatedFailureProps {
    fn default() -> Self {
        Self {}
    }
}
pub struct CreatedFailure {
    props: CreatedFailureProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    state_number: f64,
    render_state_number: f64,
}
impl CreatedFailure {
    pub fn read_state_number(&self) -> f64 {
        self.state_number.clone()
    }
    fn set_state_number(&mut self, value: f64) -> Result<(), String> {
        if !!value.is_nan() {
            return Err("Invalid native value for number".to_owned());
        }
        self.state_number = value;
        Ok(())
    }
    fn capture_render_snapshot(&mut self) -> () {
        self.render_state_number = self.state_number.clone();
    }
    pub fn new(props: CreatedFailureProps) -> Result<Self, String> {
        let mut component = Self {
            props: CreatedFailureProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            state_number: 0f64,
            render_state_number: 0f64,
        };
        component.update_props(props)?;
        component.handle_created_0()?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: CreatedFailureProps) -> Result<(), String> {
        self.props = props;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: CreatedFailureProps,
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
    fn handle_created_0(&mut self) -> Result<(), String> {
        self.set_state_number(f64::NAN)?;
        Ok(())
    }
}
impl gpui::Render for CreatedFailure {
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
