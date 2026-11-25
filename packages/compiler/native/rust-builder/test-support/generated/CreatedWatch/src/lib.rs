use gpui::prelude::*;
pub struct CreatedWatchProps {
    pub prop_label: Option<Option<String>>,
    pub prop_amount: Option<Option<f64>>,
}
impl Default for CreatedWatchProps {
    fn default() -> Self {
        Self {
            prop_label: None,
            prop_amount: None,
        }
    }
}
pub struct CreatedWatch {
    props: CreatedWatchProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    props_initialized: bool,
    resolved_prop_label: Option<String>,
    previous_prop_label: Option<String>,
    render_prop_label: Option<String>,
    previous_snapshot_prop_label: Option<String>,
    resolved_prop_amount: Option<f64>,
    previous_prop_amount: Option<f64>,
    render_prop_amount: Option<f64>,
    previous_snapshot_prop_amount: Option<f64>,
    state_created: String,
    render_state_created: String,
    state_order: String,
    render_state_order: String,
    state_previous: f64,
    render_state_previous: f64,
    state_current: f64,
    render_state_current: f64,
}
impl CreatedWatch {
    pub fn read_prop_label(&self) -> Option<String> {
        self.resolved_prop_label.clone()
    }
    pub fn read_prop_amount(&self) -> Option<f64> {
        self.resolved_prop_amount.clone()
    }
    pub fn read_state_created(&self) -> String {
        self.state_created.clone()
    }
    fn set_state_created(&mut self, value: String) -> Result<(), String> {
        if !true {
            return Err("Invalid native value for created".to_owned());
        }
        self.state_created = value;
        Ok(())
    }
    pub fn read_state_order(&self) -> String {
        self.state_order.clone()
    }
    fn set_state_order(&mut self, value: String) -> Result<(), String> {
        if !true {
            return Err("Invalid native value for order".to_owned());
        }
        self.state_order = value;
        Ok(())
    }
    pub fn read_state_previous(&self) -> f64 {
        self.state_previous.clone()
    }
    fn set_state_previous(&mut self, value: f64) -> Result<(), String> {
        if !!value.is_nan() {
            return Err("Invalid native value for previous".to_owned());
        }
        self.state_previous = value;
        Ok(())
    }
    pub fn read_state_current(&self) -> f64 {
        self.state_current.clone()
    }
    fn set_state_current(&mut self, value: f64) -> Result<(), String> {
        if !!value.is_nan() {
            return Err("Invalid native value for current".to_owned());
        }
        self.state_current = value;
        Ok(())
    }
    fn capture_render_snapshot(&mut self) -> () {
        self.render_prop_label = self.resolved_prop_label.clone();
        self.render_prop_amount = self.resolved_prop_amount.clone();
        self.render_state_created = self.state_created.clone();
        self.render_state_order = self.state_order.clone();
        self.render_state_previous = self.state_previous.clone();
        self.render_state_current = self.state_current.clone();
    }
    pub fn new(props: CreatedWatchProps) -> Result<Self, String> {
        let mut component = Self {
            props: CreatedWatchProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            props_initialized: false,
            resolved_prop_label: None,
            previous_prop_label: None,
            render_prop_label: None,
            previous_snapshot_prop_label: None,
            resolved_prop_amount: None,
            previous_prop_amount: None,
            render_prop_amount: None,
            previous_snapshot_prop_amount: None,
            state_created: "Not created".to_owned(),
            render_state_created: "Not created".to_owned(),
            state_order: "".to_owned(),
            render_state_order: "".to_owned(),
            state_previous: 0f64,
            render_state_previous: 0f64,
            state_current: 0f64,
            render_state_current: 0f64,
        };
        component.update_props(props)?;
        component.handle_created_0()?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: CreatedWatchProps) -> Result<(), String> {
        self.previous_snapshot_prop_amount = self.resolved_prop_amount.clone();
        self.previous_snapshot_prop_label = self.resolved_prop_label.clone();
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
                        .or(Some("Initial".to_owned()));
                    self.previous_prop_label = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_label
                    .clone()
                    .or(Some("Initial".to_owned()));
                self.previous_prop_label = fallback.clone();
                fallback
            }
        } else {
            Some("Initial".to_owned())
        };
        let resolved_amount = if let Some(raw) = self.props.prop_amount.clone() {
            if let Some(value) = raw {
                if value.is_finite() {
                    self.previous_prop_amount = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self.previous_prop_amount.clone().or(Some(0f64));
                    self.previous_prop_amount = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self.previous_prop_amount.clone().or(Some(0f64));
                self.previous_prop_amount = fallback.clone();
                fallback
            }
        } else {
            Some(0f64)
        };
        self.resolved_prop_label = resolved_label;
        self.resolved_prop_amount = resolved_amount;
        if self.props_initialized {
            if false
                || self.resolved_prop_label.clone()
                    != self.previous_snapshot_prop_label.clone()
                || self.resolved_prop_amount.clone().map(|value| { value.to_bits() })
                    != self
                        .previous_snapshot_prop_amount
                        .clone()
                        .map(|value| { value.to_bits() })
            {
                self.handle_props_watch_0()?;
            }
            if false
                || self.resolved_prop_amount.clone().map(|value| { value.to_bits() })
                    != self
                        .previous_snapshot_prop_amount
                        .clone()
                        .map(|value| { value.to_bits() })
            {
                self.handle_props_watch_1()?;
            }
            if false
                || self.resolved_prop_label.clone()
                    != self.previous_snapshot_prop_label.clone()
            {
                self.handle_props_watch_2()?;
            }
        }
        self.props_initialized = true;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: CreatedWatchProps,
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
        self.set_state_created(
            self
                .resolved_prop_label
                .clone()
                .expect("Compiler proved a non-empty prop fallback"),
        )?;
        Ok(())
    }
    fn handle_props_watch_0(&mut self) -> Result<(), String> {
        self.set_state_order(self.state_order.clone() + &"A".to_owned())?;
        self.set_state_previous(
            self
                .previous_snapshot_prop_amount
                .clone()
                .expect("Compiler proved a non-empty prop fallback"),
        )?;
        self.set_state_current(
            self
                .resolved_prop_amount
                .clone()
                .expect("Compiler proved a non-empty prop fallback"),
        )?;
        if self
            .resolved_prop_amount
            .clone()
            .expect("Compiler proved a non-empty prop fallback") == 13f64
        {
            self.set_state_current(0f64 / 0f64)?;
        } else {};
        Ok(())
    }
    fn handle_props_watch_1(&mut self) -> Result<(), String> {
        self.set_state_order(self.state_order.clone() + &"B".to_owned())?;
        Ok(())
    }
    fn handle_props_watch_2(&mut self) -> Result<(), String> {
        self.set_state_order(self.state_order.clone() + &"C".to_owned())?;
        Ok(())
    }
}
impl gpui::Render for CreatedWatch {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let root = gpui::div()
            .child(
                gpui::div()
                    .child(self.render_state_created.clone())
                    .child(self.render_state_order.clone())
                    .child(
                        ryu_js::Buffer::new()
                            .format(self.render_state_current)
                            .to_owned(),
                    ),
            )
            .id(("proto-root", cx.entity_id()));
        root.into_any_element()
    }
}
