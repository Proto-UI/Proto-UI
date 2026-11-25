use gpui::prelude::*;
pub struct NumericPolicyProps {}
impl Default for NumericPolicyProps {
    fn default() -> Self {
        Self {}
    }
}
pub struct NumericPolicy {
    props: NumericPolicyProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    state_bounded: f64,
    render_state_bounded: f64,
    state_stepped: f64,
    render_state_stepped: f64,
    state_optioned: f64,
    render_state_optioned: f64,
}
impl NumericPolicy {
    pub fn read_state_bounded(&self) -> f64 {
        self.state_bounded.clone()
    }
    fn set_state_bounded(&mut self, value: f64) -> Result<(), String> {
        if !(!value.is_nan() && !(value < 0f64) && !(value > 10f64)) {
            return Err("Invalid native value for bounded".to_owned());
        }
        self.state_bounded = value;
        Ok(())
    }
    pub fn read_state_stepped(&self) -> f64 {
        self.state_stepped.clone()
    }
    fn set_state_stepped(&mut self, value: f64) -> Result<(), String> {
        if !(!value.is_nan() && !(value < 0f64) && !(value > 10f64)
            && (!(0.25f64 > 0f64)
                || ((value - 0f64) / 0.25f64).is_finite()
                    && ((value - 0f64) / 0.25f64).fract() == 0f64))
        {
            return Err("Invalid native value for stepped".to_owned());
        }
        self.state_stepped = value;
        Ok(())
    }
    pub fn read_state_optioned(&self) -> f64 {
        self.state_optioned.clone()
    }
    fn set_state_optioned(&mut self, value: f64) -> Result<(), String> {
        if !(!value.is_nan() && (false || value == 0.5f64 || value == 2.5f64)) {
            return Err("Invalid native value for optioned".to_owned());
        }
        self.state_optioned = value;
        Ok(())
    }
    fn capture_render_snapshot(&mut self) -> () {
        self.render_state_bounded = self.state_bounded.clone();
        self.render_state_stepped = self.state_stepped.clone();
        self.render_state_optioned = self.state_optioned.clone();
    }
    pub fn new(props: NumericPolicyProps) -> Result<Self, String> {
        let mut component = Self {
            props: NumericPolicyProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            state_bounded: 0f64,
            render_state_bounded: 0f64,
            state_stepped: 0.5f64,
            render_state_stepped: 0.5f64,
            state_optioned: 0.5f64,
            render_state_optioned: 0.5f64,
        };
        component.update_props(props)?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: NumericPolicyProps) -> Result<(), String> {
        self.props = props;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: NumericPolicyProps,
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
        self.set_state_bounded(5f64)?;
        Ok(())
    }
    pub fn handle_click_1(&mut self) -> Result<(), String> {
        self.set_state_bounded(-1f64)?;
        Ok(())
    }
    pub fn handle_click_2(&mut self) -> Result<(), String> {
        self.set_state_stepped(0.75f64)?;
        Ok(())
    }
    pub fn handle_click_3(&mut self) -> Result<(), String> {
        self.set_state_stepped(0.7f64)?;
        Ok(())
    }
    pub fn handle_click_4(&mut self) -> Result<(), String> {
        self.set_state_optioned(2.5f64)?;
        Ok(())
    }
    pub fn handle_click_5(&mut self) -> Result<(), String> {
        self.set_state_optioned(100f64)?;
        Ok(())
    }
}
impl gpui::Render for NumericPolicy {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let root = gpui::div()
            .child(ryu_js::Buffer::new().format(self.render_state_bounded).to_owned())
            .child(ryu_js::Buffer::new().format(self.render_state_stepped).to_owned())
            .id(("proto-root", cx.entity_id()))
            .on_click(
                cx
                    .listener(|this, _event, _window, cx| {
                        if let Err(error) = (|| {
                            this.handle_click_0()?;
                            this.handle_click_1()?;
                            this.handle_click_2()?;
                            this.handle_click_3()?;
                            this.handle_click_4()?;
                            this.handle_click_5()?;
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
