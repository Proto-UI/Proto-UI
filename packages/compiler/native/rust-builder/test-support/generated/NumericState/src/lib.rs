use gpui::prelude::*;
pub struct NumericStateProps {}
impl Default for NumericStateProps {
    fn default() -> Self {
        Self {}
    }
}
pub struct NumericState {
    props: NumericStateProps,
    last_error: Option<String>,
    state_number: f64,
}
impl NumericState {
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
    pub fn new(props: NumericStateProps) -> Result<Self, String> {
        let mut component = Self {
            props: NumericStateProps::default(),
            last_error: None,
            state_number: -0f64,
        };
        component.update_props(props)?;
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
        self.update_props(props)?;
        cx.notify();
        Ok(())
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
            .child(ryu_js::Buffer::new().format(self.state_number).to_owned())
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
                        cx.notify();
                    }),
            );
        if self.state_number.is_finite() && 1f64.is_finite() && self.state_number >= 1f64
        {
            root = root.bg(gpui::rgb(3900150));
        }
        root.into_any_element()
    }
}
