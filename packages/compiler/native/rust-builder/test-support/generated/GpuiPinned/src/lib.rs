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
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    resolved_prop_label: Option<String>,
    previous_prop_label: Option<String>,
    render_prop_label: Option<String>,
    state_count: f64,
    render_state_count: f64,
    state_hidden: bool,
    render_state_hidden: bool,
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
        if value.to_bits() != self.state_count.to_bits() {
            self.feedback_dirty = true;
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
    fn capture_render_snapshot(&mut self) -> () {
        self.render_prop_label = self.resolved_prop_label.clone();
        self.render_state_count = self.state_count.clone();
        self.render_state_hidden = self.state_hidden.clone();
    }
    pub fn new(props: GpuiPinnedProps) -> Result<Self, String> {
        let mut component = Self {
            props: GpuiPinnedProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            resolved_prop_label: None,
            previous_prop_label: None,
            render_prop_label: None,
            state_count: 0f64,
            render_state_count: 0f64,
            state_hidden: true,
            render_state_hidden: true,
        };
        component.update_props(props)?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
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
        self.set_state_hidden(!self.state_hidden.clone())?;
        let local_local0 = self.state_count.clone();
        if local_local0.clone() >= 1f64 {
            self.set_state_count(local_local0.clone() / 2f64)?;
        } else {
            self.set_state_count(local_local0.clone() + 1f64)?;
        };
        {
            self.capture_render_snapshot();
            self.update_requested = true;
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
            .child(
                gpui::div()
                    .w_64()
                    .h_32()
                    .p_4()
                    .child(
                        self
                            .render_prop_label
                            .clone()
                            .map_or_else(String::new, |value| { value.clone() }),
                    )
                    .child(
                        ryu_js::Buffer::new().format(self.render_state_count).to_owned(),
                    ),
            )
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
        if self.state_count.is_finite() && 1f64.is_finite() && self.state_count >= 1f64 {
            root = root.bg(gpui::rgb(3900150));
        }
        root.into_any_element()
    }
}
