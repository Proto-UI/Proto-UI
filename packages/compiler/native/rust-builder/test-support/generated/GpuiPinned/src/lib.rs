use gpui::prelude::*;
pub struct GpuiPinnedProps {
    pub prop_label: Option<Option<String>>,
}
impl Default for GpuiPinnedProps {
    fn default() -> Self {
        Self { prop_label: None }
    }
}
pub struct GpuiPinned {
    props: GpuiPinnedProps,
    last_error: Option<String>,
    resolved_prop_label: Option<String>,
    previous_prop_label: Option<String>,
    state_count: f64,
    state_hidden: bool,
}
impl GpuiPinned {
    pub fn read_prop_label(&self) -> Option<String> {
        self.resolved_prop_label.clone()
    }
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
    pub fn read_state_hidden(&self) -> bool {
        self.state_hidden.clone()
    }
    fn set_state_hidden(&mut self, value: bool) -> Result<(), String> {
        if !true {
            return Err("Invalid native value for hidden".to_owned());
        }
        self.state_hidden = value;
        Ok(())
    }
    pub fn new(props: GpuiPinnedProps) -> Result<Self, String> {
        let mut component = Self {
            props: GpuiPinnedProps::default(),
            last_error: None,
            resolved_prop_label: None,
            previous_prop_label: None,
            state_count: 0f64,
            state_hidden: true,
        };
        component.update_props(props)?;
        Ok(component)
    }
    pub fn update_props(&mut self, props: GpuiPinnedProps) -> Result<(), String> {
        self.props = props;
        let resolved_label = if let Some(raw) = self.props.prop_label.clone() {
            if let Some(value) = raw {
                if true {
                    self.previous_prop_label = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_label
                        .clone()
                        .or(Some("Count:".to_owned()));
                    self.previous_prop_label = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_label
                    .clone()
                    .or(Some("Count:".to_owned()));
                self.previous_prop_label = fallback.clone();
                fallback
            }
        } else {
            Some("Count:".to_owned())
        };
        self.resolved_prop_label = resolved_label;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: GpuiPinnedProps,
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
        self.set_state_hidden(!self.state_hidden.clone())?;
        let local_local0 = self.state_count.clone();
        if local_local0.clone() >= 1f64 {
            self.set_state_count(local_local0.clone() / 2f64)?;
        } else {
            self.set_state_count(local_local0.clone() + 1f64)?;
        };
        Ok(())
    }
}
impl gpui::Render for GpuiPinned {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let mut root = gpui::div()
            .w_64()
            .h_32()
            .p_4()
            .child(
                self
                    .resolved_prop_label
                    .clone()
                    .map_or_else(String::new, |value| { value.clone() }),
            )
            .child(ryu_js::Buffer::new().format(self.state_count).to_owned())
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
                        cx.notify();
                    }),
            );
        if self.state_count.is_finite() && 1f64.is_finite() && self.state_count >= 1f64 {
            root = root.bg(gpui::rgb(3900150));
        }
        root.into_any_element()
    }
}
