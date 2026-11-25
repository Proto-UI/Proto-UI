use gpui::prelude::*;
pub struct InvokeReturnProps {}
impl Default for InvokeReturnProps {
    fn default() -> Self {
        Self {}
    }
}
pub struct InvokeReturn {
    props: InvokeReturnProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    state_count: f64,
    render_state_count: f64,
}
impl InvokeReturn {
    pub fn read_state_count(&self) -> f64 {
        self.state_count.clone()
    }
    fn set_state_count(&mut self, value: f64) -> Result<(), String> {
        if !!value.is_nan() {
            return Err("Invalid native value for count".to_owned());
        }
        self.state_count = value;
        Ok(())
    }
    fn capture_render_snapshot(&mut self) -> () {
        self.render_state_count = self.state_count.clone();
    }
    pub fn new(props: InvokeReturnProps) -> Result<Self, String> {
        let mut component = Self {
            props: InvokeReturnProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            state_count: 0f64,
            render_state_count: 0f64,
        };
        component.update_props(props)?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: InvokeReturnProps) -> Result<(), String> {
        self.props = props;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: InvokeReturnProps,
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
    pub fn handle_click_0(&mut self) -> Result<(), String> {
        || -> Result<(), String> {
            if self.state_count.clone() == 0f64 {
                return Ok(());
            } else {};
            self.set_state_count(999f64)?;
            Ok(())
        }()?;
        self.set_state_count(1f64)?;
        {
            self.capture_render_snapshot();
            self.update_requested = true;
        };
        Ok(())
    }
}
impl gpui::Render for InvokeReturn {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let root = gpui::div()
            .child(gpui::div().child("Hello".to_owned()))
            .id(("proto-root", cx.entity_id()))
            .on_click(
                cx
                    .listener(|this, _event, _window, cx| {
                        if let Err(error) = (|| {
                            this.handle_click_0()?;
                            Ok(())
                        })() {
                            this.last_error = Some(error);
                        }
                        let update_requested = this.take_update_request();
                        let feedback_dirty = this.take_feedback_update();
                        if update_requested || feedback_dirty {
                            cx.notify();
                        }
                    }),
            );
        root.into_any_element()
    }
}
