use gpui::prelude::*;
pub struct SlotHostProps {
    pub prop_label: Option<Option<String>>,
}
impl Default for SlotHostProps {
    fn default() -> Self {
        Self { prop_label: None }
    }
}
pub enum SlotHostChild {
    Text(String),
    View(gpui::AnyView),
}
pub struct SlotHost {
    props: SlotHostProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    slot_children: Vec<SlotHostChild>,
    resolved_prop_label: Option<String>,
    previous_prop_label: Option<String>,
    render_prop_label: Option<String>,
    state_clicks: f64,
    render_state_clicks: f64,
}
impl SlotHost {
    pub fn set_children(
        &mut self,
        children: Vec<SlotHostChild>,
        cx: &mut gpui::Context<Self>,
    ) -> () {
        self.slot_children = children;
        cx.notify();
    }
    pub fn read_prop_label(&self) -> Option<String> {
        self.resolved_prop_label.clone()
    }
    pub fn read_state_clicks(&self) -> f64 {
        self.state_clicks.clone()
    }
    fn set_state_clicks(&mut self, value: f64) -> Result<(), String> {
        if !!value.is_nan() {
            return Err("Invalid native value for clicks".to_owned());
        }
        self.state_clicks = value;
        Ok(())
    }
    fn capture_render_snapshot(&mut self) -> () {
        self.render_prop_label = self.resolved_prop_label.clone();
        self.render_state_clicks = self.state_clicks.clone();
    }
    pub fn new(props: SlotHostProps) -> Result<Self, String> {
        let mut component = Self {
            props: SlotHostProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            slot_children: Vec::new(),
            resolved_prop_label: None,
            previous_prop_label: None,
            render_prop_label: None,
            state_clicks: 0f64,
            render_state_clicks: 0f64,
        };
        component.update_props(props)?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: SlotHostProps) -> Result<(), String> {
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
                        .or(Some("Root before".to_owned()));
                    self.previous_prop_label = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_label
                    .clone()
                    .or(Some("Root before".to_owned()));
                self.previous_prop_label = fallback.clone();
                fallback
            }
        } else {
            Some("Root before".to_owned())
        };
        self.resolved_prop_label = resolved_label;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: SlotHostProps,
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
        self.set_state_clicks(self.state_clicks.clone() + 1f64)?;
        {
            self.capture_render_snapshot();
            self.update_requested = true;
        };
        Ok(())
    }
}
impl gpui::Render for SlotHost {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let root = gpui::div()
            .child(
                self
                    .render_prop_label
                    .clone()
                    .map_or_else(String::new, |value| { value.clone() }),
            )
            .child({
                let mut node = gpui::div().p_2();
                for child in &self.slot_children {
                    node = match child {
                        SlotHostChild::Text(value) => node.child(value.clone()),
                        SlotHostChild::View(value) => node.child(value.clone()),
                    };
                }
                node
            })
            .child("Root after".to_owned())
            .id(("proto-root", cx.entity_id()))
            .p_4()
            .w_64()
            .h_64()
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
