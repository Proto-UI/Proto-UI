use gpui::prelude::*;
pub struct NumericStateProps {}
impl Default for NumericStateProps {
    fn default() -> Self {
        Self {}
    }
}
pub struct NumericState {
    props: NumericStateProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    state_number: f64,
    render_state_number: f64,
}
impl NumericState {
    pub fn read_state_number(&self) -> f64 {
        self.state_number.clone()
    }
    fn set_state_number(&mut self, value: f64) -> Result<(), String> {
        if !!value.is_nan() {
            return Err("Invalid native value for number".to_owned());
        }
        if value.to_bits() != self.state_number.to_bits() {
            self.feedback_dirty = true;
        }
        self.state_number = value;
        Ok(())
    }
    fn capture_render_snapshot(&mut self) -> () {
        self.render_state_number = self.state_number.clone();
    }
    pub fn new(props: NumericStateProps) -> Result<Self, String> {
        let mut component = Self {
            props: NumericStateProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            state_number: -0f64,
            render_state_number: -0f64,
        };
        component.update_props(props)?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: NumericStateProps) -> Result<(), String> {
        self.props = props;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: NumericStateProps,
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
        self.set_state_number(-self.state_number.clone())?;
        Ok(())
    }
    pub fn handle_click_1(&mut self) -> Result<(), String> {
        self.set_state_number(f64::INFINITY)?;
        Ok(())
    }
    pub fn handle_click_2(&mut self) -> Result<(), String> {
        self.set_state_number(0.5f64)?;
        Ok(())
    }
    pub fn handle_click_3(&mut self) -> Result<(), String> {
        self.set_state_number(0f64 / 0f64)?;
        Ok(())
    }
    pub fn handle_click_4(&mut self) -> Result<(), String> {
        self.set_state_number(999f64)?;
        Ok(())
    }
}
impl gpui::Render for NumericState {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let mut root = gpui::div()
            .child(
                gpui::div()
                    .child(
                        ryu_js::Buffer::new().format(self.render_state_number).to_owned(),
                    ),
            )
            .id(("proto-root", cx.entity_id()))
            .w_64()
            .h_32()
            .on_click(
                cx
                    .listener(|this, _event, _window, cx| {
                        if let Err(error) = (|| {
                            this.handle_click_0()?;
                            this.handle_click_1()?;
                            this.handle_click_2()?;
                            this.handle_click_3()?;
                            this.handle_click_4()?;
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
        if self.state_number.is_finite() && 1f64.is_finite() && self.state_number >= 1f64
        {
            root = root.bg(gpui::rgb(3900150));
        }
        root.into_any_element()
    }
}
